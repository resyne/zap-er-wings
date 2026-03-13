import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Camera, Loader2, Receipt, CreditCard, ArrowDownLeft, ArrowUpRight, Banknote, Wallet, ScanLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { toast } from "sonner";

interface QuickEntryForm {
  importo: string;
  metodo_pagamento: string;
  soggetto_nome: string;
  riferimento: string;
  descrizione: string;
  in_attesa_fattura: boolean;
}

export function AIDocumentUpload() {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [showQuickEntryDialog, setShowQuickEntryDialog] = useState(false);
  const [quickEntryType, setQuickEntryType] = useState<"entrata" | "uscita">("uscita");
  const [quickEntryForm, setQuickEntryForm] = useState<QuickEntryForm>({
    importo: "",
    metodo_pagamento: "cassa",
    soggetto_nome: "",
    riferimento: "",
    descrizione: "",
    in_attesa_fattura: false,
  });

  const createMovimentoMutation = useMutation({
    mutationFn: async (movimento: {
      direzione: "entrata" | "uscita";
      importo: number;
      metodo_pagamento: string;
      soggetto_nome?: string;
      riferimento?: string;
      descrizione?: string;
      allegato_url?: string;
      allegato_nome?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];

      const { error: movError } = await supabase.from("movimenti_finanziari").insert({
        data_movimento: today,
        direzione: movimento.direzione,
        importo: movimento.importo,
        metodo_pagamento: movimento.metodo_pagamento as "banca" | "cassa" | "carta",
        soggetto_nome: movimento.soggetto_nome || null,
        riferimento: movimento.riferimento || null,
        descrizione: movimento.descrizione || null,
        allegato_url: movimento.allegato_url || null,
        allegato_nome: movimento.allegato_nome || null,
        stato: "da_classificare",
        created_by: userData.user?.id,
      });
      if (movError) throw movError;

      const isPreMovement = (movimento as any).in_attesa_fattura === true;
      const { error: accError } = await supabase.from("accounting_entries").insert({
        direction: movimento.direzione,
        document_type: "scontrino",
        amount: movimento.importo,
        document_date: today,
        attachment_url: movimento.allegato_url || "",
        payment_method: movimento.metodo_pagamento,
        note: movimento.soggetto_nome
          ? `Soggetto: ${movimento.soggetto_nome}${movimento.descrizione ? ` - ${movimento.descrizione}` : ""}`
          : movimento.descrizione || null,
        status: isPreMovement ? "da_classificare" : "da_classificare",
        pre_movement_status: isPreMovement ? "in_attesa_fattura" : null,
        user_id: userData.user?.id,
      } as any);
      if (accError) throw accError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["pre-movements"] });
      toast.success("Movimento registrato con successo!");
      resetQuickEntry();
    },
    onError: () => {
      toast.error("Errore durante la registrazione");
    },
  });

  const resetQuickEntry = () => {
    setShowQuickEntryDialog(false);
    setUploadedFile(null);
    setQuickEntryForm({
      importo: "",
      metodo_pagamento: "cassa",
      soggetto_nome: "",
      riferimento: "",
      descrizione: "",
      in_attesa_fattura: false,
    });
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `uploads/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("accounting-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("accounting-attachments")
        .getPublicUrl(filePath);

      const uploadedFileData = { name: file.name, url: urlData.publicUrl };

      setIsAnalyzing(true);
      try {
        let analysisUrl: string | null = urlData.publicUrl;
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          try {
            const pngBlob = await pdfFirstPageToPngBlob(file);
            const previewPath = `uploads/${Date.now()}-preview.png`;
            await supabase.storage.from("accounting-attachments").upload(previewPath, pngBlob, { contentType: "image/png" });
            const { data: previewUrlData } = supabase.storage.from("accounting-attachments").getPublicUrl(previewPath);
            analysisUrl = previewUrlData.publicUrl;
          } catch {
            analysisUrl = null;
          }
        }

        if (analysisUrl) {
          const { data: analysisData } = await supabase.functions.invoke("analyze-document", {
            body: { imageUrl: analysisUrl },
          });

          if (analysisData?.success && analysisData?.data) {
            const extracted = analysisData.data;
            setUploadedFile(uploadedFileData);
            const isEntrata = extracted.direction === "entrata";
            setQuickEntryType(isEntrata ? "entrata" : "uscita");
            setQuickEntryForm({
              importo: extracted.amount ? String(extracted.amount) : "",
              metodo_pagamento: extracted.payment_method === "contanti" ? "cassa" :
                extracted.payment_method === "carta" ? "carta" :
                  extracted.payment_method === "bonifico" ? "banca" : "cassa",
              soggetto_nome: extracted.supplier_name || "",
              riferimento: extracted.document_number || "",
              descrizione: extracted.notes || "",
              in_attesa_fattura: false,
            });
            setShowQuickEntryDialog(true);
            toast.success("Documento riconosciuto e dati estratti!");
          } else {
            setUploadedFile(uploadedFileData);
            setShowQuickEntryDialog(true);
            toast.info("Compila manualmente i dati");
          }
        } else {
          setUploadedFile(uploadedFileData);
          setShowQuickEntryDialog(true);
          toast.info("Compila manualmente i dati");
        }
      } catch {
        setUploadedFile(uploadedFileData);
        setShowQuickEntryDialog(true);
        toast.info("Compila manualmente i dati");
      } finally {
        setIsAnalyzing(false);
      }
    } catch {
      toast.error("Errore upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) handleFileUpload(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    noClick: false,
  });

  const handleFlowStart = (flow: "spesa" | "incasso") => {
    setQuickEntryType(flow === "spesa" ? "uscita" : "entrata");
    setShowQuickEntryDialog(true);
  };

  const handleQuickEntrySubmit = () => {
    if (!quickEntryForm.importo || parseFloat(quickEntryForm.importo) <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    if (!quickEntryForm.metodo_pagamento) {
      toast.error("Seleziona il metodo di pagamento");
      return;
    }

    createMovimentoMutation.mutate({
      direzione: quickEntryType,
      importo: parseFloat(quickEntryForm.importo),
      metodo_pagamento: quickEntryForm.metodo_pagamento,
      soggetto_nome: quickEntryForm.soggetto_nome || undefined,
      riferimento: quickEntryForm.riferimento || undefined,
      descrizione: quickEntryForm.descrizione || undefined,
      allegato_url: uploadedFile?.url,
      allegato_nome: uploadedFile?.name,
      in_attesa_fattura: quickEntryForm.in_attesa_fattura,
    } as any);
  };

  return (
    <>
      {/* === HERO REGISTRATION SECTION === */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/10 p-1">
        <div className="rounded-xl bg-background/80 backdrop-blur-sm p-4 md:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-foreground tracking-tight">Registra movimento</h3>
              <p className="text-xs text-muted-foreground">Segnala spesa o incasso • Scansiona documento per analisi AI</p>
            </div>
          </div>

          {/* Action buttons — large, touch-friendly */}
          <div className="grid grid-cols-2 gap-3">
            {/* SPESA button */}
            <button
              onClick={() => handleFlowStart("spesa")}
              className="group relative flex flex-col items-center gap-2 rounded-xl border-2 border-red-200 dark:border-red-900/50 bg-gradient-to-b from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-950/10 p-4 md:p-5 hover:border-red-400 hover:shadow-md active:scale-[0.97] transition-all duration-200"
            >
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center group-hover:bg-red-200 dark:group-hover:bg-red-800/40 transition-colors">
                <ArrowDownLeft className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <span className="font-semibold text-sm text-red-700 dark:text-red-400">Registra Spesa</span>
              <span className="text-[10px] text-red-600/60 dark:text-red-400/60 hidden sm:block">Fornitore, scontrino, acquisto</span>
            </button>

            {/* INCASSO button */}
            <button
              onClick={() => handleFlowStart("incasso")}
              className="group relative flex flex-col items-center gap-2 rounded-xl border-2 border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-b from-emerald-50 to-emerald-100/50 dark:from-emerald-950/30 dark:to-emerald-950/10 p-4 md:p-5 hover:border-emerald-400 hover:shadow-md active:scale-[0.97] transition-all duration-200"
            >
              <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800/40 transition-colors">
                <ArrowUpRight className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className="font-semibold text-sm text-emerald-700 dark:text-emerald-400">Registra Incasso</span>
              <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/60 hidden sm:block">Cliente, pagamento ricevuto</span>
            </button>
          </div>

          {/* Upload / Scan zone */}
          {(isUploading || isAnalyzing) ? (
            <div className="flex items-center justify-center gap-3 p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm font-medium text-primary">
                {isAnalyzing ? "Analisi AI in corso..." : "Caricamento documento..."}
              </span>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={cn(
                "relative flex items-center gap-3 p-3 md:p-4 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200",
                isDragActive
                  ? "border-primary bg-primary/10 shadow-inner"
                  : "border-muted-foreground/20 hover:border-primary/50 hover:bg-accent/30"
              )}
            >
              <input {...getInputProps()} />
              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ScanLine className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {isDragActive ? "Rilascia il documento qui..." : "Scansiona o carica documento"}
                </p>
                <p className="text-xs text-muted-foreground hidden sm:block">
                  Trascina qui fattura, scontrino o ricevuta — l'AI estrarrà i dati
                </p>
              </div>
              <Upload className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
            </div>
          )}

          {/* Mobile camera button */}
          <label className="block sm:hidden">
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl border border-muted bg-muted/30 active:bg-muted/60 transition-colors cursor-pointer">
              <Camera className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Scatta foto al documento</span>
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </label>
        </div>
      </div>

      {/* Quick Entry Dialog */}
      <Dialog open={showQuickEntryDialog} onOpenChange={(open) => { if (!open) resetQuickEntry(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {quickEntryType === "uscita" ? (
                <>
                  <div className="h-8 w-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                    <ArrowDownLeft className="h-4 w-4 text-red-600" />
                  </div>
                  Registra Spesa
                </>
              ) : (
                <>
                  <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  </div>
                  Registra Incasso
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadedFile && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded-lg flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{uploadedFile.name}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Importo (€) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="text-lg font-semibold h-12"
                  value={quickEntryForm.importo}
                  onChange={(e) => setQuickEntryForm(f => ({ ...f, importo: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Pagamento *</Label>
                <Select
                  value={quickEntryForm.metodo_pagamento}
                  onValueChange={(v) => setQuickEntryForm(f => ({ ...f, metodo_pagamento: v }))}
                >
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cassa">🪙 Contanti</SelectItem>
                    <SelectItem value="carta">💳 Carta</SelectItem>
                    <SelectItem value="banca">🏦 Bonifico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Soggetto</Label>
              <Input
                placeholder="Nome fornitore / cliente"
                value={quickEntryForm.soggetto_nome}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, soggetto_nome: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Riferimento</Label>
              <Input
                placeholder="N. scontrino / fattura"
                value={quickEntryForm.riferimento}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, riferimento: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrizione</Label>
              <Textarea
                placeholder="Note aggiuntive"
                value={quickEntryForm.descrizione}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, descrizione: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/50">
              <div>
                <Label className="text-sm font-medium">In attesa fattura</Label>
                <p className="text-xs text-muted-foreground">
                  Carta carburante, abbonamento — la fattura arriva dopo
                </p>
              </div>
              <Switch
                checked={quickEntryForm.in_attesa_fattura}
                onCheckedChange={(checked) => setQuickEntryForm(f => ({ ...f, in_attesa_fattura: checked }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetQuickEntry}>Annulla</Button>
            <Button
              onClick={handleQuickEntrySubmit}
              disabled={createMovimentoMutation.isPending}
              className={cn(
                "min-w-[120px]",
                quickEntryType === "uscita"
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {createMovimentoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Registra
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
