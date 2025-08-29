import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ShoppingCart, Calendar, TrendingUp, Package, Eye, Edit, Trash2, Building2, Archive, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PurchaseOrder {
  id: string;
  number: string;
  supplier_id: string;
  supplier_name?: string;
  order_date: string;
  expected_delivery_date: string | null;
  status: "draft" | "pending" | "confirmed" | "partial" | "delivered" | "cancelled" | "archived";
  total_amount: number;
  notes?: string;
  created_at: string;
}

interface PurchaseOrderItem {
  id: string;
  material_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

const PurchaseOrdersPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseOrders();
  }, []);

  const fetchPurchaseOrders = async () => {
    try {
      // Fetch purchase orders with supplier data
      const { data: ordersData, error: ordersError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers!purchase_orders_supplier_id_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (ordersError) {
        console.error('Error fetching purchase orders:', ordersError);
        toast({
          title: "Errore",
          description: "Errore nel caricamento degli ordini di acquisto",
          variant: "destructive",
        });
        return;
      }

      // Transform data to match interface
      const transformedOrders: PurchaseOrder[] = (ordersData || []).map(order => ({
        id: order.id,
        number: order.number,
        supplier_id: order.supplier_id,
        supplier_name: order.suppliers?.name || 'Fornitore sconosciuto',
        order_date: order.order_date,
        expected_delivery_date: order.expected_delivery_date,
        status: order.status as PurchaseOrder['status'],
        total_amount: order.total_amount || 0,
        notes: order.notes,
        created_at: order.created_at
      }));

      setPurchaseOrders(transformedOrders);
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli ordini di acquisto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusVariant = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "draft": return "secondary";
      case "pending": return "outline";
      case "confirmed": return "default";
      case "partial": return "destructive";
      case "delivered": return "default";
      case "cancelled": return "secondary";
      case "archived": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: PurchaseOrder['status']) => {
    switch (status) {
      case "draft": return "Bozza";
      case "pending": return "In Attesa";
      case "confirmed": return "Confermato";
      case "partial": return "Parziale";
      case "delivered": return "Consegnato";
      case "cancelled": return "Annullato";
      case "archived": return "Archiviato";
      default: return status;
    }
  };

  const filteredOrders = purchaseOrders.filter(order =>
    order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (order.supplier_name && order.supplier_name.toLowerCase().includes(searchTerm.toLowerCase()))
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

  const handleArchiveOrder = async (order: PurchaseOrder) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ status: 'archived' })
        .eq('id', order.id);

      if (error) {
        console.error('Error archiving order:', error);
        toast({
          title: "Errore",
          description: "Errore nell'archiviazione dell'ordine",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Ordine archiviato",
        description: `L'ordine ${order.number} è stato archiviato con successo.`,
      });

      // Refresh the orders list
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error archiving order:', error);
      toast({
        title: "Errore",
        description: "Errore nell'archiviazione dell'ordine",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (order: PurchaseOrder) => {
    try {
      // First delete related confirmations
      const { error: confirmationError } = await supabase
        .from('purchase_order_confirmations')
        .delete()
        .eq('purchase_order_id', order.id);

      if (confirmationError) {
        console.error('Error deleting confirmations:', confirmationError);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione delle conferme correlate",
          variant: "destructive",
        });
        return;
      }

      // Then delete order items
      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .delete()
        .eq('purchase_order_id', order.id);

      if (itemsError) {
        console.error('Error deleting order items:', itemsError);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione degli articoli dell'ordine",
          variant: "destructive",
        });
        return;
      }

      // Finally delete the order
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', order.id);

      if (error) {
        console.error('Error deleting order:', error);
        toast({
          title: "Errore",
          description: "Errore nell'eliminazione dell'ordine",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Ordine eliminato",
        description: `L'ordine ${order.number} è stato eliminato definitivamente.`,
      });

      // Refresh the orders list
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione dell'ordine",
        variant: "destructive",
      });
    }
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
              €{purchaseOrders.reduce((acc, o) => acc + o.total_amount, 0).toLocaleString()}
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
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Caricamento...
                  </TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">
                    Nessun ordine trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.number}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {order.supplier_name}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {order.expected_delivery_date 
                        ? new Date(order.expected_delivery_date).toLocaleDateString()
                        : "Non specificata"
                      }
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">Da calcolare</span>
                    </TableCell>
                    <TableCell>€{order.total_amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(order.status)}>
                        {getStatusLabel(order.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewOrder(order)}
                          title="Visualizza ordine"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditOrder(order)}
                          title="Modifica ordine"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {order.status !== 'archived' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Archivia ordine"
                              >
                                <Archive className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archivia ordine</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sei sicuro di voler archiviare l'ordine {order.number}?
                                  L'ordine sarà marcato come archiviato ma non verrà eliminato.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleArchiveOrder(order)}>
                                  Archivia
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Elimina ordine"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-destructive" />
                                Elimina ordine
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                <strong>Attenzione!</strong> Sei sicuro di voler eliminare definitivamente l'ordine {order.number}?
                                <br /><br />
                                Questa azione non può essere annullata e rimuoverà:
                                <ul className="list-disc list-inside mt-2 space-y-1">
                                  <li>L'ordine di acquisto</li>
                                  <li>Tutti gli articoli associati</li>
                                  <li>Le conferme del fornitore</li>
                                </ul>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDeleteOrder(order)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Elimina definitivamente
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
        </CardContent>
      </Card>
    </div>
  );
};

export default PurchaseOrdersPage;