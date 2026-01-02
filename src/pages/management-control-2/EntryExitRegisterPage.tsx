import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, Camera, ArrowUp, ArrowDown, FileCheck, Loader2, CheckCircle, X, Plus, Building2, UserCheck, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";

interface SupplierMatch {
  matched: boolean;
  supplier?: {
    id: string;
    name: string;
    code: string;
    tax_id: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
  };
  alternatives?: Array<{
    id: string;
    name: string;
    code: string;
    tax_id: string | null;
  }>;
  match_type?: string;
  suggested_supplier?: {
    name: string;
    tax_id: string;
    address: string;
    city: string;
    email: string;
    phone: string;
  };
}

const documentTypes = [
  { value: "fattura", label: "Fattura" },
  { value: "scontrino", label: "Scontrino / Ricevuta" },
  { value: "estratto_conto", label: "Estratto conto" },
  { value: "documento_interno", label: "Documento interno" },
  { value: "rapporto_intervento", label: "Rapporto di intervento" },
  { value: "altro", label: "Altro" },
];

const paymentMethods = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta" },
  { value: "bonifico", label: "Bonifico" },
  { value: "anticipo_personale", label: "Anticipo personale" },
  { value: "non_so", label: "Non so" },
];

const subjectTypes = [
  { value: "cliente", label: "Cliente" },
  { value: "fornitore", label: "Fornitore" },
  { value: "interno", label: "Interno" },
];

// Dropzone component for review step attachment
function ReviewDropzone({ onFileUpload, isUploading }: { onFileUpload: (file: File) => void; isUploading: boolean }) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) onFileUpload(file);
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
    },
    maxFiles: 1,
    noClick: false,
  });

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-1">
        Allegato <span className="text-destructive">*</span>
      </Label>
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragActive
            ? "border-primary bg-primary/5"
            : "hover:bg-accent/50"
        )}
      >
        <input {...getInputProps()} />
        <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
        {isDragActive ? (
          <p className="text-sm text-primary">Rilascia il file qui...</p>
        ) : (
          <p className="text-sm text-muted-foreground">Trascina o clicca per caricare</p>
        )}
      </div>
      <label className="block">
        <Button variant="outline" size="sm" className="w-full" asChild>
          <div className="cursor-pointer">
            <Camera className="h-4 w-4 mr-2" />
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
            if (file) onFileUpload(file);
          }}
        />
      </label>
      {isUploading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Caricamento...
        </div>
      )}
    </div>
  );
}

export default function EntryExitRegisterPage() {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"start" | "upload" | "review" | "success">("start");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [flowType, setFlowType] = useState<"document" | "manual">("document");
  
  // Supplier matching state
  const [supplierMatch, setSupplierMatch] = useState<SupplierMatch | null>(null);
  const [showSupplierDialog, setShowSupplierDialog] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [isCreatingSupplier, setIsCreatingSupplier] = useState(false);

  const [formData, setFormData] = useState({
    direction: "",
    document_type: "",
    amount: "",
    document_date: "",
    payment_method: "",
    subject_type: "",
    note: "",
    supplier_id: "",
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase.from("accounting_entries").insert({
        direction: formData.direction,
        document_type: formData.document_type,
        amount: parseFloat(formData.amount),
        document_date: formData.document_date,
        attachment_url: uploadedFile!.url,
        payment_method: formData.payment_method || null,
        subject_type: formData.subject_type || null,
        note: formData.note || null,
        status: "da_classificare",
        user_id: userData.user?.id,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      setStep("success");
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
      
      // AI analysis of the document
      setIsAnalyzing(true);

      try {
        let analysisUrl: string | null = urlData.publicUrl;
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          try {
            toast.info("PDF rilevato: genero un'anteprima per l'analisi AI…");
            const pngBlob = await pdfFirstPageToPngBlob(file);
            const previewPath = `uploads/${Date.now()}-preview.png`;

            const { error: previewUploadError } = await supabase.storage
              .from("accounting-attachments")
              .upload(previewPath, pngBlob, { contentType: "image/png" });

            if (previewUploadError) throw previewUploadError;

            const { data: previewUrlData } = supabase.storage
              .from("accounting-attachments")
              .getPublicUrl(previewPath);

            analysisUrl = previewUrlData.publicUrl;
          } catch (previewErr) {
            console.warn("PDF preview generation failed:", previewErr);
            analysisUrl = null;
            toast.error("Non riesco a leggere il PDF per l'analisi AI: compila i dati manualmente");
          }
        }

        if (!analysisUrl) {
          setFormData((prev) => ({
            ...prev,
            document_date: new Date().toISOString().split("T")[0],
          }));
          toast.info("Compila manualmente: anteprima PDF non disponibile");
        } else {
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
            "analyze-document",
            {
              body: { imageUrl: analysisUrl },
            }
          );

          if (analysisError) {
            console.error("Analysis error:", analysisError);
            setFormData((prev) => ({
              ...prev,
              document_date: prev.document_date || new Date().toISOString().split("T")[0],
            }));
            toast.error("Errore nell'analisi AI, compila i dati manualmente");
          } else if (analysisData?.success && analysisData?.data) {
            const extracted = analysisData.data;
            console.log("AI extracted data:", extracted);

            // Pre-fill form with extracted data
            setFormData((prev) => ({
              ...prev,
              direction: extracted.direction || prev.direction,
              document_type: extracted.document_type || prev.document_type,
              amount: extracted.amount ? String(extracted.amount) : prev.amount,
              document_date: extracted.document_date || new Date().toISOString().split("T")[0],
              payment_method: extracted.payment_method || prev.payment_method,
              subject_type: extracted.subject_type || prev.subject_type,
              note: extracted.notes || prev.note,
            }));

            // Handle supplier matching
            if (analysisData.supplier) {
              console.log("Supplier match data:", analysisData.supplier);
              setSupplierMatch(analysisData.supplier);

              if (analysisData.supplier.matched && analysisData.supplier.supplier) {
                // Auto-select matched supplier
                setSelectedSupplierId(analysisData.supplier.supplier.id);
                setFormData((prev) => ({
                  ...prev,
                  supplier_id: analysisData.supplier.supplier.id,
                  subject_type: "fornitore",
                }));
                toast.success(`Fornitore riconosciuto: ${analysisData.supplier.supplier.name}`);
              } else if (!analysisData.supplier.matched && analysisData.supplier.suggested_supplier) {
                // Show dialog to create new supplier
                setShowSupplierDialog(true);
              }
            }

            if (extracted.confidence === "high") {
              toast.success("Documento analizzato con successo!");
            } else if (extracted.confidence === "medium") {
              toast.info("Documento analizzato, verifica i dati estratti");
            } else {
              toast.info("Alcuni dati potrebbero essere incompleti, verifica attentamente");
            }
          } else {
            // Fallback to defaults
            setFormData((prev) => ({
              ...prev,
              document_date: new Date().toISOString().split("T")[0],
            }));
            toast.info("Non è stato possibile estrarre dati, compila manualmente");
          }
        }
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        // Fallback to defaults
        setFormData((prev) => ({
          ...prev,
          document_date: new Date().toISOString().split("T")[0],
        }));
        toast.error("Analisi AI non disponibile, compila i dati manualmente");
      } finally {
        setIsAnalyzing(false);
      }

      setStep("review");
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Errore durante il caricamento del file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleManualStart = (direction: "entrata" | "uscita") => {
    setFlowType("manual");
    setFormData((prev) => ({
      ...prev,
      direction,
      document_date: new Date().toISOString().split("T")[0],
    }));
    setStep("review");
  };

  const handleDocumentFlow = () => {
    setFlowType("document");
    setStep("upload");
  };

  const handleSubmit = () => {
    if (!formData.direction || !formData.document_type || !formData.amount || !formData.document_date) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }
    if (!uploadedFile) {
      toast.error("L'allegato è obbligatorio");
      return;
    }
    submitMutation.mutate();
  };

  const resetForm = () => {
    setStep("start");
    setFlowType("document");
    setUploadedFile(null);
    setSupplierMatch(null);
    setSelectedSupplierId(null);
    setFormData({
      direction: "",
      document_type: "",
      amount: "",
      document_date: "",
      payment_method: "",
      subject_type: "",
      note: "",
      supplier_id: "",
    });
  };

  // Create new supplier from AI-extracted data
  const handleCreateSupplier = async () => {
    if (!supplierMatch?.suggested_supplier) return;
    
    setIsCreatingSupplier(true);
    try {
      // Generate a unique code for the supplier
      const { data: lastSupplier } = await supabase
        .from("suppliers")
        .select("code")
        .order("code", { ascending: false })
        .limit(1)
        .single();
      
      let newCode = "F001";
      if (lastSupplier?.code) {
        const lastNum = parseInt(lastSupplier.code.replace(/\D/g, ""), 10);
        newCode = `F${String(lastNum + 1).padStart(3, "0")}`;
      }
      
      const suggested = supplierMatch.suggested_supplier;
      const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      const { data: newSupplier, error } = await supabase
        .from("suppliers")
        .insert({
          code: newCode,
          name: suggested.name,
          tax_id: suggested.tax_id || null,
          address: suggested.address || null,
          city: suggested.city || null,
          email: suggested.email || null,
          phone: suggested.phone || null,
          active: true,
          access_code: accessCode,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Update form with the new supplier
      setSelectedSupplierId(newSupplier.id);
      setFormData((prev) => ({
        ...prev,
        supplier_id: newSupplier.id,
        subject_type: "fornitore",
      }));
      
      // Update supplier match state to show as matched
      setSupplierMatch({
        matched: true,
        supplier: newSupplier,
        match_type: "created",
      });
      
      toast.success(`Fornitore "${suggested.name}" creato con successo!`);
      setShowSupplierDialog(false);
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (error) {
      console.error("Error creating supplier:", error);
      toast.error("Errore durante la creazione del fornitore");
    } finally {
      setIsCreatingSupplier(false);
    }
  };

  // Skip supplier creation and continue without linking
  const handleSkipSupplier = () => {
    setShowSupplierDialog(false);
    toast.info("Puoi collegare il fornitore in seguito durante la classificazione");
  };

  // Dropzone for upload step - MUST be at top level, before any conditional returns
  const onDropUpload = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) handleFileUpload(file);
  }, []);

  const {
    getRootProps: getUploadRootProps,
    getInputProps: getUploadInputProps,
    isDragActive: isUploadDragActive,
  } = useDropzone({
    onDrop: onDropUpload,
    accept: {
      "image/*": [],
      "application/pdf": [],
    },
    maxFiles: 1,
    noClick: false,
  });

  // Success screen
  if (step === "success") {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-16 w-16 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-bold mb-2">Registrazione completata!</h2>
            <p className="text-muted-foreground mb-6">
              L'evento è stato registrato e sarà classificato a breve.
            </p>
            <Button onClick={resetForm} className="w-full">
              Nuova Registrazione
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Start screen - choose flow
  if (step === "start") {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Nuova Registrazione</h1>
          <p className="text-muted-foreground">Scegli come registrare il movimento</p>
        </div>

        {/* Manual entry buttons */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center text-muted-foreground">Registrazione manuale</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 gap-3">
              <Button
                onClick={() => handleManualStart("entrata")}
                className="h-20 flex flex-col items-center gap-2 bg-green-600 hover:bg-green-700"
              >
                <ArrowUp className="h-8 w-8" />
                <span className="font-semibold">ENTRATA</span>
              </Button>
              <Button
                onClick={() => handleManualStart("uscita")}
                className="h-20 flex flex-col items-center gap-2 bg-red-600 hover:bg-red-700"
              >
                <ArrowDown className="h-8 w-8" />
                <span className="font-semibold">USCITA</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">oppure</span>
          </div>
        </div>

        {/* Document upload option with drag & drop */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center text-muted-foreground">Carica documento</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div
              {...getUploadRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isUploadDragActive
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent/50"
              )}
            >
              <input {...getUploadInputProps()} />
              <Upload className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              {isUploadDragActive ? (
                <p className="text-primary font-medium">Rilascia il file qui...</p>
              ) : (
                <>
                  <p className="font-medium mb-1">Trascina o clicca per caricare</p>
                  <p className="text-sm text-muted-foreground">PDF, foto o scansione</p>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">
              L'AI analizzerà il documento e precompilerà i campi
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Upload step
  if (step === "upload") {
    return (
      <div className="container mx-auto p-4 max-w-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold">Carica Documento</h1>
          <p className="text-muted-foreground">Carica il documento per l'analisi automatica</p>
        </div>

        <Card>
          <CardContent className="p-6">
            {isUploading || isAnalyzing ? (
              <div className="py-12 text-center">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-lg font-medium">
                  {isAnalyzing ? "Analisi documento in corso..." : "Caricamento..."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div
                  {...getUploadRootProps()}
                  className={cn(
                    "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                    isUploadDragActive
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent/50"
                  )}
                >
                  <input {...getUploadInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  {isUploadDragActive ? (
                    <p className="text-lg font-medium text-primary">Rilascia il file qui...</p>
                  ) : (
                    <>
                      <p className="text-lg font-medium mb-1">Trascina o clicca per caricare</p>
                      <p className="text-sm text-muted-foreground">PDF, foto o scansione</p>
                    </>
                  )}
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">oppure</span>
                  </div>
                </div>

                <label className="block">
                  <Button variant="outline" className="w-full h-14" asChild>
                    <div className="cursor-pointer">
                      <Camera className="h-5 w-5 mr-2" />
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

                <Button variant="ghost" onClick={() => setStep("start")} className="w-full">
                  Indietro
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Review step
  return (
    <div className="container mx-auto p-4 max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {flowType === "manual" ? "Inserisci Dati" : "Verifica e Completa"}
        </h1>
        <p className="text-muted-foreground">
          {flowType === "manual" ? "Compila tutti i campi obbligatori" : "Controlla i dati e inserisci quelli mancanti"}
        </p>
      </div>

      {/* Allegato section */}
      <Card className="mb-4">
        <CardContent className="p-4">
          {uploadedFile ? (
            <div className="flex items-center gap-3">
              <FileCheck className="h-8 w-8 text-green-500" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{uploadedFile.name}</p>
                <p className="text-sm text-green-600">Documento caricato</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUploadedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <ReviewDropzone 
              onFileUpload={handleFileUpload} 
              isUploading={isUploading} 
            />
          )}
        </CardContent>
      </Card>

      <Card>
        {/* Supplier Match Info */}
        {supplierMatch?.matched && supplierMatch.supplier && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-green-700">
              <UserCheck className="h-5 w-5" />
              <div>
                <p className="font-medium">Fornitore: {supplierMatch.supplier.name}</p>
                {supplierMatch.supplier.tax_id && (
                  <p className="text-sm text-green-600">P.IVA: {supplierMatch.supplier.tax_id}</p>
                )}
              </div>
            </div>
          </div>
        )}
        
        <CardHeader className="px-0 pt-0">
          <CardTitle className="text-lg">Dati Registrazione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-0">
          {/* Direzione */}
          <div className="space-y-2">
            <Label>Direzione *</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={formData.direction === "entrata" ? "default" : "outline"}
                className={formData.direction === "entrata" ? "bg-green-600 hover:bg-green-700" : ""}
                onClick={() => setFormData({ ...formData, direction: "entrata" })}
              >
                <ArrowUp className="h-4 w-4 mr-2" />
                Entrata
              </Button>
              <Button
                type="button"
                variant={formData.direction === "uscita" ? "default" : "outline"}
                className={formData.direction === "uscita" ? "bg-red-600 hover:bg-red-700" : ""}
                onClick={() => setFormData({ ...formData, direction: "uscita" })}
              >
                <ArrowDown className="h-4 w-4 mr-2" />
                Uscita
              </Button>
            </div>
          </div>

          {/* Tipo Documento */}
          <div className="space-y-2">
            <Label>Tipo Documento *</Label>
            <Select
              value={formData.document_type}
              onValueChange={(value) => setFormData({ ...formData, document_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Importo */}
          <div className="space-y-2">
            <Label>Importo Totale *</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              placeholder="0.00"
            />
          </div>

          {/* Data Documento */}
          <div className="space-y-2">
            <Label>Data Documento *</Label>
            <Input
              type="date"
              value={formData.document_date}
              onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
            />
          </div>

          {/* Campi opzionali */}
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">Campi opzionali</p>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Metodo di Pagamento</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentMethods.map((method) => (
                      <SelectItem key={method.value} value={method.value}>
                        {method.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Soggetto</Label>
                <Select
                  value={formData.subject_type}
                  onValueChange={(value) => setFormData({ ...formData, subject_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Nota</Label>
                <Textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value.slice(0, 140) })}
                  placeholder="Max 140 caratteri"
                  maxLength={140}
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">{formData.note.length}/140</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitMutation.isPending}
            className="w-full mt-4"
            size="lg"
          >
            {submitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registrazione...
              </>
            ) : (
              "Registra"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Supplier Match Dialog */}
      <Dialog open={showSupplierDialog} onOpenChange={setShowSupplierDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Nuovo Fornitore Rilevato
            </DialogTitle>
          </DialogHeader>
          
          {supplierMatch?.suggested_supplier && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                L'AI ha estratto i seguenti dati del fornitore dal documento. Vuoi creare un nuovo fornitore in anagrafica?
              </p>
              
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Nome:</span>
                  <span className="font-medium">{supplierMatch.suggested_supplier.name || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">P.IVA:</span>
                  <span className="font-medium">{supplierMatch.suggested_supplier.tax_id || "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Città:</span>
                  <span className="font-medium">{supplierMatch.suggested_supplier.city || "-"}</span>
                </div>
                {supplierMatch.suggested_supplier.email && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Email:</span>
                    <span className="font-medium">{supplierMatch.suggested_supplier.email}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleSkipSupplier}>
              Salta
            </Button>
            <Button onClick={handleCreateSupplier} disabled={isCreatingSupplier}>
              {isCreatingSupplier ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Crea Fornitore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
