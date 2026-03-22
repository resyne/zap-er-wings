import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, FileCheck, LinkIcon, ArrowUpRight, Check, CheckCircle2,
  Unlink, Receipt, Upload, FileText, Loader2, AlertCircle
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

export function LinkAccountingDocDialog({ open, onOpenChange, docType, docId, docLabel, currentLinkedId, onLinked }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(currentLinkedId || null);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"link" | "upload" | "manual">("link");
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "analyzing" | "saving" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState("");

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

  // Upload handler
  const handleUploadInvoice = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    setUploadStatus("uploading");
    setUploadError("");

    try {
      // 1. Upload file
      const fileName = `invoice_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(fileName, file);
      if (uploadError) throw new Error("Upload fallito: " + uploadError.message);

      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      // 2. AI analysis
      setUploadStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-invoice", {
        body: { imageUrl: fileUrl },
      });

      if (aiError) throw new Error("Analisi AI fallita");

      // 3. Save to invoice_registry
      setUploadStatus("saving");
      const extracted = aiResult?.data || aiResult || {};
      const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";

      const { data: newInvoice, error: insertError } = await supabase.from("invoice_registry").insert({
        invoice_number: extracted.invoice_number || `FV-${Date.now().toString().slice(-6)}`,
        invoice_date: extracted.invoice_date || new Date().toISOString().split("T")[0],
        invoice_type: "vendita",
        subject_name: extracted.subject_name || extracted.counterpart_name || "",
        total_amount: extracted.total_amount || 0,
        net_amount: extracted.net_amount || extracted.imponibile || 0,
        vat_amount: extracted.vat_amount || 0,
        vat_rate: extracted.vat_rate || 22,
        status: "bozza",
        attachment_url: fileUrl,
        source_document_id: docId,
        source_document_type: sourceType,
      }).select("id, invoice_number").single();

      if (insertError) throw new Error("Salvataggio fattura fallito: " + insertError.message);

      // 4. Link to the document
      if (newInvoice) {
        if (docType === "order") {
          await supabase.from("sales_orders").update({
            accounting_document_id: newInvoice.id,
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

      setTimeout(() => {
        onLinked();
        onOpenChange(false);
      }, 800);
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

      const sourceType = docType === "order" ? "sales_order" : docType === "ddt" ? "ddt" : "service_report";
      await supabase.from("invoice_registry").update({
        source_document_id: docId,
        source_document_type: sourceType,
      }).eq("id", selectedId);

      toast.success("Fattura collegata");
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
      toast.error("Errore");
    } finally {
      setSaving(false);
    }
  };

  const uploadStatusLabel: Record<string, string> = {
    uploading: "Caricamento file...",
    analyzing: "Analisi AI in corso...",
    saving: "Salvataggio e collegamento...",
    done: "Fattura collegata!",
    error: "Errore",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            Fatturazione
          </DialogTitle>
          <p className="text-xs text-muted-foreground pl-10">
            <span className="font-mono font-medium text-foreground">{docLabel}</span>
          </p>
        </div>

        <Tabs value={mode} onValueChange={v => setMode(v as any)}>
          <div className="px-5">
            <TabsList className="w-full grid grid-cols-3 h-9">
              <TabsTrigger value="link" className="gap-1 text-xs h-7">
                <LinkIcon className="h-3 w-3" />
                Collega
              </TabsTrigger>
              <TabsTrigger value="upload" className="gap-1 text-xs h-7">
                <Upload className="h-3 w-3" />
                Carica
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-1 text-xs h-7">
                <CheckCircle2 className="h-3 w-3" />
                Manuale
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB: Collega a fattura esistente */}
          <TabsContent value="link" className="mt-0 px-5 pb-4 pt-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Cerca fattura per numero o cliente..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                autoFocus
              />
            </div>

            <ScrollArea className="h-[280px] border rounded-lg bg-muted/20">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : invoices.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Nessuna fattura trovata</p>
                  <p className="text-xs text-muted-foreground mt-1">Prova a cambiare i criteri di ricerca</p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {invoices.map(inv => {
                    const isSelected = selectedId === inv.id;
                    return (
                      <button
                        key={inv.id}
                        onClick={() => setSelectedId(isSelected ? null : inv.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all hover:bg-background/80",
                          isSelected && "bg-primary/5 border-l-2 border-l-primary"
                        )}
                      >
                        <div className={cn(
                          "h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
                          isSelected ? "bg-primary text-primary-foreground" : "bg-background border"
                        )}>
                          {isSelected ? (
                            <Check className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-mono font-semibold text-sm block">{inv.invoice_number}</span>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {inv.subject_name} • {format(new Date(inv.invoice_date), "dd MMM yyyy", { locale: it })}
                          </span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums flex-shrink-0">
                          € {inv.total_amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="flex items-center justify-between pt-1">
              {currentLinkedId ? (
                <Button variant="ghost" onClick={handleUnlink} disabled={saving} className="text-destructive hover:text-destructive gap-1 h-8 text-xs px-2">
                  <Unlink className="h-3 w-3" />
                  Scollega
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm" className="h-8 text-xs">Annulla</Button>
                <Button onClick={handleLink} disabled={saving || !selectedId} className="gap-1.5 h-8 text-xs" size="sm">
                  <FileCheck className="h-3.5 w-3.5" />
                  {saving ? "Collegamento..." : "Collega"}
                </Button>
              </div>
            </div>
          </TabsContent>

          {/* TAB: Carica fattura */}
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
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      JPG / PNG
                    </Badge>
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
                  <div className="flex justify-center gap-1">
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

            {uploadStatus !== "idle" && uploadStatus !== "error" && (
              <p className="text-[11px] text-muted-foreground text-center mt-3">
                La fattura verrà aggiunta al Registro Contabile e collegata a <span className="font-mono font-medium">{docLabel}</span>
              </p>
            )}
          </TabsContent>

          {/* TAB: Segna fatturato */}
          <TabsContent value="manual" className="mt-0 px-5 pb-5 pt-3">
            <div className="text-center space-y-4 py-4">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-semibold text-sm">Segna come fatturato</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Segna <span className="font-mono font-medium text-foreground">{docLabel}</span> come fatturato senza collegarlo a una fattura del registro.
                </p>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <Button variant="ghost" onClick={() => onOpenChange(false)} size="sm" className="h-8 text-xs">Annulla</Button>
                <Button onClick={handleMarkInvoiced} disabled={saving} className="gap-1.5 h-8 text-xs bg-emerald-600 hover:bg-emerald-700" size="sm">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {saving ? "Salvataggio..." : "Conferma"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
