import { db } from "@/lib/db";
import { COMMENTABLE_TYPES, type CommentableType } from "./constants";
import type { CreateCommentInput } from "./schemas";

export class CommentError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_TYPE",
  ) {
    super(message);
    this.name = "CommentError";
  }
}

function notFound(entity: string): never {
  throw new CommentError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/**
 * Verifica que o alvo do comentário existe e pertence à organização
 * (defesa em profundidade: o commentableId vem do client; sem este
 * check, um usuário poderia comentar numa task/ideia de outra org só
 * mandando o id dela). Ao adicionar um tipo novo em
 * COMMENTABLE_TYPES, adicionar a checagem aqui também.
 */
async function assertCommentableInOrg(
  organizationId: string,
  commentableType: string,
  commentableId: string,
) {
  if (!COMMENTABLE_TYPES.includes(commentableType as CommentableType)) {
    throw new CommentError("Tipo de comentário inválido.", "INVALID_TYPE");
  }
  if (commentableType === "Task") {
    const task = await db.task.findFirst({
      where: { id: commentableId, organizationId },
      select: { id: true },
    });
    if (!task) notFound("Alvo do comentário");
  } else if (commentableType === "Idea") {
    const idea = await db.idea.findFirst({
      where: { id: commentableId, organizationId },
      select: { id: true },
    });
    if (!idea) notFound("Alvo do comentário");
  }
}

/** Comentários de uma entidade, ordenados por criação (mais antigo primeiro). */
export function listComments(
  organizationId: string,
  commentableType: string,
  commentableId: string,
) {
  return db.comment.findMany({
    where: { organizationId, commentableType, commentableId },
    orderBy: { createdAt: "asc" },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

/**
 * Retorna o comentário (só com authorId) para checagem de posse no
 * action. Filtrado por organizationId — se não existe nesta org,
 * vira NOT_FOUND (mesmo que exista em outra).
 */
export async function getComment(organizationId: string, id: string) {
  const comment = await db.comment.findFirst({
    where: { id, organizationId },
    select: { id: true, authorId: true },
  });
  if (!comment) notFound("Comentário");
  return comment;
}

export async function createComment(
  organizationId: string,
  authorId: string,
  input: CreateCommentInput,
) {
  await assertCommentableInOrg(
    organizationId,
    input.commentableType,
    input.commentableId,
  );
  return db.comment.create({
    data: {
      organizationId,
      authorId,
      commentableType: input.commentableType,
      commentableId: input.commentableId,
      body: input.body,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteComment(organizationId: string, id: string) {
  const { count } = await db.comment.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Comentário");
}