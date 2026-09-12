import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import { authOptions } from "@/lib/modules/auth";
import { listOrganizationMembers } from "@/lib/modules/auth/service";
import { getListSummary, WorkspaceError } from "@/lib/modules/workspace";
import { getTaskWithDetails, TaskError } from "@/lib/modules/task";
import { listComments } from "@/lib/modules/comment/service";
import { listAttachments } from "@/lib/modules/attachment/service";
import { can } from "@/lib/modules/permissions";
import { TaskDetailClient } from "./task-detail-client";

export default async function TaskDetailPage({
  params,
}: {
  params: { orgSlug: string; spaceId: string; listId: string; taskId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const organizationId = session.user.organizationId;

  let task;
  let list;
  try {
    [task, list] = await Promise.all([
      getTaskWithDetails(organizationId, params.taskId),
      getListSummary(organizationId, params.listId),
    ]);
  } catch (err) {
    if (
      (err instanceof TaskError || err instanceof WorkspaceError) &&
      err.code === "NOT_FOUND"
    ) {
      notFound();
    }
    throw err;
  }

  const [comments, attachments, members] = await Promise.all([
    listComments(organizationId, "Task", params.taskId),
    listAttachments(organizationId, "Task", params.taskId),
    listOrganizationMembers(organizationId),
  ]);

  return (
    <TaskDetailClient
      orgSlug={params.orgSlug}
      spaceId={params.spaceId}
      list={list}
      task={task}
      initialComments={comments}
      initialAttachments={attachments}
      members={members.map((m) => m.user)}
      currentUserId={session.user.id}
      canUpdate={can(session.user.role, "task:update")}
      canAssign={can(session.user.role, "task:assign")}
      canModerateComments={can(session.user.role, "comment:delete")}
      canModerateAttachments={can(session.user.role, "attachment:delete")}
    />
  );
}
