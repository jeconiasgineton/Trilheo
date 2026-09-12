import { z } from "zod";

const idSchema = z.string().min(1);
const nameSchema = z
  .string()
  .min(2, "O nome precisa ter pelo menos 2 caracteres.")
  .max(120, "O nome pode ter no máximo 120 caracteres.");

export const createWorkspaceSchema = z.object({ name: nameSchema });
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const createSpaceSchema = z.object({
  workspaceId: idSchema,
  name: nameSchema,
});
export type CreateSpaceInput = z.infer<typeof createSpaceSchema>;

export const updateSpaceSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;

export const createFolderSchema = z.object({
  spaceId: idSchema,
  name: nameSchema,
});
export type CreateFolderInput = z.infer<typeof createFolderSchema>;

export const updateFolderSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;

export const createListSchema = z.object({
  folderId: idSchema,
  name: nameSchema,
});
export type CreateListInput = z.infer<typeof createListSchema>;

export const updateListSchema = z.object({ id: idSchema, name: nameSchema });
export type UpdateListInput = z.infer<typeof updateListSchema>;

export const reorderSchema = z.object({
  parentId: idSchema,
  orderedIds: z.array(idSchema).min(1),
});
export type ReorderInput = z.infer<typeof reorderSchema>;
