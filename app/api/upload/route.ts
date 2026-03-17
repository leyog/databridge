import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyApiKey } from "@/lib/api-auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { extractText } from "@/lib/file-extract";
import { classifyDocument } from "@/lib/classify";
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
  let orgId: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    const m = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
    orgId = m?.orgId ?? null;
  } else {
    const apiAuth = await verifyApiKey(req);
    if (apiAuth.ok) orgId = apiAuth.orgId;
  }

  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const autoClassify = formData.get("autoClassify") === "true";

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const mimeType = file.type || "text/plain";
  if (!ALLOWED_TYPES[mimeType]) return NextResponse.json({ error: `Unsupported file type: ${mimeType}` }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 20MB)" }, { status: 400 });

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = ALLOWED_TYPES[mimeType];
  const fileName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  const filePath = path.join(UPLOAD_DIR, fileName);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const { text, pageCount, imageBase64, imageMime } = await extractText(filePath, mimeType);

  // Auto-classify if requested
  let suggestedTemplateId: string | null = null;
  if (autoClassify) {
    suggestedTemplateId = await classifyDocument(text, orgId).catch(() => null);
  }

  return NextResponse.json({
    fileUrl: `/api/uploads/${fileName}`,
    fileName: file.name,
    fileType: mimeType,
    fileSize: file.size,
    pageCount: pageCount ?? null,
    extractedText: text,
    imageBase64: imageBase64 ?? null,
    imageMime: imageMime ?? null,
    suggestedTemplateId,
  });
}
