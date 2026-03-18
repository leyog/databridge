import { NextRequest } from "next/server";
import { createAnthropic } from "@ai-sdk/anthropic";
import { streamText, tool } from "ai";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getOrgId(userId: string) {
  const m = await prisma.orgMember.findFirst({ where: { userId } });
  return m?.orgId ?? null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const orgId = await getOrgId(session.user.id);
  if (!orgId) return new Response("No org", { status: 403 });

  const { messages } = await req.json();

  const aiConfig = await prisma.aiConfig.findUnique({ where: { orgId } });
  const apiKey = aiConfig?.apiKey || process.env.ANTHROPIC_API_KEY!;
  const baseURL = aiConfig?.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const model = aiConfig?.model || process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514";

  const anthropic = createAnthropic({
    apiKey,
    baseURL,
    fetch: async (url, init) => {
      if (init?.body) {
        const body = JSON.parse(init.body.toString());
        if (Array.isArray(body.system)) {
          body.system = body.system.map((s: any) => s.text ?? "").join("\n");
        }
        body.stream = true;
        // Fix empty input_schema for tools - inject real schemas
        const toolSchemas: Record<string, any> = {
          list_jobs: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["PENDING","PROCESSING","PARSED","REVIEWING","APPROVED","REJECTED","SENT","FAILED"] },
              limit: { type: "number", minimum: 1, maximum: 50, default: 10 },
            },
          },
          list_templates: { type: "object", properties: {} },
          create_template: {
            type: "object",
            required: ["name", "prompt", "outputSchema"],
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              prompt: { type: "string" },
              outputSchema: { type: "object" },
            },
          },
          get_analytics: {
            type: "object",
            properties: { days: { type: "number", minimum: 1, maximum: 90, default: 30 } },
          },
          list_webhook_endpoints: { type: "object", properties: {} },
          create_webhook_endpoint: {
            type: "object",
            required: ["name", "url"],
            properties: {
              name: { type: "string" },
              url: { type: "string" },
              format: { type: "string", enum: ["raw", "zapier"], default: "raw" },
            },
          },
          approve_job: {
            type: "object",
            required: ["jobId"],
            properties: { jobId: { type: "string" } },
          },
          bulk_approve: {
            type: "object",
            required: ["jobIds"],
            properties: { jobIds: { type: "array", items: { type: "string" } } },
          },
        };
        if (Array.isArray(body.tools)) {
          body.tools = body.tools.map((t: any) => ({
            ...t,
            input_schema: toolSchemas[t.name] ?? { type: "object", properties: {} },
          }));
        }
        init = { ...init, body: JSON.stringify(body) };
      }
      return fetch(url, init);
    },
  });
  console.log("[chat] config:", { baseURL, model });
  const cookie = req.headers.get("cookie") || "";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8001";

  const apiFetch = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers as Record<string, string>) },
    });

  try {
    const result = await streamText({
    model: anthropic(model),
    system: `You are DataBridge Assistant, an AI helper embedded in the DataBridge document processing platform.
Help users manage document processing workflows through natural language.
You can: list/create templates, view jobs, manage webhook endpoints, show analytics.
Respond in the same language the user uses. Be concise and action-oriented.`,
    messages,
    maxSteps: 5,
    tools: {
      list_jobs: tool({
        description: "List recent jobs with optional status filter",
        parameters: z.object({
          status: z.enum(["PENDING","PROCESSING","PARSED","REVIEWING","APPROVED","REJECTED","SENT","FAILED"]).optional(),
          limit: z.number().min(1).max(50).default(10),
        }),
        execute: async ({ status, limit }) => {
          const params = new URLSearchParams({ limit: String(limit) });
          if (status) params.set("status", status);
          const res = await apiFetch(`/api/jobs?${params}`);
          const data = await res.json();
          const jobs = (data.jobs ?? data) as any[];
          return { count: jobs.length, jobs: jobs.map((j: any) => ({ id: j.id, fileName: j.fileName, status: j.status, template: j.template?.name })) };
        },
      }),
      list_templates: tool({
        description: "List all templates",
        parameters: z.object({}),
        execute: async () => {
          const res = await apiFetch("/api/templates");
          const templates = await res.json() as any[];
          return { count: templates.length, templates: templates.map((t: any) => ({ id: t.id, name: t.name, description: t.description })) };
        },
      }),
      create_template: tool({
        description: "Create a new document template",
        parameters: z.object({
          name: z.string(),
          description: z.string().optional(),
          prompt: z.string(),
          outputSchema: z.record(z.string(), z.any()),
        }),
        execute: async (args) => {
          const res = await apiFetch("/api/templates", { method: "POST", body: JSON.stringify(args) });
          const data = await res.json() as any;
          return res.ok ? { success: true, id: data.id, name: data.name } : { success: false, error: data.error };
        },
      }),
      get_analytics: tool({
        description: "Get analytics data",
        parameters: z.object({ days: z.number().min(1).max(90).default(30) }),
        execute: async ({ days }) => {
          const res = await apiFetch(`/api/analytics?days=${days}`);
          return res.json();
        },
      }),
      list_webhook_endpoints: tool({
        description: "List all webhook endpoints",
        parameters: z.object({}),
        execute: async () => {
          const res = await apiFetch("/api/webhook-endpoints");
          return res.json();
        },
      }),
      create_webhook_endpoint: tool({
        description: "Create a new webhook endpoint",
        parameters: z.object({
          name: z.string(),
          url: z.string().url(),
          format: z.enum(["raw", "zapier"]).default("raw"),
        }),
        execute: async (args) => {
          const res = await apiFetch("/api/webhook-endpoints", { method: "POST", body: JSON.stringify(args) });
          const data = await res.json() as any;
          return res.ok ? { success: true, id: data.id, name: data.name } : { success: false, error: data.error };
        },
      }),
      approve_job: tool({
        description: "Approve a job by ID",
        parameters: z.object({ jobId: z.string() }),
        execute: async ({ jobId }) => {
          const res = await apiFetch(`/api/jobs/${jobId}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
          const data = await res.json() as any;
          return res.ok ? { success: true, status: data.status } : { success: false, error: data.error };
        },
      }),
      bulk_approve: tool({
        description: "Bulk approve multiple jobs",
        parameters: z.object({ jobIds: z.array(z.string()) }),
        execute: async ({ jobIds }) => {
          const res = await apiFetch("/api/jobs/bulk", { method: "POST", body: JSON.stringify({ action: "approve", jobIds }) });
          const data = await res.json() as any;
          return res.ok ? { success: true, count: data.results?.length } : { success: false, error: data.error };
        },
      }),
    },
  });

    return result.toDataStreamResponse({
      getErrorMessage: (error) => {
        console.error("[chat] stream error:", JSON.stringify(error));
        return error instanceof Error ? error.message : String(error);
      },
    });
  } catch (e: any) {
    console.error("[chat] caught error:", e?.message, e?.status, JSON.stringify(e?.responseBody ?? e));
    return new Response(JSON.stringify({ error: e?.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}
