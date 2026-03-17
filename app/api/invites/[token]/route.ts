import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

// GET /api/invites/[token] — get invite info (public, for accept page)
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.orgInvite.findUnique({
    where: { token },
    include: { org: { select: { name: true } } },
  });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Invite already accepted" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 410 });

  return NextResponse.json({
    email: invite.email,
    orgName: invite.org.name,
    role: invite.role,
    expiresAt: invite.expiresAt,
  });
}

// POST /api/invites/[token] — accept invite (must be logged in)
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { token } = await params;
  const invite = await prisma.orgInvite.findUnique({ where: { token } });

  if (!invite) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  if (invite.acceptedAt) return NextResponse.json({ error: "Already accepted" }, { status: 410 });
  if (invite.expiresAt < new Date()) return NextResponse.json({ error: "Invite expired" }, { status: 410 });

  // Email must match (or allow any if invite email matches session email)
  if (invite.email.toLowerCase() !== session.user.email?.toLowerCase()) {
    return NextResponse.json({ error: "This invite is for a different email address" }, { status: 403 });
  }

  // Add to org (upsert in case they somehow already exist)
  await prisma.orgMember.upsert({
    where: { userId_orgId: { userId: session.user.id, orgId: invite.orgId } },
    create: { userId: session.user.id, orgId: invite.orgId, role: invite.role },
    update: { role: invite.role },
  });

  // Mark invite as accepted
  await prisma.orgInvite.update({
    where: { token },
    data: { acceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true, orgId: invite.orgId });
}
