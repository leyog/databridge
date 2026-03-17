import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AppSidebar from "@/components/layout/AppSidebar";
import ChatWidget from "@/components/ChatWidget";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: { include: { subscription: true } } },
  });

  if (!membership) redirect("/login");

  return (
    <div className="flex h-screen bg-gray-50">
      <AppSidebar org={membership.org} user={session.user} />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      <ChatWidget />
    </div>
  );
}
