import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_jobs",
      description: "List jobs with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["PENDING","PROCESSING","PARSED","REVIEWING","APPROVED","REJECTED","SENT","FAILED"], description: "Filter by status" },
          limit: { type: "number", default: 10, description: "Max results (1-50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_job",
      description: "Get details of a single job by ID",
      parameters: {
        type: "object",
        required: ["jobId"],
        properties: { jobId: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_templates",
      description: "List all templates in the organization",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "get_analytics",
      description: "Get job processing analytics",
      parameters: {
        type: "object",
        properties: { days: { type: "number", default: 30, description: "Number of days to look back" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "approve_job",
      description: "Approve a parsed job",
      parameters: {
        type: "object",
        required: ["jobId"],
        properties: { jobId: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reject_job",
      description: "Reject a job",
      parameters: {
        type: "object",
        required: ["jobId"],
        properties: {
          jobId: { type: "string" },
          reason: { type: "string", description: "Rejection reason" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_approve",
      description: "Bulk approve multiple jobs",
      parameters: {
        type: "object",
        required: ["jobIds"],
        properties: { jobIds: { type: "array", items: { type: "string" } } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_template",
      description: "Create a new document parsing template",
      parameters: {
        type: "object",
        required: ["name", "prompt", "outputSchema"],
        properties: {
          name: { type: "string" },
          description: { type: "string" },
          prompt: { type: "string" },
          outputSchema: { type: "object", description: "Key-value pairs of field name to type string" },
        },
      },
    },
  },
];

async function executeTool(name: string, args: any, orgId: string, cookie: string, baseUrl: string) {
  const apiFetch = (path: string, init?: RequestInit) =>
    fetch(`${baseUrl}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Cookie: cookie, ...(init?.headers as any) },
    });

  switch (name) {
    case "list_jobs": {
      const params = new URLSearchParams({ limit: String(args.limit ?? 10) });
      if (args.status) params.set("status", args.status);
      const res = await apiFetch(`/api/jobs?${params}`);
      const data = await res.json() as any;
      const jobs = (data.jobs ?? data) as any[];
      return { count: jobs.length, jobs: jobs.map((j: any) => ({ id: j.id, fileName: j.fileName, status: j.status, template: j.template?.name, createdAt: j.createdAt })) };
    }
    case "get_job": {
      const res = await apiFetch(`/api/jobs/${args.jobId}`);
      const j = await res.json() as any;
      return { id: j.id, fileName: j.fileName, status: j.status, template: j.template?.name, parsedData: j.parsedData, confidence: j.confidence, errorMessage: j.errorMessage };
    }
    case "list_templates": {
      const res = await apiFetch("/api/templates");
      const templates = await res.json() as any[];
      return { count: templates.length, templates: templates.map((t: any) => ({ id: t.id, name: t.name, description: t.description })) };
    }
    case "get_analytics": {
      const res = await apiFetch(`/api/analytics?days=${args.days ?? 30}`);
      return res.json();
    }
    case "approve_job": {
      const res = await apiFetch(`/api/jobs/${args.jobId}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) });
      const data = await res.json() as any;
      return res.ok ? { success: true, status: data.status } : { success: false, error: data.error };
    }
    case "reject_job": {
      const res = await apiFetch(`/api/jobs/${args.jobId}`, { method: "PATCH", body: JSON.stringify({ action: "reject", reviewNote: args.reason }) });
      const data = await res.json() as any;
      return res.ok ? { success: true } : { success: false, error: data.error };
    }
    case "bulk_approve": {
      const res = await apiFetch("/api/jobs/batch", { method: "POST", body: JSON.stringify({ action: "approve", jobIds: args.jobIds }) });
      const data = await res.json() as any;
      return res.ok ? { success: true, count: data.results?.length } : { success: false, error: data.error };
    }
    case "create_template": {
      const res = await apiFetch("/api/templates", { method: "POST", body: JSON.stringify(args) });
      const data = await res.json() as any;
      return res.ok ? { success: true, id: data.id, name: data.name } : { success: false, error: data.error };
    }
    default:
      return { error: "Unknown tool" };
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const member = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!member) return NextResponse.json({ error: "No org" }, { status: 403 });

  const aiConfig = await prisma.aiConfig.findUnique({ where: { orgId: member.orgId } });
  const apiKey = aiConfig?.apiKey;
  if (!apiKey) return NextResponse.json({ error: "请先在设置页面配置 AI Provider（API Key）" }, { status: 400 });

  const baseURL = (aiConfig?.baseUrl || "https://api.anthropic.com").replace(/\/$/, "");
  const model = aiConfig?.model || "claude-sonnet-4-6";
  const isNativeAnthropic = baseURL.includes("api.anthropic.com");
  const cookie = req.headers.get("cookie") || "";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:8001";

  const { messages } = await req.json();

  const systemPrompt = `You are DataBridge Assistant, an AI helper embedded in the DataBridge document processing platform.
DataBridge helps users extract structured data from documents (PDFs, emails, Excel, Word files) using AI-powered templates.

You have access to tools to help users manage their document workflows. Use them proactively when users ask about jobs, templates, or analytics.
Be concise and action-oriented. Respond in the same language the user uses.`;

  // Agentic loop: call API, execute tools, repeat until no more tool calls
  const loopMessages = [...messages];
  let finalText = "";

  for (let step = 0; step < 5; step++) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    let body: any;
    let endpoint: string;

    if (isNativeAnthropic) {
      endpoint = `${baseURL}/v1/messages`;
      headers["x-api-key"] = apiKey;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model,
        max_tokens: 2048,
        system: systemPrompt,
        messages: loopMessages,
        tools: TOOLS.map(t => ({ name: t.function.name, description: t.function.description, input_schema: t.function.parameters })),
      };
    } else {
      endpoint = `${baseURL}/chat/completions`;
      headers["Authorization"] = `Bearer ${apiKey}`;
      body = {
        model,
        max_tokens: 2048,
        messages: [{ role: "system", content: systemPrompt }, ...loopMessages],
        tools: TOOLS,
        tool_choice: "auto",
      };
    }

    const res = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.text();
      console.error("[chat] API error:", res.status, err);
      return NextResponse.json({ error: `API error: ${res.status}` }, { status: 500 });
    }

    const json = await res.json();

    // Extract tool calls and text — handle both Anthropic and OpenAI formats
    let toolCalls: { id: string; name: string; args: any }[] = [];
    let assistantText = "";

    if (isNativeAnthropic) {
      // Anthropic format
      for (const block of json.content ?? []) {
        if (block.type === "text") assistantText += block.text;
        if (block.type === "tool_use") toolCalls.push({ id: block.id, name: block.name, args: block.input });
      }
      loopMessages.push({ role: "assistant", content: json.content });
    } else {
      // OpenAI format
      const msg = json.choices?.[0]?.message;
      assistantText = msg?.content || "";
      for (const tc of msg?.tool_calls ?? []) {
        try { toolCalls.push({ id: tc.id, name: tc.function.name, args: JSON.parse(tc.function.arguments) }); } catch {}
      }
      loopMessages.push(msg);
    }

    if (toolCalls.length === 0) {
      finalText = assistantText;
      break;
    }

    // Execute tools and add results
    console.log("[chat] executing tools:", toolCalls.map(t => t.name));
    if (isNativeAnthropic) {
      const toolResults = await Promise.all(toolCalls.map(async tc => ({
        type: "tool_result",
        tool_use_id: tc.id,
        content: JSON.stringify(await executeTool(tc.name, tc.args, member.orgId, cookie, appBaseUrl)),
      })));
      loopMessages.push({ role: "user", content: toolResults });
    } else {
      for (const tc of toolCalls) {
        const result = await executeTool(tc.name, tc.args, member.orgId, cookie, appBaseUrl);
        loopMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
      }
    }
  }

  return NextResponse.json({ role: "assistant", content: finalText });
}
