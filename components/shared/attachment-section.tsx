"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAttachmentAction, deleteAttachmentAction } from "@/lib/modules/attachment/actions";

export type AttachmentItem = {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedBy: { id: string; name: string | null; email: string };
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Seção de anexos reusável (relação polimórfica — hoje usada em Task
 * e Idea, ver `attachableType`). Generalizada nesta sessão a partir
 * do componente que só existia para Task.
 */
export function AttachmentSection({
  attachableType,
  attachableId,
  attachments,
  currentUserId,
  canModerate,
}: {
  attachableType: string;
  attachableId: string;
  attachments: AttachmentItem[];
  currentUserId: string;
  canModerate: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Falha no upload.");
        return;
      }
      const result = await createAttachmentAction({
        attachableType,
        attachableId,
        url: uploadData.url,
        filename: uploadData.filename,
        mimeType: uploadData.mimeType,
        sizeBytes: uploadData.sizeBytes,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    const result = await deleteAttachmentAction(id);
    if (!result.ok) setError(result.error);
    else router.refresh();
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold">Anexos</h2>
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <ul className="space-y-2">
        {attachments.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <a href={a.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
              {a.filename}
            </a>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{formatSize(a.sizeBytes)}</span>
              {(a.uploadedById === currentUserId || canModerate) && (
                <button
                  type="button"
                  className="text-destructive hover:underline"
                  onClick={() => remove(a.id)}
                >
                  Excluir
                </button>
              )}
            </div>
          </li>
        ))}
        {attachments.length === 0 && (
          <li className="text-sm text-muted-foreground">Nenhum anexo ainda.</li>
        )}
      </ul>
      <div>
        <input ref={inputRef} type="file" className="hidden" onChange={handleFileChange} />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Enviando..." : "Anexar arquivo"}
        </Button>
      </div>
    </section>
  );
}
