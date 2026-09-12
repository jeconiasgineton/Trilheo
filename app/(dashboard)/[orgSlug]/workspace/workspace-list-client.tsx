"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, type Role } from "@/lib/modules/permissions";
import {
  createSpaceAction,
  createWorkspaceAction,
  reorderSpacesAction,
} from "@/lib/modules/workspace/actions";

type SpaceSummary = { id: string; name: string; order: number };
type WorkspaceSummary = {
  id: string;
  name: string;
  spaces: SpaceSummary[];
};

export function WorkspaceListClient({
  orgSlug,
  role,
  workspaces,
  canCreateWorkspace,
}: {
  orgSlug: string;
  role: Role;
  workspaces: WorkspaceSummary[];
  canCreateWorkspace: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const canCreateSpace = can(role, "space:create");

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Workspace</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${orgSlug}/workspace/workload`}>
            <Button variant="outline">Carga de trabalho</Button>
          </Link>
          {canCreateWorkspace && (
            <NewWorkspace onCreate={async (name) => report(await createWorkspaceAction({ name }))} />
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-6">
        {workspaces.map((w) => (
          <WorkspaceCard
            key={w.id}
            orgSlug={orgSlug}
            workspace={w}
            canCreateSpace={canCreateSpace}
            onCreateSpace={async (name) =>
              report(await createSpaceAction({ workspaceId: w.id, name }))
            }
            onReorder={async (orderedIds) =>
              report(await reorderSpacesAction({ parentId: w.id, orderedIds }))
            }
          />
        ))}
        {workspaces.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum workspace ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function NewWorkspace({ onCreate }: { onCreate: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim());
    setSaving(false);
    setName("");
    setOpen(false);
  }

  if (!open) return <Button onClick={() => setOpen(true)}>Novo workspace</Button>;
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        placeholder="Nome do workspace"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <Button type="submit" disabled={saving}>
        {saving ? "..." : "Criar"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}

function WorkspaceCard({
  orgSlug,
  workspace,
  canCreateSpace,
  onCreateSpace,
  onReorder,
}: {
  orgSlug: string;
  workspace: WorkspaceSummary;
  canCreateSpace: boolean;
  onCreateSpace: (name: string) => void;
  onReorder: (orderedIds: string[]) => void;
}) {
  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= workspace.spaces.length) return;
    const ids = workspace.spaces.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    onReorder(ids);
  }

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <h2 className="font-semibold">{workspace.name}</h2>
      <ul className="mt-3 space-y-1">
        {workspace.spaces.map((s, index) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <Link href={`/${orgSlug}/workspace/${s.id}`} className="flex-1 text-sm hover:underline">
              {s.name}
            </Link>
            <button
              type="button"
              className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={() => move(index, -1)}
              disabled={index === 0}
              title="Mover para cima"
            >
              ↑
            </button>
            <button
              type="button"
              className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
              onClick={() => move(index, 1)}
              disabled={index === workspace.spaces.length - 1}
              title="Mover para baixo"
            >
              ↓
            </button>
          </li>
        ))}
        {workspace.spaces.length === 0 && (
          <li className="px-2 py-1 text-sm text-muted-foreground">Sem spaces.</li>
        )}
      </ul>
      {canCreateSpace && (
        <NewInline placeholder="Nome do space" onCreate={onCreateSpace} label="Adicionar space" />
      )}
    </section>
  );
}

function NewInline({
  placeholder,
  label,
  onCreate,
}: {
  placeholder: string;
  label: string;
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim());
    setSaving(false);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="mt-3 flex items-center gap-2">
      <Input placeholder={placeholder} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      <Button type="submit" disabled={saving}>
        {saving ? "..." : "Criar"}
      </Button>
      <Button type="button" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </form>
  );
}
