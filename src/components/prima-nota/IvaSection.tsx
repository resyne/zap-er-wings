import { useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatEuro } from "@/lib/accounting-utils";
import { Receipt, Percent } from "lucide-react";

export type IvaRegime = 'ordinaria' | 'reverse_charge' | 'intra_ue' | 'extra_ue' | 'esente' | 'non_soggetta';

export const IVA_REGIMES: { value: IvaRegime; label: string; shortLabel: string; rate: number; color: string }[] = [
  { value: 'ordinaria', label: 'Ordinaria 22%', shortLabel: '22%', rate: 22, color: 'bg-primary/10 text-primary border-primary/20' },
  { value: 'reverse_charge', label: 'Reverse Charge', shortLabel: 'RC', rate: 0, color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400' },
  { value: 'intra_ue', label: 'Intracomunitaria', shortLabel: 'Intra', rate: 0, color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400' },
  { value: 'extra_ue', label: 'Extra UE', shortLabel: 'Extra', rate: 0, color: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400' },
  { value: 'esente', label: 'Esente IVA', shortLabel: 'Esente', rate: 0, color: 'bg-muted text-muted-foreground border-border' },
  { value: 'non_soggetta', label: 'Non soggetta', shortLabel: 'N/S', rate: 0, color: 'bg-muted text-muted-foreground border-border' },
];

export function getRegimeFromAliquota(aliquota: number | null | undefined, ivaMode: string | null | undefined): IvaRegime {
  if (ivaMode) {
    const found = IVA_REGIMES.find(r => r.value === ivaMode);
    if (found) return found.value;
  }
  if (aliquota === 22 || aliquota === null || aliquota === undefined) return 'ordinaria';
  return 'ordinaria';
}

interface IvaSectionProps {
  imponibile: number | string;
  ivaAliquota: number | string;
  ivaAmount: number | string;
  totale: number | string;
  ivaMode: string;
  editing: boolean;
  onUpdate: (updates: { imponibile?: string; iva_aliquota?: string; iva_amount?: string; totale?: string; iva_mode?: string }) => void;
  compact?: boolean;
}

export function IvaSection({ imponibile, ivaAliquota, ivaAmount, totale, ivaMode, editing, onUpdate, compact = false }: IvaSectionProps) {
  const currentRegime = IVA_REGIMES.find(r => r.value === ivaMode) || IVA_REGIMES[0];
  const isZeroRate = currentRegime.rate === 0 && currentRegime.value !== 'ordinaria';

  // Auto-calculate IVA and totale when imponibile or aliquota changes
  const recalculate = useCallback((newImponibile: string, newAliquota: string) => {
    const imp = parseFloat(newImponibile) || 0;
    const aliq = parseFloat(newAliquota) || 0;
    const iva = Math.round((imp * aliq / 100) * 100) / 100;
    const tot = Math.round((imp + iva) * 100) / 100;
    return { iva: iva.toString(), totale: tot.toString() };
  }, []);

  const handleRegimeChange = (regime: IvaRegime) => {
    const regimeData = IVA_REGIMES.find(r => r.value === regime)!;
    const newAliquota = regimeData.rate.toString();
    const result = recalculate(String(imponibile), newAliquota);
    onUpdate({
      iva_mode: regime,
      iva_aliquota: newAliquota,
      iva_amount: result.iva,
      totale: result.totale,
    });
  };

  const handleImponibileChange = (value: string) => {
    const result = recalculate(value, String(ivaAliquota));
    onUpdate({
      imponibile: value,
      iva_amount: result.iva,
      totale: result.totale,
    });
  };

  const handleAliquotaChange = (value: string) => {
    const result = recalculate(String(imponibile), value);
    onUpdate({
      iva_aliquota: value,
      iva_amount: result.iva,
      totale: result.totale,
    });
  };

  if (!editing) {
    // Read-only view
    const imp = Number(imponibile) || 0;
    const iva = Number(ivaAmount) || 0;
    const tot = Number(totale) || 0;
    const hasData = imp > 0 || iva > 0 || tot > 0;

    if (!hasData && !ivaMode) return null;

    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Regime badge header */}
        {ivaMode && (
          <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-2">
            <Percent className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Regime IVA:</span>
            <Badge variant="outline" className={cn("text-[10px]", currentRegime.color)}>
              {currentRegime.label}
            </Badge>
          </div>
        )}
        <div className="grid grid-cols-3 divide-x">
          <div className="p-4 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Imponibile</p>
            <p className="text-sm font-semibold">{imp ? formatEuro(imp) : "—"}</p>
          </div>
          <div className="p-4 text-center">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
              IVA {Number(ivaAliquota) > 0 ? `(${ivaAliquota}%)` : ''}
            </p>
            <p className="text-sm font-semibold">{iva ? formatEuro(iva) : "—"}</p>
          </div>
          <div className="p-4 text-center bg-muted/10">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Totale</p>
            <p className="text-base font-bold">{tot ? formatEuro(tot) : "—"}</p>
          </div>
        </div>
      </div>
    );
  }

  // Editing mode
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Regime selector */}
      <div className="px-4 py-3 border-b bg-muted/20">
        <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Regime IVA</Label>
        <div className="flex flex-wrap gap-1.5">
          {IVA_REGIMES.map(regime => (
            <button
              key={regime.value}
              type="button"
              onClick={() => handleRegimeChange(regime.value)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-lg font-medium border transition-all",
                ivaMode === regime.value
                  ? cn(regime.color, "ring-1 ring-offset-1 ring-current shadow-sm")
                  : "bg-background text-muted-foreground border-border/50 hover:bg-muted/50 hover:border-border"
              )}
            >
              {compact ? regime.shortLabel : regime.label}
            </button>
          ))}
        </div>
      </div>

      {/* Amount fields */}
      <div className="grid grid-cols-3 divide-x">
        <div className="p-3 space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Imponibile</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 font-medium">€</span>
            <Input
              type="number"
              step="0.01"
              value={imponibile}
              onChange={(e) => handleImponibileChange(e.target.value)}
              className="pl-7 h-9 font-semibold tabular-nums"
              placeholder="0,00"
            />
          </div>
        </div>
        <div className="p-3 space-y-1.5">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            IVA
            {isZeroRate && (
              <span className="ml-1 text-[9px] text-amber-600 font-normal">(0% - {currentRegime.shortLabel})</span>
            )}
          </Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 font-medium">€</span>
            <Input
              type="number"
              step="0.01"
              value={ivaAmount}
              className={cn("pl-7 h-9 font-semibold tabular-nums", isZeroRate && "bg-muted/30 text-muted-foreground")}
              readOnly={isZeroRate}
              onChange={(e) => {
                if (!isZeroRate) {
                  onUpdate({ iva_amount: e.target.value, totale: String((parseFloat(String(imponibile)) || 0) + (parseFloat(e.target.value) || 0)) });
                }
              }}
              placeholder="0,00"
            />
          </div>
          {!isZeroRate && (
            <div className="flex items-center gap-1">
              <Label className="text-[9px] text-muted-foreground">Aliquota</Label>
              <Input
                type="number"
                step="1"
                value={ivaAliquota}
                onChange={(e) => handleAliquotaChange(e.target.value)}
                className="h-6 w-14 text-[10px] px-1.5 tabular-nums"
                readOnly={isZeroRate}
              />
              <span className="text-[9px] text-muted-foreground">%</span>
            </div>
          )}
        </div>
        <div className="p-3 space-y-1.5 bg-muted/10">
          <Label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Totale</Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground/50 font-medium">€</span>
            <Input
              type="number"
              step="0.01"
              value={totale}
              className="pl-7 h-9 font-bold tabular-nums bg-transparent"
              readOnly
              placeholder="0,00"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
