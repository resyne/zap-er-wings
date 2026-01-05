import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { AccountSplitManager } from "@/components/management-control/AccountSplitManager";
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
  Receipt,
  Upload,
  Camera,
  Loader2,
  FileText,
  Pencil,
  Check,
  ChevronsUpDown
} from "lucide-react";

interface AccountSplitLine {
  id: string;
  account_id: string;
  amount: number;
  percentage: number;
  cost_center_id?: string;
  profit_center_id?: string;
}

interface InvoiceRegistry {
  id: string;
  invoice_number: string;
  invoice_date: string;
  invoice_type: 'vendita' | 'acquisto' | 'nota_credito';
  event_type?: EventType | null;
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
  payment_method: string | null;
  source_document_type: string | null;
  source_document_id: string | null;
  accounting_entry_id: string | null;
  scadenza_id: string | null;
  prima_nota_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  cost_account_id: string | null;
  revenue_account_id: string | null;
  notes: string | null;
  created_at: string;
  registered_at: string | null;
  attachment_url?: string | null;
  // Nuovi campi per spese/incassi dipendenti
  expense_type?: string | null;
  is_fiscal_document?: boolean;
  generates_accounting?: boolean;
  service_report_id?: string | null;
}

// Tipi evento del registro contabile
type EventType = 'spesa_dipendente' | 'incasso_dipendente' | 'fattura_acquisto' | 'fattura_vendita' | 'nota_credito';
type InvoiceType = 'vendita' | 'acquisto' | 'nota_credito';
type SubjectType = 'cliente' | 'fornitore';
type VatRegime = 'domestica_imponibile' | 'ue_non_imponibile' | 'extra_ue' | 'reverse_charge';
type FinancialStatus = 'da_incassare' | 'da_pagare' | 'incassata' | 'pagata';

// Tipi di spesa per dipendenti
const EXPENSE_TYPES = [
  { value: 'carburante', label: 'Carburante' },
  { value: 'pedaggi', label: 'Pedaggi' },
  { value: 'parcheggio', label: 'Parcheggio' },
  { value: 'materiale_consumo', label: 'Materiale di consumo' },
  { value: 'pasti', label: 'Pasti / Ristorante' },
  { value: 'trasporti', label: 'Trasporti' },
  { value: 'altro', label: 'Altro' },
];

// Metodi di pagamento/incasso
const PAYMENT_METHODS = [
  { value: 'contanti', label: 'Contanti' },
  { value: 'carta', label: 'Carta di Credito/Debito' },
  { value: 'bonifico', label: 'Bonifico Bancario' },
  { value: 'pos', label: 'POS' },
  { value: 'assegno', label: 'Assegno' },
];

interface FormData {
  event_type: EventType;
  invoice_number: string;
  invoice_date: string;
  invoice_type: InvoiceType;
  subject_type: SubjectType;
  subject_id: string;
  subject_name: string;
  imponibile: number;
  iva_rate: number;
  vat_regime: VatRegime;
  financial_status: FinancialStatus;
  due_date: string;
  payment_date: string;
  payment_method: string;
  source_document_type: string;
  source_document_id: string;
  cost_center_id: string;
  profit_center_id: string;
  cost_account_id: string;
  revenue_account_id: string;
  notes: string;
  attachment_url: string;
  // Campi specifici per spese/incassi dipendenti
  expense_type: string;
  service_report_id: string;
}

const initialFormData: FormData = {
  event_type: 'fattura_acquisto',
  invoice_number: '',
  invoice_date: format(new Date(), 'yyyy-MM-dd'),
  invoice_type: 'acquisto',
  subject_type: 'fornitore',
  subject_id: '',
  subject_name: '',
  imponibile: 0,
  iva_rate: 22,
  vat_regime: 'domestica_imponibile',
  financial_status: 'da_pagare',
  due_date: '',
  payment_date: '',
  payment_method: '',
  source_document_type: '',
  source_document_id: '',
  cost_center_id: '',
  profit_center_id: '',
  cost_account_id: '',
  revenue_account_id: '',
  notes: '',
  attachment_url: '',
  expense_type: '',
  service_report_id: ''
};

// Helper per determinare se un tipo evento è una fattura (documento fiscale)
const isFiscalDocument = (eventType: EventType): boolean => {
  return ['fattura_acquisto', 'fattura_vendita', 'nota_credito'].includes(eventType);
};

// Helper per determinare se genera contabilità
const generatesAccounting = (eventType: EventType): boolean => {
  return isFiscalDocument(eventType);
};

export default function RegistroContabilePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showClassifyDialog, setShowClassifyDialog] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRegistry | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [editFormData, setEditFormData] = useState<FormData>(initialFormData);
  
  // Account split states
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitLines, setSplitLines] = useState<AccountSplitLine[]>([]);
  const [editSplitEnabled, setEditSplitEnabled] = useState(false);
  const [editSplitLines, setEditSplitLines] = useState<AccountSplitLine[]>([]);
  
  // Subject search states
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [editSubjectSearchOpen, setEditSubjectSearchOpen] = useState(false);
  const [editSubjectSearch, setEditSubjectSearch] = useState("");
  
  // Drag & drop AI states
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);

  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `invoices/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("accounting-attachments")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("accounting-attachments")
        .getPublicUrl(fileName);

      setUploadedFile({ name: file.name, url: urlData.publicUrl });
      
      // AI analysis
      setIsAnalyzing(true);
      toast.info("Analizzo la fattura con AI...");

      try {
        let analysisUrl: string | null = urlData.publicUrl;
        const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

        if (isPdf) {
          try {
            toast.info("PDF rilevato: genero anteprima per analisi AI…");
            const pngBlob = await pdfFirstPageToPngBlob(file);
            const previewPath = `invoices/${Date.now()}-preview.png`;

            const { error: previewUploadError } = await supabase.storage
              .from("accounting-attachments")
              .upload(previewPath, pngBlob, { contentType: "image/png" });

            if (previewUploadError) throw previewUploadError;

            const { data: previewUrlData } = supabase.storage
              .from("accounting-attachments")
              .getPublicUrl(previewPath);

            analysisUrl = previewUrlData.publicUrl;
          } catch (previewErr) {
            console.warn("PDF preview generation failed:", previewErr);
            analysisUrl = null;
            toast.error("Non riesco a leggere il PDF: compila i dati manualmente");
          }
        }

        if (analysisUrl) {
          const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
            "analyze-invoice",
            { body: { imageUrl: analysisUrl } }
          );

          if (analysisError) {
            console.error("Analysis error:", analysisError);
            toast.error("Errore nell'analisi AI, compila i dati manualmente");
          } else if (analysisData?.success && analysisData?.data) {
            const extracted = analysisData.data;
            console.log("AI extracted invoice data:", extracted);

            setFormData(prev => ({
              ...prev,
              invoice_number: extracted.invoice_number || prev.invoice_number,
              invoice_date: extracted.invoice_date || format(new Date(), 'yyyy-MM-dd'),
              invoice_type: extracted.invoice_type || prev.invoice_type,
              subject_type: extracted.subject_type || prev.subject_type,
              subject_name: extracted.subject_name || prev.subject_name,
              imponibile: extracted.imponibile || prev.imponibile,
              iva_rate: extracted.iva_rate ?? prev.iva_rate,
              vat_regime: extracted.vat_regime || prev.vat_regime,
              financial_status: extracted.invoice_type === 'acquisto' ? 'da_pagare' : 'da_incassare',
              due_date: extracted.due_date || prev.due_date,
              notes: extracted.notes || prev.notes,
              attachment_url: urlData.publicUrl
            }));

            if (extracted.confidence === "high") {
              toast.success("Fattura analizzata con successo!");
            } else if (extracted.confidence === "medium") {
              toast.info("Fattura analizzata, verifica i dati estratti");
            } else {
              toast.info("Alcuni dati potrebbero essere incompleti");
            }
          } else {
            toast.info("Non è stato possibile estrarre dati, compila manualmente");
          }
        }
      } catch (aiError) {
        console.error("AI analysis failed:", aiError);
        toast.error("Analisi AI non disponibile");
      } finally {
        setIsAnalyzing(false);
      }

      setShowCreateDialog(true);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Errore durante il caricamento del file");
    } finally {
      setIsUploading(false);
    }
  }, []);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
    },
    maxFiles: 1,
    noClick: true,
    noKeyboard: true,
  });

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoice-registry', filterType, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('invoice_registry')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (filterType !== 'all' && filterType !== 'da_classificare' && filterType !== 'scontrino') {
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

  // Fetch eventi da classificare (accounting_entries)
  const { data: eventsToClassify = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['accounting-entries-to-classify'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('accounting_entries')
        .select('*')
        .in('status', ['da_classificare', 'in_classificazione', 'sospeso'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  // Fetch cost centers
  const { data: costCenters = [] } = useQuery({
    queryKey: ['cost-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cost_centers')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch profit centers
  const { data: profitCenters = [] } = useQuery({
    queryKey: ['profit-centers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profit_centers')
        .select('id, code, name')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch chart of accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ['chart-of-accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('id, code, name, account_type')
        .eq('is_active', true)
        .order('code');
      if (error) throw error;
      return data;
    }
  });

  // Fetch DDTs for linking
  const { data: ddts = [] } = useQuery({
    queryKey: ['ddts-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ddts')
        .select('id, ddt_number, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Fetch sales orders for linking
  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, number, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Fetch service reports for linking
  const { data: serviceReports = [] } = useQuery({
    queryKey: ['service-reports-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_reports')
        .select('id, intervention_type, intervention_date, technician_name')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Fetch customers
  const { data: customers = [] } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company_name, email, tax_id')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name, email, tax_id')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Filter subjects based on invoice type
  const getSubjects = (invoiceType: InvoiceType) => {
    if (invoiceType === 'vendita') {
      return customers.map(c => ({ 
        id: c.id, 
        name: c.company_name || c.name, 
        secondary: c.name !== (c.company_name || c.name) ? c.name : c.tax_id,
        type: 'cliente' as SubjectType
      }));
    } else {
      return suppliers.map(s => ({ 
        id: s.id, 
        name: s.name, 
        secondary: s.tax_id,
        type: 'fornitore' as SubjectType
      }));
    }
  };

  // Filtered subjects for search
  const filteredSubjects = useMemo(() => {
    const subjects = getSubjects(formData.invoice_type);
    if (!subjectSearch.trim()) return subjects;
    const searchLower = subjectSearch.toLowerCase();
    return subjects.filter(s => 
      s.name.toLowerCase().includes(searchLower) || 
      (s.secondary && s.secondary.toLowerCase().includes(searchLower))
    );
  }, [customers, suppliers, formData.invoice_type, subjectSearch]);

  // Filtered edit subjects
  const filteredEditSubjects = useMemo(() => {
    const subjects = getSubjects(editFormData.invoice_type);
    if (!editSubjectSearch.trim()) return subjects;
    const searchLower = editSubjectSearch.toLowerCase();
    return subjects.filter(s => 
      s.name.toLowerCase().includes(searchLower) || 
      (s.secondary && s.secondary.toLowerCase().includes(searchLower))
    );
  }, [customers, suppliers, editFormData.invoice_type, editSubjectSearch]);

  // Filtro conti per costi: cogs, opex, depreciation, extraordinary (escludi headers)
  const costAccounts = accounts.filter(a => 
    ['cogs', 'opex', 'depreciation', 'extraordinary', 'cost', 'expense'].includes(a.account_type)
  );
  // Filtro conti per ricavi
  const revenueAccounts = accounts.filter(a => a.account_type === 'revenue');

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
          subject_id: data.subject_id || null,
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
          payment_method: data.payment_method || null,
          source_document_type: data.source_document_type || null,
          source_document_id: data.source_document_id || null,
          cost_center_id: data.cost_center_id || null,
          profit_center_id: data.profit_center_id || null,
          cost_account_id: data.cost_account_id || null,
          revenue_account_id: data.revenue_account_id || null,
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
          direction: invoice.invoice_type === 'acquisto' ? 'uscita' : 'entrata',
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
          movement_type: 'economico',
          description: `Fattura ${invoice.invoice_number} - ${invoice.subject_name}`,
          amount: invoice.total_amount,
          imponibile: invoice.imponibile,
          iva_amount: invoice.iva_amount,
          iva_aliquota: invoice.iva_rate,
          payment_method: 'bonifico',
          status: 'registrato',
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

  // Mutation per modificare fatture registrate e aggiornare prima nota
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: { invoice: InvoiceRegistry; updates: FormData }) => {
      const { invoice, updates } = data;
      const ivaAmount = updates.imponibile * (updates.iva_rate / 100);
      const totalAmount = updates.imponibile + ivaAmount;

      // Aggiorna la fattura nel registro
      const { error: invoiceError } = await supabase
        .from('invoice_registry')
        .update({
          invoice_number: updates.invoice_number,
          invoice_date: updates.invoice_date,
          invoice_type: updates.invoice_type,
          subject_type: updates.subject_type,
          subject_id: updates.subject_id || null,
          subject_name: updates.subject_name,
          imponibile: updates.imponibile,
          iva_rate: updates.iva_rate,
          iva_amount: ivaAmount,
          total_amount: totalAmount,
          vat_regime: updates.vat_regime,
          financial_status: updates.financial_status,
          due_date: updates.due_date || null,
          payment_date: updates.payment_date || null,
          payment_method: updates.payment_method || null,
          source_document_type: updates.source_document_type || null,
          source_document_id: updates.source_document_id || null,
          cost_center_id: updates.cost_center_id || null,
          profit_center_id: updates.profit_center_id || null,
          cost_account_id: updates.cost_account_id || null,
          revenue_account_id: updates.revenue_account_id || null,
          notes: updates.notes || null
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // Se la fattura è registrata, aggiorna anche prima nota e accounting entry
      if (invoice.status === 'registrata') {
        // Aggiorna prima nota se esiste
        if (invoice.prima_nota_id) {
          const { error: primaNotaError } = await supabase
            .from('prima_nota')
            .update({
              description: `Fattura ${updates.invoice_number} - ${updates.subject_name}`,
              amount: totalAmount,
              imponibile: updates.imponibile,
              iva_amount: ivaAmount,
              iva_aliquota: updates.iva_rate,
              competence_date: updates.invoice_date
            })
            .eq('id', invoice.prima_nota_id);

          if (primaNotaError) throw primaNotaError;
        }

        // Aggiorna accounting entry se esiste
        if (invoice.accounting_entry_id) {
          const { error: entryError } = await supabase
            .from('accounting_entries')
            .update({
              amount: totalAmount,
              imponibile: updates.imponibile,
              iva_amount: ivaAmount,
              iva_aliquota: updates.iva_rate,
              document_date: updates.invoice_date,
              direction: updates.invoice_type === 'acquisto' ? 'uscita' : 'entrata',
              financial_status: updates.financial_status,
              subject_type: updates.subject_type
            })
            .eq('id', invoice.accounting_entry_id);

          if (entryError) throw entryError;
        }

        // Aggiorna scadenza se esiste
        if (invoice.scadenza_id) {
          const { error: scadenzaError } = await supabase
            .from('scadenze')
            .update({
              soggetto_nome: updates.subject_name,
              soggetto_tipo: updates.subject_type,
              importo_totale: totalAmount,
              importo_residuo: totalAmount,
              data_documento: updates.invoice_date,
              data_scadenza: updates.due_date || updates.invoice_date
            })
            .eq('id', invoice.scadenza_id);

          if (scadenzaError) throw scadenzaError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Fattura modificata! Prima Nota e documenti collegati aggiornati.');
      setShowEditDialog(false);
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
    },
    onError: (error) => {
      toast.error('Errore nella modifica: ' + error.message);
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

  const handleEditFormChange = (field: string, value: string | number) => {
    setEditFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'invoice_type') {
        updated.subject_type = value === 'acquisto' ? 'fornitore' : 'cliente';
      }
      return updated;
    });
  };

  const openEditDialog = (invoice: InvoiceRegistry) => {
    setSelectedInvoice(invoice);
    // Determina event_type dalla fattura
    const eventType: EventType = invoice.event_type || 
      (invoice.invoice_type === 'vendita' ? 'fattura_vendita' : 
       invoice.invoice_type === 'nota_credito' ? 'nota_credito' : 'fattura_acquisto');
    
    setEditFormData({
      event_type: eventType,
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      invoice_type: invoice.invoice_type,
      subject_type: invoice.subject_type,
      subject_id: invoice.subject_id || '',
      subject_name: invoice.subject_name,
      imponibile: invoice.imponibile,
      iva_rate: invoice.iva_rate,
      vat_regime: invoice.vat_regime,
      financial_status: invoice.financial_status,
      due_date: invoice.due_date || '',
      payment_date: invoice.payment_date || '',
      payment_method: invoice.payment_method || '',
      source_document_type: invoice.source_document_type || '',
      source_document_id: invoice.source_document_id || '',
      cost_center_id: invoice.cost_center_id || '',
      profit_center_id: invoice.profit_center_id || '',
      cost_account_id: invoice.cost_account_id || '',
      revenue_account_id: invoice.revenue_account_id || '',
      notes: invoice.notes || '',
      attachment_url: invoice.attachment_url || '',
      expense_type: invoice.expense_type || '',
      service_report_id: invoice.service_report_id || ''
    });
    // Reset edit split state
    setEditSplitEnabled(false);
    setEditSplitLines([]);
    setShowEditDialog(true);
  };

  const filteredInvoices = invoices.filter(inv => 
    inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
    inv.subject_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter events based on search
  const filteredEvents = eventsToClassify.filter(evt => 
    (evt.note || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (evt.document_type || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    bozze: invoices.filter(i => i.status === 'bozza').length,
    registrate: invoices.filter(i => i.status === 'registrata').length,
    daIncassare: invoices.filter(i => i.financial_status === 'da_incassare').reduce((sum, i) => sum + i.total_amount, 0),
    daPagare: invoices.filter(i => i.financial_status === 'da_pagare').reduce((sum, i) => sum + i.total_amount, 0),
    daClassificare: eventsToClassify.length
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
    <div {...getRootProps()} className="space-y-6 relative min-h-[calc(100vh-100px)]">
      <input {...getInputProps()} />
      
      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-primary/10 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border-2 border-dashed border-primary rounded-xl p-12 text-center">
            <Upload className="w-16 h-16 mx-auto mb-4 text-primary animate-bounce" />
            <p className="text-xl font-semibold text-primary">Rilascia la fattura qui</p>
            <p className="text-muted-foreground mt-2">AI analizzerà automaticamente il documento</p>
          </div>
        </div>
      )}
      
      {/* Uploading/Analyzing overlay */}
      {(isUploading || isAnalyzing) && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-xl p-8 text-center shadow-lg">
            <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
            <p className="text-lg font-semibold">
              {isUploading ? "Caricamento..." : "Analisi AI in corso..."}
            </p>
            <p className="text-muted-foreground mt-2">
              {isAnalyzing ? "Estraggo i dati dalla fattura" : "Attendi qualche secondo"}
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Registro Contabile</h1>
          <p className="text-muted-foreground">Fatture, scontrini, spese e incassi</p>
        </div>
        <div className="flex gap-2">
          <label>
            <Button variant="outline" asChild>
              <div className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Carica Fattura
              </div>
            </Button>
            <input
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file);
              }}
            />
          </label>
          <Button onClick={() => {
            setUploadedFile(null);
            setFormData(initialFormData);
            setSplitEnabled(false);
            setSplitLines([]);
            setShowCreateDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuova Fattura
          </Button>
        </div>
      </div>

      {/* Dropzone hint card */}
      <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/30">
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-4">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <div className="text-left">
              <p className="font-medium">Trascina una fattura qui</p>
              <p className="text-sm text-muted-foreground">AI analizzerà automaticamente e pre-compilerà i dati</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filterType === 'da_classificare' ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
          onClick={() => setFilterType(filterType === 'da_classificare' ? 'all' : 'da_classificare')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Da Classificare</p>
                <p className="text-2xl font-bold text-amber-500">{stats.daClassificare}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>
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
                <SelectItem value="da_classificare">Da Classificare</SelectItem>
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

      {/* Vista Eventi da Classificare */}
      {filterType === 'da_classificare' ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Direzione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo Doc.</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Metodo Pag.</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingEvents ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Caricamento...</TableCell>
                  </TableRow>
                ) : filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nessun evento da classificare
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((event) => (
                    <TableRow 
                      key={event.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowClassifyDialog(true);
                      }}
                    >
                      <TableCell>
                        <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm ${
                          event.direction === 'entrata' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {event.direction === 'entrata' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          <span className="capitalize">{event.direction}</span>
                        </div>
                      </TableCell>
                      <TableCell>{format(new Date(event.document_date), 'dd/MM/yyyy', { locale: it })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{event.document_type}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        €{event.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="capitalize">{event.payment_method || '-'}</TableCell>
                      <TableCell>
                        <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Da Classificare
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline">
                          Classifica
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
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
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEditDialog(invoice)}
                        >
                          <Pencil className="w-4 h-4 mr-1" />
                          Modifica
                        </Button>
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
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isFiscalDocument(formData.event_type) ? 'Nuova Fattura' : 
               formData.event_type === 'spesa_dipendente' ? 'Nuova Spesa Dipendente' : 
               'Nuovo Incasso Dipendente'}
            </DialogTitle>
          </DialogHeader>
          
          {/* Selezione Tipo Evento */}
          <div className="space-y-2 pb-4 border-b">
            <Label className="text-base font-semibold">Tipo Registrazione *</Label>
            <Select 
              value={formData.event_type} 
              onValueChange={(v: EventType) => {
                setFormData(prev => {
                  const updated = { ...prev, event_type: v };
                  // Reset campi in base al tipo
                  if (v === 'spesa_dipendente') {
                    updated.invoice_type = 'acquisto';
                    updated.subject_type = 'fornitore';
                    updated.financial_status = 'pagata';
                    updated.iva_rate = 0;
                    updated.vat_regime = 'domestica_imponibile';
                  } else if (v === 'incasso_dipendente') {
                    updated.invoice_type = 'vendita';
                    updated.subject_type = 'cliente';
                    updated.financial_status = 'incassata';
                    updated.iva_rate = 0;
                    updated.vat_regime = 'domestica_imponibile';
                  } else if (v === 'fattura_acquisto') {
                    updated.invoice_type = 'acquisto';
                    updated.subject_type = 'fornitore';
                    updated.financial_status = 'da_pagare';
                    updated.iva_rate = 22;
                  } else if (v === 'fattura_vendita') {
                    updated.invoice_type = 'vendita';
                    updated.subject_type = 'cliente';
                    updated.financial_status = 'da_incassare';
                    updated.iva_rate = 22;
                  } else if (v === 'nota_credito') {
                    updated.invoice_type = 'nota_credito';
                    updated.iva_rate = 22;
                  }
                  return updated;
                });
                // Reset subject
                handleFormChange('subject_id', '');
                handleFormChange('subject_name', '');
                setSubjectSearch('');
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="spesa_dipendente">🧾 Spesa Dipendente (scontrino, ricevuta)</SelectItem>
                <SelectItem value="incasso_dipendente">💵 Incasso Dipendente (contanti, POS)</SelectItem>
                <SelectItem value="fattura_acquisto">📥 Fattura di Acquisto</SelectItem>
                <SelectItem value="fattura_vendita">📤 Fattura di Vendita</SelectItem>
                <SelectItem value="nota_credito">📋 Nota di Credito</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Info sul tipo selezionato */}
            {!isFiscalDocument(formData.event_type) && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mt-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-600">Documento NON fiscale</p>
                    <p className="text-muted-foreground">
                      {formData.event_type === 'spesa_dipendente' 
                        ? 'Questa registrazione traccia l\'uscita ma NON genera contabilità ufficiale né IVA.' 
                        : 'Questa registrazione traccia l\'entrata ma NON genera ricavo ufficiale né IVA.'}
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {isFiscalDocument(formData.event_type) && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mt-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-green-600">Documento fiscale valido</p>
                    <p className="text-muted-foreground">
                      Genera contabilità ufficiale, IVA, Prima Nota e scadenze.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Campi per SPESA DIPENDENTE */}
            {formData.event_type === 'spesa_dipendente' && (
              <>
                <div className="space-y-2">
                  <Label>Tipo Spesa *</Label>
                  <Select value={formData.expense_type} onValueChange={(v) => handleFormChange('expense_type', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo spesa" />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => handleFormChange('invoice_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Importo *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.imponibile}
                    onChange={(e) => handleFormChange('imponibile', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Metodo di Pagamento *</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => handleFormChange('payment_method', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona metodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro di Costo *</Label>
                  <Select value={formData.cost_center_id} onValueChange={(v) => handleFormChange('cost_center_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona centro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {costCenters.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Riferimento Intervento</Label>
                  <Select value={formData.service_report_id} onValueChange={(v) => handleFormChange('service_report_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega a intervento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {serviceReports.map(sr => (
                        <SelectItem key={sr.id} value={sr.id}>
                          {format(new Date(sr.intervention_date), 'dd/MM/yy', { locale: it })} - {sr.technician_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Note / Descrizione</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Descrizione della spesa..."
                  />
                </div>
              </>
            )}
            
            {/* Campi per INCASSO DIPENDENTE */}
            {formData.event_type === 'incasso_dipendente' && (
              <>
                <div className="space-y-2">
                  <Label>Cliente (se noto)</Label>
                  <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={subjectSearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.subject_name || 'Cerca cliente...'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Cerca cliente..."
                          value={subjectSearch}
                          onValueChange={setSubjectSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nessun risultato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredSubjects.map((subject) => (
                              <CommandItem
                                key={subject.id}
                                value={subject.id}
                                onSelect={() => {
                                  handleFormChange('subject_id', subject.id);
                                  handleFormChange('subject_name', subject.name);
                                  setSubjectSearchOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", formData.subject_id === subject.id ? "opacity-100" : "opacity-0")} />
                                <span className="font-medium">{subject.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Data *</Label>
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => handleFormChange('invoice_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Importo *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.imponibile}
                    onChange={(e) => handleFormChange('imponibile', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Metodo di Incasso *</Label>
                  <Select value={formData.payment_method} onValueChange={(v) => handleFormChange('payment_method', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona metodo" />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Riferimento Intervento</Label>
                  <Select value={formData.service_report_id} onValueChange={(v) => handleFormChange('service_report_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega a intervento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {serviceReports.map(sr => (
                        <SelectItem key={sr.id} value={sr.id}>
                          {format(new Date(sr.intervention_date), 'dd/MM/yy', { locale: it })} - {sr.technician_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Centro di Ricavo</Label>
                  <Select value={formData.profit_center_id} onValueChange={(v) => handleFormChange('profit_center_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona centro" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {profitCenters.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} - {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label>Note / Descrizione</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Descrizione dell'incasso..."
                  />
                </div>
              </>
            )}

            {/* Campi per FATTURE (documento fiscale) */}
            {isFiscalDocument(formData.event_type) && (
              <>
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
                  <Label>{formData.invoice_type === 'vendita' ? 'Cliente' : 'Fornitore'} *</Label>
                  <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={subjectSearchOpen}
                        className="w-full justify-between font-normal"
                      >
                        {formData.subject_name || `Cerca ${formData.invoice_type === 'vendita' ? 'cliente' : 'fornitore'}...`}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder={`Cerca ${formData.invoice_type === 'vendita' ? 'cliente' : 'fornitore'}...`}
                          value={subjectSearch}
                          onValueChange={setSubjectSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nessun risultato trovato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredSubjects.map((subject) => (
                              <CommandItem
                                key={subject.id}
                                value={subject.id}
                                onSelect={() => {
                                  handleFormChange('subject_id', subject.id);
                                  handleFormChange('subject_name', subject.name);
                                  handleFormChange('subject_type', subject.type);
                                  setSubjectSearchOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    formData.subject_id === subject.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{subject.name}</span>
                                  {subject.secondary && (
                                    <span className="text-xs text-muted-foreground">{subject.secondary}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                
                {/* Payment method - shown when paid */}
                {(formData.financial_status === 'pagata' || formData.financial_status === 'incassata') && (
                  <div className="space-y-2">
                    <Label>Metodo di Pagamento</Label>
                    <Select value={formData.payment_method} onValueChange={(v) => handleFormChange('payment_method', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona metodo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bonifico">Bonifico Bancario</SelectItem>
                        <SelectItem value="contanti">Contanti</SelectItem>
                        <SelectItem value="carta">Carta di Credito/Debito</SelectItem>
                        <SelectItem value="assegno">Assegno</SelectItem>
                        <SelectItem value="riba">RiBa</SelectItem>
                        <SelectItem value="sdd">SDD (Addebito Diretto)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Document linking */}
                <div className="space-y-2">
                  <Label>Documento Operativo</Label>
                  <Select value={formData.source_document_type} onValueChange={(v) => {
                    const next = v === "__none__" ? "" : v;
                    handleFormChange('source_document_type', next);
                    handleFormChange('source_document_id', '');
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Collega documento (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessun collegamento</SelectItem>
                      <SelectItem value="ddt">DDT</SelectItem>
                      <SelectItem value="sales_order">Ordine di Vendita</SelectItem>
                      <SelectItem value="service_report">Rapporto Intervento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.source_document_type && (
                  <div className="space-y-2">
                    <Label>Seleziona {formData.source_document_type === 'ddt' ? 'DDT' : formData.source_document_type === 'sales_order' ? 'Ordine' : 'Rapporto'}</Label>
                    <Select value={formData.source_document_id} onValueChange={(v) => handleFormChange('source_document_id', v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {formData.source_document_type === 'ddt' && ddts.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.ddt_number}</SelectItem>
                        ))}
                        {formData.source_document_type === 'sales_order' && salesOrders.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.number}</SelectItem>
                        ))}
                        {formData.source_document_type === 'service_report' && serviceReports.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.intervention_date} - {r.intervention_type} ({r.technician_name})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                {/* Cost center and account for purchases */}
                {formData.invoice_type === 'acquisto' && (
                  <>
                    <div className="space-y-2">
                      <Label>Centro di Costo</Label>
                      <Select value={formData.cost_center_id} onValueChange={(v) => handleFormChange('cost_center_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona centro di costo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {costCenters.map(cc => (
                            <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Conto di Costo</Label>
                      <Select value={formData.cost_account_id} onValueChange={(v) => handleFormChange('cost_account_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona conto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {costAccounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                {/* Profit center and revenue account for sales */}
                {(formData.invoice_type === 'vendita' || formData.invoice_type === 'nota_credito') && (
                  <>
                    <div className="space-y-2">
                      <Label>Centro di Ricavo</Label>
                      <Select value={formData.profit_center_id} onValueChange={(v) => handleFormChange('profit_center_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona centro di ricavo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {profitCenters.map(pc => (
                            <SelectItem key={pc.id} value={pc.id}>{pc.code} - {pc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Conto di Ricavo</Label>
                      <Select value={formData.revenue_account_id} onValueChange={(v) => handleFormChange('revenue_account_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona conto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessuno</SelectItem>
                          {revenueAccounts.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
                
                <div className="col-span-2 space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Note aggiuntive..."
                  />
                </div>
                
                {/* Account Split Manager */}
                <div className="col-span-2">
                  <AccountSplitManager
                    enabled={splitEnabled}
                    onEnabledChange={(enabled) => {
                      setSplitEnabled(enabled);
                      if (!enabled) setSplitLines([]);
                    }}
                    totalAmount={formData.imponibile}
                    invoiceType={formData.invoice_type}
                    accounts={accounts}
                    costCenters={costCenters}
                    profitCenters={profitCenters}
                    lines={splitLines}
                    onLinesChange={setSplitLines}
                  />
                </div>
              </>
            )}
          </div>

          {/* Uploaded file indicator */}
          {uploadedFile && (
            <Card className="border-green-500/30 bg-green-500/10">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">Allegato: {uploadedFile.name}</span>
                  <a 
                    href={uploadedFile.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-xs text-primary hover:underline ml-auto"
                  >
                    Visualizza
                  </a>
                </div>
              </CardContent>
            </Card>
          )}

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

      {/* Dialog Modifica Fattura */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Modifica Fattura {selectedInvoice?.status === 'registrata' && (
                <Badge className="ml-2 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Registrata
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInvoice?.status === 'registrata' && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-500">Modifica fattura registrata</p>
                  <p className="text-sm text-muted-foreground">
                    Le modifiche verranno applicate anche a: Prima Nota, Evento Contabile e Scadenza collegati.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Numero Fattura *</Label>
              <Input
                value={editFormData.invoice_number}
                onChange={(e) => handleEditFormChange('invoice_number', e.target.value)}
                placeholder="FT-2026/001"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fattura *</Label>
              <Input
                type="date"
                value={editFormData.invoice_date}
                onChange={(e) => handleEditFormChange('invoice_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select 
                value={editFormData.invoice_type} 
                onValueChange={(v) => {
                  handleEditFormChange('invoice_type', v);
                  // Reset subject when switching type
                  handleEditFormChange('subject_id', '');
                  handleEditFormChange('subject_name', '');
                  handleEditFormChange('subject_type', v === 'vendita' ? 'cliente' : 'fornitore');
                  setEditSubjectSearch('');
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vendita">Vendita (Cliente)</SelectItem>
                  <SelectItem value="acquisto">Acquisto (Fornitore)</SelectItem>
                  <SelectItem value="nota_credito">Nota Credito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{editFormData.invoice_type === 'vendita' ? 'Cliente' : 'Fornitore'} *</Label>
              <Popover open={editSubjectSearchOpen} onOpenChange={setEditSubjectSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={editSubjectSearchOpen}
                    className="w-full justify-between font-normal"
                  >
                    {editFormData.subject_name || `Cerca ${editFormData.invoice_type === 'vendita' ? 'cliente' : 'fornitore'}...`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder={`Cerca ${editFormData.invoice_type === 'vendita' ? 'cliente' : 'fornitore'}...`}
                      value={editSubjectSearch}
                      onValueChange={setEditSubjectSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nessun risultato trovato</CommandEmpty>
                      <CommandGroup className="max-h-60 overflow-auto">
                        {filteredEditSubjects.map((subject) => (
                          <CommandItem
                            key={subject.id}
                            value={subject.id}
                            onSelect={() => {
                              handleEditFormChange('subject_id', subject.id);
                              handleEditFormChange('subject_name', subject.name);
                              handleEditFormChange('subject_type', subject.type);
                              setEditSubjectSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                editFormData.subject_id === subject.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{subject.name}</span>
                              {subject.secondary && (
                                <span className="text-xs text-muted-foreground">{subject.secondary}</span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Imponibile *</Label>
              <Input
                type="number"
                step="0.01"
                value={editFormData.imponibile}
                onChange={(e) => handleEditFormChange('imponibile', parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Aliquota IVA %</Label>
              <Select value={editFormData.iva_rate.toString()} onValueChange={(v) => handleEditFormChange('iva_rate', parseFloat(v))}>
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
              <Select value={editFormData.vat_regime} onValueChange={(v) => handleEditFormChange('vat_regime', v)}>
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
              <Select value={editFormData.financial_status} onValueChange={(v) => handleEditFormChange('financial_status', v)}>
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
                value={editFormData.due_date}
                onChange={(e) => handleEditFormChange('due_date', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Pagamento</Label>
              <Input
                type="date"
                value={editFormData.payment_date}
                onChange={(e) => handleEditFormChange('payment_date', e.target.value)}
              />
            </div>
            
            {/* Payment method - shown when paid */}
            {(editFormData.financial_status === 'pagata' || editFormData.financial_status === 'incassata') && (
              <div className="space-y-2">
                <Label>Metodo di Pagamento</Label>
                <Select value={editFormData.payment_method} onValueChange={(v) => handleEditFormChange('payment_method', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonifico">Bonifico Bancario</SelectItem>
                    <SelectItem value="contanti">Contanti</SelectItem>
                    <SelectItem value="carta">Carta di Credito/Debito</SelectItem>
                    <SelectItem value="assegno">Assegno</SelectItem>
                    <SelectItem value="riba">RiBa</SelectItem>
                    <SelectItem value="sdd">SDD (Addebito Diretto)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Document linking */}
            <div className="space-y-2">
              <Label>Documento Operativo</Label>
              <Select value={editFormData.source_document_type} onValueChange={(v) => {
                const next = v === "__none__" ? "" : v;
                handleEditFormChange('source_document_type', next);
                handleEditFormChange('source_document_id', '');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Collega documento (opzionale)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nessun collegamento</SelectItem>
                  <SelectItem value="ddt">DDT</SelectItem>
                  <SelectItem value="sales_order">Ordine di Vendita</SelectItem>
                  <SelectItem value="service_report">Rapporto Intervento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {editFormData.source_document_type && (
              <div className="space-y-2">
                <Label>Seleziona {editFormData.source_document_type === 'ddt' ? 'DDT' : editFormData.source_document_type === 'sales_order' ? 'Ordine' : 'Rapporto'}</Label>
                <Select value={editFormData.source_document_id} onValueChange={(v) => handleEditFormChange('source_document_id', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {editFormData.source_document_type === 'ddt' && ddts.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.ddt_number}</SelectItem>
                    ))}
                    {editFormData.source_document_type === 'sales_order' && salesOrders.map(o => (
                      <SelectItem key={o.id} value={o.id}>{o.number}</SelectItem>
                    ))}
                    {editFormData.source_document_type === 'service_report' && serviceReports.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.intervention_date} - {r.intervention_type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Cost center and account for purchases */}
            {editFormData.invoice_type === 'acquisto' && (
              <>
                <div className="space-y-2">
                  <Label>Centro di Costo</Label>
                  <Select value={editFormData.cost_center_id} onValueChange={(v) => handleEditFormChange('cost_center_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona centro di costo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {costCenters.map(cc => (
                        <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conto di Costo</Label>
                  <Select value={editFormData.cost_account_id} onValueChange={(v) => handleEditFormChange('cost_account_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona conto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {costAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            {/* Profit center and revenue account for sales */}
            {(editFormData.invoice_type === 'vendita' || editFormData.invoice_type === 'nota_credito') && (
              <>
                <div className="space-y-2">
                  <Label>Centro di Ricavo</Label>
                  <Select value={editFormData.profit_center_id} onValueChange={(v) => handleEditFormChange('profit_center_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona centro di ricavo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {profitCenters.map(pc => (
                        <SelectItem key={pc.id} value={pc.id}>{pc.code} - {pc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Conto di Ricavo</Label>
                  <Select value={editFormData.revenue_account_id} onValueChange={(v) => handleEditFormChange('revenue_account_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona conto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuno</SelectItem>
                      {revenueAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            
            <div className="col-span-2 space-y-2">
              <Label>Note</Label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => handleEditFormChange('notes', e.target.value)}
                rows={3}
              />
            </div>
            
            {/* Account Split Manager for Edit */}
            <div className="col-span-2">
              <AccountSplitManager
                enabled={editSplitEnabled}
                onEnabledChange={(enabled) => {
                  setEditSplitEnabled(enabled);
                  if (!enabled) setEditSplitLines([]);
                }}
                totalAmount={editFormData.imponibile}
                invoiceType={editFormData.invoice_type}
                accounts={accounts}
                costCenters={costCenters}
                profitCenters={profitCenters}
                lines={editSplitLines}
                onLinesChange={setEditSplitLines}
              />
            </div>
            {/* Calcolo automatico importi */}
            <div className="col-span-2 bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA ({editFormData.iva_rate}%):</span>
                <span>€{(editFormData.imponibile * (editFormData.iva_rate / 100)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Totale:</span>
                <span className="text-primary">€{(editFormData.imponibile * (1 + editFormData.iva_rate / 100)).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => selectedInvoice && updateInvoiceMutation.mutate({ invoice: selectedInvoice, updates: editFormData })}
              disabled={updateInvoiceMutation.isPending}
            >
              {updateInvoiceMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Classificazione Evento */}
      <Dialog open={showClassifyDialog} onOpenChange={setShowClassifyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" />
              Classifica Evento
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              {/* Info evento */}
              <Card>
                <CardContent className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                    <span>{format(new Date(selectedEvent.document_date), 'dd/MM/yyyy', { locale: it })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo documento:</span>
                    <Badge variant="outline" className="capitalize">{selectedEvent.document_type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Direzione:</span>
                    <Badge className={selectedEvent.direction === 'entrata' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}>
                      {selectedEvent.direction === 'entrata' ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownLeft className="w-3 h-3 mr-1" />}
                      {selectedEvent.direction}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Importo:</span>
                    <span className="font-bold text-primary">
                      €{selectedEvent.amount?.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {selectedEvent.note && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Note:</span>
                      <span className="text-sm">{selectedEvent.note}</span>
                    </div>
                  )}
                  {selectedEvent.attachment_url && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Allegato:</span>
                      <a 
                        href={selectedEvent.attachment_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <FileText className="w-3 h-3" />
                        Visualizza
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tipo classificazione */}
              <div className="space-y-2">
                <Label>Tipo di Registrazione</Label>
                <Select 
                  value={formData.event_type} 
                  onValueChange={(v: EventType) => setFormData(prev => ({ ...prev, event_type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spesa_dipendente">Spesa Dipendente (no fattura)</SelectItem>
                    <SelectItem value="incasso_dipendente">Incasso Dipendente (no fattura)</SelectItem>
                    <SelectItem value="fattura_acquisto">Fattura di Acquisto</SelectItem>
                    <SelectItem value="fattura_vendita">Fattura di Vendita</SelectItem>
                    <SelectItem value="nota_credito">Nota di Credito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Info box based on type */}
              {!isFiscalDocument(formData.event_type) ? (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm">
                  <p className="font-medium text-amber-600">Registrazione operativa</p>
                  <p className="text-muted-foreground">
                    Questo movimento verrà tracciato ma <strong>non genererà contabilità ufficiale</strong>.
                  </p>
                </div>
              ) : (
                <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-sm">
                  <p className="font-medium text-green-600">Documento fiscale</p>
                  <p className="text-muted-foreground">
                    Questa registrazione genererà evento contabile, Prima Nota e scadenza.
                  </p>
                </div>
              )}

              {/* Form per spese/incassi dipendenti */}
              {formData.event_type === 'spesa_dipendente' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo Spesa *</Label>
                    <Select value={formData.expense_type} onValueChange={(v) => setFormData(prev => ({ ...prev, expense_type: v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Centro di Costo</Label>
                    <Select value={formData.cost_center_id} onValueChange={(v) => setFormData(prev => ({ ...prev, cost_center_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nessuno</SelectItem>
                        {costCenters.map(cc => (
                          <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {formData.event_type === 'incasso_dipendente' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={formData.subject_id} onValueChange={(v) => {
                      const cust = customers.find(c => c.id === v);
                      setFormData(prev => ({ 
                        ...prev, 
                        subject_id: v === "__none__" ? "" : v,
                        subject_name: cust ? (cust.company_name || cust.name) : ""
                      }));
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Non specificato</SelectItem>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.company_name || c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Centro di Ricavo</Label>
                    <Select value={formData.profit_center_id} onValueChange={(v) => setFormData(prev => ({ ...prev, profit_center_id: v === "__none__" ? "" : v }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nessuno</SelectItem>
                        {profitCenters.map(pc => (
                          <SelectItem key={pc.id} value={pc.id}>{pc.code} - {pc.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowClassifyDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedEvent) return;
                try {
                  const { error } = await supabase
                    .from('accounting_entries')
                    .update({ 
                      status: 'classificato',
                      event_type: formData.event_type,
                      cost_center_id: formData.cost_center_id || null,
                      profit_center_id: formData.profit_center_id || null,
                      classified_at: new Date().toISOString()
                    })
                    .eq('id', selectedEvent.id);
                  
                  if (error) throw error;
                  
                  toast.success('Evento classificato con successo');
                  setShowClassifyDialog(false);
                  setSelectedEvent(null);
                  queryClient.invalidateQueries({ queryKey: ['accounting-entries-to-classify'] });
                } catch (err: any) {
                  toast.error('Errore: ' + err.message);
                }
              }}
            >
              Classifica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
