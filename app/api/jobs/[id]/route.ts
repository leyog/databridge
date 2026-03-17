import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";

async function getOrgAndUser(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    if (membership) return { orgId: membership.orgId, userId: session.user.id };
  }
  const apiAuth = await verifyApiKey(req);
  if (apiAuth.ok) return { orgId: apiAuth.orgId, userId: null };
  return null;
}

async function sendWebhook(job: any, data: any) {
  const endpoint = job.template?.webhookEndpoint;
  const url = endpoint?.url || job.template?.webhookUrl;
  const customHeaders = endpoint?.headers || job.template?.webhookHeaders || {};
  const format = endpoint?.format || job.template?.webhookFormat || "raw";

  if (!url) return { status: "SKIPPED" as const, response: null };
  try {
    const reqHeaders: Record<string, string> = { "Content-Type": "application/json", ...customHeaders };
    const payload = format === "zapier"
      ? { id: job.id, fileName: job.fileName, templateName: job.template?.name, status: "APPROVED", data, approvedAt: new Date().toISOString() }
      : data;

    const res = await fetch(url, { method: "POST", headers: reqHeaders, body: JSON.stringify(payload) });
    return { status: res.ok ? "SUCCESS" as const : "FAILED" as const, response: { status: res.status, body: await res.text().catch(() => "") } };
  } catch (e: any) {
    return { status: "FAILED" as const, response: { error: e.message } };
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgAndUser(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({
    where: { id, orgId: ctx.orgId },
    include: {
      template: { include: { webhookEndpoint: true } },
      createdBy: { select: { name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(job);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getOrgAndUser(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const job = await prisma.job.findFirst({ where: { id, orgId: ctx.orgId }, include: { template: true } });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { action, reviewedData, reviewNote } = body;

  if (action === "approve") {
    const finalData = reviewedData ?? job.parsedData;

    // No webhook configured → just approve, don't attempt send
    if (!job.template?.webhookUrl) {
      const updated = await prisma.job.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedData: finalData ?? undefined,
          reviewedById: ctx.userId ?? undefined,
          reviewedAt: new Date(),
          reviewNote,
          webhookStatus: "SKIPPED",
        },
        include: { template: true },
      });
      return NextResponse.json(updated);
    }

    // Has webhook → attempt send
    const { status: webhookStatus, response: webhookResponse } = await sendWebhook(job, finalData);
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: webhookStatus === "SUCCESS" ? "SENT" : "APPROVED",
        reviewedData: finalData ?? undefined,
        reviewedById: ctx.userId ?? undefined,
        reviewedAt: new Date(),
        reviewNote,
        webhookStatus,
        webhookResponse: webhookResponse ?? undefined,
        webhookSentAt: new Date(),
      },
      include: { template: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "reject") {
    const updated = await prisma.job.update({
      where: { id },
      data: { status: "REJECTED", reviewedById: ctx.userId ?? undefined, reviewedAt: new Date(), reviewNote },
      include: { template: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "save") {
    const updated = await prisma.job.update({
      where: { id },
      data: { reviewedData, status: "REVIEWING" },
      include: { template: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "send") {
    // Manual trigger: re-attempt webhook for APPROVED jobs
    if (job.status !== "APPROVED") return NextResponse.json({ error: "Job must be APPROVED to send" }, { status: 400 });
    const dataToSend = job.reviewedData ?? job.parsedData;
    const { status: webhookStatus, response: webhookResponse } = await sendWebhook(job, dataToSend);
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: webhookStatus === "SUCCESS" ? "SENT" : "APPROVED",
        webhookStatus,
        webhookResponse: webhookResponse ?? undefined,
        webhookSentAt: new Date(),
      },
      include: { template: true },
    });
    return NextResponse.json(updated);
  }

  if (action === "reopen") {
    // Reopen APPROVED / REJECTED / SENT back to REVIEWING
    if (!["APPROVED", "REJECTED", "SENT"].includes(job.status)) {
      return NextResponse.json({ error: "Only APPROVED/REJECTED/SENT jobs can be reopened" }, { status: 400 });
    }
    const updated = await prisma.job.update({
      where: { id },
      data: { status: "REVIEWING", reviewNote: reviewNote ?? job.reviewNote },
      include: { template: true },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
