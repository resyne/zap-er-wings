import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { IVA_MODE_LABELS, formatPaymentMethod, formatEuro } from "@/lib/accounting-utils";
import type { PrimaNotaMovement } from "./LibroGiornaleTab";

interface Props {
  movement: PrimaNotaMovement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MovementDetailDialog({ movement, open, onOpenChange }: Props) {
  if (!movement) return null;

  const m = movement;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dettaglio Movimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Label className="text-xs text-muted-foreground">Data Competenza</Label>
              <p className="font-medium">{format(new Date(m.competence_date), "dd MMMM yyyy", { locale: it })}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Tipo</Label>
              <p className="font-medium capitalize">{m.movement_type}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Stato</Label>
              <div className="mt-1"><Badge variant={m.status === "registrato" ? "default" : "secondary"}>{m.status}</Badge></div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Pagamento</Label>
              <p className="font-medium">{formatPaymentMethod(m.payment_method)}</p>
            </div>
          </div>

          <Separator />

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <Label className="text-xs text-muted-foreground">Imponibile</Label>
                  <p className="text-lg font-bold">{formatEuro(m.imponibile || 0)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">IVA</Label>
                  <p className="text-lg font-bold">{formatEuro(m.iva_amount || 0)}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Totale</Label>
                  <p className={`text-xl font-bold ${m.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatEuro(Math.abs(m.totale || m.amount))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div>
            <Label className="text-xs text-muted-foreground">Regime IVA</Label>
            <div className="flex items-center gap-3 mt-1">
              <Badge variant="outline">{IVA_MODE_LABELS[m.iva_mode || ""] || "Non specificato"}</Badge>
              {m.iva_aliquota && <span className="text-sm">Aliquota: {m.iva_aliquota}%</span>}
            </div>
          </div>

          {m.chart_account && (
            <div>
              <Label className="text-xs text-muted-foreground">Piano dei Conti</Label>
              <p className="font-medium">{m.chart_account.code} - {m.chart_account.name}</p>
            </div>
          )}

          {m.description && (
            <div>
              <Label className="text-xs text-muted-foreground">Descrizione</Label>
              <p className="text-sm">{m.description}</p>
            </div>
          )}

          {m.is_rectification && (
            <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200">
              Questo movimento è una rettifica
            </div>
          )}

          {m.status === "rettificato" && m.rectification_reason && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-900/20 text-sm text-red-800 dark:text-red-200">
              <strong>Rettificato:</strong> {m.rectification_reason}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
