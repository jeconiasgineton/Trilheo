import { PrismaClient, MemberRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Seed de desenvolvimento — popula o banco com uma organização de
 * demonstração ("Innovation Demo"), usuários com papéis distintos
 * (OWNER, LIDER, MEMBRO), a hierarquia Workspace → Space → Folder →
 * List, tasks (com subtask), comentários e anexos polimórficos, e
 * (Fase 2) um pipeline de inovação com estágios, um board e ideias
 * distribuídas pelos estágios — para que o login de qualquer
 * usuário já mostre dados nas views e no Kanban de inovação.
 *
 * Rodar: `npm run prisma:seed` (tsx prisma/seed.ts).
 *
 * Idempotente: se já existir a org de demo (slug "innovation-demo"),
 * o script encerra sem duplicar. Para um seed limpo, resete o banco
 * antes (`npx prisma migrate reset`).
 *
 * Senha de todos os usuários: demo12345
 */
const db = new PrismaClient();
const BCRYPT_COST = 12;

async function main() {
  const existing = await db.organization.findUnique({
    where: { slug: "innovation-demo" },
  });
  if (existing) {
    console.log("Seed já aplicado (org 'innovation-demo' existe). Nada a fazer.");
    return;
  }

  const passwordHash = await bcrypt.hash("demo12345", BCRYPT_COST);

  const [owner, lider, membro] = await Promise.all(
    [
      { email: "owner@demo.com", name: "Ana Owner" },
      { email: "lider@demo.com", name: "Léo Líder" },
      { email: "membro@demo.com", name: "Mara Membro" },
    ].map((u) => db.user.create({ data: { ...u, passwordHash } })),
  );

  const org = await db.organization.create({
    data: {
      name: "Innovation Demo",
      slug: "innovation-demo",
      members: {
        create: [
          { userId: owner.id, role: MemberRole.OWNER },
          { userId: lider.id, role: MemberRole.LIDER },
          { userId: membro.id, role: MemberRole.MEMBRO },
        ],
      },
    },
  });

  const workspace = await db.workspace.create({
    data: { organizationId: org.id, name: "Workspace de Inovação" },
  });

  const space = await db.space.create({
    data: {
      organizationId: org.id,
      workspaceId: workspace.id,
      name: "Innovation Workspace",
      order: 0,
    },
  });

  const folder = await db.folder.create({
    data: {
      organizationId: org.id,
      spaceId: space.id,
      name: "Pipeline de Ideias",
      order: 0,
    },
  });

  const list = await db.list.create({
    data: {
      organizationId: org.id,
      folderId: folder.id,
      name: "Sprint Atual",
      order: 0,
    },
  });

  // Tasks em status variados (para o Kanban mostrar colunas diferentes).
  const t1 = await db.task.create({
    data: {
      organizationId: org.id,
      listId: list.id,
      title: "Definir critérios de GUT",
      description: "Mapear gravidade/urgência/tendência das ideias do pipeline.",
      status: "in_progress",
      priority: "high",
      assigneeId: lider.id,
      order: 0,
    },
  });
  const t2 = await db.task.create({
    data: {
      organizationId: org.id,
      listId: list.id,
      title: "Revisar backlog de inovação",
      status: "todo",
      priority: "medium",
      assigneeId: membro.id,
      order: 1,
    },
  });
  const t3 = await db.task.create({
    data: {
      organizationId: org.id,
      listId: list.id,
      title: "Preparar demo do MVP",
      status: "backlog",
      priority: "urgent",
      order: 2,
    },
  });

  // Subtarefa de t1 (self-relation via parentTaskId).
  await db.task.create({
    data: {
      organizationId: org.id,
      listId: list.id,
      parentTaskId: t1.id,
      title: "Coletar ideias do time",
      status: "done",
      order: 0,
    },
  });

  // Comentários polimórficos na task t1.
  await db.comment.create({
    data: {
      organizationId: org.id,
      authorId: membro.id,
      commentableType: "Task",
      commentableId: t1.id,
      body: "Comecei o rascunho dos critérios — subi a planilha.",
    },
  });
  await db.comment.create({
    data: {
      organizationId: org.id,
      authorId: lider.id,
      commentableType: "Task",
      commentableId: t1.id,
      body: "Ótimo. Vamos validar os critérios com o time na sexta.",
    },
  });

  // Anexo polimórfico na task t1 (URL externa só para o seed; na UI
  // o upload real passa por /api/upload).
  await db.attachment.create({
    data: {
      organizationId: org.id,
      uploadedById: membro.id,
      attachableType: "Task",
      attachableId: t1.id,
      url: "https://example.com/criterios-gut.xlsx",
      filename: "criterios-gut.xlsx",
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      sizeBytes: 18432,
    },
  });

  // ── Fase 2 (Inovação) — Marco 1 ───────────────────────────────────
  // Pipeline padrão com 5 estágios (Backlog → Triagem → Em Análise →
  // Aprovada → Reprovada), um board ligado à Space, e ideias
  // distribuídas para o Kanban de inovação já mostrar colunas.
  const pipeline = await db.ideaPipeline.create({
    data: { organizationId: org.id, name: "Pipeline de Inovação" },
  });

  const stageDefs = [
    { name: "Backlog", stageType: "BACKLOG", isFinal: false, color: "#94a3b8" },
    { name: "Triagem", stageType: "TRIAGE", isFinal: false, color: "#6366f1" },
    { name: "Em Análise", stageType: "ANALYSIS", isFinal: false, color: "#0ea5e9" },
    { name: "Aprovada", stageType: "APPROVED", isFinal: true, color: "#16a34a" },
    { name: "Reprovada", stageType: "REJECTED", isFinal: true, color: "#dc2626" },
  ];
  const stages = await Promise.all(
    stageDefs.map((s, index) =>
      db.ideaPipelineStage.create({
        data: {
          organizationId: org.id,
          pipelineId: pipeline.id,
          name: s.name,
          stageType: s.stageType,
          isFinal: s.isFinal,
          color: s.color,
          order: index,
        },
      }),
    ),
  );
  const [backlogStage, triageStage, analysisStage, approvedStage] = stages;

  const board = await db.ideaBoard.create({
    data: {
      organizationId: org.id,
      name: "Inovação de Produto",
      slug: "inovacao-de-produto",
      description: "Ideias de novos produtos e features.",
      spaceId: space.id,
      pipelineId: pipeline.id,
    },
  });

  const ideas = await Promise.all(
    [
      {
        title: "App de inovação aberta para clientes",
        description: "Permitir que clientes sugiram features por um formulário.",
        stage: triageStage.id,
        author: membro.id,
      },
      {
        title: "Dashboard de GUT por ideia",
        description: "Mostrar a matriz GUT no card da ideia.",
        stage: analysisStage.id,
        author: lider.id,
      },
      {
        title: "Integração com WhatsApp para captura",
        description: "Receber ideias por um número de WhatsApp.",
        stage: backlogStage.id,
        author: membro.id,
      },
      {
        title: "Replicar ideia aprovada em outra área",
        description: "Aplicar a mesma solução em outro processo.",
        stage: approvedStage.id,
        author: lider.id,
      },
    ].map((i) =>
      db.idea.create({
        data: {
          organizationId: org.id,
          boardId: board.id,
          pipelineStageId: i.stage,
          title: i.title,
          description: i.description,
          authorId: i.author,
          source: "MANUAL",
        },
      }),
    ),
  );

  // Comentário polimórfico numa ideia (commentableType "Idea").
  await db.comment.create({
    data: {
      organizationId: org.id,
      authorId: lider.id,
      commentableType: "Idea",
      commentableId: ideas[0].id,
      body: "Boa ideia — vale priorizar com GUT alto.",
    },
  });

  console.log("Seed aplicado! Usuários (senha de todos: demo12345):");
  console.log("  owner@demo.com   (OWNER)");
  console.log("  lider@demo.com   (LIDER)");
  console.log("  membro@demo.com  (MEMBRO)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });