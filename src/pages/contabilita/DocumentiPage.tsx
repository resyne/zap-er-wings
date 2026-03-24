import { Suspense, lazy, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, AlertTriangle, XCircle, Loader2, Upload, Sparkles, CheckCircle2, AlertCircle, FileText, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { findSimilarSubjects } from "@/lib/fuzzyMatch";
import { cn } from "@/lib/utils";

const DocumentiOperativiPage = lazy(() => import("./DocumentiOperativiPage"));

function useUnlinkedDocuments() {
  return useQuery({
    queryKey: ["unlinked-documents-count"],
    queryFn: async () => {
      const [ddtsRes, ordersRes, reportsRes] = await Promise.all([
        supabase
          .from("ddts")
          .select("id, ddt_number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false),
        supabase
          .from("sales_orders")
          .select("id, number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false),
        supabase
          .from("service_reports")
          .select("id, report_number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false)
          .eq("status", "completed"),
      ]);

      const ddts = ddtsRes.data || [];
      const orders = ordersRes.data || [];
      const reports = reportsRes.data || [];

      return {
        ddts,
        orders,
        reports,
        totalUnlinked: ddts.length + orders.length + reports.length,
      };
    },
  });
}

function UnlinkedDocumentsAlert() {
  const { data, isLoading } = useUnlinkedDocuments();
  const queryClient = useQueryClient();

  const dismissAll = useMutation({
    mutationFn: async () => {
      if (!data) return;
      
      if (data.ddts.length > 0) {
        const ddtIds = data.ddts.map((d: any) => d.id);
        for (const id of ddtIds) {
          await supabase.from("ddts").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
      if (data.orders.length > 0) {
        const orderIds = data.orders.map((o: any) => o.id);
        for (const id of orderIds) {
          await supabase.from("sales_orders").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
      if (data.reports.length > 0) {
        const reportIds = data.reports.map((r: any) => r.id);
        for (const id of reportIds) {
          await supabase.from("service_reports").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents-count"] });
      toast.success("Tutti i documenti segnati come non contabilizzati");
    },
  });

  if (isLoading || !data || data.totalUnlinked === 0) return null;

  return (
    <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        {data.totalUnlinked} document{data.totalUnlinked > 1 ? "i" : "o"} non collegat{data.totalUnlinked > 1 ? "i" : "o"} a registrazioni contabili
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400">
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {data.ddts.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.ddts.length} DDT</Badge>
          )}
          {data.orders.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.orders.length} Ordini</Badge>
          )}
          {data.reports.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.reports.length} Rapporti</Badge>
          )}
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissAll.mutate()}
            disabled={dismissAll.isPending}
            className="text-amber-700 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
          >
            {dismissAll.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <XCircle className="h-3 w-3 mr-1.5" />
            )}
            Segna tutti come non contabilizzati
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

interface UploadQueueItem {
  file: File;
  status: "pending" | "uploading" | "analyzing" | "saving" | "done" | "error";
  error?: string;
  ddtNumber?: string;
}

function InlineDdtUploadZone() {
  const queryClient = useQueryClient();
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showQueue, setShowQueue] = useState(true);

  const { data: customers = [] } = useQuery({
    queryKey: ["customers-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("customers").select("id, name, company_name, tax_id, code");
      return data || [];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers-lookup"],
    queryFn: async () => {
      const { data } = await supabase.from("suppliers").select("id, name, tax_id, code");
      return data || [];
    },
  });

  const processSingleFile = useCallback(async (file: File, index: number) => {
    const updateStatus = (status: UploadQueueItem["status"], extra?: Partial<UploadQueueItem>) => {
      setUploadQueue(prev => prev.map((item, i) => i === index ? { ...item, status, ...extra } : item));
    };

    try {
      updateStatus("uploading");
      const fileName = `ddt_${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(fileName, file);
      if (uploadError) throw new Error("Upload fallito: " + uploadError.message);

      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(fileName);

      updateStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-ddt", {
        body: { imageUrl: urlData.publicUrl, direction: "auto" },
      });

      if (aiError || !aiResult?.success) {
        throw new Error(aiResult?.error || "Analisi AI fallita");
      }

      const extracted = aiResult.data;
      updateStatus("saving");

      let customerId: string | null = null;
      let supplierId: string | null = null;
      let direction = extracted.ddt_tipo === "fornitore" ? "inbound" : "outbound";

      if (direction === "outbound" && extracted.destinatario_name) {
        const matches = findSimilarSubjects(
          extracted.destinatario_name,
          customers.map(c => ({ id: c.id, name: c.company_name || c.name, code: c.code, tax_id: c.tax_id })),
          0.6
        );
        if (extracted.destinatario_vat) {
          const vatMatch = customers.find(c => c.tax_id && c.tax_id === extracted.destinatario_vat);
          if (vatMatch) customerId = vatMatch.id;
        }
        if (!customerId && matches.length > 0) customerId = matches[0].id;
        if (!customerId) {
          const { data: newCust } = await supabase.from("customers").insert({
            name: extracted.destinatario_name,
            company_name: extracted.destinatario_name,
            code: `AUTO-${Date.now().toString().slice(-6)}`,
            tax_id: extracted.destinatario_vat || null,
            address: extracted.destinatario_address || null,
            incomplete_registry: true,
          }).select("id").single();
          if (newCust) customerId = newCust.id;
        }
      } else if (direction === "inbound" && extracted.intestazione_name) {
        const matches = findSimilarSubjects(
          extracted.intestazione_name,
          suppliers.map(s => ({ id: s.id, name: s.name, code: s.code, tax_id: s.tax_id })),
          0.6
        );
        if (extracted.intestazione_vat) {
          const vatMatch = suppliers.find(s => s.tax_id && s.tax_id === extracted.intestazione_vat);
          if (vatMatch) supplierId = vatMatch.id;
        }
        if (!supplierId && matches.length > 0) supplierId = matches[0].id;
        if (!supplierId) {
          const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
          const { data: newSup } = await supabase.from("suppliers").insert({
            name: extracted.intestazione_name,
            code: `AUTO-${Date.now().toString().slice(-6)}`,
            access_code: accessCode,
            tax_id: extracted.intestazione_vat || null,
            address: extracted.intestazione_address || null,
          }).select("id").single();
          if (newSup) supplierId = newSup.id;
        }
      }

      const ddtNumber = extracted.ddt_number || `DDT-${Date.now().toString().slice(-6)}`;
      const { error: insertError } = await supabase.from("ddts").insert({
        ddt_number: ddtNumber,
        direction,
        customer_id: customerId,
        supplier_id: supplierId,
        counterpart_type: direction === "inbound" ? "supplier" : "customer",
        document_date: extracted.ddt_date || new Date().toISOString().split("T")[0],
        attachment_url: urlData.publicUrl,
        ddt_data: {
          destinatario: extracted.destinatario_name,
          destinatario_address: extracted.destinatario_address,
          destinatario_vat: extracted.destinatario_vat,
          intestazione: extracted.intestazione_name,
          intestazione_address: extracted.intestazione_address,
          intestazione_vat: extracted.intestazione_vat,
          destinazione: extracted.destinazione_address,
          data: extracted.ddt_date,
          items: extracted.items || [],
        },
        notes: extracted.notes || null,
        status: "received",
      });

      if (insertError) throw new Error("Salvataggio fallito: " + insertError.message);
      updateStatus("done", { ddtNumber });
    } catch (err: any) {
      updateStatus("error", { error: err.message });
    }
  }, [customers, suppliers]);

  const handleFiles = useCallback(async (files: File[]) => {
    const queue: UploadQueueItem[] = files.map(f => ({ file: f, status: "pending" as const }));
    setUploadQueue(queue);
    setShowQueue(true);
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      await processSingleFile(files[i], i);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["doc-op-ddts"] });
    queryClient.invalidateQueries({ queryKey: ["doc-op-orders"] });
    queryClient.invalidateQueries({ queryKey: ["doc-op-reports"] });
    queryClient.invalidateQueries({ queryKey: ["customers-lookup"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers-lookup"] });
    toast.success(`Elaborazione completata per ${files.length} DDT`);
  }, [processSingleFile, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: { "image/*": [], "application/pdf": [] },
    disabled: isProcessing,
    multiple: true,
  });

  const doneCount = uploadQueue.filter(q => q.status === "done").length;
  const errorCount = uploadQueue.filter(q => q.status === "error").length;
  const progress = uploadQueue.length > 0 ? Math.round(((doneCount + errorCount) / uploadQueue.length) * 100) : 0;

  const statusIcons: Record<string, { label: string; color: string }> = {
    pending: { label: "In attesa", color: "text-muted-foreground" },
    uploading: { label: "Caricamento...", color: "text-blue-600" },
    analyzing: { label: "Analisi AI...", color: "text-violet-600" },
    saving: { label: "Salvataggio...", color: "text-amber-600" },
    done: { label: "Completato", color: "text-green-600" },
    error: { label: "Errore", color: "text-destructive" },
  };

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-300",
          isDragActive
            ? "border-primary bg-primary/5 scale-[1.005]"
            : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30",
          isProcessing && "opacity-60 pointer-events-none"
        )}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <Loader2 className="h-10 w-10 text-primary animate-spin" />
              <Sparkles className="h-4 w-4 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Analisi AI in corso...</p>
              <p className="text-xs text-muted-foreground mt-1">
                Estrazione dati DDT, riconoscimento cliente e salvataggio
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <Truck className={cn("h-8 w-8", isDragActive ? "text-primary" : "text-muted-foreground/50")} />
              <Upload className={cn("h-6 w-6", isDragActive ? "text-primary" : "text-muted-foreground/40")} />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {isDragActive ? "Rilascia i DDT qui" : "Trascina qui i DDT da importare"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                PDF o immagini • L'AI estrarrà automaticamente numero, cliente e righe
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" />
                Supporta caricamento multiplo
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Processing queue */}
      {uploadQueue.length > 0 && (
        <div className="border rounded-lg bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                Importazione DDT
              </span>
              <Badge variant="secondary" className="text-xs">
                {doneCount}/{uploadQueue.length}
              </Badge>
              {errorCount > 0 && (
                <Badge variant="destructive" className="text-xs">{errorCount} errori</Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowQueue(!showQueue)}>
                {showQueue ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
              {!isProcessing && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setUploadQueue([])}>
                  Chiudi
                </Button>
              )}
            </div>
          </div>

          <Progress value={progress} className="h-1.5" />

          {showQueue && (
            <ScrollArea className={uploadQueue.length > 4 ? "h-[200px]" : ""}>
              <div className="space-y-1.5">
                {uploadQueue.map((item, i) => {
                  const sc = statusIcons[item.status];
                  const isSpinning = ["uploading", "analyzing", "saving"].includes(item.status);
                  return (
                    <div key={i} className="flex items-center gap-2.5 p-2 rounded-md bg-muted/40">
                      {item.status === "done" ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      ) : item.status === "error" ? (
                        <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                      ) : isSpinning ? (
                        <Loader2 className={cn("h-4 w-4 flex-shrink-0 animate-spin", sc.color)} />
                      ) : (
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.file.name}</p>
                        <p className={cn("text-[11px]", sc.color)}>
                          {item.status === "done" && item.ddtNumber ? `DDT ${item.ddtNumber} salvato` : item.error || sc.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocumentiPage() {
  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documenti Operativi</h1>
          <p className="text-sm text-muted-foreground">
            DDT, Ordini, Offerte Accettate, Rapporti di Intervento e Giustificativi
          </p>
        </div>
      </div>

      {/* AI Drop Zone */}
      <InlineDdtUploadZone />

      <UnlinkedDocumentsAlert />

      <Suspense fallback={
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          </div>
        </div>
      }>
        <DocumentiOperativiPage />
      </Suspense>
    </div>
  );
}
