import { db } from "@/lib/db";
import { computeFinancials } from "./constants";
import type {
  ApproveAdminInput,
  ApproveGestorInput,
  CreateBusinessCaseInput,
  RecordBenefitInput,
  RejectBusinessCaseInput,
  UpdateBusinessCaseInput,
} from "./schemas";

export class BusinessCaseError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_STATUS",
  ) {
    super(message);
    this.name = "BusinessCaseError";
  }
}

function notFound(entity: string): never {
  throw new BusinessCaseError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

function invalidStatus(message: string): never {
  throw new BusinessCaseError(message, "INVALID_STATUS");
}

async function assertIdeaInOrg(organizationId: string, ideaId: string) {
  const idea = await db.idea.findFirst({ where: { id: ideaId, organizationId }, select: { id: true } });
  if (!idea) notFound("Ideia");
}

async function assertFolderInOrg(organizationId: string, folderId: string) {
  const folder = await db.folder.findFirst({ where: { id: folderId, organizationId }, select: { id: true } });
  if (!folder) notFound("Pasta");
}

const APPROVAL_SELECT = {
  id: true,
  title: true,
  description: true,
  capex: true,
  opexMonthly: true,
  benefitMonthly: true,
  horizonMonths: true,
  status: true,
  ideaId: true,
  createdById: true,
  createdBy: { select: { id: true, name: true, email: true } },
  gestorApprovedById: true,
  gestorApprovedAt: true,
  gestorComment: true,
  gestorApprovedBy: { select: { id: true, name: true, email: true } },
  adminApprovedById: true,
  adminApprovedAt: true,
  adminComment: true,
  adminApprovedBy: { select: { id: true, name: true, email: true } },
  rejectedById: true,
  rejectedAt: true,
  rejectionReason: true,
  rejectedBy: { select: { id: true, name: true, email: true } },
  generatedListId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export function listBusinessCasesForIdea(organizationId: string, ideaId: string) {
  return db.businessCase.findMany({
    where: { organizationId, ideaId },
    orderBy: { createdAt: "desc" },
    select: APPROVAL_SELECT,
  });
}

export async function getBusinessCase(organizationId: string, id: string) {
  const bc = await db.businessCase.findFirst({ where: { id, organizationId }, select: APPROVAL_SELECT });
  if (!bc) notFound("Business Case");
  return bc;
}

export async function createBusinessCase(
  organizationId: string,
  createdById: string,
  input: CreateBusinessCaseInput,
) {
  await assertIdeaInOrg(organizationId, input.ideaId);
  return db.businessCase.create({
    data: {
      organizationId,
      createdById,
      ideaId: input.ideaId,
      title: input.title,
      description: input.description ?? null,
      capex: input.capex,
      opexMonthly: input.opexMonthly,
      benefitMonthly: input.benefitMonthly,
      horizonMonths: input.horizonMonths,
      status: "DRAFT",
    },
    select: APPROVAL_SELECT,
  });
}

async function getOwnStatus(organizationId: string, id: string) {
  const bc = await db.businessCase.findFirst({
    where: { id, organizationId },
    select: { status: true, createdById: true },
  });
  if (!bc) notFound("Business Case");
  return bc;
}

export async function updateBusinessCase(
  organizationId: string,
  id: string,
  input: UpdateBusinessCaseInput,
) {
  const existing = await getOwnStatus(organizationId, id);
  if (existing.status !== "DRAFT") {
    invalidStatus("Só é possível editar um Business Case em rascunho.");
  }
  const { count } = await db.businessCase.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.capex !== undefined && { capex: input.capex }),
      ...(input.opexMonthly !== undefined && { opexMonthly: input.opexMonthly }),
      ...(input.benefitMonthly !== undefined && { benefitMonthly: input.benefitMonthly }),
      ...(input.horizonMonths !== undefined && { horizonMonths: input.horizonMonths }),
    },
  });
  if (count === 0) notFound("Business Case");
  return getBusinessCase(organizationId, id);
}

export async function submitBusinessCase(organizationId: string, id: string) {
  const existing = await getOwnStatus(organizationId, id);
  if (existing.status !== "DRAFT") {
    invalidStatus("Só é possível enviar para aprovação um Business Case em rascunho.");
  }
  await db.businessCase.update({ where: { id }, data: { status: "PENDING_GESTOR" } });
  return getBusinessCase(organizationId, id);
}

export async function approveAsGestor(
  organizationId: string,
  id: string,
  approverId: string,
  input: ApproveGestorInput,
) {
  const existing = await getOwnStatus(organizationId, id);
  if (existing.status !== "PENDING_GESTOR") {
    invalidStatus("Este Business Case não está aguardando aprovação do Gestor.");
  }
  await db.businessCase.update({
    where: { id },
    data: {
      status: "PENDING_ADMIN",
      gestorApprovedById: approverId,
      gestorApprovedAt: new Date(),
      gestorComment: input.comment ?? null,
    },
  });
  return getBusinessCase(organizationId, id);
}

/**
 * Aprovação final — a única transição que gera o "Projeto"
 * automaticamente: cria uma List nova dentro da Folder escolhida
 * (reaproveita a hierarquia existente, não cria uma entidade Project
 * paralela — ver CONTEXTO.MD) e vincula via `generatedListId`.
 */
export async function approveAsAdmin(
  organizationId: string,
  id: string,
  approverId: string,
  input: ApproveAdminInput,
) {
  const existing = await db.businessCase.findFirst({
    where: { id, organizationId },
    select: { status: true, title: true },
  });
  if (!existing) notFound("Business Case");
  if (existing.status !== "PENDING_ADMIN") {
    invalidStatus("Este Business Case não está aguardando aprovação do Admin.");
  }
  await assertFolderInOrg(organizationId, input.targetFolderId);

  const listName = input.projectListName?.trim() || `Projeto: ${existing.title}`;
  const last = await db.list.findFirst({
    where: { folderId: input.targetFolderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  return db.$transaction(async (tx) => {
    const list = await tx.list.create({
      data: {
        organizationId,
        folderId: input.targetFolderId,
        name: listName,
        order: (last?.order ?? -1) + 1,
      },
    });
    // Lê de volta pelo mesmo `tx` (não pelo `db` de fora — a
    // transação ainda não commitou, então uma leitura por outra
    // conexão veria o status antigo). Bug real pego pelo teste de
    // integração desta função.
    const businessCase = await tx.businessCase.update({
      where: { id },
      data: {
        status: "APPROVED",
        adminApprovedById: approverId,
        adminApprovedAt: new Date(),
        adminComment: input.comment ?? null,
        generatedListId: list.id,
      },
      select: APPROVAL_SELECT,
    });
    return { businessCase, list };
  });
}

export async function rejectBusinessCase(
  organizationId: string,
  id: string,
  rejectedById: string,
  input: RejectBusinessCaseInput,
) {
  const existing = await getOwnStatus(organizationId, id);
  if (existing.status !== "PENDING_GESTOR" && existing.status !== "PENDING_ADMIN") {
    invalidStatus("Só é possível reprovar um Business Case aguardando aprovação.");
  }
  await db.businessCase.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedById,
      rejectedAt: new Date(),
      rejectionReason: input.reason,
    },
  });
  return getBusinessCase(organizationId, id);
}

export async function deleteBusinessCase(organizationId: string, id: string) {
  const existing = await getOwnStatus(organizationId, id);
  if (existing.status !== "DRAFT") {
    invalidStatus("Só é possível excluir um Business Case em rascunho.");
  }
  await db.businessCase.deleteMany({ where: { id, organizationId } });
}

// ── Gestão de benefícios (previsto x realizado) ─────────────────────

export function listBenefitRecords(organizationId: string, businessCaseId: string) {
  return db.benefitRecord.findMany({
    where: { organizationId, businessCaseId },
    orderBy: { period: "asc" },
    include: { recordedBy: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Registra (ou atualiza, se já existir para o período) o valor
 * realizado de um mês. `plannedAmount` é congelado do
 * `benefitMonthly` do Business Case aprovado no momento do registro.
 */
export async function recordBenefit(organizationId: string, recordedById: string, input: RecordBenefitInput) {
  const bc = await db.businessCase.findFirst({
    where: { id: input.businessCaseId, organizationId },
    select: { id: true, benefitMonthly: true, status: true },
  });
  if (!bc) notFound("Business Case");
  if (bc.status !== "APPROVED") {
    invalidStatus("Só é possível registrar benefício realizado de um Business Case aprovado.");
  }

  const period = new Date(input.period);
  return db.benefitRecord.upsert({
    where: { businessCaseId_period: { businessCaseId: input.businessCaseId, period } },
    create: {
      organizationId,
      businessCaseId: input.businessCaseId,
      period,
      plannedAmount: bc.benefitMonthly,
      actualAmount: input.actualAmount,
      notes: input.notes ?? null,
      recordedById,
    },
    update: {
      actualAmount: input.actualAmount,
      notes: input.notes ?? null,
      recordedById,
    },
    include: { recordedBy: { select: { id: true, name: true, email: true } } },
  });
}

export { computeFinancials };
