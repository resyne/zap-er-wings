import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, FileCheck, LinkIcon, ArrowUpRight, Check, CheckCircle2, Unlink, Receipt } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type DocType = "order" | "ddt" | "report" | "offer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: DocType;
  docId: string;
  docLabel: string;
  currentLinkedId?: string | null;
  onLinked: () => void;
}

export function LinkAccountingDocDialog({ open, onOpenChange, docType, docId, docLabel, currentLinkedId, onLinked }: Props) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentLinkedId || null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"link" | "manual">(currentLinkedId ? "link" : "link");

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoice-registry-for-link", search],
    queryFn: async () => {
      let q = supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, invoice_type, subject_name, total_amount, status, financial_status")
        .eq("invoice_type", "vendita")
        .order("invoice_date", { ascending: false })
        .limit(80);
      if (search) {
        q = q.or(`invoice_number.ilike.%${search}%,subject_name.ilike.%${search}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  // Split into unlinked and all
  const unlinkedInvoices = useMemo(() => {
    return invoices; // show all, user picks
  }, [invoices]);

  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const selectedInv = invoices.find(i => i.id === selectedId);
      if (docType === "order") {
        await supabase.from("sales_orders").update({
          accounting_document_id: selectedId,
          invoiced: true,
          invoice_number: selectedInv?.invoice_number || null,
        }).eq("id", docId);
      } else if (docType === "ddt") {
        await supabase.from("ddts").update({
          invoiced: true,
          invoice_number: selectedInv?.invoice_number || null,
        }).eq("id", docId);
      } else if (docType === "report") {
        await supabase.from("service_reports").update({
          invoiced: true,
          invoice_number: selectedInv?.invoice_number || null,
        }).eq("id", docId);
      }

      // Update invoice_registry source_document link
      const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";
      await supabase.from("invoice_registry").update({
        source_document_id: docId,
        source_document_type: sourceType,
      }).eq("id", selectedId);

      toast.success("Fattura collegata con successo");
      onLinked();
      onOpenChange(false);
    } catch {
      toast.error("Errore nel collegamento");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInvoiced = async () => {
    setSaving(true);
    try {
      if (docType === "order") {
        await supabase.from("sales_orders").update({ invoiced: true }).eq("id", docId);
      } else if (docType === "ddt") {
        await supabase.from("ddts").update({ invoiced: true }).eq("id", docId);
      } else if (docType === "report") {
        await supabase.from("service_reports").update({ invoiced: true }).eq("id", docId);
      }
      toast.success("Documento segnato come fatturato");
      onLinked();
      onOpenChange(false);
    } catch {
      toast.error("Errore");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    try {
      if (docType === "order") {
        await supabase.from("sales_orders").update({ accounting_document_id: null, invoiced: false, invoice_number: null }).eq("id", docId);
      } else if (docType === "ddt") {
        await supabase.from("ddts").update({ invoiced: false, invoice_number: null }).eq("id", docId);
      } else if (docType === "report") {
        await supabase.from("service_reports").update({ invoiced: false, invoice_number: null }).eq("id", docId);
      }
      if (currentLinkedId) {
        await supabase.from("invoice_registry").update({ source_document_id: null, source_document_type: null }).eq("id", currentLinkedId);
      }
      toast.success("Collegamento rimosso");
      setSelectedId(null);
      onLinked();
      onOpenChange(false);
    } catch {
      toast.error("Errore nella rimozione del collegamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Fatturazione documento
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{docLabel}</span> — collega a una fattura di vendita o segna come fatturato
          </p>
        </DialogHeader>

        <Tabs value={mode} onValueChange={v => setMode(v as any)} className="space-y-3">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="link" className="gap-1.5 text-xs">
              <LinkIcon className="h-3.5 w-3.5" />
              Collega a fattura
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Segna fatturato
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-3 mt-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca per numero fattura o cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                </div>
              ) : unlinkedInvoices.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Nessuna fattura di vendita trovata
                </div>
              ) : (
                <div className="divide-y">
                  {unlinkedInvoices.map(inv => {
                    const isSelected = selectedId === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedId(isSelected ? null : inv.id)}
                        className={cn(
                          "w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-muted/50",
                          isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/30"
                        )}
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                          {isSelected ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm">{inv.invoice_number}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 truncate">
                            {inv.subject_name} • {format(new Date(inv.invoice_date), "dd MMM yyyy", { locale: it })}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold">
                            € {inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2">
              {currentLinkedId && (
                <Button variant="outline" onClick={handleUnlink} disabled={saving} className="mr-auto text-destructive hover:text-destructive gap-1.5" size="sm">
                  <Unlink className="h-3.5 w-3.5" />
                  Scollega
                </Button>
              )}
              <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm">Annulla</Button>
              <Button onClick={handleLink} disabled={saving || !selectedId} className="gap-1.5" size="sm">
                <FileCheck className="h-4 w-4" />
                {saving ? "Collegamento..." : "Collega fattura"}
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="manual" className="mt-0">
            <div className="p-6 text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold">Segna come fatturato</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Segna <span className="font-medium text-foreground">{docLabel}</span> come fatturato senza collegarlo a una fattura specifica del registro contabile.
                </p>
              </div>
              <DialogFooter className="justify-center gap-2 pt-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm">Annulla</Button>
                <Button onClick={handleMarkInvoiced} disabled={saving} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" size="sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Salvataggio..." : "Conferma fatturato"}
                </Button>
              </DialogFooter>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
