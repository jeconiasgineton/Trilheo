"use client";

import { useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskPriority,
} from "@/lib/modules/task";

export type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string | null;
  assigneeId: string | null;
  assignee: { id: string; name: string | null; email: string } | null;
  _count?: { subtasks: number };
};

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return null;
  const label = TASK_PRIORITY_LABELS[priority as TaskPriority] ?? priority;
  const styles = PRIORITY_STYLES[priority] ?? "bg-muted text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${styles}`}>
      {label}
    </span>
  );
}

function initialsOf(name: string | null, email: string) {
  const base = name?.trim() || email;
  const parts = base.split(/[\s@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function TaskCardView({ task }: { task: TaskItem }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <p className="text-sm font-medium leading-snug">{task.title}</p>
      <div className="mt-2.5 flex items-center justify-between">
        <PriorityBadge priority={task.priority} />
      </div>
    </div>
  );
}

function DraggableTaskCard({
  task,
  onEdit,
}: {
  task: TaskItem;
  onEdit: (t: TaskItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `task:${task.id}`,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={isDragging ? "opacity-40" : ""}>
      <div
        className={`group cursor-grab rounded-lg border border-border bg-card p-3 shadow-sm transition active:cursor-grabbing hover:border-primary/30 hover:shadow-md ${isDragging ? "ring-2 ring-primary/40" : ""}`}
        onClick={() => onEdit(task)}
      >
        <p className="text-sm font-medium leading-snug">{task.title}</p>
        {task.description && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{task.description}</p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} />
          {task._count && task._count.subtasks > 0 && (
            <span className="text-[11px] text-muted-foreground">{task._count.subtasks} subtarefa(s)</span>
          )}
        </div>
        {task.assignee && (
          <div className="mt-2.5 flex items-center gap-2 border-t border-border/60 pt-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
              {initialsOf(task.assignee.name, task.assignee.email)}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {task.assignee.name ?? task.assignee.email}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function TaskColumn({
  status,
  tasks,
  onEdit,
}: {
  status: string;
  tasks: TaskItem[];
  onEdit: (t: TaskItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `status:${status}` });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-0.5">
        <h3 className="text-sm font-semibold">
          {TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] ?? status}
        </h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg border p-2 transition-colors ${isOver ? "border-primary bg-muted" : "border-border bg-muted/40"}`}
      >
        {tasks.map((t) => (
          <DraggableTaskCard key={t.id} task={t} onEdit={onEdit} />
        ))}
        {tasks.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">Solte tasks aqui</p>
        )}
      </div>
    </div>
  );
}

export function TaskKanban({
  tasks,
  onMove,
  onEdit,
}: {
  tasks: TaskItem[];
  onMove: (taskId: string, targetStatus: string) => void;
  onEdit: (task: TaskItem) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } });

  const columns = TASK_STATUSES.map((status) => ({
    status,
    tasks: tasks.filter((t) => t.status === status),
  }));

  function handleDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);
    if (!activeIdStr.startsWith("task:")) return;
    const taskId = activeIdStr.slice(5);

    let targetStatus: string | null = null;
    if (overIdStr.startsWith("status:")) {
      targetStatus = overIdStr.slice(7);
    } else if (overIdStr.startsWith("task:")) {
      const overTaskId = overIdStr.slice(5);
      const overTask = tasks.find((t) => t.id === overTaskId);
      targetStatus = overTask?.status ?? null;
    }
    if (!targetStatus) return;

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== targetStatus) {
      onMove(taskId, targetStatus);
    }
  }

  const activeTask = activeId ? tasks.find((t) => `task:${t.id}` === activeId) ?? null : null;

  return (
    <DndContext
      sensors={[sensor]}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {columns.map((col) => (
          <TaskColumn key={col.status} status={col.status} tasks={col.tasks} onEdit={onEdit} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCardView task={activeTask} /> : null}</DragOverlay>
    </DndContext>
  );
}
