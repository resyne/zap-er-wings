import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Receipt,
  CreditCard,
  Upload,
  Camera,
  Loader2,
  CheckCircle,
  X,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface QuickEntryForm {
  importo: string;
  metodo_pagamento: string;
  soggetto_nome: string;
  riferimento: string;
  descrizione: string;
}

export default function ZAppRegistroPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"tutti" | "entrate" | "uscite">("tutti");
  const [showEntryDialog, setShowEntryDialog] = useState(false);
  const [entryType, setEntryType] = useState<"entrata" | "uscita">("uscita");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [form, setForm] = useState<QuickEntryForm>({
    importo: "",
    metodo_pagamento: "cassa",
    soggetto_nome: "",
    riferimento: "",
    descrizione: "",
  });

  // Fetch registrations (same table as RegistroPage)
  const { data: registrations = [], isLoading } = useQuery({
    queryKey: ["zapp-registrations"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  // Create movimento mutation (same as RegistroPage)
  const createMutation = useMutation({
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

      const { error: accError } = await supabase.from("accounting_entries").insert({
        direction: movimento.direzione,
        document_type: "scontrino",
        amount: movimento.importo,
        document_date: today,
        attachment_url: movimento.allegato_url || "",
        payment_method: movimento.metodo_pagamento,
        subject_type: null,
        note: movimento.soggetto_nome
          ? `Soggetto: ${movimento.soggetto_nome}${movimento.descrizione ? ` - ${movimento.descrizione}` : ""}`
          : movimento.descrizione || null,
        status: "da_classificare",
        user_id: userData.user?.id,
      });

      if (accError) throw accError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapp-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      toast.success("Movimento registrato!");
      resetForm();
    },
    onError: () => {
      toast.error("Errore durante la registrazione");
    },
  });

  const resetForm = () => {
    setShowEntryDialog(false);
    setUploadedFile(null);
    setForm({
      importo: "",
      metodo_pagamento: "cassa",
      soggetto_nome: "",
      riferimento: "",
      descrizione: "",
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

      // AI Analysis
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
            setEntryType(isEntrata ? "entrata" : "uscita");
            setForm({
              importo: extracted.amount ? String(extracted.amount) : "",
              metodo_pagamento: extracted.payment_method === "contanti" ? "cassa" :
                extracted.payment_method === "carta" ? "carta" :
                  extracted.payment_method === "bonifico" ? "banca" : "cassa",
              soggetto_nome: extracted.supplier_name || "",
              riferimento: extracted.document_number || "",
              descrizione: extracted.notes || "",
            });
            setShowEntryDialog(true);
            toast.success("Documento analizzato con AI!");
          } else {
            setUploadedFile(uploadedFileData);
            setShowEntryDialog(true);
            toast.info("Compila manualmente i dati");
          }
        } else {
          setUploadedFile(uploadedFileData);
          setShowEntryDialog(true);
          toast.info("Compila manualmente i dati");
        }
      } catch {
        setUploadedFile(uploadedFileData);
        setShowEntryDialog(true);
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

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    noClick: false,
  });

  const handleSubmit = () => {
    if (!form.importo || parseFloat(form.importo) <= 0) {
      toast.error("Inserisci un importo valido");
      return;
    }

    createMutation.mutate({
      direzione: entryType,
      importo: parseFloat(form.importo),
      metodo_pagamento: form.metodo_pagamento,
      soggetto_nome: form.soggetto_nome || undefined,
      riferimento: form.riferimento || undefined,
      descrizione: form.descrizione || undefined,
      allegato_url: uploadedFile?.url,
      allegato_nome: uploadedFile?.name,
    });
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);

  const filtered = registrations.filter((r: any) => {
    if (activeTab === "entrate") return r.direzione === "entrata";
    if (activeTab === "uscite") return r.direzione === "uscita";
    return true;
  });

  const totaleEntrate = registrations
    .filter((r: any) => r.direzione === "entrata")
    .reduce((sum: number, r: any) => sum + Number(r.importo), 0);
  const totaleUscite = registrations
    .filter((r: any) => r.direzione === "uscita")
    .reduce((sum: number, r: any) => sum + Number(r.importo), 0);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/hr/z-app")} className="p-1 -ml-1">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Registro Incasso/Spese</h1>
            <p className="text-green-100 text-xs">Gestisci movimenti finanziari</p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 p-4">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-1">
            <ArrowUp className="h-4 w-4 text-green-600" />
            <span className="text-xs text-muted-foreground">Incassi</span>
          </div>
          <p className="text-lg font-bold text-green-600">{formatCurrency(totaleEntrate)}</p>
        </div>
        <div className="bg-white rounded-xl p-3 shadow-sm border border-border">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown className="h-4 w-4 text-red-600" />
            <span className="text-xs text-muted-foreground">Spese</span>
          </div>
          <p className="text-lg font-bold text-red-600">{formatCurrency(totaleUscite)}</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => { setEntryType("entrata"); setShowEntryDialog(true); }}
          className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl active:scale-95 transition-transform"
        >
          <div className="h-10 w-10 rounded-xl bg-green-500 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-sm text-green-800">Incasso</span>
        </button>
        <button
          onClick={() => { setEntryType("uscita"); setShowEntryDialog(true); }}
          className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl active:scale-95 transition-transform"
        >
          <div className="h-10 w-10 rounded-xl bg-red-500 flex items-center justify-center">
            <Receipt className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-sm text-red-800">Spesa</span>
        </button>
      </div>

      {/* AI Upload */}
      <div className="px-4 mt-3">
        <div
          {...getRootProps()}
          className="border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors hover:bg-accent/50 bg-white"
        >
          <input {...getInputProps()} />
          {isUploading || isAnalyzing ? (
            <div className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">{isAnalyzing ? "Analisi AI..." : "Caricamento..."}</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Carica documento o scatta foto</span>
            </div>
          )}
        </div>
        <label className="block mt-2">
          <Button variant="outline" className="w-full h-11" asChild>
            <div className="cursor-pointer">
              <Camera className="h-4 w-4 mr-2" />
              Scatta foto scontrino
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

      {/* Filter Tabs */}
      <div className="flex gap-2 px-4 mt-4">
        {(["tutti", "entrate", "uscite"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            {tab === "tutti" ? "Tutti" : tab === "entrate" ? "Entrate" : "Uscite"}
          </button>
        ))}
      </div>

      {/* Movement List */}
      <div className="p-4 space-y-2 pb-24">
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Caricamento...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Nessun movimento trovato</div>
        ) : (
          filtered.map((reg: any) => (
            <div key={reg.id} className="bg-white rounded-xl p-3 shadow-sm border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {reg.direzione === "entrata" ? (
                    <div className="h-8 w-8 rounded-lg bg-green-100 flex items-center justify-center">
                      <ArrowUp className="h-4 w-4 text-green-600" />
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-lg bg-red-100 flex items-center justify-center">
                      <ArrowDown className="h-4 w-4 text-red-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium truncate max-w-[180px]">
                      {reg.soggetto_nome || reg.descrizione || (reg.direzione === "entrata" ? "Incasso" : "Spesa")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(reg.data_movimento), "dd MMM yyyy", { locale: it })} · {reg.metodo_pagamento}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn(
                    "font-semibold text-sm",
                    reg.direzione === "entrata" ? "text-green-600" : "text-red-600"
                  )}>
                    {reg.direzione === "entrata" ? "+" : "-"}{formatCurrency(Number(reg.importo))}
                  </p>
                  <Badge variant={reg.stato === "contabilizzato" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                    {reg.stato === "contabilizzato" ? "Registrato" : "Da classificare"}
                  </Badge>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-20 flex flex-col gap-2">
        <Button
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg bg-primary"
          onClick={() => { setEntryType("uscita"); setShowEntryDialog(true); }}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Entry Dialog */}
      <Dialog open={showEntryDialog} onOpenChange={setShowEntryDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {entryType === "uscita" ? (
                <>
                  <Receipt className="h-5 w-5 text-red-600" />
                  Registra Spesa
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 text-green-600" />
                  Registra Incasso
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {/* Toggle entrata/uscita */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setEntryType("entrata")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                entryType === "entrata" ? "bg-green-600 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              Incasso
            </button>
            <button
              onClick={() => setEntryType("uscita")}
              className={cn(
                "flex-1 py-2.5 text-sm font-medium transition-colors",
                entryType === "uscita" ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
              )}
            >
              Spesa
            </button>
          </div>

          <div className="space-y-4">
            {/* File upload */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                uploadedFile ? "border-green-500 bg-green-50" : "hover:bg-accent/50"
              )}
            >
              <input {...getInputProps()} />
              {uploadedFile ? (
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm truncate max-w-[200px]">{uploadedFile.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setUploadedFile(null); }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Allega documento</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Importo *</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                className="h-12 text-lg"
                value={form.importo}
                onChange={(e) => setForm((prev) => ({ ...prev, importo: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Metodo pagamento *</Label>
              <Select
                value={form.metodo_pagamento}
                onValueChange={(value) => setForm((prev) => ({ ...prev, metodo_pagamento: value }))}
              >
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cassa">Contanti</SelectItem>
                  <SelectItem value="carta">Carta</SelectItem>
                  <SelectItem value="banca">Bonifico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Soggetto</Label>
              <Input
                placeholder="Nome cliente/fornitore"
                className="h-12"
                value={form.soggetto_nome}
                onChange={(e) => setForm((prev) => ({ ...prev, soggetto_nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Riferimento</Label>
              <Input
                placeholder="Es. numero scontrino"
                className="h-12"
                value={form.riferimento}
                onChange={(e) => setForm((prev) => ({ ...prev, riferimento: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                placeholder="Note..."
                value={form.descrizione}
                onChange={(e) => setForm((prev) => ({ ...prev, descrizione: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-2">
            <Button variant="outline" onClick={resetForm} className="w-full h-12">
              Annulla
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              className={cn(
                "w-full h-12",
                entryType === "uscita" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              )}
            >
              {createMutation.isPending ? "Salvataggio..." : "Registra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
