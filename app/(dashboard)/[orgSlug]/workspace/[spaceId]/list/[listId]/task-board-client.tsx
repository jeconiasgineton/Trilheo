"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/modules/task";
import {
  deleteTaskAction,
  getTaskDetailAction,
  moveTaskAction,
  reorderTasksAction,
} from "@/lib/modules/task/actions";
import { TaskKanban, type TaskItem } from "./task-kanban";
import { TaskDialog, type MemberOption, type TaskDetail } from "./task-dialog";
import { GanttChart } from "./gantt-chart";

type ListSummary = {
  id: string;
  name: string;
  folder: { id: string; name: string; space: { id: string; name: string } };
};

export function TaskBoardClient({
  orgSlug,
  spaceId,
  list,
  initialTasks,
  members,
  currentUserId,
  canCreate,
  canDelete,
  canAssign,
}: {
  orgSlug: string;
  spaceId: string;
  list: ListSummary;
  initialTasks: TaskItem[];
  members: MemberOption[];
  currentUserId: string;
  canCreate: boolean;
  canDelete: boolean;
  canAssign: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<"kanban" | "list" | "gantt">("kanban");
  const [tasks, setTasks] = useState(initialTasks);
  const [editing, setEditing] = useState<TaskDetail | null | "new">(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  function refresh() {
    router.refresh();
    setEditing(null);
  }

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else setError(null);
  }

  async function handleMove(taskId: string, targetStatus: string) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t)));
    const result = await moveTaskAction({ id: taskId, status: targetStatus });
    report(result);
    router.refresh();
  }

  async function handleEditTask(task: TaskItem) {
    const result = await getTaskDetailAction(task.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing({
      id: result.data.id,
      title: result.data.title,
      description: result.data.description,
      status: result.data.status,
      priority: result.data.priority,
      assigneeId: result.data.assigneeId,
      startDate: result.data.startDate,
      dueDate: result.data.dueDate,
      isMilestone: result.data.isMilestone,
      subtasks: result.data.subtasks.map((s) => ({ id: s.id, title: s.title, status: s.status })),
    });
  }

  async function handleDelete(taskId: string) {
    const result = await deleteTaskAction(taskId);
    report(result);
    if (result.ok) router.refresh();
  }

  const filtersActive = !!(statusFilter || priorityFilter || assigneeFilter);

  /**
   * Reorder sempre manda o conjunto COMPLETO de ids da lista para o
   * service (ele agora valida isso — ver auditoria Fase 1, seção 9).
   * Com filtro ativo, `filteredTasks` é só um subconjunto, então a
   * UI desabilita as setas nesse caso (ver botões abaixo) em vez de
   * inventar um reorder parcial sem significado bem definido.
   */
  function moveInList(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= tasks.length) return;
    const ids = tasks.map((t) => t.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderTasksAction({ listId: list.id, orderedIds: ids }).then(report).then(() => router.refresh());
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter && t.status !== statusFilter) return false;
      if (priorityFilter && t.priority !== priorityFilter) return false;
      if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, priorityFilter, assigneeFilter]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/workspace`} className="hover:underline">
          Workspace
        </Link>
        {" / "}
        <Link href={`/${orgSlug}/workspace/${spaceId}`} className="hover:underline">
          {list.folder.space.name}
        </Link>
        {" / "}
        {list.folder.name} {" / "}
        <span className="text-foreground">{list.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{list.name}</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${view === "kanban" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setView("kanban")}
            >
              Kanban
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${view === "list" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setView("list")}
            >
              Lista
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm ${view === "gantt" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              onClick={() => setView("gantt")}
            >
              Gantt
            </button>
          </div>
          {canCreate && <Button onClick={() => setEditing("new")}>Nova task</Button>}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {view === "list" && (
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-auto">
            <option value="">Todos os status</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
          <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="w-auto">
            <option value="">Todas as prioridades</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </Select>
          <Select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)} className="w-auto">
            <option value="">Todos os responsáveis</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.email}
              </option>
            ))}
          </Select>
        </div>
      )}

      {view === "kanban" && (
        <TaskKanban tasks={tasks} onMove={handleMove} onEdit={handleEditTask} />
      )}

      {view === "gantt" && (
        <GanttChart
          orgSlug={orgSlug}
          spaceId={spaceId}
          listId={list.id}
          members={members}
          canAssign={canAssign}
          canEdit={canCreate}
        />
      )}

      {view === "list" && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Título</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Prioridade</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t, index) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <Link
                      href={`/${orgSlug}/workspace/${spaceId}/list/${list.id}/task/${t.id}`}
                      className="hover:underline"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{TASK_STATUS_LABELS[t.status as keyof typeof TASK_STATUS_LABELS] ?? t.status}</td>
                  <td className="px-3 py-2">
                    {t.priority ? TASK_PRIORITY_LABELS[t.priority as keyof typeof TASK_PRIORITY_LABELS] ?? t.priority : "—"}
                  </td>
                  <td className="px-3 py-2">{t.assignee?.name ?? t.assignee?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveInList(tasks.findIndex((x) => x.id === t.id), -1)}
                        disabled={filtersActive || index === 0}
                        title={filtersActive ? "Remova os filtros para reordenar" : undefined}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                        onClick={() => moveInList(tasks.findIndex((x) => x.id === t.id), 1)}
                        disabled={filtersActive || index === filteredTasks.length - 1}
                        title={filtersActive ? "Remova os filtros para reordenar" : undefined}
                      >
                        ↓
                      </button>
                      {canDelete && (
                        <button
                          type="button"
                          className="px-1 text-xs text-destructive hover:underline"
                          onClick={() => handleDelete(t.id)}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhuma task encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <TaskDialog
          orgSlug={orgSlug}
          spaceId={spaceId}
          listId={list.id}
          task={editing === "new" ? null : editing}
          members={members}
          canAssign={canAssign}
          onClose={() => setEditing(null)}
          onSaved={refresh}
          showDetailLink
        />
      )}
    </div>
  );
}
