import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getServerSession } from "next-auth";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import type { Role } from "@/lib/modules/permissions";
import { createWorkspaceAction } from "@/lib/modules/workspace/actions";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "@/lib/modules/task/actions";
import { inviteMemberAction, removeMemberAction } from "@/lib/modules/auth/actions";
import { createCommentAction, deleteCommentAction } from "@/lib/modules/comment/actions";
import * as workspace from "@/lib/modules/workspace/service";
import * as task from "@/lib/modules/task/service";
import * as comment from "@/lib/modules/comment/service";

/**
 * Suíte 2 da auditoria (Auditoria ChatGpt Fase 1.docx, seções 8 e 18):
 * os testes de permissão existentes (`permissions.test.ts`) provam
 * `can`/`requirePermission` isoladamente, mas não provam que uma
 * Server Action de verdade barra a mutação quando o papel da SESSÃO
 * não tem permissão. Aqui mockamos `getServerSession` (next-auth)
 * para simular sessões de papéis diferentes e chamamos as actions de
 * verdade, conferindo tanto o retorno (`ok: false`) quanto — o que
 * importa mais — que **nenhuma linha foi alterada no banco**.
 */
vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));

function mockSession(organizationId: string, role: Role, userId: string) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, organizationId, role, organizationSlug: "x" },
  } as never);
}

describe("permissões nas server actions (sessão mockada)", () => {
  let org: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let memberUserId: string;
  let liderUserId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    org = await createOrganizationWithOwner({
      organizationName: `Action Perms Test ${suffix}`,
      name: "Owner",
      email: `action-perms-owner-${suffix}@test.local`,
      password: "senhaSegura123",
    });

    const member = await db.user.create({
      data: { email: `action-perms-membro-${suffix}@test.local`, passwordHash: "x", name: "Membro" },
    });
    memberUserId = member.id;
    await db.organizationMember.create({
      data: { organizationId: org.organization.id, userId: member.id, role: "MEMBRO" },
    });

    const lider = await db.user.create({
      data: { email: `action-perms-lider-${suffix}@test.local`, passwordHash: "x", name: "Líder" },
    });
    liderUserId = lider.id;
    await db.organizationMember.create({
      data: { organizationId: org.organization.id, userId: lider.id, role: "LIDER" },
    });
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: org.organization.id } });
    await db.user.deleteMany({
      where: { id: { in: [org.user.id, memberUserId, liderUserId] } },
    });
    vi.restoreAllMocks();
  });

  it("MEMBRO não consegue criar Workspace via action (workspace:create exige GESTOR+); banco não muda", async () => {
    mockSession(org.organization.id, "MEMBRO", memberUserId);
    const before = await db.workspace.count({ where: { organizationId: org.organization.id } });

    const result = await createWorkspaceAction({ name: "Workspace via MEMBRO" });

    expect(result.ok).toBe(false);
    const after = await db.workspace.count({ where: { organizationId: org.organization.id } });
    expect(after).toBe(before);
  });

  it("GESTOR consegue criar Workspace via action", async () => {
    const gestor = await db.user.create({
      data: { email: `action-perms-gestor-${suffix}@test.local`, passwordHash: "x", name: "Gestor" },
    });
    await db.organizationMember.create({
      data: { organizationId: org.organization.id, userId: gestor.id, role: "GESTOR" },
    });
    mockSession(org.organization.id, "GESTOR", gestor.id);

    const result = await createWorkspaceAction({ name: "Workspace via GESTOR" });

    expect(result.ok).toBe(true);
    const found = await db.workspace.findFirst({ where: { organizationId: org.organization.id, name: "Workspace via GESTOR" } });
    expect(found).not.toBeNull();

    await db.user.delete({ where: { id: gestor.id } });
  });

  it("MEMBRO cria Task (task:create) mas não consegue excluí-la (task:delete exige LIDER+); banco não muda na tentativa de exclusão", async () => {
    const ws = await workspace.createWorkspace(org.organization.id, { name: "WS perms" });
    const space = await workspace.createSpace(org.organization.id, { workspaceId: ws.id, name: "Space perms" });
    const folder = await workspace.createFolder(org.organization.id, { spaceId: space.id, name: "Folder perms" });
    const list = await workspace.createList(org.organization.id, { folderId: folder.id, name: "List perms" });

    mockSession(org.organization.id, "MEMBRO", memberUserId);
    const createResult = await createTaskAction({ listId: list.id, title: "Task do MEMBRO" });
    expect(createResult.ok).toBe(true);
    if (!createResult.ok) throw new Error("setup falhou");
    const createdTaskId = createResult.data.id;

    const deleteResult = await deleteTaskAction(createdTaskId);
    expect(deleteResult.ok).toBe(false);

    const stillThere = await db.task.findUnique({ where: { id: createdTaskId } });
    expect(stillThere).not.toBeNull();

    mockSession(org.organization.id, "LIDER", liderUserId);
    const deleteAsLider = await deleteTaskAction(createdTaskId);
    expect(deleteAsLider.ok).toBe(true);
    expect(await db.task.findUnique({ where: { id: createdTaskId } })).toBeNull();
  });

  it("MEMBRO não consegue definir responsável (task:assign exige LIDER+); banco não muda", async () => {
    const ws = await workspace.createWorkspace(org.organization.id, { name: "WS assign" });
    const space = await workspace.createSpace(org.organization.id, { workspaceId: ws.id, name: "Space assign" });
    const folder = await workspace.createFolder(org.organization.id, { spaceId: space.id, name: "Folder assign" });
    const list = await workspace.createList(org.organization.id, { folderId: folder.id, name: "List assign" });
    const t = await task.createTask(org.organization.id, { listId: list.id, title: "Task sem assignee" });

    mockSession(org.organization.id, "MEMBRO", memberUserId);
    const result = await updateTaskAction({ id: t.id, assigneeId: memberUserId });

    expect(result.ok).toBe(false);
    const stillNoAssignee = await db.task.findUnique({ where: { id: t.id } });
    expect(stillNoAssignee?.assigneeId).toBeNull();
  });

  it("MEMBRO não consegue convidar nem remover membro (member:invite/member:remove exigem ADMIN+); banco não muda", async () => {
    mockSession(org.organization.id, "MEMBRO", memberUserId);

    const inviteResult = await inviteMemberAction({
      email: `nao-deveria-existir-${suffix}@test.local`,
      role: "MEMBRO",
    });
    expect(inviteResult.ok).toBe(false);
    expect(
      await db.user.findUnique({ where: { email: `nao-deveria-existir-${suffix}@test.local` } }),
    ).toBeNull();

    const targetMembership = await db.organizationMember.findFirst({
      where: { organizationId: org.organization.id, userId: liderUserId },
    });
    const removeResult = await removeMemberAction(targetMembership!.id);
    expect(removeResult.ok).toBe(false);
    expect(await db.organizationMember.findUnique({ where: { id: targetMembership!.id } })).not.toBeNull();
  });

  it("moderação local de comentário: autor exclui o próprio, mas não o de outro (sem comment:delete); banco reflete exatamente isso", async () => {
    const ws = await workspace.createWorkspace(org.organization.id, { name: "WS comment" });
    const space = await workspace.createSpace(org.organization.id, { workspaceId: ws.id, name: "Space comment" });
    const folder = await workspace.createFolder(org.organization.id, { spaceId: space.id, name: "Folder comment" });
    const list = await workspace.createList(org.organization.id, { folderId: folder.id, name: "List comment" });
    const t = await task.createTask(org.organization.id, { listId: list.id, title: "Task com comentários" });

    mockSession(org.organization.id, "MEMBRO", memberUserId);
    const ownCommentResult = await createCommentAction({
      commentableType: "Task",
      commentableId: t.id,
      body: "Comentário do próprio MEMBRO",
    });
    expect(ownCommentResult.ok).toBe(true);

    const othersComment = await comment.createComment(org.organization.id, org.user.id, {
      commentableType: "Task",
      commentableId: t.id,
      body: "Comentário do Owner",
    });

    // MEMBRO exclui o próprio comentário: permitido mesmo sem comment:delete.
    if (!ownCommentResult.ok) throw new Error("setup falhou");
    const deleteOwn = await deleteCommentAction(ownCommentResult.data.id);
    expect(deleteOwn.ok).toBe(true);
    expect(await db.comment.findUnique({ where: { id: ownCommentResult.data.id } })).toBeNull();

    // MEMBRO tenta excluir comentário de outro: negado, banco intacto.
    const deleteOthers = await deleteCommentAction(othersComment.id);
    expect(deleteOthers.ok).toBe(false);
    expect(await db.comment.findUnique({ where: { id: othersComment.id } })).not.toBeNull();

    // LIDER (comment:delete) consegue excluir o comentário de outro (moderação).
    mockSession(org.organization.id, "LIDER", liderUserId);
    const deleteAsLider = await deleteCommentAction(othersComment.id);
    expect(deleteAsLider.ok).toBe(true);
    expect(await db.comment.findUnique({ where: { id: othersComment.id } })).toBeNull();
  });

  it("sem sessão, toda action retorna erro e não toca o banco", async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never);
    const before = await db.workspace.count({ where: { organizationId: org.organization.id } });
    const result = await createWorkspaceAction({ name: "Sem sessão" });
    expect(result.ok).toBe(false);
    const after = await db.workspace.count({ where: { organizationId: org.organization.id } });
    expect(after).toBe(before);
  });
});
