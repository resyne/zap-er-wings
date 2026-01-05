import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, Search, FileText, ExternalLink, Calendar, Eye, 
  ArrowDownToLine, ArrowUpFromLine, CheckCircle2, Clock, 
  AlertCircle, XCircle, Receipt, Trash2
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UploadDDTDialog } from "@/components/warehouse/UploadDDTDialog";
import { VerifyDDTDialog } from "@/components/warehouse/VerifyDDTDialog";
import { DDTDetailsDialog } from "@/components/warehouse/DDTDetailsDialog";

interface Ddt {
  id: string;
  ddt_number: string;
  created_at: string;
  unique_code: string | null;
  html_content: string | null;
  direction: string | null;
  attachment_url: string | null;
  document_date: string | null;
  notes: string | null;
  status: string | null;
  admin_status: string | null;
  counterpart_type: string | null;
  official_document_date: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  shipping_order_id: string | null;
  work_order_id: string | null;
  ddt_data: Record<string, unknown> | null;
  customers?: { name: string; code: string } | null;
  suppliers?: { name: string; code: string } | null;
  shipping_orders?: { number: string } | null;
  work_orders?: { number: string; title: string } | null;
}

// Helper to get attachment URL (checks both attachment_url and ddt_data.allegato_url)
const getAttachmentUrl = (ddt: Ddt): string | null => {
  if (ddt.attachment_url) return ddt.attachment_url;
  if (ddt.ddt_data && typeof ddt.ddt_data === 'object') {
    const allegatoUrl = (ddt.ddt_data as Record<string, unknown>).allegato_url;
    if (typeof allegatoUrl === 'string') return allegatoUrl;
  }
  return null;
};

type StatusFilter = "all" | "da_verificare" | "verificato" | "fatturato";
type DirectionFilter = "all" | "IN" | "OUT";

export default function DdtPage() {
  const [ddts, setDdts] = useState<Ddt[]>([]);
  const [selectedDdt, setSelectedDdt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [ddtToVerify, setDdtToVerify] = useState<Ddt | null>(null);
  const [ddtToView, setDdtToView] = useState<Ddt | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadDdts();
  }, []);

  const loadDdts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("ddts")
        .select(`
          id, ddt_number, created_at, unique_code, html_content,
          direction, attachment_url, document_date, notes,
          status, admin_status, counterpart_type, official_document_date,
          customer_id, supplier_id, shipping_order_id, work_order_id, ddt_data,
          customers(name, code),
          suppliers(name, code),
          shipping_orders(number),
          work_orders(number, title)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setDdts((data as unknown as Ddt[]) || []);
    } catch (error) {
      console.error("Error loading DDTs:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredDdts = ddts.filter(ddt => {
    const counterpartName = ddt.customers?.name || ddt.suppliers?.name || "";
    const matchesSearch = 
      ddt.ddt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      counterpartName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ddt.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || ddt.status === statusFilter;
    const matchesDirection = directionFilter === "all" || ddt.direction === directionFilter;
    
    return matchesSearch && matchesStatus && matchesDirection;
  });

  const selectedDdtDetails = selectedDdt ? 
    ddts.find(ddt => ddt.id === selectedDdt) : null;

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  const ddtSummary = {
    total: ddts.length,
    daVerificare: ddts.filter(ddt => ddt.status === "da_verificare").length,
    verificati: ddts.filter(ddt => ddt.status === "verificato").length,
    fatturati: ddts.filter(ddt => ddt.status === "fatturato").length,
    inbound: ddts.filter(ddt => ddt.direction === "IN").length,
    outbound: ddts.filter(ddt => ddt.direction === "OUT").length,
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "da_verificare":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Da verificare</Badge>;
      case "verificato":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><CheckCircle2 className="h-3 w-3 mr-1" />Verificato</Badge>;
      case "fatturato":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Receipt className="h-3 w-3 mr-1" />Fatturato</Badge>;
      case "annullato":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" />Annullato</Badge>;
      default:
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Sconosciuto</Badge>;
    }
  };

  const getDirectionBadge = (direction: string | null) => {
    if (direction === "IN") {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><ArrowDownToLine className="h-3 w-3 mr-1" />Entrata</Badge>;
    }
    if (direction === "OUT") {
      return <Badge variant="secondary" className="bg-green-100 text-green-700"><ArrowUpFromLine className="h-3 w-3 mr-1" />Uscita</Badge>;
    }
    return null;
  };

  const handleVerifyClick = (ddt: Ddt) => {
    setDdtToVerify(ddt);
    setVerifyDialogOpen(true);
  };

  const handleDetailsClick = (ddt: Ddt) => {
    setDdtToView(ddt);
    setDetailsDialogOpen(true);
  };

  const handleDeleteDdt = async (ddtId: string) => {
    try {
      // First delete related ddt_items
      const { error: itemsError } = await supabase
        .from("ddt_items")
        .delete()
        .eq("ddt_id", ddtId);
      
      if (itemsError) throw itemsError;

      // Then delete the DDT
      const { error } = await supabase
        .from("ddts")
        .delete()
        .eq("id", ddtId);
      
      if (error) throw error;
      
      toast({
        title: "DDT eliminato",
        description: "Il DDT è stato eliminato con successo",
      });
      loadDdts();
    } catch (error) {
      console.error("Error deleting DDT:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il DDT",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DDT - Documenti di Trasporto</h1>
          <p className="text-muted-foreground">
            Gestisci i movimenti di merce in entrata e uscita
          </p>
        </div>
        <Button onClick={() => setUploadDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Carica DDT
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("all")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ddtSummary.total}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("da_verificare")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Da verificare</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{ddtSummary.daVerificare}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("verificato")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verificati</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{ddtSummary.verificati}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setStatusFilter("fatturato")}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fatturati</CardTitle>
            <Receipt className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{ddtSummary.fatturati}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("all"); setDirectionFilter("IN"); }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entrate</CardTitle>
            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ddtSummary.inbound}</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setStatusFilter("all"); setDirectionFilter("OUT"); }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uscite</CardTitle>
            <ArrowUpFromLine className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ddtSummary.outbound}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero DDT, cliente, fornitore, note..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => { setStatusFilter("all"); setDirectionFilter("all"); }}
              >
                Tutti
              </Button>
              <Button
                variant={statusFilter === "da_verificare" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("da_verificare")}
              >
                <Clock className="h-3 w-3 mr-1" />
                Da verificare
              </Button>
              <Button
                variant={statusFilter === "verificato" ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter("verificato")}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Verificati
              </Button>
              <Button
                variant={directionFilter === "IN" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setDirectionFilter(directionFilter === "IN" ? "all" : "IN")}
              >
                <ArrowDownToLine className="h-3 w-3 mr-1" />
                IN
              </Button>
              <Button
                variant={directionFilter === "OUT" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setDirectionFilter(directionFilter === "OUT" ? "all" : "OUT")}
              >
                <ArrowUpFromLine className="h-3 w-3 mr-1" />
                OUT
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DDT Table */}
      <Card>
        <CardHeader>
          <CardTitle>Documenti di Trasporto</CardTitle>
          <CardDescription>
            {filteredDdts.length} di {ddts.length} DDT
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Direzione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Controparte</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        Caricamento...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredDdts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nessun DDT trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDdts.map((ddt) => (
                    <TableRow key={ddt.id}>
                      <TableCell className="font-medium">
                        {ddt.ddt_number}
                      </TableCell>
                      <TableCell>
                        {getDirectionBadge(ddt.direction)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(ddt.document_date || ddt.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ddt.customers?.name || ddt.suppliers?.name || 
                         <span className="text-muted-foreground italic">Da assegnare</span>}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(ddt.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {ddt.status === "da_verificare" && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleVerifyClick(ddt)}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Completa
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDetailsClick(ddt)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Dettagli
                          </Button>
                          {(() => {
                            const attachmentUrl = getAttachmentUrl(ddt);
                            return attachmentUrl && (
                              <Button size="sm" variant="ghost" asChild>
                                <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            );
                          })()}
                          {ddt.unique_code && ddt.html_content && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`/ddt/${ddt.unique_code}`} target="_blank" rel="noopener noreferrer">
                                <FileText className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Eliminare questo DDT?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Stai per eliminare il DDT "{ddt.ddt_number}". Questa azione non può essere annullata.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => handleDeleteDdt(ddt.id)}
                                >
                                  Elimina
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DDT Details */}
      {selectedDdtDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Dettagli DDT: {selectedDdtDetails.ddt_number}</CardTitle>
            <CardDescription>
              Informazioni sul documento di trasporto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Direzione</div>
                <div className="mt-1">{getDirectionBadge(selectedDdtDetails.direction)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Stato</div>
                <div className="mt-1">{getStatusBadge(selectedDdtDetails.status)}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Data documento</div>
                <div className="text-sm mt-1">{formatDate(selectedDdtDetails.document_date)}</div>
              </div>
              {selectedDdtDetails.customers?.name && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Cliente</div>
                  <div className="text-sm mt-1">{selectedDdtDetails.customers.name}</div>
                </div>
              )}
              {selectedDdtDetails.suppliers?.name && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Fornitore</div>
                  <div className="text-sm mt-1">{selectedDdtDetails.suppliers.name}</div>
                </div>
              )}
              {selectedDdtDetails.work_orders?.number && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Commessa</div>
                  <div className="text-sm mt-1">{selectedDdtDetails.work_orders.number}</div>
                </div>
              )}
              {selectedDdtDetails.notes && (
                <div className="md:col-span-3">
                  <div className="text-sm font-medium text-muted-foreground">Note</div>
                  <div className="text-sm mt-1">{selectedDdtDetails.notes}</div>
                </div>
              )}
            </div>

            {/* Preview per DDT con allegato */}
            {(() => {
              const attachmentUrl = getAttachmentUrl(selectedDdtDetails);
              return attachmentUrl && (
                <div className="mt-4">
                  <h4 className="font-medium mb-3">Documento allegato</h4>
                  <div className="border rounded-lg overflow-hidden bg-white">
                    {attachmentUrl.endsWith(".pdf") ? (
                      <iframe
                        src={attachmentUrl}
                        className="w-full h-[500px]"
                        title="Anteprima DDT"
                      />
                    ) : (
                      <img 
                        src={attachmentUrl} 
                        alt="DDT" 
                        className="max-w-full h-auto max-h-[500px] mx-auto"
                      />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Preview per DDT generati */}
            {selectedDdtDetails.html_content && !getAttachmentUrl(selectedDdtDetails) && (
              <div className="mt-4">
                <h4 className="font-medium mb-3">Anteprima Documento</h4>
                <div 
                  className="border rounded-lg p-4 bg-white max-h-[500px] overflow-auto"
                  dangerouslySetInnerHTML={{ __html: selectedDdtDetails.html_content }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <UploadDDTDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onSuccess={loadDdts}
      />
      
      <VerifyDDTDialog
        open={verifyDialogOpen}
        onOpenChange={setVerifyDialogOpen}
        ddt={ddtToVerify}
        onSuccess={loadDdts}
      />

      <DDTDetailsDialog
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        ddt={ddtToView}
        onSuccess={loadDdts}
      />
    </div>
  );
}
