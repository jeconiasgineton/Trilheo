/**
 * Calcula os updates de `order` a partir de uma lista de ids já
 * na ordem desejada. Usado por qualquer entidade ordenável
 * (stages de pipeline, lists, tasks dentro de uma lista...).
 *
 * Função pura — testável sem banco. O caller aplica os updates
 * em transação (ver innovation/service.ts reorderStages).
 */
export function computeOrderUpdates(
  orderedIds: string[],
): { id: string; order: number }[] {
  return orderedIds.map((id, order) => ({ id, order }));
}

/**
 * True se `orderedIds` é exatamente o mesmo conjunto de `currentIds`
 * (mesmo tamanho, mesmos elementos, sem duplicata nem faltante).
 *
 * Achado da auditoria (Fase 1, seção 9): o reorder original filtrava
 * por organizationId/parentId (então não dava pra alterar dados de
 * outra organização), mas não conferia se o client mandou o conjunto
 * COMPLETO de ids — um payload parcial [A,B] quando existem [A,B,C,D]
 * simplesmente reordenava A/B e deixava C/D como estavam, sem erro.
 * Os services de reorder devem chamar isto antes de aplicar os
 * updates e rejeitar um conjunto incompleto/incorreto.
 */
export function isCompleteOrderSet(
  currentIds: string[],
  orderedIds: string[],
): boolean {
  if (currentIds.length !== orderedIds.length) return false;
  const current = new Set(currentIds);
  const ordered = new Set(orderedIds);
  if (ordered.size !== orderedIds.length) return false; // duplicata no payload
  if (current.size !== ordered.size) return false;
  for (const id of current) {
    if (!ordered.has(id)) return false;
  }
  return true;
}
