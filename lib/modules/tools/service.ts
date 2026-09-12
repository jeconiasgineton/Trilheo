import { db } from "@/lib/db";
import { ANALYZABLE_TYPES, type AnalyzableType } from "./constants";
import type { CreateToolInput, UpdateToolInput } from "./schemas";

export class ToolError extends Error {
  constructor(
    message: string,
    public readonly code: "NOT_FOUND" | "INVALID_TYPE",
  ) {
    super(message);
    this.name = "ToolError";
  }
}

function notFound(entity: string): never {
  throw new ToolError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/**
 * Mesma defesa do comment/attachment: o analyzableId vem do client;
 * sem este check, um usuário poderia anexar uma análise a uma ideia
 * de outra org só mandando o id dela. Hoje só "Idea"; ao adicionar
 * tipo novo (ex.: Task), adicionar a checagem aqui também.
 */
async function assertAnalyzableInOrg(
  organizationId: string,
  analyzableType: string,
  analyzableId: string,
) {
  if (!ANALYZABLE_TYPES.includes(analyzableType as AnalyzableType)) {
    throw new ToolError("Tipo de análise inválido.", "INVALID_TYPE");
  }
  if (analyzableType === "Idea") {
    const idea = await db.idea.findFirst({
      where: { id: analyzableId, organizationId },
      select: { id: true },
    });
    if (!idea) notFound("Ideia");
  }
}

export function listTools(organizationId: string, analyzableType: string, analyzableId: string) {
  return db.improvementTool.findMany({
    where: { organizationId, analyzableType, analyzableId },
    orderBy: { createdAt: "asc" },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function getTool(organizationId: string, id: string) {
  const tool = await db.improvementTool.findFirst({
    where: { id, organizationId },
    select: { id: true, createdById: true },
  });
  if (!tool) notFound("Ferramenta");
  return tool;
}

export async function createTool(
  organizationId: string,
  createdById: string,
  input: CreateToolInput,
) {
  await assertAnalyzableInOrg(organizationId, input.analyzableType, input.analyzableId);
  return db.improvementTool.create({
    data: {
      organizationId,
      createdById,
      analyzableType: input.analyzableType,
      analyzableId: input.analyzableId,
      type: input.type,
      title: input.title,
      content: input.content,
    },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function updateTool(organizationId: string, id: string, input: UpdateToolInput) {
  const { count } = await db.improvementTool.updateMany({
    where: { id, organizationId, type: input.type },
    data: { title: input.title, content: input.content },
  });
  if (count === 0) notFound("Ferramenta");
  return db.improvementTool.findUniqueOrThrow({
    where: { id },
    include: { createdBy: { select: { id: true, name: true, email: true } } },
  });
}

export async function deleteTool(organizationId: string, id: string) {
  const { count } = await db.improvementTool.deleteMany({ where: { id, organizationId } });
  if (count === 0) notFound("Ferramenta");
}
