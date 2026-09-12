import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getTemplateWithFields, FormError } from "@/lib/modules/forms/service";
import { FillFormClient } from "./fill-form-client";

export default async function FillFormPage({
  params,
}: {
  params: { orgSlug: string; templateId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let template;
  try {
    template = await getTemplateWithFields(session.user.organizationId, params.templateId);
  } catch (err) {
    if (err instanceof FormError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return <FillFormClient orgSlug={params.orgSlug} template={template} />;
}
