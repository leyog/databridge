import { prisma } from "@/lib/prisma";
import { buildPromptRules } from "@/lib/field-rules";
import { notifyNewJob } from "@/lib/notify";

export async function parseJobAsync(jobId: string, fileContent: string, template: any, imageBase64?: string, imageMime?: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { orgId: true } });
  const aiConfig = job ? await prisma.aiConfig.findUnique({ where: { orgId: job.orgId } }) : null;

  const apiKey = aiConfig?.apiKey || process.env.ANTHROPIC_API_KEY;
  const baseUrl = aiConfig?.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

  if (!apiKey) {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "FAILED", errorMessage: "No API key configured. Please go to Settings → AI Config to set up your API key." },
    });
    return;
  }

  const examples = await prisma.job.findMany({
    where: { templateId: template.id, status: { in: ["APPROVED", "SENT"] }, reviewedData: { not: undefined } },
    orderBy: { reviewedAt: "desc" },
    take: 3,
    select: { reviewedData: true },
  });

  const fewShotBlock = examples.length > 0
    ? `\n\nHere are ${examples.length} verified extraction example(s) for this template:\n` +
      examples.map((ex, i) => `Example ${i + 1} output:\n${JSON.stringify(ex.reviewedData, null, 2)}`).join("\n\n")
    : "";

  const fieldRulesBlock = template.fieldRules ? buildPromptRules(template.fieldRules) : "";

  const systemPrompt = `You are a data extraction assistant. Extract structured data from the provided content.
Always respond with a JSON object with two keys:
1. "data": the extracted fields matching the output schema (use null for missing fields)
2. "field_confidence": an object mapping each field name to a confidence score 0.0-1.0

Output schema: ${JSON.stringify(template.outputSchema, null, 2)}${fieldRulesBlock}${fewShotBlock}`;

  const isImage = !!imageBase64;

  // Build user message content — vision or text
  let userContent: any;
  if (isImage) {
    userContent = [
      {
        type: "image",
        source: { type: "base64", media_type: imageMime || "image/jpeg", data: imageBase64 },
      },
      {
        type: "text",
        text: `${template.prompt}\n\nPlease extract the structured data from this image.`,
      },
    ];
  } else {
    userContent = `${template.prompt}\n\nContent to parse:\n${fileContent}`;
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiConfig?.model || "claude-sonnet-4-6",
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    const aiResp = await res.json();
    const text = aiResp.content?.[0]?.text ?? "{}";

    let jsonStr = "{}";
    const fenced = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (fenced) {
      jsonStr = fenced[1];
    } else {
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start !== -1 && end > start) jsonStr = text.slice(start, end + 1);
    }

    let parsed: any = {};
    try { parsed = JSON.parse(jsonStr); }
    catch { parsed = { data: {}, field_confidence: {} }; }

    const data = parsed.data ?? parsed;
    const fieldConf: Record<string, number> = parsed.field_confidence ?? {};
    const confValues = Object.values(fieldConf) as number[];
    const confidence = confValues.length > 0
      ? Math.round((confValues.reduce((a, b) => a + b, 0) / confValues.length) * 100) / 100
      : 0.5;

    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "PARSED",
        parsedData: data,
        confidence,
        rawResult: { fieldConfidence: fieldConf, fewShotCount: examples.length, isImage },
      },
    });

    if ((template as any).notifyOnNew) {
      const fullJob = await prisma.job.findUnique({ where: { id: jobId }, select: { orgId: true, fileName: true } });
      if (fullJob) notifyNewJob(fullJob.orgId, jobId, fullJob.fileName, template.name).catch(() => {});
    }
  } catch (e: any) {
    await prisma.job.update({ where: { id: jobId }, data: { status: "FAILED", errorMessage: e.message } });
  }
}
