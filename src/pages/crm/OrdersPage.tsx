import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ShoppingCart, Calendar, DollarSign, Package } from "lucide-react";

interface Order {
  id: string;
  number: string;
  customer_id?: string;
  quote_id?: string;
  order_date?: string;
  delivery_date?: string;
  subtotal?: number;
  tax_amount?: number;
  total_amount?: number;
  status?: string;
  notes?: string;
  created_at: string;
}

const orderStatuses = ["draft", "confirmed", "in_production", "shipped", "delivered", "cancelled"];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({
    number: "",
    customer_id: "",
    quote_id: "",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    subtotal: "",
    tax_amount: "",
    total_amount: "",
    status: "draft",
    notes: "",
    order_type: "production", // production or field_service
  });
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
    loadCustomersAndQuotes();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare gli ordini: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCustomersAndQuotes = async () => {
    try {
      const [customersResponse, quotesResponse] = await Promise.all([
        supabase.from("customers").select("id, name, code").eq("active", true),
        supabase.from("quotes").select("id, number").eq("status", "approved")
      ]);

      if (customersResponse.error) throw customersResponse.error;
      if (quotesResponse.error) throw quotesResponse.error;

      setCustomers(customersResponse.data || []);
      setQuotes(quotesResponse.data || []);
    } catch (error: any) {
      console.error("Error loading customers/quotes:", error);
    }
  };

  const handleCreateOrder = async () => {
    try {
      const orderData = {
        ...newOrder,
        customer_id: newOrder.customer_id || null,
        quote_id: newOrder.quote_id || null,
        subtotal: newOrder.subtotal ? parseFloat(newOrder.subtotal) : null,
        tax_amount: newOrder.tax_amount ? parseFloat(newOrder.tax_amount) : null,
        total_amount: newOrder.total_amount ? parseFloat(newOrder.total_amount) : null,
        delivery_date: newOrder.delivery_date || null,
      };

      const { error } = await supabase
        .from("sales_orders")
        .insert([orderData]);

      if (error) throw error;

      toast({
        title: "Ordine creato",
        description: "L'ordine è stato creato con successo",
      });

      setIsDialogOpen(false);
      setNewOrder({
        number: "",
        customer_id: "",
        quote_id: "",
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        subtotal: "",
        tax_amount: "",
        total_amount: "",
        status: "draft",
        notes: "",
        order_type: "production",
      });
      await loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "delivered":
        return "default";
      case "cancelled":
        return "destructive";
      case "shipped":
        return "secondary";
      case "confirmed":
        return "outline";
      default:
        return "outline";
    }
  };

  const filteredOrders = orders.filter(order =>
    `${order.number} ${order.notes || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const deliveredOrders = filteredOrders.filter(order => order.status === "delivered");
  const deliveredValue = deliveredOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const shippedOrders = filteredOrders.filter(order => order.status === "shipped");

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento ordini...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ordini</h1>
          <p className="text-muted-foreground">Gestisci gli ordini di vendita e la produzione</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Ordine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Ordine</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="number">Numero Ordine *</Label>
                <Input
                  id="number"
                  value={newOrder.number}
                  onChange={(e) => setNewOrder({...newOrder, number: e.target.value})}
                  placeholder="SO-2024-001"
                  required
                />
              </div>
              <div>
                <Label htmlFor="customer_id">Cliente</Label>
                <Select value={newOrder.customer_id} onValueChange={(value) => setNewOrder({...newOrder, customer_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} ({customer.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="quote_id">Preventivo Collegato</Label>
                <Select value={newOrder.quote_id} onValueChange={(value) => setNewOrder({...newOrder, quote_id: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona preventivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {quotes.map(quote => (
                      <SelectItem key={quote.id} value={quote.id}>
                        {quote.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="order_type">Tipo Ordine</Label>
                <Select value={newOrder.order_type} onValueChange={(value) => setNewOrder({...newOrder, order_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production Order</SelectItem>
                    <SelectItem value="field_service">Work Order (Field Service)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Stato</Label>
                <Select value={newOrder.status} onValueChange={(value) => setNewOrder({...newOrder, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderStatuses.map(status => (
                      <SelectItem key={status} value={status}>
                        {status.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="order_date">Data Ordine</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={newOrder.order_date}
                  onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="delivery_date">Data Consegna</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={newOrder.delivery_date}
                  onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                />
              </div>
              <div>
                <Label htmlFor="subtotal">Subtotale (€)</Label>
                <Input
                  id="subtotal"
                  type="number"
                  step="0.01"
                  value={newOrder.subtotal}
                  onChange={(e) => setNewOrder({...newOrder, subtotal: e.target.value})}
                  placeholder="1000.00"
                />
              </div>
              <div>
                <Label htmlFor="tax_amount">IVA (€)</Label>
                <Input
                  id="tax_amount"
                  type="number"
                  step="0.01"
                  value={newOrder.tax_amount}
                  onChange={(e) => setNewOrder({...newOrder, tax_amount: e.target.value})}
                  placeholder="220.00"
                />
              </div>
              <div>
                <Label htmlFor="total_amount">Totale (€)</Label>
                <Input
                  id="total_amount"
                  type="number"
                  step="0.01"
                  value={newOrder.total_amount}
                  onChange={(e) => setNewOrder({...newOrder, total_amount: e.target.value})}
                  placeholder="1220.00"
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="notes">Note</Label>
                <Input
                  id="notes"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                  placeholder="Note aggiuntive..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateOrder} disabled={!newOrder.number}>
                Crea Ordine
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredOrders.length} ordini totali
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consegnati</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{deliveredValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {deliveredOrders.length} ordini consegnati
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Spedizione</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shippedOrders.length}</div>
            <p className="text-xs text-muted-foreground">
              Ordini in corso di spedizione
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso Consegna</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredOrders.length > 0 ? Math.round((deliveredOrders.length / filteredOrders.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Ordini consegnati vs totali
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Ordini ({filteredOrders.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca ordini..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Data Ordine</TableHead>
                <TableHead>Consegna</TableHead>
                <TableHead>Subtotale</TableHead>
                <TableHead>IVA</TableHead>
                <TableHead>Totale</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <ShoppingCart className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">{order.number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.order_date && (
                      <span className="text-sm">
                        {new Date(order.order_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.delivery_date && (
                      <span className="text-sm">
                        {new Date(order.delivery_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.subtotal && (
                      <span className="text-sm">€{order.subtotal.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.tax_amount && (
                      <span className="text-sm">€{order.tax_amount.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.total_amount && (
                      <span className="font-medium">€{order.total_amount.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.status && (
                      <Badge variant={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun ordine trovato" : "Nessun ordine presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}