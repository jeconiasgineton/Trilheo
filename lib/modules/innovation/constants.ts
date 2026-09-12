/**
 * Constantes do módulo de Inovação (Fase 2, Marco 1).
 *
 * `stageType` e `source` são String no banco (não enum Prisma) pela
 * mesma filosofia de Task.status/priority: a organização pode
 * customizar os tipos/estágios sem migrar enum. Aqui definimos só o
 * conjunto padrão, usado para validar input e montar o Kanban de
 * ideias. Se uma org customizar, o validador passa a checar contra
 * o conjunto configurado — o schema do banco não muda (é String).
 */

/** Tipos de estágio do pipeline (classificação, não rótulo). */
export const STAGE_TYPES = [
  "BACKLOG",
  "TRIAGE",
  "ANALYSIS",
  "APPROVED",
  "REJECTED",
  "CONVERTED",
] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_TYPE_LABELS: Record<StageType, string> = {
  BACKLOG: "Backlog",
  TRIAGE: "Triagem",
  ANALYSIS: "Em Análise",
  APPROVED: "Aprovada",
  REJECTED: "Reprovada",
  CONVERTED: "Convertida",
};

/**
 * Cor padrão (hex) por tipo de estágio. O estágio pode ter `color`
 * próprio (sobrescreve); este mapa só dá um default sensato para o
 * Kanban e para o seed. Cores como hex string (não classes Tailwind)
 * porque o `color` vive no banco e é aplicado via style inline na UI.
 */
export const STAGE_TYPE_COLORS: Record<StageType, string> = {
  BACKLOG: "#94a3b8",
  TRIAGE: "#6366f1",
  ANALYSIS: "#0ea5e9",
  APPROVED: "#16a34a",
  REJECTED: "#dc2626",
  CONVERTED: "#d97706",
};

/** Tipos de estágio terminais (não se sai deles sem ação explícita). */
export const FINAL_STAGE_TYPES: ReadonlySet<StageType> = new Set([
  "APPROVED",
  "REJECTED",
  "CONVERTED",
]);

/** Origem de uma ideia. "QR"/"FORM" entram no Marco 3. */
export const IDEA_SOURCES = ["MANUAL", "QR", "FORM"] as const;
export type IdeaSource = (typeof IDEA_SOURCES)[number];

export const IDEA_SOURCE_LABELS: Record<IdeaSource, string> = {
  MANUAL: "Manual",
  QR: "QR Code",
  FORM: "Formulário",
};

/** Origem padrão ao criar uma ideia pela UI. */
export const DEFAULT_IDEA_SOURCE: IdeaSource = "MANUAL";

export function isValidStageType(value: string): value is StageType {
  return (STAGE_TYPES as readonly string[]).includes(value);
}

export function isValidIdeaSource(value: string): value is IdeaSource {
  return (IDEA_SOURCES as readonly string[]).includes(value);
}

/** True se o tipo de estágio é terminal (Aprovada/Reprovada/Convertida). */
export function isFinalStageType(stageType: string): boolean {
  return (
    FINAL_STAGE_TYPES.has(stageType as StageType) ||
    // estágio custom pode marcar isFinal=true no banco; o tipo em si
    // só é considerado final se estiver no conjunto padrão.
    false
  );
}

/**
 * Conjunto padrão de estágios criados junto com um pipeline novo
 * (para o pipeline ser imediatamente usável). O service os cria em
 * ordem 0..n-1. Função pura — testável sem banco.
 */
export function buildDefaultPipelineStages() {
  return [
    { name: "Backlog", stageType: "BACKLOG" as StageType, isFinal: false },
    { name: "Triagem", stageType: "TRIAGE" as StageType, isFinal: false },
    { name: "Em Análise", stageType: "ANALYSIS" as StageType, isFinal: false },
    { name: "Aprovada", stageType: "APPROVED" as StageType, isFinal: true },
    { name: "Reprovada", stageType: "REJECTED" as StageType, isFinal: true },
  ];
}

/**
 * Matriz GUT (Gravidade/Urgência/Tendência) — priorização de
 * backlog, Fase 2/Marco 2. Cada eixo é 1-5 (metodologia padrão);
 * score = gravity*urgency*trend (1-125). Guardado denormalizado em
 * `Idea.gutScore` para permitir ordenar o backlog sem calcular em
 * memória a cada leitura.
 */
export const GUT_MIN = 1;
export const GUT_MAX = 5;

export const GUT_SCALE_LABELS: Record<number, string> = {
  1: "Muito baixa",
  2: "Baixa",
  3: "Média",
  4: "Alta",
  5: "Muito alta",
};

export function isValidGutValue(value: number): boolean {
  return Number.isInteger(value) && value >= GUT_MIN && value <= GUT_MAX;
}

/** Função pura — testável sem banco. */
export function computeGutScore(gravity: number, urgency: number, trend: number): number {
  return gravity * urgency * trend;
}

/**
 * Origens de captura pública (QR Code / formulário, Fase 2/Marco 2):
 * o token do board vira a URL `/public/idea/[publicToken]`.
 */
export const PUBLIC_IDEA_SOURCES: readonly IdeaSource[] = ["QR", "FORM"];