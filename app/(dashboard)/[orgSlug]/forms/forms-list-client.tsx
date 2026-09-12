"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTemplateAction } from "@/lib/modules/forms/actions";

type TemplateSummary = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  createdBy: { id: string; name: string | null; email: string } | null;
  _count: { fields: number; submissions: number };
};

/**
 * Coleta mobile (Fase 7): lista de formulários da organização. Quem
 * tem `form:manage` (GESTOR+) monta/edita; qualquer MEMBRO+ pode
 * abrir "Coletar" para preencher no celular (a mesma página funciona
 * em desktop também, mas é pensada mobile-first).
 */
export function FormsListClient({
  orgSlug,
  templates,
  canManage,
}: {
  orgSlug: string;
  templates: TemplateSummary[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await createTemplateAction({ title: title.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setCreating(false);
    router.push(`/${orgSlug}/forms/${result.data.id}`);
  }

  const active = templates.filter((t) => t.isActive);
  const inactive = templates.filter((t) => !t.isActive);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Formulários (coleta mobile)</h1>
          <p className="text-sm text-muted-foreground">
            Monte formulários aqui; colete em campo pelo celular — funciona offline.
          </p>
        </div>
        {canManage && (
          <Button type="button" onClick={() => setCreating(true)}>
            Novo formulário
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {creating && (
        <form onSubmit={handleCreate} className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
          <Input
            placeholder="Título do formulário (ex.: Inspeção de segurança)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <Button type="submit" disabled={saving}>
            {saving ? "..." : "Criar"}
          </Button>
          <Button type="button" variant="outline" onClick={() => setCreating(false)}>
            Cancelar
          </Button>
        </form>
      )}

      <ul className="space-y-2">
        {active.map((t) => (
          <li key={t.id} className="flex items-center justify-between rounded-md border border-border bg-background p-4">
            <div>
              <Link href={`/${orgSlug}/forms/${t.id}`} className="font-medium hover:underline">
                {t.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                {t._count.fields} campo(s) · {t._count.submissions} coleta(s)
              </p>
            </div>
            <Link href={`/${orgSlug}/forms/${t.id}/fill`}>
              <Button type="button" size="sm">
                Coletar
              </Button>
            </Link>
          </li>
        ))}
        {active.length === 0 && (
          <li className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum formulário ativo ainda.
          </li>
        )}
      </ul>

      {canManage && inactive.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Desativados</p>
          <ul className="space-y-2">
            {inactive.map((t) => (
              <li key={t.id} className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-sm">
                <Link href={`/${orgSlug}/forms/${t.id}`} className="hover:underline">
                  {t.title}
                </Link>
                <span className="ml-2 text-xs text-muted-foreground">
                  {t._count.fields} campo(s) · {t._count.submissions} coleta(s)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
