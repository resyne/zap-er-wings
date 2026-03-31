import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, AlertTriangle } from "lucide-react";

interface AbbuonoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scadenza: {
    id: string;
    soggetto_nome: string | null;
    invoice_number?: string;
    importo_totale: number;
    importo_residuo: number;
    tipo: "credito" | "debito";
    fattura_id?: string | null;
  } | null;
}

const fmtEuro = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2 })}`;

export function AbbuonoDialog({ open, onOpenChange, scadenza }: AbbuonoDialogProps) {
  const queryClient = useQueryClient();
  const [importo, setImporto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && scadenza) {
      setImporto(scadenza.importo_residuo.toString());
      setMotivo("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!scadenza) return;
    const amount = parseFloat(importo);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (amount > Number(scadenza.importo_residuo)) {
      toast.error("L'importo dell'abbuono non può superare il residuo");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Insert abbuono record
      const { error: abbuonoError } = await supabase
        .from("abbuoni" as any)
        .insert({
          scadenza_id: scadenza.id,
          importo: amount,
          motivo: motivo || null,
          created_by: user?.id || null,
        } as any);
      if (abbuonoError) throw abbuonoError;

      // Register a movement for tracking
      const { error: movError } = await supabase
        .from("scadenza_movimenti")
        .insert({
          scadenza_id: scadenza.id,
          importo: amount,
          data_movimento: new Date().toISOString().split("T")[0],
          metodo_pagamento: "abbuono",
          note: `Abbuono: ${motivo || "Nessun motivo specificato"} — Necessita nota credito`,
        } as any);
      if (movError) throw movError;

      // Update scadenza residuo
      const nuovoResiduo = Number(scadenza.importo_residuo) - amount;
      const nuovoStato = nuovoResiduo <= 0 ? "stornata" : "parziale";

      const { error: updateError } = await supabase
        .from("scadenze")
        .update({ importo_residuo: Math.max(0, nuovoResiduo), stato: nuovoStato })
        .eq("id", scadenza.id);
      if (updateError) throw updateError;

      toast.success("Abbuono registrato — ricorda di emettere la nota credito");
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["scadenza-movimenti"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-stats"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating abbuono:", error);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!scadenza) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-600" />
            Abbuono Scadenza
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  L'abbuono riduce il residuo della scadenza e verrà tracciato per l'emissione della relativa <strong>nota credito</strong>.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/50">
            <CardContent className="py-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Soggetto</span>
                <span className="font-medium">{scadenza.soggetto_nome}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Fattura</span>
                <span className="font-medium">{scadenza.invoice_number || "N/D"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Totale</span>
                <span>{fmtEuro(Number(scadenza.importo_totale))}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Residuo</span>
                <span className="font-bold text-lg">{fmtEuro(Number(scadenza.importo_residuo))}</span>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <Label htmlFor="abbuono-importo">Importo da abbuonare</Label>
            <Input
              id="abbuono-importo"
              type="number"
              step="0.01"
              value={importo}
              onChange={(e) => setImporto(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="abbuono-motivo">Motivo dell'abbuono</Label>
            <Textarea
              id="abbuono-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="es. Sconto commerciale, arrotondamento, contestazione risolta..."
              rows={3}
            />
          </div>

          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
            ⚠️ Richiederà emissione nota credito
          </Badge>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="bg-purple-600 hover:bg-purple-700 text-white">
            {loading ? "Registrazione..." : "Conferma Abbuono"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
