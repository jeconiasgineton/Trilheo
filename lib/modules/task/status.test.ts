import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK_STATUS,
  isValidPriority,
  isValidStatus,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "./constants";

describe("isValidStatus", () => {
  it("aceita todos os status padrão", () => {
    for (const s of TASK_STATUSES) expect(isValidStatus(s)).toBe(true);
  });

  it("rejeita status desconhecido", () => {
    expect(isValidStatus("nao_existe")).toBe(false);
  });

  it("status padrão é um status válido", () => {
    expect(isValidStatus(DEFAULT_TASK_STATUS)).toBe(true);
  });
});

describe("isValidPriority", () => {
  it("aceita todas as prioridades padrão", () => {
    for (const p of TASK_PRIORITIES) expect(isValidPriority(p)).toBe(true);
  });

  it("rejeita prioridade desconhecida", () => {
    expect(isValidPriority("critica")).toBe(false);
  });
});
