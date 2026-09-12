import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, getClientIp, __resetRateLimitsForTests } from "./rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    __resetRateLimitsForTests();
  });

  it("permite até o limite dentro da janela", () => {
    const key = "test-key-1";
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).allowed).toBe(true);
    }
  });

  it("bloqueia ao exceder o limite dentro da janela", () => {
    const key = "test-key-2";
    for (let i = 0; i < 5; i++) checkRateLimit(key, 5, 60_000);
    const result = checkRateLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("mantém contadores independentes por chave", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("key-a", 5, 60_000);
    expect(checkRateLimit("key-a", 5, 60_000).allowed).toBe(false);
    expect(checkRateLimit("key-b", 5, 60_000).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefere x-forwarded-for e usa só o primeiro IP da lista", () => {
    expect(getClientIp({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })).toBe("1.2.3.4");
  });

  it("cai para x-real-ip quando x-forwarded-for está ausente", () => {
    expect(getClientIp({ "x-real-ip": "9.9.9.9" })).toBe("9.9.9.9");
  });

  it("devolve 'unknown' quando nenhum header está presente", () => {
    expect(getClientIp({})).toBe("unknown");
  });

  it("funciona com um objeto Headers de verdade", () => {
    const h = new Headers();
    h.set("x-forwarded-for", "10.0.0.1");
    expect(getClientIp(h)).toBe("10.0.0.1");
  });
});
