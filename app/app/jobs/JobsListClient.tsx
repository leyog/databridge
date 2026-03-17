"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, FileText, Clock, CheckCircle, XCircle, Search, Download, UserCheck, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

interface Job {
  id: string;
  fileName: string;
  status: string;
  createdAt: string;
  confidence: number | null;
  slaDeadline: string | null;
  slaBreached: boolean;
  template: { id: string; name: string };
  assignedTo: { id: string; name: string | null; email: string | null } | null;
}

interface Member { id: string; name: string | null; email: string | null; }

function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

const PAGE_SIZE = 50;

export default function JobsListClient({
  members, currentUserId,
}: {
  initialJobs?: Job[];
  members: Member[];
  currentUserId: string;
}) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTarget, setAssignTarget] = useState("");

  const fetchJobs = useCallback(async (p: number, status: string, assigned: string, q: string) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
    if (status !== "all") params.set("status", status);
    if (assigned === "me") params.set("assignedTo", currentUserId);
    if (q) params.set("search", q);
    const res = await fetch(`/api/jobs?${params}`);
    const data = await res.json();
    setJobs(data.jobs ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [currentUserId]);

  useEffect(() => {
    fetchJobs(page, filterStatus, filterAssigned, search);
  }, [page, filterStatus, filterAssigned, search, fetchJobs]);

  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const reviewable = jobs.filter(j => ["PARSED", "REVIEWING"].includes(j.status));
  const selectedIds = Array.from(selected);
  const selectedReviewable = selectedIds.filter(id => {
    const j = jobs.find(j => j.id === id);
    return j && ["PARSED", "REVIEWING"].includes(j.status);
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const toggleAll = () => {
    const ids = reviewable.map(j => j.id);
    if (ids.every(id => selected.has(id))) {
      setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    }
  };

  const bulkAction = async (action: "approve" | "reject" | "assign", extra?: any) => {
    const ids = action === "assign" ? selectedIds : selectedReviewable;
    if (!ids.length) return;
    setBulkLoading(true);
    const res = await fetch("/api/jobs/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, jobIds: ids, ...extra }),
    });
    if (res.ok) {
      setSelected(new Set());
      setShowAssignModal(false);
      fetchJobs(page, filterStatus, filterAssigned, search);
    }
    setBulkLoading(false);
  };

  const exportJobs = (format: "json" | "csv" | "xlsx") => {
    setExporting(true);
    const ids = selected.size > 0 ? `&ids=${selectedIds.join(",")}` : "";
    const st = filterStatus !== "all" ? `&status=${filterStatus}` : "";
    window.location.href = `/api/jobs/export?format=${format}${st}${ids}`;
    setTimeout(() => setExporting(false), 1500);
  };

  const slaBreachedCount = jobs.filter(j => j.slaBreached).length;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {slaBreachedCount > 0 && (
        <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span><strong>{slaBreachedCount}</strong> job{slaBreachedCount > 1 ? "s have" : " has"} breached SLA</span>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5">
              <span className="text-xs text-blue-700 font-medium">{selected.size} selected</span>
              {selectedReviewable.length > 0 && (
         <>
                  <button onClick={() => bulkAction("approve")} disabled={bulkLoading}
                    className="flex items-center gap-1 bg-green-600 text-white px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-60">
                    <CheckCircle className="w-3 h-3" /> Approve
                  </button>
                  <button onClick={() => bulkAction("reject")} disabled={bulkLoading}
                    className="flex items-center gap-1 border border-red-200 text-red-600 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-red-50 disabled:opacity-60">
                    <XCircle className="w-3 h-3" /> Reject
                  </button>
                </>
              )}
              <button onClick={() => setShowAssignModal(true)}
                className="flex items-center gap-1 border border-blue-200 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-medium hover:bg-blue-100">
                <UserCheck className="w-3 h-3" /> Assign
              </button>
              <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
            </div>
          )}
          <div className="relative group">
            <button disabled={exporting}
              className="flex items-center gap-1.5 border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-50">
              <Download className="w-4 h-4" /> Export
            </button>
            <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-28 hidden group-hover:block z-10">
              {(["json", "csv", "xlsx"] as const).map(fmt => (
                <button key={fmt} onClick={() => exportJobs(fmt)}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">{fmt.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <Link href="/app/jobs/new"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Job
          </Link>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
            placeholder="Search files..."
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All statuses</option>
          {["PENDING","PROCESSING","PARSED","REVIEWING","APPROVED","REJECTED","SENT","FAILED"].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterAssigned} onChange={e => { setFilterAssigned(e.target.value); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All assignees</option>
          <option value="me">Assigned to me</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No jobs found</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 w-8">
                    <input type="checkbox"
                      checked={reviewable.length > 0 && reviewable.every(j => selected.has(j.id))}
                      onChange={toggleAll} className="rounded border-gray-300" />
                  </th>
                  {["File", "Template", "Status", "Assigned", "Created", ""].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => {
                  const isReviewable = ["PARSED", "REVIEWING"].includes(job.status);
                  const slaWarning = job.slaDeadline && !job.slaBreached && new Date(job.slaDeadline) < new Date(Date.now() + 24 * 60 * 60 * 1000);
                  return (
                    <tr key={job.id} className={`border-t border-gray-50 hover:bg-gray-50 ${job.slaBreached ? "bg-red-50/30" : ""}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(job.id)} onChange={() => toggleSelect(job.id)}
                          className="rounded border-gray-300" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {job.slaBreached && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                          {slaWarning && !job.slaBreached && <Clock className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
                          <span className="font-medium text-gray-800 truncate max-w-[160px]">{job.fileName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{job.template.name}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[job.status]}`}>{job.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {job.assignedTo ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            {job.assignedTo.name ?? job.assignedTo.email}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{relativeTime(new Date(job.createdAt))}</td>
                      <td className="px-4 py-3">
                        <Link href={`/app/jobs/${job.id}`}
                          className="text-blue-600 hover:underline text-xs font-medium">
                          {isReviewable ? "Review →" : "View →"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-400">Page {page} of {totalPages} · {total} total</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${p === page ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-xl">
            <h3 className="text-base font-bold text-gray-900 mb-4">Assign {selected.size} job{selected.size > 1 ? "s" : ""}</h3>
            <select value={assignTarget} onChange={e => setAssignTarget(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select reviewer...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name ?? m.email}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAssignModal(false)}
                className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
              <button onClick={() => bulkAction("assign", { assignedToId: assignTarget })}
                disabled={!assignTarget || bulkLoading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60">
                {bulkLoading ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
