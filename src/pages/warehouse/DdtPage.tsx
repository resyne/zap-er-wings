import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, FileText, Truck, Package, Download, Eye, Calendar } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Ddt {
  id: string;
  ddt_number: string;
  ddt_date: string;
  type: "outgoing" | "incoming" | "transfer";
  order_reference?: string;
  customer_name?: string;
  supplier_name?: string;
  destination_address: string;
  transport_reason: string;
  transport_method: string;
  carrier?: string;
  tracking_number?: string;
  status: "draft" | "ready" | "shipped" | "delivered" | "cancelled";
  created_by: string;
  created_at: string;
  shipped_date?: string;
  delivered_date?: string;
  total_packages: number;
  total_weight?: number;
  notes?: string;
}

interface DdtItem {
  id: string;
  ddt_id: string;
  item_code: string;
  item_name: string;
  quantity: number;
  unit: string;
  lot_number?: string;
  serial_numbers?: string[];
  notes?: string;
}

export default function DdtPage() {
  const [ddts, setDdts] = useState<Ddt[]>([]);
  const [ddtItems, setDdtItems] = useState<DdtItem[]>([]);
  const [selectedDdt, setSelectedDdt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockDdts: Ddt[] = [
      {
        id: "1",
        ddt_number: "DDT-2024-001",
        ddt_date: "2024-01-25",
        type: "outgoing",
        order_reference: "SO-2024-005",
        customer_name: "Cliente ABC S.r.l.",
        destination_address: "Via Roma 123, Milano (MI)",
        transport_reason: "Vendita",
        transport_method: "Corriere espresso",
        carrier: "GLS",
        tracking_number: "GLS123456789",
        status: "shipped",
        created_by: "Mario Rossi",
        created_at: "2024-01-25T08:00:00Z",
        shipped_date: "2024-01-25T14:00:00Z",
        total_packages: 2,
        total_weight: 15.5,
        notes: "Fragile - Maneggiare con cura"
      },
      {
        id: "2",
        ddt_number: "DDT-2024-002",
        ddt_date: "2024-01-24",
        type: "incoming",
        supplier_name: "Fornitore XYZ S.p.A.",
        destination_address: "Via Magazzino 1, Roma (RM)",
        transport_reason: "Acquisto",
        transport_method: "Trasporto proprio",
        status: "delivered",
        created_by: "Laura Bianchi",
        created_at: "2024-01-24T09:00:00Z",
        shipped_date: "2024-01-24T10:00:00Z",
        delivered_date: "2024-01-24T16:30:00Z",
        total_packages: 1,
        total_weight: 25.0,
        notes: ""
      },
      {
        id: "3",
        ddt_number: "DDT-2024-003",
        ddt_date: "2024-01-26",
        type: "transfer",
        destination_address: "Magazzino B - Via Industriale 45, Torino (TO)",
        transport_reason: "Trasferimento tra magazzini",
        transport_method: "Trasporto interno",
        status: "ready",
        created_by: "Giuseppe Verde",
        created_at: "2024-01-26T07:00:00Z",
        total_packages: 3,
        notes: "Trasferimento urgente per riassortimento"
      }
    ];

    const mockDdtItems: DdtItem[] = [
      {
        id: "1",
        ddt_id: "1",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        quantity: 10,
        unit: "pcs",
        lot_number: "BATCH-2024-001",
        notes: ""
      },
      {
        id: "2",
        ddt_id: "1",
        item_code: "ITM-002",
        item_name: "Cartuccia carboni attivi",
        quantity: 5,
        unit: "pcs",
        lot_number: "BATCH-2023-050",
        notes: ""
      },
      {
        id: "3",
        ddt_id: "2",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        quantity: 25,
        unit: "pcs",
        serial_numbers: ["SN-001-2024-001", "SN-001-2024-002", "SN-001-2024-003"],
        notes: "Articoli con garanzia 2 anni"
      }
    ];

    setDdts(mockDdts);
    setDdtItems(mockDdtItems);
    setLoading(false);
  }, []);

  const filteredDdts = ddts.filter(ddt => {
    const matchesSearch = ddt.ddt_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ddt.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ddt.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         ddt.order_reference?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || ddt.type === typeFilter;
    const matchesStatus = statusFilter === "all" || ddt.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const selectedDdtDetails = selectedDdt ? 
    ddts.find(ddt => ddt.id === selectedDdt) : null;

  const selectedDdtItems = selectedDdt ? 
    ddtItems.filter(item => item.ddt_id === selectedDdt) : [];

  const getTypeInfo = (type: string) => {
    switch (type) {
      case "outgoing":
        return { label: "In Uscita", color: "default" as const, icon: Truck };
      case "incoming":
        return { label: "In Entrata", color: "secondary" as const, icon: Package };
      case "transfer":
        return { label: "Trasferimento", color: "outline" as const, icon: FileText };
      default:
        return { label: "Sconosciuto", color: "outline" as const, icon: FileText };
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "draft":
        return { label: "Bozza", color: "outline" as const };
      case "ready":
        return { label: "Pronto", color: "default" as const };
      case "shipped":
        return { label: "Spedito", color: "default" as const };
      case "delivered":
        return { label: "Consegnato", color: "default" as const };
      case "cancelled":
        return { label: "Annullato", color: "destructive" as const };
      default:
        return { label: "Sconosciuto", color: "outline" as const };
    }
  };

  const ddtSummary = {
    totalDdts: ddts.length,
    outgoingDdts: ddts.filter(ddt => ddt.type === "outgoing").length,
    incomingDdts: ddts.filter(ddt => ddt.type === "incoming").length,
    transferDdts: ddts.filter(ddt => ddt.type === "transfer").length
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo DDT
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuovo Documento di Trasporto</DialogTitle>
              <DialogDescription>
                Crea un nuovo DDT per spedizione o ricevimento
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">Tipo DDT</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outgoing">In Uscita (Spedizione)</SelectItem>
                    <SelectItem value="incoming">In Entrata (Ricevimento)</SelectItem>
                    <SelectItem value="transfer">Trasferimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="date">Data DDT</Label>
                <Input id="date" type="date" />
              </div>
              <div>
                <Label htmlFor="order-reference">Ordine di Riferimento</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ordine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SO-2024-007">SO-2024-007 - Cliente DEF</SelectItem>
                    <SelectItem value="PO-2024-003">PO-2024-003 - Fornitore ABC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="destination">Indirizzo Destinazione</Label>
                <Textarea id="destination" placeholder="Via, Città, CAP" rows={2} />
              </div>
              <div>
                <Label htmlFor="transport-reason">Causale Trasporto</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona causale" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">Vendita</SelectItem>
                    <SelectItem value="purchase">Acquisto</SelectItem>
                    <SelectItem value="transfer">Trasferimento</SelectItem>
                    <SelectItem value="return">Reso</SelectItem>
                    <SelectItem value="loan">Comodato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="transport-method">Modalità Trasporto</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona modalità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="courier">Corriere espresso</SelectItem>
                    <SelectItem value="own">Trasporto proprio</SelectItem>
                    <SelectItem value="customer">Ritiro cliente</SelectItem>
                    <SelectItem value="postal">Servizio postale</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="packages">Numero Colli</Label>
                <Input id="packages" type="number" placeholder="1" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Crea DDT
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
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
            <CardTitle className="text-sm font-medium">In Uscita</CardTitle>
            <Truck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{ddtSummary.outgoingDdts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Entrata</CardTitle>
            <Package className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{ddtSummary.incomingDdts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trasferimenti</CardTitle>
            <FileText className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{ddtSummary.transferDdts}</div>
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
                  placeholder="Cerca per numero DDT, cliente, fornitore o ordine..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="outgoing">In Uscita</SelectItem>
                <SelectItem value="incoming">In Entrata</SelectItem>
                <SelectItem value="transfer">Trasferimento</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="draft">Bozza</SelectItem>
                <SelectItem value="ready">Pronto</SelectItem>
                <SelectItem value="shipped">Spedito</SelectItem>
                <SelectItem value="delivered">Consegnato</SelectItem>
                <SelectItem value="cancelled">Annullato</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente/Fornitore</TableHead>
                  <TableHead>Ordine</TableHead>
                  <TableHead>Colli</TableHead>
                  <TableHead>Peso</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredDdts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nessun DDT trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDdts.map((ddt) => {
                    const typeInfo = getTypeInfo(ddt.type);
                    const statusInfo = getStatusInfo(ddt.status);
                    const TypeIcon = typeInfo.icon;
                    
                    return (
                      <TableRow key={ddt.id}>
                        <TableCell className="font-medium">{ddt.ddt_number}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(ddt.ddt_date), "dd/MM/yyyy", { locale: it })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={typeInfo.color} className="gap-1">
                            <TypeIcon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {ddt.customer_name || ddt.supplier_name || "-"}
                        </TableCell>
                        <TableCell>{ddt.order_reference || "-"}</TableCell>
                        <TableCell className="text-center">{ddt.total_packages}</TableCell>
                        <TableCell className="text-center">
                          {ddt.total_weight ? `${ddt.total_weight} kg` : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.color}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedDdt(
                                selectedDdt === ddt.id ? null : ddt.id
                              )}
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              {selectedDdt === ddt.id ? "Chiudi" : "Vedi"}
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="h-3 w-3 mr-1" />
                              PDF
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
              Articoli nel documento di trasporto
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* DDT Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-muted-foreground">Destinazione</div>
                <div className="text-sm">{selectedDdtDetails.destination_address}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Causale Trasporto</div>
                <div className="text-sm">{selectedDdtDetails.transport_reason}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-muted-foreground">Modalità Trasporto</div>
                <div className="text-sm">{selectedDdtDetails.transport_method}</div>
              </div>
              {selectedDdtDetails.carrier && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Vettore</div>
                  <div className="text-sm">{selectedDdtDetails.carrier}</div>
                </div>
              )}
              {selectedDdtDetails.tracking_number && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">Numero Tracking</div>
                  <div className="text-sm font-mono">{selectedDdtDetails.tracking_number}</div>
                </div>
              )}
              {selectedDdtDetails.notes && (
                <div className="md:col-span-3">
                  <div className="text-sm font-medium text-muted-foreground">Note</div>
                  <div className="text-sm">{selectedDdtDetails.notes}</div>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome Articolo</TableHead>
                    <TableHead className="text-right">Quantità</TableHead>
                    <TableHead>Lotto</TableHead>
                    <TableHead>Numeri Seriali</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDdtItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nessun articolo in questo DDT
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedDdtItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.item_code}</TableCell>
                        <TableCell>{item.item_name}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                        <TableCell>{item.lot_number || "-"}</TableCell>
                        <TableCell>
                          {item.serial_numbers && item.serial_numbers.length > 0 ? (
                            <div className="text-sm">
                              {item.serial_numbers.slice(0, 2).map(sn => (
                                <div key={sn} className="font-mono text-xs">{sn}</div>
                              ))}
                              {item.serial_numbers.length > 2 && (
                                <div className="text-xs text-muted-foreground">
                                  +{item.serial_numbers.length - 2} altri
                                </div>
                              )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>{item.notes || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}