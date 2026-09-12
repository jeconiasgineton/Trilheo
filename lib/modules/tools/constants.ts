/**
 * Biblioteca de ferramentas de Melhoria Contínua (Fase 3). Só os 3
 * tipos do primeiro lote (ver CONTEXTO.MD) — os outros 5 do roadmap
 * (Pareto, SIPOC, PDCA, A3, Brainstorming) entram depois, seguindo o
 * mesmo padrão de `type` + `content` (Json).
 */
export const TOOL_TYPES = ["FIVE_WHYS", "ISHIKAWA", "FIVE_W_TWO_H"] as const;
export type ToolType = (typeof TOOL_TYPES)[number];

export const TOOL_TYPE_LABELS: Record<ToolType, string> = {
  FIVE_WHYS: "5 Porquês",
  ISHIKAWA: "Ishikawa (Espinha de peixe)",
  FIVE_W_TWO_H: "5W2H",
};

export const TOOL_TYPE_DESCRIPTIONS: Record<ToolType, string> = {
  FIVE_WHYS: "Pergunte \"por quê\" repetidamente até chegar na causa raiz.",
  ISHIKAWA: "Organize causas possíveis por categoria (Método, Máquina, Material...).",
  FIVE_W_TWO_H: "Plano de ação: o quê, por quê, onde, quando, quem, como, quanto custa.",
};

export function isValidToolType(value: string): value is ToolType {
  return (TOOL_TYPES as readonly string[]).includes(value);
}

/** Entidades que podem receber uma ferramenta de análise. Só "Idea" por ora. */
export const ANALYZABLE_TYPES = ["Idea"] as const;
export type AnalyzableType = (typeof ANALYZABLE_TYPES)[number];

export function isValidAnalyzableType(value: string): value is AnalyzableType {
  return (ANALYZABLE_TYPES as readonly string[]).includes(value);
}

/** Categorias padrão do Ishikawa (6M) — o usuário pode renomear/adicionar. */
export const DEFAULT_ISHIKAWA_CATEGORIES = [
  "Método",
  "Máquina",
  "Material",
  "Mão de obra",
  "Meio ambiente",
  "Medida",
];

export const MAX_FIVE_WHYS_LEVELS = 5;
