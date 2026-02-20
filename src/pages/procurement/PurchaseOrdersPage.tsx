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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { DesignRequestsSection } from "@/components/supplier-portal/DesignRequestsSection";
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
  X,
  Archive,
  Trash2,
  Pencil,
  Save
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
  priority?: string;
  supplier_confirmed_at?: string;
  purchase_order_items?: any[];
  purchase_order_comments?: any[];
  purchase_order_attachments?: any[];
  purchase_order_change_requests?: any[];
}

const priorityConfig = {
  urgente: { label: "Urgente", color: "bg-red-500 text-white" },
  alta: { label: "Alta", color: "bg-orange-500 text-white" },
  media: { label: "Media", color: "bg-yellow-500 text-white" },
  bassa: { label: "Bassa", color: "bg-blue-500 text-white" },
};

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
    priority: "media",
    items: [] as Array<{ material_id: string; quantity: number; unit_price: number }>
  });
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [materialSelectorOpen, setMaterialSelectorOpen] = useState<{[key: number]: boolean}>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<PurchaseOrder | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    notes: "",
    expected_delivery_date: "",
    priority: "",
    items: [] as Array<{ id?: string; material_id: string; quantity: number; unit_price: number }>
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchSuppliers();
    fetchMaterials();
  }, [showArchived]);

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

  // Real-time subscription for purchase order comments
  useEffect(() => {
    if (!selectedOrder) return;

    const channel = supabase
      .channel('purchase-order-comments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'purchase_order_comments',
          filter: `purchase_order_id=eq.${selectedOrder.id}`
        },
        async (payload) => {
          console.log('Comment change detected:', payload);
          
          // Refresh the selected order to get updated comments
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
          
          if (updatedOrder) {
            setSelectedOrder(updatedOrder);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedOrder]);

  const fetchOrders = async () => {
    try {
      let query = supabase
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
        `);
      
      // Filter by archived status
      if (!showArchived) {
        query = query.or('archived.is.null,archived.eq.false');
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

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

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ 
          production_status: newStatus,
          ...(newStatus === 'delivered' ? { actual_delivery_date: new Date().toISOString() } : {})
        })
        .eq('id', orderId);

      if (error) throw error;
      
      toast.success("Stato aggiornato con successo");
      fetchOrders();
      
      // Update selected order if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, production_status: newStatus });
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error("Errore nell'aggiornamento dello stato");
    }
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
      // Call edge function to create order and send email
      const { data, error } = await supabase.functions.invoke('create-purchase-order', {
        body: {
          supplier_id: newOrder.supplier_id,
          order_date: newOrder.order_date,
          expected_delivery_date: newOrder.expected_delivery_date || null,
          notes: newOrder.notes || null,
          priority: newOrder.priority,
          items: newOrder.items
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || "Failed to create order");
      }

      toast.success("Ordine di acquisto creato e email inviata al fornitore");
      setNewOrderDialogOpen(false);
      setNewOrder({
        supplier_id: "",
        order_date: new Date().toISOString().split('T')[0],
        expected_delivery_date: "",
        notes: "",
        priority: "media",
        items: []
      });
      fetchOrders();
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.message || "Errore nella creazione dell'ordine");
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

  const startEditing = (order: PurchaseOrder) => {
    setEditData({
      notes: (order as any).notes || "",
      expected_delivery_date: order.expected_delivery_date || "",
      priority: order.priority || "media",
      items: (order.purchase_order_items || []).map((item: any) => ({
        id: item.id,
        material_id: item.material_id || item.material?.id || "",
        quantity: item.quantity,
        unit_price: item.unit_price || 0,
      })),
    });
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrder) return;
    setIsSavingEdit(true);
    try {
      // Update order fields
      const { error: orderError } = await supabase
        .from('purchase_orders')
        .update({
          notes: editData.notes || null,
          expected_delivery_date: editData.expected_delivery_date || null,
          priority: editData.priority,
        })
        .eq('id', selectedOrder.id);

      if (orderError) throw orderError;

      // Update items quantities
      for (const item of editData.items) {
        if (item.id) {
          const { error: itemError } = await supabase
            .from('purchase_order_items')
            .update({ quantity: item.quantity, unit_price: item.unit_price })
            .eq('id', item.id);
          if (itemError) throw itemError;
        }
      }

      // Recalculate total
      const total = editData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      await supabase
        .from('purchase_orders')
        .update({ total_amount: total, subtotal: total })
        .eq('id', selectedOrder.id);

      toast.success("Ordine aggiornato con successo");
      setIsEditing(false);
      fetchOrders();

      // Refresh selected order
      const { data: updatedOrder } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          suppliers (name, access_code),
          purchase_order_items (*, material:materials (*)),
          purchase_order_comments (*),
          purchase_order_attachments (*),
          purchase_order_change_requests (*)
        `)
        .eq('id', selectedOrder.id)
        .single();
      if (updatedOrder) setSelectedOrder(updatedOrder);
    } catch (error: any) {
      console.error('Error saving edit:', error);
      toast.error("Errore nel salvataggio delle modifiche");
    } finally {
      setIsSavingEdit(false);
    }
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

  const handleArchiveOrder = async (order: PurchaseOrder) => {
    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ archived: true })
        .eq('id', order.id);

      if (error) throw error;

      toast.success("Ordine archiviato con successo");
      fetchOrders();
    } catch (error: any) {
      console.error('Error archiving order:', error);
      toast.error("Errore nell'archiviazione dell'ordine");
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;

    try {
      // Delete related records first
      await supabase.from('purchase_order_items').delete().eq('purchase_order_id', orderToDelete.id);
      await supabase.from('purchase_order_comments').delete().eq('purchase_order_id', orderToDelete.id);
      await supabase.from('purchase_order_attachments').delete().eq('purchase_order_id', orderToDelete.id);
      await supabase.from('purchase_order_change_requests').delete().eq('purchase_order_id', orderToDelete.id);
      
      // Delete the order
      const { error } = await supabase
        .from('purchase_orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;

      toast.success("Ordine eliminato con successo");
      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      fetchOrders();
    } catch (error: any) {
      console.error('Error deleting order:', error);
      toast.error("Errore nell'eliminazione dell'ordine");
    }
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
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-archived"
                  checked={showArchived}
                  onChange={(e) => setShowArchived(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="show-archived" className="text-sm text-muted-foreground cursor-pointer">
                  Mostra archiviati
                </label>
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
                  <TableHead>Richiesta Consegna</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Articoli</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                      <TableCell>
                        {order.priority && priorityConfig[order.priority as keyof typeof priorityConfig] && (
                          <Badge className={priorityConfig[order.priority as keyof typeof priorityConfig].color}>
                            {priorityConfig[order.priority as keyof typeof priorityConfig].label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{order.purchase_order_items?.length || 0}</TableCell>
                      <TableCell className="text-right font-medium">
                        €{order.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>{getStatusBadge(order.production_status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedOrder(order);
                              setDetailsDialogOpen(true);
                            }}
                            title="Visualizza dettagli"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleArchiveOrder(order)}
                            title="Archivia ordine"
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setOrderToDelete(order);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive hover:text-destructive"
                            title="Elimina ordine"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
      <Dialog open={detailsDialogOpen} onOpenChange={(open) => { setDetailsDialogOpen(open); if (!open) setIsEditing(false); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedOrder?.number}</span>
              {selectedOrder && (
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                        Annulla
                      </Button>
                      <Button size="sm" onClick={handleSaveEdit} disabled={isSavingEdit} className="gap-2">
                        <Save className="h-4 w-4" />
                        {isSavingEdit ? "Salvataggio..." : "Salva"}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => startEditing(selectedOrder)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Modifica
                      </Button>
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
                    </>
                  )}
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
                    <label className="text-sm font-medium text-muted-foreground">Richiesta consegna entro il</label>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editData.expected_delivery_date}
                        onChange={(e) => setEditData(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                        className="mt-1"
                      />
                    ) : (
                      <p className="text-sm">
                        {selectedOrder?.expected_delivery_date 
                          ? new Date(selectedOrder.expected_delivery_date).toLocaleDateString('it-IT')
                          : '-'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Importo Totale</label>
                    <p className="text-lg font-bold">
                      €{isEditing 
                        ? editData.items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
                        : selectedOrder?.total_amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
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
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Priorità</label>
                    {isEditing ? (
                      <Select
                        value={editData.priority}
                        onValueChange={(value) => setEditData(prev => ({ ...prev, priority: value }))}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgente">🔴 Urgente</SelectItem>
                          <SelectItem value="alta">🟠 Alta</SelectItem>
                          <SelectItem value="media">🟡 Media</SelectItem>
                          <SelectItem value="bassa">🔵 Bassa</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="mt-1">
                        {selectedOrder?.priority && priorityConfig[selectedOrder.priority as keyof typeof priorityConfig] && (
                          <Badge className={priorityConfig[selectedOrder.priority as keyof typeof priorityConfig].color}>
                            {priorityConfig[selectedOrder.priority as keyof typeof priorityConfig].label}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {(isEditing || (selectedOrder as any)?.notes) && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Note</label>
                    {isEditing ? (
                      <Textarea
                        value={editData.notes}
                        onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))}
                        rows={3}
                        className="mt-1"
                        placeholder="Note sull'ordine..."
                      />
                    ) : (
                      <p className="text-sm mt-1 whitespace-pre-wrap bg-muted/50 p-2 rounded-md">
                        {(selectedOrder as any)?.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Status Buttons for confirmed orders */}
                {!isEditing && selectedOrder?.production_status && selectedOrder.production_status !== 'pending' && (
                  <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                    <label className="text-sm font-medium text-muted-foreground">Aggiorna Stato Produzione</label>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedOrder.production_status === 'in_production' ? 'default' : 'outline'}
                        className="gap-1"
                        disabled={selectedOrder.production_status === 'in_production'}
                        onClick={() => handleStatusChange(selectedOrder.id, 'in_production')}
                      >
                        ⚙️ In Produzione
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedOrder.production_status === 'ready_to_ship' ? 'default' : 'outline'}
                        className="gap-1"
                        disabled={selectedOrder.production_status === 'ready_to_ship'}
                        onClick={() => handleStatusChange(selectedOrder.id, 'ready_to_ship')}
                      >
                        📦 Pronto
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedOrder.production_status === 'shipped' ? 'default' : 'outline'}
                        className="gap-1"
                        disabled={selectedOrder.production_status === 'shipped'}
                        onClick={() => handleStatusChange(selectedOrder.id, 'shipped')}
                      >
                        🚚 Spedito
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedOrder.production_status === 'delivered' ? 'default' : 'outline'}
                        className="gap-1"
                        disabled={selectedOrder.production_status === 'delivered'}
                        onClick={() => handleStatusChange(selectedOrder.id, 'delivered')}
                      >
                        ✅ Consegnato
                      </Button>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-semibold mb-3">Articoli Ordinati</h4>
                  <div className="space-y-2">
                    {isEditing ? (
                      editData.items.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-lg flex justify-between items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {materials.find(m => m.id === item.material_id)?.name || 'Materiale'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Codice: {materials.find(m => m.id === item.material_id)?.code || '-'}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div>
                              <label className="text-xs text-muted-foreground">Qtà</label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => {
                                  const newItems = [...editData.items];
                                  newItems[idx] = { ...newItems[idx], quantity: parseFloat(e.target.value) || 1 };
                                  setEditData(prev => ({ ...prev, items: newItems }));
                                }}
                                className="w-20"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Prezzo (€)</label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unit_price}
                                onChange={(e) => {
                                  const newItems = [...editData.items];
                                  newItems[idx] = { ...newItems[idx], unit_price: parseFloat(e.target.value) || 0 };
                                  setEditData(prev => ({ ...prev, items: newItems }));
                                }}
                                className="w-24"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      selectedOrder?.purchase_order_items?.map((item: any, idx: number) => (
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
                      ))
                    )}
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

          {/* Design Requests for COEM SRL */}
          {selectedOrder?.supplier_id && (
            <div className="mt-4 border-t pt-4">
              <DesignRequestsSection supplierId={selectedOrder.supplier_id} isSupplierView={false} />
            </div>
          )}
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
                  <label className="text-sm font-medium">Richiesta consegna entro il (opzionale)</label>
                  <Input
                    type="date"
                    value={newOrder.expected_delivery_date}
                    onChange={(e) => setNewOrder(prev => ({ ...prev, expected_delivery_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorità</label>
                <Select
                  value={newOrder.priority}
                  onValueChange={(value) => setNewOrder(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona priorità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgente">🔴 Urgente</SelectItem>
                    <SelectItem value="alta">🟠 Alta</SelectItem>
                    <SelectItem value="media">🟡 Media</SelectItem>
                    <SelectItem value="bassa">🔵 Bassa</SelectItem>
                  </SelectContent>
                </Select>
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'ordine {orderToDelete?.number}? 
              Questa azione non può essere annullata e eliminerà anche tutti i dati correlati (articoli, commenti, allegati).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteOrder}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}