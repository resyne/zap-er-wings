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
import { Plus, Search, Calendar, User, Wrench, Eye, Edit, Factory } from "lucide-react";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  customer_id?: string;
  contact_id?: string;
  priority?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  location?: string;
  equipment_needed?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  customers?: {
    name: string;
    code: string;
  };
  crm_contacts?: {
    first_name: string;
    last_name: string;
    company_name?: string;
  };
}

const statusColors = {
  planned: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  testing: "bg-purple-100 text-purple-800",
  closed: "bg-green-100 text-green-800"
};

const statusLabels = {
  planned: "Pianificato",
  in_progress: "In Corso",
  testing: "Test",
  closed: "Chiuso"
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
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customer_id: "",
    contact_id: "",
    assigned_to: "",
    priority: "medium",
    scheduled_date: "",
    estimated_hours: "",
    location: "",
    equipment_needed: "",
    notes: ""
  });
  const { toast } = useToast();

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
          technicians (
            first_name,
            last_name,
            employee_code
          ),
          work_orders!production_work_order_id (
            id,
            number,
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setServiceWorkOrders(data || []);
    } catch (error) {
      console.error('Error loading service work orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli ordini di lavoro",
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
        .from('companies')
        .select('id, name, code')
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
        contact_id: formData.contact_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        location: formData.location || null,
        equipment_needed: formData.equipment_needed || null,
        notes: formData.notes || null,
        status: 'planned'
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
        description: "Ordine di lavoro creato con successo",
      });

      setFormData({
        title: "",
        description: "",
        customer_id: "",
        contact_id: "",
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

  const updateWorkOrderStatus = async (workOrderId: string, newStatus: 'planned' | 'in_progress' | 'testing' | 'closed') => {
    try {
      const { error } = await supabase
        .from('service_work_orders')
        .update({ status: newStatus })
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato dell'ordine di lavoro è stato aggiornato",
      });

      loadServiceWorkOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Ordini di Lavoro (OdL)</h1>
        <p className="text-muted-foreground">
          Pianifica e monitora gli ordini di lavoro per l'assistenza tecnica
        </p>
      </div>

      {/* Filtri e Azioni */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Cerca ordini di lavoro..."
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
            <SelectItem value="planned">Pianificato</SelectItem>
            <SelectItem value="in_progress">In Corso</SelectItem>
            <SelectItem value="testing">Test</SelectItem>
            <SelectItem value="closed">Chiuso</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Ordine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Ordine di Lavoro</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli per il nuovo ordine di lavoro
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titolo *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Titolo dell'ordine di lavoro"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">Cliente</Label>
                  <div className="flex gap-2">
                    <Select value={formData.customer_id} onValueChange={(value) => handleInputChange('customer_id', value)}>
                      <SelectTrigger className="flex-1">
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
                  <Label htmlFor="contact">Contatto</Label>
                  <Select value={formData.contact_id} onValueChange={(value) => handleInputChange('contact_id', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un contatto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name}
                          {contact.company_name && ` - ${contact.company_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assegnato a</Label>
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
                  <Label htmlFor="priority">Priorità</Label>
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
                  <Label htmlFor="estimated_hours">Ore Stimate</Label>
                  <Input
                    id="estimated_hours"
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
                  <Label htmlFor="scheduled_date">Data Programmata</Label>
                  <Input
                    id="scheduled_date"
                    type="datetime-local"
                    value={formData.scheduled_date}
                    onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="location">Ubicazione</Label>
                  <Input
                    id="location"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    placeholder="Indirizzo o ubicazione dell'intervento"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="equipment_needed">Attrezzatura Necessaria</Label>
                <Textarea
                  id="equipment_needed"
                  value={formData.equipment_needed}
                  onChange={(e) => handleInputChange('equipment_needed', e.target.value)}
                  placeholder="Strumenti e attrezzature necessarie..."
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrizione del lavoro da eseguire..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateWorkOrder} disabled={loading}>
                  {loading ? "Creando..." : "Crea Ordine"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabella Ordini di Lavoro */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Ordini di Lavoro ({filteredWorkOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Cliente/Contatto</TableHead>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nessun ordine di lavoro trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((workOrder: any) => (
                  <TableRow key={workOrder.id}>
                    <TableCell className="font-mono text-sm">
                      <div className="flex items-center gap-2">
                        {workOrder.number}
                        {workOrder.work_orders && workOrder.work_orders.length > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            <Factory className="w-3 h-3 mr-1" />
                            Da Produzione
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {workOrder.title}
                    </TableCell>
                    <TableCell>
                      <div>
                        {workOrder.customers ? `${workOrder.customers.name} (${workOrder.customers.code})` : "—"}
                        {workOrder.crm_contacts && (
                          <div className="text-sm text-muted-foreground">
                            {workOrder.crm_contacts.first_name} {workOrder.crm_contacts.last_name}
                            {workOrder.crm_contacts.company_name && ` - ${workOrder.crm_contacts.company_name}`}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {workOrder.technicians ? (
                        <div>
                          <div className="font-medium">{workOrder.technicians.first_name} {workOrder.technicians.last_name}</div>
                          <div className="text-sm text-muted-foreground">({workOrder.technicians.employee_code})</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
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
                      <Select
                        value={workOrder.status}
                        onValueChange={(value) => updateWorkOrderStatus(workOrder.id, value as 'planned' | 'in_progress' | 'testing' | 'closed')}
                      >
                        <SelectTrigger className="w-auto h-auto p-0 border-0 bg-transparent">
                          <Badge className={statusColors[workOrder.status as keyof typeof statusColors]}>
                            {statusLabels[workOrder.status as keyof typeof statusLabels]}
                          </Badge>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planned">Pianificato</SelectItem>
                          <SelectItem value="in_progress">In Corso</SelectItem>
                          <SelectItem value="testing">Test</SelectItem>
                          <SelectItem value="closed">Chiuso</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {workOrder.scheduled_date ? 
                          new Date(workOrder.scheduled_date).toLocaleDateString('it-IT') + ' ' +
                          new Date(workOrder.scheduled_date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                          : 'Non programmata'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedWorkOrder(workOrder);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
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
            <DialogTitle>Dettagli Ordine di Lavoro</DialogTitle>
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

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}