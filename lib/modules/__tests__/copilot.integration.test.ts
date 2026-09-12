import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as innovation from "@/lib/modules/innovation/service";
import * as copilot from "@/lib/modules/copilot/service";
import { CopilotError } from "@/lib/modules/copilot/service";

/**
 * Fase 6 (Innovation Copilot) — cobre só os caminhos que não exigem
 * bater na API real do Gemini (custaria dinheiro/rede a cada run de
 * teste): contexto não encontrado (inclusive cross-tenant) e chave
 * não configurada. A chamada de verdade ao Gemini foi validada
 * manualmente no navegador (ver CONTEXTO.MD) — resposta correta e
 * fundamentada nos dados reais da Idea/Task testadas.
 */
describe("Innovation Copilot (Fase 6)", () => {
  let orgA: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let orgB: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let ideaA: Awaited<ReturnType<typeof innovation.createIdea>>;
  let ideaB: Awaited<ReturnType<typeof innovation.createIdea>>;
  const suffix = Date.now();

  beforeAll(async () => {
    orgA = await createOrganizationWithOwner({
      organizationName: `Copilot Test A ${suffix}`,
      name: "Owner A",
      email: `copilot-a-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    orgB = await createOrganizationWithOwner({
      organizationName: `Copilot Test B ${suffix}`,
      name: "Owner B",
      email: `copilot-b-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    const pipelineA = await innovation.createPipeline(orgA.organization.id, { name: "Pipeline A" });
    const boardA = await innovation.createBoard(orgA.organization.id, { name: "Board A", pipelineId: pipelineA.id });
    ideaA = await innovation.createIdea(orgA.organization.id, orgA.user.id, { boardId: boardA.id, title: "Ideia A" });

    const pipelineB = await innovation.createPipeline(orgB.organization.id, { name: "Pipeline B" });
    const boardB = await innovation.createBoard(orgB.organization.id, { name: "Board B", pipelineId: pipelineB.id });
    ideaB = await innovation.createIdea(orgB.organization.id, orgB.user.id, { boardId: boardB.id, title: "Ideia B" });
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: { in: [orgA.organization.id, orgB.organization.id] } } });
    await db.user.deleteMany({ where: { id: { in: [orgA.user.id, orgB.user.id] } } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("recusa perguntar sobre um contexto que não existe", async () => {
    await expect(
      copilot.askCopilot(orgA.organization.id, {
        contextType: "Idea",
        contextId: "id-que-nao-existe",
        question: "oi",
      }),
    ).rejects.toThrow(CopilotError);
  });

  it("recusa perguntar sobre uma Idea de outra organização (isolamento cross-tenant)", async () => {
    await expect(
      copilot.askCopilot(orgA.organization.id, {
        contextType: "Idea",
        contextId: ideaB.id,
        question: "oi",
      }),
    ).rejects.toThrow(CopilotError);
  });

  it("devolve NOT_CONFIGURED quando GEMINI_API_KEY não está definida, sem tentar chamar a API", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    try {
      await copilot.askCopilot(orgA.organization.id, {
        contextType: "Idea",
        contextId: ideaA.id,
        question: "oi",
      });
      expect.unreachable("deveria ter lançado CopilotError");
    } catch (err) {
      expect(err).toBeInstanceOf(CopilotError);
      expect((err as InstanceType<typeof CopilotError>).code).toBe("NOT_CONFIGURED");
    }
  });
});
