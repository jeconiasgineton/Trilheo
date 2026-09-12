import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { getSpaceWithFolders, WorkspaceError } from "@/lib/modules/workspace";
import { can } from "@/lib/modules/permissions";
import { SpaceDetailClient } from "./space-detail-client";

export default async function SpacePage({
  params,
}: {
  params: { orgSlug: string; spaceId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let space;
  try {
    space = await getSpaceWithFolders(session.user.organizationId, params.spaceId);
  } catch (err) {
    if (err instanceof WorkspaceError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return (
    <SpaceDetailClient
      orgSlug={params.orgSlug}
      space={space}
      canCreateFolder={can(session.user.role, "folder:create")}
      canCreateList={can(session.user.role, "list:create")}
    />
  );
}
