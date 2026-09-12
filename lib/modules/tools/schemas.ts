import { z } from "zod";
import { ANALYZABLE_TYPES, MAX_FIVE_WHYS_LEVELS, TOOL_TYPES } from "./constants";

const idSchema = z.string().min(1);
const titleSchema = z.string().min(2, "O título precisa ter pelo menos 2 caracteres.").max(200);
const analyzableTypeSchema = z.enum(ANALYZABLE_TYPES);

// ── Conteúdo por tipo ────────────────────────────────────────────────

export const fiveWhysContentSchema = z.object({
  problem: z.string().max(500),
  whys: z
    .array(z.object({ question: z.string().max(300), answer: z.string().max(300) }))
    .max(MAX_FIVE_WHYS_LEVELS),
});
export type FiveWhysContent = z.infer<typeof fiveWhysContentSchema>;

export const ishikawaContentSchema = z.object({
  problem: z.string().max(500),
  categories: z.array(
    z.object({
      name: z.string().min(1).max(80),
      causes: z.array(z.string().max(300)),
    }),
  ),
});
export type IshikawaContent = z.infer<typeof ishikawaContentSchema>;

export const fiveWTwoHContentSchema = z.object({
  actions: z.array(
    z.object({
      what: z.string().max(300),
      why: z.string().max(300).optional(),
      where: z.string().max(300).optional(),
      when: z.string().max(300).optional(),
      who: z.string().max(300).optional(),
      how: z.string().max(300).optional(),
      howMuch: z.string().max(300).optional(),
    }),
  ),
});
export type FiveWTwoHContent = z.infer<typeof fiveWTwoHContentSchema>;

// ── Create / Update (discriminado por `type`, valida o content certo) ─

export const createToolSchema = z.discriminatedUnion("type", [
  z.object({
    analyzableType: analyzableTypeSchema,
    analyzableId: idSchema,
    type: z.literal("FIVE_WHYS"),
    title: titleSchema,
    content: fiveWhysContentSchema,
  }),
  z.object({
    analyzableType: analyzableTypeSchema,
    analyzableId: idSchema,
    type: z.literal("ISHIKAWA"),
    title: titleSchema,
    content: ishikawaContentSchema,
  }),
  z.object({
    analyzableType: analyzableTypeSchema,
    analyzableId: idSchema,
    type: z.literal("FIVE_W_TWO_H"),
    title: titleSchema,
    content: fiveWTwoHContentSchema,
  }),
]);
export type CreateToolInput = z.infer<typeof createToolSchema>;

export const updateToolSchema = z.discriminatedUnion("type", [
  z.object({ id: idSchema, type: z.literal("FIVE_WHYS"), title: titleSchema, content: fiveWhysContentSchema }),
  z.object({ id: idSchema, type: z.literal("ISHIKAWA"), title: titleSchema, content: ishikawaContentSchema }),
  z.object({ id: idSchema, type: z.literal("FIVE_W_TWO_H"), title: titleSchema, content: fiveWTwoHContentSchema }),
]);
export type UpdateToolInput = z.infer<typeof updateToolSchema>;

export { TOOL_TYPES };
