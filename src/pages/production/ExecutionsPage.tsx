import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Play, Square, Clock, User } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
        title: "Error",
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
        .in('status', ['planned', 'in_progress', 'testing'])
        .order('number');

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
    }
  };

  const handleStartExecution = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('executions')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Execution started successfully",
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
        title: "Error",
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
        title: "Success",
        description: "Execution stopped successfully",
      });
      fetchExecutions();
    } catch (error: any) {
      toast({
        title: "Error",
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
    
    return matchesSearch && matchesStatus;
  });

  const activeExecutions = executions.filter(e => !e.end_time).length;
  const completedExecutions = executions.filter(e => e.end_time).length;

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
          <h1 className="text-3xl font-bold tracking-tight">Production Executions</h1>
          <p className="text-muted-foreground">
            Track production steps and operator time
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Play className="mr-2 h-4 w-4" />
              Start Execution
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Start New Execution</DialogTitle>
              <DialogDescription>
                Begin tracking time for a production step.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleStartExecution} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="work_order_id">Work Order *</Label>
                <Select value={formData.work_order_id} onValueChange={(value) => setFormData(prev => ({ ...prev, work_order_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select work order" />
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
                <Label htmlFor="step_name">Step/Phase *</Label>
                <Input
                  id="step_name"
                  value={formData.step_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, step_name: e.target.value }))}
                  placeholder="e.g., Assembly Phase 1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Start Time *</Label>
                <Input
                  id="start_time"
                  type="datetime-local"
                  value={formData.start_time}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Optional notes about this execution"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Start Execution
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <div>
                <div className="text-2xl font-bold">{activeExecutions}</div>
                <div className="text-sm text-muted-foreground">Active Executions</div>
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
                <div className="text-sm text-muted-foreground">Completed Today</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{executions.length}</div>
                <div className="text-sm text-muted-foreground">Total Executions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Search & Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search executions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Executions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Executions ({filteredExecutions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Step/Phase</TableHead>
                  <TableHead>Start Time</TableHead>
                  <TableHead>End Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading executions...
                    </TableCell>
                  </TableRow>
                ) : filteredExecutions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No executions found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredExecutions.map((execution) => (
                    <TableRow key={execution.id}>
                      <TableCell>
                        {execution.work_orders ? (
                          <div>
                            <div className="font-medium">{execution.work_orders.number}</div>
                            <div className="text-sm text-muted-foreground">{execution.work_orders.title}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No WO</span>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">{execution.step_name}</TableCell>
                      <TableCell>
                        {new Date(execution.start_time).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {execution.end_time ? 
                          new Date(execution.end_time).toLocaleString() : 
                          <Badge variant="secondary">In Progress</Badge>
                        }
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {calculateDuration(execution.start_time, execution.end_time)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {execution.end_time ? (
                          <Badge variant="default" className="bg-success text-success-foreground">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="default" className="bg-warning text-warning-foreground animate-pulse">
                            Active
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          {!execution.end_time && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleStopExecution(execution.id)}
                            >
                              <Square className="h-4 w-4" />
                            </Button>
                          )}
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