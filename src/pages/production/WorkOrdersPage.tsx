import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, Play, TestTube, CheckCircle, Wrench } from "lucide-react";
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
  status: 'planned' | 'in_progress' | 'testing' | 'closed';
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  customer_id?: string;
  contact_id?: string;
  priority?: string;
  notes?: string;
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
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
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
        .select('id, name, version')
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
          .update(formData)
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
            bom_id: formData.bom_id,
            customer_id: formData.customer_id || null,
            assigned_to: formData.assigned_to || null,
            priority: formData.priority,
            planned_start_date: formData.planned_start_date,
            planned_end_date: formData.planned_end_date,
            notes: formData.notes,
            status: 'planned' 
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
              status: 'planned',
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

  const handleStatusChange = async (woId: string, newStatus: 'planned' | 'in_progress' | 'testing' | 'closed') => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-info';
      case 'in_progress': return 'bg-primary';
      case 'testing': return 'bg-warning';
      case 'closed': return 'bg-success';
      default: return 'bg-muted';
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
    planned: workOrders.filter(wo => wo.status === 'planned').length,
    in_progress: workOrders.filter(wo => wo.status === 'in_progress').length,
    testing: workOrders.filter(wo => wo.status === 'testing').length,
    closed: workOrders.filter(wo => wo.status === 'closed').length,
  };

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
          <DialogContent className="sm:max-w-[500px]">
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
                  <Label htmlFor="bom_id">Distinta Base *</Label>
                  <Select value={formData.bom_id} onValueChange={(value) => setFormData(prev => ({ ...prev, bom_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona Distinta Base" />
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
                <Select value={formData.assigned_to} onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tecnico" />
                  </SelectTrigger>
                  <SelectContent>
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
                   status === 'planned' ? 'Pianificati' :
                   status === 'in_progress' ? 'In Corso' :
                   status === 'testing' ? 'Test' :
                   status === 'closed' ? 'Chiusi' : status.replace('_', ' ')}
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

      {/* Work Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Ordini di Produzione ({filteredWorkOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tecnico</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Inizio Pianificato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      Caricamento ordini di produzione...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
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
                      <TableCell>{wo.title}</TableCell>
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
                        {wo.technician ? (
                          <div>
                            <div className="font-medium">{wo.technician.first_name} {wo.technician.last_name}</div>
                            <div className="text-sm text-muted-foreground">({wo.technician.employee_code})</div>
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
                        <StatusBadge status={wo.status} />
                      </TableCell>
                      <TableCell>
                        {wo.planned_start_date ? 
                          new Date(wo.planned_start_date).toLocaleDateString() : 
                          <span className="text-muted-foreground">Non impostato</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm" onClick={() => handleViewDetails(wo)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {wo.status === 'planned' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStatusChange(wo.id, 'in_progress')}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          )}
                          {wo.status === 'in_progress' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStatusChange(wo.id, 'testing')}
                            >
                              <TestTube className="h-4 w-4" />
                            </Button>
                          )}
                          {wo.status === 'testing' && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStatusChange(wo.id, 'closed')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(wo)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Ordine di Produzione</DialogTitle>
            <DialogDescription>
              Informazioni complete sull'ordine di produzione {selectedWO?.number}
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Numero</Label>
                  <p className="text-sm text-muted-foreground">{selectedWO.number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stato</Label>
                  <div className="mt-1">
                    <StatusBadge status={selectedWO.status} />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Titolo</Label>
                <p className="text-sm text-muted-foreground">{selectedWO.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.customers ? `${selectedWO.customers.name} (${selectedWO.customers.code})` : 'Non assegnato'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Tecnico</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.technician ? `${selectedWO.technician.first_name} ${selectedWO.technician.last_name} (${selectedWO.technician.employee_code})` : 'Non assegnato'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Priorità</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.priority === 'urgent' ? 'Urgente' :
                     selectedWO.priority === 'high' ? 'Alta' :
                     selectedWO.priority === 'medium' ? 'Media' : 'Bassa'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Distinta Base</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.boms ? `${selectedWO.boms.name} (${selectedWO.boms.version})` : 'Non assegnata'}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Inizio Pianificato</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.planned_start_date ? new Date(selectedWO.planned_start_date).toLocaleString() : 'Non impostato'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Fine Pianificata</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedWO.planned_end_date ? new Date(selectedWO.planned_end_date).toLocaleString() : 'Non impostato'}
                  </p>
                </div>
              </div>
              {selectedWO.notes && (
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <p className="text-sm text-muted-foreground">{selectedWO.notes}</p>
                </div>
              )}
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