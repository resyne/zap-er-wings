import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Calendar, User, Wrench, Eye, Edit, Factory, Trash2, ExternalLink, Archive } from "lucide-react";
import { Link } from "react-router-dom";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { useUndoableAction } from "@/hooks/useUndoableAction";

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  customer_id?: string;
  contact_id?: string;
  assigned_to?: string;
  priority?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  location?: string;
  equipment_needed?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  production_work_order_id?: string;
  sales_order_id?: string;
  lead_id?: string;
  archived?: boolean;
  customers?: {
    name: string;
    code: string;
  };
  crm_contacts?: {
    first_name: string;
    last_name: string;
    company_name?: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  production_work_order?: {
    id: string;
    number: string;
    status: string;
  };
  sales_orders?: {
    number: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
}

const statusColors = {
  to_do: "bg-blue-100 text-blue-800 border-blue-200",
  in_lavorazione: "bg-yellow-100 text-yellow-800 border-yellow-200",
  test: "bg-purple-100 text-purple-800 border-purple-200",
  pronti: "bg-orange-100 text-orange-800 border-orange-200",
  spediti_consegnati: "bg-green-100 text-green-800 border-green-200"
};

const statusLabels = {
  to_do: "Da Fare",
  in_lavorazione: "In Lavorazione",
  test: "Test",
  pronti: "Pronti",
  spediti_consegnati: "Spediti/Consegnati"
};

export default function WorkOrdersServicePage() {
  const [serviceWorkOrders, setServiceWorkOrders] = useState<ServiceWorkOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<ServiceWorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customer_id: "",
    assigned_to: "",
    priority: "medium",
    scheduled_date: "",
    estimated_hours: "",
    location: "",
    equipment_needed: "",
    notes: ""
  });
  const { toast } = useToast();
  const { executeWithUndo } = useUndoableAction();

  useEffect(() => {
    loadServiceWorkOrders();
    loadCustomers();
    loadContacts();
    loadTechnicians();
  }, []);

  const loadServiceWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('service_work_orders')
        .select(`
          *,
          customers (
            name,
            code
          ),
          crm_contacts (
            first_name,
            last_name,
            company_name
          ),
          sales_orders (
            number
          ),
          leads (
            id,
            company_name
          )
        `)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Manually join technician and production work order data
      const workOrdersWithRelations = await Promise.all(
        (data || []).map(async (wo: any) => {
          let result: any = { ...wo };
          
          // Load technician data
          if (wo.assigned_to) {
            const { data: techData } = await supabase
              .from('technicians')
              .select('id, first_name, last_name, employee_code')
              .eq('id', wo.assigned_to)
              .single();
            
            if (techData) result.technician = techData;
          }
          
          // Load production work order data
          if (wo.production_work_order_id) {
            const { data: prodData } = await supabase
              .from('work_orders')
              .select('id, number, status')
              .eq('id', wo.production_work_order_id)
              .single();
            
            if (prodData) result.production_work_order = prodData;
          }
          
          return result;
        })
      );

      setServiceWorkOrders(workOrdersWithRelations);
    } catch (error) {
      console.error('Error loading service work orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle commesse di lavoro",
        variant: "destructive",
      });
    }
  };

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, company_name, email, phone')
        .order('first_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const handleCustomerCreated = (newCustomer: { id: string; name: string; code: string }) => {
    setCustomers(prev => [...prev, newCustomer]);
    setFormData(prev => ({ ...prev, customer_id: newCustomer.id }));
    setShowCreateCustomer(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateWorkOrder = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        number: '', // Will be auto-generated by trigger
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        location: formData.location || null,
        equipment_needed: formData.equipment_needed || null,
        notes: formData.notes || null,
        status: 'to_do'
      };

      // Remove empty string values, replace with null
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === '') {
          insertData[key] = null;
        }
      });

      const { error } = await supabase
        .from('service_work_orders')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro creata con successo",
      });

      setFormData({
        title: "",
        description: "",
        customer_id: "",
        assigned_to: "",
        priority: "medium",
        scheduled_date: "",
        estimated_hours: "",
        location: "",
        equipment_needed: "",
        notes: ""
      });
      setShowCreateDialog(false);
      loadServiceWorkOrders();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'ordine di lavoro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditWorkOrder = async () => {
    if (!selectedWorkOrder || !formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        location: formData.location || null,
        equipment_needed: formData.equipment_needed || null,
        notes: formData.notes || null
      };

      // Remove empty string values, replace with null
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          updateData[key] = null;
        }
      });

      const { error } = await supabase
        .from('service_work_orders')
        .update(updateData)
        .eq('id', selectedWorkOrder.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro aggiornata con successo",
      });

      setShowEditDialog(false);
      loadServiceWorkOrders();
    } catch (error) {
      console.error('Error updating work order:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento della commessa di lavoro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWorkOrderStatus = async (workOrderId: string, newStatus: string) => {
    const workOrder = serviceWorkOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const previousStatus = workOrder.status;

    await executeWithUndo(
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ status: newStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ status: previousStatus as any })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      {
        duration: 10000,
        successMessage: "Stato aggiornato",
        errorMessage: "Errore nell'aggiornamento dello stato"
      }
    );
  };

  const handleArchive = async (workOrderId: string) => {
    const workOrder = serviceWorkOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const newArchivedStatus = !workOrder.archived;

    await executeWithUndo(
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ archived: newArchivedStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ archived: !newArchivedStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      {
        duration: 10000,
        successMessage: newArchivedStatus ? "Ordine archiviato" : "Ordine ripristinato",
        errorMessage: newArchivedStatus ? "Errore nell'archiviazione" : "Errore nel ripristino"
      }
    );
  };

  const handleDeleteWorkOrder = async (workOrderId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa commessa di lavoro? Questa azione non può essere annullata.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_work_orders')
        .delete()
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro eliminata con successo",
      });

      loadServiceWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la commessa di lavoro: " + error.message,
        variant: "destructive",
      });
    }
  };

  const filteredWorkOrders = serviceWorkOrders.filter(wo => {
    const matchesSearch = wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (wo.crm_contacts && 
                          `${wo.crm_contacts.first_name} ${wo.crm_contacts.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Commesse di Lavoro (CdL)</h1>
        <p className="text-muted-foreground">
          Pianifica e monitora le commesse di lavoro per l'assistenza tecnica. Per creare una nuova commessa, utilizza la sezione Ordini.
        </p>
      </div>

      {/* Filtri e Azioni */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Cerca commesse di lavoro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="to_do">Da Fare</SelectItem>
            <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
            <SelectItem value="test">Test</SelectItem>
            <SelectItem value="pronti">Pronti</SelectItem>
            <SelectItem value="spediti_consegnati">Spediti/Consegnati</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabella Commesse di Lavoro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Commesse di Lavoro ({filteredWorkOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Cliente/Contatto</TableHead>
                <TableHead>Ordine di Vendita</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Tecnico</TableHead>
                <TableHead>Priorità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Programmata</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nessuna commessa di lavoro trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((workOrder: any) => (
                  <TableRow key={workOrder.id}>
                     <TableCell>
                       <div className="space-y-1">
                         <div className="font-mono text-sm font-medium">
                           {workOrder.number}
                         </div>
                         {workOrder.production_work_order && (
                           <div className="flex items-center gap-1">
                             <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-700">
                               <Factory className="w-3 h-3 mr-1" />
                               Da OdP
                             </Badge>
                           </div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="space-y-1">
                         <div className="font-medium text-sm leading-tight">
                           {workOrder.title}
                         </div>
                         {workOrder.production_work_order && (
                           <div className="text-xs text-muted-foreground">
                             Correlato a: {workOrder.production_work_order.number}
                             <Badge variant="secondary" className="ml-1 text-xs">
                               {workOrder.production_work_order.status}
                             </Badge>
                           </div>
                         )}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="space-y-1">
                         {workOrder.customers ? (
                           <div className="text-sm">
                             <div className="font-medium">{workOrder.customers.name}</div>
                             <div className="text-xs text-muted-foreground">({workOrder.customers.code})</div>
                           </div>
                         ) : (
                           <span className="text-muted-foreground text-sm">—</span>
                         )}
                         {workOrder.crm_contacts && (
                           <div className="text-xs text-muted-foreground">
                             {workOrder.crm_contacts.first_name} {workOrder.crm_contacts.last_name}
                             {workOrder.crm_contacts.company_name && (
                               <div>{workOrder.crm_contacts.company_name}</div>
                             )}
                           </div>
                         )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {workOrder.sales_orders ? (
                          <Badge variant="outline">{workOrder.sales_orders.number}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {workOrder.leads ? (
                          <Link 
                            to={`/crm/opportunities?lead=${workOrder.lead_id}`}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {workOrder.leads.company_name}
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                       {workOrder.technician ? (
                         <div className="space-y-1">
                           <div className="text-sm font-medium">
                             {workOrder.technician.first_name} {workOrder.technician.last_name}
                           </div>
                           <div className="text-xs text-muted-foreground font-mono">
                             {workOrder.technician.employee_code}
                           </div>
                         </div>
                       ) : (
                         <span className="text-muted-foreground text-sm">Non assegnato</span>
                       )}
                     </TableCell>
                    <TableCell>
                      <Badge variant={workOrder.priority === 'urgent' ? 'destructive' : 
                                   workOrder.priority === 'high' ? 'default' :
                                   workOrder.priority === 'medium' ? 'secondary' : 'outline'}>
                        {workOrder.priority === 'urgent' ? 'Urgente' :
                         workOrder.priority === 'high' ? 'Alta' :
                         workOrder.priority === 'medium' ? 'Media' : 'Bassa'}
                      </Badge>
                    </TableCell>
                     <TableCell>
                       <Badge className={statusColors[workOrder.status as keyof typeof statusColors]}>
                         {statusLabels[workOrder.status as keyof typeof statusLabels]}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <div className="text-sm">
                         <div className="flex items-center gap-1 text-muted-foreground">
                           <Calendar className="w-3 h-3" />
                           {workOrder.scheduled_date ? (
                             <div>
                               <div>{new Date(workOrder.scheduled_date).toLocaleDateString('it-IT')}</div>
                               <div className="text-xs">
                                 {new Date(workOrder.scheduled_date).toLocaleTimeString('it-IT', { 
                                   hour: '2-digit', 
                                   minute: '2-digit' 
                                 })}
                               </div>
                             </div>
                           ) : (
                             'Non programmata'
                           )}
                         </div>
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="flex justify-end gap-1">
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                             setSelectedWorkOrder(workOrder);
                             setShowDetailsDialog(true);
                           }}
                           title="Visualizza dettagli"
                         >
                           <Eye className="w-4 h-4" />
                         </Button>
                         <Button
                           variant="ghost"
                           size="sm"
                           onClick={() => {
                             setSelectedWorkOrder(workOrder);
                             setFormData({
                               title: workOrder.title,
                               description: workOrder.description || "",
                               customer_id: workOrder.customer_id || "",
                               assigned_to: workOrder.assigned_to || "",
                               priority: workOrder.priority || "medium",
                               scheduled_date: workOrder.scheduled_date || "",
                               estimated_hours: workOrder.estimated_hours?.toString() || "",
                               location: workOrder.location || "",
                               equipment_needed: workOrder.equipment_needed || "",
                               notes: workOrder.notes || ""
                             });
                             setShowEditDialog(true);
                           }}
                            title="Modifica commessa di lavoro"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteWorkOrder(workOrder.id)}
                            title="Elimina commessa di lavoro"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                         </Button>
                         <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(workOrder.id)}
                            title="Archivia ordine"
                          >
                            <Archive className="w-4 h-4" />
                          </Button>
                       </div>
                     </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Dialog Dettagli */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Commessa di Lavoro</DialogTitle>
            <DialogDescription>
              {selectedWorkOrder?.number}
            </DialogDescription>
          </DialogHeader>
          {selectedWorkOrder && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Titolo</Label>
                <p className="text-base">{selectedWorkOrder.title}</p>
              </div>
              {selectedWorkOrder.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Descrizione</Label>
                  <p className="text-base">{selectedWorkOrder.description}</p>
                </div>
              )}
              {selectedWorkOrder.customers && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-base">{selectedWorkOrder.customers.name} ({selectedWorkOrder.customers.code})</p>
                </div>
              )}
              {selectedWorkOrder.leads && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Lead</Label>
                  <Link 
                    to={`/crm/opportunities?lead=${selectedWorkOrder.lead_id}`}
                    className="text-base text-primary hover:underline flex items-center gap-1 w-fit"
                  >
                    {selectedWorkOrder.leads.company_name}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Stato</Label>
                <div className="mt-1">
                  <Badge className={statusColors[selectedWorkOrder.status as keyof typeof statusColors]}>
                    {statusLabels[selectedWorkOrder.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </div>
              {selectedWorkOrder.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Note</Label>
                  <p className="text-base">{selectedWorkOrder.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data Creazione</Label>
                  <p className="text-base">{new Date(selectedWorkOrder.created_at).toLocaleDateString('it-IT')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Ultimo Aggiornamento</Label>
                  <p className="text-base">{new Date(selectedWorkOrder.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Modifica */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Commessa di Lavoro</DialogTitle>
            <DialogDescription>
              {selectedWorkOrder?.number} - Modifica i dettagli della commessa di lavoro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="edit_title">Titolo *</Label>
              <Input
                id="edit_title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Titolo della commessa di lavoro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_customer">Cliente</Label>
              <Select value={formData.customer_id} onValueChange={(value) => handleInputChange('customer_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_assigned_to">Assegnato a</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleInputChange('assigned_to', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tecnico..." />
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
                <Label htmlFor="edit_priority">Priorità</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
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
              <div className="space-y-2">
                <Label htmlFor="edit_estimated_hours">Ore Stimate</Label>
                <Input
                  id="edit_estimated_hours"
                  type="number"
                  step="0.5"
                  value={formData.estimated_hours}
                  onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
                  placeholder="8.0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_scheduled_date">Data Programmata Intervento</Label>
                <Input
                  id="edit_scheduled_date"
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_location">Ubicazione</Label>
                <Input
                  id="edit_location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Indirizzo o ubicazione dell'intervento"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_equipment_needed">Attrezzatura Necessaria</Label>
              <Textarea
                id="edit_equipment_needed"
                value={formData.equipment_needed}
                onChange={(e) => handleInputChange('equipment_needed', e.target.value)}
                placeholder="Strumenti e attrezzature necessarie..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Descrizione</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descrizione del lavoro da eseguire..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Note</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Note aggiuntive..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Annulla
              </Button>
              <Button onClick={handleEditWorkOrder} disabled={loading}>
                {loading ? "Salvando..." : "Salva Modifiche"}
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