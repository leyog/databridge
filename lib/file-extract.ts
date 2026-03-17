import fs from "fs";

export type ExtractResult = {
  text: string;
  pageCount?: number;
  mimeType: string;
  imageBase64?: string;
  imageMime?: string;
};

const EXTRACT_SERVICE = process.env.EXTRACT_SERVICE_URL || "http://localhost:8002";

export async function extractText(filePath: string, mimeType: string): Promise<ExtractResult> {
  try {
    const buf = fs.readFileSync(filePath);
    const fileName = filePath.split("/").pop() ?? "file";

    const res = await fetch(`${EXTRACT_SERVICE}/extract`, {
      method: "POST",
      headers: { "Content-Type": mimeType, "X-Filename": fileName },
      body: buf,
    });

    if (!res.ok) throw new Error(`extract-service ${res.status}`);
    const data = await res.json() as any;
    return {
      text: data.text ?? "",
      pageCount: data.pageCount,
      mimeType,
      imageBase64: data.imageBase64,
      imageMime: data.imageMime,
    };
  } catch {
    try { return { text: fs.readFileSync(filePath, "utf-8"), mimeType }; }
    catch { return { text: "", mimeType }; }
  }
}
