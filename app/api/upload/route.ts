import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { authOptions } from "@/lib/modules/auth";
import { MAX_ATTACHMENT_SIZE_BYTES } from "@/lib/modules/attachment/schemas";

/**
 * Diretório FORA de /public — de propósito (ver auditoria Fase 1:
 * anexo em /public é servido estático pelo Next, sem checar
 * organização). O arquivo só é lido de volta pela rota autenticada
 * app/api/attachments/file/[filename], que confere organizationId
 * antes de devolver os bytes.
 *
 * Ainda uma solução de dev local (disco); produção deve trocar por
 * storage em nuvem com URL assinada (ver CONTEXTO.MD).
 */
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Sessão expirada." }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Arquivo ausente." }, { status: 400 });
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo excede o limite de 50MB." },
      { status: 413 },
    );
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name).slice(0, 20);
  const storedName = `${randomUUID()}${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);

  return NextResponse.json({
    url: `/api/attachments/file/${storedName}`,
    filename: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  });
}
