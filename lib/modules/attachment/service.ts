import { db } from "@/lib/db";
import { ATTACHABLE_TYPES, type AttachableType } from "./constants";
import type { CreateAttachmentInput } from "./schemas";

export class AttachmentError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_TYPE",
  ) {
    super(message);
    this.name = "AttachmentError";
  }
}

function notFound(entity: string): never {
  throw new AttachmentError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/**
 * Mesma defesa do comment: o attachableId vem do client; sem este
 * check, um usuário poderia anexar a uma task/ideia de outra org.
 * Hoje Task e Idea; ao adicionar tipo novo, adicionar a checagem aqui.
 */
async function assertAttachableInOrg(
  organizationId: string,
  attachableType: string,
  attachableId: string,
) {
  if (!ATTACHABLE_TYPES.includes(attachableType as AttachableType)) {
    throw new AttachmentError("Tipo de anexo inválido.", "INVALID_TYPE");
  }
  if (attachableType === "Task") {
    const task = await db.task.findFirst({
      where: { id: attachableId, organizationId },
      select: { id: true },
    });
    if (!task) notFound("Alvo do anexo");
  } else if (attachableType === "Idea") {
    const idea = await db.idea.findFirst({
      where: { id: attachableId, organizationId },
      select: { id: true },
    });
    if (!idea) notFound("Alvo do anexo");
  }
}

export function listAttachments(
  organizationId: string,
  attachableType: string,
  attachableId: string,
) {
  return db.attachment.findMany({
    where: { organizationId, attachableType, attachableId },
    orderBy: { createdAt: "asc" },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function getAttachment(organizationId: string, id: string) {
  const attachment = await db.attachment.findFirst({
    where: { id, organizationId },
    select: { id: true, uploadedById: true },
  });
  if (!attachment) notFound("Anexo");
  return attachment;
}

export async function createAttachment(
  organizationId: string,
  uploadedById: string,
  input: CreateAttachmentInput,
) {
  await assertAttachableInOrg(
    organizationId,
    input.attachableType,
    input.attachableId,
  );
  return db.attachment.create({
    data: {
      organizationId,
      uploadedById,
      attachableType: input.attachableType,
      attachableId: input.attachableId,
      url: input.url,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
    include: { uploadedBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteAttachment(organizationId: string, id: string) {
  const { count } = await db.attachment.deleteMany({
    where: { id, organizationId },
  });
  if (count === 0) notFound("Anexo");
}