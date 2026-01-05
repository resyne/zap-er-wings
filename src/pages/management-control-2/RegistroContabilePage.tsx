import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format, getYear, getMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { AccountSplitManager } from "@/components/management-control/AccountSplitManager";
import { useAllOperationalDocuments, OperationalDocument } from "@/hooks/useOperationalDocuments";
import { findSimilarSubjects, SubjectMatch } from "@/lib/fuzzyMatch";
import { SimilarSubjectDialog, SimilarSubjectAction } from "@/components/shared/SimilarSubjectDialog";
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
  ChevronsUpDown,
  Trash2,
  Truck,
  Wrench,
  Calendar,
  ChevronDown,
  ChevronRight,
  Archive
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

// Stati obbligatori del registro contabile
type RegistryStatus = 'da_classificare' | 'non_rilevante' | 'contabilizzato' | 'archiviato';

const REGISTRY_STATUSES = [
  { value: 'da_classificare', label: 'Da Classificare', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  { value: 'non_rilevante', label: 'Non Rilevante Fiscalmente', color: 'bg-gray-500/20 text-gray-600 border-gray-500/30' },
  { value: 'contabilizzato', label: 'Contabilizzato', color: 'bg-green-500/20 text-green-600 border-green-500/30' },
  { value: 'archiviato', label: 'Archiviato', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
];

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
  employee_id: string;
  employee_name: string;
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
  service_report_id: '',
  employee_id: '',
  employee_name: ''
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
  
  // Similar subject dialog states
  const [similarDialogOpen, setSimilarDialogOpen] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<SubjectMatch[]>([]);
  const [pendingSubjectName, setPendingSubjectName] = useState("");
  const [pendingSubjectType, setPendingSubjectType] = useState<"cliente" | "fornitore">("fornitore");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);

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

            const normalize = (v?: string) => (v ?? "").toLowerCase().trim();
            const normalizeTaxId = (v?: string) => (v ?? "").replace(/\s+/g, "").trim();

            // Riconoscimento "noi" (minimo): CLIMATEL per nome o P.IVA
            const isOurCompany = (name?: string, taxId?: string) => {
              const n = normalize(name);
              const t = normalizeTaxId(taxId);
              return n.includes("climatel") || t === "03895390650";
            };

            const supplierName: string = extracted.supplier_name || "";
            const supplierTaxId: string = extracted.supplier_tax_id || "";
            const customerName: string = extracted.customer_name || extracted.subject_name || "";
            const customerTaxId: string = extracted.customer_tax_id || extracted.subject_tax_id || "";

            const isPurchase = isOurCompany(customerName, customerTaxId) && !isOurCompany(supplierName, supplierTaxId);
            const isSale = isOurCompany(supplierName, supplierTaxId) && !isOurCompany(customerName, customerTaxId);

            // Deriva tipo documento: se "destinatario = noi" => acquisto (fornitore = chi emette)
            let invoiceType: InvoiceType = 'acquisto';
            if (extracted.invoice_type === 'nota_credito') {
              invoiceType = 'nota_credito';
            } else if (isPurchase) {
              invoiceType = 'acquisto';
            } else if (isSale) {
              invoiceType = 'vendita';
            } else if (extracted.invoice_type) {
              invoiceType = extracted.invoice_type;
            }

            let eventType: EventType = invoiceType === 'vendita' ? 'fattura_vendita' : 'fattura_acquisto';
            let subjectType: SubjectType = invoiceType === 'vendita' ? 'cliente' : 'fornitore';
            let financialStatus: FinancialStatus = subjectType === 'cliente' ? 'da_incassare' : 'da_pagare';

            if (invoiceType === 'nota_credito') {
              eventType = 'nota_credito';
              subjectType = isSale ? 'cliente' : isPurchase ? 'fornitore' : (extracted.subject_type || 'fornitore');
              financialStatus = subjectType === 'fornitore' ? 'da_incassare' : 'da_pagare';
            }

            const counterpartName =
              invoiceType === 'vendita'
                ? (customerName || extracted.subject_name || '')
                : invoiceType === 'acquisto'
                  ? (supplierName || extracted.subject_name || '')
                  : (subjectType === 'fornitore'
                      ? (supplierName || extracted.subject_name || '')
                      : (customerName || extracted.subject_name || ''));

            const counterpartTaxId =
              invoiceType === 'vendita'
                ? (customerTaxId || '')
                : invoiceType === 'acquisto'
                  ? (supplierTaxId || '')
                  : (subjectType === 'fornitore' ? (supplierTaxId || '') : (customerTaxId || ''));

            // Map AI payment method to our format
            const mapPaymentMethod = (aiMethod?: string): string => {
              if (!aiMethod) return '';
              const map: Record<string, string> = {
                'bonifico': 'bonifico',
                'carta': 'carta',
                'contanti': 'contanti',
                'assegno': 'assegno',
                'pos': 'pos'
              };
              return map[aiMethod.toLowerCase()] || '';
            };

            // Find matching cost center based on AI hint
            const findCostCenter = (hint?: string): string => {
              if (!hint || costCenters.length === 0) return '';
              const hintLower = hint.toLowerCase();
              const match = costCenters.find(cc => 
                cc.name.toLowerCase().includes(hintLower) || 
                cc.code.toLowerCase().includes(hintLower)
              );
              return match?.id || '';
            };

            // Find matching account based on AI hint and expense category
            const findAccount = (accountHint?: string, expenseCategory?: string): string => {
              if (accounts.length === 0) return '';
              
              // Try account hint first
              if (accountHint) {
                const hintLower = accountHint.toLowerCase();
                const match = accounts.find(acc => 
                  acc.name.toLowerCase().includes(hintLower) ||
                  hintLower.includes(acc.name.toLowerCase())
                );
                if (match) return match.id;
              }

              // Try expense category mapping
              if (expenseCategory) {
                const categoryMap: Record<string, string[]> = {
                  'carburante': ['carburante', 'carburanti', 'benzina', 'gasolio'],
                  'pedaggi': ['pedaggi', 'autostrada', 'autostrade'],
                  'materiali': ['materiali', 'materie prime', 'acquisti'],
                  'servizi': ['servizi', 'prestazioni'],
                  'consulenza': ['consulenza', 'consulenze', 'professionali'],
                  'utenze': ['utenze', 'telefono', 'energia', 'gas', 'acqua'],
                  'affitto': ['affitto', 'locazione', 'canoni'],
                  'manutenzione': ['manutenzione', 'riparazioni'],
                  'assicurazioni': ['assicurazione', 'assicurazioni'],
                  'formazione': ['formazione', 'corsi'],
                  'marketing': ['marketing', 'pubblicità', 'promozione'],
                  'trasporti': ['trasporti', 'spedizioni', 'corriere']
                };

                const keywords = categoryMap[expenseCategory] || [];
                for (const keyword of keywords) {
                  const match = accounts.find(acc => 
                    acc.name.toLowerCase().includes(keyword)
                  );
                  if (match) return match.id;
                }
              }

              return '';
            };

            // Build notes with invoice description
            const buildNotes = (existingNotes?: string, description?: string): string => {
              const parts: string[] = [];
              if (description) parts.push(`Oggetto: ${description}`);
              if (existingNotes) parts.push(existingNotes);
              return parts.join('\n');
            };

            setFormData(prev => ({
              ...prev,
              event_type: eventType,
              invoice_number: extracted.invoice_number || prev.invoice_number,
              invoice_date: extracted.invoice_date || format(new Date(), 'yyyy-MM-dd'),
              invoice_type: invoiceType,
              subject_type: subjectType,
              subject_name: counterpartName || prev.subject_name,
              imponibile: extracted.imponibile || prev.imponibile,
              iva_rate: extracted.iva_rate ?? prev.iva_rate,
              vat_regime: extracted.vat_regime || prev.vat_regime,
              financial_status: financialStatus,
              due_date: extracted.due_date || prev.due_date,
              payment_method: mapPaymentMethod(extracted.payment_method) || prev.payment_method,
              cost_center_id: findCostCenter(extracted.cost_center_hint) || prev.cost_center_id,
              cost_account_id: findAccount(extracted.account_hint, extracted.expense_category) || prev.cost_account_id,
              expense_type: extracted.expense_category || prev.expense_type,
              notes: buildNotes(extracted.notes, extracted.invoice_description) || prev.notes,
              attachment_url: urlData.publicUrl
            }));

            // Check for similar subjects (anagrafica) usando nome + P.IVA quando disponibile
            if (counterpartName) {
              setTimeout(() => {
                checkAndMatchSubject(counterpartName, subjectType, counterpartTaxId);
              }, 500);
            }

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

  // Fetch employees (technicians)
  const { data: employeesRaw = [] } = useQuery({
    queryKey: ['employees-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, email, position')
        .eq('active', true)
        .order('last_name');
      if (error) throw error;
      return data;
    }
  });
  
  // Map employees with full name
  const employees = employeesRaw.map(e => ({
    id: e.id,
    name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
    email: e.email,
    role: e.position
  }));

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

  // Fetch operational documents (all documents, both invoiced and pending)
  const { data: operationalDocuments = [], isLoading: isLoadingOperational, refetch: refetchOperational } = useAllOperationalDocuments();

  // State for operational documents filters
  const [opDocTypeFilter, setOpDocTypeFilter] = useState("all");
  const [opInvoiceFilter, setOpInvoiceFilter] = useState("all");
  const [opYearFilter, setOpYearFilter] = useState<string>("2026");
  const [opMonthFilter, setOpMonthFilter] = useState<string>("all");
  const [opArchivedFilter, setOpArchivedFilter] = useState<string>("active"); // active, archived, all
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set());

  // State for operational document invoicing dialog
  const [showOperationalInvoiceDialog, setShowOperationalInvoiceDialog] = useState(false);
  const [selectedOperationalDoc, setSelectedOperationalDoc] = useState<OperationalDocument | null>(null);
  const [operationalInvoiceData, setOperationalInvoiceData] = useState({
    invoice_number: '',
    invoice_date: format(new Date(), 'yyyy-MM-dd'),
    imponibile: 0,
    iva_rate: 22
  });

  // Mutation to archive operational document
  const archiveDocMutation = useMutation({
    mutationFn: async (doc: OperationalDocument) => {
      const table = doc.type === "order" 
        ? "sales_orders" 
        : doc.type === "ddt" 
          ? "ddts" 
          : "service_reports";

      const { error } = await supabase
        .from(table)
        .update({ archived: true })
        .eq("id", doc.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Documento archiviato');
      refetchOperational();
    },
    onError: (error) => {
      toast.error('Errore: ' + error.message);
    }
  });

  // Mutation to create invoice from operational document
  const createInvoiceFromDocMutation = useMutation({
    mutationFn: async (doc: OperationalDocument) => {
      const ivaAmount = operationalInvoiceData.imponibile * (operationalInvoiceData.iva_rate / 100);
      const totalAmount = operationalInvoiceData.imponibile + ivaAmount;

      // 1. Create invoice_registry entry
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_registry')
        .insert({
          invoice_number: operationalInvoiceData.invoice_number,
          invoice_date: operationalInvoiceData.invoice_date,
          invoice_type: 'vendita',
          subject_type: 'cliente',
          subject_name: doc.customer,
          subject_id: doc.customer_id,
          imponibile: operationalInvoiceData.imponibile,
          iva_rate: operationalInvoiceData.iva_rate,
          iva_amount: ivaAmount,
          total_amount: totalAmount,
          vat_regime: 'domestica_imponibile',
          financial_status: 'da_incassare',
          status: 'bozza',
          source_document_type: doc.type,
          source_document_id: doc.id,
          notes: `Fattura per ${doc.type === 'order' ? 'Ordine' : doc.type === 'ddt' ? 'DDT' : 'Rapporto'} ${doc.number}`
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // 2. Mark original document as invoiced
      const table = doc.type === "order" 
        ? "sales_orders" 
        : doc.type === "ddt" 
          ? "ddts" 
          : "service_reports";

      const { error: updateError } = await supabase
        .from(table)
        .update({
          invoiced: true,
          invoice_date: operationalInvoiceData.invoice_date,
          invoice_number: operationalInvoiceData.invoice_number
        })
        .eq("id", doc.id);

      if (updateError) throw updateError;

      return invoiceData;
    },
    onSuccess: () => {
      toast.success('Fattura creata e documento segnato come fatturato');
      setShowOperationalInvoiceDialog(false);
      setSelectedOperationalDoc(null);
      refetchOperational();
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
    },
    onError: (error) => {
      toast.error('Errore: ' + error.message);
    }
  });

  const handleCreateInvoiceFromDoc = (doc: OperationalDocument) => {
    setSelectedOperationalDoc(doc);
    setOperationalInvoiceData({
      invoice_number: '',
      invoice_date: format(new Date(), 'yyyy-MM-dd'),
      imponibile: doc.amount || 0,
      iva_rate: 22
    });
    setShowOperationalInvoiceDialog(true);
  };
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

  // Check for similar subjects when subject_name is extracted
  const checkAndMatchSubject = useCallback((subjectName: string, subjectType: SubjectType, subjectTaxId?: string) => {
    if (!subjectName.trim()) return;

    const normalizeTaxId = (v?: string) => (v ?? "").replace(/\s+/g, "").trim().toUpperCase();

    const subjectList = subjectType === 'cliente'
      ? customers.map(c => ({ id: c.id, name: c.company_name || c.name, tax_id: c.tax_id }))
      : suppliers.map(s => ({ id: s.id, name: s.name, tax_id: s.tax_id }));

    // Match by P.IVA first (se disponibile)
    const wantedTaxId = normalizeTaxId(subjectTaxId);
    if (wantedTaxId) {
      const taxIdMatch = subjectList.find(s => normalizeTaxId(s.tax_id ?? "") === wantedTaxId);
      if (taxIdMatch) {
        setFormData(prev => ({
          ...prev,
          subject_id: taxIdMatch.id,
          subject_name: taxIdMatch.name,
        }));
        toast.success(`${subjectType === 'cliente' ? 'Cliente' : 'Fornitore'} trovato (P.IVA): ${taxIdMatch.name}`);
        return;
      }
    }

    // Check for exact name match
    const exactMatch = subjectList.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
    if (exactMatch) {
      setFormData(prev => ({
        ...prev,
        subject_id: exactMatch.id,
        subject_name: exactMatch.name
      }));
      toast.success(`${subjectType === 'cliente' ? 'Cliente' : 'Fornitore'} trovato: ${exactMatch.name}`);
      return;
    }

    // Check for similar matches
    const matches = findSimilarSubjects(subjectName, subjectList, 0.5);
    if (matches.length > 0) {
      setPendingSubjectName(subjectName);
      setPendingSubjectType(subjectType);
      setSimilarMatches(matches);
      setSimilarDialogOpen(true);
    }
  }, [customers, suppliers]);

  // Handle similar subject dialog action
  const handleSimilarSubjectAction = async (action: SimilarSubjectAction, selectedMatch?: SubjectMatch) => {
    setIsCreatingSubject(true);
    try {
      if (action === 'use_existing' && selectedMatch) {
        setFormData(prev => ({
          ...prev,
          subject_id: selectedMatch.id,
          subject_name: selectedMatch.name
        }));
        toast.success(`Collegato a: ${selectedMatch.name}`);
      } else if (action === 'update_existing' && selectedMatch) {
        // Update the existing subject name
        const table = pendingSubjectType === 'cliente' ? 'customers' : 'suppliers';
        const { error } = await supabase
          .from(table)
          .update({ name: pendingSubjectName })
          .eq('id', selectedMatch.id);
        
        if (error) throw error;
        
        setFormData(prev => ({
          ...prev,
          subject_id: selectedMatch.id,
          subject_name: pendingSubjectName
        }));
        toast.success(`Nome aggiornato a: ${pendingSubjectName}`);
        queryClient.invalidateQueries({ queryKey: [pendingSubjectType === 'cliente' ? 'customers-list' : 'suppliers-list'] });
      } else if (action === 'create_new') {
        // Create new subject
        const table = pendingSubjectType === 'cliente' ? 'customers' : 'suppliers';
        const code = `${pendingSubjectType === 'cliente' ? 'CLI' : 'FOR'}-${Date.now().toString().slice(-6)}`;
        
        const { data: newSubject, error } = await supabase
          .from(table)
          .insert({
            name: pendingSubjectName,
            code: code
          })
          .select('id, name')
          .single();
        
        if (error) throw error;
        
        setFormData(prev => ({
          ...prev,
          subject_id: newSubject.id,
          subject_name: newSubject.name
        }));
        toast.success(`Nuovo ${pendingSubjectType === 'cliente' ? 'cliente' : 'fornitore'} creato: ${pendingSubjectName}`);
        queryClient.invalidateQueries({ queryKey: [pendingSubjectType === 'cliente' ? 'customers-list' : 'suppliers-list'] });
      }
      
      setSimilarDialogOpen(false);
    } catch (error) {
      console.error("Error handling similar subject action:", error);
      toast.error("Errore durante l'operazione");
    } finally {
      setIsCreatingSubject(false);
    }
  };

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

      // Determina se è un costo o un ricavo
      const isAcquisto = invoice.invoice_type === 'acquisto';
      const eventType = isAcquisto ? 'costo' : 'ricavo';
      const isPaid = ['pagata', 'incassata'].includes(invoice.financial_status);
      const paymentMethod = invoice.payment_method || 'bonifico';

      const { data: accountingEntry, error: accountingError } = await supabase
        .from('accounting_entries')
        .insert({
          amount: invoice.total_amount,
          imponibile: invoice.imponibile,
          iva_amount: invoice.iva_amount,
          iva_aliquota: invoice.iva_rate,
          direction: isAcquisto ? 'uscita' : 'entrata',
          document_type: 'fattura',
          document_date: invoice.invoice_date,
          status: 'classificato',
          event_type: eventType,
          financial_status: invoice.financial_status,
          subject_type: invoice.subject_type,
          iva_mode: 'DOMESTICA_IMPONIBILE',
          payment_method: isPaid ? paymentMethod : null,
          attachment_url: invoice.attachment_url || '',
          user_id: user?.user?.id,
          cost_center_id: invoice.cost_center_id || null,
          profit_center_id: invoice.profit_center_id || null,
          chart_account_id: isAcquisto ? invoice.cost_account_id : invoice.revenue_account_id
        })
        .select()
        .single();

      if (accountingError) throw accountingError;

      // L'importo è negativo per i costi, positivo per i ricavi
      const primaNotaAmount = isAcquisto ? -invoice.total_amount : invoice.total_amount;

      const { data: primaNota, error: primaNotaError } = await supabase
        .from('prima_nota')
        .insert({
          competence_date: invoice.invoice_date,
          movement_type: 'economico',
          description: `Fattura ${invoice.invoice_number} - ${invoice.subject_name}`,
          amount: primaNotaAmount,
          imponibile: invoice.imponibile,
          iva_amount: invoice.iva_amount,
          iva_aliquota: invoice.iva_rate,
          iva_mode: 'DOMESTICA_IMPONIBILE',
          payment_method: isPaid ? paymentMethod : null,
          status: 'registrato',
          accounting_entry_id: accountingEntry.id,
          cost_center_id: invoice.cost_center_id || null,
          profit_center_id: invoice.profit_center_id || null,
          chart_account_id: isAcquisto ? invoice.cost_account_id : invoice.revenue_account_id
        })
        .select()
        .single();

      if (primaNotaError) throw primaNotaError;

      // Genera le linee di partita doppia
      const primaNotaLines = [];
      let lineOrder = 1;

      if (isAcquisto) {
        // ACQUISTO (Costo)
        // DARE: Debiti vs fornitori / Banca = Totale
        primaNotaLines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: isPaid ? paymentMethod.toUpperCase() : 'DEBITI_FORNITORI',
          chart_account_id: null,
          dare: 0,
          avere: invoice.total_amount,
          description: isPaid ? `Pagamento ${paymentMethod}` : 'Debiti vs fornitori',
        });

        // AVERE: Costi = Imponibile
        primaNotaLines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'chart',
          chart_account_id: invoice.cost_account_id || null,
          dynamic_account_key: null,
          dare: invoice.imponibile,
          avere: 0,
          description: 'Costi',
        });

        // DARE: IVA a credito = IVA
        if (invoice.iva_amount > 0) {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'dynamic',
            dynamic_account_key: 'IVA_CREDITO',
            chart_account_id: null,
            dare: invoice.iva_amount,
            avere: 0,
            description: `IVA a credito ${invoice.iva_rate}%`,
          });
        }
      } else {
        // VENDITA (Ricavo)
        // DARE: Crediti vs clienti / Banca = Totale
        primaNotaLines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: isPaid ? paymentMethod.toUpperCase() : 'CREDITI_CLIENTI',
          chart_account_id: null,
          dare: invoice.total_amount,
          avere: 0,
          description: isPaid ? `Incasso ${paymentMethod}` : 'Crediti vs clienti',
        });

        // AVERE: Ricavi = Imponibile
        primaNotaLines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'chart',
          chart_account_id: invoice.revenue_account_id || null,
          dynamic_account_key: null,
          dare: 0,
          avere: invoice.imponibile,
          description: 'Ricavi',
        });

        // AVERE: IVA a debito = IVA
        if (invoice.iva_amount > 0) {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'dynamic',
            dynamic_account_key: 'IVA_DEBITO',
            chart_account_id: null,
            dare: 0,
            avere: invoice.iva_amount,
            description: `IVA a debito ${invoice.iva_rate}%`,
          });
        }
      }

      // Inserisci le linee di partita doppia
      if (primaNotaLines.length > 0) {
        const { error: linesError } = await supabase
          .from('prima_nota_lines')
          .insert(primaNotaLines);

        if (linesError) throw linesError;
      }

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

  // Mutation per eliminare dal registro contabile
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoice: InvoiceRegistry) => {
      // Elimina nell'ordine corretto rispettando le foreign keys
      
      // 1. Elimina invoice_registry (riferisce prima_nota)
      const { error: registryError } = await supabase
        .from('invoice_registry')
        .delete()
        .eq('id', invoice.id);
      if (registryError) throw registryError;

      // 2. Elimina prima_nota se esiste (riferisce accounting_entries)
      if (invoice.prima_nota_id) {
        const { error: primaNotaError } = await supabase
          .from('prima_nota')
          .delete()
          .eq('id', invoice.prima_nota_id);
        if (primaNotaError) throw primaNotaError;
      }

      // 3. Elimina accounting_entry se esiste
      if (invoice.accounting_entry_id) {
        const { error: entryError } = await supabase
          .from('accounting_entries')
          .delete()
          .eq('id', invoice.accounting_entry_id);
        if (entryError) throw entryError;
      }

      // 4. Elimina scadenza se esiste
      if (invoice.scadenza_id) {
        const { error: scadenzaError } = await supabase
          .from('scadenze')
          .delete()
          .eq('id', invoice.scadenza_id);
        if (scadenzaError) throw scadenzaError;
      }
    },
    onSuccess: () => {
      toast.success('Elemento eliminato dal registro contabile');
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['accounting-events'] });
    },
    onError: (error) => {
      toast.error('Errore eliminazione: ' + error.message);
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
      service_report_id: invoice.service_report_id || '',
      employee_id: '',
      employee_name: ''
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

  // Month names for grouping
  const MONTH_NAMES = [
    "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
  ];

  // Get available years from operational documents
  const availableYears = [...new Set(operationalDocuments
    .filter(d => d.date)
    .map(d => getYear(new Date(d.date)))
  )].sort((a, b) => b - a);

  // Operational documents stats - exclude archived from pending count
  const activeOperationalDocs = operationalDocuments.filter(d => !d.archived);
  const opStats = {
    total: activeOperationalDocs.length,
    invoiced: activeOperationalDocs.filter(d => d.invoiced).length,
    pending: activeOperationalDocs.filter(d => !d.invoiced).length,
    orders: activeOperationalDocs.filter(d => d.type === "order").length,
    ddts: activeOperationalDocs.filter(d => d.type === "ddt").length,
    reports: activeOperationalDocs.filter(d => d.type === "report").length
  };

  // Filter operational documents
  const filteredOperationalDocs = operationalDocuments.filter(doc => {
    const matchesSearch = !searchTerm || 
      doc.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.customer?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = opDocTypeFilter === "all" || doc.type === opDocTypeFilter;
    const matchesInvoice = opInvoiceFilter === "all" || 
      (opInvoiceFilter === "invoiced" && doc.invoiced) ||
      (opInvoiceFilter === "pending" && !doc.invoiced);
    
    // Archive filter: by default hide archived
    const matchesArchived = opArchivedFilter === "all" || 
      (opArchivedFilter === "active" && !doc.archived) ||
      (opArchivedFilter === "archived" && doc.archived);
    
    let matchesYear = true;
    if (opYearFilter !== "all" && doc.date) {
      matchesYear = getYear(new Date(doc.date)) === parseInt(opYearFilter);
    }
    
    let matchesMonth = true;
    if (opMonthFilter !== "all" && doc.date) {
      matchesMonth = getMonth(new Date(doc.date)) === parseInt(opMonthFilter);
    }
    
    return matchesSearch && matchesType && matchesInvoice && matchesYear && matchesMonth && matchesArchived;
  });

  // Group operational documents by year and month
  const groupedOpDocs = filteredOperationalDocs.reduce((acc, doc) => {
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
  }, {} as Record<string, { label: string; year: number; month: number; docs: OperationalDocument[] }>);

  // Sort periods by date descending
  const sortedPeriods = Object.entries(groupedOpDocs)
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

  const expandAllPeriods = () => {
    setExpandedPeriods(new Set(sortedPeriods.map(([key]) => key)));
  };

  const collapseAllPeriods = () => {
    setExpandedPeriods(new Set());
  };

  const getDocTypeIcon = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return <FileText className="h-4 w-4" />;
      case "ddt": return <Truck className="h-4 w-4" />;
      case "report": return <Wrench className="h-4 w-4" />;
    }
  };

  const getDocTypeLabel = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return "Ordine";
      case "ddt": return "DDT";
      case "report": return "Rapporto";
    }
  };

  const getDocTypeBadgeColor = (type: "order" | "ddt" | "report") => {
    switch (type) {
      case "order": return "bg-primary/10 text-primary";
      case "ddt": return "bg-blue-100 text-blue-700";
      case "report": return "bg-orange-100 text-orange-700";
    }
  };

  const stats = {
    bozze: invoices.filter(i => i.status === 'bozza').length,
    registrate: invoices.filter(i => i.status === 'registrata').length,
    daIncassare: invoices.filter(i => i.financial_status === 'da_incassare').reduce((sum, i) => sum + i.total_amount, 0),
    daPagare: invoices.filter(i => i.financial_status === 'da_pagare').reduce((sum, i) => sum + i.total_amount, 0),
    daClassificare: eventsToClassify.length,
    daFatturare: opStats.pending
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

  const getRegistryStatusBadge = (status: RegistryStatus) => {
    const statusConfig = REGISTRY_STATUSES.find(s => s.value === status);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
    
    const icon = {
      'da_classificare': <AlertCircle className="w-3 h-3 mr-1" />,
      'non_rilevante': <Clock className="w-3 h-3 mr-1" />,
      'contabilizzato': <CheckCircle2 className="w-3 h-3 mr-1" />,
      'archiviato': <FileCheck className="w-3 h-3 mr-1" />,
    }[status];
    
    return <Badge className={statusConfig.color}>{icon}{statusConfig.label}</Badge>;
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

      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card 
          className={`cursor-pointer transition-all ${filterType === 'da_fatturare' ? 'ring-2 ring-orange-500' : 'hover:bg-muted/50'}`}
          onClick={() => setFilterType(filterType === 'da_fatturare' ? 'all' : 'da_fatturare')}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Da Fatturare</p>
                <p className="text-2xl font-bold text-orange-500">{stats.daFatturare}</p>
              </div>
              <FileText className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
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
                <SelectItem value="da_fatturare">Da Fatturare</SelectItem>
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

      {/* Vista Documentazione Operativa */}
      {filterType === 'da_fatturare' ? (
        <div className="space-y-4">
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
                <div className="text-2xl font-bold">{opStats.pending}</div>
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
                <div className="text-2xl font-bold">{opStats.invoiced}</div>
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
                    {opStats.orders} Ordini
                  </span>
                  <span className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-blue-500" />
                    {opStats.ddts} DDT
                  </span>
                  <span className="flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-orange-500" />
                    {opStats.reports} Rapporti
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters for operational documents */}
          <div className="flex flex-wrap gap-4">
            <Select value={opYearFilter} onValueChange={setOpYearFilter}>
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
            <Select value={opMonthFilter} onValueChange={setOpMonthFilter}>
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
            <Select value={opDocTypeFilter} onValueChange={setOpDocTypeFilter}>
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
            <Select value={opInvoiceFilter} onValueChange={setOpInvoiceFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Stato fatturazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="pending">Da fatturare</SelectItem>
                <SelectItem value="invoiced">Fatturati</SelectItem>
              </SelectContent>
            </Select>
            <Select value={opArchivedFilter} onValueChange={setOpArchivedFilter}>
              <SelectTrigger className="w-[160px]">
                <Archive className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Archiviazione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Attivi</SelectItem>
                <SelectItem value="archived">Archiviati</SelectItem>
                <SelectItem value="all">Tutti</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Expand/Collapse controls */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={expandAllPeriods}>
              Espandi tutti
            </Button>
            <Button variant="outline" size="sm" onClick={collapseAllPeriods}>
              Comprimi tutti
            </Button>
          </div>

          {/* Documents grouped by period */}
          {isLoadingOperational ? (
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
                                  <TableCell>{doc.date ? format(new Date(doc.date), 'dd/MM/yyyy', { locale: it }) : '-'}</TableCell>
                                  <TableCell>
                                    {doc.amount ? `€${doc.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {doc.invoiced ? (
                                      <div className="flex flex-col">
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 w-fit">
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Fatturato
                                        </Badge>
                                        <span className="text-xs text-muted-foreground mt-1">
                                          {doc.invoice_number} - {doc.invoice_date ? format(new Date(doc.invoice_date), 'dd/MM/yyyy', { locale: it }) : '-'}
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
                                    <div className="flex items-center justify-end gap-1">
                                      {!doc.invoiced && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleCreateInvoiceFromDoc(doc)}
                                        >
                                          <Receipt className="h-4 w-4 mr-1" />
                                          Registra Fattura
                                        </Button>
                                      )}
                                      {!doc.archived && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => archiveDocMutation.mutate(doc)}
                                          title="Archivia documento"
                                        >
                                          <Archive className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
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
        </div>
      ) : filterType === 'da_classificare' ? (
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
                        {getRegistryStatusBadge((event.status as RegistryStatus) || 'da_classificare')}
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
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm('Sei sicuro di voler eliminare questo elemento dal registro contabile?')) {
                              deleteInvoiceMutation.mutate(invoice);
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
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
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={cn(
          "max-h-[90vh] overflow-y-auto",
          uploadedFile ? "max-w-5xl" : "max-w-2xl"
        )}>
          <DialogHeader>
            <DialogTitle>
              {isFiscalDocument(formData.event_type) ? 'Nuova Fattura' : 
               formData.event_type === 'spesa_dipendente' ? 'Nuova Spesa Dipendente' : 
               'Nuovo Incasso Dipendente'}
            </DialogTitle>
          </DialogHeader>
          
          <div className={cn(
            "flex gap-6",
            uploadedFile ? "flex-row" : "flex-col"
          )}>
            {/* Document Preview Panel */}
            {uploadedFile && (
              <div className="w-1/2 flex-shrink-0 space-y-2">
                <Label className="text-sm font-medium text-muted-foreground">Anteprima Documento</Label>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  {uploadedFile.url.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex flex-col items-center justify-center p-8 text-center">
                      <FileText className="w-16 h-16 text-muted-foreground mb-4" />
                      <p className="text-sm font-medium">{uploadedFile.name}</p>
                      <a 
                        href={uploadedFile.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-xs text-primary hover:underline mt-2"
                      >
                        Apri PDF in nuova scheda
                      </a>
                    </div>
                  ) : (
                    <a href={uploadedFile.url} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={uploadedFile.url} 
                        alt="Anteprima documento" 
                        className="w-full h-auto max-h-[60vh] object-contain"
                      />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground text-center">{uploadedFile.name}</p>
              </div>
            )}
            
            {/* Form Panel */}
            <div className={cn("space-y-4", uploadedFile ? "w-1/2" : "w-full")}>
          
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
            </div>
          </div>

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

              {/* Form per spese dipendenti - CAMPI OBBLIGATORI */}
              {formData.event_type === 'spesa_dipendente' && (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">Campi obbligatori per spese dipendente:</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo Spesa *</Label>
                      <Select value={formData.expense_type} onValueChange={(v) => setFormData(prev => ({ ...prev, expense_type: v }))}>
                        <SelectTrigger className={!formData.expense_type ? 'border-destructive' : ''}>
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
                      <Label>Centro di Costo *</Label>
                      <Select value={formData.cost_center_id} onValueChange={(v) => setFormData(prev => ({ ...prev, cost_center_id: v === "__none__" ? "" : v }))}>
                        <SelectTrigger className={!formData.cost_center_id ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Seleziona centro" />
                        </SelectTrigger>
                        <SelectContent>
                          {costCenters.map(cc => (
                            <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Metodo di Pagamento *</Label>
                      <Select value={formData.payment_method} onValueChange={(v) => setFormData(prev => ({ ...prev, payment_method: v }))}>
                        <SelectTrigger className={!formData.payment_method ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Seleziona metodo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map(pm => (
                            <SelectItem key={pm.value} value={pm.value}>{pm.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Dipendente che ha sostenuto la spesa *</Label>
                      <Select value={formData.employee_id} onValueChange={(v) => {
                        const emp = employees.find(e => e.id === v);
                        setFormData(prev => ({ 
                          ...prev, 
                          employee_id: v === "__none__" ? "" : v,
                          employee_name: emp ? emp.name : ""
                        }));
                      }}>
                        <SelectTrigger className={!formData.employee_id ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Seleziona dipendente" />
                        </SelectTrigger>
                        <SelectContent>
                          {employees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.name} {e.role ? `(${e.role})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Documento allegato (scontrino/ricevuta) *</Label>
                    {selectedEvent?.attachment_url ? (
                      <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className="text-sm">Documento presente</span>
                        <a 
                          href={selectedEvent.attachment_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline ml-auto"
                        >
                          Visualizza
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/30 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-destructive" />
                        <span className="text-sm text-destructive">Nessun documento allegato</span>
                      </div>
                    )}
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

              {/* Stato finale della registrazione */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Stato Finale *</Label>
                <Select 
                  value={formData.event_type === 'spesa_dipendente' || formData.event_type === 'incasso_dipendente' 
                    ? 'non_rilevante' 
                    : 'contabilizzato'}
                  disabled
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGISTRY_STATUSES.filter(s => s.value !== 'da_classificare').map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {formData.event_type === 'spesa_dipendente' || formData.event_type === 'incasso_dipendente' 
                    ? 'Spese/incassi dipendenti non generano contabilità ufficiale'
                    : 'Le fatture vengono contabilizzate automaticamente'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={async () => {
                if (!selectedEvent) return;
                try {
                  const { error } = await supabase
                    .from('accounting_entries')
                    .update({ 
                      status: 'non_rilevante',
                      classified_at: new Date().toISOString()
                    })
                    .eq('id', selectedEvent.id);
                  
                  if (error) throw error;
                  
                  toast.success('Marcato come non rilevante fiscalmente');
                  setShowClassifyDialog(false);
                  setSelectedEvent(null);
                  queryClient.invalidateQueries({ queryKey: ['accounting-entries-to-classify'] });
                } catch (err: any) {
                  toast.error('Errore: ' + err.message);
                }
              }}
            >
              Non Rilevante
            </Button>
            <Button variant="outline" onClick={() => setShowClassifyDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={async () => {
                if (!selectedEvent) return;
                try {
                  const isFiscal = isFiscalDocument(formData.event_type);
                  const newStatus: RegistryStatus = isFiscal ? 'contabilizzato' : 'non_rilevante';
                  
                  const { error } = await supabase
                    .from('accounting_entries')
                    .update({ 
                      status: newStatus,
                      event_type: formData.event_type,
                      cost_center_id: formData.cost_center_id || null,
                      profit_center_id: formData.profit_center_id || null,
                      classified_at: new Date().toISOString()
                    })
                    .eq('id', selectedEvent.id);
                  
                  if (error) throw error;
                  
                  toast.success(isFiscal ? 'Evento contabilizzato!' : 'Evento classificato');
                  setShowClassifyDialog(false);
                  setSelectedEvent(null);
                  queryClient.invalidateQueries({ queryKey: ['accounting-entries-to-classify'] });
                } catch (err: any) {
                  toast.error('Errore: ' + err.message);
                }
              }}
            >
              {isFiscalDocument(formData.event_type) ? 'Contabilizza' : 'Classifica'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog per creare fattura da documento operativo */}
      <Dialog open={showOperationalInvoiceDialog} onOpenChange={setShowOperationalInvoiceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registra Fattura da Documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedOperationalDoc && (
              <div className="bg-muted p-3 rounded-lg text-sm mb-4">
                <p><strong>Documento:</strong> {selectedOperationalDoc.type === 'order' ? 'Ordine' : selectedOperationalDoc.type === 'ddt' ? 'DDT' : 'Rapporto'} {selectedOperationalDoc.number}</p>
                <p><strong>Cliente:</strong> {selectedOperationalDoc.customer}</p>
                <p><strong>Importo:</strong> {selectedOperationalDoc.amount ? `€${selectedOperationalDoc.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Numero Fattura *</Label>
              <Input
                placeholder="Es. FT-2026/001"
                value={operationalInvoiceData.invoice_number}
                onChange={(e) => setOperationalInvoiceData(prev => ({ ...prev, invoice_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fattura</Label>
              <Input
                type="date"
                value={operationalInvoiceData.invoice_date}
                onChange={(e) => setOperationalInvoiceData(prev => ({ ...prev, invoice_date: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Imponibile</Label>
                <Input
                  type="number"
                  value={operationalInvoiceData.imponibile}
                  onChange={(e) => setOperationalInvoiceData(prev => ({ ...prev, imponibile: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Aliquota IVA %</Label>
                <Input
                  type="number"
                  value={operationalInvoiceData.iva_rate}
                  onChange={(e) => setOperationalInvoiceData(prev => ({ ...prev, iva_rate: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOperationalInvoiceDialog(false)}>Annulla</Button>
            <Button 
              onClick={() => selectedOperationalDoc && createInvoiceFromDocMutation.mutate(selectedOperationalDoc)}
              disabled={!operationalInvoiceData.invoice_number}
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Crea Fattura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Similar Subject Dialog */}
      <SimilarSubjectDialog
        open={similarDialogOpen}
        onOpenChange={setSimilarDialogOpen}
        newName={pendingSubjectName}
        matches={similarMatches}
        subjectType={pendingSubjectType}
        onAction={handleSimilarSubjectAction}
        isLoading={isCreatingSubject}
      />
    </div>
  );
}
