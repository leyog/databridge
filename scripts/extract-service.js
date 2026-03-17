/**
 * File extraction microservice — runs as a separate Node.js process
 * POST /extract  body: multipart form with "file" field
 * Response: { text, pageCount, mimeType }
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const PORT = process.env.EXTRACT_PORT || 8002;

function parseMultipart(body, boundary) {
  const parts = [];
  const sep = Buffer.from("--" + boundary);
  let start = 0;
  while (true) {
    const idx = body.indexOf(sep, start);
    if (idx === -1) break;
    const end = body.indexOf(sep, idx + sep.length);
    if (end === -1) break;
    const part = body.slice(idx + sep.length + 2, end - 2); // skip \r\n
    const headerEnd = part.indexOf("\r\n\r\n");
    if (headerEnd === -1) { start = end; continue; }
    const headers = part.slice(0, headerEnd).toString();
    const content = part.slice(headerEnd + 4);
    parts.push({ headers, content });
    start = end;
  }
  return parts;
}

const { execFile } = require("child_process");

async function extractText(buf, mimeType, filename) {
  if (mimeType === "application/pdf" || filename?.endsWith(".pdf")) {
    // Use system pdftotext
    const tmp = path.join(os.tmpdir(), `pdf_${crypto.randomBytes(6).toString("hex")}.pdf`);
    fs.writeFileSync(tmp, buf);
    return new Promise((resolve) => {
      execFile("pdftotext", [tmp, "-"], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        fs.unlinkSync(tmp);
        resolve({ text: stdout || "", pageCount: undefined });
      });
    });
  }

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") ||
      filename?.match(/\.(xlsx|xls|csv)$/i)) {
    const XLSX = require("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const lines = [];
    wb.SheetNames.forEach(name => {
      lines.push(`=== Sheet: ${name} ===`);
      lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
    });
    return { text: lines.join("\n") };
  }

  if (mimeType.includes("wordprocessingml") || filename?.endsWith(".docx")) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value };
  }

  if (mimeType.startsWith("image/")) {
    // Return base64 for vision API processing in parse-job
    return { text: "[IMAGE_FILE]", imageBase64: buf.toString("base64"), imageMime: mimeType };
  }

  return { text: buf.toString("utf-8") };
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/extract") {
    res.writeHead(404); res.end("Not found"); return;
  }

  const chunks = [];
  req.on("data", c => chunks.push(c));
  req.on("end", async () => {
    try {
      const body = Buffer.concat(chunks);
      const ct = req.headers["content-type"] || "";
      const boundaryMatch = ct.match(/boundary=([^\s;]+)/);

      let fileBuf, mimeType, filename;

      if (boundaryMatch) {
        const parts = parseMultipart(body, boundaryMatch[1]);
        for (const part of parts) {
          if (part.headers.includes('name="file"')) {
            const mimeMatch = part.headers.match(/Content-Type:\s*([^\r\n]+)/i);
            const nameMatch = part.headers.match(/filename="([^"]+)"/i);
            fileBuf = part.content;
            mimeType = mimeMatch?.[1]?.trim() || "application/octet-stream";
            filename = nameMatch?.[1] || "file";
            break;
          }
        }
      } else {
        // Raw body with headers
        fileBuf = body;
        mimeType = ct.split(";")[0].trim();
        filename = req.headers["x-filename"] || "file";
      }

      if (!fileBuf) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "No file provided" })); return;
      }

      const result = await extractText(fileBuf, mimeType, filename);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ...result, mimeType }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message, text: "" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[extract-service] listening on :${PORT}`);
});
