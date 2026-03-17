#!/usr/bin/env node
/**
 * Standalone file extraction worker — called via child_process
 * stdin: JSON { filePath, mimeType }
 * stdout: JSON { text, pageCount }
 */
const { filePath, mimeType } = JSON.parse(process.argv[2]);

async function extract() {
  const fs = require("fs");
  const buf = fs.readFileSync(filePath);

  if (mimeType === "application/pdf") {
    const pdfParse = require("pdf-parse");
    const data = await pdfParse(buf);
    return { text: data.text, pageCount: data.numpages };
  }

  if (mimeType.includes("spreadsheet") || mimeType.includes("excel") ||
      filePath.endsWith(".xlsx") || filePath.endsWith(".xls") || filePath.endsWith(".csv")) {
    const XLSX = require("xlsx");
    const wb = XLSX.read(buf, { type: "buffer" });
    const lines = [];
    wb.SheetNames.forEach(name => {
      lines.push(`=== Sheet: ${name} ===`);
      lines.push(XLSX.utils.sheet_to_csv(wb.Sheets[name]));
    });
    return { text: lines.join("\n") };
  }

  if (mimeType.includes("wordprocessingml") || filePath.endsWith(".docx")) {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: buf });
    return { text: result.value };
  }

  if (mimeType.startsWith("image/")) {
    return { text: "[IMAGE_FILE]" };
  }

  return { text: buf.toString("utf-8") };
}

extract().then(result => {
  process.stdout.write(JSON.stringify(result));
  process.exit(0);
}).catch(e => {
  process.stdout.write(JSON.stringify({ text: "", error: e.message }));
  process.exit(1);
});
