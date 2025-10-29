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
import { Plus, Check, X, Image as ImageIcon } from "lucide-react";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { CreateOfferDialog } from "./CreateOfferDialog";
import ImageSlideshow from "@/components/crm/ImageSlideshow";

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  leadId?: string;
  prefilledData?: {
    customer_id?: string;
    lead_id?: string;
    offer_id?: string;
    title?: string;
    description?: string;
    payment_amount?: string;
    notes?: string;
  };
}

const orderTypes = [
  { value: "odl", label: "Commessa di Lavoro (CdL)" },
  { value: "odp", label: "Commessa di Produzione (CdP)" },
  { value: "odpel", label: "Commessa Produzione e Installazione (CdP+L)" },
  { value: "ods", label: "Commessa di Spedizione (CdS)" }
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
  const [products, setProducts] = useState<any[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [isCreateOfferDialogOpen, setIsCreateOfferDialogOpen] = useState(false);
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showOfferDropdown, setShowOfferDropdown] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const leadInputRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLDivElement>(null);
  const offerInputRef = useRef<HTMLDivElement>(null);
  const productInputRef = useRef<HTMLDivElement>(null);
  
  // Lead photos state
  const [leadPhotos, setLeadPhotos] = useState<Array<{ url: string; name: string }>>([]);
  const [slideshowOpen, setSlideshowOpen] = useState(false);
  const [slideshowStartIndex, setSlideshowStartIndex] = useState(0);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    lead_id: "",
    offer_id: "",
    title: "",
    description: "",
    articles: [] as string[],
    order_source: "sale",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    expected_delivery_date: "",
    status: "draft",
    notes: "",
    priority: "medium",
    payment_on_delivery: false,
    payment_amount: "",
    commissions: {
      production: {
        enabled: false,
        responsible: "",
        diameter: "",
        smoke_inlet: ""
      },
      service: {
        enabled: false,
        responsible: ""
      },
      shipping: {
        enabled: false,
        responsible: ""
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

  // Load offer items and financial data when offer_id changes
  useEffect(() => {
    const loadOfferData = async () => {
      if (!newOrder.offer_id) {
        // Se non c'è offer_id, pulisci gli articoli
        setNewOrder(prev => ({
          ...prev,
          articles: []
        }));
        return;
      }

      try {
        // Load offer items
        const { data: offerItems, error: itemsError } = await supabase
          .from('offer_items')
          .select('description, quantity')
          .eq('offer_id', newOrder.offer_id);

        if (itemsError) throw itemsError;

        // Load offer financial data
        const { data: offerData, error: offerError } = await supabase
          .from('offers')
          .select('amount')
          .eq('id', newOrder.offer_id)
          .single();

        if (offerError) throw offerError;

        const updates: any = {};

        // Update articles - create clean array to avoid duplicates
        if (offerItems && offerItems.length > 0) {
          const articles = offerItems.map(item => {
            const quantity = item.quantity || 1;
            return `${quantity}x ${item.description}`;
          });
          updates.articles = articles;
          console.log('Loaded articles from offer:', articles);
        } else {
          updates.articles = [];
        }

        // Update payment amount from offer
        if (offerData && offerData.amount) {
          updates.payment_amount = offerData.amount.toString();
        }

        // Replace articles completely, don't merge
        setNewOrder(prev => ({
          ...prev,
          ...updates
        }));
      } catch (error) {
        console.error('Error loading offer data:', error);
      }
    };

    loadOfferData();
  }, [newOrder.offer_id]);

  // Load lead photos when lead_id changes
  useEffect(() => {
    const loadLeadPhotos = async () => {
      const effectiveLeadId = newOrder.lead_id || leadId;
      console.log('Loading lead photos for lead_id:', effectiveLeadId);
      
      if (!effectiveLeadId) {
        setLeadPhotos([]);
        return;
      }

      try {
        const { data: leadFiles, error } = await supabase
          .from('lead_files')
          .select('*')
          .eq('lead_id', effectiveLeadId);

        if (error) throw error;

        console.log('Lead files found:', leadFiles);

        // Filter image and video files
        const mediaFiles = (leadFiles || []).filter(file => 
          file.file_type?.startsWith('image/') || 
          file.file_type?.startsWith('video/') ||
          /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
        );

        console.log('Media files filtered:', mediaFiles);

        const photos = mediaFiles.map(file => {
          const url = supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl;
          console.log('Photo URL generated:', url);
          return {
            url,
            name: file.file_name
          };
        });

        console.log('Lead photos loaded:', photos);
        setLeadPhotos(photos);
      } catch (error) {
        console.error('Error loading lead photos:', error);
        setLeadPhotos([]);
      }
    };

    loadLeadPhotos();
  }, [newOrder.lead_id, leadId]);

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
      if (productInputRef.current && !productInputRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
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

  useEffect(() => {
    // Filter products based on search
    if (productSearch.trim() === "") {
      setFilteredProducts(products);
    } else {
      const search = productSearch.toLowerCase();
      setFilteredProducts(
        products.filter(
          (product) =>
            product.name?.toLowerCase().includes(search) ||
            product.code?.toLowerCase().includes(search) ||
            product.description?.toLowerCase().includes(search)
        )
      );
    }
  }, [productSearch, products]);

  const loadData = async () => {
    const [customersData, bomsData, accessoriData, leadsData, offersData, techniciansData, usersData, productsData] = await Promise.all([
      supabase.from("customers").select("id, code, name, company_name").eq("active", true).order("name"),
      supabase.from("boms").select("id, name, description, level").in("level", [0, 1, 2]).order("name"),
      supabase.from("boms").select("id, name, description, level").eq("level", 3).order("name"),
      supabase.from("leads").select("id, company_name, contact_name, email, phone, status, pipeline").order("company_name"),
      supabase.from("offers").select(`
        id, 
        number, 
        title, 
        lead_id, 
        customer:customers(company_name, name), 
        status
      `).order("created_at", { ascending: false }),
      supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true).order("first_name"),
      supabase.from("profiles").select("id, email, first_name, last_name").order("first_name"),
      supabase.from("products").select("id, code, name, description, product_type").eq("is_active", true).order("name")
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
    setProducts(productsData.data || []);
    setFilteredProducts(productsData.data || []);
  };

  const handleCustomerCreated = async (customerId?: string) => {
    await loadData();
    setIsCreateCustomerDialogOpen(false);
    
    // Seleziona automaticamente il cliente appena creato
    if (customerId) {
      setNewOrder({ ...newOrder, customer_id: customerId });
    }
  };

  const handleOfferCreated = async () => {
    await loadData();
    setIsCreateOfferDialogOpen(false);
  };

  const createProductionWorkOrder = async (orderId: string, orderData: any) => {
    const commission = newOrder.commissions.production;
    
    // Prepare offer reference
    let offerReference = '';
    if (newOrder.offer_id) {
      const selectedOffer = offers.find(o => o.id === newOrder.offer_id);
      if (selectedOffer) {
        offerReference = `Rif. Offerta: ${selectedOffer.number}`;
      }
    }
    
    // Converti stringhe vuote in null per i campi foreign key
    const assignedTo = commission.responsible?.trim() !== '' ? commission.responsible : null;
    const effectiveLeadId = newOrder.lead_id || leadId || null;
    
    // Imposta lo status in base all'assegnazione
    const workOrderStatus = assignedTo ? 'in_lavorazione' as const : 'da_fare' as const;
    
    const productionData = {
      number: '',
      title: newOrder.title || `Produzione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.description || newOrder.notes || '',
      status: workOrderStatus,
      customer_id: newOrder.customer_id,
      lead_id: effectiveLeadId,
      production_responsible_id: assignedTo,
      priority: newOrder.priority,
      notes: offerReference ? `${offerReference}\n\n${newOrder.notes || ''}`.trim() : newOrder.notes,
      article: newOrder.articles.join('\n') || null,
      payment_on_delivery: newOrder.payment_on_delivery,
      payment_amount: newOrder.payment_amount ? Number(newOrder.payment_amount) : null,
      sales_order_id: orderId,
      diameter: commission.diameter || null,
      smoke_inlet: commission.smoke_inlet || null,
      attachments: orderData.attachments || []
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
    
    // Prepare offer reference
    let offerReference = '';
    if (newOrder.offer_id) {
      const selectedOffer = offers.find(o => o.id === newOrder.offer_id);
      if (selectedOffer) {
        offerReference = `Rif. Offerta: ${selectedOffer.number}`;
      }
    }
    
    // Converti stringhe vuote in null per i campi foreign key
    const serviceResponsible = commission.responsible?.trim() !== '' ? commission.responsible : null;
    
    const serviceData = {
      number: '',
      title: newOrder.title || `Lavoro per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.description || newOrder.notes || '',
      status: 'da_programmare' as const,
      customer_id: newOrder.customer_id,
      lead_id: newOrder.lead_id || null,
      service_responsible_id: serviceResponsible,
      priority: newOrder.priority,
      notes: offerReference ? `${offerReference}\n\n${newOrder.notes || ''}`.trim() : newOrder.notes,
      article: newOrder.articles.join('\n') || null,
      production_work_order_id: productionWOId || null,
      sales_order_id: orderId,
      attachments: orderData.attachments || []
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
    
    // Prepare offer reference
    let offerReference = '';
    if (newOrder.offer_id) {
      const selectedOffer = offers.find(o => o.id === newOrder.offer_id);
      if (selectedOffer) {
        offerReference = `Rif. Offerta: ${selectedOffer.number}`;
      }
    }
    
    // Converti stringhe vuote in null per i campi foreign key
    const shippingResponsible = commission.responsible?.trim() !== '' ? commission.responsible : null;
    
    const shippingData = {
      number: '',
      customer_id: newOrder.customer_id || null,
      shipping_responsible_id: shippingResponsible,
      status: 'da_preparare' as const,
      order_date: newOrder.order_date || new Date().toISOString().split('T')[0],
      notes: offerReference ? `${offerReference}\n\n${newOrder.notes || ''}`.trim() : newOrder.notes,
      article: newOrder.articles.join('\n') || null,
      payment_on_delivery: newOrder.payment_on_delivery,
      payment_amount: newOrder.payment_amount ? Number(newOrder.payment_amount) : null,
      sales_order_id: orderId,
      attachments: orderData.attachments || []
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

      // Filter image and video files
      const mediaFiles = leadFiles.filter(file => 
        file.file_type?.startsWith('image/') || 
        file.file_type?.startsWith('video/') ||
        /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
      );

      if (mediaFiles.length === 0) return;

      // Copy each media file to opportunity-files bucket
      for (const file of mediaFiles) {
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
        title: "Media copiati",
        description: `${mediaFiles.length} foto/video copiati dal lead all'ordine`,
      });
    } catch (error) {
      console.error('Error copying lead photos:', error);
      // Don't throw - we don't want to block order creation if photo copy fails
    }
  };

  const copyLeadPhotosToWorkOrder = async (leadId: string, workOrderId: string) => {
    try {
      // Get all files from the lead
      const { data: leadFiles, error: leadFilesError } = await supabase
        .from('lead_files')
        .select('*')
        .eq('lead_id', leadId);

      if (leadFilesError) throw leadFilesError;
      if (!leadFiles || leadFiles.length === 0) return;

      // Filter image and video files
      const mediaFiles = leadFiles.filter(file => 
        file.file_type?.startsWith('image/') || 
        file.file_type?.startsWith('video/') ||
        /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
      );

      if (mediaFiles.length === 0) return;

      // Copy each media file to production-files bucket
      for (const file of mediaFiles) {
        // Download file from lead-files bucket
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('lead-files')
          .download(file.file_path);

        if (downloadError) {
          console.error(`Error downloading file ${file.file_name}:`, downloadError);
          continue;
        }

        // Upload to production-files bucket
        const fileExt = file.file_name.split('.').pop();
        const newFileName = `${workOrderId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('production-files')
          .upload(newFileName, fileData, {
            contentType: file.file_type || 'application/octet-stream'
          });

        if (uploadError) {
          console.error(`Error uploading file to work order ${file.file_name}:`, uploadError);
        }
      }
    } catch (error) {
      console.error('Error copying lead photos to work order:', error);
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

    if (!newOrder.articles || newOrder.articles.length === 0) {
      toast({
        title: "Errore",
        description: "Aggiungi almeno un articolo",
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
        article: newOrder.articles.join('\n') || null,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: orderType,
        order_source: newOrder.order_source,
        lead_id: newOrder.lead_id || leadId || null,
        offer_id: newOrder.offer_id || null,
        total_amount: newOrder.payment_amount ? parseFloat(newOrder.payment_amount) : null
      };

      const { data: salesOrder, error: salesError } = await supabase
        .from("sales_orders")
        .insert([orderData])
        .select(`*, customers(name, code)`)
        .single();

      if (salesError) throw salesError;

      // Copy photos from lead to order if lead is connected
      const effectiveLeadId = newOrder.lead_id || leadId;
      if (effectiveLeadId) {
        await copyLeadPhotosToOrder(effectiveLeadId, salesOrder.id);
      }

      let productionWO = null;
      let serviceWO = null;
      let shippingOrder = null;

      // Crea le commesse selezionate
      try {
        if (production.enabled) {
          productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
          console.log('Production work order created:', productionWO);
          
          // Copy photos from lead to production work order if lead is connected
          if (effectiveLeadId && productionWO) {
            await copyLeadPhotosToWorkOrder(effectiveLeadId, productionWO.id);
          }
        }
      } catch (error: any) {
        console.error('Error creating production work order:', error);
        throw new Error(`Errore creazione commessa di produzione: ${error.message}`);
      }

      try {
        if (service.enabled) {
          serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder, productionWO?.id);
          console.log('Service work order created:', serviceWO);
        }
      } catch (error: any) {
        console.error('Error creating service work order:', error);
        throw new Error(`Errore creazione commessa di lavoro: ${error.message}`);
      }

      try {
        if (shipping.enabled) {
          shippingOrder = await createShippingOrder(salesOrder.id, salesOrder);
          console.log('Shipping order created:', shippingOrder);
        }
      } catch (error: any) {
        console.error('Error creating shipping order:', error);
        throw new Error(`Errore creazione commessa di spedizione: ${error.message}`);
      }

      // Archivia l'offerta se è stata utilizzata per creare l'ordine
      if (newOrder.offer_id) {
        await supabase
          .from('offers')
          .update({ archived: true })
          .eq('id', newOrder.offer_id);
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


  const resetForm = () => {
    setNewOrder({
      customer_id: "",
      lead_id: "",
      offer_id: "",
      title: "",
      description: "",
      articles: [],
      order_source: "sale",
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: "",
      expected_delivery_date: "",
      status: "draft",
      notes: "",
      priority: "medium",
      payment_on_delivery: false,
      payment_amount: "",
      commissions: {
        production: {
          enabled: false,
          responsible: "",
          diameter: "",
          smoke_inlet: ""
        },
        service: {
          enabled: false,
          responsible: ""
        },
        shipping: {
          enabled: false,
          responsible: ""
        }
      }
    });
    setProductSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Ordine</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Titolo e Descrizione */}
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

          {/* Priorità */}
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

          {/* Offerta di Riferimento */}
          <div>
            <Label>Offerta di Riferimento (Opzionale)</Label>
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
                  <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md">
                    <p className="text-sm font-medium text-primary">
                      ✓ Offerta selezionata: {offers.find(o => o.id === newOrder.offer_id)?.number} - {offers.find(o => o.id === newOrder.offer_id)?.title}
                    </p>
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
                          setNewOrder({ 
                            ...newOrder, 
                            offer_id: offer.id,
                            lead_id: offer.lead_id || newOrder.lead_id
                          });
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

          {/* Lead di Riferimento */}
          <div>
            <Label>Lead di Riferimento (Opzionale)</Label>
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
                <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md">
                  <p className="text-sm font-medium text-primary">
                    ✓ Lead selezionato: {leads.find(l => l.id === newOrder.lead_id)?.company_name}
                    {leads.find(l => l.id === newOrder.lead_id)?.contact_name && ` - ${leads.find(l => l.id === newOrder.lead_id)?.contact_name}`}
                  </p>
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

          {/* Lead Photos/Videos Preview */}
          {leadPhotos.length > 0 && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">
                  Media dal Lead ({leadPhotos.length})
                </Label>
                <span className="text-xs text-muted-foreground">
                  (saranno copiati nell'ordine)
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {leadPhotos.slice(0, 8).map((photo, index) => (
                  <div
                    key={index}
                    className="aspect-square rounded-lg overflow-hidden border cursor-pointer hover:ring-2 hover:ring-primary transition-all"
                    onClick={() => {
                      setSlideshowStartIndex(index);
                      setSlideshowOpen(true);
                    }}
                  >
                    <img
                      src={photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
              {leadPhotos.length > 8 && (
                <p className="text-xs text-muted-foreground mt-2">
                  +{leadPhotos.length - 8} altri media
                </p>
              )}
            </div>
          )}

          {/* Cliente */}
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
                  <div className="mt-2 px-3 py-2 bg-primary/10 border border-primary/20 rounded-md">
                    <p className="text-sm font-medium text-primary">
                      ✓ Cliente selezionato: {customers.find(c => c.id === newOrder.customer_id)?.code} - {customers.find(c => c.id === newOrder.customer_id)?.company_name || customers.find(c => c.id === newOrder.customer_id)?.name}
                    </p>
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

          {/* Articoli */}
          <div className="space-y-3">
            <Label>Articoli / Prodotti *</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative" ref={productInputRef}>
                <Input
                  placeholder="Cerca prodotto dall'anagrafica o scrivi manualmente..."
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && productSearch.trim()) {
                      e.preventDefault();
                      setNewOrder({ 
                        ...newOrder, 
                        articles: [...newOrder.articles, productSearch.trim()] 
                      });
                      setProductSearch("");
                      setShowProductDropdown(false);
                    }
                  }}
                />
                {showProductDropdown && filteredProducts.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          const productText = `${product.code} - ${product.name}${product.description ? ` (${product.description})` : ''}`;
                          setNewOrder({ 
                            ...newOrder, 
                            articles: [...newOrder.articles, productText] 
                          });
                          setProductSearch("");
                          setShowProductDropdown(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{product.code} - {product.name}</span>
                          {product.description && (
                            <span className="text-xs text-muted-foreground">{product.description}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (productSearch.trim()) {
                    setNewOrder({ 
                      ...newOrder, 
                      articles: [...newOrder.articles, productSearch.trim()] 
                    });
                    setProductSearch("");
                    setShowProductDropdown(false);
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Lista articoli aggiunti */}
            {newOrder.articles.length > 0 && (
              <div className="space-y-2 border rounded-lg p-3 bg-muted/50">
                {newOrder.articles.map((article, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 bg-background p-2 rounded border">
                    <span className="text-sm flex-1">{article}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setNewOrder({
                          ...newOrder,
                          articles: newOrder.articles.filter((_, i) => i !== index)
                        });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
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
                  <div>
                    <Label>Responsabile Commessa (opzionale)</Label>
                    <Select 
                      value={newOrder.commissions.production.responsible} 
                      onValueChange={(value) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            production: { ...newOrder.commissions.production, responsible: value === "unassigned" ? "" : value } 
                          } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non assegnata - verrà presa in carico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Non assegnata</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Diametro</Label>
                      <Input
                        placeholder="Es. 800mm"
                        value={newOrder.commissions.production.diameter}
                        onChange={(e) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, diameter: e.target.value } 
                            } 
                          })
                        }
                      />
                    </div>
                    
                    <div>
                      <Label>Ingresso Fumi</Label>
                      <Select 
                        value={newOrder.commissions.production.smoke_inlet} 
                        onValueChange={(value) => 
                          setNewOrder({ 
                            ...newOrder, 
                            commissions: { 
                              ...newOrder.commissions, 
                              production: { ...newOrder.commissions.production, smoke_inlet: value } 
                            } 
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dx">Destra</SelectItem>
                          <SelectItem value="sx">Sinistra</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
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
                  <div>
                    <Label>Responsabile Commessa (opzionale)</Label>
                    <Select 
                      value={newOrder.commissions.service.responsible} 
                      onValueChange={(value) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            service: { ...newOrder.commissions.service, responsible: value === "unassigned" ? "" : value } 
                          } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non assegnata - verrà presa in carico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Non assegnata</SelectItem>
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
                  <div>
                    <Label>Responsabile Commessa (opzionale)</Label>
                    <Select 
                      value={newOrder.commissions.shipping.responsible} 
                      onValueChange={(value) => 
                        setNewOrder({ 
                          ...newOrder, 
                          commissions: { 
                            ...newOrder.commissions, 
                            shipping: { ...newOrder.commissions.shipping, responsible: value === "unassigned" ? "" : value } 
                          } 
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Non assegnata - verrà presa in carico" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Non assegnata</SelectItem>
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
            </div>
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
        defaultStatus="offerta_pronta"
        onSuccess={handleOfferCreated}
      />

      {/* Image Slideshow for Lead Photos */}
      <ImageSlideshow
        images={leadPhotos}
        initialIndex={slideshowStartIndex}
        open={slideshowOpen}
        onOpenChange={setSlideshowOpen}
      />
    </Dialog>
  );
}
