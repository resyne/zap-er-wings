import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Package, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface StockItem {
  id: string;
  code: string;
  name: string;
  description?: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  min_stock: number;
  max_stock: number;
  location: string;
  category?: string;
  unit: string;
  cost: number;
  price: number;
  last_movement_date?: string;
}

export default function StockPage() {
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Mock data for now - replace with real data from items table + stock calculations
  useEffect(() => {
    const mockData: StockItem[] = [
      {
        id: "1",
        code: "ITM-001",
        name: "Filtro acqua standard",
        description: "Filtro acqua per impianti domestici",
        quantity: 150,
        reserved_quantity: 20,
        available_quantity: 130,
        min_stock: 50,
        max_stock: 200,
        location: "A-01-A",
        category: "Filtri",
        unit: "pcs",
        cost: 15.50,
        price: 25.00,
        last_movement_date: "2024-01-20"
      },
      {
        id: "2",
        code: "ITM-002",
        name: "Cartuccia carboni attivi",
        description: "Cartuccia per filtrazione carboni attivi",
        quantity: 25,
        reserved_quantity: 5,
        available_quantity: 20,
        min_stock: 30,
        max_stock: 100,
        location: "A-01-B",
        category: "Cartucce",
        unit: "pcs",
        cost: 8.75,
        price: 15.00,
        last_movement_date: "2024-01-18"
      },
      {
        id: "3",
        code: "ITM-003",
        name: "Valvola di sicurezza",
        description: "Valvola di sicurezza per impianti",
        quantity: 200,
        reserved_quantity: 0,
        available_quantity: 200,
        min_stock: 20,
        max_stock: 300,
        location: "B-02-A",
        category: "Valvole",
        unit: "pcs",
        cost: 45.00,
        price: 75.00,
        last_movement_date: "2024-01-15"
      }
    ];
    
    setStockItems(mockData);
    setLoading(false);
  }, []);

  const filteredItems = stockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (item: StockItem) => {
    if (item.available_quantity <= item.min_stock) {
      return { status: "low", color: "destructive", icon: AlertTriangle };
    }
    if (item.available_quantity >= item.max_stock) {
      return { status: "high", color: "secondary", icon: TrendingUp };
    }
    return { status: "normal", color: "default", icon: Package };
  };

  const categories = [...new Set(stockItems.map(item => item.category).filter(Boolean))];

  const stockSummary = {
    totalItems: stockItems.length,
    lowStock: stockItems.filter(item => item.available_quantity <= item.min_stock).length,
    totalValue: stockItems.reduce((sum, item) => sum + (item.quantity * item.cost), 0)
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestione Stock</h1>
          <p className="text-muted-foreground">
            Monitora le scorte di magazzino e i livelli di inventario
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Movimento Stock
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                    {stockItems.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.code} - {item.name}
                      </SelectItem>
                    ))}
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
                <Label htmlFor="reason">Motivo</Label>
                <Input id="reason" placeholder="Descrizione movimento" />
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={() => setIsDialogOpen(false)}>
                  Conferma
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Articoli Totali</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stockSummary.totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scorte Basse</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stockSummary.lowStock}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{stockSummary.totalValue.toFixed(2)}</div>
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
                  placeholder="Cerca per nome o codice..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutte le categorie</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category || ""}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventario Stock</CardTitle>
          <CardDescription>
            {filteredItems.length} di {stockItems.length} articoli
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Codice</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ubicazione</TableHead>
                  <TableHead className="text-right">Disponibile</TableHead>
                  <TableHead className="text-right">Riservato</TableHead>
                  <TableHead className="text-right">Totale</TableHead>
                  <TableHead>Stato</TableHead>
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
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Nessun articolo trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const stockStatus = getStockStatus(item);
                    const StatusIcon = stockStatus.icon;
                    
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.code}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            {item.description && (
                              <div className="text-sm text-muted-foreground">{item.description}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{item.location}</TableCell>
                        <TableCell className="text-right">{item.available_quantity} {item.unit}</TableCell>
                        <TableCell className="text-right">{item.reserved_quantity} {item.unit}</TableCell>
                        <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                        <TableCell>
                          <Badge variant={stockStatus.color as any} className="gap-1">
                            <StatusIcon className="h-3 w-3" />
                            {stockStatus.status === "low" ? "Scorta bassa" : 
                             stockStatus.status === "high" ? "Scorta alta" : "Normale"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          €{(item.quantity * item.cost).toFixed(2)}
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