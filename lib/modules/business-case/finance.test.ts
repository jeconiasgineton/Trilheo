import { describe, expect, it } from "vitest";
import {
  computeFinancials,
  computeNetBenefit,
  computePaybackMonths,
  computeRoiPercent,
  computeTotalBenefit,
  computeTotalCost,
} from "./constants";

describe("computeTotalCost", () => {
  it("soma CAPEX + OPEX mensal * horizonte", () => {
    expect(computeTotalCost(10000, 500, 12)).toBe(16000);
  });
});

describe("computeTotalBenefit", () => {
  it("multiplica benefício mensal pelo horizonte", () => {
    expect(computeTotalBenefit(1000, 12)).toBe(12000);
  });
});

describe("computeNetBenefit", () => {
  it("subtrai custo total do benefício total", () => {
    expect(computeNetBenefit(12000, 16000)).toBe(-4000);
  });
});

describe("computeRoiPercent", () => {
  it("calcula ROI em porcentagem", () => {
    expect(computeRoiPercent(4000, 16000)).toBe(25);
  });

  it("retorna null quando o custo total é zero", () => {
    expect(computeRoiPercent(0, 0)).toBeNull();
  });
});

describe("computePaybackMonths", () => {
  it("calcula meses até o CAPEX se pagar", () => {
    // CAPEX 12000, fluxo mensal líquido = 2000 - 500 = 1500 -> 8 meses
    expect(computePaybackMonths(12000, 2000, 500)).toBe(8);
  });

  it("retorna null quando o fluxo mensal líquido não é positivo", () => {
    expect(computePaybackMonths(12000, 500, 500)).toBeNull();
    expect(computePaybackMonths(12000, 400, 500)).toBeNull();
  });
});

describe("computeFinancials", () => {
  it("agrega os cinco cálculos consistentemente (caso positivo)", () => {
    const f = computeFinancials(12000, 500, 2000, 12);
    expect(f.totalCost).toBe(18000);
    expect(f.totalBenefit).toBe(24000);
    expect(f.netBenefit).toBe(6000);
    expect(f.roiPercent).toBeCloseTo(33.33, 1);
    expect(f.paybackMonths).toBe(8);
  });

  it("agrega os cinco cálculos consistentemente (caso negativo, nunca se paga)", () => {
    const f = computeFinancials(12000, 1000, 800, 12);
    expect(f.netBenefit).toBeLessThan(0);
    expect(f.roiPercent).toBeLessThan(0);
    expect(f.paybackMonths).toBeNull();
  });
});
