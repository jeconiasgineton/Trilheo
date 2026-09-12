"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { ToolError } from "./service";
import { createToolSchema, updateToolSchema } from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mesmo molde de comment/attachment: criação é `tool:create`
 * (MEMBRO+); exclusão segue moderação local — autor exclui a
 * própria, LIDER+ exclui de terceiro (`tool:delete`).
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
    if (err instanceof ToolError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

export async function createToolAction(formData: unknown) {
  const parsed = createToolSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    requirePermission(role, "tool:create");
    return service.createTool(organizationId, userId, parsed.data);
  });
}

export async function updateToolAction(formData: unknown) {
  const parsed = updateToolSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "tool:update");
    return service.updateTool(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteToolAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    const tool = await service.getTool(organizationId, id);
    if (tool.createdById !== userId) {
      requirePermission(role, "tool:delete");
    }
    return service.deleteTool(organizationId, id);
  });
}
