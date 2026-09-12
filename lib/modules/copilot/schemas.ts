import { z } from "zod";
import { COPILOT_CONTEXT_TYPES } from "./constants";

const idSchema = z.string().min(1);

export const copilotHistoryEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().max(8000),
});
export type CopilotHistoryEntry = z.infer<typeof copilotHistoryEntrySchema>;

export const askCopilotSchema = z.object({
  contextType: z.enum(COPILOT_CONTEXT_TYPES),
  contextId: idSchema,
  question: z.string().min(1, "Escreva uma pergunta.").max(2000),
  history: z.array(copilotHistoryEntrySchema).max(20).optional(),
});
export type AskCopilotInput = z.infer<typeof askCopilotSchema>;
