import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, User, FileText } from "lucide-react";
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

interface RMA {
  id: string;
  rma_number: string;
  customer_id?: string;
  serial_id?: string;
  description: string;
  status: 'open' | 'analysis' | 'repaired' | 'closed';
  assigned_to?: string;
  resolution_notes?: string;
  opened_date: string;
  closed_date?: string;
  customers?: {
    name: string;
    code: string;
  };
  serials?: {
    serial_number: string;
  };
}

export default function RmaPage() {
  const [rmas, setRmas] = useState<RMA[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [serials, setSerials] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRma, setSelectedRma] = useState<RMA | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    rma_number: "",
    customer_id: "",
    serial_id: "",
    description: "",
    status: "open" as 'open' | 'analysis' | 'repaired' | 'closed',
    resolution_notes: ""
  });

  useEffect(() => {
    fetchRmas();
    fetchCustomers();
    fetchSerials();
  }, []);

  const fetchRmas = async () => {
    try {
      const { data, error } = await supabase
        .from('rma')
        .select(`
          *,
          customers(name, code),
          serials(serial_number)
        `)
        .order('opened_date', { ascending: false });

      if (error) throw error;
      setRmas(data || []);
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

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchSerials = async () => {
    try {
      const { data, error } = await supabase
        .from('serials')
        .select('id, serial_number')
        .eq('status', 'approved')
        .order('serial_number');

      if (error) throw error;
      setSerials(data || []);
    } catch (error: any) {
      console.error('Error fetching serials:', error);
    }
  };

  const generateRmaNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `RMA-${new Date().getFullYear()}-${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const dataToSubmit = {
        ...formData,
        rma_number: formData.rma_number || generateRmaNumber(),
        closed_date: formData.status === 'closed' ? new Date().toISOString() : undefined
      };

      if (selectedRma) {
        const { error } = await supabase
          .from('rma')
          .update(dataToSubmit)
          .eq('id', selectedRma.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "RMA updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('rma')
          .insert([dataToSubmit]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "RMA created successfully",
        });
      }

      setIsDialogOpen(false);
      setSelectedRma(null);
      setFormData({
        rma_number: "",
        customer_id: "",
        serial_id: "",
        description: "",
        status: "open" as 'open' | 'analysis' | 'repaired' | 'closed',
        resolution_notes: ""
      });
      fetchRmas();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (rma: RMA) => {
    setSelectedRma(rma);
    setFormData({
      rma_number: rma.rma_number,
      customer_id: rma.customer_id || "",
      serial_id: rma.serial_id || "",
      description: rma.description,
      status: rma.status,
      resolution_notes: rma.resolution_notes || ""
    });
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-info';
      case 'analysis': return 'bg-warning';
      case 'repaired': return 'bg-primary';
      case 'closed': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const filteredRmas = rmas.filter(rma => {
    const matchesSearch = 
      rma.rma_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rma.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rma.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rma.serials?.serial_number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || rma.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: rmas.length,
    open: rmas.filter(r => r.status === 'open').length,
    analysis: rmas.filter(r => r.status === 'analysis').length,
    repaired: rmas.filter(r => r.status === 'repaired').length,
    closed: rmas.filter(r => r.status === 'closed').length,
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
            <BreadcrumbLink href="/mfg">Production</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>RMA</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Return Merchandise Authorization</h1>
          <p className="text-muted-foreground">
            Manage product returns and repair requests
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setSelectedRma(null); setFormData({ rma_number: "", customer_id: "", serial_id: "", description: "", status: "open", resolution_notes: "" }); }}>
              <Plus className="mr-2 h-4 w-4" />
              New RMA
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRma ? "Edit RMA" : "Create New RMA"}</DialogTitle>
              <DialogDescription>
                {selectedRma ? "Update the RMA details and status." : "Create a new return merchandise authorization."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rma_number">RMA Number</Label>
                  <Input
                    id="rma_number"
                    value={formData.rma_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, rma_number: e.target.value }))}
                    placeholder="Auto-generated if empty"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="analysis">Analysis</SelectItem>
                      <SelectItem value="repaired">Repaired</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_id">Customer</Label>
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData(prev => ({ ...prev, customer_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
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
                  <Label htmlFor="serial_id">Serial Number</Label>
                  <Select value={formData.serial_id} onValueChange={(value) => setFormData(prev => ({ ...prev, serial_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select serial" />
                    </SelectTrigger>
                    <SelectContent>
                      {serials.map((serial) => (
                        <SelectItem key={serial.id} value={serial.id}>
                          {serial.serial_number}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Problem Description *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe the issue or reason for return"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="resolution_notes">Resolution Notes</Label>
                <Textarea
                  id="resolution_notes"
                  value={formData.resolution_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, resolution_notes: e.target.value }))}
                  placeholder="Actions taken or planned to resolve the issue"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {selectedRma ? "Update" : "Create"} RMA
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
                  {status}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
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
                placeholder="Search RMAs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filters
            </Button>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RMA Table */}
      <Card>
        <CardHeader>
          <CardTitle>RMAs ({filteredRmas.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RMA Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Loading RMAs...
                    </TableCell>
                  </TableRow>
                ) : filteredRmas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      No RMAs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRmas.map((rma) => (
                    <TableRow key={rma.id}>
                      <TableCell className="font-medium">{rma.rma_number}</TableCell>
                      <TableCell>
                        {rma.customers ? (
                          <div>
                            <div className="font-medium">{rma.customers.name}</div>
                            <div className="text-sm text-muted-foreground">{rma.customers.code}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No customer</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {rma.serials ? (
                          <Badge variant="outline">{rma.serials.serial_number}</Badge>
                        ) : (
                          <span className="text-muted-foreground">No serial</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={rma.description}>
                          {rma.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={rma.status} />
                      </TableCell>
                      <TableCell>
                        {new Date(rma.opened_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(rma)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <User className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <FileText className="h-4 w-4" />
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