import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function getOrgAndRole(userId: string) {
  return prisma.orgMember.findFirst({ where: { userId }, select: { orgId: true, role: true } });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const m = await getOrgAndRole(session.user.id);
  if (!m || !["OWNER", "ADMIN"].includes(m.role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const userId = searchParams.get("userId");

  const logs = await prisma.auditLog.findMany({
    where: {
      orgId: m.orgId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(userId ? { userId } : {}),
    },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}
