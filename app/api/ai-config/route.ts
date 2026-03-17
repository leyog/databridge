import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { verifyApiKey } from "@/lib/api-auth";

async function getOrgId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    const m = await prisma.orgMember.findFirst({
      where: { userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
      select: { orgId: true },
    });
    return m?.orgId ?? null;
  }
  const apiAuth = await verifyApiKey(req);
  if (apiAuth.ok) return apiAuth.orgId;
  return null;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const config = await prisma.aiConfig.findUnique({ where: { orgId } });
  if (!config) return NextResponse.json(null);

  return NextResponse.json({
    provider: config.provider,
    apiKeyMasked: config.apiKey ? `${config.apiKey.slice(0, 8)}••••••••` : null,
    baseUrl: config.baseUrl,
    model: config.model,
  });
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider, apiKey, baseUrl, model } = await req.json();
  if (!apiKey?.trim()) return NextResponse.json({ error: "API key required" }, { status: 400 });

  const config = await prisma.aiConfig.upsert({
    where: { orgId },
    create: { orgId, provider: provider ?? "anthropic", apiKey: apiKey.trim(), baseUrl: baseUrl?.trim() || null, model: model?.trim() || null },
    update: { provider: provider ?? "anthropic", apiKey: apiKey.trim(), baseUrl: baseUrl?.trim() || null, model: model?.trim() || null },
  });

  return NextResponse.json({ ok: true, provider: config.provider });
}

export async function DELETE(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.aiConfig.deleteMany({ where: { orgId } });
  return NextResponse.json({ ok: true });
}
