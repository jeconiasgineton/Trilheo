"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Chrome comum dos editores de ferramenta (5 Porquês/Ishikawa/5W2H): modal, título, salvar/cancelar/excluir. */
export function ToolDialogShell({
  heading,
  title,
  onTitleChange,
  error,
  saving,
  isEdit,
  onSave,
  onDelete,
  onClose,
  children,
}: {
  heading: string;
  title: string;
  onTitleChange: (v: string) => void;
  error: string | null;
  saving: boolean;
  isEdit: boolean;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{heading}</h2>

        {error && (
          <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <Label htmlFor="tool-title">Título da análise</Label>
          <Input id="tool-title" value={title} onChange={(e) => onTitleChange(e.target.value)} autoFocus />
        </div>

        <div className="mt-4">{children}</div>

        <div className="mt-5 flex items-center justify-between">
          <div>
            {isEdit && onDelete && (
              <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={onDelete}>
                Excluir
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={saving || !title.trim()} onClick={onSave}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
