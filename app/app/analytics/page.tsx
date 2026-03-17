"use client";
import { useState, useEffect } from "react";
import { TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle, FileText, Users } from "lucide-react";

interface Analytics {
  total: number;
  byStatus: Record<string, number>;
  byTemplate: { templateId: string; name: string; count: number }[];
  trend: { date: string; count: number }[];
  sla: { total: number; breached: number };
  avgConfidence: number | null;
}

const STATUS_COLOR: Record<string, string> = {
  PARSED: "bg-yellow-100 text-yellow-700",
  REVIEWING: "bg-orange-100 text-orange-700",
  APPROVED: "bg-green-100 text-green-700",
  SENT: "bg-emerald-100 text-emerald-700",
  REJECTED: "bg-red-100 text-red-700",
  FAILED: "bg-red-50 text-red-400",
  PROCESSING: "bg-blue-100 text-blue-700",
  PENDING: "bg-gray-100 text-gray-500",
};

function StatCard({ label, value, sub, icon: Icon, color }: { label: string; value: string | number; sub?: string; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-32 text-gray-300 text-sm">No data</div>;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-32">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
          <div className="relative w-full">
            <div
              className="w-full bg-blue-500 rounded-t-sm transition-all hover:bg-blue-600"
              style={{ height: `${Math.max((d.count / max) * 112, 4)}px` }}
            />
            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
              {d.count}
            </div>
          </div>
          {data.length <= 14 && (
            <span className="text-xs text-gray-400 rotate-45 origin-left" style={{ fontSize: "9px" }}>
              {d.date.slice(5)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/analytics?days=${days}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {});
  }, [days]);

  if (!data) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const pending = (data.byStatus.PARSED ?? 0) + (data.byStatus.REVIEWING ?? 0);
  const approved = (data.byStatus.APPROVED ?? 0) + (data.byStatus.SENT ?? 0);
  const slaRate = data.sla.total > 0 ? Math.round((1 - data.sla.breached / data.sla.total) * 100) : null;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <select value={days} onChange={e => setDays(Number(e.target.value))}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Jobs" value={data.total} icon={FileText} color="bg-blue-50 text-blue-600" />
        <StatCard label="Pending Review" value={pending} sub="PARSED + REVIEWING" icon={Clock} color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Approved" value={approved} sub="APPROVED + SENT" icon={CheckCircle} color="bg-green-50 text-green-600" />
        <StatCard
          label="Avg Confidence"
          value={data.avgConfidence != null ? `${Math.round(data.avgConfidence * 100)}%` : "—"}
          icon={TrendingUp}
          color="bg-purple-50 text-purple-600"
        />
      </div>

      {/* SLA */}
      {data.sla.total > 0 && (
        <div className={`rounded-xl border p-4 flex items-center gap-4 ${data.sla.breached > 0 ? "border-red-200 bg-red-50" : "border-green-200 bg-green-50"}`}>
          <AlertTriangle className={`w-5 h-5 ${data.sla.breached > 0 ? "text-red-500" : "text-green-500"}`} />
          <div>
            <p className="text-sm font-semibold text-gray-800">SLA Performance</p>
            <p className="text-xs text-gray-500">
              {data.sla.breached} breached / {data.sla.total} total with SLA
              {slaRate != null && <span className="ml-2 font-medium">{slaRate}% on-time</span>}
            </p>
          </div>
        </div>
      )}

      {/* Trend chart */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <p className="text-sm font-semibold text-gray-800 mb-4">Job Volume Trend</p>
        <TrendChart data={data.trend} />
      </div>

      {/* Status breakdown + Top templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">By Status</p>
          <div className="space-y-2">
            {Object.entries(data.byStatus).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[status] ?? "bg-gray-100 text-gray-500"}`}>{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round((count / data.total) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <p className="text-sm font-semibold text-gray-800 mb-3">Top Templates</p>
          <div className="space-y-2">
            {data.byTemplate.slice(0, 6).map(t => (
              <div key={t.templateId} className="flex items-center justify-between">
                <span className="text-sm text-gray-700 truncate max-w-[160px]">{t.name}</span>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{t.count}</span>
              </div>
            ))}
            {data.byTemplate.length === 0 && <p className="text-sm text-gray-400">No data yet</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
