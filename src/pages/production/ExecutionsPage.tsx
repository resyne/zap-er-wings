import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Play, Square, Clock, User, Eye, BarChart3 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
}

interface Execution {
  id: string;
  work_order_id: string;
  step_name: string;
  operator_id?: string;
  start_time: string;
  end_time?: string;
  notes?: string;
  work_orders?: {
    number: string;
    title: string;
  };
}

export default function ExecutionsPage() {
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    work_order_id: "",
    step_name: "",
    operator_id: "",
    start_time: new Date().toISOString().slice(0, 16),
    notes: ""
  });

  useEffect(() => {
    fetchExecutions();
    fetchWorkOrders();
    fetchTechnicians();
  }, []);

  const fetchExecutions = async () => {
    try {
      const { data, error } = await supabase
        .from('executions')
        .select(`
          *,
          work_orders(number, title)
        `)
        .order('start_time', { ascending: false });

      if (error) throw error;
      setExecutions(data || []);
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

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, number, title')
        .in('status', ['to_do', 'in_lavorazione', 'test'])
        .order('number');

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
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
      console.error('Error fetching technicians:', error);
    }
  };

  const handleStartExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('executions')
        .insert([{
          ...formData,
          operator_id: formData.operator_id || null
        }]);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Esecuzione avviata con successo",
      });

      setIsDialogOpen(false);
      setFormData({
        work_order_id: "",
        step_name: "",
        operator_id: "",
        start_time: new Date().toISOString().slice(0, 16),
        notes: ""
      });
      fetchExecutions();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleStopExecution = async (executionId: string) => {
    try {
      const { error } = await supabase
        .from('executions')
        .update({ end_time: new Date().toISOString() })
        .eq('id', executionId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Esecuzione completata con successo",
      });
      fetchExecutions();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateDuration = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = 
      execution.work_orders?.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      execution.step_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "active" && !execution.end_time) ||
      (filterStatus === "completed" && execution.end_time);
    
    const matchesWorkOrder = selectedWorkOrder === "all" || 
      execution.work_order_id === selectedWorkOrder;
    
    return matchesSearch && matchesStatus && matchesWorkOrder;
  });

  const activeExecutions = executions.filter(e => !e.end_time).length;
  const completedExecutions = executions.filter(e => e.end_time).length;
  
  const totalDuration = filteredExecutions
    .filter(e => e.end_time)
    .reduce((acc, e) => {
      const start = new Date(e.start_time);
      const end = new Date(e.end_time!);
      return acc + (end.getTime() - start.getTime());
    }, 0);
  
  const formatTotalDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  // Raggruppa esecuzioni per ordine di produzione
  const executionsByWorkOrder = filteredExecutions.reduce((acc, execution) => {
    const woId = execution.work_order_id;
    if (!acc[woId]) {
      acc[woId] = [];
    }
    acc[woId].push(execution);
    return acc;
  }, {} as Record<string, Execution[]>);

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
            <BreadcrumbLink href="/mfg">Production</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Executions</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Esecuzioni Produzione</h1>
          <p className="text-muted-foreground">
            Tracciamento fasi produttive e tempi lavorazione
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Avvia Esecuzione
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Avvia Nuova Esecuzione</DialogTitle>
              <DialogDescription>
                Inizia a tracciare il tempo per una fase di produzione.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStartExecution} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="work_order_id">Ordine di Produzione *</Label>
                <Select value={formData.work_order_id} onValueChange={(value) => setFormData(prev => ({ ...prev, work_order_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ordine" />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id}>
                        {wo.number} - {wo.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="step_name">Fase/Attività *</Label>
                <Input
                  id="step_name"
                  value={formData.step_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_name: e.target.value }))}
                  placeholder="es. Assemblaggio Componente A"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operator_id">Operatore</Label>
                <Select value={formData.operator_id} onValueChange={(value) => setFormData(prev => ({ ...prev, operator_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona operatore (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name} ({tech.employee_code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Orario Inizio *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Note opzionali sull'esecuzione..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit">
                  <Play className="mr-2 h-4 w-4" />
                  Avvia
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{activeExecutions}</div>
                <div className="text-sm text-muted-foreground">In Corso</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Square className="h-5 w-5 text-green-500" />
              <div>
                <div className="text-2xl font-bold">{completedExecutions}</div>
                <div className="text-sm text-muted-foreground">Completate</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{Object.keys(executionsByWorkOrder).length}</div>
                <div className="text-sm text-muted-foreground">Ordini Attivi</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{formatTotalDuration(totalDuration)}</div>
                <div className="text-sm text-muted-foreground">Tempo Totale</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Cerca esecuzioni..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={selectedWorkOrder} onValueChange={setSelectedWorkOrder}>
              <SelectTrigger>
                <SelectValue placeholder="Ordine Produzione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli ordini</SelectItem>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="active">In corso</SelectItem>
                <SelectItem value="completed">Completate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Executions Table con Tabs */}
      <Tabs defaultValue="timeline" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="timeline">Vista Timeline</TabsTrigger>
          <TabsTrigger value="grouped">Per Ordine</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Esecuzioni ({filteredExecutions.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ordine</TableHead>
                      <TableHead>Fase</TableHead>
                      <TableHead>Operatore</TableHead>
                      <TableHead>Inizio</TableHead>
                      <TableHead>Fine</TableHead>
                      <TableHead>Durata</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Caricamento esecuzioni...
                        </TableCell>
                      </TableRow>
                    ) : filteredExecutions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          Nessuna esecuzione trovata
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredExecutions.map((execution) => {
                        const operator = technicians.find(t => t.id === execution.operator_id);
                        return (
                          <TableRow key={execution.id}>
                            <TableCell>
                              {execution.work_orders ? (
                                <div>
                                  <div className="font-medium">{execution.work_orders.number}</div>
                                  <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                                    {execution.work_orders.title}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{execution.step_name}</TableCell>
                            <TableCell>
                              {operator ? (
                                <div className="text-sm">
                                  {operator.first_name} {operator.last_name}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {new Date(execution.start_time).toLocaleDateString('it-IT')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(execution.start_time).toLocaleTimeString('it-IT', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </TableCell>
                            <TableCell>
                              {execution.end_time ? (
                                <>
                                  <div className="text-sm">
                                    {new Date(execution.end_time).toLocaleDateString('it-IT')}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {new Date(execution.end_time).toLocaleTimeString('it-IT', { 
                                      hour: '2-digit', 
                                      minute: '2-digit' 
                                    })}
                                  </div>
                                </>
                              ) : (
                                <Badge variant="secondary">In Corso</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono">
                                {calculateDuration(execution.start_time, execution.end_time)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {execution.end_time ? (
                                <Badge variant="default" className="bg-green-600">
                                  Completata
                                </Badge>
                              ) : (
                                <Badge variant="default" className="bg-orange-600 animate-pulse">
                                  In Corso
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedExecution(execution)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!execution.end_time && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleStopExecution(execution.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Square className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grouped" className="mt-6">
          <div className="space-y-4">
            {Object.entries(executionsByWorkOrder).map(([woId, execs]) => {
              const wo = workOrders.find(w => w.id === woId);
              const totalWoDuration = execs
                .filter(e => e.end_time)
                .reduce((acc, e) => {
                  const start = new Date(e.start_time);
                  const end = new Date(e.end_time!);
                  return acc + (end.getTime() - start.getTime());
                }, 0);

              return (
                <Card key={woId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">
                          {wo?.number || 'Ordine Sconosciuto'}
                        </CardTitle>
                        <CardDescription>{wo?.title}</CardDescription>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground">Tempo Totale</div>
                          <div className="text-lg font-bold">{formatTotalDuration(totalWoDuration)}</div>
                        </div>
                        <Badge variant="outline">
                          {execs.length} {execs.length === 1 ? 'esecuzione' : 'esecuzioni'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {execs.map((exec) => {
                        const operator = technicians.find(t => t.id === exec.operator_id);
                        return (
                          <div 
                            key={exec.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1">
                              <div className="font-medium">{exec.step_name}</div>
                              {operator && (
                                <div className="text-sm text-muted-foreground">
                                  {operator.first_name} {operator.last_name}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="text-sm text-right">
                                <div className="text-muted-foreground">
                                  {new Date(exec.start_time).toLocaleDateString('it-IT', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </div>
                                {exec.end_time && (
                                  <div className="text-xs text-muted-foreground">
                                    → {new Date(exec.end_time).toLocaleTimeString('it-IT', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </div>
                                )}
                              </div>
                              <Badge variant="outline" className="font-mono">
                                {calculateDuration(exec.start_time, exec.end_time)}
                              </Badge>
                              {exec.end_time ? (
                                <Badge className="bg-green-600">Completata</Badge>
                              ) : (
                                <Badge className="bg-orange-600 animate-pulse">In Corso</Badge>
                              )}
                              <div className="flex items-center space-x-1">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setSelectedExecution(exec)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                {!exec.end_time && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleStopExecution(exec.id)}
                                    className="text-red-600 hover:text-red-700"
                                  >
                                    <Square className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {Object.keys(executionsByWorkOrder).length === 0 && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Nessuna esecuzione trovata
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Execution Details Dialog */}
      <Dialog open={!!selectedExecution} onOpenChange={(open) => !open && setSelectedExecution(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Dettagli Esecuzione</DialogTitle>
            <DialogDescription>
              Informazioni complete sull'esecuzione
            </DialogDescription>
          </DialogHeader>
          {selectedExecution && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Ordine di Produzione</Label>
                  <div className="font-medium">{selectedExecution.work_orders?.number}</div>
                  <div className="text-sm text-muted-foreground">
                    {selectedExecution.work_orders?.title}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fase</Label>
                  <div className="font-medium">{selectedExecution.step_name}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Operatore</Label>
                  <div className="font-medium">
                    {(() => {
                      const operator = technicians.find(t => t.id === selectedExecution.operator_id);
                      return operator 
                        ? `${operator.first_name} ${operator.last_name}`
                        : 'Non assegnato';
                    })()}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stato</Label>
                  <div>
                    {selectedExecution.end_time ? (
                      <Badge className="bg-green-600">Completata</Badge>
                    ) : (
                      <Badge className="bg-orange-600">In Corso</Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Inizio</Label>
                  <div className="font-medium">
                    {new Date(selectedExecution.start_time).toLocaleString('it-IT')}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fine</Label>
                  <div className="font-medium">
                    {selectedExecution.end_time 
                      ? new Date(selectedExecution.end_time).toLocaleString('it-IT')
                      : 'In corso...'}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Durata</Label>
                <div className="text-2xl font-bold font-mono">
                  {calculateDuration(selectedExecution.start_time, selectedExecution.end_time)}
                </div>
              </div>

              {selectedExecution.notes && (
                <div>
                  <Label className="text-muted-foreground">Note</Label>
                  <div className="mt-1 p-3 rounded-md bg-muted text-sm">
                    {selectedExecution.notes}
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-4">
                {!selectedExecution.end_time && (
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      handleStopExecution(selectedExecution.id);
                      setSelectedExecution(null);
                    }}
                  >
                    <Square className="mr-2 h-4 w-4" />
                    Completa Esecuzione
                  </Button>
                )}
                <Button 
                  variant="outline"
                  onClick={() => setSelectedExecution(null)}
                >
                  Chiudi
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}