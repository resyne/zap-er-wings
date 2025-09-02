import { useState, useEffect } from "react";
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
import { Plus, Search, Calendar, Package, FileImage, Upload, X, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";

interface Order {
  id: string;
  number: string;
  customer_id?: string;
  order_date?: string;
  delivery_date?: string;
  status?: string;
  notes?: string;
  order_type?: string;
  created_at: string;
  customers?: {
    name: string;
    code: string;
  };
}

const orderStatuses = ["draft", "confirmed", "in_production", "shipped", "delivered", "cancelled"];
const orderTypes = [
  { value: "odl", label: "Ordine di Lavoro (OdL)" },
  { value: "odp", label: "Ordine di Produzione (OdP)" },
  { value: "odpel", label: "Ordine Produzione e Installazione (OdPeL)" }
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  const [newOrder, setNewOrder] = useState({
    customer_id: "",
    order_type: "",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    status: "draft",
    notes: "",
    work_description: "",
    bom_id: "",
    accessori_ids: [], // Array of selected accessori IDs
    assigned_technician: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    location: "",
    equipment_needed: ""
  });
  
  const { toast } = useToast();

  useEffect(() => {
    loadOrders();
    loadRelatedData();
  }, []);

  const loadOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_orders")
        .select(`
          *,
          customers(name, code)
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
      const [customersRes, bomsRes, accessoriRes, techniciansRes] = await Promise.all([
        supabase.from("customers").select("id, name, code").eq("active", true),
        supabase.from("boms").select("id, name, version, level").in("level", [0, 1, 2]).order("name"),
        supabase.from("boms").select("id, name, version, level").eq("level", 3).order("name"),
        supabase.from("technicians").select("id, first_name, last_name, employee_code").eq("active", true)
      ]);

      if (customersRes.error) throw customersRes.error;
      if (bomsRes.error) throw bomsRes.error;
      if (accessoriRes.error) throw accessoriRes.error;
      if (techniciansRes.error) throw techniciansRes.error;

      setCustomers(customersRes.data || []);
      setBoms(bomsRes.data || []);
      setAccessori(accessoriRes.data || []);
      setTechnicians(techniciansRes.data || []);
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
      priority: newOrder.priority,
      planned_start_date: newOrder.planned_start_date || null,
      planned_end_date: newOrder.planned_end_date || null,
      notes: newOrder.notes,
      includes_installation: newOrder.order_type === 'odpel'
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
      priority: newOrder.priority,
      scheduled_date: newOrder.planned_start_date ? new Date(newOrder.planned_start_date).toISOString() : null,
      location: newOrder.location || null,
      equipment_needed: newOrder.equipment_needed || null,
      notes: newOrder.notes,
      production_work_order_id: productionWOId || null
    };

    const { data: serviceWO, error } = await supabase
      .from('service_work_orders')
      .insert([serviceData])
      .select()
      .single();

    if (error) throw error;
    return serviceWO;
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
      // Create main sales order
      const orderData = {
        number: "", // Auto-generated
        customer_id: newOrder.customer_id,
        order_date: newOrder.order_date || null,
        delivery_date: newOrder.delivery_date || null,
        status: newOrder.status,
        notes: newOrder.notes || null,
        order_type: newOrder.order_type
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
      }

      let successMessage = "Ordine creato con successo";
      if (productionWO && serviceWO) {
        successMessage += ` - Ordine di Produzione: ${productionWO.number}, Ordine di Lavoro: ${serviceWO.number}`;
      } else if (productionWO) {
        successMessage += ` - Ordine di Produzione: ${productionWO.number}`;
      } else if (serviceWO) {
        successMessage += ` - Ordine di Lavoro: ${serviceWO.number}`;
      }

      toast({
        title: "Successo",
        description: successMessage,
      });

      setIsDialogOpen(false);
      setNewOrder({
        customer_id: "",
        order_type: "",
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        status: "draft",
        notes: "",
        work_description: "",
        bom_id: "",
        accessori_ids: [],
        assigned_technician: "",
        priority: "medium",
        planned_start_date: "",
        planned_end_date: "",
        location: "",
        equipment_needed: ""
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
      order_type: order.order_type || "",
      order_date: order.order_date || new Date().toISOString().split('T')[0],
      delivery_date: order.delivery_date || "",
      status: order.status || "draft",
      notes: order.notes || "",
      work_description: "",
      bom_id: "",
      accessori_ids: [],
      assigned_technician: "",
      priority: "medium",
      planned_start_date: "",
      planned_end_date: "",
      location: "",
      equipment_needed: ""
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
        order_type: newOrder.order_type
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
        order_type: "",
        order_date: new Date().toISOString().split('T')[0],
        delivery_date: "",
        status: "draft",
        notes: "",
        work_description: "",
        bom_id: "",
        accessori_ids: [],
        assigned_technician: "",
        priority: "medium",
        planned_start_date: "",
        planned_end_date: "",
        location: "",
        equipment_needed: ""
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

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo ordine? Questa azione non può essere annullata.")) {
      return;
    }

    try {
      // Prima controlla e gestisci i work orders collegati
      const { data: linkedWorkOrders, error: checkError } = await supabase
        .from('work_orders')
        .select('id')
        .eq('customer_id', orderId);

      if (checkError) throw checkError;

      if (linkedWorkOrders && linkedWorkOrders.length > 0) {
        const shouldProceed = confirm(
          `Questo ordine ha ${linkedWorkOrders.length} ordini di lavoro collegati. Eliminandolo, anche questi verranno eliminati. Vuoi continuare?`
        );
        
        if (!shouldProceed) return;

        // Elimina prima i work orders collegati
        for (const wo of linkedWorkOrders) {
          // Prima scollega eventuali service work orders
          await supabase
            .from('service_work_orders')
            .update({ production_work_order_id: null })
            .eq('production_work_order_id', wo.id);

          // Elimina il work order
          await supabase
            .from('work_orders')
            .delete()
            .eq('id', wo.id);
        }
      }

      // Ora elimina l'ordine principale
      const { error } = await supabase
        .from("sales_orders")
        .delete()
        .eq("id", orderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ordine eliminato con successo",
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
      case "delivered":
        return "default";
      case "cancelled":
        return "destructive";
      case "shipped":
        return "secondary";
      case "confirmed":
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
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getOrderTypeLabel = (orderType?: string) => {
    const type = orderTypes.find(t => t.value === orderType);
    return type ? type.label : orderType?.toUpperCase();
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleCustomerCreated = async () => {
    await loadRelatedData(); // Reload customers to include the new one
    setIsCreateCustomerDialogOpen(false);
  };

  const filteredOrders = orders.filter(order =>
    `${order.number} ${order.notes || ""} ${order.customers?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalOrders = filteredOrders.length;
  const deliveredOrders = filteredOrders.filter(order => order.status === "delivered");
  const shippedOrders = filteredOrders.filter(order => order.status === "shipped");
  const odlOrders = filteredOrders.filter(order => order.order_type === "odl");
  const odpOrders = filteredOrders.filter(order => order.order_type === "odp");

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
          <p className="text-muted-foreground">Gestisci gli ordini e la creazione automatica di OdL/OdP</p>
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
                Seleziona il tipo di ordine per creare automaticamente OdL, OdP o entrambi
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

              {/* Accessori selection - Always available */}
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
              <div className="grid grid-cols-2 gap-4">
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
              <div className="grid grid-cols-3 gap-4">
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
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
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
            <CardTitle className="text-sm font-medium">In Spedizione</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{shippedOrders.length}</div>
            <p className="text-xs text-muted-foreground">ordini spediti</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Ordini ({filteredOrders.length})</CardTitle>
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
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data Ordine</TableHead>
                <TableHead>Consegna</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="w-[50px]">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => (
                <TableRow key={order.id}>
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
                    {order.status && (
                      <Badge variant={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
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
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditOrder(order)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Modifica
                        </DropdownMenuItem>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                              <Trash2 className="w-4 h-4 mr-2" />
                              Elimina
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                              <AlertDialogDescription>
                                Sei sicuro di voler eliminare l'ordine {order.number}? Questa azione non può essere annullata.
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
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun ordine trovato" : "Nessun ordine presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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

        {/* Create Customer Dialog */}
        <CreateCustomerDialog
          open={isCreateCustomerDialogOpen}
          onOpenChange={setIsCreateCustomerDialogOpen}
          onCustomerCreated={handleCustomerCreated}
        />
      </div>
    );
  }