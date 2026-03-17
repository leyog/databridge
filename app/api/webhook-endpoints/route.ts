import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOrgId(userId: string) {
  const m = await prisma.orgMember.findFirst({ where: { userId } });
  return m?.orgId ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { orgId, active: true },
    include: { _count: { select: { templates: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(endpoints);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { name, url, headers, format } = await req.json();
  if (!name || !url) return NextResponse.json({ error: "name and url required" }, { status: 400 });

  const endpoint = await prisma.webhookEndpoint.create({
    data: { orgId, name, url, headers: headers ?? null, format: format ?? "raw" },
  });
  return NextResponse.json(endpoint, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { id, name, url, headers, format, active } = await req.json();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const ep = await prisma.webhookEndpoint.findFirst({ where: { id, orgId } });
  if (!ep) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.webhookEndpoint.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(url !== undefined && { url }),
      ...(headers !== undefined && { headers }),
      ...(format !== undefined && { format }),
      ...(active !== undefined && { active }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.webhookEndpoint.deleteMany({ where: { id, orgId } });
  return NextResponse.json({ ok: true });
}
