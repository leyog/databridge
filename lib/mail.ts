import nodemailer from "nodemailer";

export function getMailer() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendInviteEmail({
  to, orgName, inviterName, inviteUrl,
}: {
  to: string; orgName: string; inviterName: string; inviteUrl: string;
}) {
  const mailer = getMailer();
  if (!mailer) {
    console.warn("[mail] SMTP not configured, skipping invite email");
    return false;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
    to,
    subject: `You've been invited to join ${orgName} on DataBridge`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="margin:0 0 8px">You're invited!</h2>
        <p style="color:#555;margin:0 0 24px">
          <strong>${inviterName}</strong> has invited you to join <strong>${orgName}</strong> on DataBridge.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
          Accept Invitation
        </a>
        <p style="color:#999;font-size:12px;margin-top:24px">
          This link expires in 7 days. If you didn't expect this, you can ignore this email.
        </p>
      </div>
    `,
  });
  return true;
}
