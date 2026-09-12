"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  createCommentAction,
  deleteCommentAction,
} from "@/lib/modules/comment/actions";

export type CommentItem = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string | Date;
  author: { id: string; name: string | null; email: string };
};

/**
 * Seção de comentários reusável (relação polimórfica — hoje usada em
 * Task e Idea, ver `commentableType`). Generalizada nesta sessão a
 * partir do componente que só existia para Task.
 */
export function CommentSection({
  commentableType,
  commentableId,
  comments,
  currentUserId,
  canModerate,
}: {
  commentableType: string;
  commentableId: string;
  comments: CommentItem[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    const result = await createCommentAction({
      commentableType,
      commentableId,
      body: body.trim(),
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    setError(null);
    router.refresh();
  }

  async function remove(id: string) {
    const result = await deleteCommentAction(id);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Comentários</h2>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{c.author.name ?? c.author.email}</span>
              {(c.authorId === currentUserId || canModerate) && (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => remove(c.id)}
                >
                  Excluir
                </button>
              )}
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhum comentário ainda.</li>
        )}
      </ul>
      <form onSubmit={submit} className="space-y-2">
        <Textarea
          placeholder="Escreva um comentário..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "..." : "Comentar"}
        </Button>
      </form>
    </section>
  );
}
