/**
 * Tipos de entidade que podem receber comentário. Task (Fase 1) e
 * Idea (Fase 2). Nas próximas fases Project, BusinessCase etc.
 * reusam a mesma tabela Comment (relação polimórfica via
 * commentableType/Id) — basta adicionar o tipo aqui e no
 * assertCommentableInOrg do service. O banco guarda String (não
 * enum) pelo mesmo motivo de Task.status: flexibilidade para
 * customização futura.
 */
export const COMMENTABLE_TYPES = ["Task", "Idea"] as const;
export type CommentableType = (typeof COMMENTABLE_TYPES)[number];

export function isValidCommentableType(value: string): value is CommentableType {
  return (COMMENTABLE_TYPES as readonly string[]).includes(value);
}