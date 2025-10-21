import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
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
import { Plus, Search, Calendar, Package, FileImage, Upload, X, Edit, Trash2, MoreHorizontal, LayoutGrid, List, ExternalLink } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OrderFinancialInfo } from "@/components/orders/OrderFinancialInfo";
import { OrderActivityLog } from "@/components/orders/OrderActivityLog";
import { OrderComments } from "@/components/orders/OrderComments";

interface Order {
  id: string;
  number: string;
  customer_id?: string;
  order_date?: string;
  delivery_date?: string;
  status?: string;
  notes?: string;
  order_type?: string;
  lead_id?: string;
  created_at: string;
  customers?: {
    name: string;
    code: string;
  };
  leads?: {
    id: string;
    company_name: string;
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
}

const orderStatuses = ["commissionato", "in_lavorazione", "completato"];
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

export default function OrdersPage() {
  const location = useLocation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | "work" | "installation" | "shipping">("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("kanban");
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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
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
    accessori_ids: [], // Array of selected accessori IDs
    assigned_technician: "",
    back_office_manager: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    location: "",
    equipment_needed: "",
    shipping_address: ""
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
  }, [showArchivedOrders]);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          customers(name, code),
          leads(id, company_name),
          work_orders(id, number, status, includes_installation),
          service_work_orders(id, number, status),
          shipping_orders(id, number, status)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders(data || []);
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
      const [customersRes, bomsRes, accessoriRes, techniciansRes, usersRes, leadsRes] = await Promise.all([
        supabase.from("customers").select("id, name, code").eq("active", true),
        supabase.from("boms").select("id, name, version, level").in("level", [0, 1, 2]).order("name"),
        supabase.from("boms").select("id, name, version, level").eq("level", 3).order("name"),
        supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true),
        supabase.from("profiles").select("id, email, first_name, last_name").order("first_name"),
        supabase.from("leads").select("id, company_name, contact_name, status, pipeline").order("company_name")
      ]);

      if (customersRes.error) throw customersRes.error;
      if (bomsRes.error) throw bomsRes.error;
      if (accessoriRes.error) throw accessoriRes.error;
      if (techniciansRes.error) throw techniciansRes.error;
      if (usersRes.error) throw usersRes.error;
      if (leadsRes.error) throw leadsRes.error;

      setCustomers(customersRes.data || []);
      setBoms(bomsRes.data || []);
      setAccessori(accessoriRes.data || []);
      setTechnicians(techniciansRes.data || []);
      setUsers(usersRes.data || []);
      setLeads(leadsRes.data || []);
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
      status: 'planned' as const,
      bom_id: newOrder.bom_id || null,
      customer_id: newOrder.customer_id,
      assigned_to: null, // Set to null for now - requires auth.users ID
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
      number: '', // Auto-generated
      title: `Installazione per ordine ${orderData.customers?.name || 'Cliente'}`,
      description: newOrder.work_description || newOrder.notes,
      status: 'planned' as const,
      customer_id: newOrder.customer_id,
      assigned_to: null, // Set to null for now - requires auth.users ID
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
      number: '', // Auto-generated
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
        shipping_address: ""
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
      shipping_address: ""
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
        order_source: newOrder.order_source
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
        shipping_address: ""
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
      const { error } = await supabase
        .from("sales_orders")
        .update({ archived: true })
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Ordine archiviato",
        description: "L'ordine è stato archiviato con successo",
      });

      loadOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile archiviare l'ordine",
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
        return "bg-blue-100 text-blue-800";
      case "odp":
        return "bg-green-100 text-green-800";
      case "odpel":
        return "bg-purple-100 text-purple-800";
      case "ods":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
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
    
    // Controlla ordini di produzione
    if (order.work_orders && order.work_orders.length > 0) {
      order.work_orders.forEach(wo => {
        statuses.push({
          type: wo.includes_installation ? 'OdP+Inst' : 'OdP',
          number: wo.number,
          status: wo.status,
          color: wo.status === 'completed' ? 'bg-green-100 text-green-800' :
                 wo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                 wo.status === 'planned' ? 'bg-gray-100 text-gray-800' : 'bg-yellow-100 text-yellow-800'
        });
      });
    }
    
    // Controlla ordini di lavoro
    if (order.service_work_orders && order.service_work_orders.length > 0) {
      order.service_work_orders.forEach(swo => {
        statuses.push({
          type: 'OdL',
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
          type: 'OdS',
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
      return order.status || 'draft';
    }
    
    // Se tutti i sotto-ordini sono completati
    const allCompleted = subStatuses.every(s => 
      s.status === 'completed' || s.status === 'spedito'
    );
    
    if (allCompleted) {
      return 'completed';
    }
    
    // Se almeno un sotto-ordine è in progress (non più in stato iniziale)
    const anyInProgress = subStatuses.some(s => 
      s.status === 'in_progress' || s.status === 'in_preparazione'
    );
    
    if (anyInProgress) {
      return 'in_progress';
    }
    
    // Altrimenti è ancora in draft/planned
    return order.status || 'draft';
  };

  const getSubOrderStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      'planned': 'Pianificato',
      'in_progress': 'In Corso',
      'completed': 'Completato',
      'da_preparare': 'Da Preparare',
      'in_preparazione': 'In Preparazione',
      'spedito': 'Spedito'
    };
    return labels[status] || status;
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

  useEffect(() => {
    loadOrders();
  }, [showArchivedOrders]);

  const filteredOrders = orders.filter(order => {
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
          <p className="text-muted-foreground">Gestisci gli ordini e la creazione automatica di OdL/OdP/OdS</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Ordine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Ordine</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Seleziona il tipo di ordine per creare automaticamente OdL, OdP, OdS o combinazioni
              </p>
            </DialogHeader>
            
            <div className="space-y-6">
              {/* Basic Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="customer_id">Cliente *</Label>
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
                  <Label htmlFor="order_type">Tipo Ordine *</Label>
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

              {/* Lead and Order Source */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="lead_id">Lead di Riferimento</Label>
                  <Select value={newOrder.lead_id} onValueChange={(value) => setNewOrder({...newOrder, lead_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona lead (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      {leads.map(lead => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name} 
                          {lead.contact_name && ` - ${lead.contact_name}`}
                          {lead.pipeline && ` [${lead.pipeline}]`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="order_source">Categoria Ordine *</Label>
                  <Select value={newOrder.order_source} onValueChange={(value) => setNewOrder({...newOrder, order_source: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {orderSources.map(source => (
                        <SelectItem key={source.value} value={source.value}>
                          {source.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Conditional fields based on order type */}
              {(newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && (
                <div>
                  <Label htmlFor="bom_id">BOM (Distinta Base) *</Label>
                  <Select value={newOrder.bom_id} onValueChange={(value) => setNewOrder({...newOrder, bom_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona BOM" />
                    </SelectTrigger>
                    <SelectContent>
                      {boms.map(bom => (
                        <SelectItem key={bom.id} value={bom.id}>
                          {bom.name} (v{bom.version}) - Livello {bom.level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Accessori selection - Only for production orders */}
              {(newOrder.order_type === 'odp' || newOrder.order_type === 'odpel') && (
                <div>
                  <Label htmlFor="accessori">Accessori (Opzionali)</Label>
                  <div className="border rounded-md p-3 max-h-32 overflow-y-auto">
                    {accessori.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessun accessorio disponibile</p>
                    ) : (
                      <div className="space-y-2">
                        {accessori.map(accessorio => (
                          <div key={accessorio.id} className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              id={`accessorio-${accessorio.id}`}
                              checked={newOrder.accessori_ids.includes(accessorio.id)}
                              onChange={(e) => {
                                const isChecked = e.target.checked;
                                setNewOrder(prev => ({
                                  ...prev,
                                  accessori_ids: isChecked 
                                    ? [...prev.accessori_ids, accessorio.id]
                                    : prev.accessori_ids.filter(id => id !== accessorio.id)
                                }));
                              }}
                              className="rounded"
                            />
                            <label htmlFor={`accessorio-${accessorio.id}`} className="text-sm">
                              {accessorio.name} (v{accessorio.version})
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(newOrder.order_type === 'odl' || newOrder.order_type === 'odpel') && (
                <div>
                  <Label htmlFor="work_description">Descrizione Lavoro {newOrder.order_type === 'odl' ? '*' : ''}</Label>
                  <Textarea
                    id="work_description"
                    value={newOrder.work_description}
                    onChange={(e) => setNewOrder({...newOrder, work_description: e.target.value})}
                    placeholder="Descrivi il lavoro da eseguire..."
                    rows={3}
                  />
                </div>
              )}

              {/* Work Order Details */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="assigned_technician">Tecnico Assegnato</Label>
                  <Select value={newOrder.assigned_technician} onValueChange={(value) => setNewOrder({...newOrder, assigned_technician: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tecnico" />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map(tech => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.first_name} {tech.last_name} ({tech.employee_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="back_office_manager">Responsabile Back Office</Label>
                  <Select value={newOrder.back_office_manager} onValueChange={(value) => setNewOrder({...newOrder, back_office_manager: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona responsabile" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map(user => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="priority">Priorità</Label>
                  <Select value={newOrder.priority} onValueChange={(value) => setNewOrder({...newOrder, priority: value})}>
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

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="order_date">Data Ordine</Label>
                  <Input
                    id="order_date"
                    type="date"
                    value={newOrder.order_date}
                    onChange={(e) => setNewOrder({...newOrder, order_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="expected_delivery_date">Data Consegna Prevista</Label>
                  <Input
                    id="expected_delivery_date"
                    type="date"
                    value={newOrder.expected_delivery_date}
                    onChange={(e) => setNewOrder({...newOrder, expected_delivery_date: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="planned_start_date">Inizio Pianificato</Label>
                  <Input
                    id="planned_start_date"
                    type="date"
                    value={newOrder.planned_start_date}
                    onChange={(e) => setNewOrder({...newOrder, planned_start_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="planned_end_date">Fine Pianificata</Label>
                  <Input
                    id="planned_end_date"
                    type="date"
                    value={newOrder.planned_end_date}
                    onChange={(e) => setNewOrder({...newOrder, planned_end_date: e.target.value})}
                  />
                </div>
              </div>

              {/* Fast Duration Buttons */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Durata Rapida</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlannedDuration(24)}
                    className="text-xs"
                  >
                    24h
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlannedDuration(48)}
                    className="text-xs"
                  >
                    48h
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlannedDuration(24 * 7)}
                    className="text-xs"
                  >
                    7gg
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlannedDuration(24 * 15)}
                    className="text-xs"
                  >
                    15gg
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPlannedDuration(24 * 30)}
                    className="text-xs"
                  >
                    30gg
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clicca per impostare automaticamente inizio (oggi) e fine pianificata
                </p>
              </div>

              {/* Service Work Order specific fields */}
              {(newOrder.order_type === 'odl' || newOrder.order_type === 'odpel') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="location">Ubicazione</Label>
                    <Input
                      id="location"
                      value={newOrder.location}
                      onChange={(e) => setNewOrder({...newOrder, location: e.target.value})}
                      placeholder="Indirizzo del lavoro..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="equipment_needed">Attrezzature Necessarie</Label>
                    <Input
                      id="equipment_needed"
                      value={newOrder.equipment_needed}
                      onChange={(e) => setNewOrder({...newOrder, equipment_needed: e.target.value})}
                      placeholder="Attrezzature specifiche..."
                    />
                  </div>
                </div>
              )}

              {/* Shipping Order specific fields */}
              {newOrder.order_type === 'ods' && (
                <div>
                  <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
                  <Textarea
                    id="shipping_address"
                    value={newOrder.shipping_address}
                    onChange={(e) => setNewOrder({...newOrder, shipping_address: e.target.value})}
                    placeholder="Inserisci l'indirizzo completo di spedizione..."
                    rows={3}
                  />
                </div>
              )}

              {/* File Upload */}
              <div>
                <Label>File Ordine</Label>
                <div className="mt-2">
                  <FileUpload
                    value={uploadedFiles}
                    onChange={setUploadedFiles}
                    acceptedFileTypes={['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']}
                    maxFiles={10}
                  />
                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="relative border rounded-lg p-2">
                          <div className="flex items-center gap-2">
                            <FileImage className="w-4 h-4" />
                            <span className="text-sm truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(index)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={newOrder.notes}
                  onChange={(e) => setNewOrder({...newOrder, notes: e.target.value})}
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateOrder}>
                Crea Ordine
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
            <CardTitle className="text-sm font-medium">OdL</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odlOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini di lavoro</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OdP</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odpOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini di produzione</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">OdS</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{odsOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini di spedizione</p>
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
                  <SelectItem value="work">Con Ordini di Produzione</SelectItem>
                  <SelectItem value="installation">Con Ordini di Installazione</SelectItem>
                  <SelectItem value="shipping">Con Ordini di Spedizione</SelectItem>
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
        <CardContent>
          {viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Ordine</TableHead>
                <TableHead>Consegna</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Sotto-Ordini</TableHead>
                <TableHead>Note</TableHead>
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
                        to={`/crm/opportunities?lead=${order.lead_id}`}
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
                    {order.order_type && (
                      <Badge className={getOrderTypeColor(order.order_type)}>
                        {getOrderTypeLabel(order.order_type)}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.order_date && (
                      <span className="text-sm">
                        {new Date(order.order_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.delivery_date && (
                      <span className="text-sm">
                        {new Date(order.delivery_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(normalizeOrderStatus(order.status))}>
                      {normalizeOrderStatus(order.status).toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getSubOrdersStatus(order).length > 0 ? (
                      <div className="space-y-1">
                        {getSubOrdersStatus(order).map((subStatus, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Badge className={subStatus.color} variant="outline">
                              {subStatus.type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {subStatus.number}
                            </span>
                            <span className="text-xs font-medium">
                              {getSubOrderStatusLabel(subStatus.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nessun sotto-ordine</span>
                    )}
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
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          handleArchiveOrder(order.id);
                        }}>
                          <Package className="w-4 h-4 mr-2" />
                          Archivia
                        </DropdownMenuItem>
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
                                Questa azione eliminerà permanentemente l'ordine {order.number} e tutti i sotto-ordini associati (OdP, OdL, OdS). Questa azione non può essere annullata.
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
                  <TableCell colSpan={9} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun ordine trovato" : "Nessun ordine presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          ) : (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-3 gap-4">
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
                                       <div className="space-y-3">
                                         <div className="flex items-start justify-between gap-2">
                                           <div className="flex-1 min-w-0">
                                             <div className="font-semibold text-base">{order.number}</div>
                                             <div className="text-sm text-muted-foreground truncate">
                                               {order.customers?.name}
                                             </div>
                                             {order.order_date && (
                                               <div className="text-xs text-muted-foreground mt-1">
                                                 {new Date(order.order_date).toLocaleDateString('it-IT')}
                                               </div>
                                             )}
                                           </div>
                                           <div className="flex items-center gap-2 shrink-0">
                                             {order.order_type && (
                                               <Badge className={getOrderTypeColor(order.order_type)} variant="outline">
                                                 {getOrderTypeLabel(order.order_type)?.split(" ")[0]}
                                               </Badge>
                                             )}
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
                                                 <DropdownMenuItem onClick={(e) => {
                                                   e.stopPropagation();
                                                   handleArchiveOrder(order.id);
                                                 }}>
                                                   <Package className="mr-2 h-4 w-4" />
                                                   Archivia
                                                 </DropdownMenuItem>
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
                                                         Questa azione eliminerà permanentemente l'ordine e tutti i sotto-ordini associati (OdP, OdL, OdS). Questa azione non può essere annullata.
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
                                         
                                         {/* Riferimenti ordini collegati */}
                                         {getSubOrdersStatus(order).length > 0 && (
                                           <div className="pt-2 border-t space-y-2">
                                             <div className="text-xs font-medium text-muted-foreground">
                                               Ordini Collegati:
                                             </div>
                                             {getSubOrdersStatus(order).map((subStatus, idx) => (
                                               <div key={idx} className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded">
                                                 <div className="flex items-center gap-2 min-w-0">
                                                   <Badge className={subStatus.color} variant="outline">
                                                     {subStatus.type}
                                                   </Badge>
                                                   <span className="text-xs font-mono truncate">
                                                     {subStatus.number}
                                                   </span>
                                                 </div>
                                                 <span className="text-xs font-medium whitespace-nowrap">
                                                   {getSubOrderStatusLabel(subStatus.status)}
                                                 </span>
                                               </div>
                                             ))}
                                           </div>
                                         )}
                                         
                                         {/* Note preview */}
                                         {order.notes && order.notes.length > 0 && (
                                           <div className="pt-2 border-t">
                                             <div className="text-xs text-muted-foreground line-clamp-2">
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
                        Questa azione eliminerà permanentemente l'ordine {selectedOrder?.number} e tutti i sotto-ordini associati (OdP, OdL, OdS). Questa azione non può essere annullata.
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
                    <Label className="text-sm text-muted-foreground">Lead</Label>
                    {selectedOrder.leads ? (
                      <Link 
                        to={`/crm/opportunities?lead=${selectedOrder.lead_id}`}
                        className="text-primary hover:underline flex items-center gap-1 font-semibold"
                      >
                        {selectedOrder.leads.company_name}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      <div className="text-sm text-muted-foreground">Non collegato</div>
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
                </CardContent>
              </Card>

              {/* Production Work Orders */}
              {selectedOrder.work_orders && selectedOrder.work_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ordini di Produzione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedOrder.work_orders.map((wo) => (
                        <Link 
                          key={wo.id} 
                          to="/mfg/work-orders"
                          className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{wo.number}</div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <Badge className={
                              wo.status === 'completed' ? 'bg-green-100 text-green-800' :
                              wo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {getSubOrderStatusLabel(wo.status)}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {wo.includes_installation ? 'Include Installazione' : 'Solo Produzione'}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Service Work Orders */}
              {selectedOrder.service_work_orders && selectedOrder.service_work_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ordini di Lavoro/Installazione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedOrder.service_work_orders.map((swo) => (
                        <Link 
                          key={swo.id} 
                          to="/support/work-orders"
                          className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{swo.number}</div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <Badge className={
                              swo.status === 'completed' ? 'bg-green-100 text-green-800' :
                              swo.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {getSubOrderStatusLabel(swo.status)}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Shipping Orders */}
              {selectedOrder.shipping_orders && selectedOrder.shipping_orders.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Ordini di Spedizione</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {selectedOrder.shipping_orders.map((so) => (
                        <Link 
                          key={so.id} 
                          to="/warehouse/shipping-orders"
                          className="block p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold">{so.number}</div>
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <Badge className={
                              so.status === 'spedito' ? 'bg-green-100 text-green-800' :
                              so.status === 'in_preparazione' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {getSubOrderStatusLabel(so.status)}
                            </Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* No sub-orders message */}
              {(!selectedOrder.work_orders || selectedOrder.work_orders.length === 0) &&
               (!selectedOrder.service_work_orders || selectedOrder.service_work_orders.length === 0) &&
               (!selectedOrder.shipping_orders || selectedOrder.shipping_orders.length === 0) && (
                <Card>
                  <CardContent className="py-8 text-center text-muted-foreground">
                    Nessun sotto-ordine collegato
                  </CardContent>
                </Card>
              )}

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
              Sei sicuro di voler cambiare lo stato di questo ordine? Questa azione modificherà anche lo stato di tutti i sotto-ordini associati (OdP, OdL, OdS).
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