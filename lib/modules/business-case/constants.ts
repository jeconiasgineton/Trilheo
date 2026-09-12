/**
 * Business Case (Fase 5) — workflow fixo em 4 estados:
 * DRAFT -> PENDING_GESTOR -> PENDING_ADMIN -> APPROVED
 *                        \-> REJECTED (a partir de qualquer PENDING_*)
 */
export const BUSINESS_CASE_STATUSES = [
  "DRAFT",
  "PENDING_GESTOR",
  "PENDING_ADMIN",
  "APPROVED",
  "REJECTED",
] as const;
export type BusinessCaseStatus = (typeof BUSINESS_CASE_STATUSES)[number];

export const BUSINESS_CASE_STATUS_LABELS: Record<BusinessCaseStatus, string> = {
  DRAFT: "Rascunho",
  PENDING_GESTOR: "Aguardando Gestor",
  PENDING_ADMIN: "Aguardando Admin",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

export function isValidBusinessCaseStatus(value: string): value is BusinessCaseStatus {
  return (BUSINESS_CASE_STATUSES as readonly string[]).includes(value);
}

// ── Cálculos financeiros — funções puras, testáveis sem banco ───────

export function computeTotalCost(capex: number, opexMonthly: number, horizonMonths: number): number {
  return capex + opexMonthly * horizonMonths;
}

export function computeTotalBenefit(benefitMonthly: number, horizonMonths: number): number {
  return benefitMonthly * horizonMonths;
}

export function computeNetBenefit(totalBenefit: number, totalCost: number): number {
  return totalBenefit - totalCost;
}

/** ROI em %, no horizonte definido. `null` se o custo total for zero (divisão indefinida). */
export function computeRoiPercent(netBenefit: number, totalCost: number): number | null {
  if (totalCost === 0) return null;
  return (netBenefit / totalCost) * 100;
}

/**
 * Payback em meses: quanto tempo o fluxo de caixa mensal (benefício -
 * OPEX) leva para cobrir o CAPEX. `null` se o fluxo mensal não for
 * positivo (o investimento nunca se paga, no modelo simples).
 */
export function computePaybackMonths(capex: number, benefitMonthly: number, opexMonthly: number): number | null {
  const monthlyNetCashFlow = benefitMonthly - opexMonthly;
  if (monthlyNetCashFlow <= 0) return null;
  return capex / monthlyNetCashFlow;
}

export type BusinessCaseFinancials = {
  totalCost: number;
  totalBenefit: number;
  netBenefit: number;
  roiPercent: number | null;
  paybackMonths: number | null;
};

/** Agrega os cinco cálculos de uma vez — usado tanto no client (preview ao vivo) quanto no service. */
export function computeFinancials(
  capex: number,
  opexMonthly: number,
  benefitMonthly: number,
  horizonMonths: number,
): BusinessCaseFinancials {
  const totalCost = computeTotalCost(capex, opexMonthly, horizonMonths);
  const totalBenefit = computeTotalBenefit(benefitMonthly, horizonMonths);
  const netBenefit = computeNetBenefit(totalBenefit, totalCost);
  return {
    totalCost,
    totalBenefit,
    netBenefit,
    roiPercent: computeRoiPercent(netBenefit, totalCost),
    paybackMonths: computePaybackMonths(capex, benefitMonthly, opexMonthly),
  };
}
