import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, Play, TestTube, CheckCircle } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: 'planned' | 'in_progress' | 'testing' | 'closed';
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  notes?: string;
  boms?: {
    name: string;
    version: string;
  };
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    number: "",
    title: "",
    bom_id: "",
    planned_start_date: "",
    planned_end_date: "",
    notes: ""
  });

  useEffect(() => {
    fetchWorkOrders();
    fetchBoms();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          boms(name, version)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setWorkOrders(data || []);
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
        const { error } = await supabase
          .from('work_orders')
          .insert([{ ...formData, status: 'planned' }]);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Ordine di produzione creato con successo",
        });
      }

      setIsDialogOpen(false);
      setSelectedWO(null);
      setFormData({ number: "", title: "", bom_id: "", planned_start_date: "", planned_end_date: "", notes: "" });
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
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
            <Button onClick={() => { setSelectedWO(null); setFormData({ number: "", title: "", bom_id: "", planned_start_date: "", planned_end_date: "", notes: "" }); }}>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Ordine di Produzione
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{selectedWO ? "Modifica Ordine di Produzione" : "Crea Nuovo Ordine di Produzione"}</DialogTitle>
              <DialogDescription>
                {selectedWO ? "Aggiorna i dettagli dell'ordine di produzione qui sotto." : "Crea un nuovo ordine di produzione."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="number">Numero *</Label>
                  <Input
                    id="number"
                    value={formData.number}
                    onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                    placeholder="OdP-2024-001"
                    required
                  />
                </div>
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
              </div>
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
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtri
            </Button>
            <Button variant="outline" size="sm">
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
                  <TableHead>Distinta Base</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Inizio Pianificato</TableHead>
                  <TableHead>Fine Pianificata</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Caricamento ordini di produzione...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Nessun ordine di produzione trovato
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkOrders.map((wo) => (
                    <TableRow key={wo.id}>
                      <TableCell className="font-medium">{wo.number}</TableCell>
                      <TableCell>{wo.title}</TableCell>
                      <TableCell>
                        {wo.boms ? (
                          <Badge variant="outline">
                            {wo.boms.name} ({wo.boms.version})
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Nessuna Distinta Base</span>
                        )}
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
                      <TableCell>
                        {wo.planned_end_date ? 
          new Date(wo.planned_end_date).toLocaleDateString() : 
          <span className="text-muted-foreground">Non impostato</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm">
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
                          <Button variant="ghost" size="sm">
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
    </div>
  );
}