"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { AttachmentError } from "./service";
import { createAttachmentSchema } from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mesmo molde de comment/actions.ts: quem faz upload em
 * app/api/upload registra o metadado aqui, depois de confirmado que
 * o alvo (Task/Idea) pertence à organização (assertAttachableInOrg no
 * service). Exclusão: autor exclui o próprio anexo; LIDER+ exclui de
 * terceiro (moderação local).
 */
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
    if (err instanceof AttachmentError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

export async function createAttachmentAction(formData: unknown) {
  const parsed = createAttachmentSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "attachment:create");
    return service.createAttachment(organizationId, userId, parsed.data);
  });
}

export async function deleteAttachmentAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    const attachment = await service.getAttachment(organizationId, id);
    if (attachment.uploadedById !== userId) {
      requirePermission(role, "attachment:delete");
    }
    return service.deleteAttachment(organizationId, id);
  });
}
