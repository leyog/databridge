import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";

async function getOrgId(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const m = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    return m?.orgId ?? null;
  }
  const a = await verifyApiKey(req);
  return a.ok ? a.orgId : null;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(parseInt(searchParams.get("days") ?? "30"), 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [total, byStatus, byTemplate, recentTrend, slaStats, avgConfidence] = await Promise.all([
    // Total jobs
    prisma.job.count({ where: { orgId } }),

    // By status
    prisma.job.groupBy({
      by: ["status"],
      where: { orgId },
      _count: { id: true },
    }),

    // By template (top 10)
    prisma.job.groupBy({
      by: ["templateId"],
      where: { orgId, createdAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    }),

    // Daily trend (last N days)
    prisma.$queryRaw<{ date: string; count: bigint }[]>`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM "Job"
      WHERE "orgId" = ${orgId} AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `,

    // SLA stats
    prisma.job.aggregate({
      where: { orgId, slaDeadline: { not: null } },
      _count: { id: true },
    }).then(async (total) => {
      const breached = await prisma.job.count({ where: { orgId, slaBreached: true } });
      return { total: total._count.id, breached };
    }),

    // Avg confidence
    prisma.job.aggregate({
      where: { orgId, confidence: { not: null }, status: { in: ["PARSED", "REVIEWING", "APPROVED", "SENT"] } },
      _avg: { confidence: true },
    }),
  ]);

  // Enrich template names
  const templateIds = byTemplate.map(t => t.templateId);
  const templates = await prisma.template.findMany({
    where: { id: { in: templateIds } },
    select: { id: true, name: true },
  });
  const templateMap = Object.fromEntries(templates.map(t => [t.id, t.name]));

  return NextResponse.json({
    total,
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count.id])),
    byTemplate: byTemplate.map(t => ({
      templateId: t.templateId,
      name: templateMap[t.templateId] ?? "Unknown",
      count: t._count.id,
    })),
    trend: recentTrend.map(r => ({ date: r.date, count: Number(r.count) })),
    sla: slaStats,
    avgConfidence: avgConfidence._avg.confidence,
  });
}
