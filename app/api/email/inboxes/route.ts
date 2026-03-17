import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const inboxes = await prisma.emailInbox.findMany({
    where: { orgId: membership.orgId, active: true },
    include: { template: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(inboxes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (!["OWNER", "ADMIN"].includes(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { templateId, address } = await req.json();
  if (!templateId || !address) return NextResponse.json({ error: "templateId and address required" }, { status: 400 });

  const template = await prisma.template.findFirst({ where: { id: templateId, orgId: membership.orgId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const existing = await prisma.emailInbox.findUnique({ where: { address } });
  if (existing) return NextResponse.json({ error: "Address already in use" }, { status: 409 });

  const inbox = await prisma.emailInbox.create({
    data: { orgId: membership.orgId, templateId, address: address.toLowerCase() },
    include: { template: { select: { id: true, name: true } } },
  });
  return NextResponse.json(inbox, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { id } = await req.json();
  await prisma.emailInbox.updateMany({ where: { id, orgId: membership.orgId }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
