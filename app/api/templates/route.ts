import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";

async function getOrgId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    const m = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    return m?.orgId ?? null;
  }
  const apiAuth = await verifyApiKey(req);
  if (apiAuth.ok) return apiAuth.orgId;
  return null;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.template.findMany({
    where: { orgId, active: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, description, prompt, outputSchema, webhookUrl, webhookHeaders, webhookFormat } = body;

  if (!name || !prompt || !outputSchema)
    return NextResponse.json({ error: "name, prompt, outputSchema required" }, { status: 400 });

  const template = await prisma.template.create({
    data: {
      orgId,
      name, description, prompt,
      outputSchema: typeof outputSchema === "string" ? JSON.parse(outputSchema) : outputSchema,
      webhookUrl: webhookUrl || null,
      webhookHeaders: webhookHeaders ? (typeof webhookHeaders === "string" ? JSON.parse(webhookHeaders) : webhookHeaders) : null,
      webhookFormat: webhookFormat ?? "raw",
    },
  });
  return NextResponse.json(template, { status: 201 });
}
