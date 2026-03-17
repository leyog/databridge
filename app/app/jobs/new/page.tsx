"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText, X, Image, FileSpreadsheet, File } from "lucide-react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  description?: string;
}

const FILE_ICONS: Record<string, any> = {
  "application/pdf": FileText,
  "image/jpeg": Image,
  "image/png": Image,
  "image/webp": Image,
  "image/gif": Image,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "application/vnd.ms-excel": FileSpreadsheet,
  "text/csv": FileSpreadsheet,
};

function getFileIcon(mimeType: string) {
  return FILE_ICONS[mimeType] ?? File;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function NewJobPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{
    fileUrl: string; fileName: string; fileType: string; fileSize: number; pageCount?: number;
    imageBase64?: string; imageMime?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(() => {});
  }, []);

  const handleFile = async (f: File) => {
    setFile(f);
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("autoClassify", "true");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { throw new Error(`Upload failed: ${text || res.status}`); }
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setUploadedFile({ fileUrl: data.fileUrl, fileName: data.fileName, fileType: data.fileType, fileSize: data.fileSize, pageCount: data.pageCount, imageBase64: data.imageBase64 ?? undefined, imageMime: data.imageMime ?? undefined });
      setContent(data.extractedText ?? "");
      // Auto-select template if classified
      if (data.suggestedTemplateId && !templateId) {
        setTemplateId(data.suggestedTemplateId);
      }
    } catch (e: any) {
      setError(e.message);
      setFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const clearFile = () => {
    setFile(null);
    setUploadedFile(null);
    setContent("");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) { setError("Please select a template"); return; }
    if (!content.trim() && !uploadedFile) { setError("Please provide content or upload a file"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          fileName: uploadedFile?.fileName ?? "paste.txt",
          fileContent: content,
          fileUrl: uploadedFile?.fileUrl ?? "",
          fileType: uploadedFile?.fileType ?? "text/plain",
          fileSize: uploadedFile?.fileSize ?? content.length,
          imageBase64: uploadedFile?.imageBase64 ?? undefined,
          imageMime: uploadedFile?.imageMime ?? undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/app/jobs/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const FileIcon = file ? getFileIcon(file.type) : Upload;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/app/jobs" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">New Job</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Template */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Template *</label>
          {templates.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">
              No templates yet.{" "}
              <Link href="/app/templates/new" className="text-blue-600 hover:underline">Create one first →</Link>
            </div>
          ) : (
            <select value={templateId} onChange={e => setTemplateId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
        </div>

        {/* File upload */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-3">Upload File</label>

          {!file ? (
            <div
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => inputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragOver ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50"
              }`}>
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Drop file here or click to upload</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Images, Excel, Word, CSV, TXT — up to 20MB</p>
              <input ref={inputRef} type="file" className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,.xlsx,.xls,.csv,.docx,.txt,.json,.html,.xml,.md"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl p-4">
              {uploading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">{file.name}</p>
                    <p className="text-xs text-gray-400">Extracting content...</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center shrink-0">
                    <FileIcon className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatBytes(file.size)}
                      {uploadedFile?.pageCount ? ` · ${uploadedFile.pageCount} pages` : ""}
                      {" · "}
                      <span className="text-green-600">Ready</span>
                    </p>
                  </div>
                  <button type="button" onClick={clearFile} className="text-gray-400 hover:text-gray-600 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Content preview / paste fallback */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {uploadedFile ? "Extracted Content" : "Paste Content *"}
            </label>
            {content && (
              <span className="text-xs text-gray-400">{content.length.toLocaleString()} chars</span>
            )}
          </div>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={uploadedFile ? 6 : 10}
            placeholder={uploadedFile ? "Extracted text will appear here..." : "Paste your content here, or upload a file above..."}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || uploading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Submitting...</>
            ) : (
              <><FileText className="w-4 h-4" />Parse with AI</>
            )}
          </button>
          <Link href="/app/jobs"
            className="px-6 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
