"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Action, type Role } from "@/lib/modules/permissions";
import * as service from "./service";
import { WorkspaceError } from "./service";
import {
  createFolderSchema,
  createListSchema,
  createSpaceSchema,
  createWorkspaceSchema,
  reorderSchema,
  updateFolderSchema,
  updateListSchema,
  updateSpaceSchema,
  updateWorkspaceSchema,
} from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mesmo molde dos demais módulos: sessão → zod → requirePermission →
 * service (que filtra por organizationId). Reordenar não tem Action
 * própria em permissions/actions.ts — reusa `*:update` como
 * permissão mínima para reordenar aquele nível (ver CONTEXTO.MD).
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
    if (err instanceof WorkspaceError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

function assertCan(role: Role, action: Action) {
  requirePermission(role, action);
}

// ── Workspace ──────────────────────────────────────────────────────

export async function createWorkspaceAction(formData: unknown) {
  const parsed = createWorkspaceSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "workspace:create");
    return service.createWorkspace(organizationId, parsed.data);
  });
}

export async function updateWorkspaceAction(formData: unknown) {
  const parsed = updateWorkspaceSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "workspace:update");
    return service.updateWorkspace(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteWorkspaceAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "workspace:delete");
    return service.deleteWorkspace(organizationId, id);
  });
}

// ── Space ──────────────────────────────────────────────────────────

export async function createSpaceAction(formData: unknown) {
  const parsed = createSpaceSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "space:create");
    return service.createSpace(organizationId, parsed.data);
  });
}

export async function updateSpaceAction(formData: unknown) {
  const parsed = updateSpaceSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "space:update");
    return service.updateSpace(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteSpaceAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "space:delete");
    return service.deleteSpace(organizationId, id);
  });
}

export async function reorderSpacesAction(formData: unknown) {
  const parsed = reorderSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "space:update");
    return service.reorderSpaces(organizationId, parsed.data.parentId, parsed.data.orderedIds);
  });
}

// ── Folder ─────────────────────────────────────────────────────────

export async function createFolderAction(formData: unknown) {
  const parsed = createFolderSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "folder:create");
    return service.createFolder(organizationId, parsed.data);
  });
}

export async function updateFolderAction(formData: unknown) {
  const parsed = updateFolderSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "folder:update");
    return service.updateFolder(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteFolderAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "folder:delete");
    return service.deleteFolder(organizationId, id);
  });
}

export async function reorderFoldersAction(formData: unknown) {
  const parsed = reorderSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "folder:update");
    return service.reorderFolders(organizationId, parsed.data.parentId, parsed.data.orderedIds);
  });
}

// ── List ───────────────────────────────────────────────────────────

export async function createListAction(formData: unknown) {
  const parsed = createListSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "list:create");
    return service.createList(organizationId, parsed.data);
  });
}

export async function updateListAction(formData: unknown) {
  const parsed = updateListSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "list:update");
    return service.updateList(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteListAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "list:delete");
    return service.deleteList(organizationId, id);
  });
}

/**
 * Leitura — não passa por `requirePermission` (mesma convenção do
 * restante do módulo: qualquer membro autenticado pode ver a lista
 * de Lists para escolher onde lançar uma Task). Usada pelas
 * ferramentas de Melhoria Contínua (client components), que não
 * podem chamar `service.ts` direto.
 */
export async function listListsForPickerAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false as const, error: "Sessão expirada. Faça login novamente." };
  }
  const data = await service.listListsForPicker(session.user.organizationId);
  return { ok: true as const, data };
}

/** Mesma convenção de `listListsForPickerAction` — usada pela aprovação final de Business Case (Fase 5). */
export async function listFoldersForPickerAction() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return { ok: false as const, error: "Sessão expirada. Faça login novamente." };
  }
  const data = await service.listFoldersForPicker(session.user.organizationId);
  return { ok: true as const, data };
}

export async function reorderListsAction(formData: unknown) {
  const parsed = reorderSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "list:update");
    return service.reorderLists(organizationId, parsed.data.parentId, parsed.data.orderedIds);
  });
}
