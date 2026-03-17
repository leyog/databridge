import { prisma } from "@/lib/prisma";

export async function classifyDocument(
  fileContent: string,
  orgId: string
): Promise<string | null> {
  const templates = await prisma.template.findMany({
    where: { orgId, active: true },
    select: { id: true, name: true, description: true },
  });

  if (templates.length === 0) return null;
  if (templates.length === 1) return templates[0].id;

  // Org-level AI config overrides env vars
  const aiConfig = await prisma.aiConfig.findUnique({ where: { orgId } });
  const apiKey = aiConfig?.apiKey || process.env.ANTHROPIC_API_KEY;
  const baseUrl = aiConfig?.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

  if (!apiKey) return null; // no key, skip auto-classify silently

  const templateList = templates
    .map((t, i) => `${i + 1}. "${t.name}"${t.description ? ` — ${t.description}` : ""}`)
    .join("\n");

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251014",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: `You are a document classifier. Given the document content below, choose the most appropriate template.

Templates:
${templateList}

Document content (first 500 chars):
${fileContent.slice(0, 500)}

Reply with ONLY the template number (e.g. "2"). If none match, reply "0".`,
      }],
    }),
  });

  const data = await res.json();
  const text = (data.content?.[0]?.text ?? "0").trim();
  const idx = parseInt(text) - 1;
  return templates[idx]?.id ?? null;
}
