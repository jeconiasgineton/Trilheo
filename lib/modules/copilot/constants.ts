/**
 * Innovation Copilot (Fase 6) — IA contextual via Gemini. Plugado só
 * em Idea e Task nesta rodada (as duas entidades com página de
 * detalhe completa hoje). Project/A3/Meeting/Dashboard do roadmap
 * geral ainda não existem como funcionalidades — ver CONTEXTO.MD.
 */
export const COPILOT_CONTEXT_TYPES = ["Idea", "Task"] as const;
export type CopilotContextType = (typeof COPILOT_CONTEXT_TYPES)[number];

export function isValidCopilotContextType(value: string): value is CopilotContextType {
  return (COPILOT_CONTEXT_TYPES as readonly string[]).includes(value);
}

export const COPILOT_SYSTEM_PREAMBLE =
  "Você é o Innovation Copilot do Trilheo, um assistente que ajuda o time a " +
  "analisar ideias, tasks e decisões de negócio. Responda SEMPRE com base nos " +
  "dados reais fornecidos abaixo do contexto atual — nunca invente números, " +
  "comentários, status ou pessoas que não estejam nos dados. Se a pergunta " +
  "não puder ser respondida com o que está disponível, diga isso claramente " +
  "em vez de supor. Seja objetivo, direto e responda sempre em português do Brasil.";
