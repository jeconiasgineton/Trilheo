"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  addDependencyAction,
  getTasksForGanttAction,
  removeDependencyAction,
} from "@/lib/modules/task/actions";
import { TASK_STATUS_LABELS, type TaskStatus } from "@/lib/modules/task";
import { TaskDialog, type MemberOption, type TaskDetail } from "./task-dialog";

type GanttTask = {
  id: string;
  title: string;
  status: string;
  startDate: string | Date | null;
  dueDate: string | Date | null;
  isMilestone: boolean;
  assignee: { id: string; name: string | null; email: string } | null;
  predecessorOf: { id: string; successorId: string }[];
  successorOf: { id: string; predecessorId: string }[];
};

const DAY_WIDTH = 28;
const ROW_HEIGHT = 40;

const STATUS_COLORS: Record<string, string> = {
  backlog: "#94a3b8",
  todo: "#64748b",
  in_progress: "#0ea5e9",
  review: "#d97706",
  done: "#16a34a",
};

function toDate(value: string | Date | null): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()) -
    Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())) / ms);
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}

function formatShort(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function GanttChart({
  orgSlug,
  spaceId,
  listId,
  members,
  canAssign,
  canEdit,
}: {
  orgSlug: string;
  spaceId: string;
  listId: string;
  members: MemberOption[];
  canAssign: boolean;
  canEdit: boolean;
}) {
  const [tasks, setTasks] = useState<GanttTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TaskDetail | null>(null);
  const [newPredecessor, setNewPredecessor] = useState("");
  const [newSuccessor, setNewSuccessor] = useState("");

  async function load() {
    const result = await getTasksForGanttAction(listId);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTasks(result.data as GanttTask[]);
    setError(null);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  const scheduled = useMemo(
    () => (tasks ?? []).filter((t) => toDate(t.startDate) || toDate(t.dueDate)),
    [tasks],
  );
  const unscheduled = useMemo(
    () => (tasks ?? []).filter((t) => !toDate(t.startDate) && !toDate(t.dueDate)),
    [tasks],
  );

  const { minDate, totalDays, bars } = useMemo(() => {
    if (scheduled.length === 0) {
      return { minDate: new Date(), totalDays: 14, bars: [] as { task: GanttTask; startDay: number; endDay: number }[] };
    }
    const dates = scheduled.flatMap((t) => [toDate(t.startDate), toDate(t.dueDate)].filter(Boolean) as Date[]);
    const min = addDays(new Date(Math.min(...dates.map((d) => d.getTime()))), -1);
    const max = addDays(new Date(Math.max(...dates.map((d) => d.getTime()))), 2);
    const total = Math.max(daysBetween(max, min), 7);
    const computedBars = scheduled.map((t) => {
      const start = toDate(t.startDate) ?? toDate(t.dueDate)!;
      const end = toDate(t.dueDate) ?? toDate(t.startDate)!;
      return { task: t, startDay: daysBetween(start, min), endDay: daysBetween(end, min) + 1 };
    });
    return { minDate: min, totalDays: total, bars: computedBars };
  }, [scheduled]);

  const chartWidth = totalDays * DAY_WIDTH;
  const chartHeight = bars.length * ROW_HEIGHT;

  const rowIndexById = useMemo(() => {
    const map = new Map<string, number>();
    bars.forEach((b, i) => map.set(b.task.id, i));
    return map;
  }, [bars]);

  async function handleAddDependency() {
    if (!newPredecessor || !newSuccessor || newPredecessor === newSuccessor) return;
    const result = await addDependencyAction({ predecessorId: newPredecessor, successorId: newSuccessor });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    setNewPredecessor("");
    setNewSuccessor("");
    load();
  }

  async function handleRemoveDependency(id: string) {
    const result = await removeDependencyAction({ id });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    load();
  }

  function openEdit(t: GanttTask) {
    if (!canEdit) return;
    setEditing({
      id: t.id,
      title: t.title,
      description: null,
      status: t.status,
      priority: null,
      assigneeId: t.assignee?.id ?? null,
      startDate: t.startDate,
      dueDate: t.dueDate,
      isMilestone: t.isMilestone,
    });
  }

  if (!tasks) {
    return <p className="text-sm text-muted-foreground">Carregando Gantt...</p>;
  }

  const dependencyEdges = tasks.flatMap((t) =>
    t.predecessorOf
      .filter((d) => rowIndexById.has(t.id) && rowIndexById.has(d.successorId))
      .map((d) => ({ id: d.id, from: t.id, to: d.successorId })),
  );

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {bars.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Nenhuma task com data de início ou fim ainda. Defina datas no editar da task para vê-las aqui.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <div style={{ width: chartWidth + 200 }}>
            {/* Cabeçalho de datas */}
            <div className="flex border-b border-border bg-muted/50 text-[10px] text-muted-foreground">
              <div className="w-[200px] shrink-0 px-2 py-1.5 font-medium">Task</div>
              <div className="relative" style={{ width: chartWidth, height: 28 }}>
                {Array.from({ length: totalDays }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 flex h-full items-center border-l border-border/50 pl-0.5"
                    style={{ left: i * DAY_WIDTH, width: DAY_WIDTH }}
                  >
                    {i % (totalDays > 45 ? 7 : 1) === 0 ? formatShort(addDays(minDate, i)) : ""}
                  </div>
                ))}
              </div>
            </div>

            {/* Linhas */}
            <div className="relative">
              {bars.map(({ task: t, startDay, endDay }, i) => (
                <div key={t.id} className="flex items-center border-b border-border/60 last:border-0">
                  <div className="w-[200px] shrink-0 truncate px-2 py-2 text-xs">{t.title}</div>
                  <div className="relative" style={{ width: chartWidth, height: ROW_HEIGHT }}>
                    {t.isMilestone ? (
                      <div
                        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 cursor-pointer border border-background"
                        style={{ left: startDay * DAY_WIDTH - 6, backgroundColor: "#7c3aed" }}
                        title={t.title}
                        onClick={() => openEdit(t)}
                      />
                    ) : (
                      <div
                        className="absolute top-1/2 h-5 -translate-y-1/2 cursor-pointer rounded text-[10px] leading-5 text-white"
                        style={{
                          left: startDay * DAY_WIDTH,
                          width: Math.max((endDay - startDay) * DAY_WIDTH, 6),
                          backgroundColor: STATUS_COLORS[t.status] ?? "#94a3b8",
                        }}
                        title={t.title}
                        onClick={() => openEdit(t)}
                      >
                        <span className="ml-1 truncate">
                          {TASK_STATUS_LABELS[t.status as TaskStatus] ?? t.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Setas de dependência */}
              <svg
                className="pointer-events-none absolute left-[200px] top-0"
                width={chartWidth}
                height={chartHeight}
              >
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                </defs>
                {dependencyEdges.map((edge) => {
                  const fromBar = bars[rowIndexById.get(edge.from)!];
                  const toBar = bars[rowIndexById.get(edge.to)!];
                  const x1 = fromBar.endDay * DAY_WIDTH;
                  const y1 = rowIndexById.get(edge.from)! * ROW_HEIGHT + ROW_HEIGHT / 2;
                  const x2 = toBar.startDay * DAY_WIDTH;
                  const y2 = rowIndexById.get(edge.to)! * ROW_HEIGHT + ROW_HEIGHT / 2;
                  return (
                    <path
                      key={edge.id}
                      d={`M ${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}`}
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      markerEnd="url(#arrow)"
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {unscheduled.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Sem datas (não aparecem na linha do tempo)</p>
          <ul className="flex flex-wrap gap-2">
            {unscheduled.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="rounded-md border border-dashed border-border px-2 py-1 text-xs hover:border-primary/40"
                  onClick={() => openEdit(t)}
                >
                  {t.title}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {canEdit && tasks.length > 1 && (
        <div className="rounded-md border border-border bg-background p-3">
          <p className="mb-2 text-xs font-medium">Adicionar dependência</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={newPredecessor} onChange={(e) => setNewPredecessor(e.target.value)} className="w-auto text-xs">
              <option value="">Predecessora</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            <span className="text-xs text-muted-foreground">precisa terminar antes de</span>
            <Select value={newSuccessor} onChange={(e) => setNewSuccessor(e.target.value)} className="w-auto text-xs">
              <option value="">Sucessora</option>
              {tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </Select>
            <Button type="button" size="sm" onClick={handleAddDependency} disabled={!newPredecessor || !newSuccessor}>
              Adicionar
            </Button>
          </div>

          {dependencyEdges.length > 0 && (
            <ul className="mt-3 space-y-1">
              {tasks.flatMap((t) =>
                t.predecessorOf.map((d) => {
                  const successor = tasks.find((x) => x.id === d.successorId);
                  if (!successor) return null;
                  return (
                    <li key={d.id} className="flex items-center justify-between text-xs">
                      <span>
                        {t.title} → {successor.title}
                      </span>
                      <button
                        type="button"
                        className="text-destructive hover:underline"
                        onClick={() => handleRemoveDependency(d.id)}
                      >
                        Remover
                      </button>
                    </li>
                  );
                }),
              )}
            </ul>
          )}
        </div>
      )}

      {editing && (
        <TaskDialog
          orgSlug={orgSlug}
          spaceId={spaceId}
          listId={listId}
          task={editing}
          members={members}
          canAssign={canAssign}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
