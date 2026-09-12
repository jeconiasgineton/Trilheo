import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listTemplates } from "@/lib/modules/forms/service";
import { can } from "@/lib/modules/permissions";
import { FormsListClient } from "./forms-list-client";

export default async function FormsPage({ params }: { params: { orgSlug: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const templates = await listTemplates(session.user.organizationId);

  return (
    <FormsListClient
      orgSlug={params.orgSlug}
      templates={templates}
      canManage={can(session.user.role, "form:manage")}
    />
  );
}
