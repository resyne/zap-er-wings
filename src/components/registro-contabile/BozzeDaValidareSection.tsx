import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BozzaValidaDialog } from "@/components/prima-nota/BozzaValidaDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, CheckCircle, ChevronDown, ClipboardList, Sparkles
} from "lucide-react";

export function BozzeDaValidareSection() {
  const queryClient = useQueryClient();
  const [selectedBozza, setSelectedBozza] = useState<any>(null);
  const [bozzaDialogOpen, setBozzaDialogOpen] = useState(false);

  const { data: bozze = [] } = useQuery({
    queryKey: ["bozze-prima-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select(`*, chart_account:chart_of_accounts(code, name), cost_center:cost_centers(code, name), profit_center:profit_centers(code, name)`)
        .in("status", ["da_classificare", "in_classificazione", "sospeso", "pronto_prima_nota"])
        .is("pre_movement_status", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ["pending-accounting-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*, customers(name, company_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const total = bozze.length + pendingDocuments.length;

  if (total === 0) return null;

  const handleSelectBozza = (b: any) => {
    setSelectedBozza(b);
    setBozzaDialogOpen(true);
  };

  return (
    <>
      <Collapsible defaultOpen>
        <div className="rounded-xl border border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700/30">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-amber-100/30 dark:hover:bg-amber-900/20 transition-colors text-left rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <ClipboardList className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <span className="text-sm font-semibold">Bozze da validare</span>
                  <p className="text-xs text-muted-foreground">
                    {total} moviment{total === 1 ? 'o' : 'i'} in attesa
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="px-2 py-1 text-sm">{total}</Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2">
              {/* AI Documents */}
              {pendingDocuments.map((doc: any) => {
                const isVendita = doc.document_type === "fattura_vendita";
                const customerName = doc.customers?.company_name || doc.customers?.name || doc.counterpart_name;
                return (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={async () => {
                      try {
                        const direction = isVendita ? "entrata" : "uscita";
                        const { data: newEntry, error: entryError } = await supabase
                          .from("accounting_entries")
                          .insert({
                            direction,
                            document_type: doc.document_type === "nota_credito" ? "nota_credito" : "fattura",
                            amount: doc.total_amount || 0,
                            document_date: doc.invoice_date || new Date().toISOString().split("T")[0],
                            attachment_url: doc.file_url,
                            status: "da_classificare",
                            iva_aliquota: doc.vat_rate,
                            imponibile: doc.net_amount,
                            iva_amount: doc.vat_amount,
                            totale: doc.total_amount,
                            iva_mode: "DOMESTICA_IMPONIBILE",
                            note: `${isVendita ? "Fattura vendita" : "Fattura acquisto"} n.${doc.invoice_number || "?"} - ${customerName || ""}`,
                          })
                          .select().single();
                        if (entryError) throw entryError;
                        await supabase.from("accounting_documents").update({ status: "classified", accounting_entry_id: newEntry.id }).eq("id", doc.id);
                        queryClient.invalidateQueries({ queryKey: ["pending-accounting-documents"] });
                        queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
                        handleSelectBozza(newEntry);
                      } catch (err: any) {
                        toast.error("Errore: " + (err.message || "Errore sconosciuto"));
                      }
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-full ${isVendita ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
                        {isVendita ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">€ {(doc.total_amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                          <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" />AI</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {doc.invoice_number && `N. ${doc.invoice_number} · `}
                          {doc.invoice_date && format(new Date(doc.invoice_date), "dd MMM yyyy", { locale: it })}
                          {customerName && ` · ${customerName}`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">Crea Bozza →</Badge>
                  </div>
                );
              })}

              {/* Bozze */}
              {bozze.map((bozza: any) => (
                <div
                  key={bozza.id}
                  className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
                  onClick={() => handleSelectBozza(bozza)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-full ${bozza.direction === "entrata" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
                      {bozza.direction === "entrata" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">€ {(bozza.totale || bozza.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                        <Badge variant="outline" className="text-xs capitalize">{(bozza.document_type || "").replace(/_/g, " ")}</Badge>
                        <Badge variant={bozza.status === "pronto_prima_nota" ? "default" : "secondary"} className="text-xs">
                          {bozza.status === "da_classificare" ? "Da validare" :
                            bozza.status === "in_classificazione" ? "In lavorazione" :
                              bozza.status === "pronto_prima_nota" ? "Pronto" :
                                bozza.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(bozza.document_date), "dd MMM yyyy", { locale: it })}
                        {bozza.note && ` · ${bozza.note}`}
                      </p>
                    </div>
                  </div>
                  <Button variant="default" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); handleSelectBozza(bozza); }}>
                    <CheckCircle className="h-3 w-3" />
                    Valida
                  </Button>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <BozzaValidaDialog open={bozzaDialogOpen} onOpenChange={setBozzaDialogOpen} entry={selectedBozza} />
    </>
  );
}
