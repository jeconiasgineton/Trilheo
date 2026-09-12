import { describe, expect, it } from "vitest";
import {
  buildDefaultPipelineStages,
  isFinalStageType,
  isValidIdeaSource,
  isValidStageType,
  STAGE_TYPES,
} from "./constants";
import { slugify } from "./service";

/**
 * Testes das funções puras do módulo de inovação (sem banco — as
 * funções que tocam o Prisma seguem pendentes de Postgres de teste,
 * mesma pendência dos módulos auth/workspace/task, ver CONTEXTO.MD).
 */
describe("innovation constants", () => {
  it("valida tipos de estágio conhecidos", () => {
    for (const t of STAGE_TYPES) {
      expect(isValidStageType(t)).toBe(true);
    }
    expect(isValidStageType("BACKLOG")).toBe(true);
    expect(isValidStageType("nope")).toBe(false);
    expect(isValidStageType("")).toBe(false);
  });

  it("valida origens de ideia", () => {
    expect(isValidIdeaSource("MANUAL")).toBe(true);
    expect(isValidIdeaSource("QR")).toBe(true);
    expect(isValidIdeaSource("FORM")).toBe(true);
    expect(isValidIdeaSource("import")).toBe(false);
  });

  it("marca apenas tipos terminais como finais", () => {
    expect(isFinalStageType("APPROVED")).toBe(true);
    expect(isFinalStageType("REJECTED")).toBe(true);
    expect(isFinalStageType("CONVERTED")).toBe(true);
    expect(isFinalStageType("BACKLOG")).toBe(false);
    expect(isFinalStageType("TRIAGE")).toBe(false);
    expect(isFinalStageType("ANALYSIS")).toBe(false);
  });

  it("buildDefaultPipelineStages devolve estágios em ordem com finais marcados", () => {
    const stages = buildDefaultPipelineStages();
    expect(stages.length).toBe(5);
    expect(stages.map((s) => s.stageType)).toEqual([
      "BACKLOG",
      "TRIAGE",
      "ANALYSIS",
      "APPROVED",
      "REJECTED",
    ]);
    // Aprovada/Reprovada são finais; os demais não.
    expect(stages[3].isFinal).toBe(true);
    expect(stages[4].isFinal).toBe(true);
    expect(stages[0].isFinal).toBe(false);
  });
});

describe("slugify", () => {
  it("normaliza acentos, espaços e caixa", () => {
    expect(slugify("Inovação de Produto")).toBe("inovacao-de-produto");
    expect(slugify("  Melhoria Contínua ")).toBe("melhoria-continua");
    expect(slugify("Pipeline #1!")).toBe("pipeline-1");
  });

  it("colapsa separadores repetidos e remove bordas", () => {
    expect(slugify("a---b")).toBe("a-b");
    expect(slugify("---x---")).toBe("x");
  });

  it("trunca em 60 caracteres", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBe(60);
  });
});