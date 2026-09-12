import { db } from "@/lib/db";
import { computeOrderUpdates, isCompleteOrderSet } from "./reorder";
import type {
  CreateFolderInput,
  CreateListInput,
  CreateSpaceInput,
  CreateWorkspaceInput,
  UpdateFolderInput,
  UpdateListInput,
  UpdateSpaceInput,
  UpdateWorkspaceInput,
} from "./schemas";

/**
 * `NOT_FOUND` cobre tanto "não existe" quanto "existe em outra
 * organização" — de propósito, para nunca dar a um usuário
 * mal-intencionado uma forma de diferenciar as duas coisas (evita
 * enumeração cross-tenant). Todo service deste módulo recebe
 * `organizationId` como primeiro parâmetro (nunca lido da URL/client)
 * e filtra por ele em toda query, inclusive nas checagens de que o
 * pai (workspaceId/spaceId/folderId) pertence à mesma organização
 * antes de criar um filho.
 */
export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_ORDER_SET",
  ) {
    super(message);
    this.name = "WorkspaceError";
  }
}

function notFound(entity: string): never {
  throw new WorkspaceError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/**
 * Achado da auditoria (Fase 1, seção 9): reorder precisa receber o
 * conjunto COMPLETO de ids do nível, não só um subconjunto — senão
 * itens fora do payload silenciosamente mantêm a order antiga.
 */
function assertCompleteOrderSet(currentIds: string[], orderedIds: string[]) {
  if (!isCompleteOrderSet(currentIds, orderedIds)) {
    throw new WorkspaceError(
      "A lista enviada para reordenar precisa conter exatamente os itens atuais, sem faltar nem repetir.",
      "INVALID_ORDER_SET",
    );
  }
}

async function assertWorkspaceInOrg(organizationId: string, workspaceId: string) {
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, organizationId },
    select: { id: true },
  });
  if (!workspace) notFound("Workspace");
}

async function assertSpaceInOrg(organizationId: string, spaceId: string) {
  const space = await db.space.findFirst({
    where: { id: spaceId, organizationId },
    select: { id: true },
  });
  if (!space) notFound("Space");
}

async function assertFolderInOrg(organizationId: string, folderId: string) {
  const folder = await db.folder.findFirst({
    where: { id: folderId, organizationId },
    select: { id: true },
  });
  if (!folder) notFound("Folder");
}

// ── Workspace ──────────────────────────────────────────────────────

export function listWorkspaces(organizationId: string) {
  return db.workspace.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { spaces: true } } },
  });
}

export async function getWorkspace(organizationId: string, id: string) {
  const workspace = await db.workspace.findFirst({ where: { id, organizationId } });
  if (!workspace) notFound("Workspace");
  return workspace;
}

export function createWorkspace(organizationId: string, input: CreateWorkspaceInput) {
  return db.workspace.create({ data: { organizationId, name: input.name } });
}

export async function updateWorkspace(
  organizationId: string,
  id: string,
  input: UpdateWorkspaceInput,
) {
  const { count } = await db.workspace.updateMany({
    where: { id, organizationId },
    data: { name: input.name },
  });
  if (count === 0) notFound("Workspace");
  return db.workspace.findUniqueOrThrow({ where: { id } });
}

export async function deleteWorkspace(organizationId: string, id: string) {
  const { count } = await db.workspace.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Workspace");
}

// ── Space ──────────────────────────────────────────────────────────

export function listSpaces(organizationId: string, workspaceId: string) {
  return db.space.findMany({
    where: { organizationId, workspaceId },
    orderBy: { order: "asc" },
  });
}

export async function getSpaceWithFolders(organizationId: string, id: string) {
  const space = await db.space.findFirst({
    where: { id, organizationId },
    include: {
      workspace: { select: { id: true, name: true } },
      folders: {
        orderBy: { order: "asc" },
        include: { lists: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!space) notFound("Space");
  return space;
}

export async function createSpace(organizationId: string, input: CreateSpaceInput) {
  await assertWorkspaceInOrg(organizationId, input.workspaceId);
  const last = await db.space.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return db.space.create({
    data: {
      organizationId,
      workspaceId: input.workspaceId,
      name: input.name,
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateSpace(
  organizationId: string,
  id: string,
  input: UpdateSpaceInput,
) {
  const { count } = await db.space.updateMany({
    where: { id, organizationId },
    data: { name: input.name },
  });
  if (count === 0) notFound("Space");
  return db.space.findUniqueOrThrow({ where: { id } });
}

export async function deleteSpace(organizationId: string, id: string) {
  const { count } = await db.space.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Space");
}

export async function reorderSpaces(
  organizationId: string,
  workspaceId: string,
  orderedIds: string[],
) {
  await assertWorkspaceInOrg(organizationId, workspaceId);
  const current = await db.space.findMany({
    where: { organizationId, workspaceId },
    select: { id: true },
  });
  assertCompleteOrderSet(current.map((s) => s.id), orderedIds);
  const updates = computeOrderUpdates(orderedIds);
  await db.$transaction(
    updates.map(({ id, order }) =>
      db.space.updateMany({ where: { id, organizationId, workspaceId }, data: { order } }),
    ),
  );
}

// ── Folder ─────────────────────────────────────────────────────────

export async function createFolder(organizationId: string, input: CreateFolderInput) {
  await assertSpaceInOrg(organizationId, input.spaceId);
  const last = await db.folder.findFirst({
    where: { spaceId: input.spaceId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return db.folder.create({
    data: {
      organizationId,
      spaceId: input.spaceId,
      name: input.name,
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateFolder(
  organizationId: string,
  id: string,
  input: UpdateFolderInput,
) {
  const { count } = await db.folder.updateMany({
    where: { id, organizationId },
    data: { name: input.name },
  });
  if (count === 0) notFound("Folder");
  return db.folder.findUniqueOrThrow({ where: { id } });
}

export async function deleteFolder(organizationId: string, id: string) {
  const { count } = await db.folder.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Folder");
}

export async function reorderFolders(
  organizationId: string,
  spaceId: string,
  orderedIds: string[],
) {
  await assertSpaceInOrg(organizationId, spaceId);
  const current = await db.folder.findMany({
    where: { organizationId, spaceId },
    select: { id: true },
  });
  assertCompleteOrderSet(current.map((f) => f.id), orderedIds);
  const updates = computeOrderUpdates(orderedIds);
  await db.$transaction(
    updates.map(({ id, order }) =>
      db.folder.updateMany({ where: { id, organizationId, spaceId }, data: { order } }),
    ),
  );
}

// ── List ───────────────────────────────────────────────────────────

export async function createList(organizationId: string, input: CreateListInput) {
  await assertFolderInOrg(organizationId, input.folderId);
  const last = await db.list.findFirst({
    where: { folderId: input.folderId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return db.list.create({
    data: {
      organizationId,
      folderId: input.folderId,
      name: input.name,
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateList(
  organizationId: string,
  id: string,
  input: UpdateListInput,
) {
  const { count } = await db.list.updateMany({
    where: { id, organizationId },
    data: { name: input.name },
  });
  if (count === 0) notFound("List");
  return db.list.findUniqueOrThrow({ where: { id } });
}

export async function deleteList(organizationId: string, id: string) {
  const { count } = await db.list.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("List");
}

export async function reorderLists(
  organizationId: string,
  folderId: string,
  orderedIds: string[],
) {
  await assertFolderInOrg(organizationId, folderId);
  const current = await db.list.findMany({
    where: { organizationId, folderId },
    select: { id: true },
  });
  assertCompleteOrderSet(current.map((l) => l.id), orderedIds);
  const updates = computeOrderUpdates(orderedIds);
  await db.$transaction(
    updates.map(({ id, order }) =>
      db.list.updateMany({ where: { id, organizationId, folderId }, data: { order } }),
    ),
  );
}

/**
 * Todas as Lists da organização, com o caminho completo (Workspace >
 * Space > Folder > List) para exibir num seletor — usado pelas
 * ferramentas de Melhoria Contínua (Fase 3) para escolher onde
 * lançar a Task gerada a partir de uma causa/ação identificada.
 */
export async function listListsForPicker(organizationId: string) {
  const lists = await db.list.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: {
      folder: {
        select: {
          name: true,
          space: { select: { name: true, workspace: { select: { name: true } } } },
        },
      },
    },
  });
  return lists.map((l) => ({
    id: l.id,
    name: l.name,
    path: `${l.folder.space.workspace.name} / ${l.folder.space.name} / ${l.folder.name}`,
  }));
}

/**
 * Todas as Folders da organização, com o caminho completo (Workspace
 * > Space > Folder), para um seletor — usado pela Fase 5 (Business
 * Case) para escolher onde criar o "Projeto" (List) gerado na
 * aprovação final.
 */
export async function listFoldersForPicker(organizationId: string) {
  const folders = await db.folder.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { space: { select: { name: true, workspace: { select: { name: true } } } } },
  });
  return folders.map((f) => ({
    id: f.id,
    name: f.name,
    path: `${f.space.workspace.name} / ${f.space.name}`,
  }));
}

/** Resumo de uma List (breadcrumb da página de tasks) — usado pelo módulo `task`. */
export async function getListSummary(organizationId: string, listId: string) {
  const list = await db.list.findFirst({
    where: { id: listId, organizationId },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
          space: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!list) notFound("List");
  return list;
}
