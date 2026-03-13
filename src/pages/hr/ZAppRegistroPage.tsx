import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  Camera,
  Loader2,
  CheckCircle,
  X,
  ImageIcon,
  Send,
  Wallet,
  Clock as ClockIcon,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";

type EntryType = "uscita" | "entrata";

export default function ZAppRegistroPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [step, setStep] = useState<"choose" | "form" | "rimborsi">("choose");
  const [entryType, setEntryType] = useState<EntryType>("uscita");
  const [importo, setImporto] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Query rimborsi dipendente
  const { data: rimborsi = [] } = useQuery({
    queryKey: ["rimborsi-dipendente", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .eq("created_by", user.id)
        .eq("metodo_pagamento", "anticipo_dipendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      direzione: EntryType;
      importo: number;
      descrizione: string;
      allegato_url?: string;
      allegato_nome?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];

      const { error: movError } = await supabase.from("movimenti_finanziari").insert({
        data_movimento: today,
        direzione: data.direzione,
        importo: data.importo,
        metodo_pagamento: "cassa" as "banca" | "cassa" | "carta",
        descrizione: data.descrizione || null,
        allegato_url: data.allegato_url || null,
        allegato_nome: data.allegato_nome || null,
        stato: "da_classificare",
        created_by: userData.user?.id,
      });
      if (movError) throw movError;

      const { error: accError } = await supabase.from("accounting_entries").insert({
        direction: data.direzione,
        document_type: "scontrino",
        amount: data.importo,
        document_date: today,
        attachment_url: data.allegato_url || "",
        note: data.descrizione || null,
        status: "da_classificare",
        user_id: userData.user?.id,
      });
      if (accError) throw accError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapp-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
      setSubmitted(true);
    },
    onError: () => {
      toast.error("Errore durante la registrazione");
    },
  });

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

      setUploadedFile({ name: file.name, url: urlData.publicUrl });

      // Try AI analysis
      setIsAnalyzing(true);
      try {
        let analysisUrl: string | null = urlData.publicUrl;
        const isPdf = file.type === "application/pdf";
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
            const ext = analysisData.data;
            if (ext.amount) setImporto(String(ext.amount));
            if (ext.notes) setDescrizione(ext.notes);
            if (ext.direction === "entrata") setEntryType("entrata");
            toast.success("Documento analizzato!");
          }
        }
      } catch {
        // Continue without AI
      } finally {
        setIsAnalyzing(false);
      }

      toast.success("Foto caricata");
    } catch {
      toast.error("Errore nel caricamento");
    } finally {
      setIsUploading(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) handleFileUpload(file);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    noClick: false,
    noKeyboard: true,
  });

  const handleSubmit = () => {
    const amount = parseFloat(importo);
    if (!amount || amount <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }
    createMutation.mutate({
      direzione: entryType,
      importo: amount,
      descrizione,
      allegato_url: uploadedFile?.url,
      allegato_nome: uploadedFile?.name,
    });
  };

  const resetAll = () => {
    setStep("choose");
    setImporto("");
    setDescrizione("");
    setUploadedFile(null);
    setSubmitted(false);
  };

  const selectType = (type: EntryType) => {
    setEntryType(type);
    setStep("form");
  };

  const isSpesa = entryType === "uscita";
  const accentColor = isSpesa ? "red" : "emerald";

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-700 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className={cn(
            "h-20 w-20 rounded-full flex items-center justify-center mb-6",
            isSpesa ? "bg-red-100" : "bg-emerald-100"
          )}>
            <CheckCircle className={cn("h-10 w-10", isSpesa ? "text-red-600" : "text-emerald-600")} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {isSpesa ? "Spesa registrata!" : "Incasso registrato!"}
          </h2>
          <p className="text-indigo-200 text-sm mb-8">
            Il movimento è stato inviato e sarà classificato dall'amministrazione.
          </p>
          <div className="flex gap-3 w-full max-w-xs">
            <Button
              variant="outline"
              className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={resetAll}
            >
              Nuovo movimento
            </Button>
            <Button
              className="flex-1 bg-white text-indigo-700 hover:bg-white/90"
              onClick={() => navigate("/hr/z-app")}
            >
              Torna a Z-APP
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-700 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button
          onClick={() => step === "form" ? setStep("choose") : navigate("/hr/z-app")}
          className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <h1 className="text-lg font-bold text-white">
          {step === "choose" ? "Segnala movimento" : isSpesa ? "Registra Spesa" : "Registra Incasso"}
        </h1>
      </div>

      {/* STEP 1: Choose type */}
      {step === "choose" && (
        <div className="flex-1 flex flex-col px-5 pt-6">
          <p className="text-indigo-200 text-sm text-center mb-8">
            Cosa vuoi segnalare?
          </p>

          <div className="space-y-4 max-w-sm mx-auto w-full">
            {/* Spesa button */}
            <button
              onClick={() => selectType("uscita")}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-lg active:scale-[0.97] transition-transform"
            >
              <div className="h-14 w-14 rounded-2xl bg-red-100 flex items-center justify-center shrink-0">
                <ArrowDownLeft className="h-7 w-7 text-red-600" />
              </div>
              <div className="text-left">
                <span className="text-lg font-bold text-foreground">Spesa</span>
                <p className="text-xs text-muted-foreground mt-0.5">Scontrini, carburante, materiale, pranzi...</p>
              </div>
            </button>

            {/* Incasso button */}
            <button
              onClick={() => selectType("entrata")}
              className="w-full flex items-center gap-4 p-5 bg-white rounded-2xl shadow-lg active:scale-[0.97] transition-transform"
            >
              <div className="h-14 w-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0">
                <ArrowUpRight className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="text-left">
                <span className="text-lg font-bold text-foreground">Incasso</span>
                <p className="text-xs text-muted-foreground mt-0.5">Pagamenti ricevuti, contanti, assegni...</p>
              </div>
            </button>
          </div>

          {/* Photo shortcut */}
          <div className="mt-8 max-w-sm mx-auto w-full">
            <p className="text-indigo-200 text-xs text-center mb-3">oppure scatta direttamente una foto</p>
            <label className="block">
              <div className="flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-dashed border-white/30 bg-white/5 cursor-pointer active:bg-white/10 transition-colors">
                {isUploading || isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">
                      {isAnalyzing ? "Analisi AI..." : "Caricamento..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Camera className="h-5 w-5 text-white" />
                    <span className="text-white text-sm font-medium">📸 Scatta foto scontrino</span>
                  </>
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setEntryType("uscita");
                    setStep("form");
                    handleFileUpload(file);
                  }
                }}
              />
            </label>
          </div>
        </div>
      )}

      {/* STEP 2: Form */}
      {step === "form" && (
        <div className="flex-1 flex flex-col px-5 pt-2 pb-6">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden max-w-sm mx-auto w-full">
            {/* Type toggle */}
            <div className="flex border-b">
              <button
                onClick={() => setEntryType("uscita")}
                className={cn(
                  "flex-1 py-3 text-sm font-bold transition-colors",
                  isSpesa ? "bg-red-600 text-white" : "bg-muted/30 text-muted-foreground"
                )}
              >
                ↓ Spesa
              </button>
              <button
                onClick={() => setEntryType("entrata")}
                className={cn(
                  "flex-1 py-3 text-sm font-bold transition-colors",
                  !isSpesa ? "bg-emerald-600 text-white" : "bg-muted/30 text-muted-foreground"
                )}
              >
                ↑ Incasso
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Amount — BIG */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Importo *</Label>
                <div className="relative mt-1.5">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-bold text-muted-foreground/40">€</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={importo}
                    onChange={(e) => setImporto(e.target.value)}
                    placeholder="0,00"
                    className="pl-14 h-16 text-3xl font-bold tabular-nums border-2 focus:border-primary text-center"
                    autoFocus
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Descrizione <span className="normal-case font-normal">(opzionale)</span></Label>
                <Textarea
                  value={descrizione}
                  onChange={(e) => setDescrizione(e.target.value)}
                  placeholder="Es: Gasolio furgone, pranzo cantiere..."
                  rows={2}
                  className="mt-1.5 resize-none"
                />
              </div>

              {/* Photo attachment */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Foto / Allegato</Label>
                <div className="mt-1.5">
                  {uploadedFile ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{uploadedFile.name}</span>
                      <button onClick={() => setUploadedFile(null)} className="p-1">
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {/* Camera */}
                      <label className="block">
                        <div className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors">
                          {isUploading || isAnalyzing ? (
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          ) : (
                            <Camera className="h-5 w-5 text-muted-foreground" />
                          )}
                          <span className="text-[11px] font-medium text-muted-foreground">
                            {isAnalyzing ? "Analisi..." : "Scatta foto"}
                          </span>
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

                      {/* Gallery / File */}
                      <div
                        {...getRootProps()}
                        className="flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 border-dashed cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
                      >
                        <input {...getInputProps()} />
                        <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[11px] font-medium text-muted-foreground">Galleria</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="px-5 pb-5">
              <Button
                onClick={handleSubmit}
                disabled={!importo || parseFloat(importo) <= 0 || createMutation.isPending}
                className={cn(
                  "w-full h-14 text-base font-bold rounded-xl gap-2 shadow-md text-white",
                  isSpesa
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {createMutation.isPending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    {isSpesa ? "Invia Spesa" : "Invia Incasso"}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
