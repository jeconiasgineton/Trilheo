import { notFound } from "next/navigation";
import { getBoardByPublicToken, InnovationError } from "@/lib/modules/innovation";
import { PublicIdeaForm } from "./public-idea-form";

/**
 * Página pública de captura de ideias (QR Code / formulário, Fase
 * 2/Marco 2) — SEM sessão, de propósito (fora do middleware de auth,
 * ver middleware.ts). Qualquer pessoa com o link/QR pode enviar uma
 * ideia para este board, se `publicCaptureEnabled` estiver ligado.
 */
export default async function PublicIdeaPage({
  params,
}: {
  params: { token: string };
}) {
  let board;
  try {
    board = await getBoardByPublicToken(params.token);
  } catch (err) {
    if (err instanceof InnovationError && err.code === "NOT_FOUND") notFound();
    throw err;
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Enviar uma ideia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {board.name}
          {board.description ? ` — ${board.description}` : ""}
        </p>
        <PublicIdeaForm publicToken={params.token} />
      </div>
    </main>
  );
}
