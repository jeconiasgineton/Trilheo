"use client";

import { TASK_PRIORITY_LABELS, type TaskPriority } from "@/lib/modules/task";

type WorkloadTask = {
  id: string;
  title: string;
  priority: string | null;
  status: string;
  dueDate: string | Date | null;
};
type WorkloadEntry = {
  user: { id: string; name: string | null; email: string };
  tasks: WorkloadTask[];
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#dc2626",
  high: "#d97706",
  medium: "#0ea5e9",
  low: "#94a3b8",
};

function isOverdue(dueDate: string | Date | null) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/**
 * Carga de trabalho (Fase 4): contagem de tasks ativas por
 * responsável, sem exigir campo de estimativa de horas (não existe
 * no modelo — ver CONTEXTO.MD). Serve para identificar
 * sobrecarga/ociosidade rápido, não um cronograma de capacidade fino.
 */
export function WorkloadClient({ summary }: { summary: WorkloadEntry[] }) {
  const maxCount = Math.max(1, ...summary.map((s) => s.tasks.length));
  const sorted = [...summary].sort((a, b) => b.tasks.length - a.tasks.length);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Carga de trabalho</h1>
        <p className="text-sm text-muted-foreground">
          Tasks ativas (não concluídas) por responsável, em toda a organização.
        </p>
      </div>

      <div className="space-y-4">
        {sorted.map((entry) => {
          const overdueCount = entry.tasks.filter((t) => isOverdue(t.dueDate)).length;
          return (
            <div key={entry.user.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{entry.user.name ?? entry.user.email}</span>
                <span className="text-sm text-muted-foreground">
                  {entry.tasks.length} task(s)
                  {overdueCount > 0 && <span className="ml-2 text-destructive">{overdueCount} atrasada(s)</span>}
                </span>
              </div>
              <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted">
                {entry.tasks.length === 0 ? null : (
                  ["urgent", "high", "medium", "low"].map((p) => {
                    const count = entry.tasks.filter((t) => (t.priority ?? "low") === p).length;
                    if (count === 0) return null;
                    return (
                      <div
                        key={p}
                        style={{
                          width: `${(count / maxCount) * 100}%`,
                          backgroundColor: PRIORITY_COLORS[p],
                        }}
                        title={`${TASK_PRIORITY_LABELS[p as TaskPriority]}: ${count}`}
                      />
                    );
                  })
                )}
              </div>
              {entry.tasks.length > 0 && (
                <ul className="mt-3 space-y-1">
                  {entry.tasks.slice(0, 6).map((t) => (
                    <li
                      key={t.id}
                      className={`text-xs ${isOverdue(t.dueDate) ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {t.title}
                      {t.dueDate && ` — ${new Date(t.dueDate).toLocaleDateString("pt-BR")}`}
                    </li>
                  ))}
                  {entry.tasks.length > 6 && (
                    <li className="text-xs text-muted-foreground">+ {entry.tasks.length - 6} outra(s)</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum membro na organização ainda.
          </p>
        )}
      </div>
    </div>
  );
}
