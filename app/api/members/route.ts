import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOrgAndRole(userId: string) {
  return prisma.orgMember.findFirst({
    where: { userId },
    select: { orgId: true, role: true },
  });
}

// GET /api/members — list org members
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOrgAndRole(session.user.id);
  if (!m) return NextResponse.json({ error: "No org" }, { status: 403 });

  const members = await prisma.orgMember.findMany({
    where: { orgId: m.orgId },
    include: { user: { select: { id: true, name: true, email: true, image: true, createdAt: true } } },
    orderBy: { user: { createdAt: "asc" } },
  });

  return NextResponse.json(members);
}

// PATCH /api/members — change role
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOrgAndRole(session.user.id);
  if (!m || !["OWNER", "ADMIN"].includes(m.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { userId, role } = await req.json();
  if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });
  if (!["ADMIN", "MEMBER"].includes(role)) return NextResponse.json({ error: "Invalid role" }, { status: 400 });

  // Can't change owner's role
  const target = await prisma.orgMember.findFirst({ where: { userId, orgId: m.orgId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "OWNER") return NextResponse.json({ error: "Cannot change owner role" }, { status: 403 });

  const updated = await prisma.orgMember.update({
    where: { userId_orgId: { userId, orgId: m.orgId } },
    data: { role },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/members?userId=xxx — remove member
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOrgAndRole(session.user.id);
  if (!m || !["OWNER", "ADMIN"].includes(m.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (userId === session.user.id) return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });

  const target = await prisma.orgMember.findFirst({ where: { userId, orgId: m.orgId } });
  if (!target) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  if (target.role === "OWNER") return NextResponse.json({ error: "Cannot remove owner" }, { status: 403 });

  await prisma.orgMember.delete({ where: { userId_orgId: { userId, orgId: m.orgId } } });
  return NextResponse.json({ ok: true });
}
