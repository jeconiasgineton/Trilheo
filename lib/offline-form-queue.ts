/**
 * Fila offline de coleta (Fase 7) — só client-side (localStorage).
 * Quando o app não consegue enviar uma submissão (sem rede, ou a
 * chamada falha), o payload inteiro fica aqui até uma tentativa de
 * sincronização dar certo. Deliberadamente simples (localStorage, não
 * IndexedDB/Service Worker Background Sync) — cobre o cenário real
 * mais comum (perder sinal em campo, several minutos/horas até
 * voltar), documentado como simplificação consciente no CONTEXTO.MD.
 */

const STORAGE_KEY = "trilheo:offline-form-queue";

export type QueuedSubmission = {
  queueId: string;
  templateId: string;
  templateTitle: string;
  answers: Record<string, unknown>;
  clientSubmittedAt: string;
};

function readQueue(): QueuedSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(items: QueuedSubmission[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage cheio ou indisponível (modo privado) — a
    // submissão atual se perde, mas não trava o app. Aceitável para
    // esta primeira versão; produção real trocaria por IndexedDB
    // (mais espaço) se isso virar problema recorrente.
  }
}

export function getQueue(): QueuedSubmission[] {
  return readQueue();
}

export function getQueueCount(): number {
  return readQueue().length;
}

export function enqueueSubmission(item: Omit<QueuedSubmission, "queueId">): void {
  const queue = readQueue();
  queue.push({ ...item, queueId: `${Date.now()}-${Math.random().toString(36).slice(2)}` });
  writeQueue(queue);
}

export function removeFromQueue(queueId: string): void {
  writeQueue(readQueue().filter((q) => q.queueId !== queueId));
}
