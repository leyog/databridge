import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { testEmailConnection, syncEmailAccount } from "@/lib/imap-sync";

async function getOrgId(userId: string) {
  const m = await prisma.orgMember.findFirst({ where: { userId } });
  return m?.orgId ?? null;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const accounts = await prisma.emailAccount.findMany({
    where: { orgId },
    include: { template: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  // Mask passwords
  return NextResponse.json(accounts.map(a => ({ ...a, password: "••••••••" })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const { action } = body;

  // Test connection
  if (action === "test") {
    const result = await testEmailConnection({
      imapHost: body.imapHost, imapPort: body.imapPort ?? 993,
      imapSecure: body.imapSecure ?? true,
      username: body.username, password: body.password,
    });
    return NextResponse.json(result);
  }

  // Create account
  const { name, email, imapHost, imapPort, imapSecure, username, password, templateId } = body;
  if (!name || !email || !imapHost || !username || !password) {
    return NextResponse.json({ error: "name, email, imapHost, username, password required" }, { status: 400 });
  }

  const account = await prisma.emailAccount.create({
    data: {
      orgId, name, email,
      imapHost, imapPort: imapPort ?? 993, imapSecure: imapSecure ?? true,
      username, password,
      templateId: templateId || null,
    },
    include: { template: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ ...account, password: "••••••••" }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const { id, action, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const account = await prisma.emailAccount.findFirst({ where: { id, orgId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Manual sync trigger
  if (action === "sync") {
    const result = await syncEmailAccount(id);
    return NextResponse.json(result);
  }

  // Update fields (don't overwrite password if not provided)
  const data: any = {};
  if (updates.name) data.name = updates.name;
  if (updates.templateId !== undefined) data.templateId = updates.templateId || null;
  if (updates.active !== undefined) data.active = updates.active;
  if (updates.password && updates.password !== "��•••••••") data.password = updates.password;

  const updated = await prisma.emailAccount.update({
    where: { id },
    data,
    include: { template: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ ...updated, password: "••••••••" });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId = await getOrgId(session.user.id);
  if (!orgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.emailAccount.deleteMany({ where: { id, orgId } });
  return NextResponse.json({ ok: true });
}
