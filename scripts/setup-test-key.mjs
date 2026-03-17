/**
 * Creates a test API key using bcryptjs + direct pg query
 * Usage: DATABASE_URL=... node scripts/setup-test-key.mjs
 */
import crypto from "crypto";
import pg from "pg";

// bcryptjs pure-JS implementation (no native deps)
const { hashSync } = await import("bcryptjs");

const DB_URL = process.env.DATABASE_URL ?? "postgresql://databridge:databridge123@localhost:5432/databridge";
const client = new pg.Client({ connectionString: DB_URL });
await client.connect();

const { rows } = await client.query('SELECT id FROM "Organization" LIMIT 1');
if (!rows.length) { console.error("No org found"); process.exit(1); }
const orgId = rows[0].id;

const raw = `db_live_${crypto.randomBytes(16).toString("hex")}`;
const hash = hashSync(raw, 10);
const prefix = raw.slice(0, 12);
const id = crypto.randomUUID();

await client.query(
  `INSERT INTO "ApiKey" (id, "orgId", name, "keyHash", "keyPrefix", active, "createdAt")
   VALUES ($1, $2, $3, $4, $5, true, NOW())`,
  [id, orgId, "e2e-test", hash, prefix]
);

await client.end();
console.log(raw);
