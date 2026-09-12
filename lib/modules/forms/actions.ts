"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { FormError } from "./service";
import {
  createFormTemplateSchema,
  replaceFieldsSchema,
  submitFormSchema,
  updateFormTemplateSchema,
} from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function withSession<T>(
  run: (session: { organizationId: string; role: Role; id: string }) => Promise<T>,
): Promise<ActionResult<T>> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    const data = await run(session.user);
    return { ok: true, data };
  } catch (err) {
    if (err instanceof FormError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

export async function listTemplatesAction(onlyActive?: boolean) {
  return withSession(({ organizationId }) => service.listTemplates(organizationId, { onlyActive }));
}

export async function getTemplateAction(id: string) {
  return withSession(({ organizationId }) => service.getTemplateWithFields(organizationId, id));
}

export async function createTemplateAction(formData: unknown) {
  const parsed = createFormTemplateSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "form:manage");
    return service.createTemplate(organizationId, userId, parsed.data);
  });
}

export async function updateTemplateAction(formData: unknown) {
  const parsed = updateFormTemplateSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "form:manage");
    return service.updateTemplate(organizationId, parsed.data.id, parsed.data);
  });
}

export async function replaceFieldsAction(formData: unknown) {
  const parsed = replaceFieldsSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "form:manage");
    return service.replaceFields(organizationId, parsed.data);
  });
}

export async function deleteTemplateAction(id: string) {
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "form:manage");
    return service.deleteTemplate(organizationId, id);
  });
}

export async function listSubmissionsAction(templateId: string) {
  return withSession(({ organizationId }) => service.listSubmissions(organizationId, templateId));
}

export async function getSubmissionAction(id: string) {
  return withSession(({ organizationId }) => service.getSubmission(organizationId, id));
}

/**
 * Usada tanto pelo envio "ao vivo" (online) quanto pelo fluxo de
 * sincronização da fila offline (mesma action, chamada depois para
 * cada item pendente quando a conexão volta).
 */
export async function submitFormAction(formData: unknown) {
  const parsed = submitFormSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "form:submit");
    return service.submitForm(organizationId, userId, parsed.data);
  });
}
