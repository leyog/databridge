import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

async function getAiConfig(req: NextRequest) {
  const session = await auth();
  console.log("[getAiConfig] session:", JSON.stringify({ userId: session?.user?.id, email: session?.user?.email }));
  if (!session?.user?.id) {
    console.log("[getAiConfig] no session user id, returning null");
    return null;
  }
  const member = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  console.log("[getAiConfig] orgMember query userId:", session.user.id, "result:", JSON.stringify(member));
  if (!member) {
    console.log("[getAiConfig] no org member found, returning null");
    return null;
  }
  const config = await prisma.aiConfig.findUnique({ where: { orgId: member.orgId } });
  console.log("[getAiConfig] aiConfig query orgId:", member.orgId, "result:", JSON.stringify({ ...config, apiKey: config?.apiKey ? `${config.apiKey.slice(0,8)}...` : null }));
  return config;
}

async function extractPdf(buf: Buffer, aiConfig: { apiKey?: string | null; baseUrl?: string | null; model?: string | null } | null): Promise<string> {
  // Try pdftotext first (local/server)
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
    if (text.trim()) return text;
    throw new Error("empty");
  } catch {
    // Fallback: call Anthropic API directly with PDF as base64
    const apiKey = aiConfig?.apiKey || "";
    if (!apiKey) throw new Error("请先在设置页面配置 AI Provider（API Key）后再上传文件。");
    const provider = (aiConfig as any)?.provider || "anthropic";
    const defaultBaseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com";
    const baseURL = (aiConfig?.baseUrl || defaultBaseUrl).replace(/\/$/, "");
    const model = aiConfig?.model || (provider === "openai" ? "gpt-4o" : "claude-sonnet-4-6");
    const base64 = buf.toString("base64");
    const res = await fetch(`${baseURL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: "Extract all text content from this PDF. Return only the raw text, no formatting or commentary." }
          ]
        }]
      })
    });
    console.log("[pdf] request url:", `${baseURL}/messages`, "status:", res.status);
    if (!res.ok) {
      const errText = await res.text();
      console.error("[pdf] api error:", errText);
      throw new Error(`API error: ${res.status}`);
    }
    const json = await res.json();
    return json.content?.[0]?.text || "";
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

async function extractEml(buf: Buffer, aiConfig: { apiKey?: string | null; baseUrl?: string | null; model?: string | null } | null): Promise<string> {
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
        const pdfText = await extractPdf(att.content as Buffer, aiConfig);
        parts.push(pdfText);
      } catch (e) {
        parts.push("[PDF extraction failed]");
        console.error("[eml] PDF extraction error:", e instanceof Error ? e.message : String(e));
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
    const aiConfig = await getAiConfig(req);

    let text = "";

    if (mimeType === "application/pdf" || filename.endsWith(".pdf")) {
      text = await extractPdf(buf, aiConfig);
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
      text = await extractEml(buf, aiConfig);
    } else {
      text = buf.toString("utf-8");
    }

    return NextResponse.json({ text, mimeType });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, text: "" }, { status: 500 });
  }
}
