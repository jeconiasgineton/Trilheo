import { z } from "zod";
import { COMMENTABLE_TYPES } from "./constants";

export const createCommentSchema = z.object({
  commentableType: z.enum(COMMENTABLE_TYPES),
  commentableId: z.string().min(1),
  body: z
    .string()
    .min(1, "O comentário não pode ficar vazio.")
    .max(5000, "O comentário pode ter no máximo 5000 caracteres."),
});
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
