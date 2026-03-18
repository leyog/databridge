import fs from "fs";
import { prisma } from "@/lib/prisma";

export type ExtractResult = {
  text: string;
  pageCount?: number;
  mimeType: string;
  imageBase64?: string;
  imageMime?: string;
};

type AiConfig = { apiKey?: string | null; baseUrl?: string | null; model?: string | null; provider?: string | null } | null;

async function getAiConfigByOrgId(orgId: string | null): Promise<AiConfig> {
  if (!orgId) return null;
  const config = await prisma.aiConfig.findUnique({ where: { orgId } });
  console.log("[extractText] aiConfig for orgId", orgId, ":", JSON.stringify({ ...config, apiKey: config?.apiKey ? `${config.apiKey.slice(0, 8)}...` : null }));
  return config;
}

async function extractPdf(buf: Buffer, aiConfig: AiConfig): Promise<string> {
  const { execFile } = await import("child_process");
  const { writeFile, unlink, readdir } = await import("fs/promises");
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const { randomBytes } = await import("crypto");

  // Try pdftotext first
  try {
    const tmpId = randomBytes(6).toString("hex");
    const tmp = join(tmpdir(), `pdf_${tmpId}.pdf`);
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
    // pdftotext failed or empty — send PDF as base64 to vision API
    const apiKey = aiConfig?.apiKey || "";
    if (!apiKey) throw new Error("请先在设置页面配置 AI Provider（API Key）后再上传文件。");
    const provider = aiConfig?.provider || "anthropic";
    const defaultBaseUrl = provider === "openai" ? "https://api.openai.com/v1" : "https://api.anthropic.com";
    const baseURL = (aiConfig?.baseUrl || defaultBaseUrl).replace(/\/$/, "");
    const model = aiConfig?.model || (provider === "openai" ? "gpt-4o" : "claude-sonnet-4-6");
    const base64 = buf.toString("base64");

    // Try OpenAI-compatible vision with PDF as image_url data URI
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${base64}` } },
            { type: "text", text: "Extract all text content from this PDF. Return only the raw text, no formatting or commentary." }
          ]
        }]
      })
    });

    console.log("[extractPdf] vision API status:", res.status, "url:", `${baseURL}/chat/completions`);
    if (!res.ok) {
      const e = await res.text();
      console.error("[extractPdf] vision API error:", res.status, e);
      throw new Error(`API error: ${res.status} - ${e}`);
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content ?? json.content?.[0]?.text ?? "";
    console.log("[extractPdf] extracted text length:", text.length);
    return text;
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

async function extractEml(buf: Buffer, aiConfig: AiConfig): Promise<string> {
  const { simpleParser } = await import("mailparser");
  const parsed = await simpleParser(buf);
  const parts: string[] = [];
  parts.push(`Subject: ${parsed.subject ?? ""}`);
  parts.push(`From: ${parsed.from?.text ?? ""}`);
  parts.push(`To: ${Array.isArray(parsed.to) ? parsed.to.map((a: any) => a.text).join(", ") : (parsed.to as any)?.text ?? ""}`);
  parts.push(`Date: ${parsed.date?.toISOString() ?? ""}`);
  parts.push("");
  if (parsed.text) parts.push(parsed.text);
  for (const att of parsed.attachments ?? []) {
    console.log("[extractEml] attachment:", att.filename, "contentType:", att.contentType, "size:", (att.content as Buffer)?.length);
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

export async function extractText(filePath: string, mimeType: string, orgId?: string | null): Promise<ExtractResult> {
  if (mimeType.startsWith("image/")) {
    const buf = fs.readFileSync(filePath);
    return { text: "[IMAGE_FILE]", mimeType, imageBase64: buf.toString("base64"), imageMime: mimeType };
  }

  try {
    const buf = fs.readFileSync(filePath);
    const fileName = filePath.split("/").pop() ?? "file";
    const aiConfig = await getAiConfigByOrgId(orgId ?? null);
    let text = "";

    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      text = await extractPdf(buf, aiConfig);
    } else if (mimeType.includes("spreadsheet") || mimeType.includes("excel") || /\.(xlsx|xls|csv)$/i.test(fileName)) {
      text = await extractExcel(buf);
    } else if (mimeType.includes("wordprocessingml") || fileName.endsWith(".docx")) {
      text = await extractDocx(buf);
    } else if (mimeType === "message/rfc822" || fileName.endsWith(".eml")) {
      text = await extractEml(buf, aiConfig);
    } else {
      text = buf.toString("utf-8");
    }

    return { text, mimeType };
  } catch (e: any) {
    console.error("[extractText] error:", e?.message);
    try { return { text: fs.readFileSync(filePath, "utf-8"), mimeType }; }
    catch { return { text: "", mimeType }; }
  }
}
