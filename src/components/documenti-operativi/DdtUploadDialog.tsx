import { useState, useCallback } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, Loader2, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { findSimilarSubjects } from "@/lib/fuzzyMatch";
import { cn } from "@/lib/utils";

interface UploadQueueItem {
  file: File;
  status: "pending" | "uploading" | "analyzing" | "saving" | "done" | "error";
  error?: string;
  ddtNumber?: string;
}

interface DdtUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function DdtUploadDialog({ open, onOpenChange, onComplete }: DdtUploadDialogProps) {
  const queryClient = useQueryClient();
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
      const fileUrl = urlData.publicUrl;

      updateStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-ddt", {
        body: { imageUrl: fileUrl, direction: "auto" },
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
        attachment_url: fileUrl,
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
    setIsProcessing(true);

    for (let i = 0; i < files.length; i++) {
      await processSingleFile(files[i], i);
    }

    setIsProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["doc-op-ddts"] });
    queryClient.invalidateQueries({ queryKey: ["customers-lookup"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers-lookup"] });
    onComplete();
    toast.success(`Elaborazione completata per ${files.length} DDT`);
  }, [processSingleFile, queryClient, onComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFiles,
    accept: { "image/*": [], "application/pdf": [] },
    disabled: isProcessing,
    multiple: true,
  });

  const doneCount = uploadQueue.filter(q => q.status === "done").length;
  const errorCount = uploadQueue.filter(q => q.status === "error").length;
  const progress = uploadQueue.length > 0 ? Math.round(((doneCount + errorCount) / uploadQueue.length) * 100) : 0;

  const statusConfig: Record<string, { label: string; icon: typeof Loader2; color: string }> = {
    pending: { label: "In attesa", icon: FileText, color: "text-muted-foreground" },
    uploading: { label: "Caricamento...", icon: Loader2, color: "text-blue-600" },
    analyzing: { label: "Analisi AI...", icon: Loader2, color: "text-violet-600" },
    saving: { label: "Salvataggio...", icon: Loader2, color: "text-amber-600" },
    done: { label: "Completato", icon: CheckCircle2, color: "text-green-600" },
    error: { label: "Errore", icon: AlertCircle, color: "text-destructive" },
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!isProcessing) onOpenChange(o); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Importa DDT con AI
          </DialogTitle>
        </DialogHeader>

        {uploadQueue.length === 0 ? (
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all",
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Trascina qui i DDT</p>
            <p className="text-sm text-muted-foreground mt-1">PDF o immagini • L'AI estrarrà automaticamente i dati</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progresso</span>
                <span className="font-medium">{doneCount + errorCount}/{uploadQueue.length}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {uploadQueue.map((item, i) => {
                  const sc = statusConfig[item.status];
                  const Icon = sc.icon;
                  const isSpinning = ["uploading", "analyzing", "saving"].includes(item.status);
                  return (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                      <Icon className={cn("h-4 w-4 flex-shrink-0", sc.color, isSpinning && "animate-spin")} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.file.name}</p>
                        <p className={cn("text-xs", sc.color)}>
                          {item.status === "done" && item.ddtNumber ? `DDT ${item.ddtNumber} salvato` : item.error || sc.label}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {!isProcessing && (
              <Button variant="outline" className="w-full" onClick={() => { setUploadQueue([]); onOpenChange(false); }}>
                Chiudi
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
