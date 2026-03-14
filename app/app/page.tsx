import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { FileText, TrendingUp, CheckCircle, Clock } from "lucide-react";

export default async function AppDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: { include: { subscription: true } } },
  });
  if (!membership) redirect("/login");

  const orgId = membership.orgId;
  const [totalJobs, pendingReview, sentJobs, recentJobs] = await Promise.all([
    prisma.job.count({ where: { orgId } }),
    prisma.job.count({ where: { orgId, status: { in: ["PARSED", "REVIEWING"] } } }),
    prisma.job.count({ where: { orgId, status: "SENT" } }),
    prisma.job.findMany({
      where: { orgId },
      include: { template: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const plan = membership.org.subscription?.plan ?? "FREE";
  const statusColor: Record<string, string> = {
    PENDING: "bg-gray-100 text-gray-500", PROCESSING: "bg-blue-100 text-blue-600",
    PARSED: "bg-yellow-100 text-yellow-600", REVIEWING: "bg-orange-100 text-orange-600",
    APPROVED: "bg-green-100 text-green-600", REJECTED: "bg-red-100 text-red-600",
    SENT: "bg-emerald-100 text-emerald-600", FAILED: "bg-red-100 text-red-500",
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          Welcome back, {session.user.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-sm text-gray-400 mt-0.5">{membership.org.name} · {plan} plan</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { icon: FileText, label: "Total Jobs", value: totalJobs, color: "text-blue-500", bg: "bg-blue-50" },
          { icon: Clock, label: "Pending Review", value: pendingReview, color: "text-orange-500", bg: "bg-orange-50" },
          { icon: CheckCircle, label: "Sent to System", value: sentJobs, color: "text-green-500", bg: "bg-green-50" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">{label}</span>
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-800">{value}</div>
          </div>
        ))}
      </div>

      {/* Recent Jobs */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Recent Jobs</h2>
          <Link href="/app/jobs" className="text-sm text-blue-600 hover:underline">View all →</Link>
        </div>
        {recentJobs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            No jobs yet. <Link href="/app/jobs/new" className="text-blue-600 hover:underline">Create your first job →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentJobs.map(job => (
              <Link key={job.id} href={`/app/jobs/${job.id}`}
                className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-gray-300 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{job.fileName}</p>
                    <p className="text-xs text-gray-400">{job.template.name}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[job.status]}`}>
                  {job.status}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upgrade banner for free plan */}
      {plan === "FREE" && (
        <div className="mt-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white flex items-center justify-between">
          <div>
            <p className="font-semibold">Upgrade to Professional</p>
            <p className="text-sm text-blue-100 mt-0.5">Unlimited jobs, templates, and webhook integration. 14-day free trial.</p>
          </div>
          <Link href="/app/settings?tab=billing"
            className="bg-white text-blue-600 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-50 shrink-0 ml-4">
            Upgrade →
          </Link>
        </div>
      )}
    </div>
  );
}
