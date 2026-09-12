"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/shared/signature-pad";
import { submitFormAction } from "@/lib/modules/forms/actions";
import { FIELD_TYPE_LABELS, type FieldType } from "@/lib/modules/forms/constants";
import {
  enqueueSubmission,
  getQueue,
  getQueueCount,
  removeFromQueue,
} from "@/lib/offline-form-queue";

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

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Coleta mobile (Fase 7) — pensada como a "porta de entrada" do
 * app: tela única, controles grandes, funciona com ou sem conexão.
 * Sem rede (ou se o envio falhar no meio), a submissão inteira vai
 * para a fila local (`lib/offline-form-queue.ts`) e sincroniza
 * sozinha quando a conexão voltar — sem o usuário perder o que
 * coletou.
 */
export function FillFormClient({ orgSlug, template }: { orgSlug: string; template: TemplateFull }) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [formVersion, setFormVersion] = useState(0);

  const flushQueue = useCallback(async () => {
    for (const item of getQueue()) {
      try {
        const result = await submitFormAction({
          templateId: item.templateId,
          answers: item.answers,
          clientSubmittedAt: item.clientSubmittedAt,
        });
        if (result.ok) {
          removeFromQueue(item.queueId);
        }
      } catch {
        break; // ainda sem rede — para e tenta de novo na próxima oportunidade
      }
    }
    setPendingCount(getQueueCount());
  }, []);

  useEffect(() => {
    setIsOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    setPendingCount(getQueueCount());
    flushQueue();
    function goOnline() {
      setIsOnline(true);
      flushQueue();
    }
    function goOffline() {
      setIsOnline(false);
    }
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, [flushQueue]);

  function setValue(fieldId: string, value: unknown) {
    setAnswers((prev) => ({ ...prev, [fieldId]: value }));
  }

  async function handlePhotoChange(fieldId: string, file: File | undefined) {
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setValue(fieldId, dataUrl);
  }

  function resetForm() {
    setAnswers({});
    // Muda a key dos campos abaixo para forçar remount — sem isso,
    // o SignaturePad mantém o desenho e o texto "Assinado" no canvas
    // internamente mesmo com `answers` zerado (ele só lê `value` no
    // mount), confundindo quem está coletando várias inspeções seguidas.
    setFormVersion((v) => v + 1);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    const missing = template.fields.find((f) => {
      const v = answers[f.id];
      return f.required && (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0));
    });
    if (missing) {
      setError(`Campo obrigatório não preenchido: "${missing.label}".`);
      setSubmitting(false);
      return;
    }

    const clientSubmittedAt = new Date().toISOString();

    if (!navigator.onLine) {
      enqueueSubmission({ templateId: template.id, templateTitle: template.title, answers, clientSubmittedAt });
      setSuccessMessage("Sem conexão — coleta salva no aparelho e será enviada automaticamente quando a rede voltar.");
      setPendingCount(getQueueCount());
      resetForm();
      setSubmitting(false);
      return;
    }

    try {
      const result = await submitFormAction({ templateId: template.id, answers, clientSubmittedAt });
      if (!result.ok) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
      setSuccessMessage("Coleta enviada com sucesso.");
      resetForm();
    } catch {
      enqueueSubmission({ templateId: template.id, templateTitle: template.title, answers, clientSubmittedAt });
      setSuccessMessage("Falha ao enviar agora — coleta salva no aparelho e será reenviada automaticamente.");
      setPendingCount(getQueueCount());
      resetForm();
    }
    setSubmitting(false);
  }

  if (!template.isActive) {
    return (
      <div className="mx-auto max-w-md space-y-3 p-4">
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Este formulário foi desativado e não aceita novas coletas.
        </p>
        <Link href={`/${orgSlug}/forms`} className="text-sm text-primary hover:underline">
          ← Voltar aos formulários
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4 pb-24">
      <div className="flex items-center justify-between">
        <Link href={`/${orgSlug}/forms/${template.id}`} className="text-sm text-muted-foreground hover:underline">
          ← {template.title}
        </Link>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            isOnline ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
          }`}
        >
          {isOnline ? "Online" : "Offline"}
        </span>
      </div>

      <h1 className="text-lg font-semibold">{template.title}</h1>
      {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}

      {pendingCount > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          {pendingCount} coleta(s) salva(s) no aparelho aguardando envio.
        </p>
      )}
      {successMessage && (
        <p className="rounded-md bg-primary/10 px-3 py-2 text-sm text-primary">{successMessage}</p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-5">
        {template.fields.map((field) => (
          <FieldInput key={`${field.id}-${formVersion}`} field={field} value={answers[field.id]} onChange={(v) => setValue(field.id, v)} onPhoto={(file) => handlePhotoChange(field.id, file)} />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background p-3">
        <Button type="button" className="w-full" size="lg" disabled={submitting} onClick={handleSubmit}>
          {submitting ? "Enviando..." : "Enviar coleta"}
        </Button>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  onPhoto,
}: {
  field: FieldItem;
  value: unknown;
  onChange: (v: unknown) => void;
  onPhoto: (file: File | undefined) => void;
}) {
  const type = field.type as FieldType;
  const options = Array.isArray(field.options) ? (field.options as string[]) : [];

  return (
    <div className="space-y-1.5">
      <Label>
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
        <span className="ml-2 text-[10px] font-normal text-muted-foreground">{FIELD_TYPE_LABELS[type]}</span>
      </Label>

      {type === "TEXT" && (
        <Textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} />
      )}

      {type === "NUMBER" && (
        <Input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      )}

      {type === "DATE" && (
        <Input type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      )}

      {type === "YES_NO" && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={value === true} onChange={() => onChange(true)} />
            Sim
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={value === false} onChange={() => onChange(false)} />
            Não
          </label>
        </div>
      )}

      {type === "SINGLE_CHOICE" && (
        <div className="space-y-1.5 text-sm">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
              <input type="radio" checked={value === opt} onChange={() => onChange(opt)} />
              {opt}
            </label>
          ))}
        </div>
      )}

      {type === "MULTI_CHOICE" && (
        <div className="space-y-1.5 text-sm">
          {options.map((opt) => {
            const arr = Array.isArray(value) ? (value as string[]) : [];
            const checked = arr.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked) onChange([...arr, opt]);
                    else onChange(arr.filter((o) => o !== opt));
                  }}
                />
                {opt}
              </label>
            );
          })}
        </div>
      )}

      {type === "PHOTO" && (
        <div className="space-y-2">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => onPhoto(e.target.files?.[0])}
          />
          {typeof value === "string" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Prévia" className="h-32 rounded-md border border-border object-cover" />
          )}
        </div>
      )}

      {type === "SIGNATURE" && (
        <SignaturePad value={(value as string) ?? null} onChange={(v) => onChange(v ?? undefined)} />
      )}
    </div>
  );
}
