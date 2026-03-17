"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Save, Clock, AlertTriangle, FileText, Send, RotateCcw } from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  extractedText: string | null;
  status: string;
  webhookStatus: string | null;
  parsedData: Record<string, any> | null;
  reviewedData: Record<string, any> | null;
  rawResult: { fieldConfidence?: Record<string, number> } | null;
  reviewNote: string | null;
  confidence: number | null;
  template: { name: string; webhookUrl: string | null; outputSchema: any } | null;
  createdAt: string;
  errorMessage: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-500",
  PROCESSING: "bg-blue-100 text-blue-600",
  PARSED: "bg-yellow-100 text-yellow-600",
  REVIEWING: "bg-orange-100 text-orange-600",
  APPROVED: "bg-green-100 text-green-600",
  REJECTED: "bg-red-100 text-red-600",
  SENT: "bg-emerald-100 text-emerald-600",
  FAILED: "bg-red-100 text-red-500",
};

function ConfidenceBadge({ score }: { score?: number }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "text-green-600 bg-green-50" : pct >= 50 ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${color} flex items-center gap-1`}>
      {pct < 80 && <AlertTriangle className="w-3 h-3" />}
      {pct}%
    </span>
  );
}

function FilePreview({
  fileUrl, fileType, fileName, extractedText,
}: {
  fileUrl: string; fileType: string; fileName: string; extractedText: string | null;
}) {
  const [tab, setTab] = useState<"file" | "text">(fileUrl ? "file" : "text");

  const hasFile = !!fileUrl;
  const hasText = !!extractedText;

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs */}
      {(hasFile || hasText) && (
        <div className="flex gap-1 px-3 py-2 border-b border-gray-100 bg-white shrink-0">
          {hasFile && (
            <button onClick={() => setTab("file")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === "file" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}>
              File
            </button>
          )}
          {hasText && (
            <button onClick={() => setTab("text")}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${tab === "text" ? "bg-blue-50 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}>
              Raw Text
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {tab === "file" && hasFile ? (
          fileType === "application/pdf" ? (
            <iframe src={fileUrl} className="w-full h-full border-0" title={fileName} />
          ) : fileType.startsWith("image/") ? (
            <div className="flex items-center justify-center h-full p-4 bg-gray-50">
              <img src={fileUrl} alt={fileName} className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 bg-gray-50">
              <FileText className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">{fileName}</p>
              <a href={fileUrl} download className="text-xs text-blue-500 hover:underline">Download file</a>
            </div>
          )
        ) : tab === "text" && hasText ? (
          <pre className="h-full overflow-auto p-4 text-xs font-mono text-gray-700 bg-gray-50 whitespace-pre-wrap leading-relaxed">
            {extractedText}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-300 gap-2 bg-gray-50">
            <FileText className="w-10 h-10" />
            <p className="text-sm">No preview available</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FieldEditor({
  fieldName, value, confidence, onChange, disabled,
}: {
  fieldName: string; value: any; confidence?: number; onChange: (v: any) => void; disabled: boolean;
}) {
  const isLowConf = confidence != null && confidence < 0.8;
  const label = fieldName.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const isNumber = typeof value === "number";
  const isBoolean = typeof value === "boolean";
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object" && !isArray;

  return (
    <div className={`rounded-lg border p-3 ${isLowConf ? "border-yellow-200 bg-yellow-50/30" : "border-gray-100 bg-white"}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        <ConfidenceBadge score={confidence} />
      </div>
      {isBoolean ? (
        <select value={String(value)} onChange={e => onChange(e.target.value === "true")} disabled={disabled}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      ) : isArray || isObject ? (
        <textarea value={JSON.stringify(value, null, 2)}
          onChange={e => { try { onChange(JSON.parse(e.target.value)); } catch {} }}
          disabled={disabled} rows={3}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-gray-50" />
      ) : (
        <input type={isNumber ? "number" : "text"} value={value ?? ""}
          onChange={e => onChange(isNumber ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value)}
          disabled={disabled}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50" />
      )}
    </div>
  );
}

export default function JobReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [fields, setFields] = useState<Record<string, any>>({});
  const [reviewNote, setReviewNote] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"fields" | "raw">("fields");
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    params.then(p => {
      setJobId(p.id);
      const load = () =>
        fetch(`/api/jobs/${p.id}`)
          .then(r => r.json())
          .then((data: Job) => {
            setJob(prev => {
              if (!prev || (prev.status !== "PARSED" && data.status === "PARSED")) {
                const display = data.reviewedData ?? data.parsedData ?? {};
                setFields(display);
                setReviewNote(data.reviewNote ?? "");
              }
              return data;
            });
            if (data.status === "PROCESSING" || data.status === "PENDING") {
              pollRef.current = setTimeout(load, 2000);
            }
          });
      load();
    });
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [params]);

  const handleAction = async (action: "approve" | "reject" | "save" | "send" | "reopen") => {
    if (!jobId) return;
    setLoading(action);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewedData: action !== "reject" && action !== "send" && action !== "reopen" ? fields : undefined,
          reviewNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJob(data);
      if (action === "reopen") {
        // refresh fields from reviewedData
        setFields(data.reviewedData ?? data.parsedData ?? {});
      } else if (action === "approve" && data.status === "SENT") {
        router.push("/app/jobs");
      } else if (action === "send" && data.status === "SENT") {
        router.push("/app/jobs");
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  };

  if (!job) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const canEdit = ["PARSED", "REVIEWING"].includes(job.status);
  const canApprove = ["PARSED", "REVIEWING"].includes(job.status);
  const canReopen = ["APPROVED", "REJECTED", "SENT"].includes(job.status);
  const isProcessing = job.status === "PROCESSING" || job.status === "PENDING";
  const fieldConf = job.rawResult?.fieldConfidence ?? {};
  const lowConfFields = Object.entries(fieldConf).filter(([, v]) => v < 0.8).length;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/app/jobs" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-gray-900">{job.fileName}</h1>
            <p className="text-xs text-gray-400">{job.template?.name} · {new Date(job.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lowConfFields > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-full">
              <AlertTriangle className="w-3 h-3" />
              {lowConfFields} low confidence
            </span>
          )}
          {job.confidence != null && !isProcessing && (
            <span className="text-xs text-gray-400">
              Overall: <span className="font-medium text-gray-700">{Math.round(job.confidence * 100)}%</span>
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[job.status]}`}>
            {job.status}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: file preview */}
        <div className="w-[45%] border-r border-gray-100 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-white shrink-0">
            <p className="text-xs font-medium text-gray-500">Original Content</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <FilePreview
              fileUrl={job.fileUrl}
              fileType={job.fileType}
              fileName={job.fileName}
              extractedText={job.extractedText}
            />
          </div>
        </div>

        {/* Right: fields + actions */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white shrink-0">
            {(["fields", "raw"] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeTab === tab ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:text-gray-700"
                }`}>
                {tab === "fields" ? "Fields" : "Raw JSON"}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-gray-400">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm">AI is parsing your file...</p>
              </div>
            ) : job.status === "FAILED" ? (
              <div className="flex flex-col items-center justify-center h-48 gap-2 text-red-400">
                <XCircle className="w-8 h-8" />
                <p className="text-sm font-medium">Parsing failed</p>
                {job.errorMessage && (
                  <p className="text-xs text-red-300 text-center max-w-xs">{job.errorMessage}</p>
                )}
              </div>
            ) : activeTab === "fields" ? (
              <div className="space-y-2">
                {Object.keys(fields).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No fields extracted</p>
                ) : (
                  Object.entries(fields).map(([key, val]) => (
                    <FieldEditor key={key} fieldName={key} value={val}
                      confidence={fieldConf[key]}
                      onChange={v => setFields(f => ({ ...f, [key]: v }))}
                      disabled={!canEdit} />
                  ))
                )}
              </div>
            ) : (
              <pre className="text-xs font-mono bg-gray-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(fields, null, 2)}
              </pre>
            )}
          </div>

          {/* Actions */}
          <div className="border-t border-gray-100 p-4 bg-white shrink-0 space-y-3">
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              disabled={!canEdit && !canReopen} rows={2}
              placeholder="Review note (optional)..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none disabled:bg-gray-50" />

            {canApprove && (
              <div className="flex gap-2">
                <button onClick={() => handleAction("approve")} disabled={!!loading}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-green-700 disabled:opacity-60">
                  {loading === "approve" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  {job.template?.webhookUrl ? "Approve & Send" : "Approve"}
                </button>
                <button onClick={() => handleAction("save")} disabled={!!loading}
                  className="px-4 flex items-center justify-center gap-1.5 border border-gray-200 text-gray-700 py-2 rounded-lg font-semibold text-sm hover:bg-gray-50 disabled:opacity-60">
                  {loading === "save" ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
                <button onClick={() => handleAction("reject")} disabled={!!loading}
                  className="px-4 flex items-center justify-center gap-1.5 border border-red-200 text-red-600 py-2 rounded-lg font-semibold text-sm hover:bg-red-50 disabled:opacity-60">
                  {loading === "reject" ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                  Reject
                </button>
              </div>
            )}

            {["SENT", "APPROVED", "REJECTED"].includes(job.status) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Reopen button */}
                  {canReopen && (
                    <button onClick={() => handleAction("reopen")} disabled={!!loading}
                      className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60">
                      {loading === "reopen" ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                      Reopen
                    </button>
                  )}

                  {/* Manual send for APPROVED with webhook */}
                  {job.status === "APPROVED" && job.template?.webhookUrl && (
                    <>
                      <button onClick={() => handleAction("send")} disabled={!!loading}
                        className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">
                        {loading === "send" ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {job.webhookStatus === "FAILED" ? "Retry Send" : "Send to Webhook"}
                      </button>
                      {job.webhookStatus === "FAILED" && (
                        <span className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded-full">Last send failed</span>
                      )}
                    </>
                  )}

                  {/* No webhook notice */}
                  {job.status === "APPROVED" && !job.template?.webhookUrl && (
                    <p className="text-xs text-gray-400">No webhook configured.</p>
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>
                    {job.status === "SENT" ? "Sent to webhook"
                      : job.status === "APPROVED" ? "Approved — pending send"
                      : "Rejected"}
                  </span>
                  {job.reviewNote && <span className="text-gray-400">· {job.reviewNote}</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
