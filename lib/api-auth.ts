import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

export type ApiAuthResult =
  | { ok: true; orgId: string; keyId: string }
  | { ok: false; error: string; status: number };

export async function verifyApiKey(req: NextRequest): Promise<ApiAuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing Authorization header", status: 401 };
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey.startsWith("db_live_")) {
    return { ok: false, error: "Invalid API key format", status: 401 };
  }

  // Find by prefix (narrows candidates before bcrypt)
  const prefix = rawKey.slice(0, 12);
  const candidates = await prisma.apiKey.findMany({
    where: { keyPrefix: prefix, active: true },
  });

  for (const candidate of candidates) {
    if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
    const match = await bcrypt.compare(rawKey, candidate.keyHash);
    if (match) {
      // Update lastUsedAt async
      prisma.apiKey.update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
      return { ok: true, orgId: candidate.orgId, keyId: candidate.id };
    }
  }

  return { ok: false, error: "Invalid or expired API key", status: 401 };
}
