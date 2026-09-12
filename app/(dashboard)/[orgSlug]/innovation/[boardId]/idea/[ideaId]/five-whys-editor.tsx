"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreateTaskButton } from "@/components/shared/create-task-button";
import { MAX_FIVE_WHYS_LEVELS, type FiveWhysContent } from "@/lib/modules/tools";
import { createToolAction, deleteToolAction, updateToolAction } from "@/lib/modules/tools/actions";
import { ToolDialogShell } from "./tool-dialog-shell";

type Why = { question: string; answer: string };

export function FiveWhysEditor({
  ideaId,
  tool,
  canDelete,
  onClose,
  onSaved,
}: {
  ideaId: string;
  tool: { id: string; title: string; content: FiveWhysContent } | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tool;
  const [title, setTitle] = useState(tool?.title ?? "5 Porquês");
  const [problem, setProblem] = useState(tool?.content.problem ?? "");
  const [whys, setWhys] = useState<Why[]>(
    tool?.content.whys ?? [{ question: "Por que isso acontece?", answer: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateWhy(index: number, field: keyof Why, value: string) {
    setWhys((prev) => prev.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
  }

  function addWhy() {
    if (whys.length >= MAX_FIVE_WHYS_LEVELS) return;
    setWhys((prev) => [...prev, { question: "Por quê?", answer: "" }]);
  }

  function removeWhy(index: number) {
    setWhys((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const content: FiveWhysContent = { problem, whys };
    const result = isEdit
      ? await updateToolAction({ id: tool!.id, type: "FIVE_WHYS", title: title.trim(), content })
      : await createToolAction({
          analyzableType: "Idea",
          analyzableId: ideaId,
          type: "FIVE_WHYS",
          title: title.trim(),
          content,
        });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  async function handleDelete() {
    if (!tool) return;
    const result = await deleteToolAction(tool.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  const rootCause = whys[whys.length - 1]?.answer ?? "";

  return (
    <ToolDialogShell
      heading="5 Porquês"
      title={title}
      onTitleChange={setTitle}
      error={error}
      saving={saving}
      isEdit={isEdit}
      onSave={handleSave}
      onDelete={isEdit && canDelete ? handleDelete : undefined}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Problema</label>
          <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} />
        </div>

        <ol className="space-y-2">
          {whys.map((w, i) => (
            <li key={i} className="rounded-md border border-border p-2">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Por que {i + 1}?</span>
                {whys.length > 1 && (
                  <button type="button" className="text-destructive hover:underline" onClick={() => removeWhy(i)}>
                    Remover
                  </button>
                )}
              </div>
              <Input
                className="mt-1"
                placeholder="Pergunta"
                value={w.question}
                onChange={(e) => updateWhy(i, "question", e.target.value)}
              />
              <Textarea
                className="mt-1"
                placeholder="Resposta"
                value={w.answer}
                onChange={(e) => updateWhy(i, "answer", e.target.value)}
                rows={2}
              />
            </li>
          ))}
        </ol>

        {whys.length < MAX_FIVE_WHYS_LEVELS && (
          <Button type="button" variant="outline" size="sm" onClick={addWhy}>
            Adicionar "por quê"
          </Button>
        )}

        {rootCause.trim() && (
          <div className="flex items-center justify-between rounded-md bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950">
            <span>
              <strong>Causa raiz:</strong> {rootCause}
            </span>
            <CreateTaskButton title={rootCause} description={`Causa raiz identificada via 5 Porquês: ${problem}`} />
          </div>
        )}
      </div>
    </ToolDialogShell>
  );
}
