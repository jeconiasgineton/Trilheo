"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { canChangeRole, type Role } from "@/lib/modules/permissions";
import {
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
} from "@/lib/modules/auth/actions";

const INVITE_ROLES: Role[] = ["ADMIN", "GESTOR", "LIDER", "MEMBRO", "CONVIDADO"];
const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "GESTOR", "LIDER", "MEMBRO", "CONVIDADO"];

type MemberRow = {
  id: string;
  role: Role;
  user: { id: string; name: string | null; email: string };
};

export function MembersClient({
  members,
  currentUserRole,
  currentMemberId,
  canInvite,
  canChangeRole: canChangeRoleAtAll,
  canRemove,
}: {
  members: MemberRow[];
  currentUserRole: Role;
  currentMemberId: string | null;
  canInvite: boolean;
  canChangeRole: boolean;
  canRemove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      setNotice(null);
    } else {
      setError(null);
      router.refresh();
    }
  }

  async function handleInvite(email: string, name: string, role: Role) {
    const result = await inviteMemberAction({ email, name: name || undefined, role });
    if (result.ok) {
      setError(null);
      if (result.data.temporaryPassword) {
        setNotice(
          result.data.emailSent
            ? `Membro criado. Um e-mail com a senha temporária foi enviado para ${result.data.user.email}.`
            : `Membro criado. Senha temporária (repasse manualmente): ${result.data.temporaryPassword}`,
        );
      } else {
        setNotice("Usuário já existente adicionado à organização.");
      }
      router.refresh();
    } else {
      report(result);
    }
  }

  async function handleChangeRole(memberId: string, role: Role) {
    report(await changeRoleAction({ memberId, role }));
  }

  async function handleRemove(memberId: string) {
    report(await removeMemberAction(memberId));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-xl font-semibold">Membros da organização</h1>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{notice}</p>
      )}

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Membro</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.id === currentMemberId;
              const allowedTargetRoles = ALL_ROLES.filter((r) =>
                canChangeRole(currentUserRole, m.role, r),
              );
              return (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    {m.user.name ?? m.user.email}
                    {isSelf && <span className="ml-1 text-xs text-muted-foreground">(você)</span>}
                  </td>
                  <td className="px-3 py-2">
                    {canChangeRoleAtAll && allowedTargetRoles.length > 0 ? (
                      <Select
                        value={m.role}
                        onChange={(e) => handleChangeRole(m.id, e.target.value as Role)}
                        className="w-auto"
                      >
                        {!allowedTargetRoles.includes(m.role) && (
                          <option value={m.role}>{m.role}</option>
                        )}
                        {allowedTargetRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      m.role
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {canRemove && !isSelf && (
                      <button
                        type="button"
                        className="text-xs text-destructive hover:underline"
                        onClick={() => handleRemove(m.id)}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canInvite && <InviteForm onInvite={handleInvite} />}
    </div>
  );
}

function InviteForm({
  onInvite,
}: {
  onInvite: (email: string, name: string, role: Role) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("MEMBRO");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    await onInvite(email.trim(), name.trim(), role);
    setSaving(false);
    setEmail("");
    setName("");
  }

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <h2 className="font-semibold">Convidar membro</h2>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
        <div className="space-y-1">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-name">Nome (opcional)</Label>
          <Input id="invite-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="invite-role">Papel</Label>
          <Select id="invite-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={saving}>
          {saving ? "..." : "Convidar"}
        </Button>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Se o email não tiver conta, uma senha temporária é gerada e enviada por e-mail
        automaticamente; se o envio não estiver configurado ou falhar, ela aparece aqui uma
        única vez para repassar manualmente.
      </p>
    </section>
  );
}
