import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { PrimaNotaMovement } from "./LibroGiornaleTab";

interface Props {
  movement: PrimaNotaMovement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function RectifyDialog({ movement, open, onOpenChange, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const rectifyMutation = useMutation({
    mutationFn: async ({ movementId, reason }: { movementId: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: original, error: fetchError } = await supabase.from("prima_nota").select("*").eq("id", movementId).single();
      if (fetchError || !original) throw fetchError;

      const { data: rectification, error: insertError } = await supabase
        .from("prima_nota")
        .insert({
          accounting_entry_id: original.accounting_entry_id,
          movement_type: original.movement_type,
          competence_date: original.competence_date,
          amount: -original.amount,
          chart_account_id: original.chart_account_id,
          cost_center_id: original.cost_center_id,
          profit_center_id: original.profit_center_id,
          center_percentage: original.center_percentage,
          description: `RETTIFICA: ${reason}`,
          status: "generato",
          is_rectification: true,
          original_movement_id: movementId,
          iva_mode: original.iva_mode,
          iva_aliquota: original.iva_aliquota,
          imponibile: original.imponibile ? -original.imponibile : null,
          iva_amount: original.iva_amount ? -original.iva_amount : null,
          totale: original.totale ? -original.totale : null,
          payment_method: original.payment_method,
          created_by: userId,
        })
        .select().single();
      if (insertError) throw insertError;

      // Reverse lines
      const { data: originalLines } = await supabase.from("prima_nota_lines").select("*").eq("prima_nota_id", movementId);
      if (originalLines?.length) {
        await supabase.from("prima_nota_lines").insert(originalLines.map(l => ({
          prima_nota_id: rectification.id, line_order: l.line_order,
          chart_account_id: l.chart_account_id, structural_account_id: l.structural_account_id,
          account_type: l.account_type, dynamic_account_key: l.dynamic_account_key,
          dare: l.avere, avere: l.dare, description: `RETTIFICA: ${l.description}`,
        })));
      }

      await supabase.from("prima_nota").update({ status: "rettificato", rectified_by: rectification.id, rectification_reason: reason }).eq("id", movementId);

      // Update Registro Contabile
      const { data: linkedEvent } = await supabase.from("invoice_registry").select("id, periodo_chiuso, evento_lockato, scadenza_id").eq("prima_nota_id", movementId).maybeSingle();
      if (linkedEvent) {
        const isPeriodoClosed = linkedEvent.periodo_chiuso || linkedEvent.evento_lockato;
        await supabase.from("invoice_registry").update({
          status: isPeriodoClosed ? "rettificato" : "da_riclassificare",
          contabilizzazione_valida: false, stornato: true,
          data_storno: new Date().toISOString(), utente_storno: userId,
          motivo_storno: reason, scrittura_stornata_id: movementId, scrittura_storno_id: rectification.id,
        }).eq("id", linkedEvent.id);

        if (linkedEvent.scadenza_id) {
          await supabase.from("scadenze").update({
            stato: "stornata", importo_residuo: 0,
            note: `[STORNATA ${new Date().toLocaleDateString('it-IT')}] Motivo: ${reason}`,
          }).eq("id", linkedEvent.scadenza_id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-registry"] });
      toast.success("Movimento rettificato");
      onOpenChange(false);
      setReason("");
      onSuccess();
    },
    onError: () => toast.error("Errore nella rettifica"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rettifica Movimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            La rettifica creerà un movimento opposto con scritture contabili inverse.
          </p>
          <div className="space-y-2">
            <Label>Motivo della rettifica *</Label>
            <Textarea placeholder="Descrivi il motivo..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={() => {
            if (!reason.trim()) { toast.error("Inserisci un motivo"); return; }
            if (movement) rectifyMutation.mutate({ movementId: movement.id, reason });
          }} disabled={rectifyMutation.isPending}>
            Conferma Rettifica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
