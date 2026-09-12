"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { TaskError, TaskDependencyError } from "./service";
import {
  addDependencySchema,
  createTaskSchema,
  moveTaskSchema,
  removeDependencySchema,
  reorderTasksSchema,
  updateTaskSchema,
} from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * `task:assign` (LIDER+) é checado além de `task:create`/`task:update`
 * sempre que `assigneeId` é definido — definir responsável é uma
 * ação de coordenação (ver CONTEXTO.MD). A UI desabilita o select
 * para papéis menores, mas o action revalida (defesa em profundidade).
 */
async function withSession<T>(
  run: (session: { organizationId: string; role: Role; id: string }) => Promise<T>,
): Promise<ActionResult<T>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    const data = await run(session.user);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof TaskError || err instanceof TaskDependencyError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

export async function createTaskAction(formData: unknown) {
  const parsed = createTaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:create");
    if (parsed.data.assigneeId) requirePermission(role, "task:assign");
    return service.createTask(organizationId, parsed.data);
  });
}

export async function updateTaskAction(formData: unknown) {
  const parsed = updateTaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:update");
    if (parsed.data.assigneeId !== undefined) requirePermission(role, "task:assign");
    return service.updateTask(organizationId, parsed.data.id, parsed.data);
  });
}

export async function moveTaskAction(formData: unknown) {
  const parsed = moveTaskSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:update");
    return service.moveTask(organizationId, parsed.data.id, parsed.data.status);
  });
}

export async function reorderTasksAction(formData: unknown) {
  const parsed = reorderTasksSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:reorder");
    return service.reorderTasks(organizationId, parsed.data.listId, parsed.data.orderedIds);
  });
}

export async function deleteTaskAction(id: string) {
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:delete");
    return service.deleteTask(organizationId, id);
  });
}

/** Task + subtarefas + responsável, escopado pela sessão — usado pelos diálogos de edição. */
export async function getTaskDetailAction(id: string) {
  return withSession(({ organizationId }) => {
    return service.getTaskWithDetails(organizationId, id);
  });
}

// ── Fase 4 (Projetos): dependências, Gantt, workload ─────────────────

export async function getTasksForGanttAction(listId: string) {
  return withSession(({ organizationId }) => service.listTasksForGantt(organizationId, listId));
}

export async function addDependencyAction(formData: unknown) {
  const parsed = addDependencySchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:update");
    return service.addDependency(organizationId, parsed.data.predecessorId, parsed.data.successorId);
  });
}

export async function removeDependencyAction(formData: unknown) {
  const parsed = removeDependencySchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "task:update");
    return service.removeDependency(organizationId, parsed.data.id);
  });
}

export async function getWorkloadSummaryAction() {
  return withSession(({ organizationId }) => service.getWorkloadSummary(organizationId));
}
