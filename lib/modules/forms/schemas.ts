import { z } from "zod";
import { FIELD_TYPES } from "./constants";

const idSchema = z.string().min(1);
const titleSchema = z.string().min(2, "O título precisa ter pelo menos 2 caracteres.").max(200);

const fieldInputSchema = z.object({
  id: idSchema.optional(), // ausente = campo novo
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1, "Todo campo precisa de um rótulo.").max(200),
  required: z.boolean().default(false),
  options: z.array(z.string().min(1).max(120)).max(30).optional(),
});
export type FieldInput = z.infer<typeof fieldInputSchema>;

export const createFormTemplateSchema = z.object({
  title: titleSchema,
  description: z.string().max(2000).optional(),
});
export type CreateFormTemplateInput = z.infer<typeof createFormTemplateSchema>;

export const updateFormTemplateSchema = z.object({
  id: idSchema,
  title: titleSchema.optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateFormTemplateInput = z.infer<typeof updateFormTemplateSchema>;

/** Substitui a lista inteira de campos do template — mais simples que diffs incrementais de add/remove/reorder. */
export const replaceFieldsSchema = z.object({
  templateId: idSchema,
  fields: z.array(fieldInputSchema).max(80),
});
export type ReplaceFieldsInput = z.infer<typeof replaceFieldsSchema>;

export const submitFormSchema = z.object({
  templateId: idSchema,
  answers: z.record(z.string(), z.unknown()),
  clientSubmittedAt: z.string().datetime().optional(),
});
export type SubmitFormInput = z.infer<typeof submitFormSchema>;
