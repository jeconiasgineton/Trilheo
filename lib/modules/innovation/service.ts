import { db } from "@/lib/db";
import { computeOrderUpdates, isCompleteOrderSet } from "@/lib/modules/workspace/reorder";
import {
  buildDefaultPipelineStages,
  computeGutScore,
  DEFAULT_IDEA_SOURCE,
  isFinalStageType,
  isValidIdeaSource,
  isValidStageType,
  STAGE_TYPE_COLORS,
} from "./constants";
import type {
  CreateIdeaBoardInput,
  CreateIdeaInput,
  CreateIdeaPipelineInput,
  CreateIdeaPipelineStageInput,
  MoveIdeaInput,
  ReorderIdeaPipelineStagesInput,
  SetIdeaGutInput,
  SubmitPublicIdeaInput,
  UpdateIdeaBoardInput,
  UpdateIdeaInput,
  UpdateIdeaPipelineInput,
  UpdateIdeaPipelineStageInput,
} from "./schemas";

export class InnovationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "NOT_FOUND"
      | "CROSS_ORG"
      | "PIPELINE_IN_USE"
      | "STAGE_HAS_IDEAS"
      | "PIPELINE_HAS_NO_STAGES"
      | "INVALID_STAGE_TYPE"
      | "INVALID_SOURCE"
      | "APPROVE_REQUIRED"
      | "EXIT_FINAL_REQUIRES_APPROVE"
      | "CROSS_PIPELINE"
      | "INVALID_ORDER_SET"
      | "PUBLIC_CAPTURE_DISABLED",
  ) {
    super(message);
    this.name = "InnovationError";
  }
}

/**
 * Mesma regra dos módulos workspace/task (ver workspace/service.ts):
 * toda função recebe `organizationId` (da sessão, nunca do client) e
 * filtra por ele em toda query. Quando um recurso não é encontrado
 * com esse filtro, tratamos como "não existe" mesmo que exista em
 * outra organização — nunca vazamos a diferença (evita enumeração
 * cross-tenant).
 */
function notFound(entity: string): never {
  throw new InnovationError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/** Slug amigável para URL (/[orgSlug]/innovation/[boardSlug]). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function assertPipelineInOrg(organizationId: string, pipelineId: string) {
  const pipeline = await db.ideaPipeline.findFirst({
    where: { id: pipelineId, organizationId },
    select: { id: true },
  });
  if (!pipeline) notFound("Pipeline");
}

async function assertSpaceInOrg(organizationId: string, spaceId: string) {
  const space = await db.space.findFirst({
    where: { id: spaceId, organizationId },
    select: { id: true },
  });
  if (!space) notFound("Space");
}

async function assertBoardInOrg(organizationId: string, boardId: string) {
  const board = await db.ideaBoard.findFirst({
    where: { id: boardId, organizationId },
    select: { id: true, pipelineId: true },
  });
  if (!board) notFound("Board");
  return board;
}

// ── Pipeline ────────────────────────────────────────────────────────

export function listPipelines(organizationId: string) {
  return db.ideaPipeline.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      stages: { orderBy: { order: "asc" } },
      _count: { select: { boards: true } },
    },
  });
}

export async function getPipeline(organizationId: string, id: string) {
  const pipeline = await db.ideaPipeline.findFirst({
    where: { id, organizationId },
    include: { stages: { orderBy: { order: "asc" } } },
  });
  if (!pipeline) notFound("Pipeline");
  return pipeline;
}

/**
 * Cria um pipeline já com o conjunto padrão de estágios
 * (buildDefaultPipelineStages) numa transação — assim o pipeline é
 * imediatamente usável por um board. Reaproveitar estágios de outro
 * pipeline fica para uma futura UI de "duplicar pipeline".
 */
export async function createPipeline(
  organizationId: string,
  input: CreateIdeaPipelineInput,
) {
  const defaults = buildDefaultPipelineStages();
  return db.$transaction(async (tx) => {
    const pipeline = await tx.ideaPipeline.create({
      data: { organizationId, name: input.name },
    });
    await tx.ideaPipelineStage.createMany({
      data: defaults.map((s, index) => ({
        organizationId,
        pipelineId: pipeline.id,
        name: s.name,
        stageType: s.stageType,
        isFinal: s.isFinal,
        color: STAGE_TYPE_COLORS[s.stageType],
        order: index,
      })),
    });
    return pipeline;
  });
}

export async function updatePipeline(
  organizationId: string,
  id: string,
  input: UpdateIdeaPipelineInput,
) {
  const { count } = await db.ideaPipeline.updateMany({
    where: { id, organizationId },
    data: { name: input.name },
  });
  if (count === 0) notFound("Pipeline");
  return db.ideaPipeline.findUniqueOrThrow({ where: { id } });
}

/**
 * Excluir pipeline: o schema tem `onDelete: Restrict` na relation
 * com boards, então o Postgres recusa se houver boards usando-o.
 * Antecipamos com uma checagem amigável (PIPELINE_IN_USE) para não
 * depender só do erro de FK do banco.
 */
export async function deletePipeline(organizationId: string, id: string) {
  await assertPipelineInOrg(organizationId, id);
  const inUse = await db.ideaBoard.findFirst({
    where: { pipelineId: id, organizationId },
    select: { id: true },
  });
  if (inUse) {
    throw new InnovationError(
      "Pipeline em uso por boards — remova ou troque o pipeline dos boards antes.",
      "PIPELINE_IN_USE",
    );
  }
  const { count } = await db.ideaPipeline.deleteMany({
    where: { id, organizationId },
  });
  if (count === 0) notFound("Pipeline");
}

// ── Stage ────────────────────────────────────────────────────────────

export function listStages(organizationId: string, pipelineId: string) {
  return db.ideaPipelineStage.findMany({
    where: { organizationId, pipelineId },
    orderBy: { order: "asc" },
  });
}

export async function createStage(
  organizationId: string,
  input: CreateIdeaPipelineStageInput,
) {
  await assertPipelineInOrg(organizationId, input.pipelineId);
  if (!isValidStageType(input.stageType)) {
    throw new InnovationError("Tipo de estágio inválido.", "INVALID_STAGE_TYPE");
  }
  const last = await db.ideaPipelineStage.findFirst({
    where: { pipelineId: input.pipelineId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  return db.ideaPipelineStage.create({
    data: {
      organizationId,
      pipelineId: input.pipelineId,
      name: input.name,
      stageType: input.stageType,
      color: input.color ?? STAGE_TYPE_COLORS[input.stageType],
      isFinal: input.isFinal ?? isFinalStageType(input.stageType),
      order: (last?.order ?? -1) + 1,
    },
  });
}

export async function updateStage(
  organizationId: string,
  id: string,
  input: UpdateIdeaPipelineStageInput,
) {
  const existing = await db.ideaPipelineStage.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Estágio");

  if (input.stageType !== undefined && !isValidStageType(input.stageType)) {
    throw new InnovationError("Tipo de estágio inválido.", "INVALID_STAGE_TYPE");
  }

  const { count } = await db.ideaPipelineStage.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.stageType !== undefined && { stageType: input.stageType }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.isFinal !== undefined && { isFinal: input.isFinal }),
    },
  });
  if (count === 0) notFound("Estágio");
  return db.ideaPipelineStage.findUniqueOrThrow({ where: { id } });
}

/**
 * Excluir estágio: `onDelete: Restrict` na relation com ideas — o
 * Postgres recusa se houver ideias nele. Antecipamos com checagem
 * amigável (STAGE_HAS_IDEAS).
 */
export async function deleteStage(organizationId: string, id: string) {
  const stage = await db.ideaPipelineStage.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!stage) notFound("Estágio");
  const hasIdeas = await db.idea.findFirst({
    where: { pipelineStageId: id, organizationId },
    select: { id: true },
  });
  if (hasIdeas) {
    throw new InnovationError(
      "Estágio possui ideias — mova-as antes de excluí-lo.",
      "STAGE_HAS_IDEAS",
    );
  }
  const { count } = await db.ideaPipelineStage.deleteMany({
    where: { id, organizationId },
  });
  if (count === 0) notFound("Estágio");
}

export async function reorderStages(
  organizationId: string,
  input: ReorderIdeaPipelineStagesInput,
) {
  await assertPipelineInOrg(organizationId, input.pipelineId);
  const current = await db.ideaPipelineStage.findMany({
    where: { organizationId, pipelineId: input.pipelineId },
    select: { id: true },
  });
  if (!isCompleteOrderSet(current.map((s) => s.id), input.orderedIds)) {
    throw new InnovationError(
      "A lista enviada para reordenar precisa conter exatamente os estágios atuais, sem faltar nem repetir.",
      "INVALID_ORDER_SET",
    );
  }
  const updates = computeOrderUpdates(input.orderedIds);
  await db.$transaction(
    updates.map(({ id, order }) =>
      db.ideaPipelineStage.updateMany({
        where: { id, organizationId, pipelineId: input.pipelineId },
        data: { order },
      }),
    ),
  );
}

// ── Board ────────────────────────────────────────────────────────────

export function listBoards(organizationId: string) {
  return db.ideaBoard.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      pipeline: { select: { id: true, name: true } },
      space: { select: { id: true, name: true } },
      _count: { select: { ideas: true } },
    },
  });
}

export async function getBoardWithStages(organizationId: string, boardId: string) {
  const board = await db.ideaBoard.findFirst({
    where: { id: boardId, organizationId },
    include: {
      pipeline: {
        include: { stages: { orderBy: { order: "asc" } } },
      },
      space: { select: { id: true, name: true } },
    },
  });
  if (!board) notFound("Board");
  return board;
}

export async function createBoard(
  organizationId: string,
  input: CreateIdeaBoardInput,
) {
  await assertPipelineInOrg(organizationId, input.pipelineId);
  if (input.spaceId) {
    await assertSpaceInOrg(organizationId, input.spaceId);
  }
  const slug = input.slug || slugify(input.name);
  if (!slug) {
    throw new InnovationError("Não foi possível gerar um slug válido.", "NOT_FOUND");
  }
  return db.ideaBoard.create({
    data: {
      organizationId,
      name: input.name,
      slug,
      description: input.description ?? null,
      spaceId: input.spaceId ?? null,
      pipelineId: input.pipelineId,
    },
  });
}

export async function updateBoard(
  organizationId: string,
  id: string,
  input: UpdateIdeaBoardInput,
) {
  const { count } = await db.ideaBoard.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });
  if (count === 0) notFound("Board");
  return db.ideaBoard.findUniqueOrThrow({ where: { id } });
}

export async function deleteBoard(organizationId: string, id: string) {
  const { count } = await db.ideaBoard.deleteMany({
    where: { id, organizationId },
  });
  if (count === 0) notFound("Board");
}

// ── Idea ─────────────────────────────────────────────────────────────

/**
 * Ideias de um board agrupadas por estágio — usado pelo Kanban de
 * ideias. Sempre devolve uma coluna por estágio do pipeline do
 * board (mesmo vazia), na ordem de `order`, para a UI montar as
 * colunas sem precisar saber quais estágios existem.
 */
export async function listIdeasByStage(organizationId: string, boardId: string) {
  const board = await getBoardWithStages(organizationId, boardId);
  const ideas = await db.idea.findMany({
    where: { organizationId, boardId },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
  const byStage: Record<string, typeof ideas> = {};
  for (const stage of board.pipeline.stages) {
    byStage[stage.id] = [];
  }
  for (const idea of ideas) {
    if (!byStage[idea.pipelineStageId]) byStage[idea.pipelineStageId] = [];
    byStage[idea.pipelineStageId].push(idea);
  }
  return {
    board,
    columns: board.pipeline.stages.map((stage) => ({
      stage,
      ideas: byStage[stage.id] ?? [],
    })),
  };
}

/** Primeiro estágio do pipeline (menor `order`) — estágio inicial de captura. */
async function firstStageOfPipeline(pipelineId: string) {
  return db.ideaPipelineStage.findFirst({
    where: { pipelineId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
}

export async function createIdea(
  organizationId: string,
  authorId: string,
  input: CreateIdeaInput,
) {
  const board = await assertBoardInOrg(organizationId, input.boardId);

  let stageId = input.pipelineStageId;
  if (!stageId) {
    const first = await firstStageOfPipeline(board.pipelineId);
    if (!first) {
      throw new InnovationError(
        "O pipeline do board não tem estágios.",
        "PIPELINE_HAS_NO_STAGES",
      );
    }
    stageId = first.id;
  } else {
    // estágio informado precisa pertencer ao pipeline do board.
    const stage = await db.ideaPipelineStage.findFirst({
      where: { id: stageId, organizationId, pipelineId: board.pipelineId },
      select: { id: true },
    });
    if (!stage) notFound("Estágio");
  }

  const source = input.source ?? DEFAULT_IDEA_SOURCE;
  if (!isValidIdeaSource(source)) {
    throw new InnovationError("Origem da ideia inválida.", "INVALID_SOURCE");
  }

  return db.idea.create({
    data: {
      organizationId,
      boardId: input.boardId,
      pipelineStageId: stageId,
      title: input.title,
      description: input.description ?? null,
      authorId,
      source,
    },
    include: {
      author: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function updateIdea(
  organizationId: string,
  id: string,
  input: UpdateIdeaInput,
) {
  const existing = await db.idea.findFirst({
    where: { id, organizationId },
    select: { id: true },
  });
  if (!existing) notFound("Ideia");

  const { count } = await db.idea.updateMany({
    where: { id, organizationId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
    },
  });
  if (count === 0) notFound("Ideia");
  return db.idea.findUniqueOrThrow({
    where: { id },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Move uma ideia entre estágios do pipeline do board.
 *
 * Regra de estágio final (ver marco-1-idea-pipeline.md): não se sai
 * de um estágio final sem aprovação explícita, e mover PARA um
 * estágio final é uma aprovação/reprovação. Ambos exigem
 * `approve=true` (que no action exige idea:approve, LIDER+).
 *
 * `approve=false` cobre a movimentação comum entre estágios
 * não-finais (idea:move, MEMBRO+).
 */
export async function moveIdea(
  organizationId: string,
  id: string,
  input: MoveIdeaInput,
) {
  const idea = await db.idea.findFirst({
    where: { id, organizationId },
    include: {
      board: { select: { pipelineId: true } },
      pipelineStage: { select: { id: true, isFinal: true } },
    },
  });
  if (!idea) notFound("Ideia");

  const target = await db.ideaPipelineStage.findFirst({
    where: {
      id: input.targetStageId,
      organizationId,
      pipelineId: idea.board.pipelineId,
    },
    select: { id: true, isFinal: true },
  });
  if (!target) notFound("Estágio de destino");

  const approve = !!input.approve;

  // Mover PARA estágio final = aprovação/reprovação.
  if (target.isFinal && !approve) {
    throw new InnovationError(
      "Mover para um estágio final exige permissão de aprovação (Líder+).",
      "APPROVE_REQUIRED",
    );
  }
  // Sair DE estágio final (reabrir) = também exige aprovação.
  if (
    idea.pipelineStage.isFinal &&
    idea.pipelineStage.id !== target.id &&
    !approve
  ) {
    throw new InnovationError(
      "Reabrir uma ideia de um estágio final exige permissão de aprovação (Líder+).",
      "EXIT_FINAL_REQUIRES_APPROVE",
    );
  }

  const { count } = await db.idea.updateMany({
    where: { id, organizationId },
    data: { pipelineStageId: target.id },
  });
  if (count === 0) notFound("Ideia");
  return db.idea.findUniqueOrThrow({
    where: { id },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteIdea(organizationId: string, id: string) {
  const { count } = await db.idea.deleteMany({
    where: { id, organizationId },
  });
  if (count === 0) notFound("Ideia");
}

/** Ideia com autor, estágio e board (comentários/anexos vêm pelo módulo polimórfico). */
export async function getIdeaWithDetails(organizationId: string, id: string) {
  const idea = await db.idea.findFirst({
    where: { id, organizationId },
    include: {
      author: { select: { id: true, name: true, email: true } },
      pipelineStage: true,
      board: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!idea) notFound("Ideia");
  return idea;
}

// ── Matriz GUT ───────────────────────────────────────────────────────

/**
 * Define a pontuação GUT (Gravidade/Urgência/Tendência) de uma ideia
 * e denormaliza `gutScore` (gravity*urgency*trend) para ordenar o
 * backlog por prioridade sem calcular em memória a cada leitura.
 */
export async function setIdeaGut(organizationId: string, input: SetIdeaGutInput) {
  const gutScore = computeGutScore(input.gravity, input.urgency, input.trend);
  const { count } = await db.idea.updateMany({
    where: { id: input.ideaId, organizationId },
    data: {
      gutGravity: input.gravity,
      gutUrgency: input.urgency,
      gutTrend: input.trend,
      gutScore,
    },
  });
  if (count === 0) notFound("Ideia");
  return db.idea.findUniqueOrThrow({
    where: { id: input.ideaId },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

/** Ideias de um board ordenadas por score GUT (maior prioridade primeiro). Ideias sem GUT ficam por último. */
export async function listIdeasByGutScore(organizationId: string, boardId: string) {
  await assertBoardInOrg(organizationId, boardId);
  return db.idea.findMany({
    where: { organizationId, boardId },
    orderBy: [{ gutScore: { sort: "desc", nulls: "last" } }, { createdAt: "asc" }],
    include: {
      author: { select: { id: true, name: true, email: true } },
      pipelineStage: { select: { id: true, name: true, color: true } },
    },
  });
}

// ── Captura pública (QR Code / formulário) ─────────────────────────

/**
 * Board pelo token público — usado pela página pública (sem sessão)
 * e pelo submit. Só devolve o board se a captura estiver habilitada;
 * board desabilitado ou token inexistente são tratados igual (evita
 * confirmar a um visitante que um token "quase certo" existe).
 */
export async function getBoardByPublicToken(publicToken: string) {
  const board = await db.ideaBoard.findFirst({
    where: { publicToken, publicCaptureEnabled: true },
    include: { pipeline: { include: { stages: { orderBy: { order: "asc" } } } } },
  });
  if (!board) notFound("Formulário");
  return board;
}

/**
 * Envio público de ideia (QR Code / formulário) — SEM sessão, então
 * sem `organizationId` de contexto e sem `requirePermission`: a
 * própria existência do board com `publicCaptureEnabled=true` é a
 * autorização (qualquer um com o link pode enviar, de propósito).
 * `authorId` fica nulo; `submitterName`/`submitterEmail` guardam a
 * identificação em texto livre (decisão registrada no CONTEXTO.MD).
 */
export async function submitPublicIdea(input: SubmitPublicIdeaInput) {
  const board = await getBoardByPublicToken(input.publicToken);
  const first = board.pipeline.stages[0];
  if (!first) {
    throw new InnovationError("O pipeline deste board não tem estágios.", "PIPELINE_HAS_NO_STAGES");
  }
  return db.idea.create({
    data: {
      organizationId: board.organizationId,
      boardId: board.id,
      pipelineStageId: first.id,
      title: input.title,
      description: input.description ?? null,
      authorId: null,
      submitterName: input.submitterName?.trim() || null,
      submitterEmail: input.submitterEmail?.trim() || null,
      source: input.source,
    },
  });
}

export async function toggleBoardPublicCapture(
  organizationId: string,
  boardId: string,
  enabled: boolean,
) {
  const { count } = await db.ideaBoard.updateMany({
    where: { id: boardId, organizationId },
    data: { publicCaptureEnabled: enabled },
  });
  if (count === 0) notFound("Board");
  return db.ideaBoard.findUniqueOrThrow({ where: { id: boardId } });
}

/**
 * Regenera o token público (recuperação de vazamento) — invalida a
 * URL/QR anterior. `crypto.randomUUID()` é global (Node 19+), sem
 * import de "node:crypto" — um `import` desse módulo builtin quebra
 * o bundle de client components que importam deste arquivo via
 * barrel (ver lib/modules/innovation/index.ts).
 */
export async function regenerateBoardPublicToken(organizationId: string, boardId: string) {
  await assertBoardInOrg(organizationId, boardId);
  return db.ideaBoard.update({
    where: { id: boardId },
    data: { publicToken: crypto.randomUUID() },
  });
}