"use server";

import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import { authOptions } from "@/lib/modules/auth";
import { requirePermission, type Action, type Role } from "@/lib/modules/permissions";
import { checkRateLimit, getClientIp, logSecurityEvent } from "@/lib/rate-limit";
import * as service from "./service";
import { InnovationError } from "./service";
import {
  createIdeaBoardSchema,
  createIdeaPipelineSchema,
  createIdeaPipelineStageSchema,
  createIdeaSchema,
  moveIdeaSchema,
  reorderIdeaPipelineStagesSchema,
  setIdeaGutSchema,
  submitPublicIdeaSchema,
  toggleBoardPublicCaptureSchema,
  updateIdeaBoardSchema,
  updateIdeaPipelineSchema,
  updateIdeaPipelineStageSchema,
  updateIdeaSchema,
} from "./schemas";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Mesmo molde dos módulos task/comment: sessão → validação zod →
 * permissão (requirePermission, nunca confiar só na UI) → service
 * (que filtra por organizationId). Três camadas redundantes de
 * propósito (defesa em profundidade).
 *
 * Regra de ideia (moderação local, ver CONTEXTO.MD): o AUTOR sempre
 * pode excluir a própria ideia (qualquer papel com idea:create);
 * excluir ideia DE OUTRO exige idea:delete (LIDER+). A checagem de
 * posse fica no action (precisa do authorId), a exclusão no service.
 *
 * `moveIdeaAction`: se `approve` for true, exige idea:approve
 * (LIDER+); senão idea:move (MEMBRO+). O service valida a regra de
 * estágio final e devolve APPROVE_REQUIRED / EXIT_FINAL_REQUIRES_APPROVE
 * quando a movimentação precisaria de aprovação — o action traduz
 * para mensagem amigável.
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
    if (err instanceof InnovationError) {
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

// ── Pipeline ────────────────────────────────────────────────────────

export async function createIdeaPipelineAction(formData: unknown) {
  const parsed = createIdeaPipelineSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.createPipeline(organizationId, parsed.data);
  });
}

export async function updateIdeaPipelineAction(formData: unknown) {
  const parsed = updateIdeaPipelineSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.updatePipeline(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteIdeaPipelineAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.deletePipeline(organizationId, id);
  });
}

// ── Stage ────────────────────────────────────────────────────────────

export async function createIdeaPipelineStageAction(formData: unknown) {
  const parsed = createIdeaPipelineStageSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.createStage(organizationId, parsed.data);
  });
}

export async function updateIdeaPipelineStageAction(formData: unknown) {
  const parsed = updateIdeaPipelineStageSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.updateStage(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteIdeaPipelineStageAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.deleteStage(organizationId, id);
  });
}

export async function reorderIdeaPipelineStagesAction(formData: unknown) {
  const parsed = reorderIdeaPipelineStagesSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "pipeline:manage");
    return service.reorderStages(organizationId, parsed.data);
  });
}

// ── Board ────────────────────────────────────────────────────────────

export async function createIdeaBoardAction(formData: unknown) {
  const parsed = createIdeaBoardSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "board:manage");
    return service.createBoard(organizationId, parsed.data);
  });
}

export async function updateIdeaBoardAction(formData: unknown) {
  const parsed = updateIdeaBoardSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "board:manage");
    return service.updateBoard(organizationId, parsed.data.id, parsed.data);
  });
}

export async function deleteIdeaBoardAction(id: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "board:manage");
    return service.deleteBoard(organizationId, id);
  });
}

// ── Idea ─────────────────────────────────────────────────────────────

export async function createIdeaAction(formData: unknown) {
  const parsed = createIdeaSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role, id: userId }) => {
    assertCan(role, "idea:create");
    return service.createIdea(organizationId, userId, parsed.data);
  });
}

export async function updateIdeaAction(formData: unknown) {
  const parsed = updateIdeaSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "idea:update");
    return service.updateIdea(organizationId, parsed.data.id, parsed.data);
  });
}

export async function moveIdeaAction(formData: unknown) {
  const parsed = moveIdeaSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    // approve=true exige idea:approve (LIDER+); senão idea:move (MEMBRO+).
    // Um MEMBRO que envie approve=true é barrado aqui (defesa em profundidade).
    assertCan(role, parsed.data.approve ? "idea:approve" : "idea:move");
    return service.moveIdea(organizationId, parsed.data.ideaId, parsed.data);
  });
}

export async function deleteIdeaAction(id: string) {
  return withSession(async ({ organizationId, role, id: userId }) => {
    const idea = await service.getIdeaWithDetails(organizationId, id);
    // Autor pode excluir a própria; demais precisam idea:delete (LIDER+).
    if (idea.authorId !== userId) {
      assertCan(role, "idea:delete");
    }
    return service.deleteIdea(organizationId, id);
  });
}

// ── Matriz GUT ───────────────────────────────────────────────────────

export async function setIdeaGutAction(formData: unknown) {
  const parsed = setIdeaGutSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    // Mesma permissão de editar a ideia — pontuar GUT é parte da
    // triagem/análise, não uma ação de aprovação (idea:approve).
    assertCan(role, "idea:update");
    return service.setIdeaGut(organizationId, parsed.data);
  });
}

// ── Captura pública (QR Code / formulário) ─────────────────────────

export async function toggleBoardPublicCaptureAction(formData: unknown) {
  const parsed = toggleBoardPublicCaptureSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(({ organizationId, role }) => {
    assertCan(role, "board:manage");
    return service.toggleBoardPublicCapture(organizationId, parsed.data.boardId, parsed.data.enabled);
  });
}

export async function regenerateBoardPublicTokenAction(boardId: string) {
  return withSession(({ organizationId, role }) => {
    assertCan(role, "board:manage");
    return service.regenerateBoardPublicToken(organizationId, boardId);
  });
}

/**
 * SEM sessão de propósito — é o endpoint que a página pública
 * (`/public/idea/[token]`) chama. A autorização é o próprio token do
 * board estar com `publicCaptureEnabled=true` (ver service). Nunca
 * usar `withSession`/`requirePermission` aqui.
 */
export async function submitPublicIdeaAction(formData: unknown) {
  const ip = getClientIp(headers());
  const rateLimit = checkRateLimit(`public-idea:${ip}`, 20, 60 * 60_000);
  if (!rateLimit.allowed) {
    logSecurityEvent("public_idea_rate_limited", { ip });
    return { ok: false as const, error: "Muitos envios a partir deste dispositivo. Tente novamente mais tarde." };
  }

  const parsed = submitPublicIdeaSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const data = await service.submitPublicIdea(parsed.data);
    return { ok: true as const, data };
  } catch (err) {
    if (err instanceof InnovationError) {
      return { ok: false as const, error: err.message };
    }
    throw err;
  }
}