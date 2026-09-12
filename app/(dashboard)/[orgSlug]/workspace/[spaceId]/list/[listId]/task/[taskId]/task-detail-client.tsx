"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS, type TaskPriority, type TaskStatus } from "@/lib/modules/task";
import { TaskDialog, type MemberOption } from "../../task-dialog";
import { CommentSection, type CommentItem } from "@/components/shared/comment-section";
import { AttachmentSection, type AttachmentItem } from "@/components/shared/attachment-section";
import { CopilotWidget } from "@/components/shared/copilot-widget";

type SubtaskItem = { id: string; title: string; status: string };
type TaskFull = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  startDate: Date | string | null;
  dueDate: Date | string | null;
  isMilestone: boolean;
  subtasks: SubtaskItem[];
};

export function TaskDetailClient({
  orgSlug,
  spaceId,
  list,
  task,
  initialComments,
  initialAttachments,
  members,
  currentUserId,
  canUpdate,
  canAssign,
  canModerateComments,
  canModerateAttachments,
}: {
  orgSlug: string;
  spaceId: string;
  list: { id: string; name: string; folder: { id: string; name: string; space: { id: string; name: string } } };
  task: TaskFull;
  initialComments: CommentItem[];
  initialAttachments: AttachmentItem[];
  members: MemberOption[];
  currentUserId: string;
  canUpdate: boolean;
  canAssign: boolean;
  canModerateComments: boolean;
  canModerateAttachments: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/workspace`} className="hover:underline">
          Workspace
        </Link>
        {" / "}
        <Link href={`/${orgSlug}/workspace/${spaceId}`} className="hover:underline">
          {list.folder.space.name}
        </Link>
        {" / "}
        <Link href={`/${orgSlug}/workspace/${spaceId}/list/${list.id}`} className="hover:underline">
          {list.name}
        </Link>
        {" / "}
        <span className="text-foreground">{task.title}</span>
      </div>

      <div className="rounded-md border border-border bg-background p-5">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-xl font-semibold">{task.title}</h1>
          {canUpdate && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Editar
            </Button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span>Status: {TASK_STATUS_LABELS[task.status as TaskStatus] ?? task.status}</span>
          {task.priority && <span>Prioridade: {TASK_PRIORITY_LABELS[task.priority as TaskPriority] ?? task.priority}</span>}
          <span>Responsável: {task.assignee ? task.assignee.name ?? task.assignee.email : "Sem responsável"}</span>
        </div>
        {task.description && (
          <p className="mt-4 whitespace-pre-wrap text-sm">{task.description}</p>
        )}

        {task.subtasks.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-semibold">Subtarefas</h2>
            <ul className="mt-2 space-y-1">
              {task.subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">{s.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {TASK_STATUS_LABELS[s.status as TaskStatus] ?? s.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <AttachmentSection
        attachableType="Task"
        attachableId={task.id}
        attachments={initialAttachments}
        currentUserId={currentUserId}
        canModerate={canModerateAttachments}
      />

      <CommentSection
        commentableType="Task"
        commentableId={task.id}
        comments={initialComments}
        currentUserId={currentUserId}
        canModerate={canModerateComments}
      />

      {editing && (
        <TaskDialog
          orgSlug={orgSlug}
          spaceId={spaceId}
          listId={list.id}
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            status: task.status,
            priority: task.priority,
            assigneeId: task.assigneeId,
            startDate: task.startDate,
            dueDate: task.dueDate,
            isMilestone: task.isMilestone,
            subtasks: task.subtasks,
          }}
          members={members}
          canAssign={canAssign}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      )}

      <CopilotWidget contextType="Task" contextId={task.id} title={task.title} />
    </div>
  );
}
