import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, FileText, Clock } from "lucide-react";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) redirect("/login");

  const jobs = await prisma.job.findMany({
    where: { orgId: membership.orgId },
    include: { template: true, createdBy: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-500",
    PROCESSING: "bg-blue-100 text-blue-600",
    PARSED: "bg-yellow-100 text-yellow-600",
    REVIEWING: "bg-orange-100 text-orange-600",
    APPROVED: "bg-green-100 text-green-600",
    REJECTED: "bg-red-100 text-red-600",
    SENT: "bg-emerald-100 text-emerald-600",
    FAILED: "bg-red-100 text-red-500",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-400 mt-0.5">{jobs.length} total</p>
        </div>
        <Link href="/app/jobs/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No jobs yet</p>
          <p className="text-sm mt-1">Upload a file to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["File", "Template", "Status", "Created", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <tr key={job.id} className={`border-t border-gray-50 hover:bg-gray-50 ${i % 2 ? "bg-gray-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-300 shrink-0" />
                      <span className="font-medium text-gray-800 truncate max-w-[200px]">{job.fileName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{job.template.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[job.status]}`}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(job.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/app/jobs/${job.id}`}
                      className="text-blue-600 hover:underline text-xs font-medium">
                      {["PARSED", "REVIEWING"].includes(job.status) ? "Review →" : "View →"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
