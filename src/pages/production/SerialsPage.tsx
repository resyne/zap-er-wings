import { useState, useEffect } from "react";
import { Plus, Search, Filter, Download, Eye, Edit, FileText, TestTube } from "lucide-react";
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

interface Serial {
  id: string;
  serial_number: string;
  work_order_id: string;
  status: 'in_test' | 'approved' | 'rejected';
  test_result?: string;
  test_notes?: string;
  created_at: string;
  work_orders?: {
    number: string;
    title: string;
  };
}

export default function SerialsPage() {
  const [serials, setSerials] = useState<Serial[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [selectedSerial, setSelectedSerial] = useState<Serial | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    serial_number: "",
    work_order_id: "",
    test_result: "",
    test_notes: ""
  });

  const [bulkFormData, setBulkFormData] = useState({
    work_order_id: "",
    quantity: 1,
    prefix: "SN-"
  });

  useEffect(() => {
    fetchSerials();
    fetchWorkOrders();
  }, []);

  const fetchSerials = async () => {
    try {
      const { data, error } = await supabase
        .from('serials')
        .select(`
          *,
          work_orders(number, title)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSerials(data || []);
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
        .in('status', ['in_progress', 'testing'])
        .order('number');

      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching work orders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedSerial) {
        const { error } = await supabase
          .from('serials')
          .update({
            test_result: formData.test_result,
            test_notes: formData.test_notes,
            status: formData.test_result === 'PASS' ? 'approved' : formData.test_result === 'FAIL' ? 'rejected' : 'in_test'
          })
          .eq('id', selectedSerial.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Serial updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('serials')
          .insert([{ ...formData, status: 'in_test' }]);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Serial created successfully",
        });
      }

      setIsDialogOpen(false);
      setSelectedSerial(null);
      setFormData({ serial_number: "", work_order_id: "", test_result: "", test_notes: "" });
      fetchSerials();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serialsToCreate = [];
      for (let i = 1; i <= bulkFormData.quantity; i++) {
        const serialNumber = `${bulkFormData.prefix}${String(i).padStart(3, '0')}-${Date.now()}`;
        serialsToCreate.push({
          serial_number: serialNumber,
          work_order_id: bulkFormData.work_order_id,
          status: 'in_test'
        });
      }

      const { error } = await supabase
        .from('serials')
        .insert(serialsToCreate);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${bulkFormData.quantity} serials generated successfully`,
      });

      setIsBulkDialogOpen(false);
      setBulkFormData({ work_order_id: "", quantity: 1, prefix: "SN-" });
      fetchSerials();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (serial: Serial) => {
    setSelectedSerial(serial);
    setFormData({
      serial_number: serial.serial_number,
      work_order_id: serial.work_order_id,
      test_result: serial.test_result || "",
      test_notes: serial.test_notes || ""
    });
    setIsDialogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_test': return 'bg-warning';
      case 'approved': return 'bg-success';
      case 'rejected': return 'bg-destructive';
      default: return 'bg-muted';
    }
  };

  const filteredSerials = serials.filter(serial => {
    const matchesSearch = 
      serial.serial_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      serial.work_orders?.number.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || serial.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: serials.length,
    in_test: serials.filter(s => s.status === 'in_test').length,
    approved: serials.filter(s => s.status === 'approved').length,
    rejected: serials.filter(s => s.status === 'rejected').length,
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
          <BreadcrumbPage>Serials</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Serial Numbers</h1>
          <p className="text-muted-foreground">
            Track serialized units and quality testing
          </p>
        </div>
        <div className="flex space-x-2">
          <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Bulk Generate
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Bulk Generate Serials</DialogTitle>
                <DialogDescription>
                  Generate multiple serial numbers for a work order.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleBulkGenerate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk_work_order_id">Work Order *</Label>
                  <Select value={bulkFormData.work_order_id} onValueChange={(value) => setBulkFormData(prev => ({ ...prev, work_order_id: value }))}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefix">Prefix</Label>
                    <Input
                      id="prefix"
                      value={bulkFormData.prefix}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, prefix: e.target.value }))}
                      placeholder="SN-"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      max="100"
                      value={bulkFormData.quantity}
                      onChange={(e) => setBulkFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      required
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsBulkDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Generate {bulkFormData.quantity} Serials
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => { setSelectedSerial(null); setFormData({ serial_number: "", work_order_id: "", test_result: "", test_notes: "" }); }}>
                <Plus className="mr-2 h-4 w-4" />
                New Serial
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedSerial ? "Edit Serial" : "Create New Serial"}</DialogTitle>
                <DialogDescription>
                  {selectedSerial ? "Update serial test results." : "Add a new serial number."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="serial_number">Serial Number *</Label>
                  <Input
                    id="serial_number"
                    value={formData.serial_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                    placeholder="SN-001"
                    required
                    disabled={!!selectedSerial}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="work_order_id">Work Order *</Label>
                  <Select value={formData.work_order_id} onValueChange={(value) => setFormData(prev => ({ ...prev, work_order_id: value }))} disabled={!!selectedSerial}>
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
                  <Label htmlFor="test_result">Test Result</Label>
                  <Select value={formData.test_result} onValueChange={(value) => setFormData(prev => ({ ...prev, test_result: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select test result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PASS">PASS</SelectItem>
                      <SelectItem value="FAIL">FAIL</SelectItem>
                      <SelectItem value="PENDING">PENDING</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="test_notes">Test Notes</Label>
                  <Textarea
                    id="test_notes"
                    value={formData.test_notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, test_notes: e.target.value }))}
                    placeholder="Test observations and notes"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedSerial ? "Update" : "Create"} Serial
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  {status.replace('_', ' ')}
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
                placeholder="Search serials..."
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

      {/* Serials Table */}
      <Card>
        <CardHeader>
          <CardTitle>Serials ({filteredSerials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Test Result</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Loading serials...
                    </TableCell>
                  </TableRow>
                ) : filteredSerials.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      No serials found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSerials.map((serial) => (
                    <TableRow key={serial.id}>
                      <TableCell className="font-medium">{serial.serial_number}</TableCell>
                      <TableCell>
                        {serial.work_orders ? (
                          <div>
                            <div className="font-medium">{serial.work_orders.number}</div>
                            <div className="text-sm text-muted-foreground">{serial.work_orders.title}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">No WO</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={serial.status} />
                      </TableCell>
                      <TableCell>
                        {serial.test_result ? (
                          <Badge variant={serial.test_result === 'PASS' ? 'default' : 'destructive'}>
                            {serial.test_result}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Pending</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(serial.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(serial)}>
                            <TestTube className="h-4 w-4" />
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