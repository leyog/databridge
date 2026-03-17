import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TemplateForm from "@/components/TemplateForm";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const membership = await prisma.orgMember.findFirst({ where: { userId: session.user.id } });
  if (!membership) redirect("/login");

  const template = await prisma.template.findFirst({
    where: { id, orgId: membership.orgId },
  });
  if (!template) redirect("/app/templates");

  return (
    <TemplateForm
      mode="edit"
      initialData={{
        id: template.id,
        name: template.name,
        description: template.description ?? "",
        prompt: template.prompt,
        outputSchema: JSON.stringify(template.outputSchema, null, 2),
        webhookUrl: template.webhookUrl ?? "",
        webhookHeaders: template.webhookHeaders ? JSON.stringify(template.webhookHeaders, null, 2) : "",
        webhookFormat: template.webhookFormat ?? "raw",
      }}
    />
  );
}
