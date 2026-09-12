import { describe, expect, it } from "vitest";
import { computeGutScore, GUT_MAX, GUT_MIN, isValidGutValue } from "./constants";

describe("computeGutScore", () => {
  it("multiplica os três eixos", () => {
    expect(computeGutScore(5, 5, 5)).toBe(125);
    expect(computeGutScore(1, 1, 1)).toBe(1);
    expect(computeGutScore(3, 4, 2)).toBe(24);
  });
});

describe("isValidGutValue", () => {
  it("aceita valores inteiros de 1 a 5", () => {
    for (let v = GUT_MIN; v <= GUT_MAX; v++) expect(isValidGutValue(v)).toBe(true);
  });

  it("rejeita valores fora do intervalo", () => {
    expect(isValidGutValue(0)).toBe(false);
    expect(isValidGutValue(6)).toBe(false);
  });

  it("rejeita valores não inteiros", () => {
    expect(isValidGutValue(2.5)).toBe(false);
  });
});
