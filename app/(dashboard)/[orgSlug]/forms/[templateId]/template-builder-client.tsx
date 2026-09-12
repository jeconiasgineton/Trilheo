"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreateTaskButton } from "@/components/shared/create-task-button";
import {
  CHOICE_FIELD_TYPES,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  type FieldType,
} from "@/lib/modules/forms/constants";
import {
  deleteTemplateAction,
  replaceFieldsAction,
  updateTemplateAction,
} from "@/lib/modules/forms/actions";

type FieldItem = {
  id: string;
  order: number;
  type: string;
  label: string;
  required: boolean;
  options: unknown;
};
type TemplateFull = {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  fields: FieldItem[];
};
type SubmissionItem = {
  id: string;
  createdAt: string | Date;
  submittedBy: { id: string; name: string | null; email: string } | null;
  answers: unknown;
};

type EditableField = {
  _key: string;
  id?: string;
  type: FieldType;
  label: string;
  required: boolean;
  optionsText: string; // uma opção por linha
};

function toEditable(f: FieldItem): EditableField {
  const options = Array.isArray(f.options) ? (f.options as string[]) : [];
  return {
    _key: f.id,
    id: f.id,
    type: f.type as FieldType,
    label: f.label,
    required: f.required,
    optionsText: options.join("\n"),
  };
}

function newField(): EditableField {
  return {
    _key: `new-${Math.random().toString(36).slice(2)}`,
    type: "TEXT",
    label: "",
    required: false,
    optionsText: "",
  };
}

function answerSummary(answers: unknown, fields: FieldItem[]): string {
  if (typeof answers !== "object" || answers === null) return "";
  const record = answers as Record<string, unknown>;
  const parts: string[] = [];
  for (const f of fields.slice(0, 3)) {
    const v = record[f.id];
    if (v == null || v === "") continue;
    if (typeof v === "string" && v.startsWith("data:")) {
      parts.push(`${f.label}: (imagem)`);
    } else {
      parts.push(`${f.label}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
  }
  return parts.join(" · ");
}

export function TemplateBuilderClient({
  orgSlug,
  template,
  submissions,
  canManage,
}: {
  orgSlug: string;
  template: TemplateFull;
  submissions: SubmissionItem[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(template.title);
  const [description, setDescription] = useState(template.description ?? "");
  const [fields, setFields] = useState<EditableField[]>(template.fields.map(toEditable));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function updateField(key: string, patch: Partial<EditableField>) {
    setFields((prev) => prev.map((f) => (f._key === key ? { ...f, ...patch } : f)));
    setDirty(true);
  }

  function removeField(key: string) {
    setFields((prev) => prev.filter((f) => f._key !== key));
    setDirty(true);
  }

  function addField() {
    setFields((prev) => [...prev, newField()]);
    setDirty(true);
  }

  function move(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setDirty(true);
  }

  async function handleSaveMeta() {
    setSaving(true);
    setError(null);
    const result = await updateTemplateAction({
      id: template.id,
      title: title.trim(),
      description: description.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleToggleActive() {
    setSaving(true);
    const result = await updateTemplateAction({ id: template.id, isActive: !template.isActive });
    setSaving(false);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  async function handleSaveFields() {
    setSaving(true);
    setError(null);
    const result = await replaceFieldsAction({
      templateId: template.id,
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        label: f.label.trim() || "(sem rótulo)",
        required: f.required,
        options: CHOICE_FIELD_TYPES.has(f.type)
          ? f.optionsText.split("\n").map((s) => s.trim()).filter(Boolean)
          : undefined,
      })),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDirty(false);
    router.refresh();
  }

  async function handleDelete() {
    const result = await deleteTemplateAction(template.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/${orgSlug}/forms`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-sm text-muted-foreground">
        <Link href={`/${orgSlug}/forms`} className="hover:underline">
          Formulários
        </Link>
        {" / "}
        <span className="text-foreground">{template.title}</span>
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{template.title}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/${orgSlug}/forms/${template.id}/fill`}>
            <Button type="button" variant="outline">
              Coletar
            </Button>
          </Link>
        </div>
      </div>

      {canManage && (
        <section className="space-y-3 rounded-md border border-border bg-background p-4">
          <div className="space-y-1">
            <Label htmlFor="tpl-title">Título</Label>
            <Input id="tpl-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tpl-desc">Descrição</Label>
            <Textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={saving} onClick={handleSaveMeta}>
                Salvar título/descrição
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={saving} onClick={handleToggleActive}>
                {template.isActive ? "Desativar" : "Ativar"}
              </Button>
            </div>
            <Button type="button" size="sm" variant="ghost" className="text-destructive" onClick={handleDelete}>
              Excluir formulário
            </Button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Campos</h2>
          {canManage && dirty && (
            <Button type="button" size="sm" disabled={saving} onClick={handleSaveFields}>
              {saving ? "Salvando..." : "Salvar campos"}
            </Button>
          )}
        </div>

        <ul className="space-y-2">
          {fields.map((f, index) => (
            <li key={f._key} className="rounded-md border border-border bg-background p-3">
              {canManage ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                      onClick={() => move(index, 1)}
                      disabled={index === fields.length - 1}
                    >
                      ↓
                    </button>
                    <Input
                      className="h-8 flex-1"
                      placeholder="Rótulo do campo"
                      value={f.label}
                      onChange={(e) => updateField(f._key, { label: e.target.value })}
                    />
                    <Select
                      className="h-8 w-auto"
                      value={f.type}
                      onChange={(e) => updateField(f._key, { type: e.target.value as FieldType })}
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {FIELD_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </Select>
                    <label className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={f.required}
                        onChange={(e) => updateField(f._key, { required: e.target.checked })}
                      />
                      Obrigatório
                    </label>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() => removeField(f._key)}
                    >
                      Remover
                    </button>
                  </div>
                  {CHOICE_FIELD_TYPES.has(f.type) && (
                    <Textarea
                      placeholder={"Opções, uma por linha"}
                      value={f.optionsText}
                      onChange={(e) => updateField(f._key, { optionsText: e.target.value })}
                      rows={3}
                    />
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span>{f.label}</span>
                  <span className="text-xs text-muted-foreground">{FIELD_TYPE_LABELS[f.type]}</span>
                </div>
              )}
            </li>
          ))}
          {fields.length === 0 && (
            <li className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum campo ainda.
            </li>
          )}
        </ul>

        {canManage && (
          <Button type="button" variant="outline" size="sm" onClick={addField}>
            Adicionar campo
          </Button>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Coletas recebidas ({submissions.length})</h2>
        <ul className="space-y-2">
          {submissions.map((s) => (
            <li key={s.id} className="rounded-md border border-border bg-background p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {s.submittedBy ? s.submittedBy.name ?? s.submittedBy.email : "Anônimo"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{answerSummary(s.answers, template.fields)}</p>
              <div className="mt-2">
                <CreateTaskButton
                  title={`Ação a partir da coleta: ${template.title}`}
                  description={answerSummary(s.answers, template.fields)}
                />
              </div>
            </li>
          ))}
          {submissions.length === 0 && (
            <li className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhuma coleta ainda.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
