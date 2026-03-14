import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const templates = await prisma.template.findMany({
    where: { orgId: membership.orgId, active: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const { name, description, prompt, outputSchema, webhookUrl, webhookHeaders } = body;

  if (!name || !prompt || !outputSchema)
    return NextResponse.json({ error: "name, prompt, outputSchema required" }, { status: 400 });

  const template = await prisma.template.create({
    data: {
      orgId: membership.orgId,
      name, description, prompt,
      outputSchema: typeof outputSchema === "string" ? JSON.parse(outputSchema) : outputSchema,
      webhookUrl: webhookUrl || null,
      webhookHeaders: webhookHeaders ? (typeof webhookHeaders === "string" ? JSON.parse(webhookHeaders) : webhookHeaders) : null,
    },
  });
  return NextResponse.json(template, { status: 201 });
}
