import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileText, Truck, Package, ExternalLink, Calendar, Eye, ScanLine } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "react-router-dom";

interface DdtData {
  fornitore?: string;
  destinatario?: string;
  data?: string;
  stato?: string;
  scansionato?: boolean;
  causale_trasporto?: string;
  destinazione?: string;
  destinazione_indirizzo?: string;
  line_items?: Array<{
    description?: string;
    quantity?: number;
    unit?: string;
  }>;
  [key: string]: unknown;
}

interface Ddt {
  id: string;
  ddt_number: string;
  created_at: string;
  unique_code: string | null;
  html_content: string | null;
  ddt_data: DdtData | null;
  shipping_order_id: string | null;
  customer_id: string | null;
  customers?: { name: string; code: string } | null;
  shipping_orders?: { number: string; status: string } | null;
}

export default function DdtPage() {
  const [ddts, setDdts] = useState<Ddt[]>([]);
  const [selectedDdt, setSelectedDdt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
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
          id, ddt_number, created_at, unique_code, html_content, ddt_data,
          shipping_order_id, customer_id,
          customers(name, code),
          shipping_orders(number, status)
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setDdts((data as Ddt[]) || []);
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
    const customerName = ddt.customers?.name || ddt.ddt_data?.destinatario || ddt.ddt_data?.fornitore || "";
    const matchesSearch = 
      ddt.ddt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ddt.shipping_orders?.number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (typeFilter === "all") return matchesSearch;
    if (typeFilter === "scanned") return matchesSearch && ddt.ddt_data?.scansionato === true;
    if (typeFilter === "generated") return matchesSearch && ddt.html_content !== null && !ddt.ddt_data?.scansionato;
    
    return matchesSearch;
  });

  const selectedDdtDetails = selectedDdt ? 
    ddts.find(ddt => ddt.id === selectedDdt) : null;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  const ddtSummary = {
    totalDdts: ddts.length,
    scannedDdts: ddts.filter(ddt => ddt.ddt_data?.scansionato).length,
    generatedDdts: ddts.filter(ddt => ddt.html_content && !ddt.ddt_data?.scansionato).length,
    withShippingOrder: ddts.filter(ddt => ddt.shipping_order_id).length,
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">DDT - Documenti di Trasporto</h1>
          <p className="text-muted-foreground">
            Gestisci i documenti di trasporto per spedizioni e ricevimenti
          </p>
        </div>
        <Button asChild>
          <Link to="/management-control-2/registro">
            <Plus className="h-4 w-4 mr-2" />
            Carica DDT
          </Link>
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DDT Totali</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ddtSummary.totalDdts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scansionati</CardTitle>
            <ScanLine className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{ddtSummary.scannedDdts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Generati</CardTitle>
            <Truck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{ddtSummary.generatedDdts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Ordine Spedizione</CardTitle>
            <Package className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{ddtSummary.withShippingOrder}</div>
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
                  placeholder="Cerca per numero DDT, cliente, fornitore..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={typeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("all")}
              >
                Tutti
              </Button>
              <Button
                variant={typeFilter === "scanned" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("scanned")}
              >
                Scansionati
              </Button>
              <Button
                variant={typeFilter === "generated" ? "default" : "outline"}
                size="sm"
                onClick={() => setTypeFilter("generated")}
              >
                Generati
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
                  <TableHead>Numero DDT</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente/Fornitore</TableHead>
                  <TableHead>Ordine Spedizione</TableHead>
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
                        <div className="flex items-center gap-2">
                          {ddt.ddt_number}
                          {ddt.ddt_data?.scansionato && (
                            <Badge variant="outline" className="text-xs">
                              <ScanLine className="h-3 w-3 mr-1" />
                              Scansionato
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          {formatDate(ddt.ddt_data?.data || ddt.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ddt.customers?.name || ddt.ddt_data?.destinatario || ddt.ddt_data?.fornitore || "-"}
                      </TableCell>
                      <TableCell>
                        {ddt.shipping_orders?.number || "-"}
                      </TableCell>
                      <TableCell>
                        {ddt.shipping_orders?.status ? (
                          <StatusBadge status={ddt.shipping_orders.status} />
                        ) : ddt.ddt_data?.stato ? (
                          <Badge variant="outline">{ddt.ddt_data.stato}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedDdt(selectedDdt === ddt.id ? null : ddt.id)}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            {selectedDdt === ddt.id ? "Chiudi" : "Dettagli"}
                          </Button>
                          {ddt.unique_code && (
                            <Button size="sm" variant="ghost" asChild>
                              <a href={`/ddt/${ddt.unique_code}`} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
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
            {/* DDT Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              {selectedDdtDetails.customers?.name && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Cliente</div>
                  <div className="text-sm">{selectedDdtDetails.customers.name}</div>
                </div>
              )}
              {selectedDdtDetails.ddt_data?.destinatario && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Destinatario</div>
                  <div className="text-sm">{selectedDdtDetails.ddt_data.destinatario}</div>
                </div>
              )}
              {selectedDdtDetails.ddt_data?.fornitore && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Fornitore</div>
                  <div className="text-sm">{selectedDdtDetails.ddt_data.fornitore}</div>
                </div>
              )}
              {selectedDdtDetails.ddt_data?.destinazione && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Destinazione</div>
                  <div className="text-sm">{selectedDdtDetails.ddt_data.destinazione}</div>
                </div>
              )}
              {selectedDdtDetails.ddt_data?.destinazione_indirizzo && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Indirizzo Destinazione</div>
                  <div className="text-sm">{selectedDdtDetails.ddt_data.destinazione_indirizzo}</div>
                </div>
              )}
              {selectedDdtDetails.ddt_data?.causale_trasporto && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Causale Trasporto</div>
                  <div className="text-sm">{selectedDdtDetails.ddt_data.causale_trasporto}</div>
                </div>
              )}
              {selectedDdtDetails.shipping_orders?.number && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Ordine Spedizione</div>
                  <div className="text-sm">{selectedDdtDetails.shipping_orders.number}</div>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            {selectedDdtDetails.ddt_data?.line_items && selectedDdtDetails.ddt_data.line_items.length > 0 && (
              <>
                <h4 className="font-medium mb-3">Articoli</h4>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Quantità</TableHead>
                        <TableHead>Unità</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedDdtDetails.ddt_data.line_items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.description || "-"}</TableCell>
                          <TableCell className="text-right">{item.quantity || "-"}</TableCell>
                          <TableCell>{item.unit || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {/* HTML Preview for generated DDTs */}
            {selectedDdtDetails.html_content && (
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
    </div>
  );
}
