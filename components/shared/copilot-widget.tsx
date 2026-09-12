"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { askCopilotAction } from "@/lib/modules/copilot/actions";
import type { CopilotContextType } from "@/lib/modules/copilot/constants";

type Message = { role: "user" | "assistant"; text: string };

/**
 * Innovation Copilot (Fase 6) — widget flutuante, reusado em qualquer
 * página que tenha um objeto com contexto suficiente (hoje: Idea e
 * Task). O histórico da conversa vive só no state do client —
 * decisão de não persistir (mais simples; nada no roadmap pedia
 * histórico entre sessões). Cada pergunta reenvia o histórico atual
 * para o servidor, que remonta o contexto real do objeto a cada
 * chamada (nunca cacheia dados desatualizados).
 */
export function CopilotWidget({
  contextType,
  contextId,
  title,
}: {
  contextType: CopilotContextType;
  contextId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAsk() {
    const q = question.trim();
    if (!q || sending) return;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setQuestion("");
    setSending(true);
    setError(null);

    const result = await askCopilotAction({ contextType, contextId, question: q, history });
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessages((prev) => [...prev, { role: "assistant", text: result.data }]);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90"
      >
        ✨ Copilot
      </button>
    );
  }

  return (
    <div className="fixed bottom-5 right-5 z-40 flex h-[28rem] w-80 flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl sm:w-96">
      <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
        <div>
          <p className="text-sm font-semibold">✨ Innovation Copilot</p>
          <p className="truncate text-[11px] text-muted-foreground">Sobre: {title}</p>
        </div>
        <button type="button" className="text-muted-foreground hover:text-foreground" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Pergunte algo sobre {contextType === "Idea" ? "esta ideia" : "esta task"} — o Copilot responde com base
            nos dados reais (descrição, comentários, {contextType === "Idea" ? "GUT, ferramentas de análise, Business Case" : "subtarefas"}...).
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap ${
              m.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
            }`}
          >
            {m.text}
          </div>
        ))}
        {sending && <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Pensando...</div>}
        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="flex items-center gap-2 border-t border-border p-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Pergunte algo..."
          className="h-9 flex-1 rounded-md border border-input bg-transparent px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button type="submit" size="sm" disabled={sending || !question.trim()}>
          Enviar
        </Button>
      </form>
    </div>
  );
}
