import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const job = await prisma.job.findFirst({
    where: { id, orgId: membership.orgId },
    include: { template: true, createdBy: { select: { name: true, email: true } } },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const job = await prisma.job.findFirst({ where: { id, orgId: membership.orgId }, include: { template: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, reviewedData, reviewNote } = body;

  if (action === "approve") {
    // Send to webhook if configured
    let webhookStatus: "SUCCESS" | "FAILED" | "SKIPPED" = "SKIPPED";
    let webhookResponse = null;

    if (job.template.webhookUrl) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (job.template.webhookHeaders) {
          Object.assign(headers, job.template.webhookHeaders);
        }
        const res = await fetch(job.template.webhookUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(reviewedData ?? job.parsedData),
        });
        webhookStatus = res.ok ? "SUCCESS" : "FAILED";
        webhookResponse = { status: res.status, body: await res.text().catch(() => "") };
      } catch (e: any) {
        webhookStatus = "FAILED";
        webhookResponse = { error: e.message };
      }
    }

    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: webhookStatus === "FAILED" ? "APPROVED" : "SENT",
        reviewedData: reviewedData ?? job.parsedData,
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote,
        webhookStatus,
        webhookResponse: webhookResponse ?? undefined,
        webhookSentAt: new Date(),
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: session.user.id,
        reviewedAt: new Date(),
        reviewNote,
      },
    });
    return NextResponse.json(updated);
  }

  if (action === "save") {
    const updated = await prisma.job.update({
      where: { id },
      data: { reviewedData, status: "REVIEWING" },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
