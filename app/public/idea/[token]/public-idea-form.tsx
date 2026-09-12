"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPublicIdeaAction } from "@/lib/modules/innovation/actions";

export function PublicIdeaForm({ publicToken }: { publicToken: string }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitterName, setSubmitterName] = useState("");
  const [submitterEmail, setSubmitterEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);
    const result = await submitPublicIdeaAction({
      publicToken,
      title: title.trim(),
      description: description.trim() || undefined,
      submitterName: submitterName.trim() || undefined,
      submitterEmail: submitterEmail.trim() || undefined,
      source: "FORM",
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <p className="mt-6 rounded-md bg-primary/10 px-3 py-3 text-sm text-primary">
        Ideia enviada! Obrigado pela contribuição.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="space-y-1">
        <Label htmlFor="title">Sua ideia</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="name">Seu nome (opcional)</Label>
        <Input id="name" value={submitterName} onChange={(e) => setSubmitterName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Seu email (opcional)</Label>
        <Input
          id="email"
          type="email"
          value={submitterEmail}
          onChange={(e) => setSubmitterEmail(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={saving} className="w-full">
        {saving ? "Enviando..." : "Enviar ideia"}
      </Button>
    </form>
  );
}
