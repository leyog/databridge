import { NextRequest, NextResponse } from "next/server";

async function extractPdf(buf: Buffer): Promise<string> {
  // Try pdftotext first (local/server), fallback to pdf-parse (Vercel)
  try {
    const { execFile } = await import("child_process");
    const { writeFile, unlink } = await import("fs/promises");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const { randomBytes } = await import("crypto");
    const tmp = join(tmpdir(), `pdf_${randomBytes(6).toString("hex")}.pdf`);
    await writeFile(tmp, buf);
    const text = await new Promise<string>((resolve, reject) => {
      execFile("pdftotext", [tmp, "-"], { maxBuffer: 10 * 1024 * 1024 }, async (err, stdout) => {
        await unlink(tmp).catch(() => {});
        if (err) reject(err);
        else resolve(stdout || "");
      });
    });
    return text;
  } catch {
    // Fallback: pdf-parse (pure JS, works on Vercel)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const result = await pdfParse(buf);
    return result.text;
  }
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

async function extractEml(buf: Buffer): Promise<string> {
  const { simpleParser } = await import("mailparser");
  const parsed = await simpleParser(buf);

  const parts: string[] = [];

  // Email headers
  parts.push(`Subject: ${parsed.subject ?? ""}`);
  parts.push(`From: ${parsed.from?.text ?? ""}`);
  parts.push(`To: ${Array.isArray(parsed.to) ? parsed.to.map(a => a.text).join(", ") : parsed.to?.text ?? ""}`);
  parts.push(`Date: ${parsed.date?.toISOString() ?? ""}`);
  parts.push("");

  // Email body
  if (parsed.text) parts.push(parsed.text);

  // Extract PDF attachments
  for (const att of parsed.attachments ?? []) {
    if (att.contentType === "application/pdf" || att.filename?.toLowerCase().endsWith(".pdf")) {
      parts.push(`\n--- Attachment: ${att.filename} ---`);
      try {
        const pdfText = await extractPdf(att.content as Buffer);
        parts.push(pdfText);
      } catch {
        parts.push("[PDF extraction failed]");
      }
    } else if (att.contentType?.startsWith("text/")) {
      parts.push(`\n--- Attachment: ${att.filename} ---`);
      parts.push(att.content.toString("utf-8"));
    }
  }

  return parts.join("\n");
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
    } else if (mimeType === "message/rfc822" || filename.endsWith(".eml")) {
      text = await extractEml(buf);
    } else {
      text = buf.toString("utf-8");
    }

    return NextResponse.json({ text, mimeType });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, text: "" }, { status: 500 });
  }
}
