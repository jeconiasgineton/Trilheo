"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeFinancials } from "@/lib/modules/business-case";
import { createBusinessCaseAction, updateBusinessCaseAction } from "@/lib/modules/business-case/actions";
import type { BusinessCaseItem } from "./business-case-section";

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function BusinessCaseDialog({
  ideaId,
  businessCase,
  onClose,
  onSaved,
}: {
  ideaId: string;
  businessCase: BusinessCaseItem | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!businessCase;
  const [title, setTitle] = useState(businessCase?.title ?? "");
  const [description, setDescription] = useState(businessCase?.description ?? "");
  const [capex, setCapex] = useState(businessCase?.capex ?? 0);
  const [opexMonthly, setOpexMonthly] = useState(businessCase?.opexMonthly ?? 0);
  const [benefitMonthly, setBenefitMonthly] = useState(businessCase?.benefitMonthly ?? 0);
  const [horizonMonths, setHorizonMonths] = useState(businessCase?.horizonMonths ?? 12);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const financials = useMemo(
    () => computeFinancials(capex, opexMonthly, benefitMonthly, horizonMonths),
    [capex, opexMonthly, benefitMonthly, horizonMonths],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError(null);

    const result = isEdit
      ? await updateBusinessCaseAction({
          id: businessCase!.id,
          title: title.trim(),
          description: description.trim() || null,
          capex,
          opexMonthly,
          benefitMonthly,
          horizonMonths,
        })
      : await createBusinessCaseAction({
          ideaId,
          title: title.trim(),
          description: description.trim() || undefined,
          capex,
          opexMonthly,
          benefitMonthly,
          horizonMonths,
        });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">{isEdit ? "Editar Business Case" : "Novo Business Case"}</h2>

        {error && (
          <p role="alert" className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="bc-title">Título</Label>
            <Input id="bc-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bc-desc">Descrição</Label>
            <Textarea id="bc-desc" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bc-capex">CAPEX (investimento inicial)</Label>
              <Input
                id="bc-capex"
                type="number"
                min={0}
                step="0.01"
                value={capex}
                onChange={(e) => setCapex(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bc-opex">OPEX mensal</Label>
              <Input
                id="bc-opex"
                type="number"
                min={0}
                step="0.01"
                value={opexMonthly}
                onChange={(e) => setOpexMonthly(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bc-benefit">Benefício mensal esperado</Label>
              <Input
                id="bc-benefit"
                type="number"
                min={0}
                step="0.01"
                value={benefitMonthly}
                onChange={(e) => setBenefitMonthly(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bc-horizon">Horizonte (meses)</Label>
              <Input
                id="bc-horizon"
                type="number"
                min={1}
                max={120}
                value={horizonMonths}
                onChange={(e) => setHorizonMonths(Number(e.target.value) || 1)}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/50 p-3 text-sm">
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

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
