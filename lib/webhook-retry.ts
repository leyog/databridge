import { prisma } from "@/lib/prisma";

export async function retryFailedWebhooks() {
  const jobs = await prisma.job.findMany({
    where: {
      webhookStatus: "FAILED",
      status: { in: ["APPROVED", "SENT"] },
      updatedAt: { lt: new Date(Date.now() - 60_000) }, // at least 1 min old
    },
    include: { template: true },
    take: 20,
  });

  for (const job of jobs) {
    if (!job.template.webhookUrl) continue;
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (job.template.webhookHeaders) Object.assign(headers, job.template.webhookHeaders);

      const format = (job.template as any).webhookFormat ?? "raw";
      const data = job.reviewedData ?? job.parsedData;
      const payload = format === "zapier"
        ? { id: job.id, fileName: job.fileName, templateName: job.template.name, status: "APPROVED", data, approvedAt: job.reviewedAt?.toISOString() }
        : data;

      const res = await fetch(job.template.webhookUrl, {
        method: "POST", headers, body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });

      await prisma.job.update({
        where: { id: job.id },
        data: {
          webhookStatus: res.ok ? "SUCCESS" : "FAILED",
          webhookResponse: { status: res.status, body: await res.text().catch(() => ""), retried: true },
          webhookSentAt: new Date(),
          status: res.ok ? "SENT" : job.status,
        },
      });
    } catch (e: any) {
      await prisma.job.update({
        where: { id: job.id },
        data: { webhookResponse: { error: e.message, retried: true } },
      });
    }
  }

  return jobs.length;
}
