import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Camera, ArrowUp, ArrowDown, FileCheck, Loader2, CheckCircle, X, Plus } from "lucide-react";

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

export default function EntryExitRegisterPage() {
  const [step, setStep] = useState<"start" | "upload" | "review" | "success">("start");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [flowType, setFlowType] = useState<"document" | "manual">("document");

  const [formData, setFormData] = useState({
    direction: "",
    document_type: "",
    amount: "",
    document_date: "",
    payment_method: "",
    subject_type: "",
    note: "",
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
      
      // Simulate AI analysis
      setIsAnalyzing(true);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Auto-fill with simulated AI data
      const today = new Date().toISOString().split("T")[0];
      setFormData((prev) => ({
        ...prev,
        document_date: today,
        document_type: file.name.toLowerCase().includes("fattura") ? "fattura" : "",
      }));
      
      setIsAnalyzing(false);
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
    setFormData({
      direction: "",
      document_type: "",
      amount: "",
      document_date: "",
      payment_method: "",
      subject_type: "",
      note: "",
    });
  };

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

        {/* Document upload option */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-center text-muted-foreground">Carica documento</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <Button
              variant="outline"
              onClick={handleDocumentFlow}
              className="w-full h-16 flex items-center justify-center gap-3"
            >
              <Upload className="h-6 w-6" />
              <span>Carica PDF, foto o scansione</span>
            </Button>
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
                <label className="block">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-accent/50 transition-colors">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-lg font-medium mb-1">Carica documento</p>
                    <p className="text-sm text-muted-foreground">PDF, foto o scansione</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </label>

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
            <div className="space-y-3">
              <Label className="flex items-center gap-1">
                Allegato <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <label className="flex-1">
                  <Button variant="outline" className="w-full" asChild>
                    <div className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Carica file
                    </div>
                  </Button>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                  />
                </label>
                <label>
                  <Button variant="outline" asChild>
                    <div className="cursor-pointer">
                      <Camera className="h-4 w-4" />
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
              {isUploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Caricamento...
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Dati Registrazione</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
    </div>
  );
}
