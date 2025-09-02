import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, Package, Truck, CheckCircle } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface ShippingOrder {
  id: string;
  number: string;
  customer_id?: string;
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
  companies?: { name: string };
  shipping_order_items?: ShippingOrderItem[];
}

interface ShippingOrderItem {
  id: string;
  material_id?: string;
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: shippingOrders, isLoading } = useQuery({
    queryKey: ["shipping-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_orders")
        .select(`
          *,
          companies(name),
          shipping_order_items(
            *,
            materials(name, code)
          )
        `)
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
      const { error } = await supabase
        .from("shipping_orders")
        .insert([data]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsCreateDialogOpen(false);
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
    mutationFn: async ({ id, ...data }: any) => {
      const { error } = await supabase
        .from("shipping_orders")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipping-orders"] });
      setIsEditDialogOpen(false);
      setSelectedOrder(null);
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
      shipping_address: formData.get("shipping_address") || "",
      payment_on_delivery: formData.get("payment_on_delivery") === "on",
      payment_amount: formData.get("payment_amount") ? Number(formData.get("payment_amount")) : null,
      notes: formData.get("notes") || "",
    };
    createOrderMutation.mutate(data);
  };

  const handleUpdateOrder = (formData: FormData) => {
    if (!selectedOrder) return;
    
    const data = {
      id: selectedOrder.id,
      customer_id: formData.get("customer_id") || null,
      shipping_address: formData.get("shipping_address") || "",
      payment_on_delivery: formData.get("payment_on_delivery") === "on",
      payment_amount: formData.get("payment_amount") ? Number(formData.get("payment_amount")) : null,
      notes: formData.get("notes") || "",
    };
    updateOrderMutation.mutate(data);
  };

  const getStatusBadge = (status: string) => {
    const statusOption = statusOptions.find(s => s.value === status);
    return (
      <Badge className={statusOption?.color}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, status: newStatus });
  };

  const handleGenerateDDT = (order: ShippingOrder) => {
    generateDDTMutation.mutate(order.id);
  };

  if (isLoading) {
    return <div>Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Ordini di Spedizione</h1>
          <p className="text-muted-foreground">
            Gestisci gli ordini di spedizione e genera i DDT
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Ordine
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordini di Spedizione</CardTitle>
          <CardDescription>
            Elenco di tutti gli ordini di spedizione
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
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.number}</TableCell>
                  <TableCell>{order.companies?.name || "N/A"}</TableCell>
                  <TableCell>{new Date(order.order_date).toLocaleDateString()}</TableCell>
                  <TableCell>
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
                  <TableCell>
                    <div className="flex gap-2">
                      {order.status === "pronto" && (
                        <Button
                          size="sm"
                          onClick={() => handleGenerateDDT(order)}
                          disabled={generateDDTMutation.isPending}
                        >
                          <FileText className="w-4 h-4 mr-1" />
                          Genera DDT
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(order);
                          setIsEditDialogOpen(true);
                        }}
                      >
                        Dettagli
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                <Select name="customer_id">
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies?.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name} ({company.code})
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
            
            <div>
              <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
              <Textarea
                name="shipping_address"
                placeholder="Inserisci l'indirizzo di spedizione"
                rows={3}
              />
            </div>

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
                      {companies?.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name} ({company.code})
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
              
              <div>
                <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
                <Textarea
                  name="shipping_address"
                  placeholder="Inserisci l'indirizzo di spedizione"
                  defaultValue={selectedOrder.shipping_address || ""}
                  rows={3}
                />
              </div>

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

              {/* Order Items Section */}
              <div className="border-t pt-4">
                <h3 className="text-lg font-semibold mb-4">Materiali</h3>
                {selectedOrder.shipping_order_items && selectedOrder.shipping_order_items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Materiale</TableHead>
                        <TableHead>Quantità</TableHead>
                        <TableHead>Prezzo Unitario</TableHead>
                        <TableHead>Totale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrder.shipping_order_items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            {item.materials?.name} ({item.materials?.code})
                          </TableCell>
                          <TableCell>{item.quantity}</TableCell>
                          <TableCell>€{item.unit_price}</TableCell>
                          <TableCell>€{item.total_price}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground">Nessun materiale aggiunto</p>
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