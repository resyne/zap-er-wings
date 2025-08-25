import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ShoppingCart, Calendar, TrendingUp, Package, Eye, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PurchaseOrder {
  id: string;
  number: string;
  supplier: string;
  orderDate: string;
  deliveryDate: string;
  status: "draft" | "sent" | "confirmed" | "partial" | "delivered" | "cancelled";
  totalItems: number;
  totalAmount: number;
}

const PurchaseOrdersPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const purchaseOrders: PurchaseOrder[] = [
    {
      id: "1",
      number: "PO-2024-001",
      supplier: "Acme Corporation",
      orderDate: "2024-01-15",
      deliveryDate: "2024-02-15",
      status: "confirmed",
      totalItems: 25,
      totalAmount: 45000
    },
    {
      id: "2",
      number: "PO-2024-002",
      supplier: "Tech Solutions Ltd",
      orderDate: "2024-01-20",
      deliveryDate: "2024-02-20",
      status: "partial",
      totalItems: 12,
      totalAmount: 28500
    },
    {
      id: "3",
      number: "PO-2024-003",
      supplier: "Global Supplies Inc",
      orderDate: "2024-01-25",
      deliveryDate: "2024-02-25",
      status: "sent",
      totalItems: 8,
      totalAmount: 15200
    },
    {
      id: "4",
      number: "PO-2024-004",
      supplier: "Industrial Parts Co",
      orderDate: "2024-01-30",
      deliveryDate: "2024-03-01",
      status: "delivered",
      totalItems: 18,
      totalAmount: 32100
    }
  ];

  const getStatusVariant = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "draft": return "secondary";
      case "sent": return "outline";
      case "confirmed": return "default";
      case "partial": return "destructive";
      case "delivered": return "default";
      case "cancelled": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "draft": return "Bozza";
      case "sent": return "Inviato";
      case "confirmed": return "Confermato";
      case "partial": return "Parziale";
      case "delivered": return "Consegnato";
      case "cancelled": return "Annullato";
      default: return status;
    }
  };

  const filteredOrders = purchaseOrders.filter(order =>
    order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.supplier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateOrder = () => {
    toast({
      title: "Funzione non implementata",
      description: "La creazione di nuovi ordini di acquisto sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleViewOrder = (order: PurchaseOrder) => {
    toast({
      title: "Funzione non implementata",
      description: `Visualizzazione ordine ${order.number} sarà implementata presto.`,
    });
  };

  const handleEditOrder = (order: PurchaseOrder) => {
    toast({
      title: "Funzione non implementata",
      description: `Modifica ordine ${order.number} sarà implementata presto.`,
    });
  };

  const handleDeleteOrder = (order: PurchaseOrder) => {
    toast({
      title: "Funzione non implementata",
      description: `Eliminazione ordine ${order.number} sarà implementata presto.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordini di Acquisto</h1>
          <p className="text-muted-foreground">
            Gestisci gli ordini di acquisto ai fornitori
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Ordine
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crea Nuovo Ordine di Acquisto</DialogTitle>
              <DialogDescription>
                Inserisci i dati per il nuovo ordine di acquisto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Form di creazione ordine in fase di implementazione...
              </p>
              <Button onClick={handleCreateOrder} className="w-full">
                Crea Ordine
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini Attivi</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              In corso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Consegna</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter(o => ['confirmed', 'partial'].includes(o.status)).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Da ricevere
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consegnati</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {purchaseOrders.filter(o => o.status === 'delivered').length}
            </div>
            <p className="text-xs text-muted-foreground">
              Questo mese
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{purchaseOrders.reduce((acc, o) => acc + o.totalAmount, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Ordini attivi
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Ordini</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutti gli ordini di acquisto
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca ordini..."
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
                <TableHead>Numero</TableHead>
                <TableHead>Fornitore</TableHead>
                <TableHead>Data Ordine</TableHead>
                <TableHead>Consegna</TableHead>
                <TableHead>Articoli</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.number}</TableCell>
                  <TableCell>{order.supplier}</TableCell>
                  <TableCell>{new Date(order.orderDate).toLocaleDateString()}</TableCell>
                  <TableCell>{new Date(order.deliveryDate).toLocaleDateString()}</TableCell>
                  <TableCell>{order.totalItems}</TableCell>
                  <TableCell>€{order.totalAmount.toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(order.status)}>
                      {getStatusLabel(order.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewOrder(order)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditOrder(order)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteOrder(order)}
                      >
                        <Trash2 className="h-4 w-4" />
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

export default PurchaseOrdersPage;