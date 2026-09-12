"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { CommentError } from "./service";
import { createCommentSchema } from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mesmo molde do módulo innovation: sessão → zod → service. A
 * checagem de permissão de criação é uma ação simples
 * (requirePermission); a de exclusão depende de posse (autor exclui
 * o próprio; LIDER+ exclui de terceiro — moderação local, ver
 * CONTEXTO.MD), então fica dentro do handler de deleteCommentAction.
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
    if (err instanceof CommentError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

export async function createCommentAction(formData: unknown) {
  const parsed = createCommentSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "comment:create");
    return service.createComment(organizationId, userId, parsed.data);
  });
}

export async function deleteCommentAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    const comment = await service.getComment(organizationId, id);
    if (comment.authorId !== userId) {
      requirePermission(role, "comment:delete");
    }
    return service.deleteComment(organizationId, id);
  });
}
