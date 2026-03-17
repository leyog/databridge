/**
 * Creates a test API key and prints it to stdout.
 * Usage: npx tsx scripts/setup-test-key.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) { console.error("No org found"); process.exit(1); }

  const raw = `db_live_${crypto.randomBytes(16).toString("hex")}`;
  const hash = await bcrypt.hash(raw, 10);
  const prefix = raw.slice(0, 12);

  await prisma.apiKey.create({
    data: { orgId: org.id, name: "e2e-test", keyHash: hash, keyPrefix: prefix, active: true },
  });

  console.log(raw);
}

main().finally(() => prisma.$disconnect());
