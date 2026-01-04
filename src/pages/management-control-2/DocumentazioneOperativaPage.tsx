import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, getYear, getMonth } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Search, 
  FileText, 
  Truck, 
  Wrench, 
  Receipt, 
  CheckCircle2, 
  Clock,
  Calendar,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UnifiedDocument {
  id: string;
  type: "order" | "ddt" | "report";
  number: string;
  customer: string;
  date: string;
  amount: number | null;
  invoiced: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
  rawData: any;
}

const MONTH_NAMES = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
];

export default function DocumentazioneOperativaPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [invoiceFilter, setInvoiceFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());
  
  const [documents, setDocuments] = useState<UnifiedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<UnifiedDocument | null>(null);
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
      const [ordersRes, ddtsRes, reportsRes] = await Promise.all([
        supabase
          .from("sales_orders")
          .select(`
            id, number, customer_id, order_date, total_amount, 
            invoiced, invoice_date, invoice_number,
            customers(name)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("ddts")
          .select(`
            id, ddt_number, customer_id, created_at, ddt_data,
            invoiced, invoice_date, invoice_number,
            customers(name)
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("service_reports")
          .select(`
            id, intervention_date, total_amount, work_order_id,
            invoiced, invoice_date, invoice_number,
            service_work_orders(number, customers(name))
          `)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
      ]);

      const unifiedDocs: UnifiedDocument[] = [];

      // Process orders
      if (ordersRes.data) {
        ordersRes.data.forEach((order: any) => {
          unifiedDocs.push({
            id: order.id,
            type: "order",
            number: order.number || "-",
            customer: order.customers?.name || "-",
            date: order.order_date,
            amount: order.total_amount,
            invoiced: order.invoiced || false,
            invoice_number: order.invoice_number,
            invoice_date: order.invoice_date,
            rawData: order
          });
        });
      }

      // Process DDTs
      if (ddtsRes.data) {
        ddtsRes.data.forEach((ddt: any) => {
          const ddtData = ddt.ddt_data as { destinatario?: string; fornitore?: string; data?: string } | null;
          unifiedDocs.push({
            id: ddt.id,
            type: "ddt",
            number: ddt.ddt_number || "-",
            customer: ddt.customers?.name || ddtData?.destinatario || ddtData?.fornitore || "-",
            date: ddtData?.data || ddt.created_at,
            amount: null,
            invoiced: ddt.invoiced || false,
            invoice_number: ddt.invoice_number,
            invoice_date: ddt.invoice_date,
            rawData: ddt
          });
        });
      }

      // Process service reports
      if (reportsRes.data) {
        reportsRes.data.forEach((report: any) => {
          unifiedDocs.push({
            id: report.id,
            type: "report",
            number: report.service_work_orders?.number || "-",
            customer: report.service_work_orders?.customers?.name || "-",
            date: report.intervention_date,
            amount: report.total_amount,
            invoiced: report.invoiced || false,
            invoice_number: report.invoice_number,
            invoice_date: report.invoice_date,
            rawData: report
          });
        });
      }

      // Sort by date descending
      unifiedDocs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      setDocuments(unifiedDocs);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsInvoiced = (doc: UnifiedDocument) => {
    setSelectedDocument(doc);
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
      // Update the document as invoiced
      const table = selectedDocument.type === "order" 
        ? "sales_orders" 
        : selectedDocument.type === "ddt" 
          ? "ddts" 
          : "service_reports";

      await supabase
        .from(table)
        .update({
          invoiced: true,
          invoice_date: invoiceData.invoice_date,
          invoice_number: invoiceData.invoice_number
        })
        .eq("id", selectedDocument.id);
      
      // Create invoice record
      await supabase.from("customer_invoices").insert({
        invoice_number: invoiceData.invoice_number,
        customer_name: selectedDocument.customer,
        customer_id: selectedDocument.rawData.customer_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.invoice_date,
        amount: selectedDocument.amount || 0,
        total_amount: selectedDocument.amount || 0,
        status: "pending",
        notes: invoiceData.notes || `Fattura per ${getDocTypeLabel(selectedDocument.type)} ${selectedDocument.number}`
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

  const getDocTypeLabel = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return "Ordine";
      case "ddt": return "DDT";
      case "report": return "Rapporto";
    }
  };

  const getDocTypeIcon = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return <FileText className="h-4 w-4" />;
      case "ddt": return <Truck className="h-4 w-4" />;
      case "report": return <Wrench className="h-4 w-4" />;
    }
  };

  const getDocTypeBadgeColor = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return "bg-primary/10 text-primary";
      case "ddt": return "bg-blue-100 text-blue-700";
      case "report": return "bg-orange-100 text-orange-700";
    }
  };

  // Get available years from documents
  const availableYears = [...new Set(documents
    .filter(d => d.date)
    .map(d => getYear(new Date(d.date)))
  )].sort((a, b) => b - a);

  // Stats
  const stats = {
    total: documents.length,
    invoiced: documents.filter(d => d.invoiced).length,
    pending: documents.filter(d => !d.invoiced).length,
    orders: documents.filter(d => d.type === "order").length,
    ddts: documents.filter(d => d.type === "ddt").length,
    reports: documents.filter(d => d.type === "report").length
  };

  // Filters
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.customer?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === "all" || doc.type === typeFilter;
    const matchesInvoice = invoiceFilter === "all" || 
      (invoiceFilter === "invoiced" && doc.invoiced) ||
      (invoiceFilter === "pending" && !doc.invoiced);
    
    // Year filter
    let matchesYear = true;
    if (yearFilter !== "all" && doc.date) {
      matchesYear = getYear(new Date(doc.date)) === parseInt(yearFilter);
    }
    
    // Month filter
    let matchesMonth = true;
    if (monthFilter !== "all" && doc.date) {
      matchesMonth = getMonth(new Date(doc.date)) === parseInt(monthFilter);
    }
    
    return matchesSearch && matchesType && matchesInvoice && matchesYear && matchesMonth;
  });

  // Group documents by year and month
  const groupedDocuments = filteredDocuments.reduce((acc, doc) => {
    if (!doc.date) {
      const key = "senza-data";
      if (!acc[key]) acc[key] = { label: "Senza data", year: 0, month: -1, docs: [] };
      acc[key].docs.push(doc);
      return acc;
    }
    
    const date = new Date(doc.date);
    const year = getYear(date);
    const month = getMonth(date);
    const key = `${year}-${month}`;
    
    if (!acc[key]) {
      acc[key] = {
        label: `${MONTH_NAMES[month]} ${year}`,
        year,
        month,
        docs: []
      };
    }
    acc[key].docs.push(doc);
    return acc;
  }, {} as Record<string, { label: string; year: number; month: number; docs: UnifiedDocument[] }>);

  // Sort periods by date descending
  const sortedPeriods = Object.entries(groupedDocuments)
    .sort(([, a], [, b]) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });

  const togglePeriod = (key: string) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedPeriods(new Set(sortedPeriods.map(([key]) => key)));
  };

  const collapseAll = () => {
    setExpandedPeriods(new Set());
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "dd/MM/yyyy", { locale: it });
    } catch {
      return "-";
    }
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
            Collega le fatture ai documenti generati (ordini, DDT, rapporti di intervento)
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Da Fatturare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Fatturati
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.invoiced}</div>
          </CardContent>
        </Card>

        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Riepilogo Documenti</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-6 text-sm">
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {stats.orders} Ordini
              </span>
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-blue-500" />
                {stats.ddts} DDT
              </span>
              <span className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-orange-500" />
                {stats.reports} Rapporti
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca per numero o cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[140px]">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Anno" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli anni</SelectItem>
            {availableYears.map(year => (
              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Mese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i mesi</SelectItem>
            {MONTH_NAMES.map((name, idx) => (
              <SelectItem key={idx} value={idx.toString()}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo documento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="order">Ordini</SelectItem>
            <SelectItem value="ddt">DDT</SelectItem>
            <SelectItem value="report">Rapporti</SelectItem>
          </SelectContent>
        </Select>
        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Stato fatturazione" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="pending">Da fatturare</SelectItem>
            <SelectItem value="invoiced">Fatturati</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Expand/Collapse controls */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          Espandi tutti
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          Comprimi tutti
        </Button>
      </div>

      {/* Documents grouped by period */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Caricamento...
          </CardContent>
        </Card>
      ) : sortedPeriods.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nessun documento trovato
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedPeriods.map(([key, period]) => {
            const isExpanded = expandedPeriods.has(key);
            const pendingCount = period.docs.filter(d => !d.invoiced).length;
            const invoicedCount = period.docs.filter(d => d.invoiced).length;
            
            return (
              <Card key={key}>
                <Collapsible open={isExpanded} onOpenChange={() => togglePeriod(key)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-muted-foreground" />
                          )}
                          <Calendar className="h-5 w-5 text-primary" />
                          <CardTitle className="text-lg">{period.label}</CardTitle>
                          <Badge variant="secondary">{period.docs.length} documenti</Badge>
                        </div>
                        <div className="flex gap-2">
                          {pendingCount > 0 && (
                            <Badge variant="outline" className="text-yellow-600 border-yellow-300">
                              <Clock className="h-3 w-3 mr-1" />
                              {pendingCount} da fatturare
                            </Badge>
                          )}
                          {invoicedCount > 0 && (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {invoicedCount} fatturati
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="p-0 border-t">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Numero</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Importo</TableHead>
                            <TableHead>Fatturazione</TableHead>
                            <TableHead className="text-right">Azione</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {period.docs.map((doc) => (
                            <TableRow key={`${doc.type}-${doc.id}`}>
                              <TableCell>
                                <Badge variant="outline" className={getDocTypeBadgeColor(doc.type)}>
                                  <span className="flex items-center gap-1">
                                    {getDocTypeIcon(doc.type)}
                                    {getDocTypeLabel(doc.type)}
                                  </span>
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium">{doc.number}</TableCell>
                              <TableCell>{doc.customer}</TableCell>
                              <TableCell>{formatDate(doc.date)}</TableCell>
                              <TableCell>{formatCurrency(doc.amount)}</TableCell>
                              <TableCell>
                                {doc.invoiced ? (
                                  <div className="flex flex-col">
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 w-fit">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Fatturato
                                    </Badge>
                                    <span className="text-xs text-muted-foreground mt-1">
                                      {doc.invoice_number} - {formatDate(doc.invoice_date)}
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
                                {!doc.invoiced && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAsInvoiced(doc)}
                                  >
                                    <Receipt className="h-4 w-4 mr-1" />
                                    Registra Fattura
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })}
        </div>
      )}

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
                <p><strong>Documento:</strong> {getDocTypeLabel(selectedDocument.type)} {selectedDocument.number}</p>
                <p><strong>Cliente:</strong> {selectedDocument.customer}</p>
                <p><strong>Importo:</strong> {formatCurrency(selectedDocument.amount)}</p>
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
