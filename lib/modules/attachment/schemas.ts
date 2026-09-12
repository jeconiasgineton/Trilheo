import { z } from "zod";
import { ATTACHABLE_TYPES } from "./constants";

/** Mesmo limite de 50MB da rota de upload (app/api/upload/route.ts). */
export const MAX_ATTACHMENT_SIZE_BYTES = 50 * 1024 * 1024;

export const createAttachmentSchema = z.object({
  attachableType: z.enum(ATTACHABLE_TYPES),
  attachableId: z.string().min(1),
  url: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_ATTACHMENT_SIZE_BYTES, "Arquivo excede o limite de 50MB."),
});
export type CreateAttachmentInput = z.infer<typeof createAttachmentSchema>;
