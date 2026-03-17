import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

// Generate a new API key: db_live_<32 random chars>
function generateKey(): string {
  return `db_live_${crypto.randomBytes(24).toString("base64url")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const keys = await prisma.apiKey.findMany({
    where: { orgId: membership.orgId, active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
  });
  return NextResponse.json(keys);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (!["OWNER", "ADMIN"].includes(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, expiresAt } = await req.json();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const rawKey = generateKey();
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 12); // "db_live_XXXX"

  const apiKey = await prisma.apiKey.create({
    data: {
      orgId: membership.orgId,
      name,
      keyHash,
      keyPrefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the raw key ONCE — never stored in plaintext
  return NextResponse.json({ ...apiKey, key: rawKey }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });
  if (!["OWNER", "ADMIN"].includes(membership.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await req.json();
  await prisma.apiKey.updateMany({ where: { id, orgId: membership.orgId }, data: { active: false } });
  return NextResponse.json({ ok: true });
}
