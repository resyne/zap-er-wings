import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, Camera, Loader2, Receipt, CreditCard } from "lucide-react";
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

  const handleFlowStart = (flow: "spesa" | "incasso") => {
    setQuickEntryType(flow === "spesa" ? "uscita" : "entrata");
    setShowQuickEntryDialog(true);
  };

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Registra movimento</h3>
            <p className="text-xs text-muted-foreground">Segnala una spesa o un incasso, oppure carica un documento per l'analisi automatica</p>
          </div>
          {/* Compact action row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => handleFlowStart("spesa")}
            >
              <Receipt className="h-4 w-4 text-destructive" />
              Spesa
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-9"
              onClick={() => handleFlowStart("incasso")}
            >
              <CreditCard className="h-4 w-4 text-green-600" />
              Incasso
            </Button>

            <div className="h-5 w-px bg-border hidden sm:block" />

            {/* Inline dropzone */}
            {(isUploading || isAnalyzing) ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                {isAnalyzing ? "Analisi AI..." : "Caricamento..."}
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "flex-1 min-w-[200px] border border-dashed rounded-md px-4 py-2 text-center cursor-pointer transition-colors text-sm",
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary hover:bg-accent/50"
                )}
              >
                <input {...getInputProps()} />
                <span className="text-muted-foreground flex items-center justify-center gap-2">
                  <Upload className="h-4 w-4" />
                  {isDragActive ? "Rilascia qui..." : "Trascina documento o clicca"}
                </span>
              </div>
            )}

            <label className="block sm:hidden">
              <Button variant="ghost" size="sm" className="gap-2 h-9" asChild>
                <div className="cursor-pointer">
                  <Camera className="h-4 w-4" />
                  Foto
                </div>
              </Button>
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
        </CardContent>
      </Card>

      {/* Quick Entry Dialog */}
      <Dialog open={showQuickEntryDialog} onOpenChange={(open) => { if (!open) resetQuickEntry(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {quickEntryType === "uscita" ? "Registra Spesa" : "Registra Incasso"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {uploadedFile && (
              <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                📎 {uploadedFile.name}
              </div>
            )}
            <div>
              <Label>Importo (€) *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={quickEntryForm.importo}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, importo: e.target.value }))}
              />
            </div>
            <div>
              <Label>Metodo di pagamento *</Label>
              <Select
                value={quickEntryForm.metodo_pagamento}
                onValueChange={(v) => setQuickEntryForm(f => ({ ...f, metodo_pagamento: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cassa">Contanti</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="banca">Bonifico</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Soggetto</Label>
              <Input
                placeholder="Nome fornitore / cliente"
                value={quickEntryForm.soggetto_nome}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, soggetto_nome: e.target.value }))}
              />
            </div>
            <div>
              <Label>Riferimento</Label>
              <Input
                placeholder="N. scontrino / fattura"
                value={quickEntryForm.riferimento}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, riferimento: e.target.value }))}
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea
                placeholder="Note aggiuntive"
                value={quickEntryForm.descrizione}
                onChange={(e) => setQuickEntryForm(f => ({ ...f, descrizione: e.target.value }))}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
              <div>
                <Label className="text-sm font-medium">In attesa fattura</Label>
                <p className="text-xs text-muted-foreground">
                  Es. carta carburante Q8, carta aziendale — la fattura arriva dopo
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
