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
import { Plus, Search, ArrowUpDown, TrendingUp, TrendingDown, Package } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface StockMovement {
  id: string;
  item_code: string;
  item_name: string;
  movement_type: "in" | "out" | "adjustment";
  quantity: number;
  unit: string;
  reference_document?: string;
  reason: string;
  location_from?: string;
  location_to?: string;
  user_name: string;
  created_at: string;
  cost_per_unit?: number;
}

export default function MovementsPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data for movements
  useEffect(() => {
    const mockData: StockMovement[] = [
      {
        id: "1",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        movement_type: "in",
        quantity: 50,
        unit: "pcs",
        reference_document: "PO-2024-001",
        reason: "Carico da acquisto",
        location_to: "A-01-A",
        user_name: "Mario Rossi",
        created_at: "2024-01-20T10:30:00Z",
        cost_per_unit: 15.50
      },
      {
        id: "2",
        item_code: "ITM-002",
        item_name: "Cartuccia carboni attivi",
        movement_type: "out",
        quantity: 10,
        unit: "pcs",
        reference_document: "SO-2024-005",
        reason: "Prelievo per ordine cliente",
        location_from: "A-01-B",
        user_name: "Laura Bianchi",
        created_at: "2024-01-19T14:15:00Z"
      },
      {
        id: "3",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        movement_type: "adjustment",
        quantity: -5,
        unit: "pcs",
        reason: "Rettifica inventario - articoli danneggiati",
        location_from: "A-01-A",
        user_name: "Giuseppe Verde",
        created_at: "2024-01-18T16:45:00Z"
      },
      {
        id: "4",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        movement_type: "in",
        quantity: 25,
        unit: "pcs",
        reference_document: "PO-2024-002",
        reason: "Carico da acquisto",
        location_to: "B-02-A",
        user_name: "Mario Rossi",
        created_at: "2024-01-17T09:20:00Z",
        cost_per_unit: 45.00
      }
    ];
    
    setMovements(mockData);
    setLoading(false);
  }, []);

  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.item_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         movement.reason.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === "all" || movement.movement_type === selectedType;
    return matchesSearch && matchesType;
  });

  const getMovementTypeInfo = (type: string) => {
    switch (type) {
      case "in":
        return { 
          label: "Carico", 
          color: "default" as const, 
          icon: TrendingUp,
          bgColor: "bg-green-50 text-green-700 border-green-200"
        };
      case "out":
        return { 
          label: "Scarico", 
          color: "secondary" as const, 
          icon: TrendingDown,
          bgColor: "bg-red-50 text-red-700 border-red-200"
        };
      case "adjustment":
        return { 
          label: "Rettifica", 
          color: "outline" as const, 
          icon: ArrowUpDown,
          bgColor: "bg-blue-50 text-blue-700 border-blue-200"
        };
      default:
        return { 
          label: "Sconosciuto", 
          color: "outline" as const, 
          icon: Package,
          bgColor: "bg-gray-50 text-gray-700 border-gray-200"
        };
    }
  };

  const movementSummary = {
    totalMovements: movements.length,
    todayMovements: movements.filter(m => 
      new Date(m.created_at).toDateString() === new Date().toDateString()
    ).length,
    totalValue: movements
      .filter(m => m.cost_per_unit)
      .reduce((sum, m) => sum + (Math.abs(m.quantity) * (m.cost_per_unit || 0)), 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimenti Stock</h1>
          <p className="text-muted-foreground">
            Storico dei movimenti di magazzino
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Movimento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nuovo Movimento Stock</DialogTitle>
              <DialogDescription>
                Registra un movimento di carico o scarico
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="item">Articolo</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona articolo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ITM-001">ITM-001 - Filtro acqua standard</SelectItem>
                    <SelectItem value="ITM-002">ITM-002 - Cartuccia carboni attivi</SelectItem>
                    <SelectItem value="ITM-003">ITM-003 - Valvola di sicurezza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="type">Tipo Movimento</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in">Carico</SelectItem>
                    <SelectItem value="out">Scarico</SelectItem>
                    <SelectItem value="adjustment">Rettifica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quantity">Quantità</Label>
                <Input id="quantity" type="number" placeholder="0" />
              </div>
              <div>
                <Label htmlFor="location">Ubicazione</Label>
                <Input id="location" placeholder="Es: A-01-A" />
              </div>
              <div>
                <Label htmlFor="reference">Documento Riferimento</Label>
                <Input id="reference" placeholder="Es: PO-2024-001" />
              </div>
              <div>
                <Label htmlFor="reason">Motivo</Label>
                <Textarea id="reason" placeholder="Descrizione movimento" rows={3} />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Registra Movimento
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Movimenti Totali</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movementSummary.totalMovements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oggi</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{movementSummary.todayMovements}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Movimentato</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{movementSummary.totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per articolo, codice o motivo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Tipo movimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="in">Carico</SelectItem>
                <SelectItem value="out">Scarico</SelectItem>
                <SelectItem value="adjustment">Rettifica</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Movements Table */}
      <Card>
        <CardHeader>
          <CardTitle>Storico Movimenti</CardTitle>
          <CardDescription>
            {filteredMovements.length} di {movements.length} movimenti
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Articolo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantità</TableHead>
                  <TableHead>Ubicazione</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Utente</TableHead>
                  <TableHead className="text-right">Valore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nessun movimento trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((movement) => {
                    const typeInfo = getMovementTypeInfo(movement.movement_type);
                    const TypeIcon = typeInfo.icon;
                    
                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          {format(new Date(movement.created_at), "dd/MM/yyyy HH:mm", { locale: it })}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{movement.item_code}</div>
                            <div className="text-sm text-muted-foreground">{movement.item_name}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={typeInfo.color} className="gap-1">
                            <TypeIcon className="h-3 w-3" />
                            {typeInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={movement.quantity > 0 ? "text-green-600" : "text-red-600"}>
                            {movement.quantity > 0 ? "+" : ""}{movement.quantity} {movement.unit}
                          </span>
                        </TableCell>
                        <TableCell>
                          {movement.location_from && movement.location_to ? 
                            `${movement.location_from} → ${movement.location_to}` :
                            movement.location_from || movement.location_to || "-"
                          }
                        </TableCell>
                        <TableCell>{movement.reference_document || "-"}</TableCell>
                        <TableCell className="max-w-xs truncate" title={movement.reason}>
                          {movement.reason}
                        </TableCell>
                        <TableCell>{movement.user_name}</TableCell>
                        <TableCell className="text-right">
                          {movement.cost_per_unit ? 
                            `€${(Math.abs(movement.quantity) * movement.cost_per_unit).toFixed(2)}` : 
                            "-"
                          }
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
    </div>
  );
}