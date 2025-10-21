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
  leadId?: string;
  prefilledData?: {
    customer_id?: string;
    notes?: string;
  };
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

export function CreateOrderDialog({ open, onOpenChange, onSuccess, leadId, prefilledData }: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    contact_id: "",
    order_type: "",
    order_source: "sale",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    expected_delivery_date: "",
    status: "commissionato",
    notes: "",
    work_description: "",
    bom_id: "",
    accessori_ids: [] as string[],
    assigned_technician: "",
    back_office_manager: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    location: "",
    equipment_needed: "",
    shipping_address: ""
  });

  useEffect(() => {
    if (open) {
      loadData();
      // Pre-popola i dati se forniti
      if (prefilledData) {
        setNewOrder(prev => ({
          ...prev,
          ...prefilledData
        }));
      }
    }
  }, [open, prefilledData]);

  const loadData = async () => {
    const [customersData, bomsData, accessoriData, contactsData, techniciansData, usersData] = await Promise.all([
      supabase.from("customers").select("id, code, name, company_name").eq("active", true).order("name"),
      supabase.from("boms").select("id, name, description, level").in("level", [0, 1, 2]).order("name"),
      supabase.from("boms").select("id, name, description, level").eq("level", 3).order("name"),
      supabase.from("crm_contacts").select("id, first_name, last_name, company_name, email").order("first_name"),
      supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true).order("first_name"),
      supabase.from("profiles").select("id, email, first_name, last_name").order("first_name")
    ]);
    
    setCustomers(customersData.data || []);
    setBoms(bomsData.data || []);
    setAccessori(accessoriData.data || []);
    setContacts(contactsData.data || []);
    setTechnicians(techniciansData.data || []);
    setUsers(usersData.data || []);
  };

  const createProductionWorkOrder = async (orderId: string, orderData: any) => {
    const productionData = {
      number: '',
      title: `Produzione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.notes || '',
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      bom_id: newOrder.bom_id || null,
      accessori_ids: newOrder.accessori_ids.length > 0 ? newOrder.accessori_ids : null,
      assigned_to: newOrder.assigned_technician || null,
      back_office_manager: newOrder.back_office_manager || null,
      priority: newOrder.priority,
      planned_start_date: newOrder.planned_start_date || null,
      planned_end_date: newOrder.planned_end_date || null,
      notes: newOrder.notes,
      includes_installation: newOrder.order_type === 'odpel',
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
      contact_id: newOrder.contact_id || null,
      assigned_to: newOrder.assigned_technician || null,
      back_office_manager: newOrder.back_office_manager || null,
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
      contact_id: newOrder.contact_id || null,
      back_office_manager: newOrder.back_office_manager || null,
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

  const copyLeadPhotosToOrder = async (leadId: string, orderId: string) => {
    try {
      // Get all files from the lead
      const { data: leadFiles, error: leadFilesError } = await supabase
        .from('lead_files')
        .select('*')
        .eq('lead_id', leadId);

      if (leadFilesError) throw leadFilesError;
      if (!leadFiles || leadFiles.length === 0) return;

      // Filter only image files
      const imageFiles = leadFiles.filter(file => 
        file.file_type?.startsWith('image/') || 
        /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(file.file_name)
      );

      if (imageFiles.length === 0) return;

      // Copy each image file to opportunity-files bucket
      for (const file of imageFiles) {
        // Download file from lead-files bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('lead-files')
          .download(file.file_path);

        if (downloadError) {
          console.error(`Error downloading file ${file.file_name}:`, downloadError);
          continue;
        }

        // Upload to opportunity-files bucket
        const fileExt = file.file_name.split('.').pop();
        const newFileName = `${orderId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('opportunity-files')
          .upload(newFileName, fileData, {
            contentType: file.file_type || 'application/octet-stream'
          });

        if (uploadError) {
          console.error(`Error uploading file ${file.file_name}:`, uploadError);
        }
      }

      toast({
        title: "Foto copiate",
        description: `${imageFiles.length} foto copiate dal lead all'ordine`,
      });
    } catch (error) {
      console.error('Error copying lead photos:', error);
      // Don't throw - we don't want to block order creation if photo copy fails
    }
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
        order_source: newOrder.order_source,
        lead_id: leadId || null
      };

      const { data: salesOrder, error: salesError } = await supabase
        .from("sales_orders")
        .insert([orderData])
        .select(`*, customers(name, code)`)
        .single();

      if (salesError) throw salesError;

      // Copy photos from lead to order if lead is connected
      if (leadId) {
        await copyLeadPhotosToOrder(leadId, salesOrder.id);
      }

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
      contact_id: "",
      order_type: "",
      order_source: "sale",
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: "",
      expected_delivery_date: "",
      status: "commissionato",
      notes: "",
      work_description: "",
      bom_id: "",
      accessori_ids: [],
      assigned_technician: "",
      back_office_manager: "",
      priority: "medium",
      planned_start_date: "",
      planned_end_date: "",
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

          {(newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && accessori.length > 0 && (
            <div>
              <Label>Accessori</Label>
              <Select 
                value={newOrder.accessori_ids.join(',')} 
                onValueChange={(value) => {
                  const ids = value ? value.split(',').filter(Boolean) : [];
                  setNewOrder({ ...newOrder, accessori_ids: ids });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona accessori (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  {accessori.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} {acc.description && `- ${acc.description}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Label>Contatto</Label>
              <Select value={newOrder.contact_id} onValueChange={(value) => setNewOrder({ ...newOrder, contact_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona contatto" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.map((contact) => (
                    <SelectItem key={contact.id} value={contact.id}>
                      {contact.first_name} {contact.last_name} {contact.company_name && `(${contact.company_name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Priorità</Label>
              <Select value={newOrder.priority} onValueChange={(value) => setNewOrder({ ...newOrder, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Bassa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {(newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tecnico Assegnato</Label>
                <Select value={newOrder.assigned_technician} onValueChange={(value) => setNewOrder({ ...newOrder, assigned_technician: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tecnico" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name} ({tech.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Back Office Manager</Label>
                <Select value={newOrder.back_office_manager} onValueChange={(value) => setNewOrder({ ...newOrder, back_office_manager: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {(newOrder.order_type === 'odl' || newOrder.order_type === 'odpel') && (
            <div>
              <Label>Luogo Intervento</Label>
              <Input
                value={newOrder.location}
                onChange={(e) => setNewOrder({ ...newOrder, location: e.target.value })}
                placeholder="Indirizzo dell'intervento..."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data Inizio Pianificata</Label>
              <Input
                type="date"
                value={newOrder.planned_start_date}
                onChange={(e) => setNewOrder({ ...newOrder, planned_start_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Data Fine Pianificata</Label>
              <Input
                type="date"
                value={newOrder.planned_end_date}
                onChange={(e) => setNewOrder({ ...newOrder, planned_end_date: e.target.value })}
              />
            </div>
          </div>

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
