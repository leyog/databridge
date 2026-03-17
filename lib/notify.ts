import { getMailer } from "@/lib/mail";
import { prisma } from "@/lib/prisma";

export async function notifyNewJob(orgId: string, jobId: string, fileName: string, templateName: string) {
  const mailer = getMailer();
  if (!mailer) return;

  // Get org admins/owners who have notifications enabled
  const members = await prisma.orgMember.findMany({
    where: { orgId, role: { in: ["OWNER", "ADMIN"] } },
    include: { user: { select: { email: true, name: true } } },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8001";
  const jobUrl = `${appUrl}/app/jobs/${jobId}`;

  for (const m of members) {
    if (!m.user.email) continue;
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: m.user.email,
      subject: `New job ready for review: ${fileName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px">New document ready for review</h2>
          <p style="color:#555;margin:0 0 16px">
            A new job has been parsed and is waiting for your review.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
            <tr><td style="padding:8px 0;color:#999;font-size:13px">File</td><td style="padding:8px 0;font-size:13px;font-weight:600">${fileName}</td></tr>
            <tr><td style="padding:8px 0;color:#999;font-size:13px">Template</td><td style="padding:8px 0;font-size:13px">${templateName}</td></tr>
          </table>
          <a href="${jobUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
            Review Now
          </a>
        </div>
      `,
    }).catch(() => {});
  }
}

export async function notifySlaBreached(orgId: string, jobId: string, fileName: string) {
  const mailer = getMailer();
  if (!mailer) return;

  const members = await prisma.orgMember.findMany({
    where: { orgId, role: { in: ["OWNER", "ADMIN"] } },
    include: { user: { select: { email: true } } },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:8001";

  for (const m of members) {
    if (!m.user.email) continue;
    await mailer.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: m.user.email,
      subject: `⚠️ SLA breached: ${fileName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 8px;color:#dc2626">SLA Deadline Breached</h2>
          <p style="color:#555;margin:0 0 16px">
            The following job has exceeded its SLA deadline and requires immediate attention.
          </p>
          <p style="font-weight:600">${fileName}</p>
          <a href="${appUrl}/app/jobs/${jobId}" style="display:inline-block;background:#dc2626;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px">
            Review Now
          </a>
        </div>
      `,
    }).catch(() => {});
  }
}
