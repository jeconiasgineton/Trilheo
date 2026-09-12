import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/modules/auth";
import { db } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

/**
 * Serve o anexo autenticado e escopado por organização — resolve a
 * lacuna de segurança do upload em /public (ver auditoria Fase 1):
 * o arquivo só é devolvido se existir um Attachment com esse `url`
 * na organização do usuário da sessão. `path.basename` corta
 * qualquer tentativa de path traversal no parâmetro de rota.
 */
export async function GET(
  _request: Request,
  { params }: { params: { filename: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const filename = path.basename(params.filename);
  const url = `/api/attachments/file/${filename}`;

  const attachment = await db.attachment.findFirst({
    where: { url, organizationId: session.user.organizationId },
    select: { filename: true, mimeType: true },
  });
  if (!attachment) {
    return NextResponse.json({ error: "Anexo não encontrado." }, { status: 404 });
  }

  try {
    const bytes = await readFile(path.join(UPLOAD_DIR, filename));
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": attachment.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.filename)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Arquivo não encontrado no storage." }, { status: 404 });
  }
}
