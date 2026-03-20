import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Link2, Unlink, Plus, Receipt, ArrowUpCircle, ArrowDownCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatEuro } from "@/lib/accounting-utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Props {
  entryId: string;
  editing: boolean;
}

export function LinkedDocumentsSection({ entryId, editing }: Props) {
  const queryClient = useQueryClient();
  const [showLinkSelector, setShowLinkSelector] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string>("");
  const [linkType, setLinkType] = useState<"document" | "invoice">("invoice");

  // Fetch the current accounting entry to know amount and direction
  const { data: currentEntry } = useQuery({
    queryKey: ["entry-for-link", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("id, amount, totale, direction, document_type, payment_method, document_date")
        .eq("id", entryId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!entryId,
  });

  // Fetch linked accounting_documents
  const { data: linkedDocs = [] } = useQuery({
    queryKey: ["linked-documents", entryId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*")
        .eq("accounting_entry_id", entryId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!entryId,
  });

  // Fetch linked invoices from invoice_registry (via scadenza_movimenti or direct link)
  const { data: linkedInvoices = [] } = useQuery({
    queryKey: ["linked-invoices", entryId],
    queryFn: async () => {
      // Find invoices linked through scadenza_movimenti
      const { data: movimenti } = await supabase
        .from("scadenza_movimenti")
        .select("*, scadenza:scadenze!scadenza_movimenti_scadenza_id_fkey(id, fattura_id, soggetto_nome, tipo, importo_totale, importo_residuo, stato)")
        .eq("evento_finanziario_id", entryId);

      if (!movimenti || movimenti.length === 0) return [];

      const invoiceIds = movimenti
        .map((m: any) => m.scadenza?.fattura_id)
        .filter(Boolean);

      if (invoiceIds.length === 0) return movimenti.map((m: any) => ({
        ...m,
        invoice: null,
      }));

      const { data: invoices } = await supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_type, subject_name, total_amount, invoice_date")
        .in("id", invoiceIds);

      return movimenti.map((m: any) => ({
        ...m,
        invoice: invoices?.find((inv: any) => inv.id === m.scadenza?.fattura_id) || null,
      }));
    },
    enabled: !!entryId,
  });

  // Fetch unlinked documents for selector
  const { data: availableDocs = [] } = useQuery({
    queryKey: ["unlinked-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*")
        .is("accounting_entry_id", null)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    enabled: showLinkSelector && linkType === "document",
  });

  // Fetch invoices with open scadenze for linking
  const { data: availableInvoices = [] } = useQuery({
    queryKey: ["linkable-invoices-with-scadenze", entryId],
    queryFn: async () => {
      // Get open scadenze with their invoice info
      const { data, error } = await supabase
        .from("scadenze")
        .select("id, fattura_id, soggetto_nome, tipo, importo_totale, importo_residuo, data_scadenza, stato, invoice_number:invoice_registry!scadenze_fattura_id_fkey(invoice_number, invoice_type, subject_name)")
        .in("stato", ["aperta", "parziale"])
        .gt("importo_residuo", 0)
        .order("data_scadenza", { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []).map((s: any) => ({
        ...s,
        invoice_number: s.invoice_number?.invoice_number || null,
        invoice_type: s.invoice_number?.invoice_type || null,
      }));
    },
    enabled: showLinkSelector && linkType === "invoice",
  });

  // Link an accounting_document
  const linkDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("accounting_documents")
        .update({ accounting_entry_id: entryId })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento collegato");
      setSelectedDocId("");
      setShowLinkSelector(false);
      queryClient.invalidateQueries({ queryKey: ["linked-documents", entryId] });
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents"] });
    },
    onError: () => toast.error("Errore nel collegamento"),
  });

  // Link a Prima Nota entry to an invoice's scadenza (creates scadenza_movimenti + updates residuo)
  const linkInvoiceMutation = useMutation({
    mutationFn: async (scadenzaId: string) => {
      if (!currentEntry) throw new Error("Dati movimento non disponibili");

      // Get the scadenza details
      const { data: scadenza, error: scadError } = await supabase
        .from("scadenze")
        .select("*")
        .eq("id", scadenzaId)
        .single();
      if (scadError) throw scadError;

      const entryAmount = Number(currentEntry.totale || currentEntry.amount || 0);
      const residuo = Number(scadenza.importo_residuo);
      const importoDaApplicare = Math.min(entryAmount, residuo);

      if (importoDaApplicare <= 0) {
        throw new Error("L'importo del movimento è zero o la scadenza è già saldata");
      }

      // 1. Create prima_nota record if not exists (link financial movement)
      // First check if there's already a prima_nota linked
      const { data: existingPN } = await supabase
        .from("prima_nota")
        .select("id")
        .eq("accounting_entry_id", entryId)
        .limit(1);

      let primaNotaId = existingPN?.[0]?.id || null;

      // 2. Create scadenza_movimenti record
      const { error: movError } = await supabase
        .from("scadenza_movimenti")
        .insert({
          scadenza_id: scadenzaId,
          evento_finanziario_id: entryId,
          prima_nota_id: primaNotaId,
          importo: importoDaApplicare,
          data_movimento: currentEntry.document_date || new Date().toISOString().split('T')[0],
          metodo_pagamento: currentEntry.payment_method || null,
          note: `Collegamento da Prima Nota - ${currentEntry.direction === 'entrata' ? 'Incasso' : 'Pagamento'}`,
        });
      if (movError) throw movError;

      // 3. Update scadenza residuo and stato
      const nuovoResiduo = residuo - importoDaApplicare;
      const nuovoStato = nuovoResiduo <= 0
        ? "chiusa"
        : nuovoResiduo < Number(scadenza.importo_totale)
          ? "parziale"
          : "aperta";

      const { error: updateError } = await supabase
        .from("scadenze")
        .update({
          importo_residuo: Math.max(0, nuovoResiduo),
          stato: nuovoStato,
        })
        .eq("id", scadenzaId);
      if (updateError) throw updateError;

      // 4. Update the invoice financial_status if fully paid
      if (nuovoResiduo <= 0 && scadenza.fattura_id) {
        const isCredito = scadenza.tipo === "credito";
        await supabase
          .from("invoice_registry")
          .update({
            financial_status: isCredito ? "incassata" : "pagata",
          })
          .eq("id", scadenza.fattura_id);
      }

      return { importoDaApplicare, nuovoResiduo, nuovoStato };
    },
    onSuccess: (result) => {
      const msg = result.nuovoStato === "chiusa"
        ? `Scadenza estinta! Applicati ${formatEuro(result.importoDaApplicare)}`
        : `Applicati ${formatEuro(result.importoDaApplicare)} alla scadenza (residuo: ${formatEuro(result.nuovoResiduo)})`;
      toast.success(msg);
      setSelectedDocId("");
      setShowLinkSelector(false);
      queryClient.invalidateQueries({ queryKey: ["linked-invoices", entryId] });
      queryClient.invalidateQueries({ queryKey: ["linkable-invoices-with-scadenze"] });
      queryClient.invalidateQueries({ queryKey: ["scadenze-dettagliate"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
    },
    onError: (error) => toast.error(`Errore: ${error.message}`),
  });

  // Unlink accounting_document
  const unlinkDocMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("accounting_documents")
        .update({ accounting_entry_id: null })
        .eq("id", docId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Documento scollegato");
      queryClient.invalidateQueries({ queryKey: ["linked-documents", entryId] });
    },
    onError: () => toast.error("Errore nello scollegamento"),
  });

  const hasLinkedItems = linkedDocs.length > 0 || linkedInvoices.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4" />
          Documenti Collegati
        </h3>
        {editing && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowLinkSelector(!showLinkSelector)}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Collega
          </Button>
        )}
      </div>

      {/* Link selector */}
      {showLinkSelector && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
          {/* Type selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={linkType === "invoice" ? "default" : "outline"}
              onClick={() => { setLinkType("invoice"); setSelectedDocId(""); }}
              className="gap-1.5 text-xs"
            >
              <Receipt className="h-3.5 w-3.5" />
              Fattura / Scadenza
            </Button>
            <Button
              size="sm"
              variant={linkType === "document" ? "default" : "outline"}
              onClick={() => { setLinkType("document"); setSelectedDocId(""); }}
              className="gap-1.5 text-xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Documento Contabile
            </Button>
          </div>

          {/* Invoice/Scadenza selector */}
          {linkType === "invoice" && (
            <div className="space-y-2">
              {currentEntry && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background rounded-md p-2 border">
                  {currentEntry.direction === "entrata" ? (
                    <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <ArrowDownCircle className="h-3.5 w-3.5 text-red-600" />
                  )}
                  <span>Importo movimento: <strong>{formatEuro(Number(currentEntry.totale || currentEntry.amount || 0))}</strong></span>
                  <span>· {currentEntry.direction === "entrata" ? "Entrata" : "Uscita"}</span>
                </div>
              )}
              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Seleziona scadenza da collegare</label>
                  <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli una scadenza aperta..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInvoices.length === 0 ? (
                        <SelectItem value="_none" disabled>Nessuna scadenza aperta disponibile</SelectItem>
                      ) : (
                        availableInvoices.map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="flex items-center gap-2">
                              <span className={s.tipo === "credito" ? "text-emerald-700" : "text-red-700"}>
                                {s.tipo === "credito" ? "↑" : "↓"}
                              </span>
                              {s.invoice_number || "N/D"} - {s.soggetto_nome || "Sconosciuto"}
                              {" · Residuo: "}
                              {formatEuro(Number(s.importo_residuo))}
                              {" · Scad. "}
                              {s.data_scadenza ? format(new Date(s.data_scadenza), "dd/MM/yy") : "N/D"}
                            </span>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  disabled={!selectedDocId || selectedDocId === "_none" || linkInvoiceMutation.isPending}
                  onClick={() => linkInvoiceMutation.mutate(selectedDocId)}
                >
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  {linkInvoiceMutation.isPending ? "Collegamento..." : "Collega e Registra"}
                </Button>
              </div>
            </div>
          )}

          {/* Document selector */}
          {linkType === "document" && (
            <div className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                <label className="text-xs text-muted-foreground">Seleziona documento</label>
                <Select value={selectedDocId} onValueChange={setSelectedDocId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Scegli un documento..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDocs.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {doc.document_type} - {doc.file_name}
                        {doc.total_amount ? ` (${formatEuro(doc.total_amount)})` : ""}
                      </SelectItem>
                    ))}
                    {availableDocs.length === 0 && (
                      <SelectItem value="_none" disabled>Nessun documento disponibile</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!selectedDocId || selectedDocId === "_none" || linkDocMutation.isPending}
                onClick={() => linkDocMutation.mutate(selectedDocId)}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                Collega
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Linked invoices/scadenze */}
      {linkedInvoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Fatture / Scadenze Collegate</p>
          {linkedInvoices.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-full ${item.scadenza?.tipo === "credito" ? "bg-emerald-100" : "bg-red-100"}`}>
                  <Receipt className={`h-3.5 w-3.5 ${item.scadenza?.tipo === "credito" ? "text-emerald-700" : "text-red-700"}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.invoice?.invoice_number || item.scadenza?.soggetto_nome || "Scadenza"}
                    {item.invoice?.subject_name && <span className="text-muted-foreground font-normal"> · {item.invoice.subject_name}</span>}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium">{formatEuro(Number(item.importo))}</span>
                    <span>·</span>
                    <span>{format(new Date(item.data_movimento), "dd/MM/yyyy", { locale: it })}</span>
                    {item.metodo_pagamento && <><span>·</span><span>{item.metodo_pagamento}</span></>}
                    {item.scadenza?.stato === "chiusa" && (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] gap-0.5">
                        <CheckCircle className="h-2.5 w-2.5" />
                        Estinta
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Linked documents */}
      {linkedDocs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Documenti Contabili</p>
          {linkedDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{doc.document_type}</Badge>
                    {doc.counterpart_name && <span>{doc.counterpart_name}</span>}
                    {doc.total_amount && <span className="font-medium">{formatEuro(doc.total_amount)}</span>}
                    {doc.invoice_date && <span>{format(new Date(doc.invoice_date), "dd/MM/yyyy", { locale: it })}</span>}
                  </div>
                </div>
              </div>
              {editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkDocMutation.mutate(doc.id)}
                  disabled={unlinkDocMutation.isPending}
                  className="text-destructive hover:text-destructive shrink-0"
                >
                  <Unlink className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!hasLinkedItems && !showLinkSelector && (
        <p className="text-xs text-muted-foreground italic">Nessun documento collegato</p>
      )}
    </div>
  );
}
