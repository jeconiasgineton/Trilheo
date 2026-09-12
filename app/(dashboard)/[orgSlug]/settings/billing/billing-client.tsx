"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PLANS, type PlanId } from "@/lib/modules/billing/constants";
import { createBillingPortalSessionAction, createCheckoutSessionAction } from "@/lib/modules/billing/actions";

type BillingStatus = {
  plan: PlanId;
  planLabel: string;
  memberLimit: number | null;
  memberCount: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  hasStripeCustomer: boolean;
};

function formatPrice(cents: number | null): string {
  if (cents === null) return "Sob consulta";
  if (cents === 0) return "Grátis";
  return `R$ ${(cents / 100).toFixed(2)}/mês`;
}

export function BillingClient({ status, configured }: { status: BillingStatus; configured: boolean }) {
  const [loading, setLoading] = useState<PlanId | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(planId: PlanId) {
    setLoading(planId);
    setError(null);
    const result = await createCheckoutSessionAction(planId);
    if (!result.ok) {
      setError(result.error);
      setLoading(null);
      return;
    }
    window.location.href = result.data;
  }

  async function handleManage() {
    setLoading("portal");
    setError(null);
    const result = await createBillingPortalSessionAction();
    if (!result.ok) {
      setError(result.error);
      setLoading(null);
      return;
    }
    window.location.href = result.data;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plano atual: <strong>{status.planLabel}</strong>
          {status.memberLimit != null && ` · ${status.memberCount}/${status.memberLimit} membros`}
        </p>
        {status.subscriptionStatus && (
          <p className="text-xs text-muted-foreground">
            Status da assinatura: {status.subscriptionStatus}
            {status.currentPeriodEnd &&
              ` · renova em ${new Date(status.currentPeriodEnd).toLocaleDateString("pt-BR")}`}
          </p>
        )}
      </div>

      {!configured && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Billing ainda não está configurado (falta a chave secreta do Stripe) — os botões abaixo vão
          mostrar um erro até isso ser configurado.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        {(Object.entries(PLANS) as [PlanId, (typeof PLANS)[PlanId]][]).map(([id, plan]) => (
          <div key={id} className="rounded-lg border border-border bg-background p-4">
            <h2 className="font-semibold">{plan.label}</h2>
            <p className="mt-1 text-xl font-bold">{formatPrice(plan.priceMonthlyCents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {plan.memberLimit == null ? "Membros ilimitados" : `Até ${plan.memberLimit} membros`}
            </p>

            {id === status.plan ? (
              <p className="mt-3 text-xs font-medium text-primary">Plano atual</p>
            ) : plan.stripePriceEnvVar ? (
              <Button
                className="mt-3 w-full"
                size="sm"
                disabled={loading === id}
                onClick={() => handleSubscribe(id)}
              >
                {loading === id ? "Redirecionando..." : "Assinar"}
              </Button>
            ) : plan.priceMonthlyCents === null ? (
              <p className="mt-3 text-xs text-muted-foreground">Fale com o comercial</p>
            ) : null}
          </div>
        ))}
      </div>

      {status.hasStripeCustomer && (
        <Button variant="outline" size="sm" disabled={loading === "portal"} onClick={handleManage}>
          {loading === "portal" ? "Abrindo..." : "Gerenciar assinatura"}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        O limite de membros por plano ainda não é aplicado automaticamente (não bloqueia convites acima
        do limite) — só informativo nesta rodada. Ver CONTEXTO.MD.
      </p>
    </div>
  );
}
