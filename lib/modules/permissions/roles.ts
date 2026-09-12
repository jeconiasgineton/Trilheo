import { ACTIONS, type Action } from "./actions";

/**
 * Papéis da plataforma (mesmo conjunto do enum Prisma MemberRole).
 * A hierarquia é por RANK: papéis acima herdam permissões dos abaixo.
 * Toda decisão de permissão passa por `can`/`requirePermission` —
 * nunca fazer checagem de papel "solta" no código.
 */
export type Role = "OWNER" | "ADMIN" | "GESTOR" | "LIDER" | "MEMBRO" | "CONVIDADO";

const RANK: Record<Role, number> = {
  CONVIDADO: 0,
  MEMBRO: 1,
  LIDER: 2,
  GESTOR: 3,
  ADMIN: 4,
  OWNER: 5,
};

/** Erro de permissão — carrega role/action para log/debug e para a UI traduzir. */
export class PermissionError extends Error {
  constructor(
    public readonly role: Role,
    public readonly action: Action,
  ) {
    super(`Papel "${role}" não tem permissão para "${action}".`);
    this.name = "PermissionError";
  }
}

/** True se `role` atinge o papel mínimo exigido pela ação. */
export function can(role: Role, action: Action): boolean {
  const required = ACTIONS[action];
  if (!required) return false;
  return RANK[role] >= RANK[required];
}

/** Lança PermissionError se faltar permissão. */
export function requirePermission(role: Role, action: Action): void {
  if (!can(role, action)) {
    throw new PermissionError(role, action);
  }
}

/** True se `role` tem privilégio igual ou maior que `minimum` na hierarquia. */
export function roleAtLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}
