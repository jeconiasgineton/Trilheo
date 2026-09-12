import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getTemplateWithFields, listSubmissions, FormError } from "@/lib/modules/forms/service";
import { can } from "@/lib/modules/permissions";
import { TemplateBuilderClient } from "./template-builder-client";

export default async function FormTemplatePage({
  params,
}: {
  params: { orgSlug: string; templateId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const organizationId = session.user.organizationId;

  let template;
  try {
    template = await getTemplateWithFields(organizationId, params.templateId);
  } catch (err) {
    if (err instanceof FormError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const submissions = await listSubmissions(organizationId, params.templateId);

  return (
    <TemplateBuilderClient
      orgSlug={params.orgSlug}
      template={template}
      submissions={submissions}
      canManage={can(session.user.role, "form:manage")}
    />
  );
}
