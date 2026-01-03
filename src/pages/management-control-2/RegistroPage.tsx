import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Upload, 
  Camera, 
  FileText, 
  Receipt, 
  CreditCard, 
  Wrench, 
  Truck, 
  ArrowUp, 
  ArrowDown,
  Loader2,
  CheckCircle,
  X,
  Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { format } from "date-fns";
import { it } from "date-fns/locale";

type FlowType = "rapporto" | "ddt" | "spesa" | "incasso" | null;

interface QuickEntryForm {
  importo: string;
  metodo_pagamento: string;
  soggetto_nome: string;
  riferimento: string;
  descrizione: string;
}

interface DdtScanForm {
  numero_ddt: string;
  data_ddt: string;
  fornitore: string;
  causale_trasporto: string;
  direzione: "entrata" | "uscita";
  note: string;
}

export default function RegistroPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeFlow, setActiveFlow] = useState<FlowType>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [showQuickEntryDialog, setShowQuickEntryDialog] = useState(false);
  const [showDdtScanDialog, setShowDdtScanDialog] = useState(false);
  const [ddtUploadedFile, setDdtUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [quickEntryType, setQuickEntryType] = useState<"entrata" | "uscita">("uscita");
  const [quickEntryForm, setQuickEntryForm] = useState<QuickEntryForm>({
    importo: "",
    metodo_pagamento: "cassa",
    soggetto_nome: "",
    riferimento: "",
    descrizione: "",
  });
  const [ddtScanForm, setDdtScanForm] = useState<DdtScanForm>({
    numero_ddt: "",
    data_ddt: new Date().toISOString().split("T")[0],
    fornitore: "",
    causale_trasporto: "",
    direzione: "entrata",
    note: "",
  });

  // Fetch my recent registrations
  const { data: myRegistrations = [], isLoading: loadingRegistrations } = useQuery({
    queryKey: ["my-registrations"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      
      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  // Create movimento mutation
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
      
      // Insert into movimenti_finanziari
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

      // Also create entry in accounting_entries for classification
      const { error: accError } = await supabase.from("accounting_entries").insert({
        direction: movimento.direzione,
        document_type: "movimento_finanziario",
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
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
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
    });
  };

  const handleFlowStart = (flow: FlowType) => {
    if (flow === "rapporto") {
      navigate("/support/service-reports");
    } else if (flow === "ddt") {
      setShowDdtScanDialog(true);
    } else if (flow === "spesa") {
      setQuickEntryType("uscita");
      setShowQuickEntryDialog(true);
    } else if (flow === "incasso") {
      setQuickEntryType("entrata");
      setShowQuickEntryDialog(true);
    }
  };

  // DDT upload and AI analysis
  const handleDdtFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `ddt-${Date.now()}.${fileExt}`;
      const filePath = `ddt-scans/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("accounting-attachments")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("accounting-attachments")
        .getPublicUrl(filePath);

      setDdtUploadedFile({ name: file.name, url: urlData.publicUrl });
      
      // AI Analysis for DDT
      setIsAnalyzing(true);
      try {
        let analysisUrl: string | null = urlData.publicUrl;
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          try {
            const pngBlob = await pdfFirstPageToPngBlob(file);
            const previewPath = `ddt-scans/${Date.now()}-preview.png`;
            await supabase.storage.from("accounting-attachments").upload(previewPath, pngBlob, { contentType: "image/png" });
            const { data: previewUrlData } = supabase.storage.from("accounting-attachments").getPublicUrl(previewPath);
            analysisUrl = previewUrlData.publicUrl;
          } catch {
            analysisUrl = null;
          }
        }

        if (analysisUrl) {
          const { data: analysisData } = await supabase.functions.invoke("analyze-document", {
            body: { imageUrl: analysisUrl, documentType: "ddt" },
          });

          if (analysisData?.success && analysisData?.data) {
            const extracted = analysisData.data;
            setDdtScanForm((prev) => ({
              ...prev,
              numero_ddt: extracted.document_number || prev.numero_ddt,
              data_ddt: extracted.document_date || prev.data_ddt,
              fornitore: extracted.supplier_name || prev.fornitore,
              causale_trasporto: extracted.transport_reason || prev.causale_trasporto,
              note: extracted.notes || prev.note,
            }));
            toast.success("DDT analizzato con AI!");
          }
        }
      } catch {
        toast.info("Compila manualmente i dati del DDT");
      } finally {
        setIsAnalyzing(false);
      }
    } catch {
      toast.error("Errore upload file DDT");
    } finally {
      setIsUploading(false);
    }
  };

  // Create DDT grezzo mutation
  const createDdtMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Generate DDT number if not provided
      const ddtNumber = ddtScanForm.numero_ddt || `SCAN-${Date.now()}`;
      
      const { error } = await supabase.from("ddts").insert({
        ddt_number: ddtNumber,
        ddt_data: {
          numero: ddtNumber,
          data: ddtScanForm.data_ddt,
          fornitore: ddtScanForm.fornitore,
          causale_trasporto: ddtScanForm.causale_trasporto,
          direzione: ddtScanForm.direzione,
          note: ddtScanForm.note,
          allegato_url: ddtUploadedFile?.url,
          allegato_nome: ddtUploadedFile?.name,
          stato: "grezzo",
          scansionato: true,
        },
        created_by: userData.user?.id,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ddts"] });
      toast.success("DDT grezzo creato con successo!");
      resetDdtScan();
    },
    onError: () => {
      toast.error("Errore durante la creazione del DDT");
    },
  });

  const resetDdtScan = () => {
    setShowDdtScanDialog(false);
    setDdtUploadedFile(null);
    setDdtScanForm({
      numero_ddt: "",
      data_ddt: new Date().toISOString().split("T")[0],
      fornitore: "",
      causale_trasporto: "",
      direzione: "entrata",
      note: "",
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

      setUploadedFile({ name: file.name, url: urlData.publicUrl });
      
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
            setQuickEntryForm((prev) => ({
              ...prev,
              importo: extracted.amount ? String(extracted.amount) : prev.importo,
              soggetto_nome: extracted.supplier_name || prev.soggetto_nome,
              descrizione: extracted.notes || prev.descrizione,
            }));
            toast.success("Documento analizzato!");
          }
        }
      } catch {
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
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  };

  return (
    <div className="px-4 py-4 sm:container sm:mx-auto sm:py-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Registro</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Registra rapidamente documenti operativi, spese e incassi
        </p>
      </div>

      {/* 4 Main Action Buttons - Mobile First Grid */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card 
          className="cursor-pointer hover:border-primary transition-colors group active:scale-[0.98]"
          onClick={() => handleFlowStart("rapporto")}
        >
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-blue-100 flex items-center justify-center mb-2 group-hover:bg-blue-200 transition-colors">
              <Wrench className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
            </div>
            <CardTitle className="text-sm sm:text-lg leading-tight">Genera Rapporto</CardTitle>
            <CardDescription className="text-xs sm:text-sm hidden sm:block">Crea un nuovo rapporto di intervento</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors group active:scale-[0.98]"
          onClick={() => handleFlowStart("ddt")}
        >
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-purple-100 flex items-center justify-center mb-2 group-hover:bg-purple-200 transition-colors">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
            </div>
            <CardTitle className="text-sm sm:text-lg leading-tight">Scansiona DDT</CardTitle>
            <CardDescription className="text-xs sm:text-sm hidden sm:block">Registra un documento di trasporto</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors group active:scale-[0.98]"
          onClick={() => handleFlowStart("spesa")}
        >
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-red-100 flex items-center justify-center mb-2 group-hover:bg-red-200 transition-colors">
              <Receipt className="h-5 w-5 sm:h-6 sm:w-6 text-red-600" />
            </div>
            <CardTitle className="text-sm sm:text-lg leading-tight">Spesa / Scontrino</CardTitle>
            <CardDescription className="text-xs sm:text-sm hidden sm:block">Registra una spesa o scontrino</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="cursor-pointer hover:border-primary transition-colors group active:scale-[0.98]"
          onClick={() => handleFlowStart("incasso")}
        >
          <CardHeader className="p-3 sm:p-6 pb-2 sm:pb-2">
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-green-100 flex items-center justify-center mb-2 group-hover:bg-green-200 transition-colors">
              <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
            </div>
            <CardTitle className="text-sm sm:text-lg leading-tight">Incasso / Pagamento</CardTitle>
            <CardDescription className="text-xs sm:text-sm hidden sm:block">Registra un incasso sul campo</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* AI Upload Zone - Mobile Optimized */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Upload className="h-4 w-4 sm:h-5 sm:w-5" />
            Carica documento con AI
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Trascina o scatta foto di un documento per la classificazione automatica
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          <div
            {...getRootProps()}
            className={cn(
              "border-2 border-dashed rounded-lg p-6 sm:p-8 text-center cursor-pointer transition-colors",
              isDragActive ? "border-primary bg-primary/5" : "hover:bg-accent/50"
            )}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 sm:h-10 sm:w-10 mx-auto mb-3 sm:mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-primary font-medium text-sm sm:text-base">Rilascia il file qui...</p>
            ) : (
              <div>
                <p className="text-muted-foreground text-sm sm:text-base">Trascina un documento o clicca per caricarlo</p>
                <p className="text-xs text-muted-foreground mt-1">L'AI riconoscerà automaticamente il tipo di documento</p>
              </div>
            )}
          </div>
          
          <div className="mt-3 sm:mt-4">
            <label className="block">
              <Button variant="outline" className="w-full h-12 sm:h-10 text-base sm:text-sm" asChild>
                <div className="cursor-pointer">
                  <Camera className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                  Scatta foto
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

      {/* My Registrations - Mobile Optimized */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Le mie registrazioni recenti</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {loadingRegistrations ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : myRegistrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna registrazione effettuata
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="sm:hidden space-y-3">
                {myRegistrations.map((reg: any) => (
                  <div key={reg.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {reg.direzione === "entrata" ? (
                          <ArrowUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={cn("font-medium", reg.direzione === "entrata" ? "text-green-600" : "text-red-600")}>
                          {formatCurrency(Number(reg.importo))}
                        </span>
                      </div>
                      <Badge variant={reg.stato === "contabilizzato" ? "default" : "secondary"} className="text-xs">
                        {reg.stato}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(reg.data_movimento), "dd/MM/yyyy", { locale: it })}</span>
                      <span className="capitalize">{reg.metodo_pagamento}</span>
                    </div>
                    {reg.soggetto_nome && (
                      <p className="text-xs text-muted-foreground truncate">{reg.soggetto_nome}</p>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Soggetto</TableHead>
                      <TableHead>Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRegistrations.map((reg: any) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          {format(new Date(reg.data_movimento), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {reg.direzione === "entrata" ? (
                              <ArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={reg.direzione === "entrata" ? "text-green-600" : "text-red-600"}>
                              {reg.direzione === "entrata" ? "Entrata" : "Uscita"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(Number(reg.importo))}
                        </TableCell>
                        <TableCell className="capitalize">{reg.metodo_pagamento}</TableCell>
                        <TableCell>{reg.soggetto_nome || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={reg.stato === "contabilizzato" ? "default" : "secondary"}>
                            {reg.stato}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Quick Entry Dialog - Mobile Optimized */}
      <Dialog open={showQuickEntryDialog} onOpenChange={setShowQuickEntryDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {quickEntryType === "uscita" ? (
                <>
                  <Receipt className="h-5 w-5 text-red-600" />
                  Registra Spesa / Scontrino
                </>
              ) : (
                <>
                  <CreditCard className="h-5 w-5 text-green-600" />
                  Registra Incasso
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* File upload area */}
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                uploadedFile && "border-green-500 bg-green-50"
              )}
            >
              <input {...getInputProps()} />
              {isUploading || isAnalyzing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{isAnalyzing ? "Analisi AI..." : "Caricamento..."}</span>
                </div>
              ) : uploadedFile ? (
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm truncate max-w-[200px]">{uploadedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Trascina documento o clicca per caricare
                  </p>
                </>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Importo *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="h-12 sm:h-10 text-base sm:text-sm"
                  value={quickEntryForm.importo}
                  onChange={(e) => setQuickEntryForm((prev) => ({ ...prev, importo: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Metodo pagamento *</Label>
                <Select
                  value={quickEntryForm.metodo_pagamento}
                  onValueChange={(value) => setQuickEntryForm((prev) => ({ ...prev, metodo_pagamento: value }))}
                >
                  <SelectTrigger className="h-12 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cassa">Contanti</SelectItem>
                    <SelectItem value="carta">Carta</SelectItem>
                    <SelectItem value="banca">Bonifico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Soggetto (opzionale)</Label>
              <Input
                placeholder="Nome cliente/fornitore"
                className="h-12 sm:h-10"
                value={quickEntryForm.soggetto_nome}
                onChange={(e) => setQuickEntryForm((prev) => ({ ...prev, soggetto_nome: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Riferimento (opzionale)</Label>
              <Input
                placeholder="Es. numero scontrino, CRO..."
                className="h-12 sm:h-10"
                value={quickEntryForm.riferimento}
                onChange={(e) => setQuickEntryForm((prev) => ({ ...prev, riferimento: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrizione (opzionale)</Label>
              <Textarea
                placeholder="Note aggiuntive..."
                value={quickEntryForm.descrizione}
                onChange={(e) => setQuickEntryForm((prev) => ({ ...prev, descrizione: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetQuickEntry} className="w-full sm:w-auto h-12 sm:h-10">
              Annulla
            </Button>
            <Button 
              onClick={handleQuickEntrySubmit} 
              disabled={createMovimentoMutation.isPending}
              className={cn(
                "w-full sm:w-auto h-12 sm:h-10",
                quickEntryType === "uscita" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              )}
            >
              {createMovimentoMutation.isPending ? "Salvataggio..." : "Registra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DDT Scan Dialog - Mobile Optimized */}
      <Dialog open={showDdtScanDialog} onOpenChange={setShowDdtScanDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-purple-600" />
              Scansiona DDT
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* DDT File upload area */}
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors hover:bg-accent/50",
                ddtUploadedFile && "border-green-500 bg-green-50"
              )}
              onClick={() => document.getElementById("ddt-file-input")?.click()}
            >
              {isUploading || isAnalyzing ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{isAnalyzing ? "Analisi AI..." : "Caricamento..."}</span>
                </div>
              ) : ddtUploadedFile ? (
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm truncate max-w-[200px]">{ddtUploadedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDdtUploadedFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Carica o scatta foto del DDT
                  </p>
                </>
              )}
              <input
                id="ddt-file-input"
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleDdtFileUpload(file);
                }}
              />
            </div>

            <div className="mt-2">
              <label className="block">
                <Button variant="outline" className="w-full h-12 sm:h-10" asChild>
                  <div className="cursor-pointer">
                    <Camera className="h-5 w-5 sm:h-4 sm:w-4 mr-2" />
                    Scatta foto DDT
                  </div>
                </Button>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleDdtFileUpload(file);
                  }}
                />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Direzione *</Label>
              <Select
                value={ddtScanForm.direzione}
                onValueChange={(value: "entrata" | "uscita") => setDdtScanForm((prev) => ({ ...prev, direzione: value }))}
              >
                <SelectTrigger className="h-12 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrata">
                    <div className="flex items-center gap-2">
                      <ArrowDown className="h-4 w-4 text-green-600" />
                      DDT Entrata (merce ricevuta)
                    </div>
                  </SelectItem>
                  <SelectItem value="uscita">
                    <div className="flex items-center gap-2">
                      <ArrowUp className="h-4 w-4 text-red-600" />
                      DDT Uscita (merce spedita)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Numero DDT</Label>
                <Input
                  placeholder="Es. 123/2025"
                  className="h-12 sm:h-10"
                  value={ddtScanForm.numero_ddt}
                  onChange={(e) => setDdtScanForm((prev) => ({ ...prev, numero_ddt: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data DDT</Label>
                <Input
                  type="date"
                  className="h-12 sm:h-10"
                  value={ddtScanForm.data_ddt}
                  onChange={(e) => setDdtScanForm((prev) => ({ ...prev, data_ddt: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fornitore / Destinatario</Label>
              <Input
                placeholder="Nome azienda"
                className="h-12 sm:h-10"
                value={ddtScanForm.fornitore}
                onChange={(e) => setDdtScanForm((prev) => ({ ...prev, fornitore: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Causale trasporto</Label>
              <Input
                placeholder="Es. Vendita, C/Visione, C/Lavorazione..."
                className="h-12 sm:h-10"
                value={ddtScanForm.causale_trasporto}
                onChange={(e) => setDdtScanForm((prev) => ({ ...prev, causale_trasporto: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Textarea
                placeholder="Note aggiuntive..."
                value={ddtScanForm.note}
                onChange={(e) => setDdtScanForm((prev) => ({ ...prev, note: e.target.value }))}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={resetDdtScan} className="w-full sm:w-auto h-12 sm:h-10">
              Annulla
            </Button>
            <Button 
              onClick={() => createDdtMutation.mutate()} 
              disabled={createDdtMutation.isPending}
              className="w-full sm:w-auto h-12 sm:h-10 bg-purple-600 hover:bg-purple-700"
            >
              {createDdtMutation.isPending ? "Salvataggio..." : "Crea DDT Grezzo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
