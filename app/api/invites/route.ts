import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/mail";

async function getOrgAndRole(userId: string) {
  const m = await prisma.orgMember.findFirst({
    where: { userId },
    include: { org: true, user: true },
  });
  return m ?? null;
}

// GET /api/invites — list pending invites for org
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgAndRole(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.orgInvite.findMany({
    where: { orgId: membership.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invites);
}

// POST /api/invites — create invite
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgAndRole(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, role } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Check if already a member
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const alreadyMember = await prisma.orgMember.findFirst({
      where: { userId: existingUser.id, orgId: membership.orgId },
    });
    if (alreadyMember) return NextResponse.json({ error: "User is already a member" }, { status: 409 });
  }

  // Upsert invite (reset expiry if re-inviting)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const invite = await prisma.orgInvite.upsert({
    where: { orgId_email: { orgId: membership.orgId, email } },
    create: {
      orgId: membership.orgId,
      email,
      role: role ?? "MEMBER",
      invitedBy: session.user.id,
      expiresAt,
    },
    update: {
      role: role ?? "MEMBER",
      invitedBy: session.user.id,
      expiresAt,
      acceptedAt: null,
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8001";
  const inviteUrl = `${appUrl}/invite/${invite.token}`;

  // Send email (best-effort)
  await sendInviteEmail({
    to: email,
    orgName: membership.org.name,
    inviterName: membership.user.name ?? membership.user.email ?? "A teammate",
    inviteUrl,
  });

  return NextResponse.json({ invite, inviteUrl }, { status: 201 });
}

// DELETE /api/invites?id=xxx — revoke invite
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await getOrgAndRole(session.user.id);
  if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.orgInvite.deleteMany({ where: { id, orgId: membership.orgId } });
  return NextResponse.json({ ok: true });
}
