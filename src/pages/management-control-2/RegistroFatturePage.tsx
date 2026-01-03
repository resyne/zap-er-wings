import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  Plus, 
  FileCheck, 
  Link as LinkIcon, 
  Search, 
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  CheckCircle2,
  Clock,
  Receipt
} from "lucide-react";

interface InvoiceRegistry {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'vendita' | 'acquisto' | 'nota_credito';
  subject_type: 'cliente' | 'fornitore';
  subject_id: string | null;
  subject_name: string;
  imponibile: number;
  iva_rate: number;
  iva_amount: number;
  total_amount: number;
  vat_regime: 'domestica_imponibile' | 'ue_non_imponibile' | 'extra_ue' | 'reverse_charge';
  status: 'bozza' | 'registrata';
  financial_status: 'da_incassare' | 'da_pagare' | 'incassata' | 'pagata';
  due_date: string | null;
  payment_date: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  accounting_entry_id: string | null;
  scadenza_id: string | null;
  prima_nota_id: string | null;
  notes: string | null;
  created_at: string;
  registered_at: string | null;
}

type InvoiceType = 'vendita' | 'acquisto' | 'nota_credito';
type SubjectType = 'cliente' | 'fornitore';
type VatRegime = 'domestica_imponibile' | 'ue_non_imponibile' | 'extra_ue' | 'reverse_charge';
type FinancialStatus = 'da_incassare' | 'da_pagare' | 'incassata' | 'pagata';

interface FormData {
  invoice_number: string;
  invoice_date: string;
  invoice_type: InvoiceType;
  subject_type: SubjectType;
  subject_name: string;
  imponibile: number;
  iva_rate: number;
  vat_regime: VatRegime;
  financial_status: FinancialStatus;
  due_date: string;
  payment_date: string;
  notes: string;
}

const initialFormData: FormData = {
  invoice_number: '',
  invoice_date: format(new Date(), 'yyyy-MM-dd'),
  invoice_type: 'vendita',
  subject_type: 'cliente',
  subject_name: '',
  imponibile: 0,
  iva_rate: 22,
  vat_regime: 'domestica_imponibile',
  financial_status: 'da_incassare',
  due_date: '',
  payment_date: '',
  notes: ''
};

export default function RegistroFatturePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRegistry | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoice-registry', filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('invoice_registry')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (filterType !== 'all') {
        query = query.eq('invoice_type', filterType);
      }
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as InvoiceRegistry[];
    }
  });

  const calculateAmounts = (imponibile: number, ivaRate: number) => {
    const ivaAmount = imponibile * (ivaRate / 100);
    const totalAmount = imponibile + ivaAmount;
    return { ivaAmount, totalAmount };
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { ivaAmount, totalAmount } = calculateAmounts(data.imponibile, data.iva_rate);
      const { data: user } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('invoice_registry')
        .insert({
          invoice_number: data.invoice_number,
          invoice_date: data.invoice_date,
          invoice_type: data.invoice_type,
          subject_type: data.subject_type,
          subject_name: data.subject_name,
          imponibile: data.imponibile,
          iva_rate: data.iva_rate,
          iva_amount: ivaAmount,
          total_amount: totalAmount,
          vat_regime: data.vat_regime,
          status: 'bozza',
          financial_status: data.financial_status,
          due_date: data.due_date || null,
          payment_date: data.payment_date || null,
          notes: data.notes || null,
          created_by: user?.user?.id
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Fattura salvata come bozza');
      setShowCreateDialog(false);
      setFormData(initialFormData);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
    },
    onError: (error) => {
      toast.error('Errore nel salvataggio: ' + error.message);
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (invoice: InvoiceRegistry) => {
      const { data: user } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      const { data: accountingEntry, error: accountingError } = await supabase
        .from('accounting_entries')
        .insert({
          amount: invoice.total_amount,
          imponibile: invoice.imponibile,
          iva_amount: invoice.iva_amount,
          iva_aliquota: invoice.iva_rate,
          direction: invoice.invoice_type === 'acquisto' ? 'out' : 'in',
          document_type: 'fattura',
          document_date: invoice.invoice_date,
          status: 'classificato',
          financial_status: invoice.financial_status,
          subject_type: invoice.subject_type,
          attachment_url: '',
          user_id: user?.user?.id
        })
        .select()
        .single();

      if (accountingError) throw accountingError;

      const { data: primaNota, error: primaNotaError } = await supabase
        .from('prima_nota')
        .insert({
          competence_date: invoice.invoice_date,
          movement_type: invoice.invoice_type === 'acquisto' ? 'uscita' : 'entrata',
          description: `Fattura ${invoice.invoice_number} - ${invoice.subject_name}`,
          amount: invoice.total_amount,
          imponibile: invoice.imponibile,
          iva_amount: invoice.iva_amount,
          iva_aliquota: invoice.iva_rate,
          payment_method: 'bonifico',
          status: invoice.financial_status === 'incassata' || invoice.financial_status === 'pagata' ? 'confermato' : 'in_attesa',
          accounting_entry_id: accountingEntry.id
        })
        .select()
        .single();

      if (primaNotaError) throw primaNotaError;

      let scadenzaId = null;
      if (invoice.financial_status === 'da_incassare' || invoice.financial_status === 'da_pagare') {
        const { data: scadenza, error: scadenzaError } = await supabase
          .from('scadenze')
          .insert({
            tipo: invoice.invoice_type === 'acquisto' ? 'debito' : 'credito',
            soggetto_nome: invoice.subject_name,
            soggetto_tipo: invoice.subject_type,
            note: `Fattura ${invoice.invoice_number}`,
            importo_totale: invoice.total_amount,
            importo_residuo: invoice.total_amount,
            data_documento: invoice.invoice_date,
            data_scadenza: invoice.due_date || invoice.invoice_date,
            stato: 'aperta',
            evento_id: accountingEntry.id,
            prima_nota_id: primaNota.id
          })
          .select()
          .single();

        if (scadenzaError) throw scadenzaError;
        scadenzaId = scadenza.id;
      }

      if (invoice.invoice_type === 'vendita' || invoice.invoice_type === 'nota_credito') {
        await supabase.from('customer_invoices').insert({
          invoice_number: invoice.invoice_number,
          customer_name: invoice.subject_name,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date || invoice.invoice_date,
          amount: invoice.imponibile,
          tax_amount: invoice.iva_amount,
          total_amount: invoice.total_amount,
          status: invoice.financial_status === 'incassata' ? 'pagato' : 'in_attesa'
        });
      } else {
        await supabase.from('supplier_invoices').insert({
          invoice_number: invoice.invoice_number,
          supplier_name: invoice.subject_name,
          invoice_date: invoice.invoice_date,
          due_date: invoice.due_date || invoice.invoice_date,
          amount: invoice.imponibile,
          tax_amount: invoice.iva_amount,
          total_amount: invoice.total_amount,
          status: invoice.financial_status === 'pagata' ? 'pagato' : 'in_attesa',
          category: 'fattura'
        });
      }

      const { error: updateError } = await supabase
        .from('invoice_registry')
        .update({
          status: 'registrata',
          registered_at: now,
          registered_by: user?.user?.id,
          accounting_entry_id: accountingEntry.id,
          prima_nota_id: primaNota.id,
          scadenza_id: scadenzaId
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Fattura registrata! Evento contabile, Prima Nota e Scadenza creati.');
      setShowRegisterDialog(false);
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
    },
    onError: (error) => {
      toast.error('Errore nella registrazione: ' + error.message);
    }
  });

  const handleFormChange = (field: string, value: string | number) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'invoice_type') {
        updated.subject_type = value === 'acquisto' ? 'fornitore' : 'cliente';
        updated.financial_status = value === 'acquisto' ? 'da_pagare' : 'da_incassare';
      }
      return updated;
    });
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.subject_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    bozze: invoices.filter(i => i.status === 'bozza').length,
    registrate: invoices.filter(i => i.status === 'registrata').length,
    daIncassare: invoices.filter(i => i.financial_status === 'da_incassare').reduce((sum, i) => sum + i.total_amount, 0),
    daPagare: invoices.filter(i => i.financial_status === 'da_pagare').reduce((sum, i) => sum + i.total_amount, 0)
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'vendita':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><ArrowUpRight className="w-3 h-3 mr-1" />Vendita</Badge>;
      case 'acquisto':
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><ArrowDownLeft className="w-3 h-3 mr-1" />Acquisto</Badge>;
      case 'nota_credito':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Receipt className="w-3 h-3 mr-1" />Nota Credito</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    return status === 'registrata' 
      ? <Badge className="bg-primary/20 text-primary border-primary/30"><CheckCircle2 className="w-3 h-3 mr-1" />Registrata</Badge>
      : <Badge variant="outline" className="border-muted-foreground/30"><Clock className="w-3 h-3 mr-1" />Bozza</Badge>;
  };

  const getFinancialStatusBadge = (status: string) => {
    switch (status) {
      case 'da_incassare':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Da Incassare</Badge>;
      case 'da_pagare':
        return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Da Pagare</Badge>;
      case 'incassata':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Incassata</Badge>;
      case 'pagata':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Pagata</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVatRegimeLabel = (regime: string) => {
    switch (regime) {
      case 'domestica_imponibile': return 'Domestica Imponibile';
      case 'ue_non_imponibile': return 'UE Non Imponibile';
      case 'extra_ue': return 'Extra-UE';
      case 'reverse_charge': return 'Reverse Charge';
      default: return regime;
    }
  };

  const { ivaAmount, totalAmount } = calculateAmounts(formData.imponibile, formData.iva_rate);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Registro Fatture</h1>
          <p className="text-muted-foreground">Gestione fiscale e contabile delle fatture</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuova Fattura
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bozze</p>
                <p className="text-2xl font-bold">{stats.bozze}</p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Registrate</p>
                <p className="text-2xl font-bold">{stats.registrate}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Da Incassare</p>
                <p className="text-2xl font-bold text-blue-500">€{stats.daIncassare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
              </div>
              <ArrowUpRight className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Da Pagare</p>
                <p className="text-2xl font-bold text-orange-500">€{stats.daPagare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
              </div>
              <ArrowDownLeft className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca per numero fattura o soggetto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i tipi</SelectItem>
                <SelectItem value="vendita">Vendita</SelectItem>
                <SelectItem value="acquisto">Acquisto</SelectItem>
                <SelectItem value="nota_credito">Nota Credito</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="bozza">Bozza</SelectItem>
                <SelectItem value="registrata">Registrata</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Soggetto</TableHead>
                <TableHead>Regime IVA</TableHead>
                <TableHead className="text-right">Imponibile</TableHead>
                <TableHead className="text-right">IVA</TableHead>
                <TableHead className="text-right">Totale</TableHead>
                <TableHead>Stato Doc.</TableHead>
                <TableHead>Stato Fin.</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8">Caricamento...</TableCell>
                </TableRow>
              ) : filteredInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    Nessuna fattura trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                    <TableCell>{getTypeBadge(invoice.invoice_type)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{invoice.subject_name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{invoice.subject_type}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{getVatRegimeLabel(invoice.vat_regime)}</span>
                    </TableCell>
                    <TableCell className="text-right">€{invoice.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right text-muted-foreground">€{invoice.iva_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell className="text-right font-semibold">€{invoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>{getFinancialStatusBadge(invoice.financial_status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {invoice.status === 'bozza' && (
                          <Button 
                            size="sm" 
                            onClick={() => {
                              setSelectedInvoice(invoice);
                              setShowRegisterDialog(true);
                            }}
                          >
                            <FileCheck className="w-4 h-4 mr-1" />
                            Registra
                          </Button>
                        )}
                        {invoice.scadenza_id && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.location.href = '/management-control-2/scadenziario'}
                          >
                            <LinkIcon className="w-4 h-4 mr-1" />
                            Scadenza
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuova Fattura</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numero Fattura *</Label>
              <Input
                value={formData.invoice_number}
                onChange={(e) => handleFormChange('invoice_number', e.target.value)}
                placeholder="FT-2026/001"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fattura *</Label>
              <Input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => handleFormChange('invoice_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={formData.invoice_type} onValueChange={(v) => handleFormChange('invoice_type', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendita">Vendita</SelectItem>
                  <SelectItem value="acquisto">Acquisto</SelectItem>
                  <SelectItem value="nota_credito">Nota Credito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Soggetto ({formData.subject_type === 'cliente' ? 'Cliente' : 'Fornitore'}) *</Label>
              <Input
                value={formData.subject_name}
                onChange={(e) => handleFormChange('subject_name', e.target.value)}
                placeholder="Nome soggetto"
              />
            </div>
            <div className="space-y-2">
              <Label>Imponibile *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.imponibile}
                onChange={(e) => handleFormChange('imponibile', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Aliquota IVA %</Label>
              <Select value={formData.iva_rate.toString()} onValueChange={(v) => handleFormChange('iva_rate', parseFloat(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="22">22%</SelectItem>
                  <SelectItem value="10">10%</SelectItem>
                  <SelectItem value="4">4%</SelectItem>
                  <SelectItem value="0">0% (Esente)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Regime IVA</Label>
              <Select value={formData.vat_regime} onValueChange={(v) => handleFormChange('vat_regime', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestica_imponibile">Domestica Imponibile</SelectItem>
                  <SelectItem value="ue_non_imponibile">UE Non Imponibile</SelectItem>
                  <SelectItem value="extra_ue">Extra-UE</SelectItem>
                  <SelectItem value="reverse_charge">Reverse Charge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Stato Finanziario</Label>
              <Select value={formData.financial_status} onValueChange={(v) => handleFormChange('financial_status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="da_incassare">Da Incassare</SelectItem>
                  <SelectItem value="da_pagare">Da Pagare</SelectItem>
                  <SelectItem value="incassata">Incassata</SelectItem>
                  <SelectItem value="pagata">Pagata</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Scadenza</Label>
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleFormChange('due_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input
                type="date"
                value={formData.payment_date}
                onChange={(e) => handleFormChange('payment_date', e.target.value)}
              />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Note</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => handleFormChange('notes', e.target.value)}
                placeholder="Note aggiuntive..."
              />
            </div>
          </div>

          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Imponibile</p>
                  <p className="font-medium">€{formData.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">IVA ({formData.iva_rate}%)</p>
                  <p className="font-medium">€{ivaAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Totale</p>
                  <p className="text-xl font-bold text-primary">€{totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.invoice_number || !formData.subject_name || createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvataggio...' : 'Salva Bozza'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Registra Fattura
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-500">Attenzione</p>
                    <p className="text-sm text-muted-foreground">
                      Registrando questa fattura, il sistema creerà automaticamente:
                    </p>
                    <ul className="text-sm text-muted-foreground mt-2 list-disc list-inside space-y-1">
                      <li>Evento contabile</li>
                      <li>Prima Nota</li>
                      {(selectedInvoice.financial_status === 'da_incassare' || selectedInvoice.financial_status === 'da_pagare') && (
                        <li>Scadenza nello Scadenziario</li>
                      )}
                      <li>{selectedInvoice.invoice_type === 'acquisto' ? 'Debito' : 'Credito'}</li>
                    </ul>
                  </div>
                </div>
              </div>

              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Numero:</span>
                    <span className="font-mono">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <span className="capitalize">{selectedInvoice.invoice_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Soggetto:</span>
                    <span>{selectedInvoice.subject_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Totale:</span>
                    <span className="font-bold text-primary">
                      €{selectedInvoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => selectedInvoice && registerMutation.mutate(selectedInvoice)}
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? 'Registrazione...' : 'Registra Fattura'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
