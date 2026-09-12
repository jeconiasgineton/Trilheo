"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { can, type Role } from "@/lib/modules/permissions";
import {
  deleteIdeaAction,
  moveIdeaAction,
} from "@/lib/modules/innovation/actions";
import { IdeaKanban, type IdeaItem, type StageColumn } from "./idea-kanban";
import { IdeaDialog } from "./idea-dialog";
import { PublicCapturePanel } from "./public-capture-panel";

type Board = {
  id: string;
  name: string;
  description: string | null;
  pipeline: { id: string; name: string };
  publicCaptureEnabled: boolean;
  publicUrl: string;
};

/**
 * Board de inovação: Kanban de ideias por estágio do pipeline. Criar/
 * editar ideia é `idea:create`/`idea:update` (MEMBRO+). Mover entre
 * estágios não-finais é `idea:move` (MEMBRO+); entrar/sair de estágio
 * final exige `idea:approve` (LIDER+) — o client envia `approve=true`
 * só para quem pode, e o service revalida a regra do estágio final.
 * Excluir ideia segue a moderação local: autor exclui a própria;
 * ideia de terceiro exige `idea:delete` (LIDER+).
 */
export function BoardClient({
  orgSlug,
  board,
  columns,
  role,
  currentUserId,
}: {
  orgSlug: string;
  board: Board;
  columns: StageColumn[];
  role: Role;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingIdea, setEditingIdea] = useState<IdeaItem | null>(null);

  const canCreate = can(role, "idea:create");
  const canEdit = can(role, "idea:update");
  const canDelete = can(role, "idea:delete");
  const canApprove = can(role, "idea:approve");
  const canManageBoard = can(role, "board:manage");

  function afterMutation<T>(result: { ok: true; data: T } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    router.refresh();
    return true;
  }

  function openCreate() {
    setEditingIdea(null);
    setDialogOpen(true);
  }
  function openEdit(idea: IdeaItem) {
    setEditingIdea(idea);
    setDialogOpen(true);
  }

  async function handleMove(ideaId: string, targetStageId: string) {
    // approve=true só para quem tem idea:approve; o service valida a
    // regra de estágio final e devolve erro se faltar aprovação.
    afterMutation(
      await moveIdeaAction({
        ideaId,
        targetStageId,
        approve: canApprove,
      }),
    );
  }

  async function handleDelete(idea: IdeaItem) {
    afterMutation(await deleteIdeaAction(idea.id));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/innovation`} className="hover:underline">
          Inovação
        </Link>
        {" / "}
        <span className="text-foreground">{board.name}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{board.name}</h1>
          <p className="text-sm text-muted-foreground">
            {board.pipeline.name}
            {board.description ? ` · ${board.description}` : ""}
          </p>
        </div>
        {canCreate && <Button onClick={openCreate}>Nova ideia</Button>}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {canManageBoard && (
        <PublicCapturePanel
          boardId={board.id}
          publicUrl={board.publicUrl}
          enabled={board.publicCaptureEnabled}
        />
      )}

      {columns.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          O pipeline deste board não tem estágios. Edite o pipeline em{" "}
          <Link
            href={`/${orgSlug}/innovation/pipelines`}
            className="text-primary hover:underline"
          >
            Gerenciar pipelines
          </Link>
          .
        </p>
      ) : (
        <IdeaKanban
          columns={columns}
          onMove={handleMove}
          onEdit={openEdit}
          onDelete={handleDelete}
          canEdit={canEdit}
          canDelete={canDelete}
          currentUserId={currentUserId}
        />
      )}

      {dialogOpen && (
        <IdeaDialog
          orgSlug={orgSlug}
          boardId={board.id}
          columns={columns}
          idea={editingIdea}
          showDetailLink
          onClose={() => setDialogOpen(false)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}