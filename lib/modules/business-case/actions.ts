"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, roleAtLeast, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { BusinessCaseError } from "./service";
import {
  approveAdminSchema,
  approveGestorSchema,
  createBusinessCaseSchema,
  recordBenefitSchema,
  rejectBusinessCaseSchema,
  updateBusinessCaseSchema,
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
    if (err instanceof BusinessCaseError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

/** Autor edita/envia/exclui o próprio rascunho; LIDER+ pode em nome de terceiro (moderação local, mesmo padrão de comment/attachment/tool). */
async function assertOwnerOrModerator(organizationId: string, role: Role, userId: string, businessCaseId: string) {
  if (roleAtLeast(role, "LIDER")) return;
  const bc = await service.getBusinessCase(organizationId, businessCaseId);
  if (bc.createdById !== userId) {
    throw new (class extends Error {
      name = "PermissionError";
    })("Você só pode alterar o próprio Business Case.");
  }
}

export async function listBusinessCasesForIdeaAction(ideaId: string) {
  return withSession(({ organizationId }) => service.listBusinessCasesForIdea(organizationId, ideaId));
}

export async function createBusinessCaseAction(formData: unknown) {
  const parsed = createBusinessCaseSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:create");
    return service.createBusinessCase(organizationId, userId, parsed.data);
  });
}

export async function updateBusinessCaseAction(formData: unknown) {
  const parsed = updateBusinessCaseSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(async ({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:update");
    await assertOwnerOrModerator(organizationId, role, userId, parsed.data.id);
    return service.updateBusinessCase(organizationId, parsed.data.id, parsed.data);
  });
}

export async function submitBusinessCaseAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:submit");
    await assertOwnerOrModerator(organizationId, role, userId, id);
    return service.submitBusinessCase(organizationId, id);
  });
}

export async function approveAsGestorAction(formData: unknown) {
  const parsed = approveGestorSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:approve_gestor");
    return service.approveAsGestor(organizationId, parsed.data.id, userId, parsed.data);
  });
}

export async function approveAsAdminAction(formData: unknown) {
  const parsed = approveAdminSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:approve_admin");
    return service.approveAsAdmin(organizationId, parsed.data.id, userId, parsed.data);
  });
}

export async function rejectBusinessCaseAction(formData: unknown) {
  const parsed = rejectBusinessCaseSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(async ({ organizationId, role, id: userId }) => {
    const current = await service.getBusinessCase(organizationId, parsed.data.id);
    // Rejeitar exige o mesmo papel mínimo da aprovação daquele estágio.
    requirePermission(role, current.status === "PENDING_ADMIN" ? "businesscase:approve_admin" : "businesscase:approve_gestor");
    return service.rejectBusinessCase(organizationId, parsed.data.id, userId, parsed.data);
  });
}

export async function deleteBusinessCaseAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    await assertOwnerOrModerator(organizationId, role, userId, id);
    return service.deleteBusinessCase(organizationId, id);
  });
}

export async function listBenefitRecordsAction(businessCaseId: string) {
  return withSession(({ organizationId }) => service.listBenefitRecords(organizationId, businessCaseId));
}

export async function recordBenefitAction(formData: unknown) {
  const parsed = recordBenefitSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "businesscase:record_benefit");
    return service.recordBenefit(organizationId, userId, parsed.data);
  });
}
