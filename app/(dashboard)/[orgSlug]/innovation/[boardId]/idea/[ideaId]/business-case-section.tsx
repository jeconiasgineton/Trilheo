"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BUSINESS_CASE_STATUS_LABELS,
  computeFinancials,
  type BusinessCaseStatus,
} from "@/lib/modules/business-case";
import {
  deleteBusinessCaseAction,
  submitBusinessCaseAction,
} from "@/lib/modules/business-case/actions";
import { can, type Role } from "@/lib/modules/permissions";
import { BusinessCaseDialog } from "./business-case-dialog";
import { ApprovalPanel } from "./approval-panel";
import { BenefitTracking } from "./benefit-tracking";

export type BusinessCaseItem = {
  id: string;
  title: string;
  description: string | null;
  capex: number;
  opexMonthly: number;
  benefitMonthly: number;
  horizonMonths: number;
  status: string;
  createdById: string | null;
  createdBy: { id: string; name: string | null; email: string } | null;
  gestorApprovedById: string | null;
  gestorApprovedAt: string | Date | null;
  gestorComment: string | null;
  gestorApprovedBy: { id: string; name: string | null; email: string } | null;
  adminApprovedById: string | null;
  adminApprovedAt: string | Date | null;
  adminComment: string | null;
  adminApprovedBy: { id: string; name: string | null; email: string } | null;
  rejectedById: string | null;
  rejectedAt: string | Date | null;
  rejectionReason: string | null;
  rejectedBy: { id: string; name: string | null; email: string } | null;
  generatedListId: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_GESTOR: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  PENDING_ADMIN: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BusinessCaseSection({
  orgSlug,
  ideaId,
  businessCases,
  role,
  currentUserId,
}: {
  orgSlug: string;
  ideaId: string;
  businessCases: BusinessCaseItem[];
  role: Role;
  currentUserId: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<BusinessCaseItem | null>(null);

  const canCreate = can(role, "businesscase:create");
  // Só permite um novo Business Case se não houver nenhum "em andamento"
  // (DRAFT ou pendente) — pode criar outro se o único existente foi
  // reprovado, para tentar de novo com números revisados.
  const hasOpenCase = businessCases.some((b) => b.status !== "REJECTED");

  function refresh() {
    router.refresh();
    setCreating(false);
    setEditing(null);
  }

  function report(result: { ok: true; data: unknown } | { ok: false; error: string }) {
    if (!result.ok) setError(result.error);
    else {
      setError(null);
      router.refresh();
    }
  }

  async function handleSubmit(id: string) {
    report(await submitBusinessCaseAction(id));
  }

  async function handleDelete(id: string) {
    report(await deleteBusinessCaseAction(id));
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Business Case</h2>
        {canCreate && !hasOpenCase && (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            Novo Business Case
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="space-y-3">
        {businessCases.map((bc) => {
          const financials = computeFinancials(bc.capex, bc.opexMonthly, bc.benefitMonthly, bc.horizonMonths);
          const isOwner = bc.createdById === currentUserId;
          const canEditThis = bc.status === "DRAFT" && (isOwner || can(role, "businesscase:delete"));
          return (
            <li key={bc.id} className="rounded-md border border-border bg-background p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{bc.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_BADGE[bc.status] ?? ""}`}
                    >
                      {BUSINESS_CASE_STATUS_LABELS[bc.status as BusinessCaseStatus] ?? bc.status}
                    </span>
                  </div>
                  {bc.description && <p className="mt-1 text-sm text-muted-foreground">{bc.description}</p>}
                </div>
                {canEditThis && (
                  <div className="flex gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(bc)}>
                      Editar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => handleDelete(bc.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                )}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <span className="block text-xs text-muted-foreground">CAPEX</span>
                  {money(bc.capex)}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">OPEX/mês</span>
                  {money(bc.opexMonthly)}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Benefício/mês</span>
                  {money(bc.benefitMonthly)}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Horizonte</span>
                  {bc.horizonMonths} meses
                </div>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-border/60 pt-2 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs text-muted-foreground">Benefício líquido</span>
                  <span className={financials.netBenefit >= 0 ? "text-emerald-600" : "text-destructive"}>
                    {money(financials.netBenefit)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">ROI</span>
                  {financials.roiPercent == null ? "—" : `${financials.roiPercent.toFixed(1)}%`}
                </div>
                <div>
                  <span className="block text-xs text-muted-foreground">Payback</span>
                  {financials.paybackMonths == null ? "Não se paga" : `${financials.paybackMonths.toFixed(1)} meses`}
                </div>
              </div>

              {bc.status === "DRAFT" && isOwner && (
                <div className="mt-3">
                  <Button type="button" size="sm" onClick={() => handleSubmit(bc.id)}>
                    Enviar para aprovação
                  </Button>
                </div>
              )}

              {/* key=status força remount ao mudar de estágio, resetando o
                  painel local (ex.: some o seletor de pasta depois de aprovar). */}
              <ApprovalPanel key={bc.status} businessCase={bc} role={role} onDone={refresh} />

              {bc.status === "APPROVED" && (
                <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                  {bc.generatedListId && (
                    <Link
                      href={`/${orgSlug}/workspace`}
                      className="text-xs text-primary hover:underline"
                    >
                      Projeto gerado — ver em Workspace ↗
                    </Link>
                  )}
                  <BenefitTracking businessCaseId={bc.id} plannedMonthly={bc.benefitMonthly} />
                </div>
              )}
            </li>
          );
        })}
        {businessCases.length === 0 && (
          <li className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nenhum Business Case ainda.
          </li>
        )}
      </ul>

      {(creating || editing) && (
        <BusinessCaseDialog
          ideaId={ideaId}
          businessCase={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
