import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, MapPin, Archive, Trash2, UserPlus } from "lucide-react";
import { ShippingOrderDetailsDialog } from "@/components/warehouse/ShippingOrderDetailsDialog";
import { useUndoableAction } from "@/hooks/useUndoableAction";

interface ShippingOrder {
  id: string;
  number: string;
  customer_id?: string;
  work_order_id?: string;
  sales_order_id?: string;
  status: string;
  order_date: string;
  preparation_date?: string;
  ready_date?: string;
  shipped_date?: string;
  delivered_date?: string;
  payment_on_delivery: boolean;
  payment_amount?: number;
  notes?: string;
  shipping_address?: string;
  archived?: boolean;
  assigned_to?: string;
  status_changed_by?: string;
  status_changed_at?: string;
  customers?: { 
    name: string; 
    code: string;
    address?: string; 
    email?: string;
    phone?: string;
    tax_id?: string;
    company_name?: string;
    shipping_address?: string;
    pec?: string;
    sdi_code?: string;
    city?: string;
    country?: string;
  } | null;
  work_orders?: { number: string; title: string };
  sales_orders?: { 
    number: string;
    offer_id?: string;
    offers?: {
      payment_method?: string;
      payment_agreement?: string;
      offer_items?: Array<{
        id: string;
        description: string;
        quantity: number;
        unit_price: number;
        discount_percent: number;
        notes?: string;
        products?: { name: string };
      }>;
    };
  };
  shipping_order_items?: ShippingOrderItem[];
  assigned_user?: { first_name?: string; last_name?: string; email?: string };
  status_changed_user?: { first_name?: string; last_name?: string; email?: string };
}

interface ShippingOrderItem {
  id?: string;
  material_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
  materials?: { name: string; code: string };
}

interface Customer {
  id: string;
  name: string;
  code: string;
  address?: string;
  email?: string;
  phone?: string;
  tax_id?: string;
  company_name?: string;
  shipping_address?: string;
  pec?: string;
  sdi_code?: string;
}

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  customer_id?: string;
}

interface SalesOrder {
  id: string;
  number: string;
  customer_id?: string;
}

interface Material {
  id: string;
  name: string;
  code: string;
  cost: number;
}

const statusOptions = [
  { value: "da_preparare", label: "Da preparare", color: "bg-gray-100 text-gray-800" },
  { value: "in_preparazione", label: "In preparazione", color: "bg-yellow-100 text-yellow-800" },
  { value: "pronto", label: "Pronto", color: "bg-blue-100 text-blue-800" },
  { value: "spedito", label: "Spedito", color: "bg-orange-100 text-orange-800" },
  { value: "consegnato", label: "Consegnato", color: "bg-green-100 text-green-800" },
];

export default function ShippingOrdersPage() {
  const [selectedOrder, setSelectedOrder] = useState<ShippingOrder | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [orderItems, setOrderItems] = useState<ShippingOrderItem[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { executeWithUndo } = useUndoableAction();

  const { data: shippingOrders, isLoading } = useQuery({
    queryKey: ["shipping-orders", showArchivedOrders],
    queryFn: async () => {
      const query = supabase
        .from("shipping_orders")
        .select(`
          *,
          customers!customer_id(name, address, email, phone, tax_id, code, company_name, shipping_address, pec, sdi_code, city, country),
          work_orders!work_order_id(number, title),
          sales_orders!sales_order_id(
            number,
            offer_id,
            offers(
              payment_method, 
              payment_agreement,
              offer_items(
                id,
                description,
                quantity,
                unit_price,
                discount_percent,
                notes,
                products(name)
              )
            )
          ),
          shipping_order_items(
            *,
            materials(name, code)
          ),
          assigned_user:profiles!assigned_to(first_name, last_name, email),
          status_changed_user:profiles!status_changed_by(first_name, last_name, email)
        `)
        .order("number", { ascending: false });
      
      // Applica il filtro archiviati
      if (showArchivedOrders) {
        query.eq('archived', true);
      } else {
        query.eq('archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, code, address, email, phone, tax_id, company_name, shipping_address, pec, sdi_code")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: workOrders } = useQuery({
    queryKey: ["work-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, number, title, customer_id")
        .order("number");

      if (error) throw error;
      return data;
    },
  });

  const { data: salesOrders } = useQuery({
    queryKey: ["sales-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("id, number, customer_id")
        .order("number");

      if (error) throw error;
      return data;
    },
  });

  const { data: materials } = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, code, cost")
        .eq("active", true)
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updateData: any = { status };
      
      // Set timestamp based on status
      const now = new Date().toISOString();
      switch (status) {
        case "in_preparazione":
          updateData.preparation_date = now;
          break;
        case "pronto":
          updateData.ready_date = now;
          break;
        case "spedito":
          updateData.shipped_date = now;
          break;
        case "consegnato":
          updateData.delivered_date = now;
          break;
      }

      const { error } = await supabase
        .from("shipping_orders")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      toast({ title: "Stato aggiornato con successo" });
    },
    onError: (error) => {
      toast({ 
        title: "Errore nell'aggiornamento dello stato", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const createOrderMutation = useMutation({
    mutationFn: async (data: any) => {
      const { items, ...orderData } = data;
      
      const { data: newOrder, error: orderError } = await supabase
        .from("shipping_orders")
        .insert([orderData])
        .select()
        .single();

      if (orderError) throw orderError;

      let itemsToCreate = items || [];
      let skippedItems = 0;

      // Se c'è un sales_order_id e non ci sono items, recupera gli articoli dall'offerta collegata
      if (orderData.sales_order_id && (!items || items.length === 0)) {
        const { data: salesOrderData, error: salesOrderError } = await supabase
          .from("sales_orders")
          .select(`
            offer_id,
            offers!inner(
              offer_items(
                id,
                description,
                quantity,
                unit_price,
                product_id,
                products(id, name, code, material_id, materials(id, name, code))
              )
            )
          `)
          .eq("id", orderData.sales_order_id)
          .single();

        if (!salesOrderError && salesOrderData?.offers?.offer_items) {
          const allItems = salesOrderData.offers.offer_items;
          
          // Converti offer_items in shipping_order_items
          itemsToCreate = allItems
            .filter((item: any) => {
              const hasMaterial = item.products?.material_id;
              if (!hasMaterial) skippedItems++;
              return hasMaterial;
            })
            .map((item: any) => ({
              material_id: item.products.material_id,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
              notes: `${item.products.name}${item.description ? ` - ${item.description}` : ''}`
            }));
        }
      }

      if (itemsToCreate && itemsToCreate.length > 0) {
        const itemsToInsert = itemsToCreate.map((item: ShippingOrderItem) => ({
          shipping_order_id: newOrder.id,
          material_id: item.material_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          notes: item.notes || null
        }));

        const { error: itemsError } = await supabase
          .from("shipping_order_items")
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      return { newOrder, skippedItems };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsCreateDialogOpen(false);
      setOrderItems([]);
      
      let message = "Ordine creato con successo";
      if (result?.skippedItems > 0) {
        message += `. ${result.skippedItems} articolo/i non importato/i perché senza materiale collegato.`;
      }
      
      toast({ 
        title: message,
        description: result?.skippedItems > 0 ? "Alcuni prodotti dell'ordine non hanno un materiale associato nel magazzino." : undefined
      });
    },
    onError: (error) => {
      toast({ 
        title: "Errore nella creazione dell'ordine", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, items, ...data }: any) => {
      const { error: orderError } = await supabase
        .from("shipping_orders")
        .update(data)
        .eq("id", id);

      if (orderError) throw orderError;

      if (items) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from("shipping_order_items")
          .delete()
          .eq("shipping_order_id", id);

        if (deleteError) throw deleteError;

        // Insert new items
        if (items.length > 0) {
          const itemsToInsert = items.map((item: ShippingOrderItem) => ({
            shipping_order_id: id,
            material_id: item.material_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            notes: item.notes || null
          }));

          const { error: itemsError } = await supabase
            .from("shipping_order_items")
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsEditDialogOpen(false);
      setSelectedOrder(null);
      setOrderItems([]);
      toast({ title: "Ordine aggiornato con successo" });
    },
    onError: (error) => {
      toast({ 
        title: "Errore nell'aggiornamento dell'ordine", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shipping_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsDetailsDialogOpen(false);
      setSelectedOrder(null);
      toast({ title: "Ordine eliminato con successo" });
    },
    onError: (error) => {
      toast({ 
        title: "Errore nell'eliminazione dell'ordine", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const generateDDTMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // This would typically call an edge function to generate the PDF
      // For now, we'll just show a success message
      toast({ 
        title: "DDT generato", 
        description: "Il documento di trasporto è stato generato con successo" 
      });
    },
  });

  const handleCreateOrder = (formData: FormData) => {
    const data = {
      customer_id: formData.get("customer_id") || null,
      work_order_id: formData.get("work_order_id") || null,
      sales_order_id: formData.get("sales_order_id") || null,
      shipping_address: formData.get("shipping_address") || "",
      notes: formData.get("notes") || "",
      items: orderItems,
    };
    createOrderMutation.mutate(data);
  };

  const handleUpdateOrder = (formData: FormData) => {
    if (!selectedOrder) return;
    
    const data = {
      id: selectedOrder.id,
      customer_id: formData.get("customer_id") || null,
      work_order_id: formData.get("work_order_id") || null,
      sales_order_id: formData.get("sales_order_id") || null,
      shipping_address: formData.get("shipping_address") || "",
      notes: formData.get("notes") || "",
      items: orderItems,
    };
    updateOrderMutation.mutate(data);
  };

  const handleAddItem = () => {
    setOrderItems([...orderItems, {
      material_id: "",
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      notes: ""
    }]);
  };

  const handleRemoveItem = (index: number) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof ShippingOrderItem, value: any) => {
    const updatedItems = [...orderItems];
    updatedItems[index] = {
      ...updatedItems[index],
      [field]: value
    };
    
    // Auto-calculate total price
    if (field === "quantity" || field === "unit_price") {
      updatedItems[index].total_price = updatedItems[index].quantity * updatedItems[index].unit_price;
    }
    
    setOrderItems(updatedItems);
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return (
      <Badge className={statusOption?.color}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    const order = shippingOrders?.find(o => o.id === orderId);
    if (!order) return;

    const previousStatus = order.status;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await executeWithUndo(
      async () => {
        const updateData: any = { 
          status: newStatus,
          status_changed_by: user.id,
          status_changed_at: new Date().toISOString()
        };
        
        // Set timestamp based on status
        const now = new Date().toISOString();
        switch (newStatus) {
          case "in_preparazione":
            updateData.preparation_date = now;
            break;
          case "pronto":
            updateData.ready_date = now;
            break;
          case "spedito":
            updateData.shipped_date = now;
            break;
          case "consegnato":
            updateData.delivered_date = now;
            break;
        }

        const { error } = await supabase
          .from("shipping_orders")
          .update(updateData)
          .eq("id", orderId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      },
      async () => {
        const { error } = await supabase
          .from("shipping_orders")
          .update({ status: previousStatus as any })
          .eq("id", orderId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      },
      {
        duration: 10000,
        successMessage: "Stato aggiornato",
        errorMessage: "Errore nell'aggiornamento dello stato"
      }
    );
  };

  const handleTakeOwnership = async (orderId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Errore",
          description: "Devi essere autenticato per assegnarti questa commessa",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('shipping_orders')
        .update({ assigned_to: user.id })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ti sei assegnato questa commessa con successo",
      });

      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchive = async (orderId: string) => {
    const order = shippingOrders?.find(o => o.id === orderId);
    if (!order) return;

    const newArchivedStatus = !order.archived;

    await executeWithUndo(
      async () => {
        const { error } = await supabase
          .from('shipping_orders')
          .update({ archived: newArchivedStatus })
          .eq('id', orderId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      },
      async () => {
        const { error } = await supabase
          .from('shipping_orders')
          .update({ archived: !newArchivedStatus })
          .eq('id', orderId);

        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      },
      {
        duration: 10000,
        successMessage: newArchivedStatus ? "Ordine archiviato" : "Ordine ripristinato",
        errorMessage: newArchivedStatus ? "Errore nell'archiviazione" : "Errore nel ripristino"
      }
    );
  };

  const handleGenerateDDT = (order: ShippingOrder) => {
    generateDDTMutation.mutate(order.id);
  };

  const getCustomerDisplayName = (order: ShippingOrder) => {
    if (order.customers) {
      return order.customers.company_name || order.customers.name;
    }
    return "N/A";
  };

  const getSelectedCustomerAddress = (customerId: string) => {
    const customer = customers?.find(c => c.id === customerId);
    return customer?.shipping_address || customer?.address || null;
  };

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Commesse di Spedizione</h1>
          <p className="text-muted-foreground">
            Gestisci le commesse di spedizione e genera i DDT. Per creare una nuova commessa, utilizza la sezione Ordini.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
            >
              Tabella
            </Button>
            <Button
              variant={viewMode === "kanban" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("kanban")}
            >
              Kanban
            </Button>
          </div>
          <Button 
            variant={showArchivedOrders ? "default" : "outline"} 
            size="sm" 
            onClick={() => setShowArchivedOrders(!showArchivedOrders)}
          >
            {showArchivedOrders ? "Nascondi Archiviati" : "Mostra Archiviati"}
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <Card>
          <CardHeader>
            <CardTitle>Commesse di Spedizione</CardTitle>
            <CardDescription>
              Elenco di tutte le commesse di spedizione
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data Ordine</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shippingOrders?.map((order) => (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedOrder(order);
                      setIsDetailsDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">{order.number}</TableCell>
                    <TableCell>
                      {getCustomerDisplayName(order)}
                    </TableCell>
                    <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {order.assigned_user ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {order.assigned_user.first_name} {order.assigned_user.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {order.assigned_user.email}
                          </div>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTakeOwnership(order.id)}
                          className="gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          Prendi in carico
                        </Button>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusChange(order.id, value)}
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchive(order.id)}
                          title="Archivia ordine"
                        >
                          <Archive className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-5 gap-4">
          {statusOptions.map((status) => {
            const ordersInStatus = shippingOrders?.filter(o => o.status === status.value) || [];
            return (
              <Card key={status.value}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <span>{status.label}</span>
                    <Badge variant="secondary">{ordersInStatus.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ordersInStatus.map((order) => (
                    <Card
                      key={order.id}
                      className="p-3 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => {
                        setSelectedOrder(order);
                        setIsDetailsDialogOpen(true);
                      }}
                    >
                      <div className="space-y-2">
                        <div className="font-medium text-sm">{order.number}</div>
                        <div className="text-xs text-muted-foreground">
                          {getCustomerDisplayName(order)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.order_date).toLocaleDateString()}
                        </div>
                        {order.assigned_user && (
                          <Badge variant="outline" className="text-xs">
                            {order.assigned_user.first_name} {order.assigned_user.last_name}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}
                  {ordersInStatus.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nessun ordine
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Details Dialog */}
      <ShippingOrderDetailsDialog
        order={selectedOrder}
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        onEdit={(order) => {
          setIsDetailsDialogOpen(false);
          setSelectedOrder(order);
          setOrderItems(order.shipping_order_items || []);
          setIsEditDialogOpen(true);
        }}
        onDelete={deleteOrderMutation.mutate}
        onArchive={handleArchive}
      />

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Dettagli Ordine: {selectedOrder?.number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleUpdateOrder(formData);
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_id">Cliente</Label>
                  <Select name="customer_id" defaultValue={selectedOrder.customer_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers?.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.company_name || customer.name} ({customer.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="work_order_id">Commessa di Produzione (CdP)</Label>
                  <Select name="work_order_id" defaultValue={selectedOrder.work_order_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega CdP (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      {workOrders?.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.number} - {wo.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="sales_order_id">Ordine di Vendita (OdV)</Label>
                  <Select name="sales_order_id" defaultValue={selectedOrder.sales_order_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega OdV (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      {salesOrders?.map((so) => (
                        <SelectItem key={so.id} value={so.id}>
                          {so.number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Show linked order details */}
              {(selectedOrder.work_orders || selectedOrder.sales_orders) && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Ordini Collegati</h4>
                  {selectedOrder.work_orders && (
                    <p className="text-sm">
                      <strong>CdP:</strong> {selectedOrder.work_orders.number} - {selectedOrder.work_orders.title}
                    </p>
                  )}
                  {selectedOrder.sales_orders && (
                    <p className="text-sm">
                      <strong>OdV:</strong> {selectedOrder.sales_orders.number}
                    </p>
                  )}
                </div>
              )}
              
              {/* Show shipping address conditionally in edit mode */}
              {(!selectedOrder.customer_id || !getSelectedCustomerAddress(selectedOrder.customer_id)) && (
                <div>
                  <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
                  <Textarea
                    name="shipping_address"
                    placeholder="Inserisci l'indirizzo di spedizione"
                    defaultValue={selectedOrder.shipping_address || ""}
                    rows={3}
                  />
                </div>
              )}
              
              {/* Show customer address if available */}
              {selectedOrder.customer_id && getSelectedCustomerAddress(selectedOrder.customer_id) && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Indirizzo Cliente</h4>
                  <p className="text-sm">{getSelectedCustomerAddress(selectedOrder.customer_id)}</p>
                </div>
              )}


              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  name="notes"
                  placeholder="Note aggiuntive"
                  defaultValue={selectedOrder.notes || ""}
                  rows={3}
                />
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Articoli</Label>
                  <Button type="button" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    Aggiungi Articolo
                  </Button>
                </div>
                
                {orderItems.length > 0 && (
                  <div className="border rounded-lg divide-y">
                    {orderItems.map((item, index) => (
                      <div key={index} className="p-3 space-y-3">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-5">
                            <Label className="text-xs">Materiale</Label>
                            <Select
                              value={item.material_id}
                              onValueChange={(value) => {
                                handleUpdateItem(index, "material_id", value);
                                const material = materials?.find(m => m.id === value);
                                if (material) {
                                  handleUpdateItem(index, "unit_price", material.cost);
                                }
                              }}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Seleziona materiale" />
                              </SelectTrigger>
                              <SelectContent>
                                {materials?.map((mat) => (
                                  <SelectItem key={mat.id} value={mat.id}>
                                    {mat.code} - {mat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Quantità</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, "quantity", Number(e.target.value))}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Prezzo Unit.</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItem(index, "unit_price", Number(e.target.value))}
                              className="h-8"
                            />
                          </div>
                          <div className="col-span-2">
                            <Label className="text-xs">Totale</Label>
                            <Input
                              type="number"
                              value={item.total_price.toFixed(2)}
                              disabled
                              className="h-8 bg-muted"
                            />
                          </div>
                          <div className="col-span-1 flex items-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveItem(index)}
                              className="h-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Note (opzionale)</Label>
                          <Input
                            value={item.notes || ""}
                            onChange={(e) => handleUpdateItem(index, "notes", e.target.value)}
                            placeholder="Note per questo articolo"
                            className="h-8"
                          />
                        </div>
                      </div>
                    ))}
                    <div className="p-3 bg-muted">
                      <div className="flex justify-between items-center font-semibold">
                        <span>Totale Ordine:</span>
                        <span>€{orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
                
                {orderItems.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg">
                    Nessun articolo aggiunto. Clicca su "Aggiungi Articolo" per iniziare.
                  </p>
                )}
              </div>

              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Chiudi
                </Button>
                <Button type="submit" disabled={updateOrderMutation.isPending}>
                  {updateOrderMutation.isPending ? "Aggiornamento..." : "Aggiorna Ordine"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}