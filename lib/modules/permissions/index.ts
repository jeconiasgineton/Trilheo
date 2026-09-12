export * from "./roles";
export * from "./actions";

import { can, roleAtLeast, PermissionError, type Role } from "./roles";

/**
 * Regra especial para troca de papel de um membro: não cabe na tabela
 * simples de actions.ts porque depende do papel ATUAL e do papel NOVO
 * do alvo, não só de quem está agindo.
 *
 * Regras:
 * 1. Quem age precisa ter a permissão base "member:changeRole".
 * 2. Ninguém além de um OWNER pode alterar o papel de outro OWNER
 *    (protege contra um ADMIN rebaixar o dono da organização).
 * 3. Ninguém (exceto OWNER) pode promover outra pessoa para um papel
 *    igual ou acima do seu próprio papel (evita auto-promoção via
 *    terceiros e escalonamento de privilégio).
 */
export function canChangeRole(
  actingRole: Role,
  targetCurrentRole: Role,
  targetNewRole: Role,
): boolean {
  if (!can(actingRole, "member:changeRole")) return false;
  if (targetCurrentRole === "OWNER" && actingRole !== "OWNER") return false;
  if (actingRole !== "OWNER" && roleAtLeast(targetNewRole, actingRole)) {
    return false;
  }
  return true;
}

/** Mesma regra que `canChangeRole`, mas lançando PermissionError. */
export function requireCanChangeRole(
  actingRole: Role,
  targetCurrentRole: Role,
  targetNewRole: Role,
): void {
  if (!canChangeRole(actingRole, targetCurrentRole, targetNewRole)) {
    throw new PermissionError(actingRole, "member:changeRole");
  }
}
