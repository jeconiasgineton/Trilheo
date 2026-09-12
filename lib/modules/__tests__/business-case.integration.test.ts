import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as workspace from "@/lib/modules/workspace/service";
import * as innovation from "@/lib/modules/innovation/service";
import * as bc from "@/lib/modules/business-case/service";
import { BusinessCaseError } from "@/lib/modules/business-case/service";

/**
 * Fase 5 (Business Case) — integração real contra Postgres. Cobre o
 * workflow completo (DRAFT -> PENDING_GESTOR -> PENDING_ADMIN ->
 * APPROVED, com geração automática do "Projeto"/List), o caminho de
 * reprovação, as travas de estado (só edita/exclui em DRAFT, só
 * aprova no estágio certo) e o registro de benefício previsto x
 * realizado.
 */
describe("Business Case (Fase 5)", () => {
  let org: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let ideaId: string;
  let folderId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    org = await createOrganizationWithOwner({
      organizationName: `BC Test ${suffix}`,
      name: "Owner",
      email: `bc-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    const ws = await workspace.createWorkspace(org.organization.id, { name: "WS" });
    const space = await workspace.createSpace(org.organization.id, { workspaceId: ws.id, name: "Space" });
    const folder = await workspace.createFolder(org.organization.id, { spaceId: space.id, name: "Folder" });
    folderId = folder.id;

    const pipeline = await innovation.createPipeline(org.organization.id, { name: "Pipeline" });
    const board = await innovation.createBoard(org.organization.id, { name: "Board", pipelineId: pipeline.id });
    const idea = await innovation.createIdea(org.organization.id, org.user.id, { boardId: board.id, title: "Ideia" });
    ideaId = idea.id;
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: org.organization.id } });
    await db.user.deleteMany({ where: { id: org.user.id } });
  });

  it("cria em DRAFT e permite editar enquanto DRAFT", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC 1",
      capex: 10000,
      opexMonthly: 500,
      benefitMonthly: 2000,
      horizonMonths: 12,
    });
    expect(created.status).toBe("DRAFT");

    const updated = await bc.updateBusinessCase(org.organization.id, created.id, { id: created.id, capex: 12000 });
    expect(updated.capex).toBe(12000);
  });

  it("rejeita edição fora de DRAFT", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC edição",
      capex: 1000,
      opexMonthly: 100,
      benefitMonthly: 300,
      horizonMonths: 6,
    });
    await bc.submitBusinessCase(org.organization.id, created.id);
    await expect(
      bc.updateBusinessCase(org.organization.id, created.id, { id: created.id, capex: 999 }),
    ).rejects.toThrow(BusinessCaseError);
  });

  it("workflow completo: submit -> aprovação Gestor -> aprovação Admin gera Projeto (List)", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC completo",
      capex: 12000,
      opexMonthly: 500,
      benefitMonthly: 2000,
      horizonMonths: 12,
    });

    const submitted = await bc.submitBusinessCase(org.organization.id, created.id);
    expect(submitted.status).toBe("PENDING_GESTOR");

    const gestorApproved = await bc.approveAsGestor(org.organization.id, created.id, org.user.id, {
      id: created.id,
      comment: "Faz sentido",
    });
    expect(gestorApproved.status).toBe("PENDING_ADMIN");
    expect(gestorApproved.gestorApprovedById).toBe(org.user.id);

    const { businessCase: adminApproved, list } = await bc.approveAsAdmin(org.organization.id, created.id, org.user.id, {
      id: created.id,
      targetFolderId: folderId,
      comment: "Aprovado",
    });
    expect(adminApproved.status).toBe("APPROVED");
    expect(adminApproved.generatedListId).toBe(list.id);
    expect(list.name).toBe("Projeto: BC completo"); // fallback: sem projectListName -> "Projeto: <título>"

    const listInDb = await db.list.findUniqueOrThrow({ where: { id: list.id } });
    expect(listInDb.folderId).toBe(folderId);
    expect(listInDb.organizationId).toBe(org.organization.id);
  });

  it("nome do Projeto usa 'Projeto: <título>' quando não informado explicitamente", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "Sem nome customizado",
      capex: 1000,
      opexMonthly: 100,
      benefitMonthly: 500,
      horizonMonths: 6,
    });
    await bc.submitBusinessCase(org.organization.id, created.id);
    await bc.approveAsGestor(org.organization.id, created.id, org.user.id, { id: created.id });
    const { list } = await bc.approveAsAdmin(org.organization.id, created.id, org.user.id, {
      id: created.id,
      targetFolderId: folderId,
    });
    expect(list.name).toBe("Projeto: Sem nome customizado");
  });

  it("rejeita aprovação fora de ordem (Admin não pode aprovar sem passar pelo Gestor)", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC fora de ordem",
      capex: 1000,
      opexMonthly: 100,
      benefitMonthly: 500,
      horizonMonths: 6,
    });
    await bc.submitBusinessCase(org.organization.id, created.id);
    await expect(
      bc.approveAsAdmin(org.organization.id, created.id, org.user.id, { id: created.id, targetFolderId: folderId }),
    ).rejects.toThrow(BusinessCaseError);
  });

  it("caminho de reprovação: pode reprovar em PENDING_GESTOR ou PENDING_ADMIN, não gera Projeto", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC reprovado",
      capex: 5000,
      opexMonthly: 400,
      benefitMonthly: 100, // ruim de propósito
      horizonMonths: 12,
    });
    await bc.submitBusinessCase(org.organization.id, created.id);
    const rejected = await bc.rejectBusinessCase(org.organization.id, created.id, org.user.id, {
      id: created.id,
      reason: "ROI negativo",
    });
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.generatedListId).toBeNull();
    expect(rejected.rejectionReason).toBe("ROI negativo");
  });

  it("só exclui em DRAFT", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC para excluir",
      capex: 100,
      opexMonthly: 10,
      benefitMonthly: 50,
      horizonMonths: 3,
    });
    await bc.submitBusinessCase(org.organization.id, created.id);
    await expect(bc.deleteBusinessCase(org.organization.id, created.id)).rejects.toThrow(BusinessCaseError);

    const draft = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC draft excluível",
      capex: 100,
      opexMonthly: 10,
      benefitMonthly: 50,
      horizonMonths: 3,
    });
    await bc.deleteBusinessCase(org.organization.id, draft.id);
    expect(await db.businessCase.findUnique({ where: { id: draft.id } })).toBeNull();
  });

  it("gestão de benefícios: registra previsto x realizado só em APPROVED, e é idempotente por período", async () => {
    const created = await bc.createBusinessCase(org.organization.id, org.user.id, {
      ideaId,
      title: "BC com benefícios",
      capex: 6000,
      opexMonthly: 200,
      benefitMonthly: 1000,
      horizonMonths: 12,
    });

    await expect(
      bc.recordBenefit(org.organization.id, org.user.id, {
        businessCaseId: created.id,
        period: new Date("2026-01-01").toISOString(),
        actualAmount: 900,
      }),
    ).rejects.toThrow(BusinessCaseError);

    await bc.submitBusinessCase(org.organization.id, created.id);
    await bc.approveAsGestor(org.organization.id, created.id, org.user.id, { id: created.id });
    await bc.approveAsAdmin(org.organization.id, created.id, org.user.id, { id: created.id, targetFolderId: folderId });

    const record1 = await bc.recordBenefit(org.organization.id, org.user.id, {
      businessCaseId: created.id,
      period: new Date("2026-01-01").toISOString(),
      actualAmount: 900,
    });
    expect(record1.plannedAmount).toBe(1000);
    expect(record1.actualAmount).toBe(900);

    // Mesmo período: atualiza em vez de duplicar.
    const record2 = await bc.recordBenefit(org.organization.id, org.user.id, {
      businessCaseId: created.id,
      period: new Date("2026-01-01").toISOString(),
      actualAmount: 950,
    });
    expect(record2.id).toBe(record1.id);
    expect(record2.actualAmount).toBe(950);

    const records = await bc.listBenefitRecords(org.organization.id, created.id);
    expect(records.length).toBe(1);
  });
});
