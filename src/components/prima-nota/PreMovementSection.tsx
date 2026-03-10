import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, ArrowDown, Link2, AlertTriangle, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

export function PreMovementSection() {
  const queryClient = useQueryClient();
  const [consolidateOpen, setConsolidateOpen] = useState(false);
  const [selectedPreMovements, setSelectedPreMovements] = useState<string[]>([]);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");

  // Fetch pre-movements (in_attesa_fattura)
  const { data: preMovements = [] } = useQuery({
    queryKey: ["pre-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("*")
        .eq("pre_movement_status", "in_attesa_fattura")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const consolidateMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const totalPreMovements = preMovements
        .filter((pm: any) => selectedPreMovements.includes(pm.id))
        .reduce((sum: number, pm: any) => sum + (pm.totale || pm.amount || 0), 0);

      const invoiceTotal = parseFloat(invoiceAmount);
      
      // Create the invoice entry
      const { data: invoiceEntry, error: invoiceError } = await supabase
        .from("accounting_entries")
        .insert({
          direction: "uscita",
          document_type: "fattura",
          amount: invoiceTotal,
          totale: invoiceTotal,
          document_date: new Date().toISOString().split("T")[0],
          attachment_url: "",
          status: "da_classificare",
          note: invoiceNote || `Fattura riepilogativa per ${selectedPreMovements.length} pre-movimenti`,
          user_id: userData.user?.id,
        } as any)
        .select()
        .single();
      if (invoiceError) throw invoiceError;

      // Link pre-movements to the invoice
      for (const pmId of selectedPreMovements) {
        await supabase.from("pre_movement_links").insert({
          pre_movement_id: pmId,
          invoice_entry_id: invoiceEntry.id,
          linked_by: userData.user?.id,
          notes: Math.abs(totalPreMovements - invoiceTotal) > 0.01
            ? `Scostamento: €${(invoiceTotal - totalPreMovements).toFixed(2)}`
            : null,
        } as any);

        // Update pre-movement status
        await supabase
          .from("accounting_entries")
          .update({ pre_movement_status: "consolidato" } as any)
          .eq("id", pmId);
      }

      return { invoiceEntry, totalPreMovements, invoiceTotal };
    },
    onSuccess: ({ totalPreMovements, invoiceTotal }) => {
      queryClient.invalidateQueries({ queryKey: ["pre-movements"] });
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      const diff = Math.abs(totalPreMovements - invoiceTotal);
      if (diff > 0.01) {
        toast.warning(`Fattura consolidata con scostamento di €${diff.toFixed(2)}`);
      } else {
        toast.success("Fattura riepilogativa creata e pre-movimenti consolidati!");
      }
      setConsolidateOpen(false);
      setSelectedPreMovements([]);
      setInvoiceAmount("");
      setInvoiceNote("");
    },
    onError: (err: any) => {
      toast.error("Errore: " + (err.message || "Errore sconosciuto"));
    },
  });

  const selectedTotal = preMovements
    .filter((pm: any) => selectedPreMovements.includes(pm.id))
    .reduce((sum: number, pm: any) => sum + (pm.totale || pm.amount || 0), 0);

  if (preMovements.length === 0) return null;

  // Group by subject
  const grouped = preMovements.reduce((acc: Record<string, any[]>, pm: any) => {
    const subject = pm.note?.replace("Soggetto: ", "").split(" - ")[0] || "Altro";
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(pm);
    return acc;
  }, {});

  return (
    <>
      <Card className="border-blue-300/50 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-700/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Clock className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base">In attesa fattura</CardTitle>
                <CardDescription className="text-xs">
                  {preMovements.length} scontrin{preMovements.length === 1 ? "o" : "i"} in attesa di fattura riepilogativa
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="px-2 py-1 text-sm">
                {preMovements.length}
              </Badge>
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => setConsolidateOpen(true)}
              >
                <Link2 className="h-3 w-3" />
                Consolida
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-2 space-y-2">
          {Object.entries(grouped).map(([subject, items]) => (
            <div key={subject} className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{subject}</p>
              {(items as any[]).map((pm: any) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between p-2.5 rounded-lg border bg-background"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
                      <ArrowDown className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="font-semibold text-sm">
                        € {(pm.totale || pm.amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(pm.document_date), "dd MMM yyyy", { locale: it })}
                        {pm.payment_method && ` · ${pm.payment_method}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs gap-1">
                    <Clock className="h-3 w-3" />
                    In attesa
                  </Badge>
                </div>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Consolidation Dialog */}
      <Dialog open={consolidateOpen} onOpenChange={setConsolidateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Consolida con fattura riepilogativa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium">Seleziona scontrini da consolidare</Label>
              <ScrollArea className="max-h-[250px] mt-2">
                <div className="space-y-2">
                  {preMovements.map((pm: any) => {
                    const subject = pm.note?.replace("Soggetto: ", "").split(" - ")[0] || "";
                    return (
                      <label
                        key={pm.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg border bg-background hover:bg-accent/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedPreMovements.includes(pm.id)}
                          onCheckedChange={(checked) => {
                            setSelectedPreMovements(prev =>
                              checked
                                ? [...prev, pm.id]
                                : prev.filter(id => id !== pm.id)
                            );
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">
                              € {(pm.totale || pm.amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(pm.document_date), "dd/MM/yyyy", { locale: it })}
                            </span>
                          </div>
                          {subject && <p className="text-xs text-muted-foreground">{subject}</p>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>

            {selectedPreMovements.length > 0 && (
              <>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center justify-between text-sm">
                    <span>Totale scontrini selezionati:</span>
                    <span className="font-bold">€ {selectedTotal.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div>
                  <Label>Importo fattura riepilogativa (€)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={invoiceAmount}
                    onChange={(e) => setInvoiceAmount(e.target.value)}
                  />
                  {invoiceAmount && Math.abs(selectedTotal - parseFloat(invoiceAmount)) > 0.01 && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-amber-600">
                      <AlertTriangle className="h-3 w-3" />
                      Scostamento: € {(parseFloat(invoiceAmount) - selectedTotal).toFixed(2)}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Note</Label>
                  <Textarea
                    placeholder="Es. Fattura mensile Q8 - Marzo 2026"
                    value={invoiceNote}
                    onChange={(e) => setInvoiceNote(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsolidateOpen(false)}>Annulla</Button>
            <Button
              onClick={() => consolidateMutation.mutate()}
              disabled={selectedPreMovements.length === 0 || !invoiceAmount || consolidateMutation.isPending}
              className="gap-1"
            >
              <CheckCircle className="h-4 w-4" />
              Consolida ({selectedPreMovements.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
