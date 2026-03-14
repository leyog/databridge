"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  description?: string;
}

export default function NewJobPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("paste.txt");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/templates").then(r => r.json()).then(setTemplates).catch(() => {});
  }, []);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => setContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateId) { setError("Please select a template"); return; }
    if (!content.trim()) { setError("Please provide content"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, fileName, fileContent: content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      router.push(`/app/jobs/${data.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

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
            <select
              value={templateId}
              onChange={e => setTemplateId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a template...</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* File upload */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload File (optional)</label>
          <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-colors">
            <Upload className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-600">
                {fileName !== "paste.txt" ? fileName : "Click to upload a file"}
              </p>
              <p className="text-xs text-gray-400">TXT, CSV, JSON, or any text-based file</p>
            </div>
            <input type="file" className="hidden" accept=".txt,.csv,.json,.xml,.html,.md" onChange={handleFile} />
          </label>
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Content * <span className="text-gray-400 font-normal">(paste text or upload file above)</span>
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={10}
            placeholder="Paste your content here, or upload a file above..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                Parse & Create Job
              </>
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
