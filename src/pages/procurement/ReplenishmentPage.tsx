import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, RefreshCw, AlertTriangle, TrendingDown, Package, Eye, ShoppingCart, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReplenishmentItem {
  id: string;
  itemCode: string;
  itemName: string;
  category: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  suggestedOrder: number;
  lastOrderDate: string;
  supplier: string;
  leadTime: number;
  priority: "low" | "medium" | "high" | "critical";
  cost: number;
  status: "ok" | "low" | "critical" | "out_of_stock";
}

const ReplenishmentPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const replenishmentItems: ReplenishmentItem[] = [
    {
      id: "1",
      itemCode: "ITM001",
      itemName: "Vite M6x20",
      category: "Ferramenta",
      currentStock: 150,
      minStock: 200,
      maxStock: 1000,
      suggestedOrder: 500,
      lastOrderDate: "2024-01-15",
      supplier: "Acme Corporation",
      leadTime: 7,
      priority: "medium",
      cost: 0.15,
      status: "low"
    },
    {
      id: "2",
      itemCode: "ITM002",
      itemName: "Scheda controllo XYZ",
      category: "Elettronica",
      currentStock: 5,
      minStock: 10,
      maxStock: 50,
      suggestedOrder: 25,
      lastOrderDate: "2024-01-10",
      supplier: "Tech Solutions Ltd",
      leadTime: 14,
      priority: "high",
      cost: 125.50,
      status: "critical"
    },
    {
      id: "3",
      itemCode: "ITM003",
      itemName: "Guarnizione OR-100",
      category: "Ricambi",
      currentStock: 0,
      minStock: 25,
      maxStock: 100,
      suggestedOrder: 50,
      lastOrderDate: "2024-01-05",
      supplier: "Global Supplies Inc",
      leadTime: 10,
      priority: "critical",
      cost: 3.25,
      status: "out_of_stock"
    },
    {
      id: "4",
      itemCode: "ITM004",
      itemName: "Motore passo-passo",
      category: "Meccanica",
      currentStock: 8,
      minStock: 5,
      maxStock: 30,
      suggestedOrder: 15,
      lastOrderDate: "2024-02-01",
      supplier: "Industrial Parts Co",
      leadTime: 21,
      priority: "low",
      cost: 89.99,
      status: "ok"
    }
  ];

  const getStatusVariant = (status: ReplenishmentItem['status']) => {
    switch (status) {
      case "ok": return "default";
      case "low": return "secondary";
      case "critical": return "destructive";
      case "out_of_stock": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: ReplenishmentItem['status']) => {
    switch (status) {
      case "ok": return "OK";
      case "low": return "Scorta Bassa";
      case "critical": return "Critico";
      case "out_of_stock": return "Esaurito";
      default: return status;
    }
  };

  const getPriorityVariant = (priority: ReplenishmentItem['priority']) => {
    switch (priority) {
      case "low": return "outline";
      case "medium": return "secondary";
      case "high": return "default";
      case "critical": return "destructive";
      default: return "outline";
    }
  };

  const getPriorityLabel = (priority: ReplenishmentItem['priority']) => {
    switch (priority) {
      case "low": return "Bassa";
      case "medium": return "Media";
      case "high": return "Alta";
      case "critical": return "Critica";
      default: return priority;
    }
  };

  const filteredItems = replenishmentItems.filter(item =>
    item.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleGenerateOrders = () => {
    toast({
      title: "Funzione non implementata",
      description: "La generazione automatica degli ordini sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleViewItem = (item: ReplenishmentItem) => {
    toast({
      title: "Funzione non implementata",
      description: `Visualizzazione dettagli ${item.itemCode} sarà implementata presto.`,
    });
  };

  const handleCreateOrder = (item: ReplenishmentItem) => {
    toast({
      title: "Funzione non implementata",
      description: `Creazione ordine per ${item.itemCode} sarà implementata presto.`,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestione Scorte</h1>
          <p className="text-muted-foreground">
            Monitora e gestisci il rifornimento delle scorte
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Genera Ordini
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Genera Ordini di Rifornimento</DialogTitle>
              <DialogDescription>
                Genera automaticamente gli ordini per tutti gli articoli sotto scorta.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Sistema di generazione automatica ordini in fase di implementazione...
              </p>
              <Button onClick={handleGenerateOrders} className="w-full">
                Genera Ordini Automatici
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articoli Critici</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {replenishmentItems.filter(i => i.status === 'critical' || i.status === 'out_of_stock').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da ordinare subito
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scorte Basse</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {replenishmentItems.filter(i => i.status === 'low').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da monitorare
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Suggerito</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{replenishmentItems.reduce((acc, i) => acc + (i.suggestedOrder * i.cost), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ordini suggeriti
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Time Medio</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(replenishmentItems.reduce((acc, i) => acc + i.leadTime, 0) / replenishmentItems.length)} gg
            </div>
            <p className="text-xs text-muted-foreground">
              Tempo consegna
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stato Scorte</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutti gli articoli che necessitano rifornimento
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca articoli..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Articolo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Scorte</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Ordine Suggerito</TableHead>
                <TableHead>Priorità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.itemCode}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{item.itemName}</div>
                      <div className="text-sm text-muted-foreground">€{item.cost.toFixed(2)}</div>
                    </div>
                  </TableCell>
                  <TableCell>{item.category}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-sm">
                        Attuale: <span className={item.currentStock <= item.minStock ? "text-red-500 font-medium" : ""}>{item.currentStock}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Min: {item.minStock} | Max: {item.maxStock}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="text-sm">{item.supplier}</div>
                      <div className="text-xs text-muted-foreground">{item.leadTime} giorni</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {item.suggestedOrder} pz
                    </div>
                    <div className="text-xs text-muted-foreground">
                      €{(item.suggestedOrder * item.cost).toFixed(2)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getPriorityVariant(item.priority)}>
                      {getPriorityLabel(item.priority)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-1">
                      {item.status === 'critical' || item.status === 'out_of_stock' ? (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      ) : item.status === 'low' ? (
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      ) : null}
                      <Badge variant={getStatusVariant(item.status)}>
                        {getStatusLabel(item.status)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewItem(item)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCreateOrder(item)}
                        disabled={item.status === 'ok'}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReplenishmentPage;