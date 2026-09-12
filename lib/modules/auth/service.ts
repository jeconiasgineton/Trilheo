import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import type { Role } from "@/lib/modules/permissions";
import type { InviteMemberInput, SignupInput } from "./schemas";

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "EMAIL_IN_USE" | "NOT_FOUND" | "ALREADY_MEMBER" | "LAST_OWNER",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function notFound(entity: string): never {
  throw new AuthError(`${entity} não encontrado(a).`, "NOT_FOUND");
}

/** Slug amigável para URL (/[orgSlug]/...), com sufixo numérico em caso de colisão. */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function uniqueOrganizationSlug(base: string): Promise<string> {
  const root = slugify(base) || "org";
  let candidate = root;
  let suffix = 2;
  while (await db.organization.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${root}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/** Senha temporária legível (sem caracteres ambíguos) para o fluxo de convite. */
export function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(12);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

/**
 * Signup: cria Organization + User + OrganizationMember(OWNER) numa
 * transação. Primeiro usuário da organização é sempre OWNER (regra
 * do prompt original da Fase 1).
 */
export async function createOrganizationWithOwner(input: SignupInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    throw new AuthError("Este email já está em uso.", "EMAIL_IN_USE");
  }

  const slug = await uniqueOrganizationSlug(input.organizationName);
  const passwordHash = await bcrypt.hash(input.password, 12);

  return db.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: input.organizationName, slug },
    });
    const user = await tx.user.create({
      data: { email, name: input.name, passwordHash },
    });
    await tx.organizationMember.create({
      data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });
    return { organization, user };
  });
}

/**
 * Usado pelo NextAuth `authorize()` — função de serviço separada
 * (em vez de lógica inline no provider) para ser testável sem subir
 * o Next. Devolve o User se as credenciais forem válidas, senão null
 * (NextAuth trata null como "credenciais inválidas").
 */
export async function verifyCredentials(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return user;
}

/**
 * Convite de membro (Fase 1, função 2). Sem serviço de e-mail
 * configurado ainda (ver CONTEXTO.MD): se o email não existe, cria o
 * usuário com senha temporária gerada pelo sistema e a devolve para
 * o admin repassar manualmente; se já existe, só adiciona o
 * membership (sem gerar/expor senha de conta alheia).
 */
export async function inviteMember(
  organizationId: string,
  input: InviteMemberInput,
) {
  const organization = await db.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });
  const organizationName = organization?.name ?? "Trilheo";

  const email = input.email.trim().toLowerCase();
  let user = await db.user.findUnique({ where: { email } });

  if (user) {
    const already = await db.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
      select: { id: true },
    });
    if (already) {
      throw new AuthError("Este usuário já é membro da organização.", "ALREADY_MEMBER");
    }
    await db.organizationMember.create({
      data: { organizationId, userId: user.id, role: input.role },
    });
    return { user, temporaryPassword: null, organizationName };
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  user = await db.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, name: input.name ?? null, passwordHash },
    });
    await tx.organizationMember.create({
      data: { organizationId, userId: created.id, role: input.role },
    });
    return created;
  });
  return { user, temporaryPassword, organizationName };
}

/** Membros da organização, para UI de gestão de membros e select de responsável em Task. */
export function listOrganizationMembers(organizationId: string) {
  return db.organizationMember.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

async function getMemberInOrg(organizationId: string, memberId: string) {
  const member = await db.organizationMember.findFirst({
    where: { id: memberId, organizationId },
  });
  if (!member) notFound("Membro");
  return member;
}

/**
 * Troca de papel de um membro. A regra de QUEM pode alterar PARA
 * QUAL papel (canChangeRole) é checada no action, que tem acesso ao
 * papel de quem está agindo — este service só garante que o alvo
 * pertence à organização e impede rebaixar o último OWNER (a
 * organização sempre precisa de pelo menos um).
 */
export async function changeMemberRole(
  organizationId: string,
  memberId: string,
  newRole: Role,
) {
  const member = await getMemberInOrg(organizationId, memberId);
  if (member.role === "OWNER" && newRole !== "OWNER") {
    const ownerCount = await db.organizationMember.count({
      where: { organizationId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      throw new AuthError(
        "A organização precisa de pelo menos um OWNER.",
        "LAST_OWNER",
      );
    }
  }
  return db.organizationMember.update({
    where: { id: memberId },
    data: { role: newRole },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
}

/** Remove um membro da organização (não exclui o User, só o vínculo). */
export async function removeMember(organizationId: string, memberId: string) {
  const member = await getMemberInOrg(organizationId, memberId);
  if (member.role === "OWNER") {
    const ownerCount = await db.organizationMember.count({
      where: { organizationId, role: "OWNER" },
    });
    if (ownerCount <= 1) {
      throw new AuthError(
        "A organização precisa de pelo menos um OWNER — transfira a titularidade antes de remover.",
        "LAST_OWNER",
      );
    }
  }
  await db.organizationMember.delete({ where: { id: memberId } });
}
