import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as workspace from "@/lib/modules/workspace/service";
import * as task from "@/lib/modules/task/service";
import { TaskDependencyError } from "@/lib/modules/task/service";

/**
 * Fase 4 (Projetos) — dependências entre tasks (Gantt) e marcos.
 * Integração real contra Postgres: prova detecção de ciclo, rejeição
 * de duplicata, e que o `isMilestone` persiste. Isolamento
 * cross-tenant de `TaskDependency` coberto à parte, no mesmo molde
 * do restante do projeto.
 */
describe("dependências entre tasks e marcos (Fase 4)", () => {
  let org: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let listId: string;
  const suffix = Date.now();

  beforeAll(async () => {
    org = await createOrganizationWithOwner({
      organizationName: `Gantt Test ${suffix}`,
      name: "Owner",
      email: `gantt-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    const ws = await workspace.createWorkspace(org.organization.id, { name: "WS" });
    const space = await workspace.createSpace(org.organization.id, { workspaceId: ws.id, name: "Space" });
    const folder = await workspace.createFolder(org.organization.id, { spaceId: space.id, name: "Folder" });
    const list = await workspace.createList(org.organization.id, { folderId: folder.id, name: "List" });
    listId = list.id;
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: org.organization.id } });
    await db.user.deleteMany({ where: { id: org.user.id } });
  });

  it("cria dependência finish-to-start entre duas tasks", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "A" });
    const b = await task.createTask(org.organization.id, { listId, title: "B" });

    const dep = await task.addDependency(org.organization.id, a.id, b.id);
    expect(dep.predecessorId).toBe(a.id);
    expect(dep.successorId).toBe(b.id);
  });

  it("rejeita dependência duplicada", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "A2" });
    const b = await task.createTask(org.organization.id, { listId, title: "B2" });
    await task.addDependency(org.organization.id, a.id, b.id);

    await expect(task.addDependency(org.organization.id, a.id, b.id)).rejects.toThrow(TaskDependencyError);
  });

  it("rejeita dependência que criaria um ciclo direto (A->B, tenta B->A)", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "A3" });
    const b = await task.createTask(org.organization.id, { listId, title: "B3" });
    await task.addDependency(org.organization.id, a.id, b.id);

    await expect(task.addDependency(org.organization.id, b.id, a.id)).rejects.toThrow(TaskDependencyError);
  });

  it("rejeita dependência que criaria um ciclo transitivo (A->B->C, tenta C->A)", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "A4" });
    const b = await task.createTask(org.organization.id, { listId, title: "B4" });
    const c = await task.createTask(org.organization.id, { listId, title: "C4" });
    await task.addDependency(org.organization.id, a.id, b.id);
    await task.addDependency(org.organization.id, b.id, c.id);

    await expect(task.addDependency(org.organization.id, c.id, a.id)).rejects.toThrow(TaskDependencyError);

    // A cadeia legítima continua permitindo uma dependência nova não-cíclica.
    const d = await task.createTask(org.organization.id, { listId, title: "D4" });
    await expect(task.addDependency(org.organization.id, c.id, d.id)).resolves.toBeTruthy();
  });

  it("remove dependência", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "A5" });
    const b = await task.createTask(org.organization.id, { listId, title: "B5" });
    const dep = await task.addDependency(org.organization.id, a.id, b.id);

    await task.removeDependency(org.organization.id, dep.id);
    expect(await db.taskDependency.findUnique({ where: { id: dep.id } })).toBeNull();

    // Depois de removida, a mesma dependência pode ser recriada sem virar "duplicata".
    await expect(task.addDependency(org.organization.id, a.id, b.id)).resolves.toBeTruthy();
  });

  it("isMilestone persiste via createTask e updateTask", async () => {
    const created = await task.createTask(org.organization.id, { listId, title: "Marco 1", isMilestone: true });
    expect(created.id).toBeTruthy();
    const fromDb1 = await db.task.findUniqueOrThrow({ where: { id: created.id } });
    expect(fromDb1.isMilestone).toBe(true);

    await task.updateTask(org.organization.id, created.id, { id: created.id, isMilestone: false });
    const fromDb2 = await db.task.findUniqueOrThrow({ where: { id: created.id } });
    expect(fromDb2.isMilestone).toBe(false);
  });

  it("listTasksForGantt inclui predecessorOf/successorOf", async () => {
    const a = await task.createTask(org.organization.id, { listId, title: "GA" });
    const b = await task.createTask(org.organization.id, { listId, title: "GB" });
    await task.addDependency(org.organization.id, a.id, b.id);

    const tasks = await task.listTasksForGantt(org.organization.id, listId);
    const taskA = tasks.find((t) => t.id === a.id)!;
    const taskB = tasks.find((t) => t.id === b.id)!;
    expect(taskA.predecessorOf.some((d) => d.successorId === b.id)).toBe(true);
    expect(taskB.successorOf.some((d) => d.predecessorId === a.id)).toBe(true);
  });

  it("getWorkloadSummary agrupa tasks ativas por responsável", async () => {
    const member = await db.user.create({
      data: { email: `gantt-member-${suffix}@test.local`, passwordHash: "x", name: "Membro Carga" },
    });
    await db.organizationMember.create({
      data: { organizationId: org.organization.id, userId: member.id, role: "MEMBRO" },
    });
    await task.createTask(org.organization.id, { listId, title: "Task carga 1", assigneeId: member.id });
    await task.createTask(org.organization.id, {
      listId,
      title: "Task carga concluída",
      assigneeId: member.id,
      status: "done",
    });

    const summary = await task.getWorkloadSummary(org.organization.id);
    const entry = summary.find((s) => s.user.id === member.id)!;
    expect(entry.tasks.map((t) => t.title)).toContain("Task carga 1");
    expect(entry.tasks.map((t) => t.title)).not.toContain("Task carga concluída");

    await db.user.delete({ where: { id: member.id } });
  });
});
