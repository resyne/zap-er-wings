import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Check, X } from "lucide-react";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { CreateOfferDialog } from "./CreateOfferDialog";

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
  { value: "odl", label: "Commessa di Lavoro (OdL)" },
  { value: "odp", label: "Commessa di Produzione (OdP)" },
  { value: "odpel", label: "Commessa Produzione e Installazione (OdPeL)" },
  { value: "ods", label: "Commessa di Spedizione (OdS)" }
];

const orderSources = [
  { value: "sale", label: "Vendita" },
  { value: "warranty", label: "Garanzia" }
];

export function CreateOrderDialog({ open, onOpenChange, onSuccess, leadId, prefilledData }: CreateOrderDialogProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState("");
  const [offers, setOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  const [offerSearch, setOfferSearch] = useState("");
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [isCreateOfferDialogOpen, setIsCreateOfferDialogOpen] = useState(false);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showOfferDropdown, setShowOfferDropdown] = useState(false);
  const leadInputRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLDivElement>(null);
  const offerInputRef = useRef<HTMLDivElement>(null);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    lead_id: "",
    offer_id: "",
    title: "",
    description: "",
    article: "",
    order_source: "sale",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    expected_delivery_date: "",
    status: "bozza",
    notes: "",
    priority: "medium",
    payment_on_delivery: false,
    payment_amount: "",
    items: [] as Array<{ name: string; price: string }>,
    commissions: {
      production: {
        enabled: false,
        responsible: "",
        back_office_responsible: "",
        bom_id: "",
        accessori_ids: [] as string[],
        planned_start_date: "",
        planned_end_date: "",
        includes_installation: false,
        activity_description: "",
        notes: ""
      },
      service: {
        enabled: false,
        responsible: "",
        back_office_responsible: "",
        work_description: "",
        location: "",
        equipment_needed: "",
        scheduled_date: "",
        notes: ""
      },
      shipping: {
        enabled: false,
        responsible: "",
        back_office_responsible: "",
        shipping_address: "",
        activity_description: "",
        planned_start_date: "",
        planned_end_date: "",
        notes: ""
      }
    }
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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (leadInputRef.current && !leadInputRef.current.contains(event.target as Node)) {
        setShowLeadDropdown(false);
      }
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (offerInputRef.current && !offerInputRef.current.contains(event.target as Node)) {
        setShowOfferDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    // Filter customers based on search
    if (customerSearch.trim() === "") {
      setFilteredCustomers(customers);
    } else {
      const search = customerSearch.toLowerCase();
      setFilteredCustomers(
        customers.filter(
          (customer) =>
            customer.name?.toLowerCase().includes(search) ||
            customer.code?.toLowerCase().includes(search) ||
            customer.company_name?.toLowerCase().includes(search)
        )
      );
    }
  }, [customerSearch, customers]);

  useEffect(() => {
    // Filter leads based on search
    if (leadSearch.trim() === "") {
      setFilteredLeads(leads);
    } else {
      const search = leadSearch.toLowerCase();
      setFilteredLeads(
        leads.filter(
          (lead) =>
            lead.company_name?.toLowerCase().includes(search) ||
            lead.contact_name?.toLowerCase().includes(search) ||
            lead.email?.toLowerCase().includes(search)
        )
      );
    }
  }, [leadSearch, leads]);

  useEffect(() => {
    // Filter offers based on search
    if (offerSearch.trim() === "") {
      setFilteredOffers(offers);
    } else {
      const search = offerSearch.toLowerCase();
      setFilteredOffers(
        offers.filter(
          (offer) =>
            offer.number?.toLowerCase().includes(search) ||
            offer.title?.toLowerCase().includes(search) ||
            offer.customer?.company_name?.toLowerCase().includes(search)
        )
      );
    }
  }, [offerSearch, offers]);

  const loadData = async () => {
    const [customersData, bomsData, accessoriData, leadsData, offersData, techniciansData, usersData] = await Promise.all([
      supabase.from("customers").select("id, code, name, company_name").eq("active", true).order("name"),
      supabase.from("boms").select("id, name, description, level").in("level", [0, 1, 2]).order("name"),
      supabase.from("boms").select("id, name, description, level").eq("level", 3).order("name"),
      supabase.from("leads").select("id, company_name, contact_name, email, phone, status, pipeline").order("company_name"),
      supabase.from("offers").select("id, number, title, customer:customers(company_name, name), status").order("created_at", { ascending: false }),
      supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true).order("first_name"),
      supabase.from("profiles").select("id, email, first_name, last_name").order("first_name")
    ]);
    
    setCustomers(customersData.data || []);
    setFilteredCustomers(customersData.data || []);
    setBoms(bomsData.data || []);
    setAccessori(accessoriData.data || []);
    setLeads(leadsData.data || []);
    setFilteredLeads(leadsData.data || []);
    setOffers(offersData.data || []);
    setFilteredOffers(offersData.data || []);
    setTechnicians(techniciansData.data || []);
    setUsers(usersData.data || []);
  };

  const handleCustomerCreated = async () => {
    await loadData();
    setIsCreateCustomerDialogOpen(false);
  };

  const handleOfferCreated = async () => {
    await loadData();
    setIsCreateOfferDialogOpen(false);
  };

  const createProductionWorkOrder = async (orderId: string, orderData: any) => {
    const commission = newOrder.commissions.production;
    const productionData = {
      number: '',
      title: `Produzione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.notes || '',
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      bom_id: commission.bom_id || null,
      accessori_ids: commission.accessori_ids.length > 0 ? commission.accessori_ids : null,
      assigned_to: commission.responsible || null,
      production_responsible_id: commission.responsible || null,
      back_office_manager: commission.back_office_responsible || null,
      priority: newOrder.priority,
      planned_start_date: commission.planned_start_date || null,
      planned_end_date: commission.planned_end_date || null,
      notes: newOrder.notes,
      includes_installation: commission.includes_installation,
      payment_on_delivery: newOrder.payment_on_delivery,
      payment_amount: newOrder.payment_amount ? Number(newOrder.payment_amount) : null,
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
    const commission = newOrder.commissions.service;
    const serviceData = {
      number: '',
      title: `Lavoro per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: commission.work_description || newOrder.notes,
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      lead_id: newOrder.lead_id || null,
      assigned_to: commission.responsible || null,
      service_responsible_id: commission.responsible || null,
      back_office_manager: commission.back_office_responsible || null,
      priority: newOrder.priority,
      scheduled_date: commission.scheduled_date ? new Date(commission.scheduled_date).toISOString() : null,
      location: commission.location || null,
      equipment_needed: commission.equipment_needed || null,
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
    const commission = newOrder.commissions.shipping;
    const shippingData = {
      number: '',
      customer_id: newOrder.customer_id || null,
      lead_id: newOrder.lead_id || null,
      shipping_responsible_id: commission.responsible || null,
      back_office_responsible_id: commission.back_office_responsible || null,
      status: 'da_preparare' as const,
      order_date: newOrder.order_date || new Date().toISOString().split('T')[0],
      notes: newOrder.notes,
      shipping_address: commission.shipping_address || null,
      payment_on_delivery: newOrder.payment_on_delivery,
      payment_amount: newOrder.payment_amount ? Number(newOrder.payment_amount) : null,
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
    const { production, service, shipping } = newOrder.commissions;
    const hasAtLeastOneCommission = production.enabled || service.enabled || shipping.enabled;

    if (!newOrder.customer_id) {
      toast({
        title: "Errore",
        description: "Cliente obbligatorio",
        variant: "destructive",
      });
      return;
    }

    if (!hasAtLeastOneCommission) {
      toast({
        title: "Errore",
        description: "Seleziona almeno una commessa da creare",
        variant: "destructive",
      });
      return;
    }

    if (production.enabled && !production.bom_id) {
      toast({
        title: "Errore",
        description: "Per la commessa di produzione è necessario selezionare una BOM",
        variant: "destructive",
      });
      return;
    }

    if (service.enabled && !service.work_description) {
      toast({
        title: "Errore",
        description: "Per la commessa di lavoro è necessario descrivere il lavoro da fare",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Determina il tipo di ordine in base alle commesse selezionate
      let orderType = "";
      if (production.enabled && service.enabled) {
        orderType = "odpel"; // Produzione e Lavoro
      } else if (production.enabled) {
        orderType = "odp"; // Solo Produzione
      } else if (service.enabled) {
        orderType = "odl"; // Solo Lavoro
      } else if (shipping.enabled) {
        orderType = "ods"; // Solo Spedizione
      }

      const orderData = {
        number: "",
        customer_id: newOrder.customer_id,
        article: newOrder.article || null,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: orderType,
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

      // Crea le commesse selezionate
      if (production.enabled) {
        productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
      }

      if (service.enabled) {
        serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder, productionWO?.id);
      }

      if (shipping.enabled) {
        shippingOrder = await createShippingOrder(salesOrder.id, salesOrder);
      }

      // Costruisci messaggio di successo
      const commissionMessages: string[] = [];
      if (productionWO) commissionMessages.push(`Commessa di Produzione: ${productionWO.number}`);
      if (serviceWO) commissionMessages.push(`Commessa di Lavoro: ${serviceWO.number}`);
      if (shippingOrder) commissionMessages.push(`Commessa di Spedizione: ${shippingOrder.number}`);

      toast({
        title: "Successo",
        description: `Ordine creato con successo${commissionMessages.length > 0 ? ' - ' + commissionMessages.join(', ') : ''}`,
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

  const addItem = () => {
    setNewOrder({
      ...newOrder,
      items: [...newOrder.items, { name: "", price: "" }]
    });
  };

  const removeItem = (index: number) => {
    setNewOrder({
      ...newOrder,
      items: newOrder.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index: number, field: "name" | "price", value: string) => {
    const updatedItems = [...newOrder.items];
    updatedItems[index][field] = value;
    setNewOrder({
      ...newOrder,
      items: updatedItems
    });
  };

  const resetForm = () => {
    setNewOrder({
      customer_id: "",
      lead_id: "",
      offer_id: "",
      title: "",
      description: "",
      article: "",
      order_source: "sale",
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: "",
      expected_delivery_date: "",
      status: "bozza",
      notes: "",
      priority: "medium",
      payment_on_delivery: false,
      payment_amount: "",
      items: [],
      commissions: {
        production: {
          enabled: false,
          responsible: "",
          back_office_responsible: "",
          bom_id: "",
          accessori_ids: [],
          planned_start_date: "",
          planned_end_date: "",
          includes_installation: false,
          activity_description: "",
          notes: ""
        },
        service: {
          enabled: false,
          responsible: "",
          back_office_responsible: "",
          work_description: "",
          location: "",
          equipment_needed: "",
          scheduled_date: "",
          notes: ""
        },
        shipping: {
          enabled: false,
          responsible: "",
          back_office_responsible: "",
          shipping_address: "",
          activity_description: "",
          planned_start_date: "",
          planned_end_date: "",
          notes: ""
        }
      }
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
            <Label>Offerta di Riferimento</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={offerInputRef}>
                <Input
                  placeholder="Cerca e seleziona offerta..."
                  value={offerSearch}
                  onChange={(e) => {
                    setOfferSearch(e.target.value);
                    setShowOfferDropdown(true);
                  }}
                  onFocus={() => setShowOfferDropdown(true)}
                />
                {newOrder.offer_id && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Selezionato: {offers.find(o => o.id === newOrder.offer_id)?.number} - {offers.find(o => o.id === newOrder.offer_id)?.title}
                  </div>
                )}
                {showOfferDropdown && filteredOffers.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
                    {filteredOffers.map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                        onClick={() => {
                          setNewOrder({ ...newOrder, offer_id: offer.id });
                          setOfferSearch("");
                          setShowOfferDropdown(false);
                        }}
                      >
                        <span className="text-sm">
                          {offer.number} - {offer.title}
                          {offer.customer && ` [${offer.customer.company_name || offer.customer.name}]`}
                        </span>
                        {newOrder.offer_id === offer.id && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setIsCreateOfferDialogOpen(true)}
                title="Crea nuova offerta"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Oggetto / Titolo Ordine *</Label>
              <Input
                placeholder="Inserisci il titolo dell'ordine"
                value={newOrder.title}
                onChange={(e) => setNewOrder({ ...newOrder, title: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrizione Dettagliata</Label>
              <Textarea
                placeholder="Descrizione dettagliata dell'ordine"
                value={newOrder.description}
                onChange={(e) => setNewOrder({ ...newOrder, description: e.target.value })}
                rows={4}
              />
            </div>
          </div>

          {/* Articoli Section */}
          {!newOrder.offer_id && (
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Articoli</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Aggiungi Articolo
                </Button>
              </div>
              
              {newOrder.items.length > 0 ? (
                <div className="space-y-2">
                  {newOrder.items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="Nome articolo"
                          value={item.name}
                          onChange={(e) => updateItem(index, "name", e.target.value)}
                        />
                      </div>
                      <div className="w-32">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Prezzo €"
                          value={item.price}
                          onChange={(e) => updateItem(index, "price", e.target.value)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(index)}
                        className="text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t">
                    <div className="text-sm font-semibold text-right">
                      Totale: €{newOrder.items.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Nessun articolo aggiunto. Clicca "Aggiungi Articolo" per iniziare.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Numero Ordine</Label>
              <Input
                value="Auto-generato"
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Il numero verrà assegnato automaticamente alla creazione
              </p>
            </div>
            
            <div>
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={customerInputRef}>
                  <Input
                    placeholder="Cerca e seleziona cliente..."
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                  />
                  {newOrder.customer_id && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Selezionato: {customers.find(c => c.id === newOrder.customer_id)?.code} - {customers.find(c => c.id === newOrder.customer_id)?.company_name || customers.find(c => c.id === newOrder.customer_id)?.name}
                    </div>
                  )}
                  {showCustomerDropdown && filteredCustomers.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
                      {filteredCustomers.map((customer) => (
                        <button
                          key={customer.id}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                          onClick={() => {
                            setNewOrder({ ...newOrder, customer_id: customer.id });
                            setCustomerSearch("");
                            setShowCustomerDropdown(false);
                          }}
                        >
                          <span className="text-sm">{customer.code} - {customer.company_name || customer.name}</span>
                          {newOrder.customer_id === customer.id && (
                            <Check className="w-4 h-4 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setIsCreateCustomerDialogOpen(true)}
                  title="Aggiungi nuovo cliente"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-semibold">Commesse da Creare</Label>
            
            {/* Commessa di Produzione */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commission_production"
                  checked={newOrder.commissions.production.enabled}
                  onCheckedChange={(checked) => 
                    setNewOrder({ 
                      ...newOrder, 
                      commissions: { 
                        ...newOrder.commissions, 
                        production: { ...newOrder.commissions.production, enabled: checked === true } 
                      } 
                    })
                  }
                />
                <Label 
                  htmlFor="commission_production"
                  className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Commessa di Produzione
                </Label>
              </div>

              {newOrder.commissions.production.enabled && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Responsabile Tecnico *</Label>
                      <Select 
                        value={newOrder.commissions.production.responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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
                    
                    <div>
                      <Label>Responsabile Back Office</Label>
                      <Select 
                        value={newOrder.commissions.production.back_office_responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, back_office_responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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

                  <div>
                    <Label>BOM (Distinta Base) *</Label>
                    <Select 
                      value={newOrder.commissions.production.bom_id} 
                      onValueChange={(value) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            production: { ...newOrder.commissions.production, bom_id: value } 
                          } 
                        })
                      }
                    >
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

                  {accessori.length > 0 && (
                    <div>
                      <Label>Accessori</Label>
                      <Select 
                        value={newOrder.commissions.production.accessori_ids.join(',')} 
                        onValueChange={(value) => {
                          const ids = value ? value.split(',').filter(Boolean) : [];
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, accessori_ids: ids } 
                            } 
                          });
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

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data Inizio Pianificata</Label>
                      <Input
                        type="date"
                        value={newOrder.commissions.production.planned_start_date}
                        onChange={(e) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, planned_start_date: e.target.value } 
                            } 
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Data Fine Pianificata</Label>
                      <Input
                        type="date"
                        value={newOrder.commissions.production.planned_end_date}
                        onChange={(e) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, planned_end_date: e.target.value } 
                            } 
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includes_installation"
                      checked={newOrder.commissions.production.includes_installation}
                      onCheckedChange={(checked) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            production: { ...newOrder.commissions.production, includes_installation: checked === true } 
                          } 
                        })
                      }
                    />
                    <Label 
                      htmlFor="includes_installation"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      Include Installazione
                    </Label>
                  </div>

                  <div>
                    <Label>Descrizione Attività</Label>
                    <Textarea
                      value={newOrder.commissions.production.activity_description}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            production: { ...newOrder.commissions.production, activity_description: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Cosa deve fare il reparto produzione..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Note / Istruzioni</Label>
                    <Textarea
                      value={newOrder.commissions.production.notes}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            production: { ...newOrder.commissions.production, notes: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Note aggiuntive, allegati necessari..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Commessa di Lavoro */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commission_service"
                  checked={newOrder.commissions.service.enabled}
                  onCheckedChange={(checked) => 
                    setNewOrder({ 
                      ...newOrder, 
                      commissions: { 
                        ...newOrder.commissions, 
                        service: { ...newOrder.commissions.service, enabled: checked === true } 
                      } 
                    })
                  }
                />
                <Label 
                  htmlFor="commission_service"
                  className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Commessa di Lavoro
                </Label>
              </div>

              {newOrder.commissions.service.enabled && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Responsabile Tecnico *</Label>
                      <Select 
                        value={newOrder.commissions.service.responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              service: { ...newOrder.commissions.service, responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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
                    
                    <div>
                      <Label>Responsabile Back Office</Label>
                      <Select 
                        value={newOrder.commissions.service.back_office_responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              service: { ...newOrder.commissions.service, back_office_responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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

                  <div>
                    <Label>Descrizione Lavoro *</Label>
                    <Textarea
                      value={newOrder.commissions.service.work_description}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, work_description: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Descrivi il lavoro da svolgere..."
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label>Luogo Intervento</Label>
                    <Input
                      value={newOrder.commissions.service.location}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, location: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Indirizzo dell'intervento..."
                    />
                  </div>

                  <div>
                    <Label>Attrezzatura Necessaria</Label>
                    <Input
                      value={newOrder.commissions.service.equipment_needed}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, equipment_needed: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Attrezzatura necessaria..."
                    />
                  </div>

                  <div>
                    <Label>Data Pianificata</Label>
                    <Input
                      type="date"
                      value={newOrder.commissions.service.scheduled_date}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, scheduled_date: e.target.value } 
                          } 
                        })
                      }
                    />
                  </div>

                  <div>
                    <Label>Note / Istruzioni</Label>
                    <Textarea
                      value={newOrder.commissions.service.notes}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, notes: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Note aggiuntive, allegati necessari..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Commessa di Spedizione */}
            <div className="space-y-3 border rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="commission_shipping"
                  checked={newOrder.commissions.shipping.enabled}
                  onCheckedChange={(checked) => 
                    setNewOrder({ 
                      ...newOrder, 
                      commissions: { 
                        ...newOrder.commissions, 
                        shipping: { ...newOrder.commissions.shipping, enabled: checked === true } 
                      } 
                    })
                  }
                />
                <Label 
                  htmlFor="commission_shipping"
                  className="text-sm font-semibold leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Commessa di Spedizione
                </Label>
              </div>

              {newOrder.commissions.shipping.enabled && (
                <div className="space-y-3 pl-6">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Responsabile Tecnico *</Label>
                      <Select 
                        value={newOrder.commissions.shipping.responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              shipping: { ...newOrder.commissions.shipping, responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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
                    
                    <div>
                      <Label>Responsabile Back Office</Label>
                      <Select 
                        value={newOrder.commissions.shipping.back_office_responsible} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              shipping: { ...newOrder.commissions.shipping, back_office_responsible: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona responsabile" />
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

                  <div>
                    <Label>Indirizzo di Spedizione</Label>
                    <Textarea
                      value={newOrder.commissions.shipping.shipping_address}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            shipping: { ...newOrder.commissions.shipping, shipping_address: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Indirizzo completo di spedizione..."
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label>Descrizione Attività</Label>
                    <Textarea
                      value={newOrder.commissions.shipping.activity_description}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            shipping: { ...newOrder.commissions.shipping, activity_description: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Cosa deve fare il reparto spedizioni..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Data Inizio Pianificata</Label>
                      <Input
                        type="date"
                        value={newOrder.commissions.shipping.planned_start_date}
                        onChange={(e) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              shipping: { ...newOrder.commissions.shipping, planned_start_date: e.target.value } 
                            } 
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Data Fine Pianificata</Label>
                      <Input
                        type="date"
                        value={newOrder.commissions.shipping.planned_end_date}
                        onChange={(e) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              shipping: { ...newOrder.commissions.shipping, planned_end_date: e.target.value } 
                            } 
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Note / Istruzioni</Label>
                    <Textarea
                      value={newOrder.commissions.shipping.notes}
                      onChange={(e) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            shipping: { ...newOrder.commissions.shipping, notes: e.target.value } 
                          } 
                        })
                      }
                      placeholder="Note aggiuntive, allegati necessari..."
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Lead di Riferimento</Label>
              <div className="relative" ref={leadInputRef}>
                <Input
                  placeholder="Cerca e seleziona lead..."
                  value={leadSearch}
                  onChange={(e) => {
                    setLeadSearch(e.target.value);
                    setShowLeadDropdown(true);
                  }}
                  onFocus={() => setShowLeadDropdown(true)}
                />
                {newOrder.lead_id && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Selezionato: {leads.find(l => l.id === newOrder.lead_id)?.company_name}
                    {leads.find(l => l.id === newOrder.lead_id)?.contact_name && ` - ${leads.find(l => l.id === newOrder.lead_id)?.contact_name}`}
                  </div>
                )}
                {showLeadDropdown && filteredLeads.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
                    {filteredLeads.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center justify-between"
                        onClick={() => {
                          setNewOrder({ ...newOrder, lead_id: lead.id });
                          setLeadSearch("");
                          setShowLeadDropdown(false);
                        }}
                      >
                        <span className="text-sm">
                          {lead.company_name}
                          {lead.contact_name && ` - ${lead.contact_name}`}
                          {lead.pipeline && ` [${lead.pipeline}]`}
                        </span>
                        {newOrder.lead_id === lead.id && (
                          <Check className="w-4 h-4 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="payment_on_delivery"
                checked={newOrder.payment_on_delivery}
                onCheckedChange={(checked) => 
                  setNewOrder({ ...newOrder, payment_on_delivery: checked === true })
                }
              />
              <Label 
                htmlFor="payment_on_delivery"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Pagamento alla Consegna
              </Label>
            </div>

            {newOrder.payment_on_delivery && (
              <div>
                <Label>Importo Pagamento (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newOrder.payment_amount}
                  onChange={(e) => setNewOrder({ ...newOrder, payment_amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            )}
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
      
      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />
      
      <CreateOfferDialog
        open={isCreateOfferDialogOpen}
        onOpenChange={setIsCreateOfferDialogOpen}
        onSuccess={handleOfferCreated}
      />
    </Dialog>
  );
}
