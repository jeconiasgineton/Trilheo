import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganizationWithOwner } from "@/lib/modules/auth/service";
import * as workspace from "@/lib/modules/workspace/service";
import { WorkspaceError } from "@/lib/modules/workspace/service";
import * as task from "@/lib/modules/task/service";
import { TaskError } from "@/lib/modules/task/service";
import * as comment from "@/lib/modules/comment/service";
import { CommentError } from "@/lib/modules/comment/service";
import * as attachment from "@/lib/modules/attachment/service";
import { AttachmentError } from "@/lib/modules/attachment/service";
import * as innovation from "@/lib/modules/innovation/service";
import { InnovationError } from "@/lib/modules/innovation/service";
import * as tools from "@/lib/modules/tools/service";
import { ToolError } from "@/lib/modules/tools/service";
import * as bc from "@/lib/modules/business-case/service";
import { BusinessCaseError } from "@/lib/modules/business-case/service";

/**
 * Critério de aceite obrigatório da Fase 1 (docs/prompt-fase1-original.md,
 * seção 7): "Duas organizações distintas não conseguem, por nenhum
 * caminho da UI ou da API, ver ou modificar dados uma da outra (com
 * teste automatizado cobrindo isso)." A auditoria (Auditoria ChatGpt
 * Fase 1.docx, seções 2 e 18) apontou isso como o maior risco em
 * aberto — este arquivo é a suíte que fecha essa pendência para a
 * camada de service (onde a checagem de organizationId de fato
 * acontece; toda action repete a mesma checagem indiretamente por
 * chamar o service).
 *
 * Requer Postgres real (DATABASE_URL) — roda contra o banco de dev
 * local (instância isolada na porta 5433, ver CONTEXTO.MD), criando
 * suas próprias duas organizações e limpando tudo ao final.
 */
describe("isolamento multi-tenant", () => {
  let orgA: Awaited<ReturnType<typeof createOrganizationWithOwner>>;
  let orgB: Awaited<ReturnType<typeof createOrganizationWithOwner>>;

  let aWorkspace: Awaited<ReturnType<typeof workspace.createWorkspace>>;
  let aSpace: Awaited<ReturnType<typeof workspace.createSpace>>;
  let aFolder: Awaited<ReturnType<typeof workspace.createFolder>>;
  let aList: Awaited<ReturnType<typeof workspace.createList>>;
  let aTask: Awaited<ReturnType<typeof task.createTask>>;
  let aComment: Awaited<ReturnType<typeof comment.createComment>>;
  let aAttachment: Awaited<ReturnType<typeof attachment.createAttachment>>;
  let aPipeline: Awaited<ReturnType<typeof innovation.createPipeline>>;
  let aBoard: Awaited<ReturnType<typeof innovation.createBoard>>;
  let aIdea: Awaited<ReturnType<typeof innovation.createIdea>>;
  let aTool: Awaited<ReturnType<typeof tools.createTool>>;

  let bWorkspace: Awaited<ReturnType<typeof workspace.createWorkspace>>;
  let bSpace: Awaited<ReturnType<typeof workspace.createSpace>>;
  let bFolder: Awaited<ReturnType<typeof workspace.createFolder>>;
  let bList: Awaited<ReturnType<typeof workspace.createList>>;
  let bTask: Awaited<ReturnType<typeof task.createTask>>;
  let bComment: Awaited<ReturnType<typeof comment.createComment>>;
  let bAttachment: Awaited<ReturnType<typeof attachment.createAttachment>>;
  let bPipeline: Awaited<ReturnType<typeof innovation.createPipeline>>;
  let bBoard: Awaited<ReturnType<typeof innovation.createBoard>>;
  let bIdea: Awaited<ReturnType<typeof innovation.createIdea>>;
  let bTool: Awaited<ReturnType<typeof tools.createTool>>;
  let bBusinessCase: Awaited<ReturnType<typeof bc.createBusinessCase>>;

  const suffix = Date.now();

  beforeAll(async () => {
    const a = await createOrganizationWithOwner({
      organizationName: `Tenant Test A ${suffix}`,
      name: "Owner A",
      email: `tenant-a-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    orgA = a;
    const b = await createOrganizationWithOwner({
      organizationName: `Tenant Test B ${suffix}`,
      name: "Owner B",
      email: `tenant-b-${suffix}@test.local`,
      password: "senhaSegura123",
    });
    orgB = b;

    // ── Hierarquia completa para a Org A ──────────────────────────
    aWorkspace = await workspace.createWorkspace(orgA.organization.id, { name: "WS A" });
    aSpace = await workspace.createSpace(orgA.organization.id, {
      workspaceId: aWorkspace.id,
      name: "Space A",
    });
    aFolder = await workspace.createFolder(orgA.organization.id, {
      spaceId: aSpace.id,
      name: "Folder A",
    });
    aList = await workspace.createList(orgA.organization.id, {
      folderId: aFolder.id,
      name: "List A",
    });
    aTask = await task.createTask(orgA.organization.id, {
      listId: aList.id,
      title: "Task A",
    });
    aComment = await comment.createComment(orgA.organization.id, orgA.user.id, {
      commentableType: "Task",
      commentableId: aTask.id,
      body: "Comentário da org A",
    });
    aAttachment = await attachment.createAttachment(orgA.organization.id, orgA.user.id, {
      attachableType: "Task",
      attachableId: aTask.id,
      url: "/api/attachments/file/a.txt",
      filename: "a.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
    });
    aPipeline = await innovation.createPipeline(orgA.organization.id, { name: "Pipeline A" });
    aBoard = await innovation.createBoard(orgA.organization.id, {
      name: "Board A",
      pipelineId: aPipeline.id,
    });
    aIdea = await innovation.createIdea(orgA.organization.id, orgA.user.id, {
      boardId: aBoard.id,
      title: "Ideia A",
    });
    aTool = await tools.createTool(orgA.organization.id, orgA.user.id, {
      analyzableType: "Idea",
      analyzableId: aIdea.id,
      type: "FIVE_WHYS",
      title: "5 Porquês A",
      content: { problem: "Problema A", whys: [] },
    });

    // ── Hierarquia completa para a Org B (espelhada) ──────────────
    bWorkspace = await workspace.createWorkspace(orgB.organization.id, { name: "WS B" });
    bSpace = await workspace.createSpace(orgB.organization.id, {
      workspaceId: bWorkspace.id,
      name: "Space B",
    });
    bFolder = await workspace.createFolder(orgB.organization.id, {
      spaceId: bSpace.id,
      name: "Folder B",
    });
    bList = await workspace.createList(orgB.organization.id, {
      folderId: bFolder.id,
      name: "List B",
    });
    bTask = await task.createTask(orgB.organization.id, {
      listId: bList.id,
      title: "Task B",
    });
    bComment = await comment.createComment(orgB.organization.id, orgB.user.id, {
      commentableType: "Task",
      commentableId: bTask.id,
      body: "Comentário da org B",
    });
    bAttachment = await attachment.createAttachment(orgB.organization.id, orgB.user.id, {
      attachableType: "Task",
      attachableId: bTask.id,
      url: "/api/attachments/file/b.txt",
      filename: "b.txt",
      mimeType: "text/plain",
      sizeBytes: 10,
    });
    bPipeline = await innovation.createPipeline(orgB.organization.id, { name: "Pipeline B" });
    bBoard = await innovation.createBoard(orgB.organization.id, {
      name: "Board B",
      pipelineId: bPipeline.id,
    });
    bIdea = await innovation.createIdea(orgB.organization.id, orgB.user.id, {
      boardId: bBoard.id,
      title: "Ideia B",
    });
    bTool = await tools.createTool(orgB.organization.id, orgB.user.id, {
      analyzableType: "Idea",
      analyzableId: bIdea.id,
      type: "FIVE_WHYS",
      title: "5 Porquês B",
      content: { problem: "Problema B", whys: [] },
    });
    bBusinessCase = await bc.createBusinessCase(orgB.organization.id, orgB.user.id, {
      ideaId: bIdea.id,
      title: "BC B",
      capex: 1000,
      opexMonthly: 100,
      benefitMonthly: 500,
      horizonMonths: 6,
    });
  }, 30000);

  afterAll(async () => {
    await db.organization.deleteMany({ where: { id: { in: [orgA.organization.id, orgB.organization.id] } } });
    await db.user.deleteMany({ where: { id: { in: [orgA.user.id, orgB.user.id] } } });
  });

  // ── Workspace / Space / Folder / List ────────────────────────────

  it("Org A não lê Workspace/Space/Folder/List da Org B", async () => {
    await expect(workspace.getWorkspace(orgA.organization.id, bWorkspace.id)).rejects.toThrow(WorkspaceError);
    const list = await workspace.listWorkspaces(orgA.organization.id);
    expect(list.map((w) => w.id)).not.toContain(bWorkspace.id);
  });

  it("Org A não atualiza nem exclui Workspace da Org B", async () => {
    await expect(
      workspace.updateWorkspace(orgA.organization.id, bWorkspace.id, { id: bWorkspace.id, name: "hackeado" }),
    ).rejects.toThrow(WorkspaceError);
    await expect(workspace.deleteWorkspace(orgA.organization.id, bWorkspace.id)).rejects.toThrow(WorkspaceError);

    const stillThere = await db.workspace.findUnique({ where: { id: bWorkspace.id } });
    expect(stillThere?.name).toBe("WS B");
  });

  it("Org A não cria Space/Folder/List dentro da hierarquia da Org B", async () => {
    await expect(
      workspace.createSpace(orgA.organization.id, { workspaceId: bWorkspace.id, name: "hack" }),
    ).rejects.toThrow(WorkspaceError);
    await expect(
      workspace.createFolder(orgA.organization.id, { spaceId: bSpace.id, name: "hack" }),
    ).rejects.toThrow(WorkspaceError);
    await expect(
      workspace.createList(orgA.organization.id, { folderId: bFolder.id, name: "hack" }),
    ).rejects.toThrow(WorkspaceError);
  });

  it("Org A não reordena Spaces/Folders/Lists da Org B", async () => {
    await expect(
      workspace.reorderSpaces(orgA.organization.id, bWorkspace.id, [bSpace.id]),
    ).rejects.toThrow(WorkspaceError);
    await expect(
      workspace.reorderFolders(orgA.organization.id, bSpace.id, [bFolder.id]),
    ).rejects.toThrow(WorkspaceError);
    await expect(
      workspace.reorderLists(orgA.organization.id, bFolder.id, [bList.id]),
    ).rejects.toThrow(WorkspaceError);
  });

  // ── Task ──────────────────────────────────────────────────────────

  it("Org A não lê, atualiza, move nem exclui Task da Org B", async () => {
    await expect(task.getTaskWithDetails(orgA.organization.id, bTask.id)).rejects.toThrow(TaskError);
    await expect(
      task.updateTask(orgA.organization.id, bTask.id, { id: bTask.id, title: "hack" }),
    ).rejects.toThrow(TaskError);
    await expect(task.moveTask(orgA.organization.id, bTask.id, "done")).rejects.toThrow(TaskError);
    await expect(task.deleteTask(orgA.organization.id, bTask.id)).rejects.toThrow(TaskError);

    const stillThere = await db.task.findUnique({ where: { id: bTask.id } });
    expect(stillThere?.title).toBe("Task B");
    expect(stillThere?.status).not.toBe("done");
  });

  it("Org A não cria Task numa List da Org B (relationship isolation)", async () => {
    await expect(
      task.createTask(orgA.organization.id, { listId: bList.id, title: "hack" }),
    ).rejects.toThrow(TaskError);
  });

  it("Org A não atribui responsável de outra organização a uma Task", async () => {
    await expect(
      task.createTask(orgA.organization.id, {
        listId: aList.id,
        title: "task com assignee de outra org",
        assigneeId: orgB.user.id,
      }),
    ).rejects.toThrow(TaskError);
  });

  it("listTasksByStatus da Org A nunca inclui Task da Org B", async () => {
    const tasks = await task.listTasksByStatus(orgA.organization.id, aList.id);
    expect(tasks.map((t) => t.id)).not.toContain(bTask.id);
  });

  it("Org A não cria dependência usando Task da Org B como predecessora ou sucessora", async () => {
    await expect(task.addDependency(orgA.organization.id, bTask.id, aTask.id)).rejects.toThrow(TaskError);
    await expect(task.addDependency(orgA.organization.id, aTask.id, bTask.id)).rejects.toThrow(TaskError);
  });

  // ── Comment / Attachment ─────────────────────────────────────────

  it("Org A não comenta nem anexa arquivo numa Task da Org B", async () => {
    await expect(
      comment.createComment(orgA.organization.id, orgA.user.id, {
        commentableType: "Task",
        commentableId: bTask.id,
        body: "tentativa cross-tenant",
      }),
    ).rejects.toThrow(CommentError);
    await expect(
      attachment.createAttachment(orgA.organization.id, orgA.user.id, {
        attachableType: "Task",
        attachableId: bTask.id,
        url: "/api/attachments/file/hack.txt",
        filename: "hack.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
      }),
    ).rejects.toThrow(AttachmentError);
  });

  it("Org A não exclui comentário/anexo da Org B", async () => {
    await expect(comment.deleteComment(orgA.organization.id, bComment.id)).rejects.toThrow(CommentError);
    await expect(attachment.deleteAttachment(orgA.organization.id, bAttachment.id)).rejects.toThrow(
      AttachmentError,
    );
    expect(await db.comment.findUnique({ where: { id: bComment.id } })).not.toBeNull();
    expect(await db.attachment.findUnique({ where: { id: bAttachment.id } })).not.toBeNull();
  });

  it("listComments/listAttachments da Org A nunca incluem registros da Org B", async () => {
    const comments = await comment.listComments(orgA.organization.id, "Task", aTask.id);
    expect(comments.every((c) => c.id !== bComment.id)).toBe(true);
    const attachments = await attachment.listAttachments(orgA.organization.id, "Task", aTask.id);
    expect(attachments.every((a) => a.id !== bAttachment.id)).toBe(true);
  });

  // ── Inovação (pipeline / board / idea) ───────────────────────────

  it("Org A não lê Pipeline/Board/Idea da Org B", async () => {
    await expect(innovation.getPipeline(orgA.organization.id, bPipeline.id)).rejects.toThrow(InnovationError);
    await expect(innovation.getBoardWithStages(orgA.organization.id, bBoard.id)).rejects.toThrow(InnovationError);
    await expect(innovation.getIdeaWithDetails(orgA.organization.id, bIdea.id)).rejects.toThrow(InnovationError);
  });

  it("Org A não cria Board usando Pipeline da Org B, nem Idea usando Board da Org B", async () => {
    await expect(
      innovation.createBoard(orgA.organization.id, { name: "hack", pipelineId: bPipeline.id }),
    ).rejects.toThrow(InnovationError);
    await expect(
      innovation.createIdea(orgA.organization.id, orgA.user.id, { boardId: bBoard.id, title: "hack" }),
    ).rejects.toThrow(InnovationError);
  });

  it("Org A não move nem exclui Idea da Org B", async () => {
    const bStage = (await innovation.getPipeline(orgB.organization.id, bPipeline.id)).stages[1];
    await expect(
      innovation.moveIdea(orgA.organization.id, bIdea.id, { ideaId: bIdea.id, targetStageId: bStage.id }),
    ).rejects.toThrow(InnovationError);
    await expect(innovation.deleteIdea(orgA.organization.id, bIdea.id)).rejects.toThrow(InnovationError);

    const stillThere = await db.idea.findUnique({ where: { id: bIdea.id } });
    expect(stillThere).not.toBeNull();
  });

  it("Org A não exclui Pipeline da Org B nem cria estágio nele", async () => {
    await expect(innovation.deletePipeline(orgA.organization.id, bPipeline.id)).rejects.toThrow(InnovationError);
    await expect(
      innovation.createStage(orgA.organization.id, {
        pipelineId: bPipeline.id,
        name: "hack",
        stageType: "BACKLOG",
      }),
    ).rejects.toThrow(InnovationError);
  });

  it("listPipelines/listBoards da Org A nunca incluem registros da Org B", async () => {
    const pipelines = await innovation.listPipelines(orgA.organization.id);
    expect(pipelines.map((p) => p.id)).not.toContain(bPipeline.id);
    const boards = await innovation.listBoards(orgA.organization.id);
    expect(boards.map((b) => b.id)).not.toContain(bBoard.id);
  });

  // ── Ferramentas de Melhoria Contínua (Fase 3) ────────────────────

  it("Org A não lê nem exclui ferramenta de análise da Org B", async () => {
    await expect(tools.getTool(orgA.organization.id, bTool.id)).rejects.toThrow(ToolError);
    await expect(tools.deleteTool(orgA.organization.id, bTool.id)).rejects.toThrow(ToolError);
    expect(await db.improvementTool.findUnique({ where: { id: bTool.id } })).not.toBeNull();
  });

  it("Org A não cria ferramenta anexada a uma Idea da Org B (relationship isolation)", async () => {
    await expect(
      tools.createTool(orgA.organization.id, orgA.user.id, {
        analyzableType: "Idea",
        analyzableId: bIdea.id,
        type: "FIVE_WHYS",
        title: "hack",
        content: { problem: "hack", whys: [] },
      }),
    ).rejects.toThrow(ToolError);
  });

  it("Org A não atualiza ferramenta da Org B", async () => {
    await expect(
      tools.updateTool(orgA.organization.id, bTool.id, {
        id: bTool.id,
        type: "FIVE_WHYS",
        title: "hackeado",
        content: { problem: "hack", whys: [] },
      }),
    ).rejects.toThrow(ToolError);
    const stillThere = await db.improvementTool.findUnique({ where: { id: bTool.id } });
    expect(stillThere?.title).toBe("5 Porquês B");
  });

  it("listTools da Org A nunca inclui ferramentas da Org B", async () => {
    const list = await tools.listTools(orgA.organization.id, "Idea", aIdea.id);
    expect(list.map((t) => t.id)).not.toContain(bTool.id);
  });

  // ── Business Case (Fase 5) ────────────────────────────────────────

  it("Org A não lê nem exclui Business Case da Org B", async () => {
    await expect(bc.getBusinessCase(orgA.organization.id, bBusinessCase.id)).rejects.toThrow(BusinessCaseError);
    await expect(bc.deleteBusinessCase(orgA.organization.id, bBusinessCase.id)).rejects.toThrow(BusinessCaseError);
    expect(await db.businessCase.findUnique({ where: { id: bBusinessCase.id } })).not.toBeNull();
  });

  it("Org A não cria Business Case anexado a uma Idea da Org B", async () => {
    await expect(
      bc.createBusinessCase(orgA.organization.id, orgA.user.id, {
        ideaId: bIdea.id,
        title: "hack",
        capex: 1,
        opexMonthly: 1,
        benefitMonthly: 1,
        horizonMonths: 1,
      }),
    ).rejects.toThrow(BusinessCaseError);
  });

  it("Org A não aprova (Admin) usando uma Folder da Org B como destino do Projeto", async () => {
    // Cria um BC próprio da Org A, leva até PENDING_ADMIN, e tenta
    // gerar o Projeto numa Folder que pertence à Org B.
    const ownBc = await bc.createBusinessCase(orgA.organization.id, orgA.user.id, {
      ideaId: aIdea.id,
      title: "BC A p/ teste de pasta cross-tenant",
      capex: 100,
      opexMonthly: 10,
      benefitMonthly: 50,
      horizonMonths: 6,
    });
    await bc.submitBusinessCase(orgA.organization.id, ownBc.id);
    await bc.approveAsGestor(orgA.organization.id, ownBc.id, orgA.user.id, { id: ownBc.id });
    await expect(
      bc.approveAsAdmin(orgA.organization.id, ownBc.id, orgA.user.id, {
        id: ownBc.id,
        targetFolderId: bFolder.id,
      }),
    ).rejects.toThrow(BusinessCaseError);
  });

  it("listBusinessCasesForIdea da Org A nunca inclui Business Case da Org B", async () => {
    const list = await bc.listBusinessCasesForIdea(orgA.organization.id, aIdea.id);
    expect(list.map((b) => b.id)).not.toContain(bBusinessCase.id);
  });

  // sanity check: os dados da própria org continuam acessíveis normalmente
  it("Org A continua lendo/editando os próprios dados normalmente", async () => {
    expect(await workspace.getWorkspace(orgA.organization.id, aWorkspace.id)).toMatchObject({ name: "WS A" });
    expect(await task.getTaskWithDetails(orgA.organization.id, aTask.id)).toMatchObject({ title: "Task A" });
    expect(await innovation.getBoardWithStages(orgA.organization.id, aBoard.id)).toMatchObject({ name: "Board A" });
    expect(await tools.getTool(orgA.organization.id, aTool.id)).toMatchObject({ id: aTool.id });
    const list = await tools.listTools(orgA.organization.id, "Idea", aIdea.id);
    expect(list.map((t) => t.title)).toContain("5 Porquês A");
  });
});
