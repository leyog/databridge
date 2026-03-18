import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  const { messages } = await req.json();

  // Build OpenAI-compatible messages
  const systemMsg = {
    role: "system",
    content: `You are DataBridge Assistant, an AI helper embedded in the DataBridge document processing platform.
DataBridge helps users extract structured data from documents (PDFs, emails, Excel, Word files) using AI-powered templates.

You can help users with:
- Understanding how to create and use templates for document parsing
- Explaining job statuses and workflows (PENDING → PROCESSING → PARSED → REVIEWING → APPROVED)
- Troubleshooting upload or parsing issues
- Guiding users through settings (AI Config, API Keys, Email Inboxes, Members)
- Answering questions about the platform features

Keep responses concise and practical. Respond in the same language the user uses.`,
  };

  const body: any = {
    model,
    stream: true,
    messages: [systemMsg, ...messages],
    max_tokens: 2048,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  let endpoint: string;
  if (isNativeAnthropic) {
    endpoint = `${baseURL}/v1/messages`;
    headers["x-api-key"] = apiKey;
    headers["anthropic-version"] = "2023-06-01";
    // Convert to Anthropic format
    const systemContent = messages.find((m: any) => m.role === "system")?.content || systemMsg.content;
    body.system = systemContent;
    body.messages = messages.filter((m: any) => m.role !== "system");
    delete body.messages; // reassign below
    body.messages = messages.filter((m: any) => m.role !== "system");
  } else {
    endpoint = `${baseURL}/chat/completions`;
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  console.log("[chat] endpoint:", endpoint, "model:", model);

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const err = await upstream.text();
    console.error("[chat] upstream error:", upstream.status, err);
    return NextResponse.json({ error: `API error: ${upstream.status}` }, { status: 500 });
  }

  // Stream response back to client as text/event-stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  (async () => {
    const reader = upstream.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE lines and extract text delta
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const json = JSON.parse(data);
            // OpenAI format
            const delta = json.choices?.[0]?.delta?.content;
            // Anthropic format
            const anthropicDelta = json.type === "content_block_delta" ? json.delta?.text : null;
            const text = delta ?? anthropicDelta;
            if (text) {
              // Vercel AI SDK data stream format
              await writer.write(encoder.encode(`0:${JSON.stringify(text)}\n`));
            }
          } catch {}
        }
      }
    } finally {
      await writer.write(encoder.encode(`d:{"finishReason":"stop"}\n`));
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Vercel-AI-Data-Stream": "v1",
    },
  });
}
