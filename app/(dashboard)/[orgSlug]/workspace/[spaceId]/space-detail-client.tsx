"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createFolderAction,
  createListAction,
  reorderFoldersAction,
  reorderListsAction,
} from "@/lib/modules/workspace/actions";

type ListSummary = { id: string; name: string; order: number };
type FolderSummary = { id: string; name: string; order: number; lists: ListSummary[] };
type SpaceDetail = {
  id: string;
  name: string;
  workspace: { id: string; name: string };
  folders: FolderSummary[];
};

export function SpaceDetailClient({
  orgSlug,
  space,
  canCreateFolder,
  canCreateList,
}: {
  orgSlug: string;
  space: SpaceDetail;
  canCreateFolder: boolean;
  canCreateList: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  function moveFolder(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= space.folders.length) return;
    const ids = space.folders.map((f) => f.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderFoldersAction({ parentId: space.id, orderedIds: ids }).then(report);
  }

  function moveList(folder: FolderSummary, index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= folder.lists.length) return;
    const ids = folder.lists.map((l) => l.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    reorderListsAction({ parentId: folder.id, orderedIds: ids }).then(report);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/workspace`} className="hover:underline">
          Workspace
        </Link>
        {" / "}
        {space.workspace.name} {" / "}
        <span className="text-foreground">{space.name}</span>
      </div>

      <h1 className="text-xl font-semibold">{space.name}</h1>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {space.folders.map((folder, fIndex) => (
          <section key={folder.id} className="rounded-md border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <h2 className="flex-1 font-semibold">{folder.name}</h2>
              <button
                type="button"
                className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                onClick={() => moveFolder(fIndex, -1)}
                disabled={fIndex === 0}
                title="Mover pasta para cima"
              >
                ↑
              </button>
              <button
                type="button"
                className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                onClick={() => moveFolder(fIndex, 1)}
                disabled={fIndex === space.folders.length - 1}
                title="Mover pasta para baixo"
              >
                ↓
              </button>
            </div>

            <ul className="mt-2 space-y-1">
              {folder.lists.map((list, lIndex) => (
                <li
                  key={list.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <Link
                    href={`/${orgSlug}/workspace/${space.id}/list/${list.id}`}
                    className="flex-1 text-sm hover:underline"
                  >
                    {list.name}
                  </Link>
                  <button
                    type="button"
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => moveList(folder, lIndex, -1)}
                    disabled={lIndex === 0}
                    title="Mover lista para cima"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    onClick={() => moveList(folder, lIndex, 1)}
                    disabled={lIndex === folder.lists.length - 1}
                    title="Mover lista para baixo"
                  >
                    ↓
                  </button>
                </li>
              ))}
              {folder.lists.length === 0 && (
                <li className="px-2 py-1 text-sm text-muted-foreground">Sem listas.</li>
              )}
            </ul>

            {canCreateList && (
              <NewInline
                placeholder="Nome da lista"
                label="Adicionar lista"
                onCreate={async (name) =>
                  report(await createListAction({ folderId: folder.id, name }))
                }
              />
            )}
          </section>
        ))}
        {space.folders.length === 0 && (
          <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhuma pasta ainda.
          </p>
        )}
      </div>

      {canCreateFolder && (
        <NewInline
          placeholder="Nome da pasta"
          label="Nova pasta"
          onCreate={async (name) => report(await createFolderAction({ spaceId: space.id, name }))}
        />
      )}
    </div>
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
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-2">
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
