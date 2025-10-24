import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Filter, Download, Eye, Edit, Wrench, Trash2, LayoutGrid, List, ExternalLink, Calendar as CalendarIcon, Archive } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { OrderComments } from "@/components/orders/OrderComments";
import { BomComposition } from "@/components/production/BomComposition";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { OrderFileManager } from "@/components/orders/OrderFileManager";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  back_office_manager?: string;
  customer_id?: string;
  contact_id?: string;
  priority?: string;
  notes?: string;
  article?: string;
  bom_id?: string;
  accessori_ids?: string[];
  sales_order_id?: string;
  lead_id?: string;
  archived?: boolean;
  boms?: {
    name: string;
    version: string;
  };
  customers?: {
    name: string;
    code: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  back_office?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  sales_orders?: {
    number: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]); // Per back office manager
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "calendar">("kanban");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parentOrderFiles, setParentOrderFiles] = useState<any[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const { toast } = useToast();
  const { executeWithUndo } = useUndoableAction();

  const [formData, setFormData] = useState({
    title: "",
    bom_id: "",
    accessori_ids: [] as string[],
    customer_id: "",
    assigned_to: "",
    back_office_manager: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    notes: "",
    createServiceOrder: false,
    serviceOrderTitle: "",
    serviceOrderNotes: ""
  });

  useEffect(() => {
    fetchWorkOrders();
    fetchBoms();
    fetchCustomers();
    fetchUsers();
    fetchTechnicians();
  }, [showArchivedOrders]);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          boms(name, version),
          customers(name, code),
          sales_orders(number),
          leads(id, company_name),
          service_work_orders!production_work_order_id(id, number, title)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Manually join technician data
      const workOrdersWithTechnicians = await Promise.all(
        (data || []).map(async (wo) => {
          if (wo.assigned_to) {
            const { data: techData } = await supabase
              .from('technicians')
              .select('id, first_name, last_name, employee_code')
              .eq('id', wo.assigned_to)
              .single();
            
            return { ...wo, technician: techData };
          }
          return wo;
        })
      );

      setWorkOrders(workOrdersWithTechnicians);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBoms = async () => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select('id, name, version, level')
        .eq('level', 0) // Solo livello 0 (macchine complete)
        .order('name');

      if (error) throw error;
      
      setBoms(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento delle distinte base:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento dei clienti:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento degli utenti:", error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento dei tecnici:", error);
    }
  };

  // Fast buttons function for setting planned dates
  const setPlannedDuration = (hours: number) => {
    const now = new Date();
    const startDate = now.toISOString().slice(0, 16); // Format for datetime-local
    const endDate = new Date(now.getTime() + (hours * 60 * 60 * 1000)).toISOString().slice(0, 16);
    
    setFormData(prev => ({
      ...prev,
      planned_start_date: startDate,
      planned_end_date: endDate
    }));
  };

  const handleCustomerCreated = (newCustomer: { id: string; name: string; code: string }) => {
    setCustomers(prev => [...prev, newCustomer]);
    setFormData(prev => ({ ...prev, customer_id: newCustomer.id }));
    setShowCreateCustomer(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedWO) {
        const { error } = await supabase
          .from('work_orders')
          .update({
            title: formData.title,
            bom_id: formData.bom_id || null,
            accessori_ids: formData.accessori_ids,
            customer_id: formData.customer_id || null,
            assigned_to: (formData.assigned_to && formData.assigned_to.trim() !== '' && formData.assigned_to !== 'none') ? formData.assigned_to : null,
            priority: formData.priority,
            planned_start_date: formData.planned_start_date || null,
            planned_end_date: formData.planned_end_date || null,
            notes: formData.notes
          })
          .eq('id', selectedWO.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Commessa di produzione aggiornata con successo",
        });
      } else {
        // Create production work order (number will be auto-generated)
        const { data: productionWO, error: productionError } = await supabase
          .from('work_orders')
          .insert([{ 
            number: '', // Will be auto-generated by trigger
            title: formData.title,
            bom_id: formData.bom_id || null,
            accessori_ids: formData.accessori_ids,
            customer_id: formData.customer_id || null,
            assigned_to: (formData.assigned_to && formData.assigned_to.trim() !== '' && formData.assigned_to !== 'none') ? formData.assigned_to : null,
            priority: formData.priority,
            planned_start_date: formData.planned_start_date || null,
            planned_end_date: formData.planned_end_date || null,
            notes: formData.notes,
            status: 'da_fare'
          }])
          .select()
          .single();

        if (productionError) throw productionError;

        // Create service work order if requested (number will be auto-generated)
        if (formData.createServiceOrder && productionWO) {
          const { error: serviceError } = await supabase
            .from('service_work_orders')
            .insert([{
              number: '', // Will be auto-generated by trigger
              title: formData.serviceOrderTitle || `CdL collegato a ${formData.title}`,
              description: formData.serviceOrderNotes || `Commessa di lavoro collegata alla commessa di produzione ${productionWO.number}`,
              production_work_order_id: productionWO.id,
              customer_id: formData.customer_id || null,
              contact_id: null,
              assigned_to: formData.assigned_to || null,
              priority: formData.priority,
              status: 'to_do',
              notes: formData.serviceOrderNotes
            }]);

          if (serviceError) {
            console.error('Errore creazione CdL:', serviceError);
            toast({
              title: "Attenzione",
              description: `Commessa di produzione creata ma errore nella creazione della CdL collegata: ${serviceError.message}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Successo",
              description: `Commessa di produzione e CdL collegata creati con successo`,
            });
          }
        } else {
          toast({
            title: "Successo",
            description: "Commessa di produzione creata con successo",
          });
        }
      }

      setIsDialogOpen(false);
      setSelectedWO(null);
      setFormData({ 
        title: "", 
        bom_id: "", 
        accessori_ids: [],
        customer_id: "",
        assigned_to: "",
        back_office_manager: "",
        priority: "medium",
        planned_start_date: "", 
        planned_end_date: "", 
        notes: "",
        createServiceOrder: false,
        serviceOrderTitle: "",
        serviceOrderNotes: ""
      });
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (wo: WorkOrder) => {
    setSelectedWO(wo);
    // Find the BOM ID by matching the name and version
    const bomMatch = boms.find(bom => 
      bom.name === wo.boms?.name && bom.version === wo.boms?.version
    );
    
    setFormData({
      title: wo.title,
      bom_id: bomMatch?.id || "",
      accessori_ids: wo.accessori_ids || [],
      customer_id: wo.customer_id || "",
      assigned_to: wo.assigned_to || "",
      back_office_manager: wo.back_office_manager || "",
      priority: wo.priority || "medium",
      planned_start_date: wo.planned_start_date || "",
      planned_end_date: wo.planned_end_date || "",
      notes: wo.notes || "",
      createServiceOrder: false,
      serviceOrderTitle: "",
      serviceOrderNotes: ""
    });
    setIsDialogOpen(true);
  };

  const handleViewDetails = async (wo: WorkOrder) => {
    setSelectedWO(wo);
    setShowDetailsDialog(true);
    
    // Load parent order files if exists
    if (wo.sales_order_id) {
      try {
        const { data, error } = await supabase
          .from('sales_orders')
          .select('attachments')
          .eq('id', wo.sales_order_id)
          .single();
        
        if (error) throw error;
        setParentOrderFiles(Array.isArray(data?.attachments) ? data.attachments : []);
      } catch (error) {
        console.error('Error loading parent order files:', error);
        setParentOrderFiles([]);
      }
    } else {
      setParentOrderFiles([]);
    }
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Numero,Titolo,Cliente,Tecnico,Priorità,Stato,Inizio Pianificato\n"
      + filteredWorkOrders.map(wo => 
          `${wo.number},"${wo.title}","${wo.customers?.name || ''}","${wo.technician ? `${wo.technician.first_name} ${wo.technician.last_name}` : ''}","${wo.priority}","${wo.status}","${wo.planned_start_date || ''}"`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ordini_produzione.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = async (woId: string, newStatus: 'da_fare' | 'in_lavorazione' | 'in_test' | 'pronto' | 'completato' | 'standby' | 'bloccato') => {
    // Trova l'ordine corrente per salvare lo stato precedente
    const currentWO = workOrders.find(wo => wo.id === woId);
    if (!currentWO) return;
    
    const previousStatus = currentWO.status as string;
    
    // Funzione per cambiare lo stato
    const changeStatus = async () => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', woId);

      if (error) throw error;
      
      await fetchWorkOrders();
      return { woId, previousStatus, newStatus };
    };
    
    // Funzione per annullare il cambio di stato
    const undoStatusChange = async () => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: previousStatus as any })
        .eq('id', woId);

      if (error) throw error;
      
      await fetchWorkOrders();
    };
    
    try {
      await executeWithUndo(
        changeStatus,
        undoStatusChange,
        {
          successMessage: `Stato aggiornato a: ${
            newStatus === 'da_fare' ? 'Da Fare' :
            newStatus === 'in_lavorazione' ? 'In Lavorazione' :
            newStatus === 'in_test' ? 'In Test' :
            newStatus === 'pronto' ? 'Pronto' :
            newStatus === 'completato' ? 'Completato' :
            newStatus === 'standby' ? 'Standby' :
            'Bloccato'
          }`,
          errorMessage: 'Impossibile aggiornare lo stato',
          duration: 10000 // 10 secondi
        }
      );
    } catch (error: any) {
      // Errore già gestito da executeWithUndo
      console.error('Error changing status:', error);
    }
  };

  const handleArchive = async (woId: string, currentArchived: boolean) => {
    const newArchived = !currentArchived;
    
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ archived: newArchived })
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: newArchived ? "Ordine archiviato" : "Ordine ripristinato",
      });
      
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (woId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa commessa di produzione?")) {
      return;
    }

    try {
      // Prima controlla se ci sono service work orders collegati
      const { data: linkedServiceOrders, error: checkError } = await supabase
        .from('service_work_orders')
        .select('id')
        .eq('production_work_order_id', woId);

      if (checkError) throw checkError;

      if (linkedServiceOrders && linkedServiceOrders.length > 0) {
        const shouldProceed = confirm(
          `Questa commessa di produzione ha ${linkedServiceOrders.length} ordini di servizio collegati. Eliminandola, anche questi verranno scollegati. Vuoi continuare?`
        );
        
        if (!shouldProceed) return;

        // Scollega gli ordini di servizio impostando production_work_order_id a null
        const { error: unlinkError } = await supabase
          .from('service_work_orders')
          .update({ production_work_order_id: null })
          .eq('production_work_order_id', woId);

        if (unlinkError) throw unlinkError;
      }

      // Ora elimina la commessa di produzione
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di produzione eliminata con successo",
      });
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const normalizeStatus = (status: string): string => {
    // Non normalizziamo più - usiamo gli stati come sono nel DB
    return status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'da_fare': return 'bg-muted';
      case 'in_lavorazione': return 'bg-amber-500';
      case 'in_test': return 'bg-orange-500';
      case 'pronto': return 'bg-blue-500';
      case 'completato': return 'bg-success';
      case 'standby': return 'bg-purple-500';
      case 'bloccato': return 'bg-destructive';
      // Legacy support
      case 'to_do': return 'bg-muted';
      case 'test': return 'bg-orange-500';
      case 'pronti': return 'bg-blue-500';
      case 'spediti_consegnati': return 'bg-success';
      case 'completed':
      case 'closed': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    const woId = draggableId;

    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: newStatus })
        .eq("id", woId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato della commessa di produzione è stato aggiornato",
      });

      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive",
      });
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = 
      wo.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.boms?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === "all") {
      matchesStatus = !wo.archived; // Mostra tutti tranne gli archiviati
    } else if (statusFilter === "active") {
      // Mostra solo ordini attivi (non archiviati)
      matchesStatus = !wo.archived;
    } else if (statusFilter === "archive") {
      // Mostra solo ordini archiviati
      matchesStatus = wo.archived === true;
    } else {
      matchesStatus = wo.status === statusFilter && !wo.archived;
    }
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: workOrders.filter(wo => !wo.archived).length,
    active: workOrders.filter(wo => !wo.archived).length,
    da_fare: workOrders.filter(wo => wo.status === 'da_fare' && !wo.archived).length,
    in_lavorazione: workOrders.filter(wo => wo.status === 'in_lavorazione' && !wo.archived).length,
    in_test: workOrders.filter(wo => wo.status === 'in_test' && !wo.archived).length,
    pronto: workOrders.filter(wo => wo.status === 'pronto' && !wo.archived).length,
    completato: workOrders.filter(wo => wo.status === 'completato' && !wo.archived).length,
    standby: workOrders.filter(wo => wo.status === 'standby' && !wo.archived).length,
    bloccato: workOrders.filter(wo => wo.status === 'bloccato' && !wo.archived).length,
    archive: workOrders.filter(wo => wo.archived === true).length,
  };

  const workOrderStatuses = ['da_fare', 'in_lavorazione', 'in_test', 'pronto', 'completato', 'standby', 'bloccato'];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/mfg">Produzione</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Commesse di Produzione</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Commesse di Produzione (CdP)</h1>
          <p className="text-muted-foreground">
            Pianifica e monitora le commesse di produzione durante il loro ciclo di vita. Per creare una nuova commessa, utilizza la sezione Ordini.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-10 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card 
            key={status} 
            className={`cursor-pointer transition-colors ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            <CardContent className="p-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">
                  {status === 'all' ? 'Tutti' : 
                   status === 'active' ? 'Attivi' :
                   status === 'da_fare' ? 'Da Fare' :
                   status === 'in_lavorazione' ? 'In Lavorazione' :
                   status === 'in_test' ? 'In Test' :
                   status === 'pronto' ? 'Pronto' :
                   status === 'completato' ? 'Completato' :
                   status === 'standby' ? 'Standby' :
                   status === 'bloccato' ? 'Bloccato' :
                   status === 'archive' ? 'Archivio' : status.replace('_', ' ')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca commesse di produzione..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban" | "calendar")}>
              <TabsList>
                <TabsTrigger value="table">
                  <List className="h-4 w-4 mr-2" />
                  Tabella
                </TabsTrigger>
                <TabsTrigger value="kanban">
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="calendar">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  Calendario
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" size="sm" onClick={() => setShowFiltersDialog(true)}>
              <Filter className="mr-2 h-4 w-4" />
              Filtri
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Esporta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table or Kanban */}
      <Card>
        <CardHeader>
          <CardTitle>Commesse di Produzione ({filteredWorkOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === "table" ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Caricamento commesse di produzione...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Nessuna commessa di produzione trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkOrders.map((wo: any) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {wo.number}
                          {wo.service_work_orders && wo.service_work_orders.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Wrench className="w-3 h-3 mr-1" />
                              Installazione
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {wo.customers ? (
                          <div>
                            <div className="font-medium">{wo.customers.name}</div>
                            <div className="text-sm text-muted-foreground">({wo.customers.code})</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          wo.priority === 'urgent' ? 'destructive' :
                          wo.priority === 'high' ? 'default' :
                          wo.priority === 'medium' ? 'secondary' : 'outline'
                        }>
                          {wo.priority === 'urgent' ? 'Urgente' :
                           wo.priority === 'high' ? 'Alta' :
                           wo.priority === 'medium' ? 'Media' : 'Bassa'}
                        </Badge>
                      </TableCell>
                       <TableCell>
                          <Select 
                            value={wo.status} 
                            onValueChange={(value: 'da_fare' | 'in_lavorazione' | 'in_test' | 'pronto' | 'completato' | 'standby' | 'bloccato') => 
                              handleStatusChange(wo.id, value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue>
                                <StatusBadge status={wo.status} />
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="da_fare">
                                <Badge className="bg-muted text-muted-foreground">Da Fare</Badge>
                              </SelectItem>
                              <SelectItem value="in_lavorazione">
                                <Badge className="bg-amber-500 text-white">In Lavorazione</Badge>
                              </SelectItem>
                              <SelectItem value="in_test">
                                <Badge className="bg-orange-500 text-white">In Test</Badge>
                              </SelectItem>
                              <SelectItem value="pronto">
                                <Badge className="bg-blue-500 text-white">Pronto</Badge>
                              </SelectItem>
                              <SelectItem value="completato">
                                <Badge className="bg-success text-success-foreground">Completato</Badge>
                              </SelectItem>
                              <SelectItem value="standby">
                                <Badge className="bg-purple-500 text-white">Standby</Badge>
                              </SelectItem>
                              <SelectItem value="bloccato">
                                <Badge className="bg-destructive text-destructive-foreground">Bloccato</Badge>
                              </SelectItem>
                            </SelectContent>
                           </Select>
                       </TableCell>
                       <TableCell className="text-right">
                         <div className="flex items-center justify-end space-x-2">
                           <Button variant="ghost" size="sm" onClick={() => handleViewDetails(wo)}>
                             <Eye className="h-4 w-4" />
                           </Button>
                           <Button variant="ghost" size="sm" onClick={() => handleEdit(wo)}>
                             <Edit className="h-4 w-4" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={() => handleArchive(wo.id, wo.archived || false)}
                             title={wo.archived ? "Ripristina" : "Archivia"}
                           >
                             <Archive className="h-4 w-4" />
                           </Button>
                           <Button variant="ghost" size="sm" onClick={() => handleDelete(wo.id)}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          ) : viewMode === "kanban" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-7 gap-4">
                {workOrderStatuses.map((status) => (
                  <div key={status} className="space-y-3">
                    <div className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      {status === "da_fare" && "Da Fare"}
                      {status === "in_lavorazione" && "In Lavorazione"}
                      {status === "in_test" && "In Test"}
                      {status === "pronto" && "Pronto"}
                      {status === "completato" && "Completato"}
                      {status === "standby" && "Standby"}
                      {status === "bloccato" && "Bloccato"}
                      <span className="ml-2 text-xs">
                        ({filteredWorkOrders.filter(wo => wo.status === status).length})
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
                            {filteredWorkOrders
                              .filter(wo => wo.status === status)
                              .map((wo, index) => (
                                <Draggable key={wo.id} draggableId={wo.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => handleViewDetails(wo)}
                                      className={`p-4 bg-card border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                                        snapshot.isDragging ? 'shadow-lg opacity-90' : ''
                                      }`}
                                    >
                                      <div className="space-y-2">
                                        <div className="flex items-start justify-between">
                                          <div>
                                            <div className="font-semibold">{wo.number}</div>
                                            <div className="text-sm text-muted-foreground line-clamp-2">
                                              {wo.customers?.name || 'N/A'}
                                            </div>
                                          </div>
                                          {wo.priority && (
                                            <Badge variant={wo.priority === 'high' ? 'destructive' : 'secondary'}>
                                              {wo.priority}
                                            </Badge>
                                          )}
                                        </div>
                                        {wo.boms && (
                                          <div className="text-xs">
                                            <Badge variant="outline">{wo.boms.name}</Badge>
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
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                  <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - date.getDay() + i);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayOrders = filteredWorkOrders.filter(wo => 
                    wo.planned_start_date && wo.planned_start_date.split('T')[0] === dateStr
                  );
                  
                  return (
                    <div key={i} className={`min-h-[100px] p-2 border rounded-lg ${
                      date.getMonth() !== new Date().getMonth() ? 'bg-muted/20' : 'bg-card'
                    }`}>
                      <div className="text-sm font-medium mb-1">{date.getDate()}</div>
                      <div className="space-y-1">
                        {dayOrders.map(wo => (
                          <div
                            key={wo.id}
                            onClick={() => handleViewDetails(wo)}
                            className="text-xs p-1 bg-primary/10 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                          >
                            <div className="font-medium truncate">{wo.number}</div>
                            <div className="text-muted-foreground truncate">{wo.customers?.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettagli Commessa di Produzione</DialogTitle>
            <DialogDescription>
              Informazioni complete sulla commessa di produzione {selectedWO?.number}
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Numero</Label>
                  <p className="text-sm">{selectedWO.number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Stato</Label>
                  <div className="mt-1">
                    <Select 
                      value={selectedWO.status} 
                      onValueChange={(value) => {
                        handleStatusChange(selectedWO.id, value as any);
                        setSelectedWO({ ...selectedWO, status: value });
                      }}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue>
                          <Badge className={getStatusColor(selectedWO.status)}>
                            {selectedWO.status === 'to_do' ? 'Da Fare' :
                             selectedWO.status === 'in_lavorazione' ? 'In Lavorazione' :
                             selectedWO.status === 'test' ? 'Test' :
                             selectedWO.status === 'pronti' ? 'Pronti' :
                             selectedWO.status === 'spediti_consegnati' ? 'Spediti' : selectedWO.status}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to_do">
                          <Badge className="bg-gray-500">Da Fare</Badge>
                        </SelectItem>
                        <SelectItem value="in_lavorazione">
                          <Badge className="bg-blue-600">In Lavorazione</Badge>
                        </SelectItem>
                        <SelectItem value="test">
                          <Badge className="bg-orange-500">Test</Badge>
                        </SelectItem>
                        <SelectItem value="pronti">
                          <Badge className="bg-green-600">Pronti</Badge>
                        </SelectItem>
                        <SelectItem value="spediti_consegnati">
                          <Badge className="bg-purple-600">Spediti/Consegnati</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Titolo</Label>
                <p className="text-sm">{selectedWO.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-sm">
                    {selectedWO.customers ? `${selectedWO.customers.name} (${selectedWO.customers.code})` : 'Non assegnato'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Priorità</Label>
                  <Badge variant={
                    selectedWO.priority === 'urgent' ? 'destructive' :
                    selectedWO.priority === 'high' ? 'default' :
                    selectedWO.priority === 'medium' ? 'secondary' : 'outline'
                  }>
                    {selectedWO.priority === 'urgent' ? 'Urgente' :
                     selectedWO.priority === 'high' ? 'Alta' :
                     selectedWO.priority === 'medium' ? 'Media' : 'Bassa'}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Lead</Label>
                  {selectedWO.leads ? (
                    <Link 
                      to={`/crm/opportunities?lead=${selectedWO.lead_id}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedWO.leads.company_name}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground">Non collegato</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Ordine di Vendita</Label>
                  <p className="text-sm">
                    {selectedWO.sales_orders ? selectedWO.sales_orders.number : 'Non collegato'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Tecnico</Label>
                  <p className="text-sm">
                    {selectedWO.technician ? `${selectedWO.technician.first_name} ${selectedWO.technician.last_name} (${selectedWO.technician.employee_code})` : 'Non assegnato'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Distinta Base</Label>
                  <p className="text-sm">
                    {selectedWO.boms ? `${selectedWO.boms.name} (${selectedWO.boms.version})` : 'Non assegnata'}
                  </p>
                </div>
              </div>

              {/* Articles */}
              {selectedWO.article && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Articoli</Label>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedWO.article}</p>
                  </div>
                </div>
              )}

              {/* Composizione BOM */}
              {selectedWO.bom_id && (
                <div className="border-t pt-4">
                  <BomComposition bomId={selectedWO.bom_id} />
                </div>
              )}
              
              {/* Parent Order Files */}
              {selectedWO.sales_order_id && parentOrderFiles.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">File dall'Ordine Principale</h4>
                  <OrderFileManager
                    orderId={selectedWO.sales_order_id}
                    attachments={parentOrderFiles}
                    readOnly={true}
                    label="File Informativi (Ordine Principale)"
                  />
                </div>
              )}

              {(selectedWO.planned_start_date || selectedWO.planned_end_date) && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Date Pianificate</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Inizio</Label>
                      <p className="text-sm">
                        {selectedWO.planned_start_date ? new Date(selectedWO.planned_start_date).toLocaleString('it-IT') : 'Non impostato'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fine</Label>
                      <p className="text-sm">
                        {selectedWO.planned_end_date ? new Date(selectedWO.planned_end_date).toLocaleString('it-IT') : 'Non impostato'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedWO.notes && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground">Note</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedWO.notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowDetailsDialog(false);
                    handleEdit(selectedWO);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </Button>
                <Link to={`/mfg/executions?wo=${selectedWO.id}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Wrench className="h-4 w-4 mr-2" />
                    Esecuzioni
                  </Button>
                </Link>
                {selectedWO.status !== 'completato' && (
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={async () => {
                      const nextStatus = 
                        selectedWO.status === 'da_fare' ? 'in_lavorazione' :
                        selectedWO.status === 'in_lavorazione' ? 'in_test' :
                        selectedWO.status === 'in_test' ? 'pronto' :
                        selectedWO.status === 'pronto' ? 'completato' : 'completato';
                      
                      await handleStatusChange(selectedWO.id, nextStatus as any);
                      setSelectedWO({ ...selectedWO, status: nextStatus as any });
                    }}
                  >
                    {selectedWO.status === 'da_fare' ? 'Inizia Lavorazione' :
                     selectedWO.status === 'in_lavorazione' ? 'Passa a Test' :
                     selectedWO.status === 'in_test' ? 'Segna come Pronto' :
                     selectedWO.status === 'pronto' ? 'Completa' : 'Completa'}
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Filters Dialog */}
      <Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtri Avanzati</DialogTitle>
            <DialogDescription>
              Applica filtri avanzati per raffinare la ricerca delle commesse di produzione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="da_fare">Da Fare</SelectItem>
                  <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                  <SelectItem value="in_test">In Test</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                  <SelectItem value="completato">Completato</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="bloccato">Bloccato</SelectItem>
                  <SelectItem value="archive">Archivio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFiltersDialog(false)}>
                Annulla
              </Button>
              <Button onClick={() => setShowFiltersDialog(false)}>
                Applica Filtri
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}