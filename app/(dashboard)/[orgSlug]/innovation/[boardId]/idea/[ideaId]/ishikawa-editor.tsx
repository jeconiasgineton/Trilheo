"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CreateTaskButton } from "@/components/shared/create-task-button";
import { DEFAULT_ISHIKAWA_CATEGORIES, type IshikawaContent } from "@/lib/modules/tools";
import { createToolAction, deleteToolAction, updateToolAction } from "@/lib/modules/tools/actions";
import { ToolDialogShell } from "./tool-dialog-shell";

type Category = { name: string; causes: string[] };

export function IshikawaEditor({
  ideaId,
  tool,
  canDelete,
  onClose,
  onSaved,
}: {
  ideaId: string;
  tool: { id: string; title: string; content: IshikawaContent } | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tool;
  const [title, setTitle] = useState(tool?.title ?? "Ishikawa");
  const [problem, setProblem] = useState(tool?.content.problem ?? "");
  const [categories, setCategories] = useState<Category[]>(
    tool?.content.categories ?? DEFAULT_ISHIKAWA_CATEGORIES.map((name) => ({ name, causes: [] })),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addCause(catIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) => (i === catIndex ? { ...c, causes: [...c.causes, ""] } : c)),
    );
  }
  function updateCause(catIndex: number, causeIndex: number, value: string) {
    setCategories((prev) =>
      prev.map((c, i) =>
        i === catIndex ? { ...c, causes: c.causes.map((cs, j) => (j === causeIndex ? value : cs)) } : c,
      ),
    );
  }
  function removeCause(catIndex: number, causeIndex: number) {
    setCategories((prev) =>
      prev.map((c, i) => (i === catIndex ? { ...c, causes: c.causes.filter((_, j) => j !== causeIndex) } : c)),
    );
  }
  function addCategory() {
    setCategories((prev) => [...prev, { name: "Nova categoria", causes: [] }]);
  }
  function renameCategory(catIndex: number, name: string) {
    setCategories((prev) => prev.map((c, i) => (i === catIndex ? { ...c, name } : c)));
  }
  function removeCategory(catIndex: number) {
    setCategories((prev) => prev.filter((_, i) => i !== catIndex));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const content: IshikawaContent = { problem, categories };
    const result = isEdit
      ? await updateToolAction({ id: tool!.id, type: "ISHIKAWA", title: title.trim(), content })
      : await createToolAction({
          analyzableType: "Idea",
          analyzableId: ideaId,
          type: "ISHIKAWA",
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

  return (
    <ToolDialogShell
      heading="Ishikawa (Espinha de peixe)"
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
          <label className="text-sm font-medium">Problema (efeito)</label>
          <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {categories.map((cat, ci) => (
            <div key={ci} className="rounded-md border border-border p-2">
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 flex-1 text-sm font-medium"
                  value={cat.name}
                  onChange={(e) => renameCategory(ci, e.target.value)}
                />
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeCategory(ci)}
                >
                  Remover
                </button>
              </div>
              <ul className="mt-2 space-y-1.5">
                {cat.causes.map((cause, cj) => (
                  <li key={cj} className="space-y-1">
                    <div className="flex items-center gap-1">
                      <Input
                        className="h-8 flex-1 text-sm"
                        placeholder="Causa possível"
                        value={cause}
                        onChange={(e) => updateCause(ci, cj, e.target.value)}
                      />
                      <button
                        type="button"
                        className="px-1 text-xs text-destructive hover:underline"
                        onClick={() => removeCause(ci, cj)}
                      >
                        ✕
                      </button>
                    </div>
                    {cause.trim() && (
                      <CreateTaskButton
                        title={cause}
                        description={`Causa (${cat.name}) identificada via Ishikawa: ${problem}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
              <Button type="button" variant="ghost" size="sm" className="mt-1" onClick={() => addCause(ci)}>
                + causa
              </Button>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" size="sm" onClick={addCategory}>
          Nova categoria
        </Button>
      </div>
    </ToolDialogShell>
  );
}
