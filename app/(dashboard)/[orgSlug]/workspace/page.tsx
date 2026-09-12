import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listWorkspaces, listSpaces } from "@/lib/modules/workspace";
import { can } from "@/lib/modules/permissions";
import { WorkspaceListClient } from "./workspace-list-client";

export default async function WorkspacePage({
  params,
}: {
  params: { orgSlug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const workspaces = await listWorkspaces(session.user.organizationId);
  const spacesByWorkspace = await Promise.all(
    workspaces.map((w) => listSpaces(session.user.organizationId, w.id)),
  );

  const workspacesWithSpaces = workspaces.map((w, i) => ({
    ...w,
    spaces: spacesByWorkspace[i],
  }));

  return (
    <WorkspaceListClient
      orgSlug={params.orgSlug}
      role={session.user.role}
      workspaces={workspacesWithSpaces}
      canCreateWorkspace={can(session.user.role, "workspace:create")}
    />
  );
}
