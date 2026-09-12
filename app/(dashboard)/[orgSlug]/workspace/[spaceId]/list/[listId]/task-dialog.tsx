"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/modules/task";
import {
  createTaskAction,
  deleteTaskAction,
  updateTaskAction,
} from "@/lib/modules/task/actions";

export type MemberOption = { id: string; name: string | null; email: string };

export type TaskDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  startDate?: string | Date | null;
  dueDate?: string | Date | null;
  isMilestone?: boolean;
  subtasks?: { id: string; title: string; status: string }[];
};

/** yyyy-MM-dd para o <input type="date"> a partir de string ISO ou Date. */
function toDateInputValue(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function TaskDialog({
  orgSlug,
  spaceId,
  listId,
  task,
  members,
  canAssign,
  onClose,
  onSaved,
  showDetailLink,
}: {
  orgSlug: string;
  spaceId: string;
  listId: string;
  task: TaskDetail | null;
  members: MemberOption[];
  canAssign: boolean;
  onClose: () => void;
  onSaved: () => void;
  showDetailLink?: boolean;
}) {
  const isEdit = !!task;
  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? TASK_STATUSES[0]);
  const [priority, setPriority] = useState(task?.priority ?? "");
  const [assigneeId, setAssigneeId] = useState(task?.assigneeId ?? "");
  const [startDate, setStartDate] = useState(toDateInputValue(task?.startDate));
  const [dueDate, setDueDate] = useState(toDateInputValue(task?.dueDate));
  const [isMilestone, setIsMilestone] = useState(task?.isMilestone ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState("");

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const result = isEdit
      ? await updateTaskAction({
          id: task!.id,
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority: priority || null,
          startDate: startDate ? new Date(startDate).toISOString() : null,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          isMilestone,
          ...(canAssign && { assigneeId: assigneeId || null }),
        })
      : await createTaskAction({
          listId,
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          priority: priority || undefined,
          startDate: startDate ? new Date(startDate).toISOString() : undefined,
          dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          isMilestone,
          ...(canAssign && assigneeId && { assigneeId }),
        });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  async function addSubtask() {
    if (!newSubtask.trim() || !task) return;
    const result = await createTaskAction({
      listId,
      parentTaskId: task.id,
      title: newSubtask.trim(),
      status: TASK_STATUSES[0],
    });
    if (result.ok) {
      setNewSubtask("");
      onSaved();
    } else {
      setError(result.error);
    }
  }

  async function removeSubtask(id: string) {
    const result = await deleteTaskAction(id);
    if (result.ok) onSaved();
    else setError(result.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg bg-background p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">{isEdit ? "Editar task" : "Nova task"}</h3>
          {isEdit && showDetailLink && (
            <Link
              href={`/${orgSlug}/workspace/${spaceId}/list/${listId}/task/${task!.id}`}
              className="text-xs text-primary hover:underline"
            >
              Ver detalhes & comentários ↗
            </Link>
          )}
        </div>

        {error && (
          <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="task-title">Título</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="task-desc">Descrição</Label>
            <Textarea
              id="task-desc"
              value={description ?? ""}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="task-status">Status</Label>
              <Select id="task-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-priority">Prioridade</Label>
              <Select id="task-priority" value={priority ?? ""} onChange={(e) => setPriority(e.target.value)}>
                <option value="">Sem prioridade</option>
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {TASK_PRIORITY_LABELS[p]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="task-start">Data início</Label>
              <Input
                id="task-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="task-due">Data fim</Label>
              <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isMilestone}
              onChange={(e) => setIsMilestone(e.target.checked)}
            />
            Marco (Gantt)
          </label>
          <div className="space-y-1">
            <Label htmlFor="task-assignee">Responsável</Label>
            <Select
              id="task-assignee"
              value={assigneeId ?? ""}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={!canAssign}
            >
              <option value="">Sem responsável</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name ?? m.email}
                </option>
              ))}
            </Select>
          </div>

          {isEdit && (
            <div className="space-y-1">
              <Label>Subtarefas</Label>
              <ul className="space-y-1">
                {task!.subtasks?.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-sm">
                    <span className="flex-1">{s.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {TASK_STATUS_LABELS[s.status as keyof typeof TASK_STATUS_LABELS] ?? s.status}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => removeSubtask(s.id)}
                    >
                      Excluir
                    </button>
                  </li>
                ))}
                {(!task!.subtasks || task!.subtasks.length === 0) && (
                  <li className="text-xs text-muted-foreground">Sem subtarefas.</li>
                )}
              </ul>
              <div className="mt-1 flex items-center gap-2">
                <Input
                  placeholder="Nova subtarefa"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline" onClick={addSubtask}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
