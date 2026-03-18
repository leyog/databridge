import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractText } from "@/lib/file-extract";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_SIZE = 20 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-excel": "xls", "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt", "application/json": "json", "text/html": "html",
  "text/xml": "xml", "application/xml": "xml",
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) return NextResponse.json({ error: "No org" }, { status: 403 });

  const formData = await req.formData();
  const templateId = formData.get("templateId") as string;
  const files = formData.getAll("files") as File[];

  if (!templateId) return NextResponse.json({ error: "templateId required" }, { status: 400 });
  if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });
  if (files.length > 20) return NextResponse.json({ error: "Max 20 files per batch" }, { status: 400 });

  const template = await prisma.template.findFirst({ where: { id: templateId, orgId: membership.orgId } });
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

  await mkdir(UPLOAD_DIR, { recursive: true });

  const results = await Promise.all(files.map(async (file) => {
    try {
      const mimeType = file.type || "text/plain";
      if (!ALLOWED_TYPES[mimeType]) return { fileName: file.name, error: `Unsupported type: ${mimeType}` };
      if (file.size > MAX_SIZE) return { fileName: file.name, error: "File too large" };

      const ext = ALLOWED_TYPES[mimeType];
      const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
      const filePath = path.join(UPLOAD_DIR, fileName);
      await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

      const { text, pageCount } = await extractText(filePath, mimeType, membership.orgId);

      return {
        fileName: file.name,
        fileUrl: `/api/uploads/${fileName}`,
        fileType: mimeType,
        fileSize: file.size,
        pageCount: pageCount ?? null,
        extractedText: text,
        ok: true,
      };
    } catch (e: any) {
      return { fileName: file.name, error: e.message };
    }
  }));

  return NextResponse.json({ results });
}
