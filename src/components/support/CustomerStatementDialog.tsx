import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, Receipt } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Customer {
  id: string;
  name: string;
  company_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  tax_id?: string;
}

interface StatementReport {
  id: string;
  report_number?: string;
  intervention_date: string;
  intervention_type: string;
  amount: number | null;
  vat_rate: number | null;
  total_amount: number | null;
  payment_status: string;
  payment_date: string | null;
  invoiced: boolean;
  invoice_number: string | null;
  invoice_date: string | null;
  customer_invoice_id: string | null;
  technicians?: { first_name: string; last_name: string };
}

interface CustomerStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
}

const months = [
  { value: '1', label: 'Gennaio' }, { value: '2', label: 'Febbraio' },
  { value: '3', label: 'Marzo' }, { value: '4', label: 'Aprile' },
  { value: '5', label: 'Maggio' }, { value: '6', label: 'Giugno' },
  { value: '7', label: 'Luglio' }, { value: '8', label: 'Agosto' },
  { value: '9', label: 'Settembre' }, { value: '10', label: 'Ottobre' },
  { value: '11', label: 'Novembre' }, { value: '12', label: 'Dicembre' },
];

export function CustomerStatementDialog({ open, onOpenChange, customers }: CustomerStatementDialogProps) {
  const currentDate = new Date();
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentDate.getMonth() + 1));
  const [selectedYear, setSelectedYear] = useState<string>(String(currentDate.getFullYear()));
  const [reports, setReports] = useState<StatementReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [invoicingReportId, setInvoicingReportId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState('');
  const { toast } = useToast();

  const selectedCustomer = customers.find(c => c.id === selectedCustomerId);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => String(current - i));
  }, []);

  useEffect(() => {
    if (open && selectedCustomerId && selectedMonth && selectedYear) {
      loadReports();
    }
  }, [selectedCustomerId, selectedMonth, selectedYear, open]);

  const loadReports = async () => {
    if (!selectedCustomerId) return;
    setLoading(true);
    const month = parseInt(selectedMonth);
    const year = parseInt(selectedYear);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const { data } = await supabase
      .from('service_reports')
      .select(`
        id, report_number, intervention_date, intervention_type,
        amount, vat_rate, total_amount, payment_status, payment_date,
        invoiced, invoice_number, invoice_date, customer_invoice_id,
        technicians ( first_name, last_name )
      `)
      .eq('customer_id', selectedCustomerId)
      .gte('intervention_date', startDate)
      .lt('intervention_date', endDate)
      .order('intervention_date');

    setReports((data as unknown as StatementReport[]) || []);
    setLoading(false);
  };

  const togglePaymentStatus = async (reportId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pagato' ? 'non_pagato' : 'pagato';
    const paymentDate = newStatus === 'pagato' ? new Date().toISOString().split('T')[0] : null;
    
    await supabase
      .from('service_reports')
      .update({ payment_status: newStatus, payment_date: paymentDate })
      .eq('id', reportId);

    // If linked to scadenziario, update that too
    const report = reports.find(r => r.id === reportId);
    if (report?.customer_invoice_id) {
      await supabase
        .from('customer_invoices')
        .update({ 
          status: newStatus === 'pagato' ? 'paid' : 'pending',
          payment_date: paymentDate
        })
        .eq('id', report.customer_invoice_id);
    }
    
    setReports(prev => prev.map(r => 
      r.id === reportId ? { ...r, payment_status: newStatus, payment_date: paymentDate } : r
    ));
  };

  const markAsInvoiced = async (reportId: string) => {
    if (!invoiceNumber.trim()) {
      toast({ title: "Inserisci il numero fattura", variant: "destructive" });
      return;
    }

    const report = reports.find(r => r.id === reportId);
    if (!report || !selectedCustomer) return;

    const invoiceDate = new Date().toISOString().split('T')[0];
    const dueDate = invoiceDueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // Create entry in customer_invoices (scadenziario)
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('customer_invoices')
      .insert({
        invoice_number: invoiceNumber,
        customer_name: selectedCustomer.company_name || selectedCustomer.name,
        invoice_date: invoiceDate,
        due_date: dueDate,
        amount: Number(report.amount) || 0,
        tax_amount: Number(report.total_amount || 0) - Number(report.amount || 0),
        total_amount: Number(report.total_amount) || 0,
        status: report.payment_status === 'pagato' ? 'paid' : 'pending',
        payment_date: report.payment_status === 'pagato' ? report.payment_date : null,
        notes: `Rapporto intervento ${report.report_number || reportId}`
      })
      .select('id')
      .single();

    if (invoiceError) {
      toast({ title: "Errore creazione fattura nello scadenziario", description: invoiceError.message, variant: "destructive" });
      return;
    }

    // Update service_report
    await supabase
      .from('service_reports')
      .update({ 
        invoiced: true, 
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        customer_invoice_id: invoiceData.id
      })
      .eq('id', reportId);

    setReports(prev => prev.map(r => 
      r.id === reportId ? { ...r, invoiced: true, invoice_number: invoiceNumber, invoice_date: invoiceDate, customer_invoice_id: invoiceData.id } : r
    ));

    setInvoicingReportId(null);
    setInvoiceNumber('');
    setInvoiceDueDate('');
    toast({ title: "Rapporto segnato come fatturato e aggiunto allo scadenziario" });
  };

  const removeInvoice = async (reportId: string) => {
    const report = reports.find(r => r.id === reportId);
    
    // Remove from scadenziario if linked
    if (report?.customer_invoice_id) {
      await supabase.from('customer_invoices').delete().eq('id', report.customer_invoice_id);
    }

    await supabase
      .from('service_reports')
      .update({ invoiced: false, invoice_number: null, invoice_date: null, customer_invoice_id: null })
      .eq('id', reportId);

    setReports(prev => prev.map(r => 
      r.id === reportId ? { ...r, invoiced: false, invoice_number: null, invoice_date: null, customer_invoice_id: null } : r
    ));
    toast({ title: "Fatturazione rimossa" });
  };

  const totals = useMemo(() => {
    const netTotal = reports.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const grossTotal = reports.reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
    const paid = reports.filter(r => r.payment_status === 'pagato').reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
    const unpaid = grossTotal - paid;
    const invoicedTotal = reports.filter(r => r.invoiced).reduce((s, r) => s + (Number(r.total_amount) || 0), 0);
    const notInvoiced = grossTotal - invoicedTotal;
    return { netTotal, grossTotal, paid, unpaid, invoicedTotal, notInvoiced };
  }, [reports]);

  const monthLabel = months.find(m => m.value === selectedMonth)?.label || '';

  const generatePDF = () => {
    if (!selectedCustomer || reports.length === 0) return;
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setFont(undefined!, "bold");
    doc.text("ESTRATTO CONTO - RAPPORTI DI INTERVENTO", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setFont(undefined!, "normal");
    doc.text(`Periodo: ${monthLabel} ${selectedYear}`, 105, 28, { align: "center" });

    let y = 40;
    doc.setFont(undefined!, "bold");
    doc.text("Cliente:", 20, y);
    doc.setFont(undefined!, "normal");
    y += 6;
    doc.text(selectedCustomer.company_name || selectedCustomer.name, 20, y);
    if (selectedCustomer.company_name && selectedCustomer.name !== selectedCustomer.company_name) {
      y += 5; doc.text(`Rif: ${selectedCustomer.name}`, 20, y);
    }
    if (selectedCustomer.address) { y += 5; doc.text(selectedCustomer.address, 20, y); }
    if (selectedCustomer.tax_id) { y += 5; doc.text(`P.IVA/CF: ${selectedCustomer.tax_id}`, 20, y); }
    y += 10;

    const tableData = reports.map(r => [
      r.report_number || '-',
      new Date(r.intervention_date).toLocaleDateString('it-IT'),
      r.intervention_type,
      r.technicians ? `${r.technicians.first_name} ${r.technicians.last_name}` : '-',
      r.amount ? `€${Number(r.amount).toFixed(2)}` : '-',
      r.total_amount ? `€${Number(r.total_amount).toFixed(2)}` : '-',
      r.invoiced ? `Sì (${r.invoice_number})` : 'No',
      r.payment_status === 'pagato' ? 'Pagato' : 'Non Pagato',
    ]);

    autoTable(doc, {
      startY: y,
      head: [['N. Rapporto', 'Data', 'Tipo', 'Tecnico', 'Netto', 'Totale', 'Fatturato', 'Pagamento']],
      body: tableData,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [41, 65, 122], textColor: 255, fontStyle: 'bold' },
      columnStyles: {
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' },
        6: { halign: 'center' },
        7: { halign: 'center' },
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
    let ty = finalY + 10;
    doc.setFontSize(10);
    doc.setFont(undefined!, "bold");
    doc.text("Riepilogo:", 20, ty);
    doc.setFont(undefined!, "normal");
    ty += 7;
    doc.text(`Totale Netto: €${totals.netTotal.toFixed(2)}`, 20, ty); ty += 6;
    doc.text(`Totale Lordo: €${totals.grossTotal.toFixed(2)}`, 20, ty); ty += 6;
    doc.text(`Fatturato: €${totals.invoicedTotal.toFixed(2)}`, 20, ty); ty += 6;
    doc.text(`Non Fatturato: €${totals.notInvoiced.toFixed(2)}`, 20, ty); ty += 6;
    doc.text(`Pagato: €${totals.paid.toFixed(2)}`, 20, ty); ty += 6;
    doc.setFont(undefined!, "bold");
    doc.text(`Da Pagare: €${totals.unpaid.toFixed(2)}`, 20, ty);

    ty += 15;
    doc.setFontSize(8);
    doc.setFont(undefined!, "normal");
    doc.text(`Documento generato il ${new Date().toLocaleDateString('it-IT')}`, 105, ty, { align: "center" });

    const customerName = (selectedCustomer.company_name || selectedCustomer.name).replace(/\s+/g, '_');
    doc.save(`Estratto_Conto_${customerName}_${monthLabel}_${selectedYear}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Estratto Conto Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                <SelectTrigger><SelectValue placeholder="Seleziona cliente..." /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name || c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Mese</Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {months.map(m => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Anno</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {years.map(y => (
                    <SelectItem key={y} value={y}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reports table */}
          {!selectedCustomerId ? (
            <p className="text-sm text-muted-foreground text-center py-8">Seleziona un cliente per visualizzare i rapporti</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Caricamento...</p>
          ) : reports.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nessun rapporto trovato per il periodo selezionato</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2 border-b">N. Rapporto</th>
                      <th className="text-left p-2 border-b">Data</th>
                      <th className="text-left p-2 border-b">Tipo</th>
                      <th className="text-right p-2 border-b">Netto</th>
                      <th className="text-right p-2 border-b">Totale</th>
                      <th className="text-center p-2 border-b">Fatturato</th>
                      <th className="text-center p-2 border-b">Pagamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-mono text-xs">{r.report_number || '-'}</td>
                        <td className="p-2">{new Date(r.intervention_date).toLocaleDateString('it-IT')}</td>
                        <td className="p-2 capitalize">{r.intervention_type}</td>
                        <td className="p-2 text-right">{r.amount ? `€${Number(r.amount).toFixed(2)}` : '-'}</td>
                        <td className="p-2 text-right font-medium">{r.total_amount ? `€${Number(r.total_amount).toFixed(2)}` : '-'}</td>
                        <td className="p-2 text-center">
                          {r.invoiced ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge 
                                className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 cursor-pointer"
                                onClick={() => removeInvoice(r.id)}
                              >
                                <Receipt className="w-3 h-3 mr-1" />
                                {r.invoice_number}
                              </Badge>
                            </div>
                          ) : invoicingReportId === r.id ? (
                            <div className="flex flex-col gap-1.5 items-center">
                              <Input
                                placeholder="N. Fattura"
                                value={invoiceNumber}
                                onChange={e => setInvoiceNumber(e.target.value)}
                                className="h-7 text-xs w-28"
                              />
                              <Input
                                type="date"
                                placeholder="Scadenza"
                                value={invoiceDueDate}
                                onChange={e => setInvoiceDueDate(e.target.value)}
                                className="h-7 text-xs w-28"
                              />
                              <div className="flex gap-1">
                                <Button size="sm" variant="default" className="h-6 text-xs px-2" onClick={() => markAsInvoiced(r.id)}>
                                  Salva
                                </Button>
                                <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => { setInvoicingReportId(null); setInvoiceNumber(''); setInvoiceDueDate(''); }}>
                                  ✕
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Badge
                              variant="outline"
                              className="cursor-pointer hover:bg-muted"
                              onClick={() => { setInvoicingReportId(r.id); setInvoiceNumber(''); setInvoiceDueDate(''); }}
                            >
                              Non Fatturato
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <Badge
                            variant={r.payment_status === 'pagato' ? 'default' : 'destructive'}
                            className="cursor-pointer"
                            onClick={() => togglePaymentStatus(r.id, r.payment_status)}
                          >
                            {r.payment_status === 'pagato' ? 'Pagato' : 'Non Pagato'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Totale Netto</p>
                  <p className="font-semibold">€{totals.netTotal.toFixed(2)}</p>
                </div>
                <div className="bg-muted p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Totale Lordo</p>
                  <p className="font-semibold">€{totals.grossTotal.toFixed(2)}</p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Fatturato</p>
                  <p className="font-semibold text-blue-700 dark:text-blue-400">€{totals.invoicedTotal.toFixed(2)}</p>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Non Fatturato</p>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">€{totals.notInvoiced.toFixed(2)}</p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Pagato</p>
                  <p className="font-semibold text-green-700 dark:text-green-400">€{totals.paid.toFixed(2)}</p>
                </div>
                <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground">Da Pagare</p>
                  <p className="font-semibold text-red-700 dark:text-red-400">€{totals.unpaid.toFixed(2)}</p>
                </div>
              </div>

              {/* Export */}
              <Button onClick={generatePDF} className="w-full flex items-center gap-2">
                <Download className="w-4 h-4" />
                Scarica Estratto Conto PDF
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
