/**
 * Tipos de entidade que podem receber anexo. Mesma ideia de
 * COMMENTABLE_TYPES: polimórfico via attachableType/Id. Task (Fase 1)
 * e Idea (Fase 2).
 */
export const ATTACHABLE_TYPES = ["Task", "Idea"] as const;
export type AttachableType = (typeof ATTACHABLE_TYPES)[number];

export function isValidAttachableType(value: string): value is AttachableType {
  return (ATTACHABLE_TYPES as readonly string[]).includes(value);
}