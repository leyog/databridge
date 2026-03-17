import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";
import { parseJobAsync } from "@/lib/parse-job";
import { audit } from "@/lib/audit";

async function getOrgAndUser(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) {
    const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    if (membership) return { orgId: membership.orgId, userId: session.user.id };
  }
  const apiAuth = await verifyApiKey(req);
  if (apiAuth.ok) {
    const owner = await prisma.orgMember.findFirst({
      where: { orgId: apiAuth.orgId, role: "OWNER" },
      select: { userId: true },
    });
    return { orgId: apiAuth.orgId, userId: owner?.userId ?? null };
  }
  return null;
}

function calcSlaDeadline(slaDays: number | null | undefined): Date | null {
  if (!slaDays) return null;
  const d = new Date();
  d.setDate(d.getDate() + slaDays);
  return d;
}

export async function GET(req: NextRequest) {
  const ctx = await getOrgAndUser(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const templateId = searchParams.get("templateId");
  const assignedToId = searchParams.get("assignedTo");
  const slaBreached = searchParams.get("slaBreached");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const page = Math.max(parseInt(searchParams.get("page") ?? "1"), 1);
  const skip = (page - 1) * limit;

  const where = {
    orgId: ctx.orgId,
    ...(status ? { status: status as any } : {}),
    ...(templateId ? { templateId } : {}),
    ...(assignedToId ? { assignedToId } : {}),
    ...(slaBreached === "true" ? { slaBreached: true } : {}),
    ...(search ? { fileName: { contains: search, mode: "insensitive" as const } } : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.job.findMany({
      where,
      include: {
        template: { select: { id: true, name: true } },
        createdBy: { select: { name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip,
    }),
    prisma.job.count({ where }),
  ]);

  return NextResponse.json({
    jobs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}

export async function POST(req: NextRequest) {
  const ctx = await getOrgAndUser(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.jobs && Array.isArray(body.jobs)) {
    const { templateId, jobs } = body;
    if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });
    if (jobs.length > 50) return NextResponse.json({ error: "Max 50 jobs per batch" }, { status: 400 });

    const template = await prisma.template.findFirst({ where: { id: templateId, orgId: ctx.orgId } });
    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const created = await Promise.all(jobs.map(async (j: any) => {
      const job = await prisma.job.create({
        data: {
          orgId: ctx.orgId, templateId,
          createdById: ctx.userId ?? "system",
          status: "PROCESSING",
          fileName: j.fileName, fileUrl: j.fileUrl ?? "",
          fileType: j.fileType ?? "text/plain",
          fileSize: j.fileSize ?? j.fileContent?.length ?? 0,
          extractedText: j.imageBase64 ? "[IMAGE_FILE]" : (j.fileContent ?? null),
          slaDeadline: calcSlaDeadline((template as any).slaDays),
        },
      });
      parseJobAsync(job.id, j.fileContent, template, j.imageBase64 ?? undefined, j.imageMime ?? undefined).catch(() => {});
      audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.create", entityType: "job", entityId: job.id });
      return { id: job.id, fileName: job.fileName, status: "PROCESSING" };
    }));

    return NextResponse.json({ jobs: created }, { status: 201 });
  }

  const { templateId, fileName, fileContent, fileType, fileSize, fileUrl, imageBase64, imageMime } = body;
  if (!templateId || !fileName || !fileContent)
    return NextResponse.json({ error: "templateId, fileName, fileContent required" }, { status: 400 });

  const template = await prisma.template.findFirst({ where: { id: templateId, orgId: ctx.orgId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  const isImage = !!imageBase64;
  const job = await prisma.job.create({
    data: {
      orgId: ctx.orgId, templateId,
      createdById: ctx.userId ?? "system",
      status: "PROCESSING",
      fileName, fileUrl: fileUrl ?? "",
      fileType: fileType ?? "text/plain",
      fileSize: fileSize ?? fileContent.length,
      // Don't store raw base64 in DB — store placeholder for images
      extractedText: isImage ? "[IMAGE_FILE]" : (fileContent ?? null),
      slaDeadline: calcSlaDeadline((template as any).slaDays),
    },
  });

  parseJobAsync(job.id, fileContent, template, imageBase64 ?? undefined, imageMime ?? undefined).catch(() => {});
  audit({ orgId: ctx.orgId, userId: ctx.userId, action: "job.create", entityType: "job", entityId: job.id });
  return NextResponse.json({ ...job, status: "PROCESSING" }, { status: 201 });
}
