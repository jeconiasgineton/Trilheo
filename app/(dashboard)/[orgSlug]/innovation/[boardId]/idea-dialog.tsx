"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  createIdeaAction,
  setIdeaGutAction,
  updateIdeaAction,
} from "@/lib/modules/innovation/actions";
import { GUT_MAX, GUT_MIN, GUT_SCALE_LABELS, computeGutScore } from "@/lib/modules/innovation";
import type { IdeaItem, StageColumn } from "./idea-kanban";

const GUT_OPTIONS = Array.from({ length: GUT_MAX - GUT_MIN + 1 }, (_, i) => GUT_MIN + i);

/**
 * Modal de criar/editar ideia. No criar, o estágio é opcional (default
 * = primeiro estágio do pipeline do board). Mover entre estágios é
 * feito pelo Kanban (drag & drop), não por este dialog.
 */
export function IdeaDialog({
  orgSlug,
  boardId,
  columns,
  idea,
  onClose,
  onSaved,
  showDetailLink,
}: {
  orgSlug?: string;
  boardId: string;
  columns: StageColumn[];
  idea: IdeaItem | null;
  showDetailLink?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!idea;
  const firstStageId = columns[0]?.stage.id ?? "";

  const [title, setTitle] = useState(idea?.title ?? "");
  const [description, setDescription] = useState(idea?.description ?? "");
  const [pipelineStageId, setPipelineStageId] = useState(firstStageId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [gravity, setGravity] = useState(idea?.gutGravity ?? 3);
  const [urgency, setUrgency] = useState(idea?.gutUrgency ?? 3);
  const [trend, setTrend] = useState(idea?.gutTrend ?? 3);
  const [savingGut, setSavingGut] = useState(false);
  const [gutSaved, setGutSaved] = useState(false);

  async function handleSaveGut() {
    if (!idea) return;
    setSavingGut(true);
    setGutSaved(false);
    const result = await setIdeaGutAction({ ideaId: idea.id, gravity, urgency, trend });
    setSavingGut(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGutSaved(true);
    onSaved();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    let result: { ok: true; data: unknown } | { ok: false; error: string };
    if (isEdit && idea) {
      result = await updateIdeaAction({
        id: idea.id,
        title: title.trim(),
        description: description.trim() || null,
      });
    } else {
      result = await createIdeaAction({
        boardId,
        title: title.trim(),
        description: description.trim() || undefined,
        pipelineStageId: pipelineStageId || undefined,
      });
    }

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{isEdit ? "Editar ideia" : "Nova ideia"}</h2>
          {isEdit && showDetailLink && orgSlug && (
            <Link
              href={`/${orgSlug}/innovation/${boardId}/idea/${idea!.id}`}
              className="text-xs text-primary hover:underline"
            >
              Ver detalhes, comentários & análise ↗
            </Link>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="idea-title">Título</Label>
            <Input
              id="idea-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="idea-desc">Descrição</Label>
            <Textarea
              id="idea-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <Label htmlFor="idea-stage">Estágio inicial</Label>
              <Select
                id="idea-stage"
                value={pipelineStageId}
                onChange={(e) => setPipelineStageId(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.stage.id} value={c.stage.id}>
                    {c.stage.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {isEdit && (
            <div className="space-y-2 rounded-md border border-border p-3">
              <Label>Matriz GUT (priorização)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="gut-gravity" className="text-xs font-normal text-muted-foreground">
                    Gravidade
                  </Label>
                  <Select
                    id="gut-gravity"
                    value={gravity}
                    onChange={(e) => setGravity(Number(e.target.value))}
                  >
                    {GUT_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v} — {GUT_SCALE_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gut-urgency" className="text-xs font-normal text-muted-foreground">
                    Urgência
                  </Label>
                  <Select
                    id="gut-urgency"
                    value={urgency}
                    onChange={(e) => setUrgency(Number(e.target.value))}
                  >
                    {GUT_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v} — {GUT_SCALE_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="gut-trend" className="text-xs font-normal text-muted-foreground">
                    Tendência
                  </Label>
                  <Select id="gut-trend" value={trend} onChange={(e) => setTrend(Number(e.target.value))}>
                    {GUT_OPTIONS.map((v) => (
                      <option key={v} value={v}>
                        {v} — {GUT_SCALE_LABELS[v]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm text-muted-foreground">
                  Score: <strong className="text-foreground">{computeGutScore(gravity, urgency, trend)}</strong>
                  {" "}/ 125
                </span>
                <Button type="button" size="sm" variant="outline" disabled={savingGut} onClick={handleSaveGut}>
                  {savingGut ? "..." : gutSaved ? "Salvo ✓" : "Salvar GUT"}
                </Button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}