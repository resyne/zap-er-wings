import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Loader2, Search, Eye, Archive, FileText, CheckCircle2, AlertCircle, Truck } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { findSimilarSubjects } from "@/lib/fuzzyMatch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UploadQueueItem {
  file: File;
  status: "pending" | "uploading" | "analyzing" | "saving" | "done" | "error";
  error?: string;
  ddtNumber?: string;
}

export default function DdtSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);

  const { data: ddts = [], isLoading } = useQuery({
    queryKey: ["ddts-operativi", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("ddts")
        .select("id, ddt_number, ddt_data, customer_id, supplier_id, direction, document_date, status, archived, attachment_url, notes, created_at, counterpart_type")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

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
      // 1. Upload file
      updateStatus("uploading");
      const fileName = `ddt_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(fileName, file);
      if (uploadError) throw new Error("Upload fallito: " + uploadError.message);

      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      // 2. AI Analysis
      updateStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-ddt", {
        body: { imageUrl: fileUrl, direction: "auto" },
      });

      if (aiError || !aiResult?.success) {
        throw new Error(aiResult?.error || "Analisi AI fallita");
      }

      const extracted = aiResult.data;

      // 3. Find or create customer/supplier
      updateStatus("saving");
      let customerId: string | null = null;
      let supplierId: string | null = null;
      let direction = extracted.ddt_tipo === "fornitore" ? "inbound" : "outbound";

      if (direction === "outbound" && extracted.destinatario_name) {
        // Match customer
        const matches = findSimilarSubjects(
          extracted.destinatario_name,
          customers.map(c => ({ id: c.id, name: c.company_name || c.name, code: c.code, tax_id: c.tax_id })),
          0.6
        );

        if (extracted.destinatario_vat) {
          const vatMatch = customers.find(c => c.tax_id && c.tax_id === extracted.destinatario_vat);
          if (vatMatch) {
            customerId = vatMatch.id;
          }
        }

        if (!customerId && matches.length > 0) {
          customerId = matches[0].id;
        }

        if (!customerId) {
          const { data: newCust } = await supabase.from("customers").insert({
            name: extracted.destinatario_name,
            company_name: extracted.destinatario_name,
            tax_id: extracted.destinatario_vat || null,
            address: extracted.destinatario_address || null,
          }).select("id").single();
          if (newCust) customerId = newCust.id;
        }
      } else if (direction === "inbound" && extracted.intestazione_name) {
        // Match supplier
        const matches = findSimilarSubjects(
          extracted.intestazione_name,
          suppliers.map(s => ({ id: s.id, name: s.name, code: s.code, tax_id: s.tax_id })),
          0.6
        );

        if (extracted.intestazione_vat) {
          const vatMatch = suppliers.find(s => s.tax_id && s.tax_id === extracted.intestazione_vat);
          if (vatMatch) {
            supplierId = vatMatch.id;
          }
        }

        if (!supplierId && matches.length > 0) {
          supplierId = matches[0].id;
        }

        if (!supplierId) {
          const { data: newSup } = await supabase.from("suppliers").insert({
            name: extracted.intestazione_name,
            tax_id: extracted.intestazione_vat || null,
            address: extracted.intestazione_address || null,
          }).select("id").single();
          if (newSup) supplierId = newSup.id;
        }
      }

      // 4. Insert DDT
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

  const handleMultiFileUpload = useCallback(async (files: File[]) => {
    const queue: UploadQueueItem[] = files.map(f => ({ file: f, status: "pending" as const }));
    setUploadQueue(queue);
    setShowUploadProgress(true);

    for (let i = 0; i < files.length; i++) {
      await processSingleFile(files[i], i);
    }

    queryClient.invalidateQueries({ queryKey: ["ddts-operativi"] });
    queryClient.invalidateQueries({ queryKey: ["customers-lookup"] });
    queryClient.invalidateQueries({ queryKey: ["suppliers-lookup"] });
    toast.success(`Elaborazione completata per ${files.length} DDT`);
  }, [processSingleFile, queryClient]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { "application/pdf": [".pdf"], "image/*": [".png", ".jpg", ".jpeg"] },
    multiple: true,
    onDrop: handleMultiFileUpload,
  });

  const filteredDdts = ddts.filter(d => {
    if (!search) return true;
    const s = search.toLowerCase();
    const ddtData = d.ddt_data as any;
    return (
      d.ddt_number?.toLowerCase().includes(s) ||
      ddtData?.destinatario?.toLowerCase().includes(s) ||
      ddtData?.intestazione?.toLowerCase().includes(s)
    );
  });

  const completedCount = uploadQueue.filter(q => q.status === "done").length;
  const totalCount = uploadQueue.length;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const toggleArchive = async (id: string, current: boolean) => {
    await supabase.from("ddts").update({ archived: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["ddts-operativi"] });
    toast.success(current ? "DDT ripristinato" : "DDT archiviato");
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>DDT</CardTitle>
              <CardDescription>Documenti di trasporto — carica PDF per analisi automatica</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
                <Archive className="h-4 w-4 mr-1" /> {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isDragActive ? "Rilascia i file qui..." : "Trascina PDF dei DDT qui, oppure clicca per selezionare"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supporta più file contemporaneamente (PDF, immagini)</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca DDT..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredDdts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Truck className="h-8 w-8 mb-2" />
              <p>Nessun DDT trovato</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Direzione</TableHead>
                    <TableHead>Controparte</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Articoli</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDdts.map(ddt => {
                    const ddtData = ddt.ddt_data as any;
                    const itemCount = ddtData?.items?.length || 0;
                    const counterpart = ddt.direction === "inbound"
                      ? ddtData?.intestazione
                      : ddtData?.destinatario;

                    return (
                      <TableRow key={ddt.id} className={ddt.archived ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{ddt.ddt_number}</TableCell>
                        <TableCell>
                          <Badge variant={ddt.direction === "inbound" ? "secondary" : "default"}>
                            {ddt.direction === "inbound" ? "Entrata" : "Uscita"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{counterpart || "-"}</TableCell>
                        <TableCell>
                          {ddt.document_date
                            ? format(new Date(ddt.document_date), "dd/MM/yyyy", { locale: it })
                            : ddt.created_at
                            ? format(new Date(ddt.created_at), "dd/MM/yyyy", { locale: it })
                            : "-"}
                        </TableCell>
                        <TableCell>{itemCount > 0 ? `${itemCount} righe` : "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{ddt.status || "ricevuto"}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {ddt.attachment_url && (
                            <Button variant="ghost" size="icon" asChild>
                              <a href={ddt.attachment_url} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => toggleArchive(ddt.id, ddt.archived || false)}>
                            <Archive className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Upload Progress Dialog */}
      <Dialog open={showUploadProgress} onOpenChange={setShowUploadProgress}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Elaborazione DDT ({completedCount}/{totalCount})</DialogTitle>
          </DialogHeader>
          <Progress value={progressPercent} className="mb-4" />
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {uploadQueue.map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                  {item.status === "done" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : item.status === "error" ? (
                    <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                  ) : item.status === "pending" ? (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  )}
                  <span className="truncate flex-1">{item.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.status === "uploading" && "Caricamento..."}
                    {item.status === "analyzing" && "Analisi AI..."}
                    {item.status === "saving" && "Salvataggio..."}
                    {item.status === "done" && (item.ddtNumber || "✓")}
                    {item.status === "error" && item.error}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
