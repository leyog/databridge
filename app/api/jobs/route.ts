import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// AI 解析文件内容
async function parseWithAI(fileContent: string, prompt: string, outputSchema: object): Promise<{ data: any; confidence: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

  const systemPrompt = `You are a data extraction assistant. Extract structured data from the provided content according to the instructions and output schema.
Always respond with valid JSON matching the schema. If a field cannot be extracted, use null.
Output schema: ${JSON.stringify(outputSchema, null, 2)}`;

  const userPrompt = `${prompt}\n\nContent to parse:\n${fileContent}`;

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "x-api-key": apiKey!, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      temperature: 0.1,
      max_tokens: 2000,
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";

  // Extract JSON from response
  const match = text.match(/```json\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] : text;

  try {
    const parsed = JSON.parse(jsonStr);
    return { data: parsed, confidence: 0.9 };
  } catch {
    return { data: {}, confidence: 0.1 };
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const jobs = await prisma.job.findMany({
    where: { orgId: membership.orgId },
    include: { template: { select: { id: true, name: true } }, createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const { templateId, fileName, fileContent, fileType, fileSize } = body;

  if (!templateId || !fileName || !fileContent)
    return NextResponse.json({ error: "templateId, fileName, fileContent required" }, { status: 400 });

  const template = await prisma.template.findFirst({
    where: { id: templateId, orgId: membership.orgId },
  });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  // Create job
  const job = await prisma.job.create({
    data: {
      orgId: membership.orgId,
      templateId,
      createdById: session.user.id,
      status: "PROCESSING",
      fileName,
      fileUrl: "",
      fileType: fileType || "text/plain",
      fileSize: fileSize || fileContent.length,
    },
  });

  // Parse async
  try {
    const { data, confidence } = await parseWithAI(fileContent, template.prompt, template.outputSchema as object);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "PARSED", parsedData: data, confidence },
    });
    return NextResponse.json({ ...job, status: "PARSED", parsedData: data }, { status: 201 });
  } catch (e: any) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: "FAILED", errorMessage: e.message },
    });
    return NextResponse.json({ error: "Parsing failed", jobId: job.id }, { status: 500 });
  }
}
