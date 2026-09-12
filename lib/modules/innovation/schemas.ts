import { z } from "zod";
import {
  DEFAULT_IDEA_SOURCE,
  GUT_MAX,
  GUT_MIN,
  IDEA_SOURCES,
  PUBLIC_IDEA_SOURCES,
  STAGE_TYPES,
} from "./constants";

const idSchema = z.string().min(1);

const nameSchema = z
  .string()
  .min(2, "O nome precisa ter pelo menos 2 caracteres.")
  .max(120, "O nome pode ter no máximo 120 caracteres.");

const slugSchema = z
  .string()
  .min(2, "O identificador precisa ter pelo menos 2 caracteres.")
  .max(60, "O identificador pode ter no máximo 60 caracteres.")
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    "Use apenas letras minúsculas, números e hífen.",
  )
  .optional();

const descriptionSchema = z.string().max(5000).optional();

const stageTypeEnum = z.enum([...STAGE_TYPES] as [string, ...string[]]);
const sourceEnum = z.enum([...IDEA_SOURCES] as [string, ...string[]]);

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida (use #rrggbb).")
  .optional();

// ── Pipeline ────────────────────────────────────────────────────────
export const createIdeaPipelineSchema = z.object({
  name: nameSchema,
});
export type CreateIdeaPipelineInput = z.infer<typeof createIdeaPipelineSchema>;

export const updateIdeaPipelineSchema = z.object({
  id: idSchema,
  name: nameSchema,
});
export type UpdateIdeaPipelineInput = z.infer<typeof updateIdeaPipelineSchema>;

// ── Stage ────────────────────────────────────────────────────────────
export const createIdeaPipelineStageSchema = z.object({
  pipelineId: idSchema,
  name: nameSchema,
  stageType: stageTypeEnum,
  color: hexColorSchema,
  isFinal: z.boolean().optional(),
});
export type CreateIdeaPipelineStageInput = z.infer<
  typeof createIdeaPipelineStageSchema
>;

export const updateIdeaPipelineStageSchema = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  stageType: stageTypeEnum.optional(),
  color: hexColorSchema.nullable(),
  isFinal: z.boolean().optional(),
});
export type UpdateIdeaPipelineStageInput = z.infer<
  typeof updateIdeaPipelineStageSchema
>;

export const reorderIdeaPipelineStagesSchema = z.object({
  pipelineId: idSchema,
  orderedIds: z.array(idSchema).min(1),
});
export type ReorderIdeaPipelineStagesInput = z.infer<
  typeof reorderIdeaPipelineStagesSchema
>;

// ── Board ────────────────────────────────────────────────────────────
export const createIdeaBoardSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  description: descriptionSchema,
  spaceId: idSchema.optional(),
  pipelineId: idSchema,
});
export type CreateIdeaBoardInput = z.infer<typeof createIdeaBoardSchema>;

export const updateIdeaBoardSchema = z.object({
  id: idSchema,
  name: nameSchema.optional(),
  description: z.string().max(5000).nullable().optional(),
});
export type UpdateIdeaBoardInput = z.infer<typeof updateIdeaBoardSchema>;

// ── Idea ─────────────────────────────────────────────────────────────
const ideaTitleSchema = z
  .string()
  .min(2, "O título precisa ter pelo menos 2 caracteres.")
  .max(200, "O título pode ter no máximo 200 caracteres.");

export const createIdeaSchema = z.object({
  boardId: idSchema,
  title: ideaTitleSchema,
  description: z.string().max(5000).optional(),
  // estágio opcional: se ausente, o service usa o primeiro estágio
  // do pipeline do board (menor `order`).
  pipelineStageId: idSchema.optional(),
  source: sourceEnum.optional(),
});
export type CreateIdeaInput = z.infer<typeof createIdeaSchema>;

export const updateIdeaSchema = z.object({
  id: idSchema,
  title: ideaTitleSchema.optional(),
  description: z.string().max(5000).nullable().optional(),
});
export type UpdateIdeaInput = z.infer<typeof updateIdeaSchema>;

/**
 * Move uma ideia entre estágios do pipeline. `approve` distingue uma
 * movimentação comum (idea:move, MEMBRO+) de uma movimentação que
 * entra/sai de estágio final (idea:approve, LIDER+) — o service
 * valida a regra de "não sai/entra de estágio final sem aprovação
 * explícita".
 */
export const moveIdeaSchema = z.object({
  ideaId: idSchema,
  targetStageId: idSchema,
  approve: z.boolean().optional(),
});
export type MoveIdeaInput = z.infer<typeof moveIdeaSchema>;

// ── GUT ──────────────────────────────────────────────────────────────
const gutAxisSchema = z.number().int().min(GUT_MIN).max(GUT_MAX);

export const setIdeaGutSchema = z.object({
  ideaId: idSchema,
  gravity: gutAxisSchema,
  urgency: gutAxisSchema,
  trend: gutAxisSchema,
});
export type SetIdeaGutInput = z.infer<typeof setIdeaGutSchema>;

// ── Captura pública (QR Code / formulário) ─────────────────────────
export const toggleBoardPublicCaptureSchema = z.object({
  boardId: idSchema,
  enabled: z.boolean(),
});
export type ToggleBoardPublicCaptureInput = z.infer<typeof toggleBoardPublicCaptureSchema>;

const publicSourceEnum = z.enum(PUBLIC_IDEA_SOURCES as [string, ...string[]]);

/**
 * Envio pelo formulário público — sem sessão, então sem authorId.
 * submitterEmail opcional (decisão de produto: não obrigar email para
 * reduzir fricção; ver CONTEXTO.MD).
 */
export const submitPublicIdeaSchema = z.object({
  publicToken: idSchema,
  title: ideaTitleSchema,
  description: z.string().max(5000).optional(),
  submitterName: z.string().max(120).optional(),
  submitterEmail: z.string().email("Email inválido.").max(255).optional().or(z.literal("")),
  source: publicSourceEnum.default("FORM"),
});
export type SubmitPublicIdeaInput = z.infer<typeof submitPublicIdeaSchema>;

export { DEFAULT_IDEA_SOURCE };