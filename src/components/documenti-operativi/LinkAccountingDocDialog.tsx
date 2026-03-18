import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, FileCheck, LinkIcon, ArrowUpRight, ArrowDownLeft, Check } from "lucide-react";
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

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoice-registry-for-link", search],
    queryFn: async () => {
      let q = supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, invoice_type, subject_name, total_amount, status, financial_status")
        .order("invoice_date", { ascending: false })
        .limit(50);
      if (search) {
        q = q.or(`invoice_number.ilike.%${search}%,subject_name.ilike.%${search}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      if (docType === "order") {
        await supabase.from("sales_orders").update({
          accounting_document_id: selectedId,
          invoiced: !!selectedId,
        }).eq("id", docId);
      } else if (docType === "ddt") {
        await supabase.from("ddts").update({
          invoiced: !!selectedId,
          invoice_number: selectedId ? invoices.find(i => i.id === selectedId)?.invoice_number : null,
        }).eq("id", docId);
      } else if (docType === "report") {
        await supabase.from("service_reports").update({
          invoiced: !!selectedId,
          invoice_number: selectedId ? invoices.find(i => i.id === selectedId)?.invoice_number : null,
        }).eq("id", docId);
      }

      // Also update invoice_registry source_document link
      if (selectedId) {
        const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";
        await supabase.from("invoice_registry").update({
          source_document_id: docId,
          source_document_type: sourceType,
        }).eq("id", selectedId);
      }

      toast.success(selectedId ? "Documento contabile collegato" : "Collegamento rimosso");
      onLinked();
      onOpenChange(false);
    } catch {
      toast.error("Errore nel collegamento");
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    setSaving(true);
    try {
      if (docType === "order") {
        await supabase.from("sales_orders").update({ accounting_document_id: null, invoiced: false }).eq("id", docId);
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
            <LinkIcon className="h-5 w-5 text-primary" />
            Collega documento contabile
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Collega <span className="font-medium text-foreground">{docLabel}</span> a una fattura del Registro Contabile
          </p>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero fattura o soggetto..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[320px] border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Nessun documento contabile trovato
              </div>
            ) : (
              <div className="divide-y">
                {invoices.map(inv => {
                  const isSelected = selectedId === inv.id;
                  return (
                    <button
                      key={inv.id}
                      onClick={() => setSelectedId(isSelected ? null : inv.id)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-muted/50",
                        isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                      )}
                    >
                      <div className="flex-shrink-0">
                        {inv.invoice_type === "vendita" ? (
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ArrowDownLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium text-sm">{inv.invoice_number}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {inv.invoice_type === "vendita" ? "Vendita" : inv.invoice_type === "acquisto" ? "Acquisto" : "N.C."}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {inv.subject_name} • {format(new Date(inv.invoice_date), "dd/MM/yyyy", { locale: it })}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-medium">
                          € {inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </div>
                        <Badge variant={inv.status === "contabilizzato" || inv.status === "registrata" ? "default" : "secondary"} className="text-[10px]">
                          {inv.status}
                        </Badge>
                      </div>
                      {isSelected && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          {currentLinkedId && (
            <Button variant="outline" onClick={handleUnlink} disabled={saving} className="mr-auto text-destructive hover:text-destructive">
              Scollega
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annulla</Button>
          <Button onClick={handleSave} disabled={saving || !selectedId} className="gap-1.5">
            <FileCheck className="h-4 w-4" />
            {saving ? "Salvataggio..." : "Collega"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
