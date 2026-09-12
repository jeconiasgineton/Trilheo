"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/modules/auth";
import {
  canChangeRole,
  requirePermission,
  type Role,
} from "@/lib/modules/permissions";
import * as service from "./service";
import { AuthError } from "./service";
import {
  changeRoleSchema,
  inviteMemberSchema,
  signupSchema,
} from "./schemas";
import { sendEmail, EmailError } from "@/lib/modules/email/service";
import { inviteEmailContent, inviteEmailSubject } from "@/lib/modules/email/templates";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

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
    if (err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    if (err instanceof Error && err.name === "PermissionError") {
      return { ok: false, error: "Você não tem permissão para esta ação." };
    }
    throw err;
  }
}

/** Signup não tem sessão prévia — cria Organization + User(OWNER) direto. */
export async function signupAction(formData: unknown): Promise<ActionResult<{ organizationSlug: string }>> {
  const parsed = signupSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  try {
    const { organization } = await service.createOrganizationWithOwner(parsed.data);
    return { ok: true, data: { organizationSlug: organization.slug } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}

/**
 * Se `RESEND_API_KEY` estiver configurada, tenta enviar a senha
 * temporária por e-mail em vez de só devolver na resposta da action.
 * Se o e-mail não estiver configurado ou o envio falhar, o convite
 * **não é desfeito** — a senha continua vindo na resposta (`
 * temporaryPassword`) para o admin repassar manualmente, exatamente
 * como funcionava antes do e-mail existir. `emailSent` diz para a UI
 * qual mensagem mostrar.
 */
export async function inviteMemberAction(formData: unknown) {
  const parsed = inviteMemberSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(async ({ organizationId, role }) => {
    requirePermission(role, "member:invite");
    const result = await service.inviteMember(organizationId, parsed.data);

    let emailSent = false;
    if (result.temporaryPassword) {
      try {
        const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
        const { html, text } = inviteEmailContent({
          organizationName: result.organizationName,
          recipientEmail: result.user.email,
          temporaryPassword: result.temporaryPassword,
          loginUrl,
        });
        await sendEmail({
          to: result.user.email,
          subject: inviteEmailSubject(result.organizationName),
          html,
          text,
        });
        emailSent = true;
      } catch (err) {
        if (!(err instanceof EmailError)) throw err;
        emailSent = false;
      }
    }
    return { ...result, emailSent };
  });
}

export async function changeRoleAction(formData: unknown) {
  const parsed = changeRoleSchema.safeParse(formData);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  return withSession(async ({ organizationId, role }) => {
    const members = await service.listOrganizationMembers(organizationId);
    const target = members.find((m) => m.id === parsed.data.memberId);
    if (!target) {
      throw new AuthError("Membro não encontrado.", "NOT_FOUND");
    }
    if (!canChangeRole(role, target.role, parsed.data.role)) {
      return null; // sinaliza erro de permissão abaixo
    }
    return service.changeMemberRole(organizationId, parsed.data.memberId, parsed.data.role);
  }).then((result) => {
    if (result.ok && result.data === null) {
      return { ok: false as const, error: "Você não tem permissão para essa alteração de papel." };
    }
    return result;
  });
}

export async function removeMemberAction(memberId: string) {
  return withSession(({ organizationId, role }) => {
    requirePermission(role, "member:remove");
    return service.removeMember(organizationId, memberId);
  });
}
