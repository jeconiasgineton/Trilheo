"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  regenerateBoardPublicTokenAction,
  toggleBoardPublicCaptureAction,
} from "@/lib/modules/innovation/actions";

/**
 * Painel de captura pública (QR Code / formulário, Fase 2/Marco 2) —
 * só GESTOR+ (board:manage) vê. O QR é gerado no client (biblioteca
 * `qrcode`) a partir da própria URL pública, sem chamada de rede
 * extra. Regenerar o token invalida a URL/QR anteriores (recuperação
 * de vazamento) — o board-client já força um refresh para trazer a
 * nova URL do server.
 */
export function PublicCapturePanel({
  boardId,
  publicUrl,
  enabled,
}: {
  boardId: string;
  publicUrl: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(publicUrl, { margin: 1, width: 160 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [enabled, publicUrl]);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    const result = await toggleBoardPublicCaptureAction({ boardId, enabled: !enabled });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleRegenerate() {
    setBusy(true);
    setError(null);
    const result = await regenerateBoardPublicTokenAction(boardId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <section className="rounded-md border border-border bg-background p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Captura pública (QR Code / formulário)</h2>
          <p className="text-xs text-muted-foreground">
            Qualquer pessoa com o link ou QR envia uma ideia direto para este board, sem conta.
          </p>
        </div>
        <Button variant={enabled ? "outline" : "default"} size="sm" disabled={busy} onClick={handleToggle}>
          {busy ? "..." : enabled ? "Desativar" : "Ativar"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {enabled && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="QR Code para envio de ideias" className="h-32 w-32 rounded border border-border" />
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={publicUrl}
                onFocus={(e) => e.target.select()}
                className="flex-1 rounded-md border border-input bg-transparent px-2 py-1 text-xs"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => navigator.clipboard?.writeText(publicUrl)}
              >
                Copiar
              </Button>
            </div>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={handleRegenerate}>
              Gerar novo link (invalida o atual)
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
