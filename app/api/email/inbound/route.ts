import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

// Inbound email webhook — compatible with SendGrid, Postmark, Mailgun
// POST /api/email/inbound
// Parses the email, finds matching inbox, creates a job

export async function POST(req: NextRequest) {
  // Verify shared secret to prevent abuse
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (secret) {
    const sig = req.headers.get("x-webhook-secret") ?? req.headers.get("x-sendgrid-signature");
    if (sig !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    body = await req.json();
  } else {
    // multipart/form-data (SendGrid, Mailgun)
    const fd = await req.formData();
    body = Object.fromEntries(fd.entries());
  }

  // Normalize across providers
  const to: string = body.to ?? body.To ?? body.recipient ?? "";
  const from: string = body.from ?? body.From ?? body.sender ?? "";
  const subject: string = body.subject ?? body.Subject ?? "";
  const text: string = body.text ?? body.Text ?? body["body-plain"] ?? "";
  const html: string = body.html ?? body.Html ?? body["body-html"] ?? "";

  if (!to) return NextResponse.json({ error: "Missing 'to' field" }, { status: 400 });

  // Extract address (handle "Name <addr>" format)
  const toAddr = to.match(/<([^>]+)>/)?.[1] ?? to.trim().toLowerCase();

  const inbox = await prisma.emailInbox.findFirst({
    where: { address: toAddr, active: true },
    include: { template: true },
  });

  if (!inbox) {
    // Silently accept — don't expose which addresses exist
    return NextResponse.json({ ok: true, message: "No matching inbox" });
  }

  // Build file content from email
  const content = [
    `From: ${from}`,
    `Subject: ${subject}`,
    `---`,
    text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
  ].join("\n");

  const fileName = `email-${Date.now()}.txt`;

  // Find org owner to use as createdById
  const owner = await prisma.orgMember.findFirst({
    where: { orgId: inbox.orgId, role: "OWNER" },
    select: { userId: true },
  });
  if (!owner) return NextResponse.json({ error: "Org has no owner" }, { status: 500 });

  const job = await prisma.job.create({
    data: {
      orgId: inbox.orgId,
      templateId: inbox.templateId,
      createdById: owner.userId,
      status: "PROCESSING",
      fileName,
      fileUrl: "",
      fileType: "text/plain",
      fileSize: content.length,
    },
  });

  // Parse async
  const { parseJobAsync } = await import("@/lib/parse-job");
  parseJobAsync(job.id, content, inbox.template).catch(() => {});

  return NextResponse.json({ ok: true, jobId: job.id });
}
