"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { can, type Role } from "@/lib/modules/permissions";
import {
  createIdeaBoardAction,
  deleteIdeaBoardAction,
} from "@/lib/modules/innovation/actions";

type BoardSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pipeline: { id: string; name: string };
  space: { id: string; name: string } | null;
  ideaCount: number;
};

type PipelineOption = { id: string; name: string };

/**
 * Lista de boards de inovação da organização. Criar/editar board é
 * `board:manage` (GESTOR+); a UI só mostra o botão para quem pode,
 * mas o action revalida a permissão no servidor (defesa em profundidade).
 */
export function InnovationListClient({
  orgSlug,
  boards,
  pipelines,
  role,
}: {
  orgSlug: string;
  boards: BoardSummary[];
  pipelines: PipelineOption[];
  role: Role;
}) {
  const router = useRouter();
  const canManage = can(role, "board:manage");

  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [pipelineId, setPipelineId] = useState(pipelines[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setName("");
    setDescription("");
    setPipelineId(pipelines[0]?.id ?? "");
    setError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !pipelineId) return;
    setSaving(true);
    setError(null);
    const result = await createIdeaBoardAction({
      name: name.trim(),
      description: description.trim() || undefined,
      pipelineId,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDialogOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    const result = await deleteIdeaBoardAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Inovação</h1>
          <p className="text-sm text-muted-foreground">
            Boards de ideias e pipelines configuráveis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${orgSlug}/innovation/pipelines`}
            className="text-sm text-primary hover:underline"
          >
            Gerenciar pipelines
          </Link>
          {canManage && (
            <Button onClick={openCreate} disabled={pipelines.length === 0}>
              Novo board
            </Button>
          )}
        </div>
      </div>

      {pipelines.length === 0 && (
        <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          Crie um pipeline antes de criar um board.{" "}
          <Link
            href={`/${orgSlug}/innovation/pipelines`}
            className="text-primary hover:underline"
          >
            Ir para pipelines
          </Link>
          .
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {boards.map((b) => (
          <li
            key={b.id}
            className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-3"
          >
            <Link
              href={`/${orgSlug}/innovation/${b.id}`}
              className="min-w-0 flex-1"
            >
              <p className="font-medium">{b.name}</p>
              <p className="truncate text-sm text-muted-foreground">
                {b.pipeline.name} · {b.ideaCount} ideia(s)
                {b.space ? ` · ${b.space.name}` : ""}
              </p>
            </Link>
            {canManage && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => handleDelete(b.id)}
              >
                Excluir
              </Button>
            )}
          </li>
        ))}
        {boards.length === 0 && (
          <li className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum board ainda.
          </li>
        )}
      </ul>

      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-background p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold">Novo board</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="board-name">Nome</Label>
                <Input
                  id="board-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="board-desc">Descrição</Label>
                <Textarea
                  id="board-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="board-pipeline">Pipeline</Label>
                <Select
                  id="board-pipeline"
                  value={pipelineId}
                  onChange={(e) => setPipelineId(e.target.value)}
                  required
                >
                  {pipelines.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}