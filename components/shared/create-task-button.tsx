"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { listListsForPickerAction } from "@/lib/modules/workspace/actions";
import { createTaskAction } from "@/lib/modules/task/actions";

type ListOption = { id: string; name: string; path: string };

/**
 * Botão "Gerar Task" reusado pelas ferramentas de Melhoria Contínua
 * (5 Porquês, Ishikawa, 5W2H — Fase 3): uma causa raiz ou ação
 * identificada vira uma Task de verdade, sem duplicar dado (a Task
 * criada é a mesma tabela usada pelo Kanban/Lista). Como a
 * ferramenta fica presa a uma Idea (não a uma List), o usuário
 * escolhe em qual List lançar no momento de gerar.
 */
export function CreateTaskButton({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<ListOption[] | null>(null);
  const [listId, setListId] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleOpen() {
    setOpen(true);
    setError(null);
    if (lists) return;
    setLoading(true);
    const result = await listListsForPickerAction();
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLists(result.data);
    if (result.data[0]) setListId(result.data[0].id);
  }

  async function handleCreate() {
    if (!listId || !title.trim()) return;
    setCreating(true);
    setError(null);
    const result = await createTaskAction({ listId, title: title.trim(), description });
    setCreating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDone(true);
    setOpen(false);
  }

  if (done) {
    return <span className="text-xs text-primary">Task criada ✓</span>;
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={handleOpen} disabled={!title.trim()}>
        Gerar Task
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
      {loading ? (
        <span className="text-xs text-muted-foreground">Carregando listas...</span>
      ) : (
        <>
          <Select
            value={listId}
            onChange={(e) => setListId(e.target.value)}
            className="h-8 w-auto text-xs"
          >
            {(lists ?? []).length === 0 && <option value="">Nenhuma lista disponível</option>}
            {(lists ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.path} / {l.name}
              </option>
            ))}
          </Select>
          <Button type="button" size="sm" disabled={creating || !listId} onClick={handleCreate}>
            {creating ? "..." : "Criar"}
          </Button>
        </>
      )}
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)}>
        Cancelar
      </Button>
    </div>
  );
}
