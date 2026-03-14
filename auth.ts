import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true, // auto-link existing accounts
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
    async signIn({ user, account }) {
      if (!user.email) return false;
      // Auto-create org for new users
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        include: { memberships: true },
      });
      if (existing && existing.memberships.length === 0) {
        await createOrgForUser(existing.id, existing.name ?? existing.email!);
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      // New user created — create their org
      if (user.id && user.email) {
        await createOrgForUser(user.id, user.name ?? user.email);
      }
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

async function createOrgForUser(userId: string, name: string) {
  const slug = `org-${userId.slice(0, 8)}`;
  const org = await prisma.organization.create({
    data: {
      name: `${name}'s Organization`,
      slug,
      members: { create: { userId, role: "OWNER" } },
    },
  });
  // Create free subscription
  await prisma.subscription.create({
    data: {
      orgId: org.id,
      stripeCustomerId: `pending_${org.id}`,
      plan: "FREE",
      status: "ACTIVE",
    },
  });
  return org;
}
