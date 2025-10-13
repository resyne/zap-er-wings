import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const orderTypes = [
  { value: "odl", label: "Ordine di Lavoro (OdL)" },
  { value: "odp", label: "Ordine di Produzione (OdP)" },
  { value: "odpel", label: "Ordine Produzione e Installazione (OdPeL)" },
  { value: "ods", label: "Ordine di Spedizione (OdS)" }
];

const orderSources = [
  { value: "sale", label: "Vendita" },
  { value: "warranty", label: "Garanzia" }
];

export function CreateOrderDialog({ open, onOpenChange, onSuccess }: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    order_type: "",
    order_source: "sale",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    status: "draft",
    notes: "",
    work_description: "",
    bom_id: "",
    priority: "medium",
    planned_start_date: "",
    location: "",
    equipment_needed: "",
    shipping_address: ""
  });

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    const [customersData, bomsData] = await Promise.all([
      supabase.from("customers").select("id, code, name, company_name").eq("active", true).order("name"),
      supabase.from("boms").select("id, name, description, level").order("name")
    ]);
    
    setCustomers(customersData.data || []);
    setBoms(bomsData.data || []);
  };

  const createProductionWorkOrder = async (orderId: string, orderData: any) => {
    const productionData = {
      number: '',
      title: `Produzione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.notes || '',
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      bom_id: newOrder.bom_id || null,
      includes_installation: newOrder.order_type === 'odpel',
      planned_start_date: newOrder.planned_start_date || null,
      sales_order_id: orderId
    };

    const { data: productionWO, error } = await supabase
      .from('work_orders')
      .insert([productionData])
      .select()
      .single();

    if (error) throw error;
    return productionWO;
  };

  const createServiceWorkOrder = async (orderId: string, orderData: any, productionWOId?: string) => {
    const serviceData = {
      number: '',
      title: `Installazione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.work_description || newOrder.notes,
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      assigned_to: null,
      priority: newOrder.priority,
      scheduled_date: newOrder.planned_start_date ? new Date(newOrder.planned_start_date).toISOString() : null,
      location: newOrder.location || null,
      equipment_needed: newOrder.equipment_needed || null,
      notes: newOrder.notes,
      production_work_order_id: productionWOId || null,
      sales_order_id: orderId
    };

    const { data: serviceWO, error } = await supabase
      .from('service_work_orders')
      .insert([serviceData])
      .select()
      .single();

    if (error) throw error;
    return serviceWO;
  };

  const createShippingOrder = async (orderId: string, orderData: any) => {
    const shippingData = {
      number: '',
      customer_id: newOrder.customer_id,
      status: 'da_preparare' as const,
      order_date: newOrder.order_date || new Date().toISOString().split('T')[0],
      notes: newOrder.notes,
      shipping_address: newOrder.shipping_address || null,
      sales_order_id: orderId
    };

    const { data: shippingOrder, error } = await supabase
      .from('shipping_orders')
      .insert([shippingData])
      .select()
      .single();

    if (error) throw error;
    return shippingOrder;
  };

  const handleCreateOrder = async () => {
    if (!newOrder.customer_id || !newOrder.order_type) {
      toast({
        title: "Errore",
        description: "Cliente e tipo ordine sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    if ((newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && !newOrder.bom_id) {
      toast({
        title: "Errore",
        description: "Per ordini di produzione è necessario selezionare una BOM",
        variant: "destructive",
      });
      return;
    }

    if (newOrder.order_type === 'odl' && !newOrder.work_description) {
      toast({
        title: "Errore",
        description: "Per ordini di lavoro è necessario descrivere il lavoro da fare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const orderData = {
        number: "",
        customer_id: newOrder.customer_id,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: newOrder.order_type,
        order_source: newOrder.order_source
      };

      const { data: salesOrder, error: salesError } = await supabase
        .from("sales_orders")
        .insert([orderData])
        .select(`*, customers(name, code)`)
        .single();

      if (salesError) throw salesError;

      let productionWO = null;
      let serviceWO = null;
      let shippingOrder = null;

      switch (newOrder.order_type) {
        case 'odp':
          productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
          break;
        case 'odl':
          serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder);
          break;
        case 'odpel':
          productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
          serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder, productionWO.id);
          break;
        case 'ods':
          shippingOrder = await createShippingOrder(salesOrder.id, salesOrder);
          break;
      }

      let successMessage = "Ordine creato con successo";
      if (productionWO && serviceWO) {
        successMessage += ` - Ordine di Produzione: ${productionWO.number}, Ordine di Lavoro: ${serviceWO.number}`;
      } else if (productionWO) {
        successMessage += ` - Ordine di Produzione: ${productionWO.number}`;
      } else if (serviceWO) {
        successMessage += ` - Ordine di Lavoro: ${serviceWO.number}`;
      } else if (shippingOrder) {
        successMessage += ` - Ordine di Spedizione: ${shippingOrder.number}`;
      }

      toast({
        title: "Successo",
        description: successMessage,
      });

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'ordine: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewOrder({
      customer_id: "",
      order_type: "",
      order_source: "sale",
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: "",
      status: "draft",
      notes: "",
      work_description: "",
      bom_id: "",
      priority: "medium",
      planned_start_date: "",
      location: "",
      equipment_needed: "",
      shipping_address: ""
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Ordine</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Cliente *</Label>
            <Select value={newOrder.customer_id} onValueChange={(value) => setNewOrder({ ...newOrder, customer_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.code} - {customer.company_name || customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo Ordine *</Label>
            <Select value={newOrder.order_type} onValueChange={(value) => setNewOrder({ ...newOrder, order_type: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                {orderTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && (
            <div>
              <Label>BOM (Distinta Base) *</Label>
              <Select value={newOrder.bom_id} onValueChange={(value) => setNewOrder({ ...newOrder, bom_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona BOM" />
                </SelectTrigger>
                <SelectContent>
                  {boms.map((bom) => (
                    <SelectItem key={bom.id} value={bom.id}>
                      {bom.name} {bom.description && `- ${bom.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {newOrder.order_type === 'odl' && (
            <div>
              <Label>Descrizione Lavoro *</Label>
              <Textarea
                value={newOrder.work_description}
                onChange={(e) => setNewOrder({ ...newOrder, work_description: e.target.value })}
                placeholder="Descrivi il lavoro da svolgere..."
                rows={3}
              />
            </div>
          )}

          {newOrder.order_type === 'ods' && (
            <div>
              <Label>Indirizzo di Spedizione</Label>
              <Textarea
                value={newOrder.shipping_address}
                onChange={(e) => setNewOrder({ ...newOrder, shipping_address: e.target.value })}
                placeholder="Indirizzo completo di spedizione..."
                rows={2}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Ordine</Label>
              <Input
                type="date"
                value={newOrder.order_date}
                onChange={(e) => setNewOrder({ ...newOrder, order_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Consegna</Label>
              <Input
                type="date"
                value={newOrder.delivery_date}
                onChange={(e) => setNewOrder({ ...newOrder, delivery_date: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Note</Label>
            <Textarea
              value={newOrder.notes}
              onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
              placeholder="Note aggiuntive..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleCreateOrder} disabled={loading}>
            {loading ? "Creazione..." : "Crea Ordine"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
