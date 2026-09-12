import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { isValidPlanId } from "./constants";
import { planIdFromPriceId } from "./service";

describe("isValidPlanId", () => {
  it("aceita os três planos", () => {
    expect(isValidPlanId("FREE")).toBe(true);
    expect(isValidPlanId("PRO")).toBe(true);
    expect(isValidPlanId("ENTERPRISE")).toBe(true);
  });

  it("rejeita qualquer outra string", () => {
    expect(isValidPlanId("PREMIUM")).toBe(false);
    expect(isValidPlanId("")).toBe(false);
  });
});

describe("planIdFromPriceId", () => {
  const originalEnv = process.env.STRIPE_PRICE_PRO;

  beforeEach(() => {
    process.env.STRIPE_PRICE_PRO = "price_test_pro_123";
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_PRO = originalEnv;
  });

  it("resolve o plano cujo price id do Stripe bate com a env var configurada", () => {
    expect(planIdFromPriceId("price_test_pro_123")).toBe("PRO");
  });

  it("devolve null para um price id desconhecido", () => {
    expect(planIdFromPriceId("price_desconhecido")).toBeNull();
  });
});
