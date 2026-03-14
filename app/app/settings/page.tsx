import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.orgMember.findFirst({
    where: { userId: session.user.id },
    include: { org: { include: { subscription: true } } },
  });
  if (!membership) redirect("/login");

  return (
    <SettingsClient
      user={session.user}
      org={membership.org}
      subscription={membership.org.subscription}
      role={membership.role}
    />
  );
}
