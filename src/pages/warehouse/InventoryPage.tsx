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
import { Progress } from "@/components/ui/progress";
import { Plus, Search, ClipboardCheck, Calendar, MapPin, Download, Upload } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface InventoryCount {
  id: string;
  name: string;
  description?: string;
  status: "planned" | "in_progress" | "completed" | "cancelled";
  scheduled_date: string;
  start_date?: string;
  completion_date?: string;
  location_filter?: string;
  category_filter?: string;
  created_by: string;
  assigned_to: string;
  total_items: number;
  counted_items: number;
  progress: number;
  discrepancies: number;
}

interface InventoryItem {
  id: string;
  inventory_id: string;
  item_code: string;
  item_name: string;
  location: string;
  system_quantity: number;
  counted_quantity?: number;
  unit: string;
  discrepancy: number;
  status: "pending" | "counted" | "verified";
  notes?: string;
  counted_by?: string;
  counted_at?: string;
}

export default function InventoryPage() {
  const [inventories, setInventories] = useState<InventoryCount[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [selectedInventory, setSelectedInventory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  useEffect(() => {
    const mockInventories: InventoryCount[] = [
      {
        id: "1",
        name: "Inventario Trimestrale Q1 2024",
        description: "Inventario completo di fine trimestre",
        status: "in_progress",
        scheduled_date: "2024-01-25",
        start_date: "2024-01-25T08:00:00Z",
        location_filter: "",
        category_filter: "",
        created_by: "Mario Rossi",
        assigned_to: "Team Magazzino",
        total_items: 150,
        counted_items: 95,
        progress: 63,
        discrepancies: 3
      },
      {
        id: "2",
        name: "Conteggio Filtri - Zona A",
        description: "Inventario specifico per categoria filtri",
        status: "completed",
        scheduled_date: "2024-01-15",
        start_date: "2024-01-15T09:00:00Z",
        completion_date: "2024-01-15T17:30:00Z",
        location_filter: "A-01",
        category_filter: "Filtri",
        created_by: "Laura Bianchi",
        assigned_to: "Giuseppe Verde",
        total_items: 50,
        counted_items: 50,
        progress: 100,
        discrepancies: 1
      },
      {
        id: "3",
        name: "Inventario Mensile Febbraio",
        description: "Conteggio mensile di routine",
        status: "planned",
        scheduled_date: "2024-02-01",
        location_filter: "",
        category_filter: "",
        created_by: "Mario Rossi",
        assigned_to: "Team Magazzino",
        total_items: 200,
        counted_items: 0,
        progress: 0,
        discrepancies: 0
      }
    ];

    const mockItems: InventoryItem[] = [
      {
        id: "1",
        inventory_id: "1",
        item_code: "ITM-001",
        item_name: "Filtro acqua standard",
        location: "A-01-A",
        system_quantity: 150,
        counted_quantity: 148,
        unit: "pcs",
        discrepancy: -2,
        status: "counted",
        notes: "Trovati 2 articoli danneggiati",
        counted_by: "Giuseppe Verde",
        counted_at: "2024-01-25T10:30:00Z"
      },
      {
        id: "2",
        inventory_id: "1",
        item_code: "ITM-002",
        item_name: "Cartuccia carboni attivi",
        location: "A-01-B",
        system_quantity: 75,
        counted_quantity: 78,
        unit: "pcs",
        discrepancy: 3,
        status: "counted",
        notes: "Trovati 3 articoli non registrati",
        counted_by: "Laura Bianchi",
        counted_at: "2024-01-25T11:15:00Z"
      },
      {
        id: "3",
        inventory_id: "1",
        item_code: "ITM-003",
        item_name: "Valvola di sicurezza",
        location: "B-02-A",
        system_quantity: 200,
        unit: "pcs",
        discrepancy: 0,
        status: "pending",
        notes: ""
      }
    ];

    setInventories(mockInventories);
    setInventoryItems(mockItems);
    setLoading(false);
  }, []);

  const filteredInventories = inventories.filter(inventory =>
    inventory.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inventory.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedInventoryDetails = selectedInventory ? 
    inventories.find(inv => inv.id === selectedInventory) : null;

  const selectedInventoryItems = selectedInventory ? 
    inventoryItems.filter(item => item.inventory_id === selectedInventory) : [];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "planned":
        return { label: "Pianificato", color: "outline" as const, icon: Calendar };
      case "in_progress":
        return { label: "In Corso", color: "default" as const, icon: ClipboardCheck };
      case "completed":
        return { label: "Completato", color: "default" as const, icon: ClipboardCheck };
      case "cancelled":
        return { label: "Annullato", color: "destructive" as const, icon: Calendar };
      default:
        return { label: "Sconosciuto", color: "outline" as const, icon: Calendar };
    }
  };

  const getItemStatusInfo = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "Da contare", color: "outline" as const };
      case "counted":
        return { label: "Contato", color: "default" as const };
      case "verified":
        return { label: "Verificato", color: "default" as const };
      default:
        return { label: "Sconosciuto", color: "outline" as const };
    }
  };

  const inventorySummary = {
    totalInventories: inventories.length,
    activeInventories: inventories.filter(inv => inv.status === "in_progress").length,
    completedInventories: inventories.filter(inv => inv.status === "completed").length
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventari Fisici</h1>
          <p className="text-muted-foreground">
            Pianifica e gestisci i conteggi di inventario fisico
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Inventario
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nuovo Inventario Fisico</DialogTitle>
                <DialogDescription>
                  Pianifica un nuovo conteggio di inventario
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Inventario</Label>
                  <Input id="name" placeholder="Es: Inventario Mensile Marzo" />
                </div>
                <div>
                  <Label htmlFor="description">Descrizione</Label>
                  <Textarea id="description" placeholder="Descrizione opzionale" rows={2} />
                </div>
                <div>
                  <Label htmlFor="scheduled-date">Data Programmata</Label>
                  <Input id="scheduled-date" type="date" />
                </div>
                <div>
                  <Label htmlFor="assigned-to">Assegnato a</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona responsabile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="team">Team Magazzino</SelectItem>
                      <SelectItem value="giuseppe">Giuseppe Verde</SelectItem>
                      <SelectItem value="laura">Laura Bianchi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="location-filter">Filtro Ubicazione (opzionale)</Label>
                  <Input id="location-filter" placeholder="Es: A-01" />
                </div>
                <div>
                  <Label htmlFor="category-filter">Filtro Categoria (opzionale)</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Tutte le categorie" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutte le categorie</SelectItem>
                      <SelectItem value="filtri">Filtri</SelectItem>
                      <SelectItem value="cartucce">Cartucce</SelectItem>
                      <SelectItem value="valvole">Valvole</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={() => setIsDialogOpen(false)}>
                    Crea Inventario
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventari Totali</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inventorySummary.totalInventories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Corso</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inventorySummary.activeInventories}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completati</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{inventorySummary.completedInventories}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca inventari..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
        </CardContent>
      </Card>

      {/* Inventories List */}
      <Card>
        <CardHeader>
          <CardTitle>Inventari Fisici</CardTitle>
          <CardDescription>
            {filteredInventories.length} di {inventories.length} inventari
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Data Programmata</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Articoli</TableHead>
                  <TableHead>Discrepanze</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Caricamento...
                    </TableCell>
                  </TableRow>
                ) : filteredInventories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessun inventario trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInventories.map((inventory) => {
                    const statusInfo = getStatusInfo(inventory.status);
                    const StatusIcon = statusInfo.icon;
                    
                    return (
                      <TableRow key={inventory.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{inventory.name}</div>
                            {inventory.description && (
                              <div className="text-sm text-muted-foreground">{inventory.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(inventory.scheduled_date), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>{inventory.assigned_to}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={inventory.progress} className="h-2" />
                            <div className="text-xs text-muted-foreground">
                              {inventory.counted_items}/{inventory.total_items} ({inventory.progress}%)
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{inventory.total_items}</TableCell>
                        <TableCell className="text-center">
                          {inventory.discrepancies > 0 ? (
                            <Badge variant="destructive">{inventory.discrepancies}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusInfo.color} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setSelectedInventory(
                              selectedInventory === inventory.id ? null : inventory.id
                            )}
                          >
                            {selectedInventory === inventory.id ? "Chiudi" : "Dettagli"}
                          </Button>
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

      {/* Inventory Details */}
      {selectedInventoryDetails && (
        <Card>
          <CardHeader>
            <CardTitle>Dettagli Inventario: {selectedInventoryDetails.name}</CardTitle>
            <CardDescription>
              Articoli da contare per questo inventario
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Codice</TableHead>
                    <TableHead>Nome Articolo</TableHead>
                    <TableHead>Ubicazione</TableHead>
                    <TableHead className="text-right">Qtà Sistema</TableHead>
                    <TableHead className="text-right">Qtà Contata</TableHead>
                    <TableHead className="text-right">Differenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Contato da</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedInventoryItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nessun articolo in questo inventario
                      </TableCell>
                    </TableRow>
                  ) : (
                    selectedInventoryItems.map((item) => {
                      const itemStatusInfo = getItemStatusInfo(item.status);
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_code}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {item.location}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">{item.system_quantity} {item.unit}</TableCell>
                          <TableCell className="text-right">
                            {item.counted_quantity !== undefined ? 
                              `${item.counted_quantity} ${item.unit}` : 
                              "-"
                            }
                          </TableCell>
                          <TableCell className="text-right">
                            {item.discrepancy !== 0 ? (
                              <span className={item.discrepancy > 0 ? "text-green-600" : "text-red-600"}>
                                {item.discrepancy > 0 ? "+" : ""}{item.discrepancy} {item.unit}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={itemStatusInfo.color}>
                              {itemStatusInfo.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.counted_by ? (
                              <div>
                                <div className="font-medium">{item.counted_by}</div>
                                {item.counted_at && (
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(item.counted_at), "dd/MM HH:mm", { locale: it })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              "-"
                            )}
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
      )}
    </div>
  );
}