import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as innovation from "@/lib/modules/innovation/service";
import { InnovationError } from "@/lib/modules/innovation/service";

/**
 * Fase 2/Marco 2 — captura pública (QR Code/formulário) e Matriz
 * GUT. Integração real contra Postgres: prova que um board com
 * captura desabilitada recusa envio, que o envio público não exige
 * conta (authorId nulo), que regenerar o token invalida o anterior,
 * e que o score GUT é calculado e ordena o backlog corretamente.
 */
describe("captura pública e Matriz GUT", () => {
  let org: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let pipeline: Awaited<ReturnType<typeof innovation.createPipeline>>;
  let board: Awaited<ReturnType<typeof innovation.createBoard>>;
  const suffix = Date.now();

  beforeAll(async () => {
    org = await createOrganizationWithOwner({
      organizationName: `Public Capture Test ${suffix}`,
      name: "Owner",
      email: `public-capture-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    pipeline = await innovation.createPipeline(org.organization.id, { name: "Pipeline" });
    board = await innovation.createBoard(org.organization.id, {
      name: "Board público",
      pipelineId: pipeline.id,
    });
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: org.organization.id } });
    await db.user.deleteMany({ where: { id: org.user.id } });
  });

  it("board recém-criado tem captura pública desabilitada por padrão", async () => {
    const fresh = await db.ideaBoard.findUniqueOrThrow({ where: { id: board.id } });
    expect(fresh.publicCaptureEnabled).toBe(false);
    expect(fresh.publicToken).toBeTruthy();
  });

  it("envio público falha enquanto a captura está desabilitada", async () => {
    await expect(
      innovation.submitPublicIdea({
        publicToken: board.publicToken,
        title: "Ideia via QR antes de habilitar",
        source: "QR",
      }),
    ).rejects.toThrow(InnovationError);
    expect(await db.idea.count({ where: { boardId: board.id } })).toBe(0);
  });

  it("após habilitar, envio público cria Idea sem authorId (autor nulo) com os dados do formulário", async () => {
    await innovation.toggleBoardPublicCapture(org.organization.id, board.id, true);

    const idea = await innovation.submitPublicIdea({
      publicToken: board.publicToken,
      title: "Ideia via formulário público",
      description: "Enviada sem conta",
      submitterName: "Visitante Anônimo",
      submitterEmail: "visitante@fora.com",
      source: "FORM",
    });

    expect(idea.authorId).toBeNull();
    expect(idea.submitterName).toBe("Visitante Anônimo");
    expect(idea.submitterEmail).toBe("visitante@fora.com");
    expect(idea.organizationId).toBe(org.organization.id);
    expect(idea.boardId).toBe(board.id);

    const firstStage = (await innovation.getPipeline(org.organization.id, pipeline.id)).stages[0];
    expect(idea.pipelineStageId).toBe(firstStage.id);
  });

  it("regenerar o token invalida o anterior e habilita o novo", async () => {
    const before = await db.ideaBoard.findUniqueOrThrow({ where: { id: board.id } });
    const oldToken = before.publicToken;

    const updated = await innovation.regenerateBoardPublicToken(org.organization.id, board.id);
    expect(updated.publicToken).not.toBe(oldToken);

    await expect(
      innovation.submitPublicIdea({ publicToken: oldToken, title: "Não deveria funcionar", source: "QR" }),
    ).rejects.toThrow(InnovationError);

    const idea = await innovation.submitPublicIdea({
      publicToken: updated.publicToken,
      title: "Funciona com o token novo",
      source: "QR",
    });
    expect(idea.title).toBe("Funciona com o token novo");
  });

  it("desabilitar a captura volta a recusar envios, mesmo com o token correto", async () => {
    await innovation.toggleBoardPublicCapture(org.organization.id, board.id, false);
    const current = await db.ideaBoard.findUniqueOrThrow({ where: { id: board.id } });
    await expect(
      innovation.submitPublicIdea({ publicToken: current.publicToken, title: "hack", source: "QR" }),
    ).rejects.toThrow(InnovationError);
  });

  it("setIdeaGut calcula gravity*urgency*trend e persiste", async () => {
    const idea = await innovation.createIdea(org.organization.id, org.user.id, {
      boardId: board.id,
      title: "Ideia para pontuar",
    });

    const scored = await innovation.setIdeaGut(org.organization.id, {
      ideaId: idea.id,
      gravity: 5,
      urgency: 4,
      trend: 3,
    });

    expect(scored.gutScore).toBe(60);
    const fromDb = await db.idea.findUniqueOrThrow({ where: { id: idea.id } });
    expect(fromDb.gutScore).toBe(60);
    expect(fromDb.gutGravity).toBe(5);
  });

  it("listIdeasByGutScore ordena por score desc, com nulos por último", async () => {
    const withoutGut = await innovation.createIdea(org.organization.id, org.user.id, {
      boardId: board.id,
      title: "Sem GUT ainda",
    });
    const lowScore = await innovation.createIdea(org.organization.id, org.user.id, {
      boardId: board.id,
      title: "GUT baixo",
    });
    await innovation.setIdeaGut(org.organization.id, { ideaId: lowScore.id, gravity: 1, urgency: 1, trend: 1 });
    const highScore = await innovation.createIdea(org.organization.id, org.user.id, {
      boardId: board.id,
      title: "GUT alto",
    });
    await innovation.setIdeaGut(org.organization.id, { ideaId: highScore.id, gravity: 5, urgency: 5, trend: 5 });

    const ordered = await innovation.listIdeasByGutScore(org.organization.id, board.id);
    const ids = ordered.map((i) => i.id);

    expect(ids.indexOf(highScore.id)).toBeLessThan(ids.indexOf(lowScore.id));
    expect(ids.indexOf(lowScore.id)).toBeLessThan(ids.indexOf(withoutGut.id));
  });
});
