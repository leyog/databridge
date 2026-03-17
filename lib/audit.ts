import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "job.create" | "job.approve" | "job.reject" | "job.reopen" | "job.send"
  | "job.assign" | "job.save" | "job.delete"
  | "template.create" | "template.update" | "template.delete"
  | "member.invite" | "member.remove" | "member.role_change"
  | "apikey.create" | "apikey.delete"
  | "ai_config.update" | "ai_config.delete"
  | "email_account.create" | "email_account.delete";

export async function audit({
  orgId, userId, action, entityType, entityId, meta, ip,
}: {
  orgId: string;
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  meta?: Record<string, any>;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: { orgId, userId: userId ?? null, action, entityType, entityId, meta: meta ? (meta as any) : undefined, ip: ip ?? null },
    });
  } catch {
    // audit log failure should never break the main flow
  }
}
