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
import { Plus, Search, Calendar, User, Wrench, Eye, Edit } from "lucide-react";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  customer_id?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  customers?: {
    name: string;
    code: string;
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
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customer_id: "",
    notes: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadWorkOrders();
    loadCustomers();
  }, []);

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          customers (
            name,
            code
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error('Error loading work orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli ordini di lavoro",
        variant: "destructive",
      });
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
      // Generate work order number
      const woNumber = `WO-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const { error } = await supabase
        .from('work_orders')
        .insert({
          number: woNumber,
          title: formData.title,
          description: formData.description,
          customer_id: formData.customer_id || null,
          notes: formData.notes,
          status: 'planned' as const
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ordine di lavoro creato con successo",
      });

      setFormData({
        title: "",
        description: "",
        customer_id: "",
        notes: ""
      });
      setShowCreateDialog(false);
      loadWorkOrders();
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
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato dell'ordine di lavoro è stato aggiornato",
      });

      loadWorkOrders();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.customers?.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Ordini di Lavoro</h1>
        <p className="text-muted-foreground">
          Pianifica e monitora gli ordini di lavoro delle commesse
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
              <div className="space-y-2">
                <Label htmlFor="customer">Cliente</Label>
                <Select onValueChange={(value) => handleInputChange('customer_id', value)}>
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
                <TableHead>Cliente</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nessun ordine di lavoro trovato
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((workOrder) => (
                  <TableRow key={workOrder.id}>
                    <TableCell className="font-mono text-sm">
                      {workOrder.number}
                    </TableCell>
                    <TableCell className="font-medium">
                      {workOrder.title}
                    </TableCell>
                    <TableCell>
                      {workOrder.customers ? `${workOrder.customers.name} (${workOrder.customers.code})` : "—"}
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
                        {new Date(workOrder.created_at).toLocaleDateString('it-IT')}
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
    </div>
  );
}