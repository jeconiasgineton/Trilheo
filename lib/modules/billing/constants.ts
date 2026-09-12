/**
 * Planos (Fase 7 — billing), estrutura combinada com o usuário:
 * Free / Pro / Enterprise. `stripePriceEnvVar` é o nome da variável
 * de ambiente que guarda o Price ID do Stripe para aquele plano —
 * Free não precisa (é o padrão, sem checkout) e Enterprise é contato
 * comercial (sem checkout automático nesta rodada).
 */
export type PlanId = "FREE" | "PRO" | "ENTERPRISE";

export interface Plan {
  label: string;
  /** null = "sob consulta" (Enterprise). */
  priceMonthlyCents: number | null;
  /** null = ilimitado. Limite não é aplicado (bloqueado) nesta rodada — ver CONTEXTO.MD. */
  memberLimit: number | null;
  /** null = sem checkout automático via Stripe para este plano. */
  stripePriceEnvVar: string | null;
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: { label: "Free", priceMonthlyCents: 0, memberLimit: 3, stripePriceEnvVar: null },
  PRO: { label: "Pro", priceMonthlyCents: 9900, memberLimit: 20, stripePriceEnvVar: "STRIPE_PRICE_PRO" },
  ENTERPRISE: { label: "Enterprise", priceMonthlyCents: null, memberLimit: null, stripePriceEnvVar: null },
};

export function isValidPlanId(value: string): value is PlanId {
  return value === "FREE" || value === "PRO" || value === "ENTERPRISE";
}
