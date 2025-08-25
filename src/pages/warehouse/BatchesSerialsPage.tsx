import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, Calendar, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Batch {
  id: string;
  batch_number: string;
  item_code: string;
  item_name: string;
  quantity: number;
  remaining_quantity: number;
  unit: string;
  production_date: string;
  expiry_date?: string;
  supplier?: string;
  location: string;
  status: "active" | "expired" | "consumed";
  notes?: string;
}

interface Serial {
  id: string;
  serial_number: string;
  item_code: string;
  item_name: string;
  batch_id?: string;
  production_date: string;
  warranty_until?: string;
  location: string;
  status: "available" | "sold" | "defective" | "rma";
  customer?: string;
  notes?: string;
}

export default function BatchesSerialsPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [serials, setSerials] = useState<Serial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isBatchDialogOpen, setIsBatchDialogOpen] = useState(false);
  const [isSerialDialogOpen, setIsSerialDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockBatches: Batch[] = [
      {
        id: "1",
        batch_number: "BATCH-2024-001",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        quantity: 100,
        remaining_quantity: 75,
        unit: "pcs",
        production_date: "2024-01-15",
        expiry_date: "2025-01-15",
        supplier: "Supplier ABC",
        location: "A-01-A",
        status: "active",
        notes: "Lotto di produzione gennaio"
      },
      {
        id: "2",
        batch_number: "BATCH-2023-050",
        item_code: "ITM-002",
        item_name: "Cartuccia carboni attivi",
        quantity: 50,
        remaining_quantity: 0,
        unit: "pcs",
        production_date: "2023-12-10",
        expiry_date: "2024-02-10",
        supplier: "Supplier XYZ",
        location: "A-01-B",
        status: "expired",
        notes: "Lotto scaduto"
      }
    ];

    const mockSerials: Serial[] = [
      {
        id: "1",
        serial_number: "SN-001-2024-001",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        batch_id: "1",
        production_date: "2024-01-20",
        warranty_until: "2026-01-20",
        location: "B-02-A",
        status: "available",
        notes: "Nuovo prodotto"
      },
      {
        id: "2",
        serial_number: "SN-001-2024-002",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        batch_id: "1",
        production_date: "2024-01-20",
        warranty_until: "2026-01-20",
        location: "Cliente",
        status: "sold",
        customer: "Cliente ABC",
        notes: "Venduto con ordine SO-2024-001"
      }
    ];

    setBatches(mockBatches);
    setSerials(mockSerials);
    setLoading(false);
  }, []);

  const filteredBatches = batches.filter(batch =>
    batch.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    batch.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSerials = serials.filter(serial =>
    serial.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    serial.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    serial.item_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getBatchStatusInfo = (status: string, expiryDate?: string) => {
    if (status === "expired" || (expiryDate && new Date(expiryDate) < new Date())) {
      return { 
        label: "Scaduto", 
        color: "destructive" as const, 
        icon: AlertTriangle 
      };
    }
    if (status === "consumed") {
      return { 
        label: "Esaurito", 
        color: "secondary" as const, 
        icon: Package 
      };
    }
    return { 
      label: "Attivo", 
      color: "default" as const, 
      icon: CheckCircle 
    };
  };

  const getSerialStatusInfo = (status: string) => {
    switch (status) {
      case "available":
        return { label: "Disponibile", color: "default" as const, icon: CheckCircle };
      case "sold":
        return { label: "Venduto", color: "secondary" as const, icon: Package };
      case "defective":
        return { label: "Difettoso", color: "destructive" as const, icon: AlertTriangle };
      case "rma":
        return { label: "RMA", color: "outline" as const, icon: Clock };
      default:
        return { label: "Sconosciuto", color: "outline" as const, icon: Package };
    }
  };

  const batchSummary = {
    totalBatches: batches.length,
    activeBatches: batches.filter(b => b.status === "active").length,
    expiredBatches: batches.filter(b => b.status === "expired").length
  };

  const serialSummary = {
    totalSerials: serials.length,
    availableSerials: serials.filter(s => s.status === "available").length,
    soldSerials: serials.filter(s => s.status === "sold").length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lotti e Numeri Seriali</h1>
          <p className="text-muted-foreground">
            Gestione tracciabilità prodotti per lotti e numeri seriali
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isBatchDialogOpen} onOpenChange={setIsBatchDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Lotto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Lotto</DialogTitle>
                <DialogDescription>Registra un nuovo lotto di produzione</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="batch-number">Numero Lotto</Label>
                  <Input id="batch-number" placeholder="BATCH-2024-XXX" />
                </div>
                <div>
                  <Label htmlFor="item">Articolo</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona articolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ITM-001">ITM-001 - Filtro acqua standard</SelectItem>
                      <SelectItem value="ITM-002">ITM-002 - Cartuccia carboni attivi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantità</Label>
                    <Input id="quantity" type="number" placeholder="0" />
                  </div>
                  <div>
                    <Label htmlFor="location">Ubicazione</Label>
                    <Input id="location" placeholder="A-01-A" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="production-date">Data Produzione</Label>
                    <Input id="production-date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="expiry-date">Data Scadenza</Label>
                    <Input id="expiry-date" type="date" />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsBatchDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={() => setIsBatchDialogOpen(false)}>
                    Crea Lotto
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isSerialDialogOpen} onOpenChange={setIsSerialDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Seriale
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuovo Numero Seriale</DialogTitle>
                <DialogDescription>Registra un nuovo numero seriale</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="serial-number">Numero Seriale</Label>
                  <Input id="serial-number" placeholder="SN-XXX-YYYY-ZZZ" />
                </div>
                <div>
                  <Label htmlFor="item">Articolo</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona articolo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ITM-003">ITM-003 - Valvola di sicurezza</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="batch">Lotto (opzionale)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona lotto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">BATCH-2024-001</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="production-date">Data Produzione</Label>
                    <Input id="production-date" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="warranty-until">Garanzia Fino</Label>
                    <Input id="warranty-until" type="date" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="location">Ubicazione</Label>
                  <Input id="location" placeholder="B-02-A" />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsSerialDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={() => setIsSerialDialogOpen(false)}>
                    Crea Seriale
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero lotto, seriale, codice o nome articolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Batches and Serials */}
      <Tabs defaultValue="batches" className="space-y-6">
        <TabsList>
          <TabsTrigger value="batches">Lotti</TabsTrigger>
          <TabsTrigger value="serials">Numeri Seriali</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-6">
          {/* Batch Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lotti Totali</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{batchSummary.totalBatches}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lotti Attivi</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{batchSummary.activeBatches}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Lotti Scaduti</CardTitle>
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{batchSummary.expiredBatches}</div>
              </CardContent>
            </Card>
          </div>

          {/* Batches Table */}
          <Card>
            <CardHeader>
              <CardTitle>Lotti di Produzione</CardTitle>
              <CardDescription>
                {filteredBatches.length} di {batches.length} lotti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero Lotto</TableHead>
                      <TableHead>Articolo</TableHead>
                      <TableHead className="text-right">Quantità</TableHead>
                      <TableHead className="text-right">Rimanente</TableHead>
                      <TableHead>Ubicazione</TableHead>
                      <TableHead>Produzione</TableHead>
                      <TableHead>Scadenza</TableHead>
                      <TableHead>Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Caricamento...
                        </TableCell>
                      </TableRow>
                    ) : filteredBatches.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nessun lotto trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBatches.map((batch) => {
                        const statusInfo = getBatchStatusInfo(batch.status, batch.expiry_date);
                        const StatusIcon = statusInfo.icon;
                        
                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="font-medium">{batch.batch_number}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{batch.item_code}</div>
                                <div className="text-sm text-muted-foreground">{batch.item_name}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{batch.quantity} {batch.unit}</TableCell>
                            <TableCell className="text-right">{batch.remaining_quantity} {batch.unit}</TableCell>
                            <TableCell>{batch.location}</TableCell>
                            <TableCell>
                              {format(new Date(batch.production_date), "dd/MM/yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>
                              {batch.expiry_date ? 
                                format(new Date(batch.expiry_date), "dd/MM/yyyy", { locale: it }) : 
                                "-"
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.color} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
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
        </TabsContent>

        <TabsContent value="serials" className="space-y-6">
          {/* Serial Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Seriali Totali</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{serialSummary.totalSerials}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Disponibili</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{serialSummary.availableSerials}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Venduti</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{serialSummary.soldSerials}</div>
              </CardContent>
            </Card>
          </div>

          {/* Serials Table */}
          <Card>
            <CardHeader>
              <CardTitle>Numeri Seriali</CardTitle>
              <CardDescription>
                {filteredSerials.length} di {serials.length} numeri seriali
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Numero Seriale</TableHead>
                      <TableHead>Articolo</TableHead>
                      <TableHead>Lotto</TableHead>
                      <TableHead>Ubicazione</TableHead>
                      <TableHead>Produzione</TableHead>
                      <TableHead>Garanzia</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Cliente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Caricamento...
                        </TableCell>
                      </TableRow>
                    ) : filteredSerials.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          Nessun numero seriale trovato
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredSerials.map((serial) => {
                        const statusInfo = getSerialStatusInfo(serial.status);
                        const StatusIcon = statusInfo.icon;
                        const associatedBatch = batches.find(b => b.id === serial.batch_id);
                        
                        return (
                          <TableRow key={serial.id}>
                            <TableCell className="font-medium">{serial.serial_number}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{serial.item_code}</div>
                                <div className="text-sm text-muted-foreground">{serial.item_name}</div>
                              </div>
                            </TableCell>
                            <TableCell>{associatedBatch?.batch_number || "-"}</TableCell>
                            <TableCell>{serial.location}</TableCell>
                            <TableCell>
                              {format(new Date(serial.production_date), "dd/MM/yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>
                              {serial.warranty_until ? 
                                format(new Date(serial.warranty_until), "dd/MM/yyyy", { locale: it }) : 
                                "-"
                              }
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusInfo.color} className="gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                            </TableCell>
                            <TableCell>{serial.customer || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}