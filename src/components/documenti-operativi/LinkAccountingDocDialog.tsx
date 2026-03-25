import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, FileCheck, LinkIcon, Check, CheckCircle2,
  Unlink, Receipt, Upload, FileText, Loader2, AlertCircle,
  ArrowUpRight, ArrowDownLeft, Calendar, Building2, Euro
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useDropzone } from "react-dropzone";

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

type InvoiceTypeFilter = "all" | "vendita" | "acquisto" | "nota_credito";

export function LinkAccountingDocDialog({ open, onOpenChange, docType, docId, docLabel, currentLinkedId, onLinked }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentLinkedId || null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"link" | "upload" | "manual">("link");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "analyzing" | "saving" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState("");
  const [invoiceTypeFilter, setInvoiceTypeFilter] = useState<InvoiceTypeFilter>("all");

  // Fetch all invoices (not filtered by type)
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoice-registry-for-link", search],
    queryFn: async () => {
      let q = supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, invoice_type, subject_name, total_amount, status, financial_status, imponibile, iva_rate")
        .order("invoice_date", { ascending: false })
        .limit(200);
      if (search) {
        q = q.or(`invoice_number.ilike.%${search}%,subject_name.ilike.%${search}%`);
      }
      const { data } = await q;
      return data || [];
    },
    enabled: open,
  });

  // Fetch existing links for THIS document
  const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";
  const { data: existingLinks = [] } = useQuery({
    queryKey: ["invoice-document-links", docId, sourceType],
    queryFn: async () => {
      const { data } = await supabase
        .from("invoice_document_links")
        .select("id, invoice_id, document_id, document_type")
        .eq("document_id", docId)
        .eq("document_type", sourceType);
      return data || [];
    },
    enabled: open && !!docId,
  });

  const alreadyLinkedInvoiceIds = new Set(existingLinks.map(l => l.invoice_id));

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    if (invoiceTypeFilter === "all") return invoices;
    return invoices.filter(inv => inv.invoice_type === invoiceTypeFilter);
  }, [invoices, invoiceTypeFilter]);

  // Count by type
  const typeCounts = useMemo(() => ({
    all: invoices.length,
    vendita: invoices.filter(i => i.invoice_type === "vendita").length,
    acquisto: invoices.filter(i => i.invoice_type === "acquisto").length,
    nota_credito: invoices.filter(i => i.invoice_type === "nota_credito").length,
  }), [invoices]);

  // Upload handler
  const handleUploadInvoice = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    setUploadStatus("uploading");
    setUploadError("");
    try {
      const fileName = `invoice_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(fileName, file);
      if (uploadError) throw new Error("Upload fallito: " + uploadError.message);
      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      setUploadStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-invoice", {
        body: { imageUrl: fileUrl },
      });
      if (aiError) throw new Error("Analisi AI fallita");

      setUploadStatus("saving");
      const extracted = aiResult?.data || aiResult || {};
      const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";

      const { data: newInvoice, error: insertError } = await supabase.from("invoice_registry").insert({
        invoice_number: extracted.invoice_number || `FV-${Date.now().toString().slice(-6)}`,
        invoice_date: extracted.invoice_date || new Date().toISOString().split("T")[0],
        invoice_type: "vendita",
        subject_name: extracted.subject_name || extracted.counterpart_name || "Da completare",
        subject_type: "cliente",
        total_amount: extracted.total_amount || 0,
        imponibile: extracted.net_amount || extracted.imponibile || 0,
        iva_amount: extracted.vat_amount || extracted.iva_amount || 0,
        iva_rate: extracted.vat_rate || extracted.iva_rate || 22,
        status: "bozza",
        attachment_url: fileUrl,
        source_document_id: docId,
        source_document_type: sourceType,
      }).select("id, invoice_number").single();

      if (insertError) throw new Error("Salvataggio fattura fallito: " + insertError.message);

      // Link the operational document (without accounting_document_id which has wrong FK)
      if (newInvoice) {
        if (docType === "order") {
          await supabase.from("sales_orders").update({
            invoiced: true,
            invoice_number: newInvoice.invoice_number,
          }).eq("id", docId);
        } else if (docType === "ddt") {
          await supabase.from("ddts").update({
            invoiced: true,
            invoice_number: newInvoice.invoice_number,
          }).eq("id", docId);
        } else if (docType === "report") {
          await supabase.from("service_reports").update({
            invoiced: true,
            invoice_number: newInvoice.invoice_number,
          }).eq("id", docId);
        }
      }

      setUploadStatus("done");
      queryClient.invalidateQueries({ queryKey: ["invoice-registry-for-link"] });
      toast.success("Fattura caricata e collegata con successo");
      setTimeout(() => { onLinked(); onOpenChange(false); }, 800);
    } catch (err: any) {
      setUploadStatus("error");
      setUploadError(err.message || "Errore durante il caricamento");
      toast.error(err.message || "Errore durante il caricamento");
    } finally {
      setUploading(false);
    }
  }, [docType, docId, queryClient, onLinked, onOpenChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"] },
    multiple: false,
    onDrop: handleUploadInvoice,
    disabled: uploading,
  });

  // Link handler — FIXED: don't set accounting_document_id (FK references accounting_documents, not invoice_registry)
  const handleLink = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const selectedInv = invoices.find(i => i.id === selectedId);

      // Update operational document (only invoiced + invoice_number, NOT accounting_document_id)
      if (docType === "order") {
        await supabase.from("sales_orders").update({
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

      // Link invoice_registry to the source document
      const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";
      const { error: linkError } = await supabase.from("invoice_registry").update({
        source_document_id: docId,
        source_document_type: sourceType,
      }).eq("id", selectedId);

      if (linkError) throw linkError;

      toast.success("Fattura collegata con successo");
      onLinked();
      onOpenChange(false);
    } catch (err: any) {
      console.error("Link error:", err);
      toast.error("Errore nel collegamento: " + (err.message || "Errore sconosciuto"));
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
      toast.success("Segnato come fatturato");
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
        await supabase.from("sales_orders").update({ invoiced: false, invoice_number: null }).eq("id", docId);
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
      toast.error("Errore");
    } finally {
      setSaving(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case "vendita": return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />;
      case "acquisto": return <ArrowDownLeft className="h-3.5 w-3.5 text-blue-600" />;
      case "nota_credito": return <Receipt className="h-3.5 w-3.5 text-amber-600" />;
      default: return <FileText className="h-3.5 w-3.5" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "vendita": return "Vendita";
      case "acquisto": return "Acquisto";
      case "nota_credito": return "Nota Credito";
      default: return type;
    }
  };

  const typeBadgeClass = (type: string) => {
    switch (type) {
      case "vendita": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "acquisto": return "bg-blue-50 text-blue-700 border-blue-200";
      case "nota_credito": return "bg-amber-50 text-amber-700 border-amber-200";
      default: return "";
    }
  };

  const statusBadge = (status: string, financialStatus: string) => {
    if (financialStatus === "incassata" || financialStatus === "pagata") {
      return <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-700 border-emerald-200 px-1">Saldato</Badge>;
    }
    if (status === "contabilizzata") {
      return <Badge variant="outline" className="text-[9px] bg-primary/5 text-primary border-primary/20 px-1">Contab.</Badge>;
    }
    return <Badge variant="outline" className="text-[9px] px-1">Bozza</Badge>;
  };

  const uploadStatusLabel: Record<string, string> = {
    uploading: "Caricamento file...",
    analyzing: "Analisi AI in corso...",
    saving: "Salvataggio e collegamento...",
    done: "Fattura collegata!",
    error: "Errore",
  };

  const docTypeLabels: Record<string, string> = {
    order: "Ordine",
    ddt: "DDT",
    report: "Rapporto",
    offer: "Offerta",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b bg-muted/20">
          <DialogTitle className="flex items-center gap-3 text-base">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Receipt className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <span className="block">Collega Fattura</span>
              <span className="text-xs text-muted-foreground font-normal flex items-center gap-1.5 mt-0.5">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{docTypeLabels[docType]}</Badge>
                <span className="font-mono">{docLabel}</span>
              </span>
            </div>
          </DialogTitle>
        </div>

        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <div className="px-5 pt-3">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="link" className="gap-1.5 text-xs h-7">
                <LinkIcon className="h-3 w-3" />
                Collega Esistente
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-1.5 text-xs h-7">
                <Upload className="h-3 w-3" />
                Carica Nuova
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1.5 text-xs h-7">
                <CheckCircle2 className="h-3 w-3" />
                Segna Manuale
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB: Link existing invoice */}
          <TabsContent value="link" className="mt-0 px-5 pb-4 pt-3 space-y-3">
            {/* Search + Type Filter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero fattura o cliente..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  autoFocus
                />
              </div>
            </div>

            {/* Type filter chips */}
            <div className="flex gap-1.5 flex-wrap">
              {([
                { key: "all" as const, label: "Tutte", icon: FileText },
                { key: "vendita" as const, label: "Vendita", icon: ArrowUpRight },
                { key: "acquisto" as const, label: "Acquisto", icon: ArrowDownLeft },
                { key: "nota_credito" as const, label: "Note Credito", icon: Receipt },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setInvoiceTypeFilter(key)}
                  className={cn(
                    "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all",
                    invoiceTypeFilter === key
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background text-muted-foreground border-border hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  {typeCounts[key] > 0 && (
                    <span className={cn(
                      "ml-0.5 text-[10px] tabular-nums",
                      invoiceTypeFilter === key ? "opacity-80" : "opacity-60"
                    )}>
                      ({typeCounts[key]})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Invoice List */}
            <ScrollArea className="h-[300px] border rounded-lg bg-background">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="py-16 text-center">
                  <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground font-medium">Nessuna fattura trovata</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {search ? "Prova a cambiare i criteri di ricerca" : "Non ci sono fatture registrate"}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {filteredInvoices.map(inv => {
                    const isSelected = selectedId === inv.id;
                    const isAlreadyLinked = inv.source_document_id && inv.source_document_id !== docId;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => !isAlreadyLinked && setSelectedId(isSelected ? null : inv.id)}
                        disabled={!!isAlreadyLinked}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all",
                          isSelected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                          !isSelected && !isAlreadyLinked && "hover:bg-muted/40",
                          isAlreadyLinked && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        {/* Selection indicator */}
                        <div className={cn(
                          "h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                          isSelected ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/50 border"
                        )}>
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            typeIcon(inv.invoice_type)
                          )}
                        </div>

                        {/* Invoice info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-sm">{inv.invoice_number}</span>
                            <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 border", typeBadgeClass(inv.invoice_type))}>
                              {typeLabel(inv.invoice_type)}
                            </Badge>
                            {statusBadge(inv.status, inv.financial_status)}
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                            <span className="flex items-center gap-0.5">
                              <Building2 className="h-2.5 w-2.5" />
                              {inv.subject_name}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {format(new Date(inv.invoice_date), "dd MMM yyyy", { locale: it })}
                            </span>
                            {isAlreadyLinked && (
                              <>
                                <span>•</span>
                                <span className="text-amber-600 flex items-center gap-0.5">
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  Già collegata
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Amount */}
                        <div className="text-right flex-shrink-0">
                          <span className="text-sm font-semibold tabular-nums flex items-center gap-0.5">
                            <Euro className="h-3 w-3 text-muted-foreground" />
                            {inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </span>
                          {inv.imponibile > 0 && (
                            <span className="text-[10px] text-muted-foreground block">
                              Imp. {inv.imponibile?.toLocaleString("it-IT", { minimumFractionDigits: 2 })} · IVA {inv.iva_rate}%
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Footer actions */}
            <div className="flex items-center justify-between pt-1">
              {currentLinkedId ? (
                <Button variant="ghost" onClick={handleUnlink} disabled={saving} className="text-destructive hover:text-destructive gap-1.5 h-8 text-xs px-2">
                  <Unlink className="h-3 w-3" />
                  Scollega Attuale
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  {filteredInvoices.length} fatture disponibili
                </span>
              )}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm" className="h-8 text-xs">Annulla</Button>
                <Button onClick={handleLink} disabled={saving || !selectedId} className="gap-1.5 h-8 text-xs" size="sm">
                  <FileCheck className="h-3.5 w-3.5" />
                  {saving ? "Collegamento..." : "Collega Fattura"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Upload invoice */}
          <TabsContent value="upload" className="mt-0 px-5 pb-5 pt-3">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
                isDragActive && "border-primary bg-primary/5 scale-[1.01]",
                !isDragActive && !uploading && "border-muted-foreground/20 hover:border-primary/40 hover:bg-muted/30",
                uploading && "pointer-events-none opacity-60"
              )}
            >
              <input {...getInputProps()} />
              {uploadStatus === "idle" || uploadStatus === "error" ? (
                <div className="space-y-3">
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {isDragActive ? "Rilascia qui la fattura" : "Trascina la fattura qui"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF o immagine — l'AI la analizzerà e la collegherà automaticamente
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <FileText className="h-2.5 w-2.5" /> PDF
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1">JPG / PNG</Badge>
                  </div>
                  {uploadStatus === "error" && (
                    <div className="flex items-center gap-2 justify-center text-destructive mt-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      <span className="text-xs">{uploadError}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={cn(
                    "h-14 w-14 rounded-2xl flex items-center justify-center mx-auto",
                    uploadStatus === "done" ? "bg-emerald-500/10" : "bg-primary/10"
                  )}>
                    {uploadStatus === "done" ? (
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    ) : (
                      <Loader2 className="h-6 w-6 text-primary animate-spin" />
                    )}
                  </div>
                  <p className="font-semibold text-sm">{uploadStatusLabel[uploadStatus]}</p>
                  <div className="flex justify-center gap-1.5">
                    {["uploading", "analyzing", "saving", "done"].map((step, i) => (
                      <div
                        key={step}
                        className={cn(
                          "h-1.5 w-8 rounded-full transition-colors",
                          ["uploading", "analyzing", "saving", "done"].indexOf(uploadStatus) >= i
                            ? uploadStatus === "done" ? "bg-emerald-500" : "bg-primary"
                            : "bg-muted"
                        )}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB: Manual mark */}
          <TabsContent value="manual" className="mt-0 px-5 pb-5 pt-3">
            <div className="text-center py-6 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm">Segna come fatturato</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Segna il documento come fatturato senza collegare una fattura specifica dal registro.
                  <br />Utile se la fattura è gestita esternamente (es. Fattura24).
                </p>
              </div>
              <Button onClick={handleMarkInvoiced} disabled={saving} className="gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {saving ? "Salvataggio..." : "Segna come Fatturato"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
