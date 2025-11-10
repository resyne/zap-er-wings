import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { formatAmount } from "@/lib/formatAmount";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { CreateCreditDialog } from "@/components/management-control/CreateCreditDialog";
import { CreateDebtDialog } from "@/components/management-control/CreateDebtDialog";
import { InvoiceDetailsDialog } from "@/components/management-control/InvoiceDetailsDialog";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Calendar,
  DollarSign,
  FileText,
  Search,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface CustomerInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  payment_date: string | null;
  aging_days: number | null;
}

interface SupplierInvoice {
  id: string;
  invoice_number: string;
  supplier_name: string;
  invoice_date: string;
  due_date: string;
  total_amount: number;
  status: string;
  payment_date: string | null;
  aging_days: number | null;
  category: string | null;
}

interface AgingBucket {
  range: string;
  credits: number;
  debts: number;
}

const CreditsDebtsPage = () => {
  const { hideAmounts } = useHideAmounts();
  const [loading, setLoading] = useState(true);
  const [customerInvoices, setCustomerInvoices] = useState<CustomerInvoice[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<SupplierInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agingFilter, setAgingFilter] = useState<string>("all");
  const [showCreateCreditDialog, setShowCreateCreditDialog] = useState(false);
  const [showCreateDebtDialog, setShowCreateDebtDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    id: string;
    type: 'customer' | 'supplier';
    number: string;
    amount: number;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<{
    id: string;
    type: 'customer' | 'supplier';
    number: string;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customerRes, supplierRes] = await Promise.all([
        supabase
          .from('customer_invoices')
          .select('*')
          .order('due_date', { ascending: false }),
        supabase
          .from('supplier_invoices')
          .select('*')
          .order('due_date', { ascending: false })
      ]);

      if (customerRes.error) throw customerRes.error;
      if (supplierRes.error) throw supplierRes.error;

      setCustomerInvoices(customerRes.data || []);
      setSupplierInvoices(supplierRes.data || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  // Calcola KPI
  const totalCredits = customerInvoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const totalDebts = supplierInvoices
    .filter(inv => inv.status !== 'paid')
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const overdueCredits = customerInvoices
    .filter(inv => inv.status === 'overdue' || (inv.aging_days && inv.aging_days > 0))
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const overdueDebts = supplierInvoices
    .filter(inv => inv.status === 'overdue' || (inv.aging_days && inv.aging_days > 0))
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const upcomingCredits = customerInvoices
    .filter(inv => {
      if (!inv.due_date || inv.status === 'paid') return false;
      const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    })
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  const upcomingDebts = supplierInvoices
    .filter(inv => {
      if (!inv.due_date || inv.status === 'paid') return false;
      const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    })
    .reduce((sum, inv) => sum + Number(inv.total_amount), 0);

  // Calcola aging buckets
  const agingBuckets: AgingBucket[] = [
    { range: "0-30gg", credits: 0, debts: 0 },
    { range: "31-60gg", credits: 0, debts: 0 },
    { range: "61-90gg", credits: 0, debts: 0 },
    { range: ">90gg", credits: 0, debts: 0 },
  ];

  customerInvoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = inv.aging_days || 0;
    if (days <= 30) agingBuckets[0].credits += Number(inv.total_amount);
    else if (days <= 60) agingBuckets[1].credits += Number(inv.total_amount);
    else if (days <= 90) agingBuckets[2].credits += Number(inv.total_amount);
    else agingBuckets[3].credits += Number(inv.total_amount);
  });

  supplierInvoices.forEach(inv => {
    if (inv.status === 'paid') return;
    const days = inv.aging_days || 0;
    if (days <= 30) agingBuckets[0].debts += Number(inv.total_amount);
    else if (days <= 60) agingBuckets[1].debts += Number(inv.total_amount);
    else if (days <= 90) agingBuckets[2].debts += Number(inv.total_amount);
    else agingBuckets[3].debts += Number(inv.total_amount);
  });

  const getStatusBadge = (status: string, agingDays: number | null) => {
    if (status === 'paid') return <Badge variant="outline" className="bg-green-50 text-green-700">Pagato</Badge>;
    if (status === 'overdue' || (agingDays && agingDays > 0)) return <Badge variant="destructive">Scaduto</Badge>;
    if (status === 'partial') return <Badge variant="secondary">Parziale</Badge>;
    return <Badge>In attesa</Badge>;
  };

  const filterInvoices = (invoices: any[], type: 'customer' | 'supplier') => {
    return invoices.filter(inv => {
      const matchesSearch = 
        inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (type === 'customer' ? inv.customer_name : inv.supplier_name).toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
      
      let matchesAging = true;
      if (agingFilter !== 'all' && inv.status !== 'paid') {
        const days = inv.aging_days || 0;
        switch(agingFilter) {
          case '0-30': matchesAging = days <= 30; break;
          case '31-60': matchesAging = days > 30 && days <= 60; break;
          case '61-90': matchesAging = days > 60 && days <= 90; break;
          case '>90': matchesAging = days > 90; break;
        }
      }
      
      return matchesSearch && matchesStatus && matchesAging;
    });
  };

  // Scadenziario unificato
  const unifiedSchedule = [
    ...customerInvoices
      .filter(inv => inv.status !== 'paid')
      .map(inv => ({
        date: inv.due_date,
        type: 'credit' as const,
        counterpart: inv.customer_name,
        description: `Fattura ${inv.invoice_number}`,
        amount: Number(inv.total_amount),
        status: inv.status,
        agingDays: inv.aging_days,
        isIncoming: true
      })),
    ...supplierInvoices
      .filter(inv => inv.status !== 'paid')
      .map(inv => ({
        date: inv.due_date,
        type: 'debt' as const,
        counterpart: inv.supplier_name,
        description: `Fattura ${inv.invoice_number}`,
        amount: Number(inv.total_amount),
        status: inv.status,
        agingDays: inv.aging_days,
        isIncoming: false
      }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const exportToExcel = () => {
    toast.info("Funzionalità di esportazione in sviluppo");
  };

  const handleDeleteClick = (id: string, type: 'customer' | 'supplier', number: string) => {
    setInvoiceToDelete({ id, type, number });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!invoiceToDelete) return;

    try {
      const table = invoiceToDelete.type === 'customer' ? 'customer_invoices' : 'supplier_invoices';
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', invoiceToDelete.id);

      if (error) throw error;

      toast.success(`${invoiceToDelete.type === 'customer' ? 'Credito' : 'Debito'} eliminato con successo`);
      loadData();
    } catch (error: any) {
      console.error('Error deleting invoice:', error);
      toast.error('Errore durante l\'eliminazione');
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Crediti e Debiti</h1>
          <p className="text-muted-foreground">
            Gestione crediti clienti, debiti fornitori e scadenze
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Aggiorna
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel}>
            <Download className="h-4 w-4 mr-2" />
            Esporta
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Crediti Attivi</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalCredits, hideAmounts)}</div>
            <p className="text-xs text-muted-foreground">
              {customerInvoices.filter(inv => inv.status !== 'paid').length} fatture
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Debiti Attivi</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalDebts, hideAmounts)}</div>
            <p className="text-xs text-muted-foreground">
              {supplierInvoices.filter(inv => inv.status !== 'paid').length} fatture
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scadenze 0-7 giorni</CardTitle>
            <Calendar className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entrate:</span>
                <span className="font-medium text-green-600">{formatAmount(upcomingCredits, hideAmounts)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uscite:</span>
                <span className="font-medium text-red-600">{formatAmount(upcomingDebts, hideAmounts)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Posizione Netta</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatAmount(totalCredits - totalDebts, hideAmounts)}</div>
            <p className="text-xs text-muted-foreground">
              {totalCredits > totalDebts ? 'Posizione positiva' : 'Posizione negativa'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alert per scaduti */}
      {(overdueCredits > 0 || overdueDebts > 0) && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
              <AlertTriangle className="h-5 w-5" />
              Alert Scadenze
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueCredits > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Crediti scaduti:</span>
                <span className="font-bold text-red-600">{formatAmount(overdueCredits, hideAmounts)}</span>
              </div>
            )}
            {overdueDebts > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-sm">Debiti scaduti:</span>
                <span className="font-bold text-red-600">{formatAmount(overdueDebts, hideAmounts)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Aging Report */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Report - Crediti vs Debiti</CardTitle>
          <CardDescription>Distribuzione per scadenza</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {agingBuckets.map((bucket, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between text-sm font-medium">
                  <span>{bucket.range}</span>
                  <div className="flex gap-4">
                    <span className="text-green-600">Crediti: {formatAmount(bucket.credits, hideAmounts)}</span>
                    <span className="text-red-600">Debiti: {formatAmount(bucket.debts, hideAmounts)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(100, (bucket.credits / (totalCredits || 1)) * 100)}%` }}
                    />
                  </div>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div 
                      className="bg-red-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(100, (bucket.debts / (totalDebts || 1)) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs per dettaglio */}
      <Tabs defaultValue="unified" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="unified">Scadenziario</TabsTrigger>
          <TabsTrigger value="credits">Crediti Clienti</TabsTrigger>
          <TabsTrigger value="debts">Debiti Fornitori</TabsTrigger>
          <TabsTrigger value="forecast">Previsioni Cassa</TabsTrigger>
        </TabsList>

        {/* Scadenziario Unificato */}
        <TabsContent value="unified" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scadenziario Unificato</CardTitle>
              <CardDescription>Tutte le scadenze future in ordine cronologico</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cerca per descrizione o contropartita..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Contropartita</TableHead>
                        <TableHead>Descrizione</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Giorni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unifiedSchedule
                        .filter(item => 
                          searchTerm === '' ||
                          item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.counterpart.toLowerCase().includes(searchTerm.toLowerCase())
                        )
                        .slice(0, 50)
                        .map((item, idx) => {
                          const daysUntilDue = Math.ceil((new Date(item.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                          return (
                            <TableRow key={idx}>
                              <TableCell>{format(new Date(item.date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                              <TableCell>
                                <Badge variant={item.type === 'credit' ? 'default' : 'secondary'}>
                                  {item.type === 'credit' ? 'Credito' : 'Debito'}
                                </Badge>
                              </TableCell>
                              <TableCell>{item.counterpart}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right">
                                <span className={item.isIncoming ? 'text-green-600' : 'text-red-600'}>
                                  {item.isIncoming ? '+' : '-'}{formatAmount(item.amount, hideAmounts)}
                                </span>
                              </TableCell>
                              <TableCell>{getStatusBadge(item.status, item.agingDays)}</TableCell>
                              <TableCell className="text-right">
                                <span className={daysUntilDue < 0 ? 'text-red-600 font-bold' : daysUntilDue <= 7 ? 'text-orange-600' : ''}>
                                  {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} in ritardo` : `${daysUntilDue} gg`}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Crediti Clienti */}
        <TabsContent value="credits" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Crediti Clienti</CardTitle>
                <CardDescription>Gestione fatture clienti e incassi</CardDescription>
              </div>
              <Button onClick={() => setShowCreateCreditDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Credito
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cerca per numero fattura o cliente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="pending">In attesa</SelectItem>
                      <SelectItem value="partial">Parziale</SelectItem>
                      <SelectItem value="paid">Pagato</SelectItem>
                      <SelectItem value="overdue">Scaduto</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={agingFilter} onValueChange={setAgingFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Aging" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="0-30">0-30 gg</SelectItem>
                      <SelectItem value="31-60">31-60 gg</SelectItem>
                      <SelectItem value="61-90">61-90 gg</SelectItem>
                      <SelectItem value=">90">&gt;90 gg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data Emissione</TableHead>
                        <TableHead>Scadenza</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Ritardo</TableHead>
                        <TableHead className="w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center">Caricamento...</TableCell>
                        </TableRow>
                      ) : filterInvoices(customerInvoices, 'customer').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            Nessun credito trovato
                          </TableCell>
                        </TableRow>
                      ) : (
                        filterInvoices(customerInvoices, 'customer').map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.customer_name}</TableCell>
                            <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                            <TableCell>{format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatAmount(invoice.total_amount, hideAmounts)}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.status, invoice.aging_days)}</TableCell>
                            <TableCell className="text-right">
                              {invoice.aging_days && invoice.aging_days > 0 ? (
                                <span className="text-red-600 font-bold">{invoice.aging_days} giorni</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedInvoice({
                                    id: invoice.id,
                                    type: 'customer',
                                    number: invoice.invoice_number,
                                    amount: invoice.total_amount
                                  })}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Dettagli
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(invoice.id, 'customer', invoice.invoice_number)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Debiti Fornitori */}
        <TabsContent value="debts" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Debiti Fornitori</CardTitle>
                <CardDescription>Gestione fatture fornitori e pagamenti</CardDescription>
              </div>
              <Button onClick={() => setShowCreateDebtDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nuovo Debito
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Cerca per numero fattura o fornitore..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Stato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="pending">Da pagare</SelectItem>
                      <SelectItem value="partial">Parziale</SelectItem>
                      <SelectItem value="paid">Pagato</SelectItem>
                      <SelectItem value="overdue">Scaduto</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={agingFilter} onValueChange={setAgingFilter}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Aging" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="0-30">0-30 gg</SelectItem>
                      <SelectItem value="31-60">31-60 gg</SelectItem>
                      <SelectItem value="61-90">61-90 gg</SelectItem>
                      <SelectItem value=">90">&gt;90 gg</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Numero</TableHead>
                        <TableHead>Fornitore</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Data Emissione</TableHead>
                        <TableHead>Scadenza</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead className="text-right">Ritardo</TableHead>
                        <TableHead className="w-[100px]">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loading ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center">Caricamento...</TableCell>
                        </TableRow>
                      ) : filterInvoices(supplierInvoices, 'supplier').length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground">
                            Nessun debito trovato
                          </TableCell>
                        </TableRow>
                      ) : (
                        filterInvoices(supplierInvoices, 'supplier').map((invoice) => (
                          <TableRow key={invoice.id}>
                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                            <TableCell>{invoice.supplier_name}</TableCell>
                            <TableCell>
                              {invoice.category && (
                                <Badge variant="outline">{invoice.category}</Badge>
                              )}
                            </TableCell>
                            <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                            <TableCell>{format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                            <TableCell className="text-right font-medium">
                              {formatAmount(invoice.total_amount, hideAmounts)}
                            </TableCell>
                            <TableCell>{getStatusBadge(invoice.status, invoice.aging_days)}</TableCell>
                            <TableCell className="text-right">
                              {invoice.aging_days && invoice.aging_days > 0 ? (
                                <span className="text-red-600 font-bold">{invoice.aging_days} giorni</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedInvoice({
                                    id: invoice.id,
                                    type: 'supplier',
                                    number: invoice.invoice_number,
                                    amount: invoice.total_amount
                                  })}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Dettagli
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteClick(invoice.id, 'supplier', invoice.invoice_number)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Previsioni Cassa */}
        <TabsContent value="forecast" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Previsioni Flusso di Cassa</CardTitle>
              <CardDescription>Proiezione entrate e uscite future</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Prossimi 30 giorni */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Prossimi 30 giorni</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Entrate previste</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatAmount(
                            customerInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 30;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Uscite previste</div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatAmount(
                            supplierInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 30;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Saldo previsto</div>
                        <div className="text-2xl font-bold">
                          {formatAmount(
                            customerInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 30;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0) -
                            supplierInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 30;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Prossimi 60 giorni */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Prossimi 60 giorni</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Entrate previste</div>
                        <div className="text-2xl font-bold text-green-600">
                          {formatAmount(
                            customerInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 60;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Uscite previste</div>
                        <div className="text-2xl font-bold text-red-600">
                          {formatAmount(
                            supplierInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 60;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground">Saldo previsto</div>
                        <div className="text-2xl font-bold">
                          {formatAmount(
                            customerInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 60;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0) -
                            supplierInvoices
                              .filter(inv => {
                                if (!inv.due_date || inv.status === 'paid') return false;
                                const daysUntilDue = Math.ceil((new Date(inv.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                return daysUntilDue >= 0 && daysUntilDue <= 60;
                              })
                              .reduce((sum, inv) => sum + Number(inv.total_amount), 0),
                            hideAmounts
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* KPI aggiuntivi */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">KPI</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground mb-2">DSO (Days Sales Outstanding)</div>
                        <div className="text-3xl font-bold">
                          {customerInvoices.filter(inv => inv.status !== 'paid').length > 0
                            ? Math.round(
                                customerInvoices
                                  .filter(inv => inv.status !== 'paid')
                                  .reduce((sum, inv) => sum + (inv.aging_days || 0), 0) /
                                customerInvoices.filter(inv => inv.status !== 'paid').length
                              )
                            : 0}{' '}
                          giorni
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Tempo medio di incasso crediti
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-sm text-muted-foreground mb-2">DPO (Days Payable Outstanding)</div>
                        <div className="text-3xl font-bold">
                          {supplierInvoices.filter(inv => inv.status !== 'paid').length > 0
                            ? Math.round(
                                supplierInvoices
                                  .filter(inv => inv.status !== 'paid')
                                  .reduce((sum, inv) => sum + (inv.aging_days || 0), 0) /
                                supplierInvoices.filter(inv => inv.status !== 'paid').length
                              )
                            : 0}{' '}
                          giorni
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Tempo medio di pagamento debiti
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateCreditDialog 
        open={showCreateCreditDialog} 
        onOpenChange={setShowCreateCreditDialog}
        onSuccess={loadData}
      />
      <CreateDebtDialog 
        open={showCreateDebtDialog} 
        onOpenChange={setShowCreateDebtDialog}
        onSuccess={loadData}
      />
      {selectedInvoice && (
        <InvoiceDetailsDialog
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
          invoiceId={selectedInvoice.id}
          invoiceType={selectedInvoice.type}
          invoiceNumber={selectedInvoice.number}
          totalAmount={selectedInvoice.amount}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare {invoiceToDelete?.type === 'customer' ? 'il credito' : 'il debito'} con numero fattura <strong>{invoiceToDelete?.number}</strong>?
              <br />
              Questa azione non può essere annullata e eliminerà anche tutti gli acconti e assegni associati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CreditsDebtsPage;
