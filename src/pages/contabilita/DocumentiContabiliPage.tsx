import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  FileText, Receipt, CreditCard, Upload, Loader2, CheckCircle2, 
  XCircle, AlertCircle, Building2, Eye, Sparkles, Paperclip 
} from "lucide-react";
import { DocumentAttachmentsPanel } from "@/components/contabilita/DocumentAttachments";

interface AccountingDocument {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  net_amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  total_amount: number | null;
  customer_id: string | null;
  counterpart_name: string | null;
  counterpart_vat: string | null;
  status: string;
  ai_confidence: number | null;
  created_at: string;
}

function useAccountingDocuments(type?: string) {
  return useQuery({
    queryKey: ["accounting-documents", type],
    queryFn: async () => {
      let q = supabase
        .from("accounting_documents")
        .select("*")
        .order("created_at", { ascending: false });
      if (type) q = q.eq("document_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data as AccountingDocument[];
    },
  });
}

function DocumentUploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
  const { user } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingFile, setProcessingFile] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (!user) {
      toast.error("Devi essere autenticato per caricare documenti");
      return;
    }

    for (const file of acceptedFiles) {
      setIsProcessing(true);
      setProcessingFile(file.name);

      try {
        // 1. Upload to Supabase Storage
        const filePath = `${user.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("accounting-documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // 2. Get public URL
        const { data: urlData } = supabase.storage
          .from("accounting-documents")
          .getPublicUrl(filePath);

        // For private buckets, create a signed URL
        const { data: signedData } = await supabase.storage
          .from("accounting-documents")
          .createSignedUrl(filePath, 3600); // 1 hour

        const fileUrl = signedData?.signedUrl || urlData.publicUrl;

        // 3. Call AI analysis edge function
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          "analyze-accounting-document",
          {
            body: {
              fileUrl,
              fileName: file.name,
              fileType: file.type,
              userId: user.id,
            },
          }
        );

        if (fnError) throw fnError;

        if (fnData?.customerCreated) {
          toast.success(`Nuovo cliente creato: ${fnData.extracted?.counterpart_name}`);
        }

        toast.success(
          `Documento "${file.name}" analizzato con successo! Tipo: ${
            fnData?.extracted?.document_type === "fattura_vendita" ? "Fattura Vendita" :
            fnData?.extracted?.document_type === "fattura_acquisto" ? "Fattura Acquisto" :
            "Nota di Credito"
          }`,
          { duration: 5000 }
        );

        onUploadComplete();
      } catch (err: any) {
        console.error("Upload/analysis error:", err);
        toast.error(`Errore nell'analisi di "${file.name}": ${err.message || "Errore sconosciuto"}`);
      } finally {
        setIsProcessing(false);
        setProcessingFile(null);
      }
    }
  }, [user, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "text/xml": [".xml"],
      "application/xml": [".xml"],
    },
    disabled: isProcessing,
    maxSize: 20 * 1024 * 1024, // 20MB
  });

  return (
    <div
      {...getRootProps()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
        ${isDragActive 
          ? "border-primary bg-primary/5 scale-[1.01]" 
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
        }
        ${isProcessing ? "opacity-60 pointer-events-none" : ""}
      `}
    >
      <input {...getInputProps()} />
      {isProcessing ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
          </div>
          <div>
            <p className="text-lg font-semibold text-foreground">Analisi AI in corso...</p>
            <p className="text-sm text-muted-foreground mt-1">"{processingFile}"</p>
            <p className="text-xs text-muted-foreground mt-2">
              Estrazione dati, classificazione e riconoscimento cliente
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Upload className={`h-12 w-12 ${isDragActive ? "text-primary" : "text-muted-foreground/50"}`} />
          <div>
            <p className="text-lg font-semibold text-foreground">
              {isDragActive ? "Rilascia il documento qui" : "Trascina un documento contabile"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, JPEG, PNG o XML (Fattura elettronica) — Max 20MB
            </p>
            <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Sparkles className="h-3 w-3" />
              L'AI riconoscerà automaticamente tipo, importi e cliente
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTable({ documents, isLoading }: { documents?: AccountingDocument[]; isLoading: boolean }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!documents?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
        <FileText className="h-8 w-8 mb-2 opacity-40" />
        <p>Nessun documento caricato</p>
      </div>
    );
  }

  const typeIcon = (type: string) => {
    switch (type) {
      case "fattura_vendita": return <Receipt className="h-4 w-4 text-green-600" />;
      case "fattura_acquisto": return <FileText className="h-4 w-4 text-blue-600" />;
      case "nota_credito": return <CreditCard className="h-4 w-4 text-orange-600" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const typeLabel = (type: string) => {
    switch (type) {
      case "fattura_vendita": return "Vendita";
      case "fattura_acquisto": return "Acquisto";
      case "nota_credito": return "Nota Credito";
      default: return type;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pending": return <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50"><AlertCircle className="h-3 w-3 mr-1" />Da confermare</Badge>;
      case "confirmed": return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50"><CheckCircle2 className="h-3 w-3 mr-1" />Confermato</Badge>;
      case "rejected": return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50"><XCircle className="h-3 w-3 mr-1" />Rifiutato</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30">
            <TableHead>Tipo</TableHead>
            <TableHead>N. Fattura</TableHead>
            <TableHead>Data</TableHead>
            <TableHead>Cliente/Fornitore</TableHead>
            <TableHead>P.IVA</TableHead>
            <TableHead className="text-right">Totale</TableHead>
            <TableHead>Confidenza</TableHead>
            <TableHead>Stato</TableHead>
            <TableHead>Azioni</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((doc) => (
            <TableRow key={doc.id} className="hover:bg-muted/20">
              <TableCell>
                <div className="flex items-center gap-2">
                  {typeIcon(doc.document_type)}
                  <span className="text-xs font-medium">{typeLabel(doc.document_type)}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-sm">{doc.invoice_number || "-"}</TableCell>
              <TableCell className="text-sm">
                {doc.invoice_date ? format(new Date(doc.invoice_date), "dd/MM/yyyy", { locale: it }) : "-"}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  {doc.customer_id && <Building2 className="h-3 w-3 text-green-500" />}
                  <span className="text-sm">{doc.counterpart_name || "-"}</span>
                </div>
              </TableCell>
              <TableCell className="font-mono text-xs">{doc.counterpart_vat || "-"}</TableCell>
              <TableCell className="text-right font-semibold">
                {doc.total_amount != null ? `€ ${doc.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "-"}
              </TableCell>
              <TableCell>
                {doc.ai_confidence != null && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${
                      doc.ai_confidence >= 0.8 ? "bg-green-500" : 
                      doc.ai_confidence >= 0.5 ? "bg-amber-500" : "bg-red-500"
                    }`} />
                    <span className="text-xs">{Math.round(doc.ai_confidence * 100)}%</span>
                  </div>
                )}
              </TableCell>
              <TableCell>{statusBadge(doc.status)}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4" />
                  </a>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function DocumentiContabiliPage() {
  const [activeTab, setActiveTab] = useState("tutti");
  const queryClient = useQueryClient();

  const typeFilter = activeTab === "tutti" ? undefined : activeTab;
  const { data: documents, isLoading } = useAccountingDocuments(typeFilter);

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["accounting-documents"] });
  };

  const counts = {
    tutti: documents?.length || 0,
    fattura_vendita: documents?.filter(d => d.document_type === "fattura_vendita").length || 0,
    fattura_acquisto: documents?.filter(d => d.document_type === "fattura_acquisto").length || 0,
    nota_credito: documents?.filter(d => d.document_type === "nota_credito").length || 0,
  };

  // For "tutti" tab, get all docs (not filtered)
  const { data: allDocs, isLoading: allLoading } = useAccountingDocuments();

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-[1600px]">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documenti Contabili</h1>
          <p className="text-muted-foreground">
            Carica fatture e documenti — l'AI li analizza e classifica automaticamente
          </p>
        </div>
      </div>

      {/* Upload Zone */}
      <DocumentUploadZone onUploadComplete={handleUploadComplete} />

      {/* Documents List */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="tutti" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Tutti
            {(allDocs?.length || 0) > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{allDocs?.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="fattura_vendita" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Vendita
          </TabsTrigger>
          <TabsTrigger value="fattura_acquisto" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Acquisto
          </TabsTrigger>
          <TabsTrigger value="nota_credito" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Note Credito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tutti" className="mt-0">
          <DocumentsTable documents={allDocs} isLoading={allLoading} />
        </TabsContent>
        <TabsContent value="fattura_vendita" className="mt-0">
          <DocumentsTable documents={documents} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="fattura_acquisto" className="mt-0">
          <DocumentsTable documents={documents} isLoading={isLoading} />
        </TabsContent>
        <TabsContent value="nota_credito" className="mt-0">
          <DocumentsTable documents={documents} isLoading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
