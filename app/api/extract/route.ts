import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomBytes } from "crypto";

async function extractPdf(buf: Buffer): Promise<string> {
  const tmp = join(tmpdir(), `pdf_${randomBytes(6).toString("hex")}.pdf`);
  await writeFile(tmp, buf);
  return new Promise((resolve) => {
    execFile("pdftotext", [tmp, "-"], { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout) => {
      await unlink(tmp).catch(() => {});
      resolve(stdout || "");
    });
  });
}

async function extractExcel(buf: Buffer): Promise<string> {
  const XLSX = (await import("xlsx")).default;
  const wb = XLSX.read(buf, { type: "buffer" });
  const lines: string[] = [];
  wb.SheetNames.forEach(name => {
    lines.push(`=== Sheet: ${name} ===`);
    lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
  });
  return lines.join("\n");
}

async function extractDocx(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: buf });
  return result.value;
}

export async function POST(req: NextRequest) {
  try {
    const buf = Buffer.from(await req.arrayBuffer());
    const ct = req.headers.get("content-type") || "";
    const mimeType = ct.split(";")[0].trim();
    const filename = req.headers.get("x-filename") || "file";

    let text = "";

    if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
      text = await extractPdf(buf);
    } else if (
      mimeType.includes("spreadsheet") || mimeType.includes("excel") ||
      /\.(xlsx|xls|csv)$/i.test(filename)
    ) {
      text = await extractExcel(buf);
    } else if (mimeType.includes("wordprocessingml") || filename.endsWith(".docx")) {
      text = await extractDocx(buf);
    } else if (mimeType.startsWith("image/")) {
      return NextResponse.json({
        text: "[IMAGE_FILE]",
        imageBase64: buf.toString("base64"),
        imageMime: mimeType,
        mimeType,
      });
    } else {
      text = buf.toString("utf-8");
    }

    return NextResponse.json({ text, mimeType });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, text: "" }, { status: 500 });
  }
}
