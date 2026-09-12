"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { can, type Role } from "@/lib/modules/permissions";
import {
  approveAsAdminAction,
  approveAsGestorAction,
  rejectBusinessCaseAction,
} from "@/lib/modules/business-case/actions";
import { listFoldersForPickerAction } from "@/lib/modules/workspace/actions";
import type { BusinessCaseItem } from "./business-case-section";

type FolderOption = { id: string; name: string; path: string };

/**
 * Aprovação em dois níveis fixos: GESTOR (PENDING_GESTOR ->
 * PENDING_ADMIN) e ADMIN (PENDING_ADMIN -> APPROVED, gerando o
 * "Projeto"/List). Reprovar exige o mesmo papel mínimo do estágio
 * pendente — o action já valida isso de novo no servidor.
 */
export function ApprovalPanel({
  businessCase: bc,
  role,
  onDone,
}: {
  businessCase: BusinessCaseItem;
  role: Role;
  onDone: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [approvingAdmin, setApprovingAdmin] = useState(false);
  const [folders, setFolders] = useState<FolderOption[] | null>(null);
  const [targetFolderId, setTargetFolderId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (approvingAdmin && !folders) {
      listFoldersForPickerAction().then((result) => {
        if (result.ok) {
          setFolders(result.data);
          if (result.data[0]) setTargetFolderId(result.data[0].id);
        } else {
          setError(result.error);
        }
      });
    }
  }, [approvingAdmin, folders]);

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onDone();
  }

  async function handleApproveGestor() {
    setBusy(true);
    report(await approveAsGestorAction({ id: bc.id, comment: comment.trim() || undefined }));
    setBusy(false);
  }

  async function handleApproveAdmin() {
    if (!targetFolderId) return;
    setBusy(true);
    report(
      await approveAsAdminAction({
        id: bc.id,
        targetFolderId,
        projectListName: projectName.trim() || undefined,
        comment: comment.trim() || undefined,
      }),
    );
    setBusy(false);
  }

  async function handleReject() {
    if (!reason.trim()) return;
    setBusy(true);
    report(await rejectBusinessCaseAction({ id: bc.id, reason: reason.trim() }));
    setBusy(false);
  }

  const canApproveGestor = bc.status === "PENDING_GESTOR" && can(role, "businesscase:approve_gestor");
  const canApproveAdmin = bc.status === "PENDING_ADMIN" && can(role, "businesscase:approve_admin");
  const canReject =
    (bc.status === "PENDING_GESTOR" && can(role, "businesscase:approve_gestor")) ||
    (bc.status === "PENDING_ADMIN" && can(role, "businesscase:approve_admin"));

  return (
    <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {bc.gestorApprovedBy && (
        <p className="text-xs text-muted-foreground">
          Aprovado pelo Gestor ({bc.gestorApprovedBy.name ?? bc.gestorApprovedBy.email})
          {bc.gestorComment && ` — "${bc.gestorComment}"`}
        </p>
      )}
      {bc.adminApprovedBy && (
        <p className="text-xs text-muted-foreground">
          Aprovado pelo Admin ({bc.adminApprovedBy.name ?? bc.adminApprovedBy.email})
          {bc.adminComment && ` — "${bc.adminComment}"`}
        </p>
      )}
      {bc.rejectedBy && (
        <p className="text-xs text-destructive">
          Reprovado por {bc.rejectedBy.name ?? bc.rejectedBy.email}: {bc.rejectionReason}
        </p>
      )}

      {(canApproveGestor || canApproveAdmin) && !rejecting && !approvingAdmin && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Comentário (opcional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="h-8 max-w-xs text-xs"
          />
          {canApproveGestor && (
            <Button type="button" size="sm" disabled={busy} onClick={handleApproveGestor}>
              Aprovar (Gestor)
            </Button>
          )}
          {canApproveAdmin && (
            <Button type="button" size="sm" disabled={busy} onClick={() => setApprovingAdmin(true)}>
              Aprovar e gerar Projeto
            </Button>
          )}
          {canReject && (
            <Button type="button" size="sm" variant="outline" className="text-destructive" onClick={() => setRejecting(true)}>
              Reprovar
            </Button>
          )}
        </div>
      )}

      {approvingAdmin && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <p className="text-xs font-medium">Onde criar o Projeto (List)?</p>
          {!folders ? (
            <p className="text-xs text-muted-foreground">Carregando pastas...</p>
          ) : (
            <Select value={targetFolderId} onChange={(e) => setTargetFolderId(e.target.value)} className="text-xs">
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.path} / {f.name}
                </option>
              ))}
            </Select>
          )}
          <Input
            placeholder={`Nome do projeto (padrão: "Projeto: ${bc.title}")`}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy || !targetFolderId} onClick={handleApproveAdmin}>
              {busy ? "..." : "Confirmar e gerar Projeto"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setApprovingAdmin(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {rejecting && (
        <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
          <Textarea
            placeholder="Motivo da reprovação"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="text-destructive" disabled={busy || !reason.trim()} onClick={handleReject}>
              {busy ? "..." : "Confirmar reprovação"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
