"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle, XCircle, Save, Clock } from "lucide-react";
import Link from "next/link";

interface Job {
  id: string;
  fileName: string;
  status: string;
  parsedData: any;
  reviewedData: any;
  reviewNote: string | null;
  confidence: number | null;
  template: { name: string; webhookUrl: string | null };
  createdAt: string;
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

export default function JobReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [editedData, setEditedData] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [jsonError, setJsonError] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string>("");

  useEffect(() => {
    params.then(p => {
      setJobId(p.id);
      fetch(`/api/jobs/${p.id}`)
        .then(r => r.json())
        .then((data: Job) => {
          setJob(data);
          const display = data.reviewedData ?? data.parsedData;
          setEditedData(display ? JSON.stringify(display, null, 2) : "{}");
          setReviewNote(data.reviewNote ?? "");
        });
    });
  }, [params]);

  const validateJson = (val: string) => {
    try { JSON.parse(val); setJsonError(""); return true; }
    catch (e: any) { setJsonError(e.message); return false; }
  };

  const handleAction = async (action: "approve" | "reject" | "save") => {
    if (!jobId) return;
    if (action !== "reject" && !validateJson(editedData)) return;
    setLoading(action);
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          reviewedData: action !== "reject" ? JSON.parse(editedData) : undefined,
          reviewNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJob(data);
      if (action === "approve") router.push("/app/jobs");
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/app/jobs" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{job.fileName}</h1>
            <p className="text-sm text-gray-400">{job.template.name} · {new Date(job.createdAt).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {job.confidence != null && (
            <span className="text-xs text-gray-400">
              Confidence: <span className="font-medium text-gray-700">{Math.round(job.confidence * 100)}%</span>
            </span>
          )}
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[job.status]}`}>
            {job.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Left: extracted data editor */}
        <div className="bg-rounded-xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">Extracted Data</h2>
            {jsonError && <span className="text-xs text-red-500">{jsonError}</span>}
          </div>
          <textarea
            value={editedData}
            onChange={e => { setEditedData(e.target.value); validateJson(e.target.value); }}
            disabled={!canEdit}
            rows={20}
            className={`w-full font-mono text-xs border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              jsonError ? "border-red-300 bg-red-50" : "border-gray-200"
            } ${!canEdit ? "bg-gray-50 text-gray-500" : ""}`}
          />
        </div>

        {/* Right: actions + info */}
        <div className="space-y-4">
          {/* Review note */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Review Note</label>
            <textarea
              value={reviewNote}
              onChange={e => setReviewNote(e.target.value)}
              disabled={!canEdit}
              rows={3}
              placeholder="Optional note about this review..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none disabled:bg-gray-50"
            />
          </div>

          {/* Actions */}
          {canApprove && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
              <h2 className="font-semibold text-gray-800 text-sm mb-3">Actions</h2>
              <button onClick={() => handleAction("approve")} disabled={!!loading || !!jsonError}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-60">
                {loading === "approve" ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {job.template.webhookUrl ? "Approve & Send to Webhook" : "Approve"}
              </button>
              <button onClick={() => handleAction("save")} disabled={!!loading || !!jsonError}
                className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50 disabled:opacity-60">
                {loading === "save" ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
              <button onClick={() => handleAction("reject")} disabled={!!loading}
                className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 py-2.5 rounded-xl font-semibold text-sm hover:bg-red-50 disabled:opacity-60">
                {loading === "reject" ? <div className="w-4 h-4 border-2 border-red-200 border-t-red-500 rounded-full animate-spin" /> : <XCircle className="w-4 h-4" />}
                Reject
              </button>
            </div>
          )}

          {/* Webhook info */}
          {job.template.webhookUrl && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
              <p className="text-xs font-medium text-gray-500 mb-1">Webhook Target</p>
              <p className="text-xs text-gray-700 font-mono break-all">{job.template.webhookUrl}</p>
            </div>
          )}

          {/* Status history */}
          {["SENT", "APPROVED", "REJECTED"].includes(job.status) && (
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock className="w-4 h-4" />
                <span>
                  {job.status === "SENT" ? "Sent to webhook" : job.status === "APPROVED" ? "Approved" : "Rejected"}
                </span>
              </div>
              {job.reviewNote && (
                <p className="text-sm text-gray-600 mt-2 bg-gray-50 px-3 py-2 rounded-lg">{job.reviewNote}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
