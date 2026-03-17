import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { audit } from "@/lib/audit";

async function getOrgAndUser(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const m = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!m) return null;
  return { orgId: m.orgId, userId: session.user.id };
}

async function sendWebhook(job: any, data: any) {
  if (!job.template?.webhookUrl) return { status: "SKIPPED" };
  try {
    const res = await fetch(job.template.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(job.template.webhookHeaders ?? {}) },
      body: JSON.stringify({ jobId: job.id, fileName: job.fileName, data }),
    });
    return { status: res.ok ? "SUCCESS" : "FAILED" };
  } catch {
    return { status: "FAILED" };
  }
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgAndUser(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action, jobIds, assignedToId, reviewNote } = await req.json();
  if (!action || !Array.isArray(jobIds) || jobIds.length === 0)
    return NextResponse.json({ error: "action and jobIds required" }, { status: 400 });
  if (jobIds.length > 100)
    return NextResponse.json({ error: "Max 100 jobs per bulk operation" }, { status: 400 });

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, orgId: ctx.orgId },
    include: { template: true },
  });
  if (jobs.length !== jobIds.length)
    return NextResponse.json({ error: "Some jobs not found" }, { status: 404 });

  const results: { id: string; ok: boolean; error?: string }[] = [];

  for (const job of jobs) {
    try {
      if (action === "approve") {
        const { status: webhookStatus } = await sendWebhook(job, job.parsedData);
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: webhookStatus === "SUCCESS" ? "SENT" : "APPROVED",
            reviewedById: ctx.userId,
            reviewedAt: new Date(),
            reviewNote: reviewNote ?? null,
            webhookStatus: webhookStatus as any,
          },
        });
        audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.approve", entityType: "job", entityId: job.id, meta: { bulk: true } });
        results.push({ id: job.id, ok: true });

      } else if (action === "reject") {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "REJECTED", reviewedById: ctx.userId, reviewedAt: new Date(), reviewNote: reviewNote ?? null },
        });
        audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.reject", entityType: "job", entityId: job.id, meta: { bulk: true } });
        results.push({ id: job.id, ok: true });

      } else if (action === "assign") {
        if (!assignedToId) { results.push({ id: job.id, ok: false, error: "assignedToId required" }); continue; }
        await prisma.job.update({
          where: { id: job.id },
          data: { assignedToId, assignedAt: new Date() },
        });
        audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.assign", entityType: "job", entityId: job.id, meta: { assignedToId } });
        results.push({ id: job.id, ok: true });

      } else if (action === "delete") {
        await prisma.job.delete({ where: { id: job.id } });
        audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.delete", entityType: "job", entityId: job.id, meta: { bulk: true } });
        results.push({ id: job.id, ok: true });

      } else {
        results.push({ id: job.id, ok: false, error: `Unknown action: ${action}` });
      }
    } catch (e: any) {
      results.push({ id: job.id, ok: false, error: e.message });
    }
  }

  const succeeded = results.filter(r => r.ok).length;
  return NextResponse.json({ succeeded, failed: results.length - succeeded, results });
}
