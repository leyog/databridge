import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { verifyApiKey } from "@/lib/api-auth";
import fs from "fs";
import path from "path";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  // Auth check — session or API key
  const session = await auth();
  if (!session?.user?.id) {
    const apiAuth = await verifyApiKey(req);
    if (!apiAuth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename } = await params;
  // Prevent path traversal
  const safe = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safe);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(safe).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv", ".txt": "text/plain",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".json": "application/json",
  };
  const contentType = mimeMap[ext] ?? "application/octet-stream";

  return new NextResponse(buf, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${safe}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
