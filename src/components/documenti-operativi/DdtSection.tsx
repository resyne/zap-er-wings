import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Upload, Loader2, Search, Eye, Archive, FileText, CheckCircle2, AlertCircle, Truck, Camera, MoreHorizontal, LinkIcon, AlertTriangle, FileCheck } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { findSimilarSubjects } from "@/lib/fuzzyMatch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LinkAccountingDocDialog } from "./LinkAccountingDocDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; ddtId: string; ddtLabel: string; currentLinkedId: string | null }>({
    open: false, ddtId: "", ddtLabel: "", currentLinkedId: null
  });
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
      updateStatus("uploading");
      const fileName = `ddt_${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("document-attachments")
        .upload(fileName, file);
      if (uploadError) throw new Error("Upload fallito: " + uploadError.message);

      const { data: urlData } = supabase.storage.from("document-attachments").getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      updateStatus("analyzing");
      const { data: aiResult, error: aiError } = await supabase.functions.invoke("analyze-ddt", {
        body: { imageUrl: fileUrl, direction: "auto" },
      });

      if (aiError || !aiResult?.success) {
        throw new Error(aiResult?.error || "Analisi AI fallita");
      }

      const extracted = aiResult.data;

      updateStatus("saving");
      let customerId: string | null = null;
      let supplierId: string | null = null;
      let direction = extracted.ddt_tipo === "fornitore" ? "inbound" : "outbound";

      if (direction === "outbound" && extracted.destinatario_name) {
        const matches = findSimilarSubjects(
          extracted.destinatario_name,
          customers.map(c => ({ id: c.id, name: c.company_name || c.name, code: c.code, tax_id: c.tax_id })),
          0.6
        );

        if (extracted.destinatario_vat) {
          const vatMatch = customers.find(c => c.tax_id && c.tax_id === extracted.destinatario_vat);
          if (vatMatch) customerId = vatMatch.id;
        }

        if (!customerId && matches.length > 0) customerId = matches[0].id;

        if (!customerId) {
          const tempCode = `AUTO-${Date.now().toString().slice(-6)}`;
          const { data: newCust } = await supabase.from("customers").insert({
            name: extracted.destinatario_name,
            company_name: extracted.destinatario_name,
            code: tempCode,
            tax_id: extracted.destinatario_vat || null,
            address: extracted.destinatario_address || null,
            incomplete_registry: true,
          }).select("id").single();
          if (newCust) customerId = newCust.id;
        }
      } else if (direction === "inbound" && extracted.intestazione_name) {
        const matches = findSimilarSubjects(
          extracted.intestazione_name,
          suppliers.map(s => ({ id: s.id, name: s.name, code: s.code, tax_id: s.tax_id })),
          0.6
        );

        if (extracted.intestazione_vat) {
          const vatMatch = suppliers.find(s => s.tax_id && s.tax_id === extracted.intestazione_vat);
          if (vatMatch) supplierId = vatMatch.id;
        }

        if (!supplierId && matches.length > 0) supplierId = matches[0].id;

        if (!supplierId) {
          const tempCode = `AUTO-${Date.now().toString().slice(-6)}`;
          const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
          const { data: newSup } = await supabase.from("suppliers").insert({
            name: extracted.intestazione_name,
            code: tempCode,
            access_code: accessCode,
            tax_id: extracted.intestazione_vat || null,
            address: extracted.intestazione_address || null,
          }).select("id").single();
          if (newSup) supplierId = newSup.id;
        }
      }

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
    <div className="space-y-4">
      {/* Hero Upload Area */}
      <Card className="overflow-hidden border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.03] to-primary/[0.08] hover:border-primary/40 transition-all duration-300 group">
        <div {...getRootProps()} className="cursor-pointer">
          <input {...getInputProps()} />
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-5">
              <div className="relative flex-shrink-0">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors group-hover:scale-105 duration-300">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">AI</span>
                </div>
              </div>
              
              <div className="flex-1 text-center md:text-left space-y-1">
                <h3 className="text-lg font-semibold tracking-tight">
                  {isDragActive ? "Rilascia i DDT qui..." : "Importa DDT con analisi AI"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                  Trascina PDF o immagini dei DDT — l'AI riconosce destinatari, fornitori, articoli e crea automaticamente le anagrafiche.
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start pt-1">
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <FileText className="h-3 w-3" /> PDF
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <Camera className="h-3 w-3" /> Foto
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal">
                    Multi-file
                  </Badge>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                <label>
                  <Button size="lg" asChild className="gap-2 shadow-md cursor-pointer">
                    <div>
                      <Upload className="w-4 h-4" />
                      Carica DDT
                    </div>
                  </Button>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) handleMultiFileUpload(files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca DDT per numero o controparte..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button
          variant={showArchived ? "default" : "ghost"}
          size="sm"
          className="h-9 text-xs"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="h-3.5 w-3.5 mr-1.5" />
          {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Caricamento DDT...</p>
            </div>
          </CardContent>
        </Card>
      ) : filteredDdts.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Truck className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Nessun DDT trovato</p>
                <p className="text-sm text-muted-foreground">Carica un DDT per iniziare</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numero</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Direzione</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Controparte</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Articoli</TableHead>
                     <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                     <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fatturazione</TableHead>
                     <TableHead className="text-right w-20"></TableHead>
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
                        <TableRow key={ddt.id} className={cn("hover:bg-muted/50 group", ddt.archived && "opacity-50")}>
                          <TableCell className="font-mono font-medium">{ddt.ddt_number}</TableCell>
                          <TableCell>
                            <Badge variant={ddt.direction === "inbound" ? "secondary" : "default"} className="text-xs">
                              {ddt.direction === "inbound" ? "Entrata" : "Uscita"}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{counterpart || "—"}</TableCell>
                          <TableCell className="text-sm">
                            {ddt.document_date
                              ? format(new Date(ddt.document_date), "dd/MM/yyyy", { locale: it })
                              : ddt.created_at
                              ? format(new Date(ddt.created_at), "dd/MM/yyyy", { locale: it })
                              : "—"}
                          </TableCell>
                          <TableCell>{itemCount > 0 ? <Badge variant="outline" className="text-xs">{itemCount} righe</Badge> : "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{ddt.status || "ricevuto"}</Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => setLinkDialog({
                                open: true,
                                ddtId: ddt.id,
                                ddtLabel: ddt.ddt_number || "DDT",
                                currentLinkedId: null
                              })}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                            >
                              {(ddt as any).invoiced ? (
                                <Badge variant="default" className="text-xs gap-1">
                                  <FileCheck className="h-3 w-3" />
                                  {(ddt as any).invoice_number || "Fatturato"}
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs gap-1 text-amber-600 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20">
                                  <AlertTriangle className="h-3 w-3" />
                                  Da fatturare
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {ddt.attachment_url && (
                                    <DropdownMenuItem asChild>
                                      <a href={ddt.attachment_url} target="_blank" rel="noopener noreferrer">
                                        <Eye className="h-4 w-4 mr-2" />
                                        Visualizza
                                      </a>
                                    </DropdownMenuItem>
                                  )}
                                  <DropdownMenuItem onClick={() => setLinkDialog({
                                    open: true,
                                    ddtId: ddt.id,
                                    ddtLabel: ddt.ddt_number || "DDT",
                                    currentLinkedId: null
                                  })}>
                                    <LinkIcon className="h-4 w-4 mr-2" />
                                    {(ddt as any).invoiced ? "Cambia fattura" : "Collega fattura"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => toggleArchive(ddt.id, ddt.archived || false)}>
                                    <Archive className="h-4 w-4 mr-2" />
                                    {ddt.archived ? "Ripristina" : "Archivia"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Upload Progress Dialog */}
      <Dialog open={showUploadProgress} onOpenChange={setShowUploadProgress}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-primary" />
              Elaborazione DDT ({completedCount}/{totalCount})
            </DialogTitle>
          </DialogHeader>
          <Progress value={progressPercent} className="mb-4" />
          <ScrollArea className="max-h-[300px]">
            <div className="space-y-2">
              {uploadQueue.map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0">
                    {item.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : item.status === "error" ? (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    ) : item.status === "pending" ? (
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    )}
                  </div>
                  <span className="truncate flex-1 font-medium">{item.file.name}</span>
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
          {uploadQueue.every(q => q.status === "done" || q.status === "error") && (
            <DialogFooter>
              <Button onClick={() => { setShowUploadProgress(false); setUploadQueue([]); }}>
                Chiudi
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <LinkAccountingDocDialog
        open={linkDialog.open}
        onOpenChange={open => setLinkDialog(prev => ({ ...prev, open }))}
        docType="ddt"
        docId={linkDialog.ddtId}
        docLabel={linkDialog.ddtLabel}
        currentLinkedId={linkDialog.currentLinkedId}
        onLinked={() => queryClient.invalidateQueries({ queryKey: ["ddts-operativi"] })}
      />
    </div>
  );
}
