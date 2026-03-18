import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      id: "credentials",
      name: "Email & Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return null;

        return { id: user.id, name: user.name, email: user.email, image: user.image };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      // Fallback: resolve id from email if missing (e.g. after OAuth re-login)
      if (!token.id && token.email) {
        const dbUser = await prisma.user.findUnique({ where: { email: token.email }, select: { id: true } });
        if (dbUser) token.id = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) session.user.id = token.id as string;
      return session;
    },
    async signIn({ user, account }) {
      if (!user.email) return false;
      if (account?.provider === "credentials") return true;
      // OAuth: auto-create org if needed
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

export async function createOrgForUser(userId: string, name: string) {
  const slug = `org-${userId.slice(0, 8)}`;
  const existing = await prisma.organization.findUnique({ where: { slug } });
  if (existing) return existing;

  const org = await prisma.organization.create({
    data: {
      name: `${name}'s Organization`,
      slug,
      members: { create: { userId, role: "OWNER" } },
    },
  });
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
