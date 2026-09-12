import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listOrganizationMembers } from "@/lib/modules/auth/service";
import { getListSummary, WorkspaceError } from "@/lib/modules/workspace";
import { listTasksByStatus } from "@/lib/modules/task";
import { can } from "@/lib/modules/permissions";
import { TaskBoardClient } from "./task-board-client";

export default async function ListBoardPage({
  params,
}: {
  params: { orgSlug: string; spaceId: string; listId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  let list;
  try {
    list = await getListSummary(session.user.organizationId, params.listId);
  } catch (err) {
    if (err instanceof WorkspaceError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  const [tasks, members] = await Promise.all([
    listTasksByStatus(session.user.organizationId, params.listId),
    listOrganizationMembers(session.user.organizationId),
  ]);

  return (
    <TaskBoardClient
      orgSlug={params.orgSlug}
      spaceId={params.spaceId}
      list={list}
      initialTasks={tasks}
      members={members.map((m) => m.user)}
      currentUserId={session.user.id}
      canCreate={can(session.user.role, "task:create")}
      canDelete={can(session.user.role, "task:delete")}
      canAssign={can(session.user.role, "task:assign")}
    />
  );
}
