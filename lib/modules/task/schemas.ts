import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "./constants";

const idSchema = z.string().min(1);
const statusEnum = z.enum(TASK_STATUSES);
const priorityEnum = z.enum(TASK_PRIORITIES);

export const createTaskSchema = z.object({
  listId: idSchema,
  parentTaskId: idSchema.optional(),
  title: z
    .string()
    .min(2, "O título precisa ter pelo menos 2 caracteres.")
    .max(200, "O título pode ter no máximo 200 caracteres."),
  description: z.string().max(10000).optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  assigneeId: idSchema.optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
  isMilestone: z.boolean().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z.object({
  id: idSchema,
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: statusEnum.optional(),
  priority: priorityEnum.nullable().optional(),
  assigneeId: idSchema.nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  isMilestone: z.boolean().optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const moveTaskSchema = z.object({
  id: idSchema,
  status: statusEnum,
});
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;

export const reorderTasksSchema = z.object({
  listId: idSchema,
  orderedIds: z.array(idSchema).min(1),
});
export type ReorderTasksInput = z.infer<typeof reorderTasksSchema>;

// ── Fase 4 (Projetos): dependências entre tasks ─────────────────────

export const addDependencySchema = z
  .object({
    predecessorId: idSchema,
    successorId: idSchema,
  })
  .refine((v) => v.predecessorId !== v.successorId, {
    message: "Uma task não pode depender dela mesma.",
  });
export type AddDependencyInput = z.infer<typeof addDependencySchema>;

export const removeDependencySchema = z.object({ id: idSchema });
export type RemoveDependencyInput = z.infer<typeof removeDependencySchema>;
