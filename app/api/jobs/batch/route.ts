import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Batch approve/reject multiple jobs at once
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const { action, jobIds, reviewNote } = await req.json();
  if (!action || !Array.isArray(jobIds) || jobIds.length === 0)
    return NextResponse.json({ error: "action and jobIds required" }, { status: 400 });
  if (jobIds.length > 100) return NextResponse.json({ error: "Max 100 jobs per batch" }, { status: 400 });

  const jobs = await prisma.job.findMany({
    where: { id: { in: jobIds }, orgId: membership.orgId, status: { in: ["PARSED", "REVIEWING"] } },
    include: { template: true },
  });

  const results = await Promise.all(jobs.map(async (job) => {
    try {
      if (action === "approve") {
        const finalData = job.reviewedData ?? job.parsedData;
        let webhookStatus: "SUCCESS" | "FAILED" | "SKIPPED" = "SKIPPED";
        let webhookResponse = null;

        if (job.template.webhookUrl) {
          try {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            if (job.template.webhookHeaders) Object.assign(headers, job.template.webhookHeaders);
            const res = await fetch(job.template.webhookUrl, {
              method: "POST", headers, body: JSON.stringify(finalData),
            });
            webhookStatus = res.ok ? "SUCCESS" : "FAILED";
            webhookResponse = { status: res.status, body: await res.text().catch(() => "") };
          } catch (e: any) {
            webhookStatus = "FAILED";
            webhookResponse = { error: e.message };
          }
        }

        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: webhookStatus === "FAILED" ? "APPROVED" : "SENT",
            reviewedData: finalData ?? undefined,
            reviewedById: session.user?.id,
            reviewedAt: new Date(),
            reviewNote,
            webhookStatus,
            webhookResponse: webhookResponse ?? undefined,
            webhookSentAt: new Date(),
          },
        });
        return { id: job.id, ok: true, status: webhookStatus === "FAILED" ? "APPROVED" : "SENT" };
      }

      if (action === "reject") {
        await prisma.job.update({
          where: { id: job.id },
          data: { status: "REJECTED", reviewedById: session.user?.id, reviewedAt: new Date(), reviewNote },
        });
        return { id: job.id, ok: true, status: "REJECTED" };
      }

      return { id: job.id, ok: false, error: "Invalid action" };
    } catch (e: any) {
      return { id: job.id, ok: false, error: e.message };
    }
  }));

  const succeeded = results.filter(r => r.ok).length;
  return NextResponse.json({ total: jobIds.length, succeeded, failed: results.filter(r => !r.ok).length, results });
}
