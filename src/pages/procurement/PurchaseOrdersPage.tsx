import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Plus, 
  Search, 
  Package, 
  Clock, 
  CheckCircle, 
  TrendingUp, 
  Eye,
  MessageSquare,
  Paperclip,
  Upload,
  Send,
  Copy,
  ExternalLink,
  X
} from "lucide-react";

interface PurchaseOrder {
  id: string;
  number: string;
  supplier_id: string;
  suppliers?: {
    name: string;
    access_code: string;
  };
  order_date: string;
  expected_delivery_date?: string;
  estimated_delivery_date?: string;
  total_amount: number;
  production_status: string;
  supplier_confirmed_at?: string;
  purchase_order_items?: any[];
  purchase_order_comments?: any[];
  purchase_order_attachments?: any[];
  purchase_order_change_requests?: any[];
}

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<PurchaseOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [newOrderDialogOpen, setNewOrderDialogOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [newOrder, setNewOrder] = useState({
    supplier_id: "",
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: "",
    notes: "",
    items: [] as Array<{ material_id: string; quantity: number; unit_price: number }>
  });
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [materialSelectorOpen, setMaterialSelectorOpen] = useState<{[key: number]: boolean}>({});

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchMaterials();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = orders.filter(order => 
        order.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.suppliers?.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOrders(filtered);
    } else {
      setFilteredOrders(orders);
    }
  }, [searchTerm, orders]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (
            name,
            access_code
          ),
          purchase_order_items (
            id,
            quantity,
            unit_price,
            material:materials (
              name,
              code
            )
          ),
          purchase_order_comments (
            id,
            comment,
            created_at,
            user_id,
            is_supplier,
            supplier_name
          ),
          purchase_order_attachments (
            id,
            file_name,
            file_url,
            uploaded_at
          ),
          purchase_order_change_requests (
            id,
            request_type,
            status,
            proposed_value,
            reason
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
      setFilteredOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast.error("Errore nel caricamento degli ordini");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: any = {
      pending: { label: "In Attesa", variant: "secondary", icon: Clock },
      confirmed: { label: "Confermato", variant: "default", icon: CheckCircle },
      in_production: { label: "In Produzione", variant: "default", icon: Package },
      shipped: { label: "Spedito", variant: "default", icon: CheckCircle },
      delivered: { label: "Consegnato", variant: "default", icon: CheckCircle },
      cancelled: { label: "Annullato", variant: "destructive", icon: Clock },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const copySupplierLink = (order: PurchaseOrder) => {
    const link = `https://erp.abbattitorizapper.it/supplier/${order.supplier_id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiato negli appunti");
  };
 
  const openSupplierPortal = (order: PurchaseOrder) => {
    const link = `https://erp.abbattitorizapper.it/supplier/${order.supplier_id}`;
    window.open(link, '_blank');
  };

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setSuppliers(data || []);
    } catch (error: any) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchMaterials = async () => {
    try {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setMaterials(data || []);
    } catch (error: any) {
      console.error('Error fetching materials:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedOrder || !newComment.trim()) return;

    setIsSubmittingComment(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('purchase_order_comments')
        .insert({
          purchase_order_id: selectedOrder.id,
          comment: newComment.trim(),
          user_id: user?.id,
          is_supplier: false
        });

      if (error) throw error;

      toast.success("Commento aggiunto");
      setNewComment("");
      fetchOrders();
      
      // Refresh selected order
      const { data: updatedOrder } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (name, access_code),
          purchase_order_items (*),
          purchase_order_comments (*),
          purchase_order_attachments (*),
          purchase_order_change_requests (*)
        `)
        .eq('id', selectedOrder.id)
        .single();
      
      if (updatedOrder) setSelectedOrder(updatedOrder);
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error("Errore nell'aggiunta del commento");
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCreateOrder = async () => {
    if (!newOrder.supplier_id || newOrder.items.length === 0) {
      toast.error("Seleziona un fornitore e aggiungi almeno un articolo");
      return;
    }

    setIsCreatingOrder(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Calculate total amount
      const totalAmount = newOrder.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      
      // Generate order number
      const orderNumber = `PO-${Date.now()}`;
      
      // Create purchase order
      const { data: order, error: orderError } = await supabase
        .from('purchase_orders')
        .insert({
          number: orderNumber,
          supplier_id: newOrder.supplier_id,
          order_date: newOrder.order_date,
          expected_delivery_date: newOrder.expected_delivery_date || null,
          estimated_delivery_date: newOrder.expected_delivery_date || null,
          total_amount: totalAmount,
          production_status: 'pending',
          notes: newOrder.notes || null,
          created_by: user?.id
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const itemsToInsert = newOrder.items.map(item => ({
        purchase_order_id: order.id,
        material_id: item.material_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));

      const { error: itemsError } = await supabase
        .from('purchase_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast.success("Ordine di acquisto creato con successo");
      setNewOrderDialogOpen(false);
      setNewOrder({
        supplier_id: "",
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: "",
        notes: "",
        items: []
      });
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error("Errore nella creazione dell'ordine");
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const addOrderItem = () => {
    setNewOrder(prev => ({
      ...prev,
      items: [...prev.items, { material_id: "", quantity: 1, unit_price: 0 }]
    }));
  };

  const removeOrderItem = (index: number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const updateOrderItem = (index: number, field: string, value: any) => {
    setNewOrder(prev => {
      const updatedItems = prev.items.map((item, i) => {
        if (i !== index) return item;
        
        // When material is selected, auto-populate unit price from material cost
        if (field === 'material_id' && value) {
          const selectedMaterial = materials.find(m => m.id === value);
          const unitPrice = selectedMaterial?.cost || 0;
          return { ...item, material_id: value, unit_price: unitPrice };
        }
        
        return { ...item, [field]: value };
      });
      
      return { ...prev, items: updatedItems };
    });
  };

  // Calculate KPIs
  const activeOrders = orders.filter(o => !['delivered', 'cancelled'].includes(o.production_status)).length;
  const inDelivery = orders.filter(o => ['shipped'].includes(o.production_status)).length;
  const delivered = orders.filter(o => o.production_status === 'delivered').length;
  const totalValue = orders
    .filter(o => !['cancelled'].includes(o.production_status))
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Ordini di Acquisto</h1>
          <p className="text-muted-foreground mt-1">Gestisci gli ordini di acquisto ai fornitori</p>
        </div>
        <Button className="gap-2" onClick={() => setNewOrderDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Nuovo Ordine
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ordini Attivi
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeOrders}</div>
            <p className="text-xs text-muted-foreground mt-1">In corso</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              In Consegna
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{inDelivery}</div>
            <p className="text-xs text-muted-foreground mt-1">Da ricevere</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Consegnati
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{delivered}</div>
            <p className="text-xs text-muted-foreground mt-1">Questo mese</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Valore Totale
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              €{totalValue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ordini attivi</p>
          </CardContent>
        </Card>
      </div>

      {/* Orders List */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Elenco Ordini</CardTitle>
              <CardDescription>Visualizza e gestisci tutti gli ordini di acquisto</CardDescription>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca ordini..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Fornitore</TableHead>
                  <TableHead>Data Ordine</TableHead>
                  <TableHead>Consegna</TableHead>
                  <TableHead>Articoli</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      Nessun ordine trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.number}</TableCell>
                      <TableCell>{order.suppliers?.name || '-'}</TableCell>
                      <TableCell>
                        {new Date(order.order_date).toLocaleDateString('it-IT')}
                      </TableCell>
                      <TableCell>
                        {order.expected_delivery_date 
                          ? new Date(order.expected_delivery_date).toLocaleDateString('it-IT')
                          : order.estimated_delivery_date
                          ? new Date(order.estimated_delivery_date).toLocaleDateString('it-IT')
                          : '-'}
                      </TableCell>
                      <TableCell>{order.purchase_order_items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        €{order.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.production_status)}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(order);
                            setDetailsDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedOrder?.number}</span>
              {selectedOrder && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copySupplierLink(selectedOrder)}
                    className="gap-2"
                  >
                    <Copy className="h-4 w-4" />
                    Copia Link
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openSupplierPortal(selectedOrder)}
                    className="gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Portale Fornitore
                  </Button>
                </div>
              )}
            </DialogTitle>
            <DialogDescription>
              Fornitore: {selectedOrder?.suppliers?.name} • {getStatusBadge(selectedOrder?.production_status || 'pending')}
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="details">Dettagli</TabsTrigger>
              <TabsTrigger value="comments">
                Commenti ({selectedOrder?.purchase_order_comments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="attachments">
                Allegati ({selectedOrder?.purchase_order_attachments?.length || 0})
              </TabsTrigger>
              <TabsTrigger value="changes">
                Modifiche ({selectedOrder?.purchase_order_change_requests?.filter(r => r.status === 'pending').length || 0})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="details" className="space-y-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Data Ordine</label>
                    <p className="text-sm">{selectedOrder && new Date(selectedOrder.order_date).toLocaleDateString('it-IT')}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Consegna Prevista</label>
                    <p className="text-sm">
                      {selectedOrder?.expected_delivery_date 
                        ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString('it-IT')
                        : '-'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Importo Totale</label>
                    <p className="text-lg font-bold">
                      €{selectedOrder?.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Confermato dal Fornitore</label>
                    <p className="text-sm">
                      {selectedOrder?.supplier_confirmed_at 
                        ? new Date(selectedOrder.supplier_confirmed_at).toLocaleDateString('it-IT')
                        : 'Non ancora confermato'}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Articoli Ordinati</h4>
                  <div className="space-y-2">
                    {selectedOrder?.purchase_order_items?.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-lg flex justify-between items-center">
                        <div>
                          <div className="font-medium">{item.material?.name || item.description}</div>
                          <div className="text-sm text-muted-foreground">
                            Codice: {item.material?.code || '-'} • Quantità: {item.quantity}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            €{item.unit_price?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Tot: €{(item.quantity * item.unit_price).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="comments" className="space-y-4 mt-0">
                <div className="space-y-3">
                  {selectedOrder?.purchase_order_comments?.map((comment: any) => (
                    <div key={comment.id} className={`p-3 rounded-lg ${comment.is_supplier ? 'bg-primary/5 border-primary/20' : 'bg-muted'} border`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">
                          {comment.is_supplier ? comment.supplier_name : 'Interno'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleString('it-IT')}
                        </span>
                      </div>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Textarea
                    placeholder="Aggiungi un commento..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="flex-1"
                    rows={2}
                  />
                  <Button 
                    onClick={handleAddComment}
                    disabled={isSubmittingComment || !newComment.trim()}
                    size="sm"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="attachments" className="space-y-4 mt-0">
                <div className="space-y-2">
                  {selectedOrder?.purchase_order_attachments?.map((attachment: any) => (
                    <div key={attachment.id} className="p-3 border rounded-lg flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">{attachment.file_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(attachment.uploaded_at).toLocaleString('it-IT')}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild>
                        <a href={attachment.file_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" className="w-full gap-2">
                  <Upload className="h-4 w-4" />
                  Carica Allegato
                </Button>
              </TabsContent>

              <TabsContent value="changes" className="space-y-4 mt-0">
                <div className="space-y-3">
                  {selectedOrder?.purchase_order_change_requests?.map((request: any) => (
                    <div key={request.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant={request.status === 'pending' ? 'secondary' : request.status === 'approved' ? 'default' : 'destructive'}>
                          {request.status === 'pending' ? 'In Attesa' : request.status === 'approved' ? 'Approvata' : 'Rifiutata'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{request.request_type}</span>
                      </div>
                      <p className="text-sm mb-2"><strong>Valore proposto:</strong> {request.proposed_value}</p>
                      {request.reason && (
                        <p className="text-sm text-muted-foreground">{request.reason}</p>
                      )}
                      {request.status === 'pending' && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="default">Approva</Button>
                          <Button size="sm" variant="destructive">Rifiuta</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* New Order Dialog */}
      <Dialog open={newOrderDialogOpen} onOpenChange={setNewOrderDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nuovo Ordine di Acquisto</DialogTitle>
            <DialogDescription>
              Crea un nuovo ordine di acquisto per un fornitore
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {/* Supplier Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Fornitore *</label>
                <Select
                  value={newOrder.supplier_id}
                  onValueChange={(value) => {
                    setNewOrder(prev => ({ 
                      ...prev, 
                      supplier_id: value,
                      // Reset items when supplier changes as materials are filtered by supplier
                      items: prev.supplier_id !== value ? [] : prev.items
                    }));
                    setMaterialSelectorOpen({});
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fornitore" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data Ordine *</label>
                  <Input
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, order_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Consegna Prevista</label>
                  <Input
                    type="date"
                    value={newOrder.expected_delivery_date}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <Textarea
                  placeholder="Note sull'ordine..."
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Articoli *</label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={addOrderItem}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Aggiungi Articolo
                  </Button>
                </div>

                {newOrder.items.length === 0 ? (
                  <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground">
                    Nessun articolo aggiunto. Clicca su "Aggiungi Articolo" per iniziare.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newOrder.items.map((item, index) => (
                      <div key={index} className="p-4 border rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Articolo {index + 1}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeOrderItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-1">
                            <label className="text-sm text-muted-foreground">Materiale</label>
                            <Popover 
                              open={materialSelectorOpen[index]} 
                              onOpenChange={(open) => setMaterialSelectorOpen(prev => ({ ...prev, [index]: open }))}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={materialSelectorOpen[index]}
                                  className="w-full justify-between"
                                >
                                  {item.material_id
                                    ? materials.find((m) => m.id === item.material_id)?.name
                                    : "Seleziona materiale..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0">
                                <Command>
                                  <CommandInput placeholder="Cerca materiale..." />
                                  <CommandList>
                                    <CommandEmpty>Nessun materiale trovato.</CommandEmpty>
                                    <CommandGroup>
                                      {materials
                                        .filter(material => !newOrder.supplier_id || material.supplier_id === newOrder.supplier_id)
                                        .map((material) => (
                                          <CommandItem
                                            key={material.id}
                                            value={material.name}
                                            onSelect={() => {
                                              updateOrderItem(index, 'material_id', material.id);
                                              setMaterialSelectorOpen(prev => ({ ...prev, [index]: false }));
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                item.material_id === material.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {material.name}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          <div>
                            <label className="text-sm text-muted-foreground">Quantità</label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateOrderItem(index, 'quantity', parseFloat(e.target.value) || 1)}
                            />
                          </div>

                          <div>
                            <label className="text-sm text-muted-foreground">Prezzo Unitario (€)</label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.unit_price}
                              onChange={(e) => updateOrderItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <span className="text-sm font-medium">
                            Totale: €{(item.quantity * item.unit_price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}

                    <div className="flex justify-end pt-3 border-t">
                      <div className="text-right">
                        <span className="text-sm text-muted-foreground">Totale Ordine: </span>
                        <span className="text-lg font-bold">
                          €{newOrder.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setNewOrderDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateOrder} disabled={isCreatingOrder}>
              {isCreatingOrder ? "Creazione..." : "Crea Ordine"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}