"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBenefitRecordsAction, recordBenefitAction } from "@/lib/modules/business-case/actions";

type BenefitRecordItem = {
  id: string;
  period: string | Date;
  plannedAmount: number;
  actualAmount: number | null;
  notes: string | null;
};

function money(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function currentMonthInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Gestão de benefícios (Fase 5): previsto (congelado do BC aprovado) x realizado, por mês. */
export function BenefitTracking({
  businessCaseId,
  plannedMonthly,
}: {
  businessCaseId: string;
  plannedMonthly: number;
}) {
  const [records, setRecords] = useState<BenefitRecordItem[] | null>(null);
  const [month, setMonth] = useState(currentMonthInputValue());
  const [actualAmount, setActualAmount] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const result = await listBenefitRecordsAction(businessCaseId);
    if (result.ok) setRecords(result.data);
    else setError(result.error);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessCaseId]);

  async function handleRecord() {
    setSaving(true);
    setError(null);
    const period = new Date(`${month}-01T00:00:00.000Z`).toISOString();
    const result = await recordBenefitAction({ businessCaseId, period, actualAmount, notes: notes.trim() || undefined });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNotes("");
    load();
  }

  const totalPlanned = (records ?? []).reduce((s, r) => s + r.plannedAmount, 0);
  const totalActual = (records ?? []).reduce((s, r) => s + (r.actualAmount ?? 0), 0);
  const realizationPercent = totalPlanned > 0 ? (totalActual / totalPlanned) * 100 : null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">Benefício realizado (previsto x realizado)</p>
      {error && <p className="text-xs text-destructive">{error}</p>}

      {records && records.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-left text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-2 py-1">Período</th>
                <th className="px-2 py-1">Previsto</th>
                <th className="px-2 py-1">Realizado</th>
                <th className="px-2 py-1">Notas</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-2 py-1">
                    {new Date(r.period).toLocaleDateString("pt-BR", {
                      month: "short",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="px-2 py-1">{money(r.plannedAmount)}</td>
                  <td className={`px-2 py-1 ${(r.actualAmount ?? 0) >= r.plannedAmount ? "text-emerald-600" : "text-amber-600"}`}>
                    {r.actualAmount == null ? "—" : money(r.actualAmount)}
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{r.notes ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {realizationPercent != null && (
            <p className="border-t border-border/60 px-2 py-1 text-[11px] text-muted-foreground">
              Realizado acumulado: {realizationPercent.toFixed(0)}% do previsto ({money(totalActual)} / {money(totalPlanned)})
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-[10px] text-muted-foreground">Mês</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          />
        </div>
        <div>
          <label className="block text-[10px] text-muted-foreground">Realizado (previsto: {money(plannedMonthly)})</label>
          <Input
            type="number"
            step="0.01"
            className="h-8 w-32 text-xs"
            value={actualAmount}
            onChange={(e) => setActualAmount(Number(e.target.value) || 0)}
          />
        </div>
        <Input
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-8 max-w-[160px] text-xs"
        />
        <Button type="button" size="sm" disabled={saving} onClick={handleRecord}>
          {saving ? "..." : "Registrar mês"}
        </Button>
      </div>
    </div>
  );
}
