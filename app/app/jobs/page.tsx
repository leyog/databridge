import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import JobsListClient from "./JobsListClient";

export default async function JobsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) redirect("/login");

  const [jobs, members] = await Promise.all([
    prisma.job.findMany({
      where: { orgId: membership.orgId },
      select: {
        id: true, fileName: true, status: true, createdAt: true,
        confidence: true, slaDeadline: true, slaBreached: true,
        template: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.orgMember.findMany({
      where: { orgId: membership.orgId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return (
    <JobsListClient
      initialJobs={jobs.map(j => ({ ...j, createdAt: j.createdAt.toISOString(), slaDeadline: j.slaDeadline?.toISOString() ?? null }))}
      members={members.map(m => ({ id: m.user.id, name: m.user.name, email: m.user.email }))}
      currentUserId={session.user.id}
    />
  );
}
