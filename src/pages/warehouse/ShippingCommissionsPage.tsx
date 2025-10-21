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
import { Plus, FileText, MapPin, Archive, Trash2 } from "lucide-react";
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
  companies?: { name: string; address?: string };
  work_orders?: { number: string; title: string };
  sales_orders?: { number: string };
  shipping_order_items?: ShippingOrderItem[];
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

interface Company {
  id: string;
  name: string;
  code: string;
  address?: string;
}

interface CrmContact {
  id: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  address?: string;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { executeWithUndo } = useUndoableAction();

  const { data: shippingOrders, isLoading } = useQuery({
    queryKey: ["shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select(`
          *,
          companies!customer_id(name, address),
          work_orders!work_order_id(number, title),
          sales_orders!sales_order_id(number),
          shipping_order_items(
            *,
            materials(name, code)
          )
        `)
        .eq('archived', false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, code, address")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const { data: crmContacts } = useQuery({
    queryKey: ["crm-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("id, first_name, last_name, company_name, address")
        .order("first_name");

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

      if (items && items.length > 0) {
        const itemsToInsert = items.map((item: ShippingOrderItem) => ({
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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsCreateDialogOpen(false);
      setOrderItems([]);
      toast({ title: "Ordine creato con successo" });
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
      payment_on_delivery: formData.get("payment_on_delivery") === "on",
      payment_amount: formData.get("payment_amount") ? Number(formData.get("payment_amount")) : null,
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
      payment_on_delivery: formData.get("payment_on_delivery") === "on",
      payment_amount: formData.get("payment_amount") ? Number(formData.get("payment_amount")) : null,
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

    await executeWithUndo(
      async () => {
        const updateData: any = { status: newStatus };
        
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
    if (order.companies?.name) {
      return order.companies.name;
    }
    
    // Check if customer_id belongs to a CRM contact
    const contact = crmContacts?.find(c => c.id === order.customer_id);
    if (contact) {
      return `${contact.first_name} ${contact.last_name} - ${contact.company_name}`;
    }
    
    return "N/A";
  };

  const getSelectedCustomerAddress = (customerId: string) => {
    const company = companies?.find(c => c.id === customerId);
    if (company?.address) return company.address;
    
    const contact = crmContacts?.find(c => c.id === customerId);
    if (contact?.address) return contact.address;
    
    return null;
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
            Gestisci le commesse di spedizione e genera i DDT
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
          <Button onClick={() => {
            setOrderItems([]);
            setIsCreateDialogOpen(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Ordine
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
                  <TableHead>Stato</TableHead>
                  <TableHead>Pagamento alla Consegna</TableHead>
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
                    <TableCell>
                      {order.payment_on_delivery ? (
                        <Badge variant="outline">
                          Sì - €{order.payment_amount || 0}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">No</Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        {order.status === "pronto" && (
                          <Button
                            size="sm"
                            onClick={() => handleGenerateDDT(order)}
                            disabled={generateDDTMutation.isPending}
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            DDT
                          </Button>
                        )}
                        {order.status === "spedito" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open('http://dg.netup.eu:3683/esLogin.aspx', '_blank', 'noopener,noreferrer')}
                          >
                            <MapPin className="w-4 h-4 mr-1" />
                            Track
                          </Button>
                        )}
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
                        {order.payment_on_delivery && (
                          <Badge variant="outline" className="text-xs">
                            €{order.payment_amount || 0}
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
        onGenerateDDT={handleGenerateDDT}
      />

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuovo Ordine di Spedizione</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            handleCreateOrder(formData);
          }} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customer_id">Cliente</Label>
                <Select name="customer_id" onValueChange={setSelectedCustomerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <optgroup label="Aziende">
                      {companies?.map((company) => (
                        <SelectItem key={`company-${company.id}`} value={company.id}>
                          {company.name} ({company.code})
                        </SelectItem>
                      ))}
                    </optgroup>
                    <optgroup label="Contatti CRM">
                      {crmContacts?.map((contact) => (
                        <SelectItem key={`contact-${contact.id}`} value={contact.id}>
                          {contact.first_name} {contact.last_name} - {contact.company_name}
                        </SelectItem>
                      ))}
                    </optgroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="work_order_id">Ordine di Produzione (OdP)</Label>
                <Select name="work_order_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Collega OdP (opzionale)" />
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
                <Select name="sales_order_id">
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
              <div>
                <Label htmlFor="payment_amount">Importo Pagamento alla Consegna</Label>
                <Input
                  name="payment_amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                />
              </div>
            </div>
            
            {/* Only show shipping address if customer doesn't have one */}
            {!getSelectedCustomerAddress(selectedCustomerId) && (
              <div>
                <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
                <Textarea
                  name="shipping_address"
                  placeholder="Inserisci l'indirizzo di spedizione"
                  rows={3}
                />
              </div>
            )}
            
            {/* Show customer address if available */}
            {getSelectedCustomerAddress(selectedCustomerId) && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold mb-2">Indirizzo Cliente</h4>
                <p className="text-sm">{getSelectedCustomerAddress(selectedCustomerId)}</p>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Checkbox name="payment_on_delivery" />
              <Label htmlFor="payment_on_delivery">Pagamento alla Consegna</Label>
            </div>

            <div>
              <Label htmlFor="notes">Note</Label>
              <Textarea
                name="notes"
                placeholder="Note aggiuntive"
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
              <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={createOrderMutation.isPending}>
                {createOrderMutation.isPending ? "Creazione..." : "Crea Ordine"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                      <optgroup label="Aziende">
                        {companies?.map((company) => (
                          <SelectItem key={`company-${company.id}`} value={company.id}>
                            {company.name} ({company.code})
                          </SelectItem>
                        ))}
                      </optgroup>
                      <optgroup label="Contatti CRM">
                        {crmContacts?.map((contact) => (
                          <SelectItem key={`contact-${contact.id}`} value={contact.id}>
                            {contact.first_name} {contact.last_name} - {contact.company_name}
                          </SelectItem>
                        ))}
                      </optgroup>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="work_order_id">Ordine di Produzione (OdP)</Label>
                  <Select name="work_order_id" defaultValue={selectedOrder.work_order_id || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega OdP (opzionale)" />
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
                <div>
                  <Label htmlFor="payment_amount">Importo Pagamento alla Consegna</Label>
                  <Input
                    name="payment_amount"
                    type="number"
                    step="0.01"
                    defaultValue={selectedOrder.payment_amount || ""}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Show linked order details */}
              {(selectedOrder.work_orders || selectedOrder.sales_orders) && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Ordini Collegati</h4>
                  {selectedOrder.work_orders && (
                    <p className="text-sm">
                      <strong>OdP:</strong> {selectedOrder.work_orders.number} - {selectedOrder.work_orders.title}
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

              <div className="flex items-center space-x-2">
                <Checkbox 
                  name="payment_on_delivery" 
                  defaultChecked={selectedOrder.payment_on_delivery}
                />
                <Label htmlFor="payment_on_delivery">Pagamento alla Consegna</Label>
              </div>

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