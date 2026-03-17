import fs from "fs";

export type ExtractResult = {
  text: string;
  pageCount?: number;
  mimeType: string;
  imageBase64?: string;
  imageMime?: string;
};

// In Vercel environment, use internal API route; locally use extract-service
const EXTRACT_URL = process.env.EXTRACT_SERVICE_URL || process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/extract`
  : "http://localhost:8002/extract";

export async function extractText(filePath: string, mimeType: string): Promise<ExtractResult> {
  // Images: read directly as base64, no HTTP needed
  if (mimeType.startsWith("image/")) {
    const buf = fs.readFileSync(filePath);
    return { text: "[IMAGE_FILE]", mimeType, imageBase64: buf.toString("base64"), imageMime: mimeType };
  }

  try {
    const buf = fs.readFileSync(filePath);
    const fileName = filePath.split("/").pop() ?? "file";

    // Try internal API route first (works on Vercel), then fallback to extract-service
    const urls = [
      process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/extract` : null,
      "http://localhost:8002/extract",
      "http://localhost:8001/api/extract",
    ].filter(Boolean) as string[];

    let lastErr: any;
    for (const url of urls) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": mimeType, "X-Filename": fileName },
          body: buf,
        });
        if (!res.ok) continue;
        const data = await res.json() as any;
        return { text: data.text ?? "", pageCount: data.pageCount, mimeType };
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr;
  } catch {
    try { return { text: fs.readFileSync(filePath, "utf-8"), mimeType }; }
    catch { return { text: "", mimeType }; }
  }
}
