/**
 * DataBridge E2E smoke test
 * Usage: API_KEY=db_live_xxx node scripts/test-e2e.mjs
 */

const BASE = "http://localhost:8001";
const apiKey = process.env.API_KEY;
if (!apiKey) { console.error("Usage: API_KEY=db_live_xxx node scripts/test-e2e.mjs"); process.exit(1); }

const log = (tag, msg, data) => {
  const icon = { PASS: "✅", FAIL: "❌", SKIP: "⏭️", INFO: "🔹" }[tag] ?? "🔹";
  const extra = data !== undefined ? " " + JSON.stringify(data) : "";
  console.log(`${icon} [${tag}] ${msg}${extra}`);
};

async function req(method, path, body) {
  const headers = { Authorization: `Bearer ${apiKey}` };
  let bodyData;
  if (body) { headers["Content-Type"] = "application/json"; bodyData = JSON.stringify(body); }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: bodyData });
  const ct = res.headers.get("content-type") ?? "";
  const text = await res.text().catch(() => "");
  const data = ct.includes("json") ? JSON.parse(text) : text;
  return { ok: res.ok, status: res.status, data };
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function testAuth() {
  console.log("\n── Auth ──────────────────────────────────────────────");
  const r = await req("GET", "/api/jobs?limit=1");
  if (r.ok) log("PASS", "API key auth working");
  else { log("FAIL", "API key rejected", r.data); process.exit(1); }
}

async function testTemplates() {
  console.log("\n── Templates ─────────────────────────────────────────");

  // Create
  const t = await req("POST", "/api/templates", {
    name: "Invoice Parser",
    description: "Extract invoice fields",
    prompt: "Extract: invoice_number, date, vendor, total (number).",
    outputSchema: { type: "object", properties: {
      invoice_number: { type: "string" },
      date: { type: "string" },
      vendor: { type: "string" },
      total: { type: "number" },
    }},
    webhookUrl: null,
  });
  if (t.ok) log("PASS", "Create template", { id: t.data.id });
  else { log("FAIL", "Create template", t.data); return null; }

  // List
  const list = await req("GET", "/api/templates");
  log(list.ok ? "PASS" : "FAIL", "List templates", { count: Array.isArray(list.data) ? list.data.length : "?" });

  return t.data;
}

async function testJobCreation(templateId) {
  console.log("\n── Job Creation ──────────────────────────────────────");

  const cases = [
    { label: "Normal invoice",
      body: { templateId, fileName: "invoice_001.txt", fileType: "text/plain", fileSize: 120, fileUrl: "",
        fileContent: "INVOICE #INV-2024-001\nDate: 2024-03-15\nVendor: Acme Corp\nTotal: $700.00" }},
    { label: "CSV expenses",
      body: { templateId, fileName: "expenses.csv", fileType: "text/csv", fileSize: 80, fileUrl: "",
        fileContent: "date,vendor,amount\n2024-03-01,AWS,1200.00\n2024-03-05,GitHub,50.00" }},
    { label: "Sparse / ambiguous",
      body: { templateId, fileName: "note.txt", fileType: "text/plain", fileSize: 30, fileUrl: "",
        fileContent: "Invoice from Bob. Amount: $42." }},
    { label: "Empty content (edge case)",
      body: { templateId, fileName: "empty.txt", fileType: "text/plain", fileSize: 1, fileUrl: "",
        fileContent: " " }},
    { label: "Wrong content (recipe)",
      body: { templateId, fileName: "recipe.txt", fileType: "text/plain", fileSize: 80, fileUrl: "",
        fileContent: "Chocolate Cake: 2 cups flour, 1 cup sugar, 3 eggs. Bake at 350F for 30 min." }},
    { label: "Batch (2 jobs)",
      body: { templateId, jobs: [
        { fileName: "batch_a.txt", fileContent: "Invoice #B001, Vendor: Beta LLC, Total: $300", fileType: "text/plain", fileSize: 50, fileUrl: "" },
        { fileName: "batch_b.txt", fileContent: "Invoice #B002, Vendor: Gamma Inc, Date: 2024-04-01, Total: $1500", fileType: "text/plain", fileSize: 60, fileUrl: "" },
      ]}},
  ];

  const ids = [];
  for (const c of cases) {
    const r = await req("POST", "/api/jobs", c.body);
    if (r.ok) {
      const created = Array.isArray(r.data) ? r.data : r.data?.jobs ? r.data.jobs : [r.data];
      created.forEach(j => j?.id && ids.push(j.id));
      log("PASS", c.label, { ids: created.map(j => j?.id?.slice(-6)), statuses: created.map(j => j?.status) });
    } else {
      log("FAIL", c.label, r.data);
    }
  }
  return ids;
}

async function pollJobs(jobIds) {
  console.log("\n── Polling ───────────────────────────────────────────");
  const pending = new Set(jobIds);
  const results = {};
  const deadline = Date.now() + 50000;

  while (pending.size > 0 && Date.now() < deadline) {
    for (const id of [...pending]) {
      const r = await req("GET", `/api/jobs/${id}`);
      if (!r.ok) continue;
      const { status, confidence, parsedData, errorMessage } = r.data;
      if (!["PENDING", "PROCESSING"].includes(status)) {
        pending.delete(id);
        results[id] = r.data;
        log(status === "PARSED" ? "PASS" : "FAIL",
          `Job ${id.slice(-6)} → ${status}`,
          { conf: confidence != null ? (confidence * 100).toFixed(0) + "%" : null,
            fields: parsedData ? Object.keys(parsedData) : null,
            error: errorMessage });
      }
    }
    if (pending.size > 0) await new Promise(r => setTimeout(r, 2500));
  }
  for (const id of pending) log("SKIP", `Job ${id.slice(-6)} still processing after timeout`);
  return results;
}

async function testApproveRejectSend(results) {
  console.log("\n── Approve / Reject / Save / Send ───────────────────");
  const parsed = Object.entries(results).filter(([, v]) => v.status === "PARSED");
  if (!parsed.length) { log("SKIP", "No PARSED jobs to test"); return; }

  // Approve first → no webhook → should stay APPROVED
  const [id1] = parsed[0];
  const a = await req("PATCH", `/api/jobs/${id1}`, { action: "approve", reviewNote: "auto-test" });
  log(a.ok ? "PASS" : "FAIL", `Approve ${id1.slice(-6)}`,
    { status: a.data.status, webhookStatus: a.data.webhookStatus });

  // Manual send on APPROVED (no webhook configured → should return 400 or stay APPROVED)
  if (a.ok && a.data.status === "APPROVED") {
    const s = await req("PATCH", `/api/jobs/${id1}`, { action: "send" });
    const expected = s.status === 400 || s.data?.status === "APPROVED";
    log(expected ? "PASS" : "FAIL", `Manual send (no webhook) ${id1.slice(-6)}`,
      { status: s.data?.status, error: s.data?.error });
  }

  // Reject second
  if (parsed.length > 1) {
    const [id2] = parsed[1];
    const r = await req("PATCH", `/api/jobs/${id2}`, { action: "reject", reviewNote: "auto-reject" });
    log(r.ok ? "PASS" : "FAIL", `Reject ${id2.slice(-6)}`, { status: r.data.status });
  }

  // Save/edit third
  if (parsed.length > 2) {
    const [id3, job3] = parsed[2];
    const edited = { ...(job3.parsedData ?? {}), vendor: "Edited Vendor" };
    const sv = await req("PATCH", `/api/jobs/${id3}`, { action: "save", reviewedData: edited });
    log(sv.ok ? "PASS" : "FAIL", `Save/edit ${id3.slice(-6)}`, { status: sv.data.status });
  }
}

async function testExport(templateId) {
  console.log("\n── Export ────────────────────────────────────────────");
  for (const fmt of ["json", "csv"]) {
    const r = await req("GET", `/api/jobs/export?format=${fmt}&templateId=${templateId}`);
    const size = typeof r.data === "string" ? r.data.length : JSON.stringify(r.data ?? "").length;
    log(r.ok ? "PASS" : "FAIL", `Export ${fmt.toUpperCase()}`, { bytes: size });
  }
}

async function testAiConfig() {
  console.log("\n── AI Config ─────────────────────────────────────────");

  // GET (should be null initially)
  const get = await req("GET", "/api/ai-config");
  log(get.ok ? "PASS" : "FAIL", "GET ai-config", get.data ?? "null");

  // POST fake key
  const set = await req("POST", "/api/ai-config", { provider: "anthropic", apiKey: "sk-fake-test-key-12345", baseUrl: "", model: "claude-haiku-4-5" });
  log(set.ok ? "PASS" : "FAIL", "POST ai-config", set.data);

  // Verify masked
  const verify = await req("GET", "/api/ai-config");
  const masked = verify.data?.apiKeyMasked?.includes("••");
  log(masked ? "PASS" : "FAIL", "Key masked correctly", verify.data);

  // DELETE
  const del = await req("DELETE", "/api/ai-config");
  log(del.ok ? "PASS" : "FAIL", "DELETE ai-config", del.data);

  // Confirm deleted
  const after = await req("GET", "/api/ai-config");
  log(after.data === null ? "PASS" : "FAIL", "Config cleared after delete", after.data);
}

async function testJobsList() {
  console.log("\n── Jobs List & Filter ────────────────────────────────");
  const all = await req("GET", "/api/jobs?limit=50");
  if (all.ok) {
    const jobs = Array.isArray(all.data) ? all.data : all.data?.jobs ?? [];
    const byStatus = jobs.reduce((acc, j) => { acc[j.status] = (acc[j.status] ?? 0) + 1; return acc; }, {});
    log("PASS", "List all jobs", { total: jobs.length, byStatus });
  } else {
    log("FAIL", "List jobs", all.data);
  }

  const filtered = await req("GET", "/api/jobs?status=APPROVED&limit=10");
  log(filtered.ok ? "PASS" : "FAIL", "Filter by status=APPROVED",
    { count: Array.isArray(filtered.data) ? filtered.data.length : "?" });
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 DataBridge E2E Test Suite");
  console.log(`   Target: ${BASE}`);
  console.log(`   Time:   ${new Date().toISOString()}`);

  await testAuth();
  const template = await testTemplates();
  if (!template) process.exit(1);

  const jobIds = await testJobCreation(template.id);
  const results = await pollJobs(jobIds);
  await testApproveRejectSend(results);
  await testExport(template.id);
  await testAiConfig();
  await testJobsList();

  console.log("\n── Summary ───────────────────────────────────────────");
  const vals = Object.values(results);
  console.log(`   Jobs created : ${jobIds.length}`);
  console.log(`   PARSED       : ${vals.filter(j => j.status === "PARSED").length}`);
  console.log(`   FAILED       : ${vals.filter(j => j.status === "FAILED").length}`);
  console.log(`   Other        : ${vals.filter(j => !["PARSED","FAILED"].includes(j.status)).length}`);
  console.log("\nDone.\n");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
