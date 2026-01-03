import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Search, 
  FileText, 
  Truck, 
  Wrench, 
  Receipt, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus,
  ExternalLink
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "react-router-dom";

interface SalesOrder {
  id: string;
  number: string;
  customer_id: string | null;
  status: string | null;
  order_date: string | null;
  order_type: string | null;
  total_amount: number | null;
  invoiced: boolean | null;
  invoice_date: string | null;
  invoice_number: string | null;
  customers?: { name: string; code: string } | null;
}

interface DdtData {
  fornitore?: string;
  destinatario?: string;
  data?: string;
  stato?: string;
  scansionato?: boolean;
  [key: string]: unknown;
}

interface DDT {
  id: string;
  ddt_number: string;
  shipping_order_id: string | null;
  customer_id: string | null;
  created_at: string;
  ddt_data: DdtData | null;
  customers?: { name: string; code: string } | null;
  shipping_orders?: { number: string; status: string } | null;
}

interface ServiceReport {
  id: string;
  intervention_type: string | null;
  intervention_date: string | null;
  status: string | null;
  technician_name: string | null;
  amount: number | null;
  total_amount: number | null;
  work_order_id: string | null;
  service_work_orders?: { number: string; title: string; customers?: { name: string } | null } | null;
}

interface CustomerInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  amount: number;
  total_amount: number;
  status: string | null;
}

export default function DocumentazioneOperativaPage() {
  const [activeTab, setActiveTab] = useState("ordini");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [ddts, setDDTs] = useState<DDT[]>([]);
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
  const [invoices, setInvoices] = useState<CustomerInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<{ type: string; id: string; data: any } | null>(null);
  const [invoiceData, setInvoiceData] = useState({
    invoice_number: "",
    invoice_date: new Date().toISOString().split('T')[0],
    notes: ""
  });
  
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadOrders(),
        loadDDTs(),
        loadServiceReports(),
        loadInvoices()
      ]);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    const { data, error } = await supabase
      .from("sales_orders")
      .select(`
        id, number, customer_id, status, order_date, order_type, 
        total_amount, invoiced, invoice_date, invoice_number,
        customers(name, code)
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    setOrders(data || []);
  };

  const loadDDTs = async () => {
    const { data, error } = await supabase
      .from("ddts")
      .select(`
        id, ddt_number, shipping_order_id, customer_id, created_at, ddt_data,
        customers(name, code),
        shipping_orders(number, status)
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    setDDTs((data as DDT[]) || []);
  };

  const loadServiceReports = async () => {
    const { data, error } = await supabase
      .from("service_reports")
      .select(`
        id, intervention_type, intervention_date, status, technician_name,
        amount, total_amount, work_order_id,
        service_work_orders(number, title, customers(name))
      `)
      .order("created_at", { ascending: false });
    
    if (error) throw error;
    setServiceReports(data || []);
  };

  const loadInvoices = async () => {
    const { data, error } = await supabase
      .from("customer_invoices")
      .select("id, invoice_number, customer_name, invoice_date, amount, total_amount, status")
      .order("invoice_date", { ascending: false });
    
    if (error) throw error;
    setInvoices(data || []);
  };

  const handleMarkAsInvoiced = (type: string, id: string, data: any) => {
    setSelectedDocument({ type, id, data });
    setInvoiceData({
      invoice_number: "",
      invoice_date: new Date().toISOString().split('T')[0],
      notes: ""
    });
    setIsInvoiceDialogOpen(true);
  };

  const confirmInvoice = async () => {
    if (!selectedDocument || !invoiceData.invoice_number) {
      toast({
        title: "Errore",
        description: "Inserisci il numero fattura",
        variant: "destructive"
      });
      return;
    }

    try {
      if (selectedDocument.type === "order") {
        await supabase
          .from("sales_orders")
          .update({
            invoiced: true,
            invoice_date: invoiceData.invoice_date,
            invoice_number: invoiceData.invoice_number
          })
          .eq("id", selectedDocument.id);
      }
      
      // Crea anche una registrazione in customer_invoices
      const customerName = selectedDocument.type === "order" 
        ? selectedDocument.data.customers?.name 
        : selectedDocument.data.customers?.name || "Cliente";
      
      await supabase.from("customer_invoices").insert({
        invoice_number: invoiceData.invoice_number,
        customer_name: customerName,
        customer_id: selectedDocument.data.customer_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.invoice_date, // Default same as invoice date
        amount: selectedDocument.data.total_amount || 0,
        total_amount: selectedDocument.data.total_amount || 0,
        status: "pending",
        notes: invoiceData.notes || `Fattura per ${selectedDocument.type === "order" ? "ordine " + selectedDocument.data.number : selectedDocument.type === "ddt" ? "DDT " + selectedDocument.data.ddt_number : "rapporto intervento"}`
      });

      toast({
        title: "Fattura registrata",
        description: `Documento segnato come fatturato con numero ${invoiceData.invoice_number}`
      });

      setIsInvoiceDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Stats
  const ordersStats = {
    total: orders.length,
    invoiced: orders.filter(o => o.invoiced).length,
    pending: orders.filter(o => !o.invoiced).length
  };

  const ddtsStats = {
    total: ddts.length
  };

  const reportsStats = {
    total: serviceReports.length,
    completed: serviceReports.filter(r => r.status === "completed").length,
    pending: serviceReports.filter(r => r.status !== "completed").length
  };

  // Filters
  const filteredOrders = orders.filter(o => {
    const matchesSearch = !searchTerm || 
      o.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesInvoice = invoiceFilter === "all" || 
      (invoiceFilter === "invoiced" && o.invoiced) ||
      (invoiceFilter === "pending" && !o.invoiced);
    return matchesSearch && matchesStatus && matchesInvoice;
  });

  const filteredDDTs = ddts.filter(d => {
    return !searchTerm || 
      d.ddt_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.customers?.name?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredReports = serviceReports.filter(r => {
    const matchesSearch = !searchTerm || 
      r.technician_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.service_work_orders?.number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return format(new Date(date), "dd/MM/yyyy", { locale: it });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documentazione Operativa</h1>
          <p className="text-muted-foreground">
            Ordini, DDT e rapporti di intervento con tracciamento fatturazione
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Ordini
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ordersStats.total}</div>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {ordersStats.invoiced} fatturati
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                {ordersStats.pending} da fatturare
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Truck className="h-4 w-4 text-blue-500" />
              DDT
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{ddtsStats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Documenti di trasporto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wrench className="h-4 w-4 text-orange-500" />
              Rapporti Intervento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportsStats.total}</div>
            <div className="flex gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                {reportsStats.completed} completati
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-yellow-500" />
                {reportsStats.pending} in corso
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Receipt className="h-4 w-4 text-green-500" />
              Fatture Emesse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invoices.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Totale: {formatCurrency(invoices.reduce((sum, i) => sum + (i.total_amount || 0), 0))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero, cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stato fatturazione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="invoiced">Fatturati</SelectItem>
            <SelectItem value="pending">Da fatturare</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="ordini" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ordini ({filteredOrders.length})
          </TabsTrigger>
          <TabsTrigger value="ddt" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            DDT ({filteredDDTs.length})
          </TabsTrigger>
          <TabsTrigger value="rapporti" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Rapporti ({filteredReports.length})
          </TabsTrigger>
          <TabsTrigger value="fatture" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fatture ({invoices.length})
          </TabsTrigger>
        </TabsList>

        {/* Ordini Tab */}
        <TabsContent value="ordini">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Fatturazione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nessun ordine trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.number}</TableCell>
                        <TableCell>{order.customers?.name || "-"}</TableCell>
                        <TableCell>{formatDate(order.order_date)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.order_type || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatCurrency(order.total_amount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={order.status || "pending"} />
                        </TableCell>
                        <TableCell>
                          {order.invoiced ? (
                            <div className="flex flex-col">
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Fatturato
                              </Badge>
                              <span className="text-xs text-muted-foreground mt-1">
                                {order.invoice_number} - {formatDate(order.invoice_date)}
                              </span>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Da fatturare
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {!order.invoiced && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsInvoiced("order", order.id, order)}
                              >
                                <Receipt className="h-4 w-4 mr-1" />
                                Registra Fattura
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/crm/orders?id=${order.id}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
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
        </TabsContent>

        {/* DDT Tab */}
        <TabsContent value="ddt">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero DDT</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Ordine Spedizione</TableHead>
                    <TableHead>Stato Spedizione</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : filteredDDTs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nessun DDT trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDDTs.map((ddt) => (
                      <TableRow key={ddt.id}>
                        <TableCell className="font-medium">
                          {ddt.ddt_number}
                          {ddt.ddt_data?.scansionato && (
                            <Badge variant="outline" className="ml-2 text-xs">Scansionato</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {ddt.customers?.name || ddt.ddt_data?.destinatario || ddt.ddt_data?.fornitore || "-"}
                        </TableCell>
                        <TableCell>{formatDate(ddt.ddt_data?.data || ddt.created_at)}</TableCell>
                        <TableCell>{ddt.shipping_orders?.number || "-"}</TableCell>
                        <TableCell>
                          {ddt.shipping_orders?.status ? (
                            <StatusBadge status={ddt.shipping_orders.status} />
                          ) : ddt.ddt_data?.stato ? (
                            <Badge variant="outline">{ddt.ddt_data.stato}</Badge>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/warehouse/ddt?id=${ddt.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rapporti Tab */}
        <TabsContent value="rapporti">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ordine Lavoro</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tipo Intervento</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tecnico</TableHead>
                    <TableHead>Importo</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nessun rapporto trovato
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="font-medium">
                          {report.service_work_orders?.number || "-"}
                        </TableCell>
                        <TableCell>
                          {report.service_work_orders?.customers?.name || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{report.intervention_type || "-"}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(report.intervention_date)}</TableCell>
                        <TableCell>{report.technician_name || "-"}</TableCell>
                        <TableCell>{formatCurrency(report.total_amount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={report.status || "pending"} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {report.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleMarkAsInvoiced("report", report.id, report)}
                              >
                                <Receipt className="h-4 w-4 mr-1" />
                                Registra Fattura
                              </Button>
                            )}
                            <Button size="sm" variant="ghost" asChild>
                              <Link to={`/support/service-reports?id=${report.id}`}>
                                <ExternalLink className="h-4 w-4" />
                              </Link>
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
        </TabsContent>

        {/* Fatture Tab */}
        <TabsContent value="fatture">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Numero Fattura</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Imponibile</TableHead>
                    <TableHead>Totale</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Caricamento...
                      </TableCell>
                    </TableRow>
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nessuna fattura trovata
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                        <TableCell>{invoice.customer_name}</TableCell>
                        <TableCell>{formatDate(invoice.invoice_date)}</TableCell>
                        <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(invoice.total_amount)}</TableCell>
                        <TableCell>
                          <StatusBadge status={invoice.status || "pending"} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" asChild>
                            <Link to={`/finance/invoices?id=${invoice.id}`}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice Registration Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Fattura</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Numero Fattura *</Label>
              <Input
                placeholder="Es. FT-2026/001"
                value={invoiceData.invoice_number}
                onChange={(e) => setInvoiceData({ ...invoiceData, invoice_number: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fattura</Label>
              <Input
                type="date"
                value={invoiceData.invoice_date}
                onChange={(e) => setInvoiceData({ ...invoiceData, invoice_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                placeholder="Note aggiuntive..."
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
              />
            </div>
            {selectedDocument && (
              <div className="bg-muted p-3 rounded-lg text-sm">
                <p><strong>Documento:</strong> {selectedDocument.type === "order" ? `Ordine ${selectedDocument.data.number}` : selectedDocument.type === "ddt" ? `DDT ${selectedDocument.data.ddt_number}` : `Rapporto intervento`}</p>
                <p><strong>Importo:</strong> {formatCurrency(selectedDocument.data.total_amount)}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={confirmInvoice}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Conferma Fattura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
