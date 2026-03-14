import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Plus, FileCode } from "lucide-react";

export default async function TemplatesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) redirect("/login");

  const templates = await prisma.template.findMany({
    where: { orgId: membership.orgId },
    include: { _count: { select: { jobs: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Templates</h1>
          <p className="text-sm text-gray-400 mt-0.5">{templates.length} templates</p>
        </div>
        <Link href="/app/templates/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FileCode className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium">No templates yet</p>
          <p className="text-sm mt-1">Create a template to start parsing files</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => (
            <Link key={t.id} href={`/app/templates/${t.id}`}
              className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow hover:border-blue-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center">
                  <FileCode className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-xs text-gray-400">{t._count.jobs} jobs</span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{t.name}</h3>
              {t.description && <p className="text-sm text-gray-400 line-clamp-2">{t.description}</p>}
              {t.webhookUrl && (
                <div className="mt-3 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-xs text-gray-400 truncate">Webhook configured</span>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
