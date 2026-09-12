"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CreateTaskButton } from "@/components/shared/create-task-button";
import type { FiveWTwoHContent } from "@/lib/modules/tools";
import { createToolAction, deleteToolAction, updateToolAction } from "@/lib/modules/tools/actions";
import { ToolDialogShell } from "./tool-dialog-shell";

type Action = FiveWTwoHContent["actions"][number];

const EMPTY_ACTION: Action = { what: "", why: "", where: "", when: "", who: "", how: "", howMuch: "" };

const FIELDS: { key: keyof Action; label: string }[] = [
  { key: "what", label: "O quê" },
  { key: "why", label: "Por quê" },
  { key: "where", label: "Onde" },
  { key: "when", label: "Quando" },
  { key: "who", label: "Quem" },
  { key: "how", label: "Como" },
  { key: "howMuch", label: "Quanto custa" },
];

function actionDescription(a: Action) {
  return [
    a.why && `Por quê: ${a.why}`,
    a.where && `Onde: ${a.where}`,
    a.when && `Quando: ${a.when}`,
    a.who && `Quem: ${a.who}`,
    a.how && `Como: ${a.how}`,
    a.howMuch && `Quanto custa: ${a.howMuch}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function FiveWTwoHEditor({
  ideaId,
  tool,
  canDelete,
  onClose,
  onSaved,
}: {
  ideaId: string;
  tool: { id: string; title: string; content: FiveWTwoHContent } | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!tool;
  const [title, setTitle] = useState(tool?.title ?? "5W2H");
  const [actions, setActions] = useState<Action[]>(tool?.content.actions ?? [{ ...EMPTY_ACTION }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAction(index: number, field: keyof Action, value: string) {
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, [field]: value } : a)));
  }
  function addAction() {
    setActions((prev) => [...prev, { ...EMPTY_ACTION }]);
  }
  function removeAction(index: number) {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const content: FiveWTwoHContent = { actions };
    const result = isEdit
      ? await updateToolAction({ id: tool!.id, type: "FIVE_W_TWO_H", title: title.trim(), content })
      : await createToolAction({
          analyzableType: "Idea",
          analyzableId: ideaId,
          type: "FIVE_W_TWO_H",
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
      heading="5W2H (Plano de ação)"
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
        {actions.map((a, i) => (
          <div key={i} className="space-y-2 rounded-md border border-border p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Ação {i + 1}</span>
              {actions.length > 1 && (
                <button type="button" className="text-xs text-destructive hover:underline" onClick={() => removeAction(i)}>
                  Remover
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-0.5">
                  <label className="text-xs text-muted-foreground">{f.label}</label>
                  <Input
                    className="h-8 text-sm"
                    value={a[f.key] ?? ""}
                    onChange={(e) => updateAction(i, f.key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            {a.what.trim() && <CreateTaskButton title={a.what} description={actionDescription(a)} />}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addAction}>
          Nova ação
        </Button>
      </div>
    </ToolDialogShell>
  );
}
