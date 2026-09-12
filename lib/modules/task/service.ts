import { db } from "@/lib/db";
import { computeOrderUpdates, isCompleteOrderSet } from "@/lib/modules/workspace/reorder";
import { DEFAULT_TASK_STATUS } from "./constants";
import type {
  CreateTaskInput,
  UpdateTaskInput,
} from "./schemas";

export class TaskDependencyError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "DUPLICATE" | "CYCLE",
  ) {
    super(message);
    this.name = "TaskDependencyError";
  }
}

export class TaskError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_ORDER_SET",
  ) {
    super(message);
    this.name = "TaskError";
  }
}

function notFound(entity: string): never {
  throw new TaskError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

function assertCompleteOrderSet(currentIds: string[], orderedIds: string[]) {
  if (!isCompleteOrderSet(currentIds, orderedIds)) {
    throw new TaskError(
      "A lista enviada para reordenar precisa conter exatamente os itens atuais, sem faltar nem repetir.",
      "INVALID_ORDER_SET",
    );
  }
}

async function assertListInOrg(organizationId: string, listId: string) {
  const list = await db.list.findFirst({
    where: { id: listId, organizationId },
    select: { id: true },
  });
  if (!list) notFound("List");
}

async function assertAssigneeInOrg(organizationId: string, userId: string) {
  const member = await db.organizationMember.findFirst({
    where: { organizationId, userId },
    select: { id: true },
  });
  if (!member) notFound("Responsável");
}

async function assertParentTaskInList(
  organizationId: string,
  listId: string,
  parentTaskId: string,
) {
  const parent = await db.task.findFirst({
    where: { id: parentTaskId, organizationId, listId },
    select: { id: true },
  });
  if (!parent) notFound("Task pai");
}

const ASSIGNEE_SELECT = { id: true, name: true, email: true } as const;

/**
 * Tasks top-level (`parentTaskId: null`) de uma List, já agrupadas
 * por status — uma query só, usada tanto pelo Kanban quanto pela
 * Lista (achatamento do mesmo resultado). Atende ao critério de
 * aceite "task criada/editada na Lista aparece no Kanban e
 * vice-versa, sem duplicação de registro".
 */
export async function listTasksByStatus(organizationId: string, listId: string) {
  await assertListInOrg(organizationId, listId);
  return db.task.findMany({
    where: { organizationId, listId, parentTaskId: null },
    orderBy: { order: "asc" },
    include: {
      assignee: { select: ASSIGNEE_SELECT },
      _count: { select: { subtasks: true } },
    },
  });
}

export async function createTask(organizationId: string, input: CreateTaskInput) {
  await assertListInOrg(organizationId, input.listId);
  if (input.parentTaskId) {
    await assertParentTaskInList(organizationId, input.listId, input.parentTaskId);
  }
  if (input.assigneeId) {
    await assertAssigneeInOrg(organizationId, input.assigneeId);
  }

  const last = await db.task.findFirst({
    where: { listId: input.listId, parentTaskId: input.parentTaskId ?? null },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return db.task.create({
    data: {
      organizationId,
      listId: input.listId,
      parentTaskId: input.parentTaskId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? DEFAULT_TASK_STATUS,
      priority: input.priority ?? null,
      assigneeId: input.assigneeId ?? null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      isMilestone: input.isMilestone ?? false,
      order: (last?.order ?? -1) + 1,
    },
    include: { assignee: { select: ASSIGNEE_SELECT } },
  });
}

export async function updateTask(
  organizationId: string,
  id: string,
  input: UpdateTaskInput,
) {
  const existing = await db.task.findFirst({
    where: { id, organizationId },
    select: { listId: true },
  });
  if (!existing) notFound("Task");

  if (input.assigneeId) {
    await assertAssigneeInOrg(organizationId, input.assigneeId);
  }

  const { count } = await db.task.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.priority !== undefined && { priority: input.priority }),
      ...(input.assigneeId !== undefined && { assigneeId: input.assigneeId }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
      ...(input.startDate !== undefined && {
        startDate: input.startDate ? new Date(input.startDate) : null,
      }),
      ...(input.isMilestone !== undefined && { isMilestone: input.isMilestone }),
    },
  });
  if (count === 0) notFound("Task");
  return db.task.findUniqueOrThrow({
    where: { id },
    include: { assignee: { select: ASSIGNEE_SELECT } },
  });
}

/** Mover card entre colunas do Kanban — só muda `status`. */
export async function moveTask(organizationId: string, id: string, status: string) {
  const { count } = await db.task.updateMany({
    where: { id, organizationId },
    data: { status },
  });
  if (count === 0) notFound("Task");
  return db.task.findUniqueOrThrow({
    where: { id },
    include: { assignee: { select: ASSIGNEE_SELECT } },
  });
}

/** Reordena as tasks top-level de uma List (view Lista). */
export async function reorderTasks(
  organizationId: string,
  listId: string,
  orderedIds: string[],
) {
  await assertListInOrg(organizationId, listId);
  const current = await db.task.findMany({
    where: { organizationId, listId, parentTaskId: null },
    select: { id: true },
  });
  assertCompleteOrderSet(current.map((t) => t.id), orderedIds);
  const updates = computeOrderUpdates(orderedIds);
  await db.$transaction(
    updates.map(({ id, order }) =>
      db.task.updateMany({
        where: { id, organizationId, listId, parentTaskId: null },
        data: { order },
      }),
    ),
  );
}

export async function deleteTask(organizationId: string, id: string) {
  const { count } = await db.task.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Task");
}

/** Task com subtarefas e responsável — comentários/anexos vêm pelo módulo polimórfico. */
export async function getTaskWithDetails(organizationId: string, id: string) {
  const task = await db.task.findFirst({
    where: { id, organizationId },
    include: {
      assignee: { select: ASSIGNEE_SELECT },
      subtasks: {
        orderBy: { order: "asc" },
        include: { assignee: { select: ASSIGNEE_SELECT } },
      },
    },
  });
  if (!task) notFound("Task");
  return task;
}

// ── Fase 4 (Projetos): dependências e Gantt ─────────────────────────

/**
 * Tasks top-level de uma List com o que o Gantt precisa: datas,
 * marco e dependências (predecessoras/sucessoras, id+title só — o
 * resto vem do próprio array de tasks). Reaproveita a mesma tabela
 * do Kanban/Lista, sem duplicar dado.
 */
export async function listTasksForGantt(organizationId: string, listId: string) {
  await assertListInOrg(organizationId, listId);
  return db.task.findMany({
    where: { organizationId, listId, parentTaskId: null },
    orderBy: { order: "asc" },
    include: {
      assignee: { select: ASSIGNEE_SELECT },
      predecessorOf: { select: { id: true, successorId: true } },
      successorOf: { select: { id: true, predecessorId: true } },
    },
  });
}

async function assertTaskInOrg(organizationId: string, taskId: string) {
  const task = await db.task.findFirst({ where: { id: taskId, organizationId }, select: { id: true } });
  if (!task) notFound("Task");
}

/**
 * Detecta se adicionar predecessor->successor fecharia um ciclo:
 * percorre, a partir do sucessor, as dependências existentes
 * (sucessor -> seus sucessores -> ...) e verifica se o predecessor é
 * alcançável — nesse caso o predecessor já depende (transitivamente)
 * do sucessor, e a nova aresta fecharia um laço.
 */
async function wouldCreateCycle(
  organizationId: string,
  predecessorId: string,
  successorId: string,
): Promise<boolean> {
  const visited = new Set<string>([successorId]);
  let frontier = [successorId];
  while (frontier.length > 0) {
    const edges = await db.taskDependency.findMany({
      where: { organizationId, predecessorId: { in: frontier } },
      select: { successorId: true },
    });
    const next: string[] = [];
    for (const e of edges) {
      if (e.successorId === predecessorId) return true;
      if (!visited.has(e.successorId)) {
        visited.add(e.successorId);
        next.push(e.successorId);
      }
    }
    frontier = next;
  }
  return false;
}

export async function addDependency(organizationId: string, predecessorId: string, successorId: string) {
  await assertTaskInOrg(organizationId, predecessorId);
  await assertTaskInOrg(organizationId, successorId);

  const existing = await db.taskDependency.findUnique({
    where: { predecessorId_successorId: { predecessorId, successorId } },
  });
  if (existing) {
    throw new TaskDependencyError("Essa dependência já existe.", "DUPLICATE");
  }
  if (await wouldCreateCycle(organizationId, predecessorId, successorId)) {
    throw new TaskDependencyError(
      "Essa dependência criaria um ciclo (a task já depende, direta ou indiretamente, desta sucessora).",
      "CYCLE",
    );
  }
  return db.taskDependency.create({
    data: { organizationId, predecessorId, successorId },
  });
}

export async function removeDependency(organizationId: string, id: string) {
  const { count } = await db.taskDependency.deleteMany({ where: { id, organizationId } });
  if (count === 0) throw new TaskDependencyError("Dependência não encontrada.", "NOT_FOUND");
}

/**
 * Carga de trabalho: contagem de tasks ativas (não concluídas) por
 * responsável na organização, agrupada por prioridade — visão
 * simples sem exigir campo de estimativa de horas (que não existe
 * no modelo hoje; ver CONTEXTO.MD).
 */
export async function getWorkloadSummary(organizationId: string) {
  const members = await db.organizationMember.findMany({
    where: { organizationId },
    select: { user: { select: { id: true, name: true, email: true } } },
  });
  const tasks = await db.task.findMany({
    where: { organizationId, status: { not: "done" }, assigneeId: { not: null } },
    select: { assigneeId: true, priority: true, status: true, dueDate: true, title: true, id: true },
  });
  return members.map(({ user }) => ({
    user,
    tasks: tasks.filter((t) => t.assigneeId === user.id),
  }));
}
