import { db } from "@/lib/db";
import { CHOICE_FIELD_TYPES, validateAnswers } from "./constants";
import type {
  CreateFormTemplateInput,
  ReplaceFieldsInput,
  SubmitFormInput,
  UpdateFormTemplateInput,
} from "./schemas";

export class FormError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_ANSWERS" | "HAS_SUBMISSIONS" | "TEMPLATE_INACTIVE",
  ) {
    super(message);
    this.name = "FormError";
  }
}

function notFound(entity: string): never {
  throw new FormError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

const FIELD_SELECT = {
  id: true,
  order: true,
  type: true,
  label: true,
  required: true,
  options: true,
} as const;

// ── Template ─────────────────────────────────────────────────────────

export function listTemplates(organizationId: string, opts?: { onlyActive?: boolean }) {
  return db.formTemplate.findMany({
    where: { organizationId, ...(opts?.onlyActive ? { isActive: true } : {}) },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { fields: true, submissions: true } },
    },
  });
}

export async function getTemplateWithFields(organizationId: string, id: string) {
  const template = await db.formTemplate.findFirst({
    where: { id, organizationId },
    include: { fields: { orderBy: { order: "asc" }, select: FIELD_SELECT } },
  });
  if (!template) notFound("Formulário");
  return template;
}

export async function createTemplate(
  organizationId: string,
  createdById: string,
  input: CreateFormTemplateInput,
) {
  return db.formTemplate.create({
    data: {
      organizationId,
      createdById,
      title: input.title,
      description: input.description ?? null,
    },
  });
}

export async function updateTemplate(
  organizationId: string,
  id: string,
  input: UpdateFormTemplateInput,
) {
  const { count } = await db.formTemplate.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });
  if (count === 0) notFound("Formulário");
  return db.formTemplate.findUniqueOrThrow({ where: { id } });
}

/**
 * Substitui a lista inteira de campos — mais simples que reconciliar
 * add/edit/remove/reorder individualmente. Campos com `id` existente
 * são atualizados no lugar (preserva o vínculo com submissões
 * antigas via `FormSubmission.answers[fieldId]`); campos sem `id`
 * são criados; campos que não vieram na lista são excluídos.
 */
export async function replaceFields(organizationId: string, input: ReplaceFieldsInput) {
  const template = await db.formTemplate.findFirst({
    where: { id: input.templateId, organizationId },
    select: { id: true },
  });
  if (!template) notFound("Formulário");

  const existing = await db.formField.findMany({
    where: { templateId: input.templateId },
    select: { id: true },
  });
  const keepIds = new Set(input.fields.map((f) => f.id).filter(Boolean));
  const toDelete = existing.filter((f) => !keepIds.has(f.id)).map((f) => f.id);

  await db.$transaction(async (tx) => {
    if (toDelete.length > 0) {
      await tx.formField.deleteMany({ where: { id: { in: toDelete }, templateId: input.templateId } });
    }
    for (let i = 0; i < input.fields.length; i++) {
      const f = input.fields[i];
      const options = f.options && CHOICE_FIELD_TYPES.has(f.type) ? f.options : undefined;
      if (f.id) {
        await tx.formField.updateMany({
          where: { id: f.id, templateId: input.templateId, organizationId },
          data: { order: i, type: f.type, label: f.label, required: f.required, options },
        });
      } else {
        await tx.formField.create({
          data: {
            organizationId,
            templateId: input.templateId,
            order: i,
            type: f.type,
            label: f.label,
            required: f.required,
            options,
          },
        });
      }
    }
  });

  return getTemplateWithFields(organizationId, input.templateId);
}

export async function deleteTemplate(organizationId: string, id: string) {
  const submissionCount = await db.formSubmission.count({
    where: { templateId: id, organizationId },
  });
  if (submissionCount > 0) {
    throw new FormError(
      "Este formulário já tem coletas registradas — desative em vez de excluir (preserva o histórico).",
      "HAS_SUBMISSIONS",
    );
  }
  const { count } = await db.formTemplate.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Formulário");
}

// ── Submissão (coleta) ───────────────────────────────────────────────

export function listSubmissions(organizationId: string, templateId: string) {
  return db.formSubmission.findMany({
    where: { organizationId, templateId },
    orderBy: { createdAt: "desc" },
    include: { submittedBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function getSubmission(organizationId: string, id: string) {
  const submission = await db.formSubmission.findFirst({
    where: { id, organizationId },
    include: {
      submittedBy: { select: { id: true, name: true, email: true } },
      template: { select: { id: true, title: true } },
    },
  });
  if (!submission) notFound("Coleta");
  return submission;
}

/**
 * Registra uma coleta. Valida `answers` contra os campos do
 * template no momento do envio (não no momento do preenchimento —
 * relevante para o fluxo offline: o app pode ter ficado minutos ou
 * horas com o formulário preenchido na fila antes de conseguir
 * enviar; se o template mudou nesse meio tempo, o erro aparece aqui,
 * e o app mantém o item na fila para o usuário corrigir).
 */
export async function submitForm(organizationId: string, submittedById: string | null, input: SubmitFormInput) {
  const template = await db.formTemplate.findFirst({
    where: { id: input.templateId, organizationId },
    include: { fields: { select: FIELD_SELECT } },
  });
  if (!template) notFound("Formulário");
  if (!template.isActive) {
    throw new FormError("Este formulário foi desativado e não aceita novas coletas.", "TEMPLATE_INACTIVE");
  }

  const error = validateAnswers(template.fields, input.answers as Record<string, unknown>);
  if (error) {
    throw new FormError(error, "INVALID_ANSWERS");
  }

  return db.formSubmission.create({
    data: {
      organizationId,
      templateId: input.templateId,
      submittedById,
      answers: input.answers as never,
      clientSubmittedAt: input.clientSubmittedAt ? new Date(input.clientSubmittedAt) : null,
    },
  });
}
