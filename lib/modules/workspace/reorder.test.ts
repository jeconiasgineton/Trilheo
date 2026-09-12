import { describe, expect, it } from "vitest";
import { computeOrderUpdates, isCompleteOrderSet } from "./reorder";

describe("computeOrderUpdates", () => {
  it("atribui order 0..n-1 na ordem recebida", () => {
    expect(computeOrderUpdates(["b", "a", "c"])).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
      { id: "c", order: 2 },
    ]);
  });
});

describe("isCompleteOrderSet", () => {
  it("true quando os conjuntos são iguais, em qualquer ordem", () => {
    expect(isCompleteOrderSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
  });

  it("false quando o payload é um subconjunto (id faltando)", () => {
    expect(isCompleteOrderSet(["a", "b", "c", "d"], ["a", "b"])).toBe(false);
  });

  it("false quando o payload tem um id que não pertence ao conjunto atual", () => {
    expect(isCompleteOrderSet(["a", "b"], ["a", "x"])).toBe(false);
  });

  it("false quando o payload tem duplicata", () => {
    expect(isCompleteOrderSet(["a", "b"], ["a", "a"])).toBe(false);
  });

  it("true para conjunto vazio em ambos os lados", () => {
    expect(isCompleteOrderSet([], [])).toBe(true);
  });
});
