import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "@/lib/prisma";
import { parseJobAsync } from "@/lib/parse-job";

export async function syncEmailAccount(accountId: string) {
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
    include: { template: true },
  });
  if (!account || !account.active) return { synced: 0, error: null };

  const client = new ImapFlow({
    host: account.imapHost,
    port: account.imapPort,
    secure: account.imapSecure,
    auth: { user: account.username, pass: account.password },
    logger: false,
  });

  let synced = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Fetch messages newer than lastUid
      const since = account.lastSyncAt
        ? new Date(account.lastSyncAt.getTime() - 60 * 1000) // 1 min overlap
        : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);   // first sync: last 7 days

      const messages: any[] = [];
      for await (const msg of client.fetch(
        { since },
        { uid: true, envelope: true, source: true }
      )) {
        messages.push(msg);
      }

      for (const msg of messages) {
        // Skip already processed UIDs
        if (msg.uid <= account.lastUid) continue;

        const parsed = await simpleParser(msg.source);
        const subject = parsed.subject ?? "(no subject)";
        const from = parsed.from?.text ?? "";
        const textContent = parsed.text ?? parsed.html ?? "";
        const attachments = parsed.attachments ?? [];

        // Determine template
        const templateId = account.templateId;
        if (!templateId) continue;

        const template = await prisma.template.findFirst({
          where: { id: templateId, orgId: account.orgId },
        });
        if (!template) continue;

        // Find org owner for createdById
        const owner = await prisma.orgMember.findFirst({
          where: { orgId: account.orgId, role: "OWNER" },
          select: { userId: true },
        });

        // Build content: email body + attachment text
        let fileContent = `From: ${from}\nSubject: ${subject}\n\n${textContent}`;
        let fileName = `email_${subject.slice(0, 40).replace(/[^a-z0-9]/gi, "_")}.txt`;
        let fileType = "text/plain";

        // If there's a primary attachment, use it instead
        const mainAttachment = attachments.find(a =>
          a.contentType.includes("pdf") ||
          a.contentType.includes("spreadsheet") ||
          a.contentType.includes("excel") ||
          a.contentType.includes("csv") ||
          a.contentType.includes("word")
        );

        if (mainAttachment) {
          fileName = mainAttachment.filename ?? fileName;
          fileType = mainAttachment.contentType;
          // For binary attachments, store as base64 in extractedText and let parse-job handle it
          fileContent = mainAttachment.content.toString("utf-8").slice(0, 50000);
        }

        const job = await prisma.job.create({
          data: {
            orgId: account.orgId,
            templateId,
            createdById: owner?.userId ?? "system",
            status: "PROCESSING",
            fileName,
            fileUrl: "",
            fileType,
            fileSize: fileContent.length,
            extractedText: fileContent,
          },
        });

        parseJobAsync(job.id, fileContent, template).catch(() => {});
        synced++;

        // Track highest UID
        if (msg.uid > account.lastUid) {
          await prisma.emailAccount.update({
            where: { id: accountId },
            data: { lastUid: msg.uid },
          });
        }
      }
    } finally {
      lock.release();
    }

    await prisma.emailAccount.update({
      where: { id: accountId },
      data: { lastSyncAt: new Date() },
    });

    return { synced, error: null };
  } catch (e: any) {
    return { synced: 0, error: e.message };
  } finally {
    await client.logout().catch(() => {});
  }
}

export async function testEmailConnection(config: {
  imapHost: string; imapPort: number; imapSecure: boolean;
  username: string; password: string;
}) {
  const client = new ImapFlow({
    host: config.imapHost,
    port: config.imapPort,
    secure: config.imapSecure,
    auth: { user: config.username, pass: config.password },
    logger: false,
  });
  try {
    await client.connect();
    const status = await client.status("INBOX", { messages: true });
    await client.logout();
    return { ok: true, messageCount: status.messages };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
