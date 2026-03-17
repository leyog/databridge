import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";

async function getOrgId(req: NextRequest): Promise<string | null> {
  const session = await auth();
  if (session?.user?.id) {
    const m = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    return m?.orgId ?? null;
  }
  const apiAuth = await verifyApiKey(req);
  if (apiAuth.ok) return apiAuth.orgId;
  return null;
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req);
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json"; // json | csv | xlsx
  const templateId = searchParams.get("templateId");
  const status = searchParams.get("status");
  const jobIds = searchParams.get("ids")?.split(",").filter(Boolean);

  const jobs = await prisma.job.findMany({
    where: {
      orgId,
      ...(templateId ? { templateId } : {}),
      ...(status ? { status: status as any } : {}),
      ...(jobIds?.length ? { id: { in: jobIds } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    select: {
      id: true,
      fileName: true,
      status: true,
      confidence: true,
      parsedData: true,
      reviewedData: true,
      reviewNote: true,
      createdAt: true,
      reviewedAt: true,
      template: { select: { name: true } },
    },
  });

  const rows = jobs.map(j => ({
    id: j.id,
    fileName: j.fileName,
    template: j.template.name,
    status: j.status,
    confidence: j.confidence,
    reviewNote: j.reviewNote,
    createdAt: j.createdAt.toISOString(),
    reviewedAt: j.reviewedAt?.toISOString() ?? null,
    ...(((j.reviewedData ?? j.parsedData) as Record<string, any>) ?? {}),
  }));

  if (format === "json") {
    return NextResponse.json(rows, {
      headers: { "Content-Disposition": `attachment; filename="databridge-export.json"` },
    });
  }

  if (format === "csv") {
    if (rows.length === 0) return new NextResponse("", { headers: { "Content-Type": "text/csv" } });
    const headers = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    const escape = (v: any) => {
      if (v == null) return "";
      const s = String(typeof v === "object" ? JSON.stringify(v) : v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
      headers.join(","),
      ...rows.map(r => headers.map(h => escape((r as any)[h])).join(",")),
    ].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="databridge-export.csv"`,
      },
    });
  }

  if (format === "xlsx") {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Jobs");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="databridge-export.xlsx"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format. Use json, csv, or xlsx" }, { status: 400 });
}
