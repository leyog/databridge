import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createOrgForUser } from "@/auth";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { name: name || email.split("@")[0], email, password: hashed },
  });

  await createOrgForUser(user.id, user.name ?? user.email!);

  return NextResponse.json({ ok: true, email: user.email }, { status: 201 });
}
