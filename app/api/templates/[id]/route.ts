import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const template = await prisma.template.findFirst({ where: { id, orgId: membership.orgId } });
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const existing = await prisma.template.findFirst({ where: { id, orgId: membership.orgId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { name, description, prompt, outputSchema, webhookUrl, webhookHeaders, webhookFormat, active } = body;

  const updated = await prisma.template.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(prompt !== undefined && { prompt }),
      ...(outputSchema !== undefined && { outputSchema }),
      ...(webhookUrl !== undefined && { webhookUrl: webhookUrl || null }),
      ...(webhookHeaders !== undefined && { webhookHeaders: webhookHeaders || null }),
      ...(webhookFormat !== undefined && { webhookFormat }),
      ...(active !== undefined && { active }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  await prisma.template.updateMany({ where: { id, orgId: membership.orgId }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
