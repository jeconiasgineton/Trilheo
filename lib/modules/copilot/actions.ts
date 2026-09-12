"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission } from "@/lib/modules/permissions";
import * as service from "./service";
import { CopilotError } from "./service";
import { askCopilotSchema } from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function askCopilotAction(formData: unknown): Promise<ActionResult<string>> {
  const parsed = askCopilotSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false, error: "Sessão expirada. Faça login novamente." };
  }
  try {
    requirePermission(session.user.role, "copilot:use");
    const answer = await service.askCopilot(session.user.organizationId, parsed.data);
    return { ok: true, data: answer };
  } catch (err) {
    if (err instanceof CopilotError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para usar o Copilot." };
    }
    throw err;
  }
}
