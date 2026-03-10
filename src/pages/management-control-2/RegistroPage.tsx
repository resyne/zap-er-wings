import { AIDocumentUpload } from "@/components/dashboard/AIDocumentUpload";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function RegistroPage() {

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
    if (flow === "spesa") {
      setQuickEntryType("uscita");
      setShowQuickEntryDialog(true);
    } else if (flow === "incasso") {
      setQuickEntryType("entrata");
      setShowQuickEntryDialog(true);
    }
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
            
            // Open expense/income dialog with extracted data
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
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* Giustificativi: Spesa, Incasso, AI Upload */}
      <AIDocumentUpload />

      {/* My Registrations */}
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

    </div>
  );
}
