import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Filter, Download, Eye, Edit, Wrench, Trash2, LayoutGrid, List, ExternalLink, Calendar as CalendarIcon } from "lucide-react";
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

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string; // Accetta qualsiasi stato per compatibilità con la migrazione
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  customer_id?: string;
  contact_id?: string;
  priority?: string;
  notes?: string;
  bom_id?: string;
  accessori_ids?: string[];
  sales_order_id?: string;
  lead_id?: string;
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
  
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "calendar">("table");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: "",
    bom_id: "",
    accessori_ids: [] as string[],
    customer_id: "",
    assigned_to: "",
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
    
    fetchTechnicians();
  }, []);

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
        .in('level', [0, 3]) // Solo livello 0 (macchine complete) e livello 3 (accessori)
        .order('level')
        .order('name');

      if (error) throw error;
      
      // Separa BOMs e accessori
      setBoms(data?.filter(bom => bom.level === 0) || []);
      setAccessori(data?.filter(bom => bom.level === 3) || []);
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
          description: "Ordine di produzione aggiornato con successo",
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
            status: 'to_do'
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
              title: formData.serviceOrderTitle || `OdL collegato a ${formData.title}`,
              description: formData.serviceOrderNotes || `Ordine di lavoro collegato all'ordine di produzione ${productionWO.number}`,
              production_work_order_id: productionWO.id,
              customer_id: formData.customer_id || null,
              contact_id: null,
              assigned_to: formData.assigned_to || null,
              priority: formData.priority,
              status: 'to_do',
              notes: formData.serviceOrderNotes
            }]);

          if (serviceError) {
            console.error('Errore creazione OdL:', serviceError);
            toast({
              title: "Attenzione",
              description: `Ordine di produzione creato ma errore nella creazione dell'OdL collegato: ${serviceError.message}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Successo",
              description: `Ordine di produzione e OdL collegato creati con successo`,
            });
          }
        } else {
          toast({
            title: "Successo",
            description: "Ordine di produzione creato con successo",
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

  const handleViewDetails = (wo: WorkOrder) => {
    setSelectedWO(wo);
    setShowDetailsDialog(true);
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

  const handleStatusChange = async (woId: string, newStatus: 'to_do' | 'in_lavorazione' | 'test' | 'pronti' | 'spediti_consegnati') => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Stato ordine di produzione aggiornato a ${newStatus}`,
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
    if (!confirm("Sei sicuro di voler eliminare questo ordine di produzione?")) {
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
          `Questo ordine di produzione ha ${linkedServiceOrders.length} ordini di servizio collegati. Eliminandolo, anche questi verranno scollegati. Vuoi continuare?`
        );
        
        if (!shouldProceed) return;

        // Scollega gli ordini di servizio impostando production_work_order_id a null
        const { error: unlinkError } = await supabase
          .from('service_work_orders')
          .update({ production_work_order_id: null })
          .eq('production_work_order_id', woId);

        if (unlinkError) throw unlinkError;
      }

      // Ora elimina l'ordine di produzione
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ordine di produzione eliminato con successo",
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
    const statusMap: Record<string, string> = {
      "planned": "to_do",
      "completato": "completed",
      "in_lavorazione": "in_progress",
      "in_corso": "in_progress"
    };
    return statusMap[status] || status;
  };

  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    switch (normalized) {
      case 'to_do': return 'bg-info';
      case 'in_progress': return 'bg-primary';
      case 'testing': return 'bg-warning';
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
        description: "Lo stato dell'ordine di produzione è stato aggiornato",
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
    
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: workOrders.length,
    to_do: workOrders.filter(wo => normalizeStatus(wo.status) === 'to_do').length,
    in_progress: workOrders.filter(wo => normalizeStatus(wo.status) === 'in_progress').length,
    testing: workOrders.filter(wo => normalizeStatus(wo.status) === 'testing').length,
    completed: workOrders.filter(wo => normalizeStatus(wo.status) === 'completed' || normalizeStatus(wo.status) === 'closed').length,
  };

  const workOrderStatuses = ["to_do", "in_progress", "testing", "completed"];

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
          <BreadcrumbPage>Ordini di Produzione</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordini di Produzione (OdP)</h1>
          <p className="text-muted-foreground">
            Pianifica e monitora gli ordini di produzione durante il loro ciclo di vita
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { 
              setSelectedWO(null); 
              setFormData({ 
                title: "", 
                bom_id: "", 
                accessori_ids: [],
                customer_id: "",
                assigned_to: "",
                priority: "medium",
                planned_start_date: "", 
                planned_end_date: "", 
                notes: "",
                createServiceOrder: false,
                serviceOrderTitle: "",
                serviceOrderNotes: ""
              });
            }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Ordine di Produzione
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedWO ? "Modifica Ordine di Produzione" : "Crea Nuovo Ordine di Produzione"}</DialogTitle>
              <DialogDescription>
                {selectedWO ? "Aggiorna i dettagli dell'ordine di produzione qui sotto." : "Crea un nuovo ordine di produzione. Il numero seriale verrà generato automaticamente."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titolo *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Titolo ordine di produzione"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label htmlFor="bom_id">Macchina/Prodotto Principale</Label>
                   <Select value={formData.bom_id} onValueChange={(value) => setFormData(prev => ({ ...prev, bom_id: value }))}>
                     <SelectTrigger>
                       <SelectValue placeholder="Seleziona Macchina Principale" />
                     </SelectTrigger>
                     <SelectContent>
                       {boms.map((bom) => (
                         <SelectItem key={bom.id} value={bom.id}>
                           {bom.name} ({bom.version})
                         </SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="priority">Priorità</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona priorità" />
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

              {/* Accessori selection */}
              <div className="space-y-2">
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
                            checked={formData.accessori_ids.includes(accessorio.id)}
                            onChange={(e) => {
                              const isChecked = e.target.checked;
                              setFormData(prev => ({
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

              <div className="space-y-2">
                <Label htmlFor="customer_id">Cliente</Label>
                <div className="flex gap-2">
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateCustomer(true)}
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assegnato a</Label>
                <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value === 'none' ? '' : value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tecnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {technicians.map((technician) => (
                      <SelectItem key={technician.id} value={technician.id}>
                        {technician.first_name} {technician.last_name} ({technician.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planned_start_date">Inizio Pianificato</Label>
                  <Input
                    id="planned_start_date"
                    type="datetime-local"
                    value={formData.planned_start_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, planned_start_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planned_end_date">Fine Pianificata</Label>
                  <Input
                    id="planned_end_date"
                    type="datetime-local"
                    value={formData.planned_end_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, planned_end_date: e.target.value }))}
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
                  Clicca per impostare automaticamente inizio (ora) e fine pianificata
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note opzionali"
                />
              </div>

              {/* Option to create service work order */}
              {!selectedWO && (
                <div className="space-y-4 border-t pt-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createServiceOrder"
                      checked={formData.createServiceOrder}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, createServiceOrder: checked as boolean }))}
                    />
                    <Label htmlFor="createServiceOrder" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Crea anche un Ordine di Lavoro (OdL) collegato
                    </Label>
                  </div>
                  
                  {formData.createServiceOrder && (
                    <div className="space-y-4 ml-6 p-4 bg-muted rounded-lg">
                      <div className="space-y-2">
                        <Label htmlFor="serviceOrderTitle">Titolo OdL</Label>
                        <Input
                          id="serviceOrderTitle"
                          value={formData.serviceOrderTitle}
                          onChange={(e) => setFormData(prev => ({ ...prev, serviceOrderTitle: e.target.value }))}
                          placeholder={`OdL collegato a ${formData.title || 'questo OdP'}`}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="serviceOrderNotes">Note OdL</Label>
                        <Textarea
                          id="serviceOrderNotes"
                          value={formData.serviceOrderNotes}
                          onChange={(e) => setFormData(prev => ({ ...prev, serviceOrderNotes: e.target.value }))}
                          placeholder="Descrizione del lavoro di installazione/assistenza"
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">
                  {selectedWO ? "Aggiorna" : "Crea"} Ordine di Produzione
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                   status === 'to_do' ? 'Da Fare' :
                   status === 'in_lavorazione' ? 'In Lavorazione' :
                   status === 'test' ? 'Test' :
                   status === 'pronti' ? 'Pronti' :
                   status === 'spediti_consegnati' ? 'Spediti' : status.replace('_', ' ')}
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
                placeholder="Cerca ordini di produzione..."
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
          <CardTitle>Ordini di Produzione ({filteredWorkOrders.length})</CardTitle>
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
                      Caricamento ordini di produzione...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      Nessun ordine di produzione trovato
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
                            onValueChange={(value: 'to_do' | 'in_lavorazione' | 'test' | 'pronti' | 'spediti_consegnati') => 
                              handleStatusChange(wo.id, value)
                            }
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue>
                                <StatusBadge status={wo.status} />
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
                                <Badge className="bg-purple-600">Spediti</Badge>
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
              <div className="grid grid-cols-4 gap-4">
                {workOrderStatuses.map((status) => (
                  <div key={status} className="space-y-3">
                    <div className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      {status === "to_do" && "Da Fare"}
                      {status === "in_lavorazione" && "In Lavorazione"}
                      {status === "test" && "Test"}
                      {status === "pronti" && "Pronti"}
                      {status === "spediti_consegnati" && "Spediti"}
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
                              .filter(wo => normalizeStatus(wo.status) === status)
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
            <DialogTitle>Dettagli Ordine di Produzione</DialogTitle>
            <DialogDescription>
              Informazioni complete sull'ordine di produzione {selectedWO?.number}
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
                {selectedWO.status !== 'closed' && (
                  <Button
                    variant="default"
                    className="flex-1"
                    onClick={async () => {
                      const nextStatus = 
                        selectedWO.status === 'planned' ? 'in_progress' :
                        selectedWO.status === 'in_progress' ? 'testing' :
                        selectedWO.status === 'testing' ? 'closed' : 'closed';
                      
                      await handleStatusChange(selectedWO.id, nextStatus as any);
                      setSelectedWO({ ...selectedWO, status: nextStatus as any });
                    }}
                  >
                    {selectedWO.status === 'planned' ? 'Inizia' :
                     selectedWO.status === 'in_progress' ? 'In Test' :
                     selectedWO.status === 'testing' ? 'Completa' : 'Completa'}
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
              Applica filtri avanzati per raffinare la ricerca degli ordini di produzione
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
                  <SelectItem value="planned">Pianificato</SelectItem>
                  <SelectItem value="in_progress">In Corso</SelectItem>
                  <SelectItem value="testing">Test</SelectItem>
                  <SelectItem value="closed">Chiuso</SelectItem>
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