import { useState, useEffect } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Calendar, Package, FileImage, Upload, X, Edit, Trash2, MoreHorizontal, LayoutGrid, List, ExternalLink, ArchiveRestore } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFinancialInfo } from "@/components/orders/OrderFinancialInfo";
import { OrderActivityLog } from "@/components/orders/OrderActivityLog";
import { OrderComments } from "@/components/orders/OrderComments";
import { CreateOrderDialog } from "@/components/dashboard/CreateOrderDialog";
import { OrderFileManager } from "@/components/orders/OrderFileManager";
import { OrderWorkOrdersManager } from "@/components/orders/OrderWorkOrdersManager";

interface Order {
  id: string;
  number: string;
  customer_id?: string;
  article?: string;
  order_date?: string;
  delivery_date?: string;
  status?: string;
  notes?: string;
  order_type?: string;
  lead_id?: string;
  offer_id?: string;
  archived?: boolean;
  created_at: string;
  created_by?: string;
  attachments?: Array<{
    path: string;
    name: string;
    size: number;
    type: string;
  }>;
  customers?: {
    name: string;
    code: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
  offers?: {
    id: string;
    number: string;
    title: string;
  };
  work_orders?: Array<{
    id: string;
    number: string;
    status: string;
    includes_installation: boolean;
  }>;
  service_work_orders?: Array<{
    id: string;
    number: string;
    status: string;
  }>;
  shipping_orders?: Array<{
    id: string;
    number: string;
    status: string;
  }>;
  profiles?: {
    email: string;
    first_name: string;
    last_name: string;
  };
}

const orderStatuses = ["commissionato", "in_lavorazione", "completato"];
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

export default function OrdersPage() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [confirmedOffers, setConfirmedOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "work" | "installation" | "shipping">("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [allOffers, setAllOffers] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [selectedOfferForOrder, setSelectedOfferForOrder] = useState<any | null>(null);
  const [statusChangeConfirm, setStatusChangeConfirm] = useState<{
    open: boolean;
    orderId: string;
    newStatus: string;
  } | null>(null);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    lead_id: "",
    order_type: "",
    order_source: "sale",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    expected_delivery_date: "",
    status: "commissionato",
    notes: "",
    work_description: "",
    bom_id: "",
    accessori_ids: [] as string[], // Array of selected accessori IDs
    assigned_technician: "",
    back_office_manager: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    location: "",
    equipment_needed: "",
    shipping_address: "",
    offer_id: ""
  });
  
  const { toast } = useToast();

  // Gestisci l'apertura automatica del dialogo quando si arriva da un lead vinto
  useEffect(() => {
    if (location.state?.openCreateDialog && location.state?.leadId) {
      const { leadId, leadData } = location.state;
      setNewOrder(prev => ({
        ...prev,
        lead_id: leadId,
        notes: `Ordine da lead vinto: ${leadData.company_name}${leadData.contact_name ? ' - ' + leadData.contact_name : ''}\n\nContatto: ${leadData.contact_name || 'N/A'}\nEmail: ${leadData.email || 'N/A'}\nTelefono: ${leadData.phone || 'N/A'}\n\n${leadData.notes || ''}`
      }));
      setIsDialogOpen(true);
      
      // Pulisci lo state per evitare riaperture
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);


  useEffect(() => {
    loadOrders();
    loadRelatedData();
    loadConfirmedOffers();
  }, [showArchivedOrders]);

  const loadConfirmedOffers = async () => {
    try {
      const { data, error } = await supabase
        .from("offers")
        .select(`
          *,
          customers(name, code),
          leads(id, company_name)
        `)
        .eq("status", "accettata")
        .eq("archived", false)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConfirmedOffers(data || []);
    } catch (error: any) {
      console.error("Error loading confirmed offers:", error);
    }
  };

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          customers(name, code),
          leads(id, company_name),
          offers(id, number, title),
          work_orders(id, number, status, includes_installation),
          service_work_orders(id, number, status),
          shipping_orders(id, number, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Load creator profiles for orders that have created_by
      const orderIds = (data || []).map(order => order.created_by).filter(Boolean);
      let profilesMap: Record<string, any> = {};
      
      if (orderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, email, first_name, last_name")
          .in("id", orderIds);
        
        if (profilesData) {
          profilesMap = profilesData.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, any>);
        }
      }
      
      // Parse attachments from JSON and add profiles
      const ordersWithAttachments = (data || []).map(order => ({
        ...order,
        attachments: Array.isArray(order.attachments) ? order.attachments : [],
        profiles: order.created_by ? profilesMap[order.created_by] : null
      }));
      
      setOrders(ordersWithAttachments as unknown as Order[]);
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

  const loadRelatedData = async () => {
    try {
      const [customersRes, bomsRes, accessoriRes, techniciansRes, usersRes, leadsRes, offersRes] = await Promise.all([
        supabase.from("customers").select("id, name, code").eq("active", true),
        supabase.from("boms").select("id, name, version, level").in("level", [0, 1, 2]).order("name"),
        supabase.from("boms").select("id, name, version, level").eq("level", 3).order("name"),
        supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true),
        supabase.from("profiles").select("id, email, first_name, last_name").order("first_name"),
        supabase.from("leads").select("id, company_name, contact_name, status, pipeline").order("company_name"),
        supabase.from("offers").select("id, number, title, customer_id").order("number", { ascending: false })
      ]);

      if (customersRes.error) throw customersRes.error;
      if (bomsRes.error) throw bomsRes.error;
      if (accessoriRes.error) throw accessoriRes.error;
      if (techniciansRes.error) throw techniciansRes.error;
      if (usersRes.error) throw usersRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (offersRes.error) throw offersRes.error;

      setCustomers(customersRes.data || []);
      setBoms(bomsRes.data || []);
      setAccessori(accessoriRes.data || []);
      setTechnicians(techniciansRes.data || []);
      setUsers(usersRes.data || []);
      setLeads(leadsRes.data || []);
      setAllOffers(offersRes.data || []);
    } catch (error: any) {
      console.error("Error loading related data:", error);
    }
  };

  const uploadOrderPhotos = async (orderId: string) => {
    if (uploadedFiles.length === 0) return [];

    const uploadPromises = uploadedFiles.map(async (file) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${orderId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('opportunity-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;
      
      return fileName;
    });

    return Promise.all(uploadPromises);
  };

  // Fast buttons function for setting planned dates
  const setPlannedDuration = (hours: number) => {
    const now = new Date();
    const startDate = now.toISOString().split('T')[0]; // Format for date input (YYYY-MM-DD)
    const endDate = new Date(now.getTime() + (hours * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    setNewOrder(prev => ({
      ...prev,
      planned_start_date: startDate,
      planned_end_date: endDate
    }));
  };

  const createProductionWorkOrder = async (orderId: string, orderData: any) => {
    const productionData = {
      number: '', // Auto-generated
      title: `Produzione per ordine ${orderData.customers?.name || 'Cliente'}`,
      status: 'da_fare' as const,
      bom_id: newOrder.bom_id || null,
      customer_id: newOrder.customer_id,
      assigned_to: (newOrder.assigned_technician && newOrder.assigned_technician.trim() !== '') ? newOrder.assigned_technician : null,
      back_office_manager: (newOrder.back_office_manager && newOrder.back_office_manager.trim() !== '') ? newOrder.back_office_manager : null,
      priority: newOrder.priority,
      planned_start_date: newOrder.planned_start_date || null,
      planned_end_date: newOrder.planned_end_date || null,
      notes: newOrder.notes,
      article: orderData.article || null,
      includes_installation: newOrder.order_type === 'odpel',
      sales_order_id: orderId,
      attachments: orderData.attachments || []
    };

    console.log('Creating production WO with data:', productionData);

    const { data: productionWO, error } = await supabase
      .from('work_orders')
      .insert([productionData])
      .select()
      .single();

    if (error) {
      console.error('Error creating production WO:', error);
      throw error;
    }
    
    console.log('Production WO created successfully:', productionWO);
    return productionWO;
  };

  const createServiceWorkOrder = async (orderId: string, orderData: any, productionWOId?: string) => {
    const serviceData = {
      number: '', // Auto-generated
      title: `Installazione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.work_description || newOrder.notes,
      status: 'da_fare' as const,
      customer_id: newOrder.customer_id,
      assigned_to: null, // Sempre null per service work orders
      back_office_manager: (newOrder.back_office_manager && newOrder.back_office_manager.trim() !== '') ? newOrder.back_office_manager : null,
      priority: newOrder.priority,
      scheduled_date: newOrder.planned_start_date ? new Date(newOrder.planned_start_date).toISOString() : null,
      location: newOrder.location || null,
      equipment_needed: newOrder.equipment_needed || null,
      notes: newOrder.notes,
      production_work_order_id: productionWOId || null,
      sales_order_id: orderId,
      attachments: orderData.attachments || []
    };

    console.log('Creating service WO with data:', serviceData);

    const { data: serviceWO, error } = await supabase
      .from('service_work_orders')
      .insert([serviceData])
      .select()
      .single();

    if (error) {
      console.error('Error creating service WO:', error);
      throw error;
    }
    
    console.log('Service WO created successfully:', serviceWO);
    return serviceWO;
  };

  const createShippingOrder = async (orderId: string, orderData: any) => {
    // Get customer details for shipping location
    let customerData: any = null;
    if (newOrder.customer_id) {
      const { data, error } = await supabase
        .from('customers')
        .select('city, country, province, postal_code, address, shipping_address')
        .eq('id', newOrder.customer_id)
        .single();
      
      if (!error && data) {
        customerData = data;
      }
    }
    
    const shippingData = {
      number: '', // Auto-generated
      back_office_manager: newOrder.back_office_manager || null,
      status: 'da_preparare' as const,
      order_date: newOrder.order_date || new Date().toISOString().split('T')[0],
      notes: newOrder.notes,
      shipping_address: customerData?.shipping_address || customerData?.address || newOrder.shipping_address || null,
      shipping_city: customerData?.city || null,
      shipping_country: customerData?.country || null,
      shipping_province: customerData?.province || null,
      shipping_postal_code: customerData?.postal_code || null,
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
        description: "Per commesse di produzione è necessario selezionare una BOM",
        variant: "destructive",
      });
      return;
    }

    if (newOrder.order_type === 'odl' && !newOrder.work_description) {
      toast({
        title: "Errore",
        description: "Per commesse di lavoro è necessario descrivere il lavoro da fare",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ottieni il leadId dallo state se presente
      const leadId = location.state?.leadId || null;
      
      // Create main sales order
      const orderData = {
        number: "", // Auto-generated
        customer_id: newOrder.customer_id,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: newOrder.order_type,
        order_source: newOrder.order_source,
        lead_id: leadId
      };

      const { data: salesOrder, error: salesError } = await supabase
        .from("sales_orders")
        .insert([orderData])
        .select(`*, customers(name, code)`)
        .single();

      if (salesError) throw salesError;

      // Upload photos if any
      let photoFiles: string[] = [];
      if (uploadedFiles.length > 0) {
        photoFiles = await uploadOrderPhotos(salesOrder.id);
      }

      let productionWO = null;
      let serviceWO = null;
      let shippingOrder = null;

      // Create work orders based on type
      console.log('Creating work orders for type:', newOrder.order_type);
      switch (newOrder.order_type) {
        case 'odp':
          console.log('Creating production work order...');
          productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
          console.log('Production WO created:', productionWO);
          break;
        
        case 'odl':
          console.log('Creating service work order...');
          serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder);
          console.log('Service WO created:', serviceWO);
          break;
        
        case 'odpel':
          console.log('Creating both production and service work orders...');
          productionWO = await createProductionWorkOrder(salesOrder.id, salesOrder);
          console.log('Production WO created:', productionWO);
          serviceWO = await createServiceWorkOrder(salesOrder.id, salesOrder, productionWO.id);
          console.log('Service WO created:', serviceWO);
          break;
        
        case 'ods':
          console.log('Creating shipping order...');
          shippingOrder = await createShippingOrder(salesOrder.id, salesOrder);
          console.log('Shipping order created:', shippingOrder);
          break;
      }

      let successMessage = "Ordine creato con successo";
      if (productionWO && serviceWO) {
        successMessage += ` - Commessa di Produzione: ${productionWO.number}, Commessa di Lavoro: ${serviceWO.number}`;
      } else if (productionWO) {
        successMessage += ` - Commessa di Produzione: ${productionWO.number}`;
      } else if (serviceWO) {
        successMessage += ` - Commessa di Lavoro: ${serviceWO.number}`;
      } else if (shippingOrder) {
        successMessage += ` - Commessa di Spedizione: ${shippingOrder.number}`;
      }

      toast({
        title: "Successo",
        description: successMessage,
      });

      // Ricarica gli ordini per mostrare le commesse collegate
      await loadOrders();
      
      setIsDialogOpen(false);
      setNewOrder({
        customer_id: "",
        lead_id: "",
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
        shipping_address: "",
        offer_id: ""
      });
      setUploadedFiles([]);
      await loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setNewOrder({
      customer_id: order.customer_id || "",
      lead_id: order.lead_id || "",
      order_type: order.order_type || "",
      order_source: (order as any).order_source || "sale",
      order_date: order.order_date || new Date().toISOString().split('T')[0],
      delivery_date: order.delivery_date || "",
      expected_delivery_date: "",
      status: order.status || "draft",
      notes: order.notes || "",
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
      shipping_address: "",
      offer_id: order.offer_id || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateOrder = async () => {
    if (!editingOrder || !newOrder.customer_id || !newOrder.order_type) {
      toast({
        title: "Errore",
        description: "Cliente e tipo ordine sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      const updateData = {
        customer_id: newOrder.customer_id,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: newOrder.order_type,
        order_source: newOrder.order_source,
        offer_id: (newOrder as any).offer_id || null
      };

      const { error } = await supabase
        .from("sales_orders")
        .update(updateData)
        .eq("id", editingOrder.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ordine aggiornato con successo",
      });

      setIsEditDialogOpen(false);
      setEditingOrder(null);
      setNewOrder({
        customer_id: "",
        lead_id: "",
        order_type: "",
        order_source: "sale",
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        expected_delivery_date: "",
        status: "draft",
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
        shipping_address: "",
        offer_id: ""
      });
      await loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleArchiveOrder = async (orderId: string) => {
    try {
      // Archivia l'ordine principale
      const { error: orderError } = await supabase
        .from("sales_orders")
        .update({ archived: true })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Archivia le commesse di produzione collegate
      const { error: workOrdersError } = await supabase
        .from("work_orders")
        .update({ archived: true })
        .eq("sales_order_id", orderId);

      if (workOrdersError) throw workOrdersError;

      // Archivia le commesse di lavoro collegate
      const { error: serviceOrdersError } = await supabase
        .from("service_work_orders")
        .update({ archived: true })
        .eq("sales_order_id", orderId);

      if (serviceOrdersError) throw serviceOrdersError;

      // Archivia le commesse di spedizione collegate
      const { error: shippingOrdersError } = await supabase
        .from("shipping_orders")
        .update({ archived: true })
        .eq("sales_order_id", orderId);

      if (shippingOrdersError) throw shippingOrdersError;

      toast({
        title: "Ordine archiviato",
        description: "L'ordine e tutte le commesse collegate sono stati archiviati con successo",
      });

      loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile archiviare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleUnarchiveOrder = async (orderId: string) => {
    try {
      // Dearchivia l'ordine principale
      const { error: orderError } = await supabase
        .from("sales_orders")
        .update({ archived: false })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Dearchivia le commesse di produzione collegate
      const { error: workOrdersError } = await supabase
        .from("work_orders")
        .update({ archived: false })
        .eq("sales_order_id", orderId);

      if (workOrdersError) throw workOrdersError;

      // Dearchivia le commesse di lavoro collegate
      const { error: serviceOrdersError } = await supabase
        .from("service_work_orders")
        .update({ archived: false })
        .eq("sales_order_id", orderId);

      if (serviceOrdersError) throw serviceOrdersError;

      // Dearchivia le commesse di spedizione collegate
      const { error: shippingOrdersError } = await supabase
        .from("shipping_orders")
        .update({ archived: false })
        .eq("sales_order_id", orderId);

      if (shippingOrdersError) throw shippingOrdersError;

      toast({
        title: "Ordine ripristinato",
        description: "L'ordine e tutte le commesse collegate sono stati ripristinati con successo",
      });

      loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile ripristinare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      // Delete related records first
      await supabase.from("work_orders").delete().eq("sales_order_id", orderId);
      await supabase.from("service_work_orders").delete().eq("sales_order_id", orderId);
      await supabase.from("shipping_orders").delete().eq("sales_order_id", orderId);
      
      const { error } = await supabase
        .from("sales_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Ordine eliminato",
        description: "L'ordine è stato eliminato con successo",
      });

      await loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'ordine: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "completato":
        return "default";
      case "in_lavorazione":
        return "secondary";
      case "commissionato":
        return "outline";
      default:
        return "outline";
    }
  };

  const getOrderTypeColor = (orderType?: string) => {
    switch (orderType) {
      case "odl":
        return "Lavoro (CdL)";
      case "odp":
        return "Produzione (CdP)";
      case "odpel":
        return "Produzione + Installazione (CdP+L)";
      case "ods":
        return "Spedizione (CdS)";
      default:
        return "Sconosciuto";
    }
  };

  // Funzione per normalizzare gli stati vecchi a quelli nuovi
  const normalizeOrderStatus = (status?: string): string => {
    if (!status) return "commissionato";
    
    // Mappa gli stati vecchi a quelli nuovi
    const statusMap: Record<string, string> = {
      "draft": "commissionato",
      "pending": "commissionato",
      "processing": "in_lavorazione",
      "in_progress": "in_lavorazione",
      "completed": "completato",
      "delivered": "completato",
      "shipped": "completato"
    };
    
    return statusMap[status.toLowerCase()] || status;
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    const orderId = draggableId;

    // Show confirmation dialog
    setStatusChangeConfirm({
      open: true,
      orderId,
      newStatus
    });
  };

  const confirmStatusChange = async () => {
    if (!statusChangeConfirm) return;

    const { orderId, newStatus } = statusChangeConfirm;

    try {
      const { error } = await supabase
        .from("sales_orders")
        .update({ status: newStatus })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato dell'ordine è stato aggiornato con successo",
      });

      loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato dell'ordine",
        variant: "destructive",
      });
    } finally {
      setStatusChangeConfirm(null);
    }
  };

  const getOrderTypeLabel = (orderType?: string) => {
    const type = orderTypes.find(t => t.value === orderType);
    return type ? type.label : orderType?.toUpperCase();
  };

  // Funzione per ottenere lo stato aggregato dei sotto-ordini
  const getSubOrdersStatus = (order: Order) => {
    const statuses = [];
    
    // Controlla commesse di produzione
    if (order.work_orders && order.work_orders.length > 0) {
      order.work_orders.forEach(wo => {
        statuses.push({
          type: wo.includes_installation ? 'CdP+L' : 'CdP',
          number: wo.number,
          status: wo.status,
          color: wo.status === 'completed' ? 'bg-green-100 text-green-800' :
                 wo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                 wo.status === 'planned' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
        });
      });
    }
    
    // Controlla commesse di lavoro
    if (order.service_work_orders && order.service_work_orders.length > 0) {
      order.service_work_orders.forEach(swo => {
        statuses.push({
          type: 'CdL',
          number: swo.number,
          status: swo.status,
          color: swo.status === 'completed' ? 'bg-green-100 text-green-800' :
                 swo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                 swo.status === 'planned' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
        });
      });
    }
    
    // Controlla ordini di spedizione
    if (order.shipping_orders && order.shipping_orders.length > 0) {
      order.shipping_orders.forEach(so => {
        statuses.push({
          type: 'CdS',
          number: so.number,
          status: so.status,
          color: so.status === 'spedito' ? 'bg-green-100 text-green-800' :
                 so.status === 'in_preparazione' ? 'bg-blue-100 text-blue-800' :
                 so.status === 'da_preparare' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
        });
      });
    }
    
    return statuses;
  };

  // Funzione per calcolare lo stato automatico dell'ordine basato sui sotto-ordini
  const calculateOrderStatus = (order: Order): string => {
    const subStatuses = getSubOrdersStatus(order);
    
    if (subStatuses.length === 0) {
      return order.status || 'commissionato';
    }
    
    // Stati che indicano "completato"
    const completedStatuses = ['completed', 'completato', 'completata', 'spedito', 'consegnato'];
    
    // Stati che indicano "in lavorazione"
    const inProgressStatuses = ['in_progress', 'in_lavorazione', 'in_preparazione', 'pronto', 'in_test', 'stand_by', 'standby'];
    
    // Se tutti i sotto-ordini sono completati
    const allCompleted = subStatuses.every(s => 
      completedStatuses.includes(s.status)
    );
    
    if (allCompleted) {
      return 'completato';
    }
    
    // Se almeno un sotto-ordine è in lavorazione o completato
    const anyInProgress = subStatuses.some(s => 
      inProgressStatuses.includes(s.status) || completedStatuses.includes(s.status)
    );
    
    if (anyInProgress) {
      return 'in_lavorazione';
    }
    
    // Altrimenti è ancora commissionato (tutte da_fare/da_preparare/planned)
    return 'commissionato';
  };

  const getSubOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'planned': 'Pianificato',
      'da_fare': 'Da Fare',
      'in_progress': 'In Corso',
      'in_lavorazione': 'In Lavorazione',
      'in_test': 'In Test',
      'pronto': 'Pronto',
      'completed': 'Completato',
      'completato': 'Completato',
      'completata': 'Completata',
      'standby': 'Standby',
      'stand_by': 'Stand By',
      'bloccato': 'Bloccato',
      'da_preparare': 'Da Preparare',
      'in_preparazione': 'In Preparazione',
      'spedito': 'Spedito',
      'consegnato': 'Consegnato'
    };
    return labels[status] || status;
  };

  const calculateAgingDays = (dateString?: string) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getAgingColor = (days: number) => {
    if (days <= 7) return 'text-green-600 dark:text-green-400';
    if (days <= 14) return 'text-yellow-600 dark:text-yellow-400';
    if (days <= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomerCreated = async () => {
    await loadRelatedData(); // Reload customers to include the new one
    setIsCreateCustomerDialogOpen(false);
  };

  const handleOrderClick = (order: Order) => {
    setSelectedOrder(order);
    setIsDetailsDialogOpen(true);
  };

  const handleCreateOrderFromOffer = (offer: any) => {
    setSelectedOfferForOrder(offer);
    setIsDialogOpen(true);
  };

  useEffect(() => {
    loadOrders();
  }, [showArchivedOrders]);

  const filteredOrders = orders.filter(order => {
    // Filtro archiviati - gestisce anche null/undefined come false
    const isArchived = order.archived === true;
    if (!showArchivedOrders && isArchived) return false;
    if (showArchivedOrders && !isArchived) return false;
    
    const matchesSearch = `${order.number} ${order.notes || ""} ${order.customers?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    // Filtro per tipo di ordine
    if (orderFilter === "work") {
      return order.work_orders && order.work_orders.length > 0;
    } else if (orderFilter === "installation") {
      return order.service_work_orders && order.service_work_orders.length > 0;
    } else if (orderFilter === "shipping") {
      return order.shipping_orders && order.shipping_orders.length > 0;
    }
    
    return true;
  });

  const totalOrders = filteredOrders.length;
  const deliveredOrders = filteredOrders.filter(order => order.status === "delivered");
  const shippedOrders = filteredOrders.filter(order => order.status === "shipped");
  const odlOrders = filteredOrders.filter(order => order.order_type === "odl");
  const odpOrders = filteredOrders.filter(order => order.order_type === "odp");
  const odsOrders = filteredOrders.filter(order => order.order_type === "ods");
  const saleOrders = filteredOrders.filter(order => (order as any).order_source === "sale");
  const warrantyOrders = filteredOrders.filter(order => (order as any).order_source === "warranty");

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
          <p className="text-muted-foreground">Gestisci gli ordini e la creazione automatica di CdL/CdP/CdS</p>
        </div>
        <Button onClick={() => {
          setSelectedOfferForOrder(null);
          setIsDialogOpen(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuovo Ordine
        </Button>
        
        <CreateOrderDialog
          open={isDialogOpen}
          onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) setSelectedOfferForOrder(null);
          }}
          onSuccess={() => {
            loadOrders();
            loadConfirmedOffers();
            setSelectedOfferForOrder(null);
          }}
          leadId={selectedOfferForOrder?.lead_id || location.state?.leadId}
          prefilledData={selectedOfferForOrder ? {
            customer_id: selectedOfferForOrder.customer_id,
            lead_id: selectedOfferForOrder.lead_id,
            offer_id: selectedOfferForOrder.id,
            title: selectedOfferForOrder.title,
            description: `${selectedOfferForOrder.title}\n\n${selectedOfferForOrder.description || ''}\n\nValore ordine: €${selectedOfferForOrder.amount ? selectedOfferForOrder.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '0,00'}`,
            payment_amount: selectedOfferForOrder.amount ? String(selectedOfferForOrder.amount) : undefined,
            notes: selectedOfferForOrder.notes || ''
          } : (location.state?.leadData ? {
            customer_id: location.state.leadData.customer_id,
            notes: `Ordine da lead vinto: ${location.state.leadData.company_name}${location.state.leadData.contact_name ? ' - ' + location.state.leadData.contact_name : ''}\n\nContatto: ${location.state.leadData.contact_name || 'N/A'}\nEmail: ${location.state.leadData.email || 'N/A'}\nTelefono: ${location.state.leadData.phone || 'N/A'}\n\n${location.state.leadData.notes || ''}`
          } : undefined)}
        />
      </div>

      {/* Confirmed Offers Section */}
      {confirmedOffers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Offerte Accettate</CardTitle>
            <p className="text-sm text-muted-foreground">
              Offerte pronte per essere trasformate in ordini
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {confirmedOffers.map((offer) => (
                <Card key={offer.id} className="border-2 border-success/50">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{offer.title}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {offer.number}
                        </p>
                      </div>
                      <Badge className="bg-success/10 text-success border-success/20">
                        Accettata
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Cliente:</span>
                        <span className="font-medium">{offer.customer_name}</span>
                      </div>
                      {offer.leads && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Lead:</span>
                          <Link 
                            to={`/crm/leads?lead=${offer.lead_id}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            {offer.leads.company_name}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Importo:</span>
                        <span className="font-bold text-lg">€{offer.amount.toLocaleString()}</span>
                      </div>
                      {offer.description && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                          {offer.description}
                        </p>
                      )}
                    </div>
                    <Button 
                      className="w-full" 
                      onClick={() => handleCreateOrderFromOffer(offer)}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Crea Ordine
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totali</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
            <p className="text-xs text-muted-foreground">ordini totali</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CdL</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odlOrders.length}</div>
            <p className="text-xs text-muted-foreground">commesse di lavoro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CdP</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odpOrders.length}</div>
            <p className="text-xs text-muted-foreground">commesse di produzione</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CdS</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odsOrders.length}</div>
            <p className="text-xs text-muted-foreground">commesse di spedizione</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consegnati</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deliveredOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini consegnati</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vendite</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{saleOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini vendita</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Garanzie</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{warrantyOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini garanzia</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Ordini ({filteredOrders.length})</CardTitle>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("table")}
                >
                  <List className="w-4 h-4 mr-2" />
                  Tabella
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setViewMode("kanban")}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
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
              
              {/* Filtri per tipo di ordine */}
              <Select value={orderFilter} onValueChange={(value: any) => setOrderFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtra per tipo" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">Tutti gli ordini</SelectItem>
                  <SelectItem value="work">Con Commesse di Produzione</SelectItem>
                  <SelectItem value="installation">Con Commesse di Installazione</SelectItem>
                  <SelectItem value="shipping">Con Commesse di Spedizione</SelectItem>
                </SelectContent>
              </Select>
              
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
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {viewMode === "table" ? (
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Numero</TableHead>
                  <TableHead className="min-w-[150px]">Cliente</TableHead>
                  <TableHead className="min-w-[120px]">Lead</TableHead>
                  <TableHead className="min-w-[150px]">Commesse</TableHead>
                  <TableHead className="min-w-[110px]">Data Ordine</TableHead>
                  <TableHead className="min-w-[90px]">Aging</TableHead>
                  <TableHead className="min-w-[110px]">Consegna</TableHead>
                  <TableHead className="min-w-[100px]">Stato</TableHead>
                  <TableHead className="min-w-[150px]">Note</TableHead>
                  <TableHead className="w-[50px]">Azioni</TableHead>
                </TableRow>
              </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOrderClick(order)}>
                  <TableCell>
                    <div className="flex items-center">
                      <Package className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">{order.number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {order.customers && (
                      <div>
                        <div className="font-medium">{order.customers.name}</div>
                        <div className="text-sm text-muted-foreground">{order.customers.code}</div>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.leads ? (
                      <Link 
                        to={`/crm/leads?lead=${order.lead_id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {order.leads.company_name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getSubOrdersStatus(order).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getSubOrdersStatus(order).map((subStatus, idx) => (
                          <Badge key={idx} className={subStatus.color} variant="outline">
                            {subStatus.type}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nessuna commessa</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.order_date ? (
                      <span className="text-sm">
                        {new Date(order.order_date).toLocaleDateString('it-IT')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.order_date ? (
                      <span className={`text-sm font-semibold ${getAgingColor(calculateAgingDays(order.order_date))}`}>
                        {calculateAgingDays(order.order_date)} giorni
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.delivery_date ? (
                      <span className="text-sm">
                        {new Date(order.delivery_date).toLocaleDateString('it-IT')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(normalizeOrderStatus(order.status))}>
                      {normalizeOrderStatus(order.status).toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {order.notes && order.notes.length > 50 
                        ? `${order.notes.substring(0, 50)}...`
                        : order.notes
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleEditOrder(order);
                        }}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        {order.archived ? (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleUnarchiveOrder(order.id);
                          }}>
                            <ArchiveRestore className="w-4 h-4 mr-2" />
                            Ripristina
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            handleArchiveOrder(order.id);
                          }}>
                            <Package className="w-4 h-4 mr-2" />
                            Archivia
                          </DropdownMenuItem>
                        )}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" />
                              Elimina
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Questa azione eliminerà permanentemente l'ordine {order.number} e tutti i sotto-ordini associati (CdP, CdL, CdS). Questa azione non può essere annullata.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annulla</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                                Elimina
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredOrders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun ordine trovato" : "Nessun ordine presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {orderStatuses.map((status) => (
                  <div key={status} className="space-y-3">
                    <div className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      {status === "commissionato" && "Commissionati"}
                      {status === "in_lavorazione" && "In Lavorazione"}
                      {status === "completato" && "Completati"}
                       <span className="ml-2 text-xs">
                        ({filteredOrders.filter(o => normalizeOrderStatus(o.status) === status).length})
                      </span>
                    </div>
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[500px] p-3 rounded-lg border-2 border-dashed ${
                            snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                           <div className="space-y-2">
                            {filteredOrders
                              .filter(order => normalizeOrderStatus(order.status) === status)
                              .map((order, index) => (
                                <Draggable key={order.id} draggableId={order.id} index={index}>
                                   {(provided, snapshot) => (
                                       <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={() => handleOrderClick(order)}
                                        className={`p-4 bg-card border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                                          snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                                        }`}
                                       >
                                          <div className="space-y-2 md:space-y-3">
                                            <div className="flex items-start justify-between gap-2">
                                              <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-sm md:text-base">{order.number}</div>
                                                <div className="text-xs md:text-sm text-muted-foreground truncate">
                                                  {order.customers?.name}
                                                </div>
                                                {order.order_date && (
                                                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                    <span className="text-xs text-muted-foreground">
                                                      {new Date(order.order_date).toLocaleDateString('it-IT')}
                                                    </span>
                                                    <span className={`text-xs font-semibold ${getAgingColor(calculateAgingDays(order.order_date))}`}>
                                                      • {calculateAgingDays(order.order_date)}gg
                                                    </span>
                                                  </div>
                                                )}
                                              </div>
                                             <div className="flex items-center gap-2 shrink-0">
                                               <DropdownMenu>
                                                 <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                   <Button variant="ghost" size="sm">
                                                     <MoreHorizontal className="h-4 w-4" />
                                                   </Button>
                                                 </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                  <DropdownMenuItem onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleEditOrder(order);
                                                  }}>
                                                    <Edit className="mr-2 h-4 w-4" />
                                                    Modifica
                                                  </DropdownMenuItem>
                                                  {order.archived ? (
                                                    <DropdownMenuItem onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleUnarchiveOrder(order.id);
                                                    }}>
                                                      <ArchiveRestore className="mr-2 h-4 w-4" />
                                                      Ripristina
                                                    </DropdownMenuItem>
                                                  ) : (
                                                    <DropdownMenuItem onClick={(e) => {
                                                      e.stopPropagation();
                                                      handleArchiveOrder(order.id);
                                                    }}>
                                                      <Package className="mr-2 h-4 w-4" />
                                                      Archivia
                                                    </DropdownMenuItem>
                                                  )}
                                                  <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                      <DropdownMenuItem
                                                        onSelect={(e) => e.preventDefault()}
                                                        className="text-destructive"
                                                      >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Elimina
                                                      </DropdownMenuItem>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                      <AlertDialogHeader>
                                                        <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                          Questa azione eliminerà permanentemente l'ordine e tutti i sotto-ordini associati (CdP, CdL, CdS). Questa azione non può essere annullata.
                                                        </AlertDialogDescription>
                                                      </AlertDialogHeader>
                                                      <AlertDialogFooter>
                                                        <AlertDialogCancel>Annulla</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDeleteOrder(order.id)}>
                                                          Elimina
                                                        </AlertDialogAction>
                                                      </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                  </AlertDialog>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                            </div>
                                           </div>
                                            
                                            {/* Created by and time */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-muted-foreground border-b pb-2 gap-1">
                                              <span className="truncate">
                                                {order.profiles ? 
                                                  `${order.profiles.first_name || ''} ${order.profiles.last_name || ''}`.trim() || order.profiles.email 
                                                  : 'N/A'}
                                              </span>
                                              <span className="text-[10px] sm:text-xs whitespace-nowrap">
                                                {new Date(order.created_at).toLocaleString('it-IT', {
                                                  day: '2-digit',
                                                  month: '2-digit',
                                                  year: 'numeric',
                                                  hour: '2-digit',
                                                  minute: '2-digit'
                                                })}
                                              </span>
                                            </div>
                                           
                                            {/* Lead collegato */}
                                            {order.leads && (
                                              <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 text-xs">
                                                  <span className="text-muted-foreground">Lead:</span>
                                                  <Link 
                                                    to={`/crm/leads?lead=${order.lead_id}`}
                                                   className="text-primary hover:underline font-medium"
                                                   onClick={(e) => e.stopPropagation()}
                                                 >
                                                   {order.leads.company_name}
                                                 </Link>
                                               </div>
                                             </div>
                                           )}
                                           
                                           {/* Article/Product Preview */}
                                           {order.article && order.article.trim().length > 0 && (
                                             <div className="pt-2 border-t">
                                               <div className="text-xs font-medium text-muted-foreground mb-1">
                                                 Prodotti/Servizi:
                                               </div>
                                               <div className="text-xs text-foreground space-y-1">
                                                 {order.article.split('\n')
                                                   .filter(line => line.trim().length > 0 && /^\d+x\s/i.test(line.trim()))
                                                   .slice(0, 3)
                                                   .map((line, idx) => {
                                                     const trimmedLine = line.trim();
                                                     // Extract only the product title (first line before any description)
                                                     const productTitle = trimmedLine.split('\n')[0];
                                                     return (
                                                       <div key={idx} className="font-medium">
                                                         {productTitle}
                                                       </div>
                                                     );
                                                   })}
                                                 {order.article.split('\n').filter(line => line.trim().length > 0 && /^\d+x\s/i.test(line.trim())).length > 3 && (
                                                   <div className="text-muted-foreground italic">
                                                     +{order.article.split('\n').filter(line => line.trim().length > 0 && /^\d+x\s/i.test(line.trim())).length - 3} altri prodotti...
                                                   </div>
                                                 )}
                                               </div>
                                             </div>
                                           )}
                                           
                                           {/* Riferimenti ordini collegati */}
                                           {getSubOrdersStatus(order).length > 0 && (
                                             <div className="pt-2 border-t space-y-2">
                                               <div className="text-xs font-medium text-muted-foreground">
                                                 Ordini Collegati:
                                               </div>
                                               {getSubOrdersStatus(order).map((subStatus, idx) => (
                                                 <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded">
                                                   <div className="flex items-center gap-2 min-w-0">
                                                     <Badge className={`${subStatus.color} text-[10px] md:text-xs`} variant="outline">
                                                       {subStatus.type}
                                                     </Badge>
                                                     <span className="text-[10px] md:text-xs font-mono truncate">
                                                       {subStatus.number}
                                                     </span>
                                                   </div>
                                                   <span className="text-[10px] md:text-xs font-medium whitespace-nowrap">
                                                     {getSubOrderStatusLabel(subStatus.status)}
                                                   </span>
                                                 </div>
                                               ))}
                                             </div>
                                           )}
                                           
                                           {/* Note preview */}
                                           {order.notes && order.notes.length > 0 && (
                                             <div className="pt-2 border-t">
                                               <div className="text-[11px] md:text-xs text-muted-foreground line-clamp-2">
                                                 {order.notes}
                                               </div>
                                             </div>
                                           )}
                                       </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                            {provided.placeholder}
                          </div>
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Ordine {editingOrder?.number}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_customer_id">Cliente *</Label>
                <div className="flex gap-2">
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
              
              <div>
                <Label htmlFor="edit_order_type">Tipo Ordine *</Label>
                <Select value={newOrder.order_type} onValueChange={(value) => setNewOrder({...newOrder, order_type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo ordine" />
                  </SelectTrigger>
                  <SelectContent>
                    {orderTypes.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_order_date">Data Ordine</Label>
                <Input
                  id="edit_order_date"
                  type="date"
                  value={newOrder.order_date}
                  onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                />
              </div>
              
              <div>
                <Label htmlFor="edit_delivery_date">Data Consegna</Label>
                <Input
                  id="edit_delivery_date"
                  type="date"
                  value={newOrder.delivery_date}
                  onChange={(e) => setNewOrder({...newOrder, delivery_date: e.target.value})}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="edit_status">Stato</Label>
              <Select value={newOrder.status} onValueChange={(value) => setNewOrder({...newOrder, status: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {orderStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_offer_id">Offerta Collegata</Label>
              <Select 
                value={newOrder.offer_id || "none"} 
                onValueChange={(value) => setNewOrder({...newOrder, offer_id: value === "none" ? "" : value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona offerta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna offerta</SelectItem>
                  {allOffers.map(offer => (
                    <SelectItem key={offer.id} value={offer.id}>
                      {offer.number} - {offer.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="edit_notes">Note</Label>
              <Textarea
                id="edit_notes"
                value={newOrder.notes}
                onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                placeholder="Note aggiuntive..."
                rows={3}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleUpdateOrder}>
                Salva Modifiche
              </Button>
            </div>
          </div>
          </DialogContent>
        </Dialog>

      {/* Order Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Dettagli Ordine {selectedOrder?.number}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    setTimeout(() => {
                      if (selectedOrder) handleEditOrder(selectedOrder);
                    }, 100);
                  }}
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifica
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questa azione eliminerà permanentemente l'ordine {selectedOrder?.number} e tutti i sotto-ordini associati (CdP, CdL, CdS). Questa azione non può essere annullata.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (selectedOrder) {
                            handleDeleteOrder(selectedOrder.id);
                            setIsDetailsDialogOpen(false);
                          }
                        }}
                      >
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-6">
              {/* Main Order Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informazioni Ordine</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Numero Ordine</Label>
                    <div className="font-semibold">{selectedOrder.number}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Cliente</Label>
                    <div className="font-semibold">{selectedOrder.customers?.name}</div>
                    <div className="text-sm text-muted-foreground">{selectedOrder.customers?.code}</div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Offerta</Label>
                    {selectedOrder.offers ? (
                      <Link 
                        to={`/crm/offers`}
                        className="text-primary hover:underline flex items-center gap-1 font-semibold"
                      >
                        {selectedOrder.offers.number} - {selectedOrder.offers.title}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <div className="text-sm text-muted-foreground">Non collegata</div>
                    )}
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Tipo Ordine</Label>
                    <Badge className={getOrderTypeColor(selectedOrder.order_type)}>
                      {getOrderTypeLabel(selectedOrder.order_type)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Stato</Label>
                    <div>
                      <Badge variant={getStatusColor(normalizeOrderStatus(selectedOrder.status))}>
                        {normalizeOrderStatus(selectedOrder.status).toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  {selectedOrder.order_date && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Data Ordine</Label>
                      <div>{new Date(selectedOrder.order_date).toLocaleDateString('it-IT')}</div>
                    </div>
                  )}
                  {selectedOrder.delivery_date && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Data Consegna</Label>
                      <div>{new Date(selectedOrder.delivery_date).toLocaleDateString('it-IT')}</div>
                    </div>
                  )}
                   {selectedOrder.notes && (
                    <div className="col-span-2">
                      <Label className="text-sm text-muted-foreground">Note</Label>
                      <div className="text-sm">{selectedOrder.notes}</div>
                    </div>
                  )}
                  {selectedOrder.article && selectedOrder.article.trim().length > 0 && (
                    <div className="col-span-2">
                      <Label className="text-sm text-muted-foreground">Prodotti/Servizi</Label>
                      <div className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md mt-1">
                        {selectedOrder.article}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Work Orders Manager */}
              <OrderWorkOrdersManager 
                orderId={selectedOrder.id}
                customerId={selectedOrder.customer_id}
                onUpdate={() => {
                  loadOrders();
                  // Refresh selected order data
                  const refreshOrder = async () => {
                    const { data } = await supabase
                      .from("sales_orders")
                      .select(`
                        *,
                        customers(name, code),
                        leads(id, company_name),
                        offers(id, number, title),
                        work_orders(id, number, status, includes_installation),
                        service_work_orders(id, number, status),
                        shipping_orders(id, number, status)
                      `)
                      .eq('id', selectedOrder.id)
                      .single();
                    if (data) {
                      setSelectedOrder({
                        ...data,
                        attachments: Array.isArray(data.attachments) ? data.attachments : []
                      } as unknown as Order);
                    }
                  };
                  refreshOrder();
                }}
              />

              {/* Financial Information */}
              <OrderFinancialInfo
                orderId={selectedOrder.id}
                totalAmount={(selectedOrder as any).total_amount || 0}
                invoiced={(selectedOrder as any).invoiced || false}
                invoiceNumber={(selectedOrder as any).invoice_number}
                invoiceDate={(selectedOrder as any).invoice_date}
                onUpdate={loadOrders}
              />

              {/* Activity Log */}
              <OrderActivityLog orderId={selectedOrder.id} />

              {/* Comments */}
              <OrderComments orderId={selectedOrder.id} />
              
              {/* Files */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">File e Allegati</CardTitle>
                </CardHeader>
                <CardContent>
                  <OrderFileManager
                    orderId={selectedOrder.id}
                    attachments={selectedOrder.attachments || []}
                    onUpdate={loadOrders}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />

      {/* Status Change Confirmation Dialog */}
      <AlertDialog open={statusChangeConfirm?.open} onOpenChange={(open) => !open && setStatusChangeConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma cambio stato</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler cambiare lo stato di questo ordine? Questa azione modificherà anche lo stato di tutti i sotto-ordini associati (CdP, CdL, CdS).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStatusChange}>
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}