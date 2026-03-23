import React, { useState, useCallback, useMemo, useRef } from "react";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format, getYear, getMonth, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { AccountSplitManager } from "@/components/management-control/AccountSplitManager";
import { useAllOperationalDocuments, OperationalDocument } from "@/hooks/useOperationalDocuments";
import { findSimilarSubjects, SubjectMatch } from "@/lib/fuzzyMatch";
import { SimilarSubjectDialog, SimilarSubjectAction } from "@/components/shared/SimilarSubjectDialog";
import { RegistryFiltersBar } from "@/components/registro-contabile/RegistryFiltersBar";
import { BulkAIClassificationDialog } from "@/components/registro-contabile/BulkAIClassificationDialog";
import { InvoiceRegistryTable } from "@/components/registro-contabile/InvoiceRegistryTable";

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
  Archive,
  RefreshCw,
  Undo2,
  Lock,
  UserPlus,
  ArrowLeftRight,
  Sparkles,
  Brain,
  Eye,
  ExternalLink
} from "lucide-react";
import { AttachmentPreview } from "@/components/warehouse/AttachmentPreview";

interface AccountSplitLine {
  id: string;
  account_id: string;
  amount: number;
  percentage: number;
  cost_center_id?: string;
  profit_center_id?: string;
}

// Interfaccia per scadenze multiple
interface ScadenzaLine {
  id: string;
  due_date: string;
  amount: number;
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
  status: RegistryStatus;
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
  // Split conti economici (JSON dal database)
  account_splits?: AccountSplitLine[] | null | unknown;
  // Campi audit storno
  stornato?: boolean;
  data_storno?: string | null;
  utente_storno?: string | null;
  motivo_storno?: string | null;
  scrittura_stornata_id?: string | null;
  scrittura_storno_id?: string | null;
  contabilizzazione_valida?: boolean;
  periodo_chiuso?: boolean;
  evento_lockato?: boolean;
}

// Tipi evento del registro contabile
type EventType = 'fattura_acquisto' | 'fattura_vendita' | 'nota_credito';
type InvoiceType = 'vendita' | 'acquisto' | 'nota_credito';
type SubjectType = 'cliente' | 'fornitore';
type VatRegime = 'domestica_imponibile' | 'ue_non_imponibile' | 'extra_ue' | 'reverse_charge';
type FinancialStatus = 'da_incassare' | 'da_pagare' | 'parzialmente_incassata' | 'parzialmente_pagata' | 'incassata' | 'pagata';

// Stati obbligatori del registro contabile
type RegistryStatus = 'bozza' | 'registrata' | 'da_classificare' | 'da_riclassificare' | 'non_rilevante' | 'contabilizzato' | 'rettificato' | 'archiviato';

const REGISTRY_STATUSES = [
  { value: 'bozza', label: 'Bozza', color: 'bg-slate-500/20 text-slate-600 border-slate-500/30' },
  { value: 'registrata', label: 'Registrata', color: 'bg-primary/20 text-primary border-primary/30' },
  { value: 'da_classificare', label: 'Da Annotare', color: 'bg-amber-500/20 text-amber-600 border-amber-500/30' },
  { value: 'da_riclassificare', label: 'Da Riclassificare', color: 'bg-orange-500/20 text-orange-600 border-orange-500/30' },
  { value: 'non_rilevante', label: 'Non Rilevante Fiscalmente', color: 'bg-gray-500/20 text-gray-600 border-gray-500/30' },
  { value: 'contabilizzato', label: 'Contabilizzato', color: 'bg-green-500/20 text-green-600 border-green-500/30' },
  { value: 'rettificato', label: 'Rettificato (Bloccato)', color: 'bg-red-500/20 text-red-600 border-red-500/30' },
  { value: 'archiviato', label: 'Archiviato', color: 'bg-blue-500/20 text-blue-600 border-blue-500/30' },
];

// Metodi di pagamento/incasso
const PAYMENT_METHODS = [
  { value: 'bonifico', label: 'Bonifico Bancario' },
  { value: 'banca', label: 'Banca (altro)' },
  { value: 'carta', label: 'Carta' },
  { value: 'american_express', label: 'American Express' },
  { value: 'carta_aziendale', label: 'Carta Aziendale' },
  { value: 'contanti', label: 'Contanti' },
  { value: 'cassa', label: 'Cassa' },
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
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [scadenzaResiduo, setScadenzaResiduo] = useState<number | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'bonifico',
    notes: '',
    is_partial: false
  });
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
  
  // Scadenze multiple states
  const [scadenzeLines, setScadenzeLines] = useState<ScadenzaLine[]>([]);
  const [editScadenzeLines, setEditScadenzeLines] = useState<ScadenzaLine[]>([]);
  
  // Subject search states
  const [subjectSearchOpen, setSubjectSearchOpen] = useState(false);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [editSubjectSearchOpen, setEditSubjectSearchOpen] = useState(false);
  const [editSubjectSearch, setEditSubjectSearch] = useState("");
  
  // Drag & drop AI states - multi file queue
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [uploadQueue, setUploadQueue] = useState<{ file: File; status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error'; result?: any; error?: string }[]>([]);
  const [showUploadProgress, setShowUploadProgress] = useState(false);
  const [currentUploadIndex, setCurrentUploadIndex] = useState(0);
  
  // Similar subject dialog states
  const [similarDialogOpen, setSimilarDialogOpen] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<SubjectMatch[]>([]);
  const [pendingSubjectName, setPendingSubjectName] = useState("");
  const [pendingSubjectType, setPendingSubjectType] = useState<"cliente" | "fornitore">("fornitore");
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const costCentersRef = useRef<any[]>([]);
  const accountsRef = useRef<any[]>([]);
  
  // Invoice details dialog
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [detailsInvoice, setDetailsInvoice] = useState<InvoiceRegistry | null>(null);
  
  // Stato per mostrare la vista documenti operativi (separato dai filtri)
  const [showOperationalDocs, setShowOperationalDocs] = useState(false);
  
  // Navigazione per periodo (mese o giorno)
  type ViewMode = 'month' | 'day';
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const [selectedPeriod, setSelectedPeriod] = useState<Date>(new Date());
  
  // Stato per il dialog di conferma fattura duplicata
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateInvoiceInfo, setDuplicateInvoiceInfo] = useState<{ number: string; existing: InvoiceRegistry | null }>({ number: '', existing: null });

  // Stato per duplicati durante upload (singolo e bulk)
  const [showBulkDuplicateAlert, setShowBulkDuplicateAlert] = useState(false);
  const [bulkDuplicateInfo, setBulkDuplicateInfo] = useState<{ fileName: string; invoiceNumber: string; existing: InvoiceRegistry | null }>({ fileName: '', invoiceNumber: '', existing: null });
  const bulkDuplicateResolveRef = useRef<((action: 'replace' | 'skip') => void) | null>(null);
  
  // AI Accounting Analysis states
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    cost_account_id?: string;
    revenue_account_id?: string;
    cost_center_id?: string;
    profit_center_id?: string;
    vat_regime?: string;
    iva_rate?: number;
    financial_status?: string;
    reasoning?: string;
    confidence?: string;
    warnings?: string[];
  } | null>(null);

  // Bulk AI classification state
  const [showBulkAIDialog, setShowBulkAIDialog] = useState(false);
  const checkDuplicateInvoice = async (invoiceNumber: string): Promise<InvoiceRegistry | null> => {
    if (!invoiceNumber || invoiceNumber.startsWith('DOC-')) return null;
    const { data } = await supabase
      .from('invoice_registry')
      .select('*')
      .eq('invoice_number', invoiceNumber);
    const valid = data?.find((inv: any) => inv.contabilizzazione_valida !== false);
    return (valid as InvoiceRegistry) || null;
  };

  // Show duplicate dialog and wait for user response
  const askDuplicateAction = (fileName: string, invoiceNumber: string, existing: InvoiceRegistry): Promise<'replace' | 'skip'> => {
    return new Promise((resolve) => {
      bulkDuplicateResolveRef.current = resolve;
      setBulkDuplicateInfo({ fileName, invoiceNumber, existing });
      setShowBulkDuplicateAlert(true);
    });
  };

  // Process a single file: upload to storage + AI analysis
  const processSingleFile = useCallback(async (file: File): Promise<{ extracted: any; fileUrl: string; subjectResult: any } | null> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `invoices/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const isXml = file.type === "text/xml" || file.type === "application/xml" || 
      file.name.toLowerCase().endsWith(".xml") || file.name.toLowerCase().endsWith(".p7m");

    const { error: uploadError } = await supabase.storage
      .from("accounting-attachments")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("accounting-attachments")
      .getPublicUrl(fileName);

    let analysisUrl: string | null = urlData.publicUrl;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    // For PDFs, generate a PNG preview for vision analysis
    if (isPdf && !isXml) {
      try {
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
      }
    }

    if (!analysisUrl) return null;

    const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
      "analyze-invoice",
      { body: { imageUrl: analysisUrl, fileType: file.type, fileName: file.name } }
    );

    if (analysisError) throw analysisError;
    if (!analysisData?.success || !analysisData?.data) return null;

    return {
      extracted: analysisData.data,
      fileUrl: urlData.publicUrl,
      subjectResult: analysisData.subjectResult || null,
    };
  }, []);

  // Apply extracted data to form - costCenters/accounts passed as params to avoid hoisting issues
  const applyExtractedToForm = useCallback((extracted: any, fileUrl: string, subjectResult: any, costCentersList?: any[], accountsList?: any[]) => {
    const normalize = (v?: string) => (v ?? "").toLowerCase().trim();
    const normalizeTaxId = (v?: string) => (v ?? "").replace(/\s+/g, "").trim();

    const isOurCompany = (name?: string, taxId?: string) => {
      const n = normalize(name);
      const t = normalizeTaxId(taxId);
      return n.includes("climatel") || t === "03895390650";
    };

    const supplierName: string = extracted.supplier_name || "";
    const supplierTaxId: string = extracted.supplier_tax_id || "";
    const customerName: string = extracted.customer_name || "";
    const customerTaxId: string = extracted.customer_tax_id || "";

    const isPurchase = isOurCompany(customerName, customerTaxId) && !isOurCompany(supplierName, supplierTaxId);
    const isSale = isOurCompany(supplierName, supplierTaxId) && !isOurCompany(customerName, customerTaxId);

    let invoiceType: InvoiceType = 'acquisto';
    if (extracted.invoice_type === 'nota_credito') invoiceType = 'nota_credito';
    else if (isPurchase) invoiceType = 'acquisto';
    else if (isSale) invoiceType = 'vendita';
    else if (extracted.invoice_type) invoiceType = extracted.invoice_type;

    let eventType: EventType = invoiceType === 'vendita' ? 'fattura_vendita' : 'fattura_acquisto';
    let subjectType: SubjectType = invoiceType === 'vendita' ? 'cliente' : 'fornitore';
    let financialStatus: FinancialStatus = subjectType === 'cliente' ? 'da_incassare' : 'da_pagare';

    if (invoiceType === 'nota_credito') {
      eventType = 'nota_credito';
      subjectType = isSale ? 'cliente' : isPurchase ? 'fornitore' : 'fornitore';
      financialStatus = subjectType === 'fornitore' ? 'da_incassare' : 'da_pagare';
    }

    const counterpartName = invoiceType === 'vendita' ? customerName : supplierName;
    const counterpartTaxId = invoiceType === 'vendita' ? customerTaxId : supplierTaxId;

    const mapPaymentMethod = (aiMethod?: string): string => {
      if (!aiMethod) return '';
      const map: Record<string, string> = { 'bonifico': 'bonifico', 'carta': 'carta', 'contanti': 'contanti', 'assegno': 'assegno', 'pos': 'pos' };
      return map[aiMethod.toLowerCase()] || '';
    };

    const findCostCenter = (hint?: string): string => {
      const centers = costCentersList ?? costCentersRef.current;
      if (!hint || !centers || centers.length === 0) return '';
      const hintLower = hint.toLowerCase();
      const match = centers.find((cc: any) => cc.name.toLowerCase().includes(hintLower) || hintLower.includes(cc.name.toLowerCase()));
      return match?.id || '';
    };

    const findAccount = (accountHint?: string): string => {
      const accs = accountsList ?? accountsRef.current;
      if (!accountHint || !accs || accs.length === 0) return '';
      const hintLower = accountHint.toLowerCase();
      const match = accs.find((acc: any) => acc.name.toLowerCase().includes(hintLower) || hintLower.includes(acc.name.toLowerCase()));
      return match?.id || '';
    };

    let subjectId = '';
    let subjectName = counterpartName;
    if (subjectResult) {
      subjectId = subjectResult.id;
      if (subjectResult.name) subjectName = subjectResult.name;
    }

    setFormData(prev => ({
      ...prev,
      event_type: eventType,
      invoice_number: extracted.invoice_number || prev.invoice_number,
      invoice_date: extracted.invoice_date || format(new Date(), 'yyyy-MM-dd'),
      invoice_type: invoiceType,
      subject_type: subjectType,
      subject_id: subjectId,
      subject_name: subjectName || prev.subject_name,
      imponibile: extracted.imponibile || prev.imponibile,
      iva_rate: extracted.iva_rate ?? prev.iva_rate,
      vat_regime: extracted.vat_regime || prev.vat_regime,
      financial_status: financialStatus,
      due_date: extracted.due_date || prev.due_date,
      payment_method: mapPaymentMethod(extracted.payment_method) || prev.payment_method,
      cost_center_id: findCostCenter(extracted.cost_center_hint) || prev.cost_center_id,
      cost_account_id: findAccount(extracted.account_hint) || prev.cost_account_id,
      expense_type: extracted.expense_category || prev.expense_type,
      notes: extracted.invoice_description ? `Oggetto: ${extracted.invoice_description}` : prev.notes,
      attachment_url: fileUrl,
    }));

    if (!subjectResult && counterpartName) {
      setTimeout(() => {
        checkAndMatchSubject(counterpartName, subjectType, counterpartTaxId);
      }, 500);
    }
  }, []);

  // Handle single file upload (opens create dialog)
  const handleFileUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      setIsAnalyzing(true);
      toast.info("Analizzo il documento con AI...");

      const result = await processSingleFile(file);
      if (result) {
        // Note: costCenters/accounts will be available by the time user triggers upload
        applyExtractedToForm(result.extracted, result.fileUrl, result.subjectResult);
        setUploadedFile({ name: file.name, url: result.fileUrl });
        
        if (result.subjectResult?.action === 'created') {
          toast.success(`Nuovo ${result.subjectResult.type} creato: ${result.subjectResult.name}`);
          queryClient.invalidateQueries({ queryKey: [result.subjectResult.type === 'cliente' ? 'customers-list' : 'suppliers-list'] });
        } else if (result.subjectResult?.action === 'matched') {
          toast.success(`${result.subjectResult.type === 'cliente' ? 'Cliente' : 'Fornitore'} trovato e aggiornato`);
        }

        const confidence = result.extracted.confidence;
        if (confidence === "high") toast.success("Documento analizzato con successo!");
        else if (confidence === "medium") toast.info("Documento analizzato, verifica i dati");
        else toast.info("Alcuni dati potrebbero essere incompleti");
      } else {
        toast.error("Non è stato possibile analizzare il documento");
      }

      setShowCreateDialog(true);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Errore durante il caricamento");
    } finally {
      setIsUploading(false);
      setIsAnalyzing(false);
    }
  }, [processSingleFile, applyExtractedToForm, queryClient]);

  // Handle multi-file upload: process each file, save directly
  const handleMultiFileUpload = useCallback(async (files: File[]) => {
    if (files.length === 1) {
      handleFileUpload(files[0]);
      return;
    }

    const queue = files.map(f => ({ file: f, status: 'pending' as const }));
    setUploadQueue(queue);
    setShowUploadProgress(true);
    setCurrentUploadIndex(0);

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      setCurrentUploadIndex(i);
      setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'uploading' } : item));

      try {
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'analyzing' } : item));

        const result = await processSingleFile(files[i]);
        if (!result) {
          setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: 'Analisi fallita' } : item));
          errorCount++;
          continue;
        }

        const extracted = result.extracted;
        const normalize = (v?: string) => (v ?? "").toLowerCase().trim();
        const normalizeTaxId = (v?: string) => (v ?? "").replace(/\s+/g, "").trim();
        const isOurCompany = (name?: string, taxId?: string) => {
          const n = normalize(name);
          const t = normalizeTaxId(taxId);
          return n.includes("climatel") || t === "03895390650";
        };

        const supplierName = extracted.supplier_name || "";
        const supplierTaxId = extracted.supplier_tax_id || "";
        const customerName = extracted.customer_name || "";
        const customerTaxId = extracted.customer_tax_id || "";
        const isPurchase = isOurCompany(customerName, customerTaxId);
        const isSale = isOurCompany(supplierName, supplierTaxId);

        let invoiceType: InvoiceType = 'acquisto';
        if (extracted.invoice_type === 'nota_credito') invoiceType = 'nota_credito';
        else if (isPurchase) invoiceType = 'acquisto';
        else if (isSale) invoiceType = 'vendita';
        else if (extracted.invoice_type) invoiceType = extracted.invoice_type;

        const subjectType: SubjectType = invoiceType === 'vendita' ? 'cliente' : 'fornitore';
        const financialStatus: FinancialStatus = subjectType === 'cliente' ? 'da_incassare' : 'da_pagare';
        const counterpartName = invoiceType === 'vendita' ? customerName : supplierName;
        const ivaAmount = (extracted.imponibile || 0) * ((extracted.iva_rate || 22) / 100);
        const totalAmount = (extracted.imponibile || 0) + ivaAmount;

        const { data: user } = await supabase.auth.getUser();

        // Check for duplicate invoice
        const invoiceNum = extracted.invoice_number || `DOC-${Date.now()}`;
        const existingDuplicate = await checkDuplicateInvoice(invoiceNum);
        if (existingDuplicate) {
          const action = await askDuplicateAction(files[i].name, invoiceNum, existingDuplicate);
          if (action === 'skip') {
            setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: 'Duplicato saltato' } : item));
            errorCount++;
            continue;
          }
          // Replace: delete the old record first
          await supabase.from('invoice_registry').delete().eq('id', existingDuplicate.id);
        }

        // Save directly to invoice_registry
        const { error: insertError } = await supabase.from('invoice_registry').insert({
          invoice_number: extracted.invoice_number || `DOC-${Date.now()}`,
          invoice_date: extracted.invoice_date || format(new Date(), 'yyyy-MM-dd'),
          invoice_type: invoiceType,
          subject_type: subjectType,
          subject_id: result.subjectResult?.id || null,
          subject_name: result.subjectResult?.name || counterpartName || 'Sconosciuto',
          imponibile: extracted.imponibile || 0,
          iva_rate: extracted.iva_rate ?? 22,
          iva_amount: extracted.iva_amount || ivaAmount,
          total_amount: extracted.total_amount || totalAmount,
          vat_regime: extracted.vat_regime || 'domestica_imponibile',
          status: 'bozza',
          financial_status: financialStatus,
          due_date: extracted.due_date || null,
          payment_method: extracted.payment_method || null,
          notes: extracted.invoice_description ? `Oggetto: ${extracted.invoice_description}` : null,
          attachment_url: result.fileUrl,
          created_by: user?.user?.id,
        });

        if (insertError) throw insertError;

        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'done', result: extracted } : item));
        successCount++;

        if (result.subjectResult?.action === 'created') {
          queryClient.invalidateQueries({ queryKey: [result.subjectResult.type === 'cliente' ? 'customers-list' : 'suppliers-list'] });
        }

        // Small delay between files to avoid rate limits
        if (i < files.length - 1) {
          await new Promise(r => setTimeout(r, 1000));
        }
      } catch (err: any) {
        console.error(`Error processing file ${files[i].name}:`, err);
        setUploadQueue(prev => prev.map((item, idx) => idx === i ? { ...item, status: 'error', error: err.message || 'Errore' } : item));
        errorCount++;
      }
    }

    queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
    queryClient.invalidateQueries({ queryKey: ['scadenze-stats'] });

    if (successCount > 0) toast.success(`${successCount} documenti registrati con successo`);
    if (errorCount > 0) toast.error(`${errorCount} documenti con errori`);
  }, [handleFileUpload, processSingleFile, queryClient]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) handleMultiFileUpload(acceptedFiles);
  }, [handleMultiFileUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [],
      "application/pdf": [],
      "text/xml": [],
      "application/xml": [],
    },
    maxFiles: 20,
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

  // Keep latest lookup data available for upload callbacks
  costCentersRef.current = costCenters as any[];
  accountsRef.current = accounts as any[];

  // Fetch scadenze per statistiche finanziarie accurate
  const { data: scadenzeStats } = useQuery({
    queryKey: ['scadenze-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scadenze')
        .select('tipo, importo_residuo, stato')
        .not('stato', 'in', '("chiusa","saldata")');
      if (error) throw error;
      
      const crediti = data
        .filter(s => s.tipo === 'credito')
        .reduce((sum, s) => sum + Number(s.importo_residuo), 0);
      const debiti = data
        .filter(s => s.tipo === 'debito')
        .reduce((sum, s) => sum + Number(s.importo_residuo), 0);
      
      return { crediti, debiti };
    }
  });

  // Fetch DDTs for linking
  const { data: ddts = [] } = useQuery({
    queryKey: ['ddts-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ddts')
        .select('id, ddt_number, created_at, customer:customer_id(id, name, company_name), ddt_data')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    }
  });

  // Fetch sales orders for linking (with customer info)
  const { data: salesOrders = [] } = useQuery({
    queryKey: ['sales-orders-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('id, number, order_date, created_at, customer:customer_id(id, name, company_name)')
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
        .select('id, intervention_type, intervention_date, technician_name, customer:customer_id(id, name, company_name)')
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
  const [opInvoiceFilter, setOpInvoiceFilter] = useState("pending"); // Default: mostra solo da fatturare
  const [opYearFilter, setOpYearFilter] = useState<string>("all"); // All years by default
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

  // Funzioni per gestire scadenze multiple
  const addScadenzaLine = () => {
    const { totalAmount } = calculateAmounts(formData.imponibile, formData.iva_rate);
    const existingTotal = scadenzeLines.reduce((sum, s) => sum + s.amount, 0);
    const remaining = totalAmount - existingTotal;
    
    setScadenzeLines([...scadenzeLines, {
      id: crypto.randomUUID(),
      due_date: formData.due_date || format(new Date(), 'yyyy-MM-dd'),
      amount: Math.max(0, remaining)
    }]);
  };

  const removeScadenzaLine = (id: string) => {
    setScadenzeLines(scadenzeLines.filter(s => s.id !== id));
  };

  const updateScadenzaLine = (id: string, field: 'due_date' | 'amount', value: string | number) => {
    setScadenzeLines(scadenzeLines.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const getScadenzeTotal = () => scadenzeLines.reduce((sum, s) => sum + s.amount, 0);

  // Stesso per edit
  const addEditScadenzaLine = () => {
    const { totalAmount } = calculateAmounts(editFormData.imponibile, editFormData.iva_rate);
    const existingTotal = editScadenzeLines.reduce((sum, s) => sum + s.amount, 0);
    const remaining = totalAmount - existingTotal;
    
    setEditScadenzeLines([...editScadenzeLines, {
      id: crypto.randomUUID(),
      due_date: editFormData.due_date || format(new Date(), 'yyyy-MM-dd'),
      amount: Math.max(0, remaining)
    }]);
  };

  const removeEditScadenzaLine = (id: string) => {
    setEditScadenzeLines(editScadenzeLines.filter(s => s.id !== id));
  };

  const updateEditScadenzaLine = (id: string, field: 'due_date' | 'amount', value: string | number) => {
    setEditScadenzeLines(editScadenzeLines.map(s => 
      s.id === id ? { ...s, [field]: value } : s
    ));
  };

  const getEditScadenzeTotal = () => editScadenzeLines.reduce((sum, s) => sum + s.amount, 0);

  // Funzione per controllare fatture duplicate prima di salvare
  const checkDuplicateAndSave = async () => {
    if (!formData.invoice_number) return;
    
    // Cerca fatture con lo stesso numero (escludendo quelle stornate senza nuova contabilizzazione)
    const { data: existingInvoices } = await supabase
      .from('invoice_registry')
      .select('*')
      .eq('invoice_number', formData.invoice_number)
      .neq('status', 'bozza');
    
    const validExisting = existingInvoices?.find(inv => 
      inv.contabilizzazione_valida !== false
    );
    
    if (validExisting) {
      // Mostra alert di conferma
      setDuplicateInvoiceInfo({ 
        number: formData.invoice_number, 
        existing: validExisting as InvoiceRegistry 
      });
      setShowDuplicateAlert(true);
    } else {
      // Nessun duplicato, procedi
      createMutation.mutate({ ...formData, accountSplits: splitEnabled ? splitLines : undefined });
    }
  };

  const confirmSaveDuplicate = () => {
    setShowDuplicateAlert(false);
    createMutation.mutate({ ...formData, accountSplits: splitEnabled ? splitLines : undefined });
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData & { accountSplits?: AccountSplitLine[] }) => {
      const { ivaAmount, totalAmount } = calculateAmounts(data.imponibile, data.iva_rate);
      const { data: user } = await supabase.auth.getUser();
      
      // Prepara lo split per il salvataggio (rimuovi id temporanei)
      const splitsToSave = data.accountSplits && data.accountSplits.length > 0
        ? data.accountSplits.map(s => ({
            account_id: s.account_id,
            amount: s.amount,
            percentage: s.percentage,
            cost_center_id: s.cost_center_id || null,
            profit_center_id: s.profit_center_id || null
          }))
        : null;

      // Validazione: se c'è split, ogni riga deve avere conto e centro
      if (splitsToSave && splitsToSave.length > 0) {
        const isAcquisto = data.invoice_type === 'acquisto';
        for (let i = 0; i < splitsToSave.length; i++) {
          const split = splitsToSave[i];
          if (!split.account_id || split.account_id.trim() === '') {
            throw new Error(`Riga ${i + 1} dello split: seleziona un Conto Economico.`);
          }
          if (isAcquisto) {
            if (!split.cost_center_id) {
              throw new Error(`Riga ${i + 1} dello split: seleziona un Centro di Costo.`);
            }
          } else {
            if (!split.profit_center_id) {
              throw new Error(`Riga ${i + 1} dello split: seleziona un Centro di Ricavo.`);
            }
          }
        }
      }
      
      // Se c'è split, NON usare i valori singoli di conto/centro (usare solo lo split)
      const hasSplit = splitsToSave && splitsToSave.length > 0;
      
      const { error } = await supabase
        .from('invoice_registry')
        .insert({
          invoice_number: data.invoice_number || `MOV-${Date.now()}`,
          invoice_date: data.invoice_date,
          invoice_type: data.invoice_type,
          subject_type: data.subject_type,
          subject_id: data.subject_id || null,
          subject_name: data.subject_name || 'Movimento manuale',
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
          // Se c'è split, i campi singoli devono essere null (usa solo split)
          cost_center_id: hasSplit ? null : (data.cost_center_id || null),
          profit_center_id: hasSplit ? null : (data.profit_center_id || null),
          cost_account_id: hasSplit ? null : (data.cost_account_id || null),
          revenue_account_id: hasSplit ? null : (data.revenue_account_id || null),
          notes: data.notes || null,
          created_by: user?.user?.id,
          account_splits: splitsToSave
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Movimento salvato');
      setShowCreateDialog(false);
      setFormData(initialFormData);
      setSplitEnabled(false);
      setSplitLines([]);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-stats'] });
    },
    onError: (error) => {
      toast.error('Errore nel salvataggio: ' + error.message);
    }
  });

  const registerMutation = useMutation({
    mutationFn: async (params: { invoice: InvoiceRegistry; scadenze?: ScadenzaLine[] }) => {
      const { invoice, scadenze = [] } = params;
      const { data: user } = await supabase.auth.getUser();
      const now = new Date().toISOString();

      // Determina se è un costo o un ricavo
      const isAcquisto = invoice.invoice_type === 'acquisto';
      const eventType = isAcquisto ? 'costo' : 'ricavo';
      const isPaid = ['pagata', 'incassata'].includes(invoice.financial_status);
      const paymentMethod = invoice.payment_method || 'bonifico';
      
      // Verifica se c'è uno split - se sì, NON usare i valori singoli del form
      const validatedAccountSplits = (Array.isArray(invoice.account_splits) ? invoice.account_splits : [])
        .filter((s: any) => Number(s?.amount ?? 0) !== 0)
        .map((s: any) => ({
          ...s,
          account_id: typeof s?.account_id === 'string' ? s.account_id.trim() : s?.account_id,
        }));

      const invalidSplitIndex = validatedAccountSplits.findIndex(
        (s: any) => !s?.account_id || String(s.account_id).trim() === ''
      );

      if (invalidSplitIndex !== -1) {
        throw new Error(
          `Split contabile incompleto: seleziona un conto per la riga ${invalidSplitIndex + 1} (Modifica fattura → Split).`
        );
      }

      const hasAccountSplit = validatedAccountSplits.length > 0;

      // Converte subject_id vuoto in null per evitare errori UUID
      const economicSubjectId = invoice.subject_id && invoice.subject_id.trim() !== '' ? invoice.subject_id : null;

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
          economic_subject_type: invoice.subject_type,
          economic_subject_id: economicSubjectId,
          iva_mode: 'DOMESTICA_IMPONIBILE',
          payment_method: isPaid ? paymentMethod : null,
          attachment_url: invoice.attachment_url || '',
          user_id: user?.user?.id,
          // Se c'è split, non usare i campi singoli (usa solo split lines)
          cost_center_id: hasAccountSplit ? null : (invoice.cost_center_id && invoice.cost_center_id.trim() !== '' ? invoice.cost_center_id : null),
          profit_center_id: hasAccountSplit ? null : (invoice.profit_center_id && invoice.profit_center_id.trim() !== '' ? invoice.profit_center_id : null),
          chart_account_id: hasAccountSplit ? null : (isAcquisto 
            ? (invoice.cost_account_id && invoice.cost_account_id.trim() !== '' ? invoice.cost_account_id : null)
            : (invoice.revenue_account_id && invoice.revenue_account_id.trim() !== '' ? invoice.revenue_account_id : null))
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
          // Se c'è split, non usare i campi singoli (usa solo split lines)
          cost_center_id: hasAccountSplit ? null : (invoice.cost_center_id && invoice.cost_center_id.trim() !== '' ? invoice.cost_center_id : null),
          profit_center_id: hasAccountSplit ? null : (invoice.profit_center_id && invoice.profit_center_id.trim() !== '' ? invoice.profit_center_id : null),
          chart_account_id: hasAccountSplit ? null : (isAcquisto 
            ? (invoice.cost_account_id && invoice.cost_account_id.trim() !== '' ? invoice.cost_account_id : null)
            : (invoice.revenue_account_id && invoice.revenue_account_id.trim() !== '' ? invoice.revenue_account_id : null))
        })
        .select()
        .single();

      if (primaNotaError) throw primaNotaError;

      // Genera le linee di partita doppia
      const primaNotaLines: any[] = [];
      let lineOrder = 1;
      
      // Recupera lo split se presente (già validato sopra)
      const accountSplits = validatedAccountSplits;
      const hasSplit = accountSplits.length > 0;

      if (isAcquisto) {
        // ACQUISTO (Costo)
        // AVERE: Debiti vs fornitori / Banca = Totale
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

        // DARE: Costi - usa split se presente
        if (hasSplit) {
          for (const split of accountSplits) {
            const account = accounts.find(a => a.id === split.account_id);
            primaNotaLines.push({
              prima_nota_id: primaNota.id,
              line_order: lineOrder++,
              account_type: 'chart',
              chart_account_id: split.account_id,
              dynamic_account_key: null,
              dare: split.amount,
              avere: 0,
              description: account?.name || 'Costi',
            });
          }
        } else {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'chart',
            chart_account_id: invoice.cost_account_id && invoice.cost_account_id.trim() !== '' ? invoice.cost_account_id : null,
            dynamic_account_key: null,
            dare: invoice.imponibile,
            avere: 0,
            description: 'Costi',
          });
        }

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

        // AVERE: Ricavi - usa split se presente
        if (hasSplit) {
          for (const split of accountSplits) {
            const account = accounts.find(a => a.id === split.account_id);
            primaNotaLines.push({
              prima_nota_id: primaNota.id,
              line_order: lineOrder++,
              account_type: 'chart',
              chart_account_id: split.account_id,
              dynamic_account_key: null,
              dare: 0,
              avere: split.amount,
              description: account?.name || 'Ricavi',
            });
          }
        } else {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'chart',
            chart_account_id: invoice.revenue_account_id && invoice.revenue_account_id.trim() !== '' ? invoice.revenue_account_id : null,
            dynamic_account_key: null,
            dare: 0,
            avere: invoice.imponibile,
            description: 'Ricavi',
          });
        }

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

      // Creazione scadenze (singola o multiple)
      let scadenzaIds: string[] = [];
      if (invoice.financial_status === 'da_incassare' || invoice.financial_status === 'da_pagare') {
        const tipo = invoice.invoice_type === 'acquisto' ? 'debito' : 'credito';
        
        // Se ci sono scadenze multiple, crea una per ciascuna
        if (scadenze.length > 0) {
          for (const scad of scadenze) {
            const { data: scadenza, error: scadenzaError } = await supabase
              .from('scadenze')
              .insert({
                tipo,
                soggetto_nome: invoice.subject_name,
                soggetto_tipo: invoice.subject_type,
                note: `Fattura ${invoice.invoice_number} - Rata ${scadenze.indexOf(scad) + 1}/${scadenze.length}`,
                importo_totale: scad.amount,
                importo_residuo: scad.amount,
                data_documento: invoice.invoice_date,
                data_scadenza: scad.due_date,
                stato: 'aperta',
                evento_id: accountingEntry.id,
                prima_nota_id: primaNota.id,
                fattura_id: invoice.id
              })
              .select()
              .single();

            if (scadenzaError) throw scadenzaError;
            scadenzaIds.push(scadenza.id);
          }
        } else {
          // Scadenza singola (retrocompatibilità)
          const { data: scadenza, error: scadenzaError } = await supabase
            .from('scadenze')
            .insert({
              tipo,
              soggetto_nome: invoice.subject_name,
              soggetto_tipo: invoice.subject_type,
              note: `Fattura ${invoice.invoice_number}`,
              importo_totale: invoice.total_amount,
              importo_residuo: invoice.total_amount,
              data_documento: invoice.invoice_date,
              data_scadenza: invoice.due_date || invoice.invoice_date,
              stato: 'aperta',
              evento_id: accountingEntry.id,
              prima_nota_id: primaNota.id,
              fattura_id: invoice.id
            })
            .select()
            .single();

          if (scadenzaError) throw scadenzaError;
          scadenzaIds.push(scadenza.id);
        }
      }
      const scadenzaId = scadenzaIds[0] || null;

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
      toast.success('Fattura contabilizzata con successo!');
      setShowRegisterDialog(false);
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-stats'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-dettagliate'] });
    },
    onError: (error) => {
      toast.error('Errore nella registrazione: ' + error.message);
    }
  });

  // Mutation per modificare fatture
  // Modifica consentita per tutti gli stati tranne rettificato/periodo chiuso
  // Per fatture registrate con prima_nota, aggiorna in cascata Prima Nota, accounting entry e scadenze
  const updateInvoiceMutation = useMutation({
    mutationFn: async (data: { invoice: InvoiceRegistry; updates: FormData; accountSplits?: AccountSplitLine[] }) => {
      const { invoice, updates, accountSplits } = data;
      
      // Se è in stato 'rettificato' o bloccato, blocca sempre
      if (invoice.status === 'rettificato' || invoice.periodo_chiuso || invoice.evento_lockato) {
        throw new Error(
          'Evento bloccato (periodo chiuso o rettificato). Nessuna modifica consentita.'
        );
      }

      const ivaAmount = updates.imponibile * (updates.iva_rate / 100);
      const totalAmount = updates.imponibile + ivaAmount;

      // Prepara lo split per il salvataggio
      const splitsToSave = accountSplits && accountSplits.length > 0
        ? accountSplits.map(s => ({
            account_id: s.account_id,
            amount: s.amount,
            percentage: s.percentage,
            cost_center_id: s.cost_center_id || null,
            profit_center_id: s.profit_center_id || null
          }))
        : null;
      
      const hasSplit = splitsToSave && splitsToSave.length > 0;

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
          cost_center_id: hasSplit ? null : (updates.cost_center_id || null),
          profit_center_id: hasSplit ? null : (updates.profit_center_id || null),
          cost_account_id: hasSplit ? null : (updates.cost_account_id || null),
          revenue_account_id: hasSplit ? null : (updates.revenue_account_id || null),
          notes: updates.notes || null,
          account_splits: splitsToSave,
          contabilizzazione_valida: invoice.status === 'da_riclassificare' ? false : invoice.contabilizzazione_valida
        })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      // ========================================================
      // CASCATA: aggiorna documenti collegati per fatture registrate
      // ========================================================
      if (invoice.prima_nota_id || invoice.accounting_entry_id || invoice.scadenza_id) {
        const isAcquisto = updates.invoice_type === 'acquisto';
        const isPaid = ['pagata', 'incassata'].includes(updates.financial_status);
        const paymentMethod = updates.payment_method || 'bonifico';
        const primaNotaAmount = isAcquisto ? -totalAmount : totalAmount;

        // Aggiorna Prima Nota se esiste
        if (invoice.prima_nota_id) {
          const { error: primaNotaError } = await supabase
            .from('prima_nota')
            .update({
              description: `Fattura ${updates.invoice_number} - ${updates.subject_name}`,
              amount: primaNotaAmount,
              imponibile: updates.imponibile,
              iva_amount: ivaAmount,
              iva_aliquota: updates.iva_rate,
              competence_date: updates.invoice_date,
              payment_method: isPaid ? paymentMethod : null
            })
            .eq('id', invoice.prima_nota_id);

          if (primaNotaError) throw primaNotaError;

          // Rigenera le linee di partita doppia
          await supabase
            .from('prima_nota_lines')
            .delete()
            .eq('prima_nota_id', invoice.prima_nota_id);

          const primaNotaLines: any[] = [];
          let lineOrder = 1;

          if (isAcquisto) {
            primaNotaLines.push({
              prima_nota_id: invoice.prima_nota_id,
              line_order: lineOrder++,
              account_type: 'dynamic',
              dynamic_account_key: isPaid ? paymentMethod.toUpperCase() : 'DEBITI_FORNITORI',
              chart_account_id: null,
              dare: 0,
              avere: totalAmount,
              description: isPaid ? `Pagamento ${paymentMethod}` : 'Debiti vs fornitori',
            });

            if (hasSplit) {
              for (const split of accountSplits!) {
                const account = accounts.find(a => a.id === split.account_id);
                primaNotaLines.push({
                  prima_nota_id: invoice.prima_nota_id,
                  line_order: lineOrder++,
                  account_type: 'chart',
                  chart_account_id: split.account_id,
                  dynamic_account_key: 'CONTO_COSTI',
                  dare: split.amount,
                  avere: 0,
                  description: account?.name || 'Costi',
                });
              }
            } else {
              primaNotaLines.push({
                prima_nota_id: invoice.prima_nota_id,
                line_order: lineOrder++,
                account_type: 'chart',
                chart_account_id: updates.cost_account_id || null,
                dynamic_account_key: 'CONTO_COSTI',
                dare: updates.imponibile,
                avere: 0,
                description: 'Costi',
              });
            }

            if (ivaAmount > 0) {
              primaNotaLines.push({
                prima_nota_id: invoice.prima_nota_id,
                line_order: lineOrder++,
                account_type: 'dynamic',
                dynamic_account_key: 'IVA_CREDITO',
                chart_account_id: null,
                dare: ivaAmount,
                avere: 0,
                description: `IVA a credito ${updates.iva_rate}%`,
              });
            }
          } else {
            primaNotaLines.push({
              prima_nota_id: invoice.prima_nota_id,
              line_order: lineOrder++,
              account_type: 'dynamic',
              dynamic_account_key: isPaid ? paymentMethod.toUpperCase() : 'CREDITI_CLIENTI',
              chart_account_id: null,
              dare: totalAmount,
              avere: 0,
              description: isPaid ? `Incasso ${paymentMethod}` : 'Crediti vs clienti',
            });

            if (hasSplit) {
              for (const split of accountSplits!) {
                const account = accounts.find(a => a.id === split.account_id);
                primaNotaLines.push({
                  prima_nota_id: invoice.prima_nota_id,
                  line_order: lineOrder++,
                  account_type: 'chart',
                  chart_account_id: split.account_id,
                  dynamic_account_key: 'CONTO_RICAVI',
                  dare: 0,
                  avere: split.amount,
                  description: account?.name || 'Ricavi',
                });
              }
            } else {
              primaNotaLines.push({
                prima_nota_id: invoice.prima_nota_id,
                line_order: lineOrder++,
                account_type: 'chart',
                chart_account_id: updates.revenue_account_id || null,
                dynamic_account_key: 'CONTO_RICAVI',
                dare: 0,
                avere: updates.imponibile,
                description: 'Ricavi',
              });
            }

            if (ivaAmount > 0) {
              primaNotaLines.push({
                prima_nota_id: invoice.prima_nota_id,
                line_order: lineOrder++,
                account_type: 'dynamic',
                dynamic_account_key: 'IVA_DEBITO',
                chart_account_id: null,
                dare: 0,
                avere: ivaAmount,
                description: `IVA a debito ${updates.iva_rate}%`,
              });
            }
          }

          if (primaNotaLines.length > 0) {
            const { error: linesError } = await supabase
              .from('prima_nota_lines')
              .insert(primaNotaLines);
            if (linesError) throw linesError;
          }
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
              direction: isAcquisto ? 'uscita' : 'entrata',
              financial_status: updates.financial_status,
              subject_type: updates.subject_type,
              payment_method: isPaid ? paymentMethod : null,
              payment_date: isPaid ? (updates.payment_date || updates.invoice_date) : null
            })
            .eq('id', invoice.accounting_entry_id);

          if (entryError) throw entryError;
        }

        // Aggiorna scadenza se esiste
        if (invoice.scadenza_id) {
          const scadenzaStato = isPaid ? 'chiusa' : 'aperta';
          const importoResiduo = isPaid ? 0 : totalAmount;

          const { error: scadenzaError } = await supabase
            .from('scadenze')
            .update({
              soggetto_nome: updates.subject_name,
              soggetto_tipo: updates.subject_type,
              importo_totale: totalAmount,
              importo_residuo: importoResiduo,
              data_documento: updates.invoice_date,
              data_scadenza: updates.due_date || updates.invoice_date,
              stato: scadenzaStato
            })
            .eq('id', invoice.scadenza_id);

          if (scadenzaError) throw scadenzaError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Fattura aggiornata con successo!');
      setShowEditDialog(false);
      setSelectedInvoice(null);
      setEditSplitEnabled(false);
      setEditSplitLines([]);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-stats'] });
    },
    onError: (error) => {
      toast.error('Errore nella modifica: ' + error.message);
    }
  });


  // Mutation per eliminare dal registro contabile
  // IMPORTANTE: Solo per elementi NON contabilizzati (bozza)
  // Per elementi contabilizzati, usare storno dalla Prima Nota
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (invoice: InvoiceRegistry) => {
      // BLOCCO: Non eliminare se già contabilizzato (ha prima_nota)
      if (invoice.prima_nota_id && invoice.status === 'registrata') {
        throw new Error('Evento già contabilizzato. Per annullarlo, usare la funzione Storno dalla Prima Nota.');
      }
      
      // Elimina nell'ordine corretto rispettando le foreign keys
      
      // 1. Elimina invoice_registry (riferisce prima_nota)
      const { error: registryError } = await supabase
        .from('invoice_registry')
        .delete()
        .eq('id', invoice.id);
      if (registryError) throw registryError;

      // 2. Elimina prima_nota se esiste (solo per bozze)
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
      toast.error('Errore: ' + error.message);
    }
  });

  // =====================================================
  // APRI DIALOG PAGAMENTO con fetch residuo
  // =====================================================
  const openPaymentDialog = useCallback(async (inv: InvoiceRegistry) => {
    setSelectedInvoice(inv);
    setScadenzaResiduo(null);
    
    // Fetch residuo dalla scadenza
    if (inv.scadenza_id) {
      const { data: scadenza } = await supabase
        .from('scadenze')
        .select('importo_residuo')
        .eq('id', inv.scadenza_id)
        .single();
      if (scadenza) {
        setScadenzaResiduo(scadenza.importo_residuo);
        setPaymentData({
          amount: scadenza.importo_residuo,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
          payment_method: inv.payment_method || 'bonifico',
          notes: '',
          is_partial: false
        });
      } else {
        setPaymentData({
          amount: inv.total_amount,
          payment_date: format(new Date(), 'yyyy-MM-dd'),
          payment_method: inv.payment_method || 'bonifico',
          notes: '',
          is_partial: false
        });
      }
    }
    setShowPaymentDialog(true);
  }, []);

  // =====================================================
  // REGISTRA PAGAMENTO - Totale o parziale con Prima Nota
  // =====================================================
  const paymentMutation = useMutation({
    mutationFn: async (params: { invoice: InvoiceRegistry; payment: typeof paymentData }) => {
      const { invoice, payment } = params;
      const { data: user } = await supabase.auth.getUser();
      
      if (!invoice.scadenza_id) throw new Error('Nessuna scadenza collegata');
      
      // Recupera la scadenza corrente
      const { data: scadenza, error: scadError } = await supabase
        .from('scadenze')
        .select('*')
        .eq('id', invoice.scadenza_id)
        .single();
      
      if (scadError || !scadenza) throw new Error('Scadenza non trovata');
      
      const paymentAmount = payment.amount;
      const newResiduo = Math.max(0, scadenza.importo_residuo - paymentAmount);
      const isFullyPaid = newResiduo < 0.01;
      
      const isAcquisto = invoice.invoice_type === 'acquisto';
      const payMethodKey = payment.payment_method?.toUpperCase() || 'BANCA';
      
      // 1. Crea movimento di Prima Nota per il pagamento
      const primaNotaAmount = isAcquisto ? -paymentAmount : paymentAmount;
      
      const { data: primaNota, error: pnError } = await supabase
        .from('prima_nota')
        .insert({
          competence_date: payment.payment_date,
          movement_type: 'finanziario',
          description: `${isAcquisto ? 'Pagamento' : 'Incasso'} ${isFullyPaid ? '' : 'parziale '}Fatt. ${invoice.invoice_number} - ${invoice.subject_name}`,
          amount: primaNotaAmount,
          status: 'registrato',
          payment_method: payment.payment_method,
          accounting_entry_id: invoice.accounting_entry_id,
          created_by: user?.user?.id,
        })
        .select()
        .single();
      
      if (pnError) throw pnError;
      
      // 2. Genera linee partita doppia per il pagamento
      const lines: any[] = [];
      let lineOrder = 1;
      
      if (isAcquisto) {
        // Pagamento fornitore: DARE Debiti vs fornitori, AVERE Banca
        lines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: 'DEBITI_FORNITORI',
          chart_account_id: null,
          dare: paymentAmount,
          avere: 0,
          description: 'Estinzione debito fornitore',
        });
        lines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: payMethodKey,
          chart_account_id: null,
          dare: 0,
          avere: paymentAmount,
          description: `Pagamento ${payment.payment_method}`,
        });
      } else {
        // Incasso cliente: DARE Banca, AVERE Crediti vs clienti
        lines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: payMethodKey,
          chart_account_id: null,
          dare: paymentAmount,
          avere: 0,
          description: `Incasso ${payment.payment_method}`,
        });
        lines.push({
          prima_nota_id: primaNota.id,
          line_order: lineOrder++,
          account_type: 'dynamic',
          dynamic_account_key: 'CREDITI_CLIENTI',
          chart_account_id: null,
          dare: 0,
          avere: paymentAmount,
          description: 'Estinzione credito cliente',
        });
      }
      
      const { error: linesError } = await supabase
        .from('prima_nota_lines')
        .insert(lines);
      if (linesError) throw linesError;
      
      // 3. Registra il movimento nella scadenza
      const { error: movError } = await supabase
        .from('scadenza_movimenti')
        .insert({
          scadenza_id: invoice.scadenza_id,
          data_movimento: payment.payment_date,
          importo: paymentAmount,
          metodo_pagamento: payment.payment_method,
          note: payment.notes || `${isFullyPaid ? 'Saldo totale' : 'Acconto parziale'} - Fatt. ${invoice.invoice_number}`,
          prima_nota_id: primaNota.id,
          evento_finanziario_id: invoice.accounting_entry_id,
        });
      if (movError) throw movError;
      
      // 4. Aggiorna la scadenza
      const { error: scadUpdateError } = await supabase
        .from('scadenze')
        .update({
          importo_residuo: newResiduo,
          stato: isFullyPaid ? 'chiusa' : 'parziale',
        })
        .eq('id', invoice.scadenza_id);
      if (scadUpdateError) throw scadUpdateError;
      
      // 5. Aggiorna lo stato finanziario della fattura
      const newFinancialStatus = isFullyPaid 
        ? (isAcquisto ? 'pagata' : 'incassata')
        : (isAcquisto ? 'parzialmente_pagata' : 'parzialmente_incassata');
      
      const { error: invError } = await supabase
        .from('invoice_registry')
        .update({
          financial_status: newFinancialStatus,
          payment_date: isFullyPaid ? payment.payment_date : invoice.payment_date,
          payment_method: payment.payment_method,
        })
        .eq('id', invoice.id);
      if (invError) throw invError;
      
      // 6. Aggiorna accounting entry se completamente pagata
      if (isFullyPaid && invoice.accounting_entry_id) {
        await supabase
          .from('accounting_entries')
          .update({
            financial_status: newFinancialStatus,
            payment_date: payment.payment_date,
            payment_method: payment.payment_method,
          })
          .eq('id', invoice.accounting_entry_id);
      }
      
      return { isFullyPaid, paymentAmount, newResiduo };
    },
    onSuccess: (result) => {
      const msg = result.isFullyPaid 
        ? 'Pagamento totale registrato! Scadenza chiusa e Prima Nota aggiornata.'
        : `Acconto di €${result.paymentAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })} registrato. Residuo: €${result.newResiduo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;
      toast.success(msg);
      setShowPaymentDialog(false);
      setSelectedInvoice(null);
      setScadenzaResiduo(null);
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-stats'] });
      queryClient.invalidateQueries({ queryKey: ['scadenze-dettagliate'] });
      queryClient.invalidateQueries({ queryKey: ['prima-nota'] });
    },
    onError: (error) => {
      toast.error('Errore nel pagamento: ' + error.message);
    }
  });

  const regeneratePrimaNotaMutation = useMutation({
    mutationFn: async (invoice: InvoiceRegistry) => {
      // Verifica che sia uno stato valido per rigenerazione
      if (invoice.status === 'rettificato' || invoice.periodo_chiuso || invoice.evento_lockato) {
        throw new Error('Evento bloccato/rettificato. La rigenerazione non è consentita.');
      }
      
      if (invoice.status !== 'da_riclassificare') {
        throw new Error('Solo eventi in stato "Da Riclassificare" possono essere rigenerati.');
      }

      const { data: user } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      
      // Determina parametri
      const isAcquisto = invoice.invoice_type === 'acquisto';
      const isPaid = ['pagata', 'incassata'].includes(invoice.financial_status);
      const paymentMethod = invoice.payment_method || 'bonifico';
      const eventType = isAcquisto ? 'costo' : 'ricavo';

      // 1. Crea nuovo accounting_entry
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

      // 2. Crea nuova prima nota
      const primaNotaAmount = isAcquisto ? -invoice.total_amount : invoice.total_amount;

      const { data: primaNota, error: primaNotaError } = await supabase
        .from('prima_nota')
        .insert({
          competence_date: invoice.invoice_date,
          movement_type: 'economico',
          description: `[RIGENERATO] Fattura ${invoice.invoice_number} - ${invoice.subject_name}`,
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
          chart_account_id: isAcquisto ? invoice.cost_account_id : invoice.revenue_account_id,
          created_by: user?.user?.id,
        })
        .select()
        .single();

      if (primaNotaError) throw primaNotaError;

      // 3. Genera linee partita doppia
      const primaNotaLines: any[] = [];
      let lineOrder = 1;
      const accountSplits = Array.isArray(invoice.account_splits) ? invoice.account_splits : [];
      const hasSplit = accountSplits.length > 0;

      if (isAcquisto) {
        // AVERE: Debiti fornitori / Pagamento
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

        // DARE: Costi
        if (hasSplit) {
          for (const split of accountSplits as AccountSplitLine[]) {
            primaNotaLines.push({
              prima_nota_id: primaNota.id,
              line_order: lineOrder++,
              account_type: 'chart',
              chart_account_id: split.account_id,
              dynamic_account_key: null,
              dare: split.amount,
              avere: 0,
              description: 'Costi',
            });
          }
        } else {
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
        }

        // DARE: IVA a credito
        if (invoice.iva_amount > 0) {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'dynamic',
            dynamic_account_key: 'IVA_CREDITO',
            chart_account_id: null,
            dare: invoice.iva_amount,
            avere: 0,
            description: `IVA ${invoice.iva_rate}%`,
          });
        }
      } else {
        // VENDITA (Ricavo)
        // DARE: Crediti clienti / Incasso
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

        // AVERE: Ricavi
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

        // AVERE: IVA a debito
        if (invoice.iva_amount > 0) {
          primaNotaLines.push({
            prima_nota_id: primaNota.id,
            line_order: lineOrder++,
            account_type: 'dynamic',
            dynamic_account_key: 'IVA_DEBITO',
            chart_account_id: null,
            dare: 0,
            avere: invoice.iva_amount,
            description: `IVA ${invoice.iva_rate}%`,
          });
        }
      }

      // Inserisci linee
      if (primaNotaLines.length > 0) {
        const { error: linesError } = await supabase
          .from('prima_nota_lines')
          .insert(primaNotaLines);
        if (linesError) throw linesError;
      }

      // 4. Ripristina/crea scadenza (se serve) e aggiorna evento nel registro con nuovi riferimenti
      let scadenzaId: string | null = invoice.scadenza_id;

      const shouldHaveScadenza =
        invoice.financial_status === 'da_incassare' || invoice.financial_status === 'da_pagare';

      if (shouldHaveScadenza) {
        const scadenzaStato = isPaid ? 'chiusa' : 'aperta';
        const importoResiduo = isPaid ? 0 : invoice.total_amount;

        const scadenzaPayload = {
          tipo: isAcquisto ? 'debito' : 'credito',
          soggetto_nome: invoice.subject_name,
          soggetto_tipo: invoice.subject_type,
          note: `Fattura ${invoice.invoice_number}`,
          importo_totale: invoice.total_amount,
          importo_residuo: importoResiduo,
          data_documento: invoice.invoice_date,
          data_scadenza: invoice.due_date || invoice.invoice_date,
          stato: scadenzaStato,
          evento_id: accountingEntry.id,
          prima_nota_id: primaNota.id,
        };

        if (scadenzaId) {
          const { error: scadenzaError } = await supabase
            .from('scadenze')
            .update(scadenzaPayload)
            .eq('id', scadenzaId);

          if (scadenzaError) throw scadenzaError;
        } else {
          const { data: scadenza, error: scadenzaError } = await supabase
            .from('scadenze')
            .insert(scadenzaPayload)
            .select()
            .single();

          if (scadenzaError) throw scadenzaError;
          scadenzaId = scadenza.id;
        }
      } else if (scadenzaId) {
        // Se non deve avere scadenza (già pagata/incassata), riallinea comunque ai nuovi riferimenti
        const { error: scadenzaError } = await supabase
          .from('scadenze')
          .update({
            stato: 'chiusa',
            importo_residuo: 0,
            evento_id: accountingEntry.id,
            prima_nota_id: primaNota.id,
          })
          .eq('id', scadenzaId);

        if (scadenzaError) throw scadenzaError;
      }

      const { error: updateError } = await supabase
        .from('invoice_registry')
        .update({
          status: 'contabilizzato',
          accounting_entry_id: accountingEntry.id,
          prima_nota_id: primaNota.id,
          scadenza_id: scadenzaId,
          contabilizzazione_valida: true,
          // Mantieni traccia storno come audit
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('Prima Nota rigenerata! Evento ora contabilizzato.');
      queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
      queryClient.invalidateQueries({ queryKey: ['prima-nota'] });
    },
    onError: (error) => {
      toast.error('Errore rigenerazione: ' + error.message);
    }
  });

  const getIvaRateFromRegime = (regime: string): number => {
    switch (regime) {
      case 'domestica_imponibile': return 22;
      case 'reverse_charge': return 0;
      case 'ue_non_imponibile': return 0;
      case 'extra_ue': return 0;
      case 'esente': return 0;
      case 'ridotta_10': return 10;
      case 'ridotta_4': return 4;
      default: return 22;
    }
  };

  const handleFormChange = (field: string, value: string | number) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'invoice_type') {
        updated.subject_type = value === 'acquisto' ? 'fornitore' : 'cliente';
        updated.financial_status = value === 'acquisto' ? 'da_pagare' : 'da_incassare';
      }
      if (field === 'vat_regime') {
        updated.iva_rate = getIvaRateFromRegime(value as string);
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
      if (field === 'vat_regime') {
        updated.iva_rate = getIvaRateFromRegime(value as string);
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
    
    // Carica lo split esistente se presente
    const existingSplits = Array.isArray(invoice.account_splits) 
      ? (invoice.account_splits as AccountSplitLine[]).map((s, idx) => ({
          id: `existing-${idx}`,
          account_id: s.account_id,
          amount: s.amount,
          percentage: s.percentage,
          cost_center_id: s.cost_center_id,
          profit_center_id: s.profit_center_id
        }))
      : [];
    
    if (existingSplits.length > 0) {
      setEditSplitEnabled(true);
      setEditSplitLines(existingSplits);
    } else {
      setEditSplitEnabled(false);
      setEditSplitLines([]);
    }
    
    setShowEditDialog(true);
    setAiSuggestion(null);
  };

  // AI Accounting Analysis handler
  const runAiAnalysis = async (formDataToAnalyze: FormData, isEdit: boolean = true) => {
    setIsAiAnalyzing(true);
    setAiSuggestion(null);
    try {
      const { data, error } = await supabase.functions.invoke('ai-accounting-analysis', {
        body: {
          invoice: {
            invoice_type: formDataToAnalyze.invoice_type,
            subject_name: formDataToAnalyze.subject_name,
            subject_type: formDataToAnalyze.subject_type,
            imponibile: formDataToAnalyze.imponibile,
            iva_rate: formDataToAnalyze.iva_rate,
            vat_regime: formDataToAnalyze.vat_regime,
            financial_status: formDataToAnalyze.financial_status,
            invoice_date: formDataToAnalyze.invoice_date,
            notes: formDataToAnalyze.notes,
          },
          chartOfAccounts: accounts,
          costCenters,
          profitCenters,
        }
      });
      if (error) throw error;
      if (data?.success && data?.suggestion) {
        setAiSuggestion(data.suggestion);
        toast.success('Analisi AI completata');
      } else {
        toast.error(data?.error || 'Errore nell\'analisi AI');
      }
    } catch (err: any) {
      console.error('AI analysis error:', err);
      toast.error('Errore nell\'analisi AI: ' + (err.message || 'Errore sconosciuto'));
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const applyAiSuggestion = (isEdit: boolean = true) => {
    if (!aiSuggestion) return;
    const setter = isEdit ? handleEditFormChange : handleFormChange;
    if (aiSuggestion.cost_account_id) setter('cost_account_id', aiSuggestion.cost_account_id);
    if (aiSuggestion.revenue_account_id) setter('revenue_account_id', aiSuggestion.revenue_account_id);
    if (aiSuggestion.cost_center_id) setter('cost_center_id', aiSuggestion.cost_center_id);
    if (aiSuggestion.profit_center_id) setter('profit_center_id', aiSuggestion.profit_center_id);
    if (aiSuggestion.vat_regime) setter('vat_regime', aiSuggestion.vat_regime);
    if (aiSuggestion.iva_rate !== undefined) setter('iva_rate', aiSuggestion.iva_rate);
    if (aiSuggestion.financial_status) setter('financial_status', aiSuggestion.financial_status);
    toast.success('Suggerimenti AI applicati');
    setAiSuggestion(null);
  };

  // Bulk AI classification: apply suggestion to a single invoice
  const handleBulkAIApprove = async (invoiceId: string, suggestion: any) => {
    const ivaAmount = suggestion.iva_rate !== undefined 
      ? (suggestion.imponibile || 0) * (suggestion.iva_rate / 100) 
      : undefined;
    
    const updateData: any = {};
    if (suggestion.cost_account_id) updateData.cost_account_id = suggestion.cost_account_id;
    if (suggestion.revenue_account_id) updateData.revenue_account_id = suggestion.revenue_account_id;
    if (suggestion.cost_center_id) updateData.cost_center_id = suggestion.cost_center_id;
    if (suggestion.profit_center_id) updateData.profit_center_id = suggestion.profit_center_id;
    if (suggestion.vat_regime) updateData.vat_regime = suggestion.vat_regime;
    if (suggestion.iva_rate !== undefined) updateData.iva_rate = suggestion.iva_rate;
    if (suggestion.financial_status) updateData.financial_status = suggestion.financial_status;
    
    // Recalculate amounts if iva_rate changed
    if (suggestion.iva_rate !== undefined) {
      const inv = invoices.find(i => i.id === invoiceId);
      if (inv) {
        const newIva = inv.imponibile * (suggestion.iva_rate / 100);
        updateData.iva_amount = Math.round(newIva * 100) / 100;
        updateData.total_amount = Math.round((inv.imponibile + newIva) * 100) / 100;
      }
    }

    const { error } = await supabase
      .from('invoice_registry')
      .update(updateData)
      .eq('id', invoiceId);

    if (error) throw error;
  };

  // Filter by selected period first
  const periodFilteredInvoices = invoices.filter(inv => {
    const date = new Date(inv.invoice_date);
    if (viewMode === 'month') {
      return date.getFullYear() === selectedPeriod.getFullYear() && date.getMonth() === selectedPeriod.getMonth();
    } else {
      return format(date, 'yyyy-MM-dd') === format(selectedPeriod, 'yyyy-MM-dd');
    }
  });

  const filteredInvoices = periodFilteredInvoices.filter(inv => {
    const matchesSearch = inv.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.subject_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Filtro per status
    let matchesStatus = true;
    if (filterStatus === 'stornati') {
      matchesStatus = inv.stornato === true || inv.status === 'da_riclassificare';
    } else if (filterStatus === 'da_riclassificare') {
      matchesStatus = inv.status === 'da_riclassificare';
    } else if (filterStatus === 'rettificato') {
      matchesStatus = inv.status === 'rettificato';
    } else if (filterStatus !== 'all') {
      matchesStatus = inv.status === filterStatus;
    }
    
    // Filtro per tipo
    const matchesType = filterType === 'all' || inv.invoice_type === filterType;
    
    return matchesSearch && matchesStatus && matchesType;
  });


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

  // Escludi fatture da_riclassificare/rettificate/bozze dai totali finanziari
  // perché il loro saldo contabile non è valido. Non escludere "stornato":
  // una fattura può essere stata stornata e poi ri-contabilizzata restando nella stessa riga.
  const isValidForFinancialStats = (i: InvoiceRegistry) =>
    i.contabilizzazione_valida !== false &&
    !["da_riclassificare", "rettificato", "bozza"].includes(i.status);

  const stats = {
    bozze: invoices.filter(i => i.status === 'bozza').length,
    // Contabilizzate include sia 'registrata' che 'contabilizzato' (registrata è deprecato)
    contabilizzate: invoices.filter(i => ['registrata', 'contabilizzato'].includes(i.status)).length,
    // Usa i valori dalle scadenze (importo_residuo) per allinearsi con lo Scadenziario
    daIncassare: scadenzeStats?.crediti ?? 0,
    daPagare: scadenzeStats?.debiti ?? 0,
    daClassificare: eventsToClassify.length,
    // Solo status === 'da_riclassificare', NON usare il flag stornato (può essere già ri-contabilizzata)
    daRiclassificare: invoices.filter(i => i.status === 'da_riclassificare').length,
    rettificati: invoices.filter(i => i.status === 'rettificato').length,
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

  const getRegistryStatusBadge = (status: RegistryStatus, stornato?: boolean) => {
    // Nel Registro Fatture, non mostriamo il badge "Stornato" - quello resta solo in Prima Nota
    // Unifichiamo "registrata" e "contabilizzato" come "Contabilizzato"
    const effectiveStatus = status === 'registrata' ? 'contabilizzato' : status;
    const statusConfig = REGISTRY_STATUSES.find(s => s.value === effectiveStatus);
    if (!statusConfig) return <Badge variant="outline">{status}</Badge>;
    
    const iconMap: Record<string, React.ReactNode> = {
      'bozza': <Clock className="w-3 h-3 mr-1" />,
      'registrata': <CheckCircle2 className="w-3 h-3 mr-1" />,
      'da_classificare': <AlertCircle className="w-3 h-3 mr-1" />,
      'da_riclassificare': <RefreshCw className="w-3 h-3 mr-1" />,
      'non_rilevante': <Clock className="w-3 h-3 mr-1" />,
      'contabilizzato': <CheckCircle2 className="w-3 h-3 mr-1" />,
      'rettificato': <Lock className="w-3 h-3 mr-1" />,
      'archiviato': <FileCheck className="w-3 h-3 mr-1" />,
    };
    const icon = iconMap[effectiveStatus];
    
    return (
      <Badge className={statusConfig.color}>{icon}{statusConfig.label}</Badge>
    );
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
      case 'domestica_imponibile': return 'Ordinario (22%)';
      case 'ue_non_imponibile': return 'Intra UE (0%)';
      case 'extra_ue': return 'Extra UE';
      case 'reverse_charge': return 'Reverse Charge (0%)';
      default: return regime;
    }
  };

  const { ivaAmount, totalAmount } = calculateAmounts(formData.imponibile, formData.iva_rate);

  const renderInvoiceRow = (invoice: InvoiceRegistry) => (
    <>
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
      <TableCell>{getRegistryStatusBadge(invoice.status as RegistryStatus, invoice.stornato)}</TableCell>
      <TableCell>{getFinancialStatusBadge(invoice.financial_status)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {invoice.status === 'bozza' && (
            <>
              <Button size="sm" variant="outline" onClick={() => openEditDialog(invoice)}>
                <Pencil className="w-3.5 h-3.5 mr-1" />Modifica
              </Button>
              <Button size="sm" onClick={() => { setSelectedInvoice(invoice); setShowRegisterDialog(true); }}>
                <FileCheck className="w-3.5 h-3.5 mr-1" />Registra
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                onClick={() => { if (confirm('Eliminare questa bozza?')) deleteInvoiceMutation.mutate(invoice); }}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </>
          )}
          {invoice.status === 'da_riclassificare' && (
            <>
              <Button size="sm" variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" onClick={() => openEditDialog(invoice)}>
                <Pencil className="w-3.5 h-3.5 mr-1" />Correggi
              </Button>
              <Button size="sm" onClick={() => { if (confirm('Rigenerare la Prima Nota?')) regeneratePrimaNotaMutation.mutate(invoice); }}
                disabled={regeneratePrimaNotaMutation.isPending}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Rigenera
              </Button>
            </>
          )}
          {invoice.status === 'rettificato' && (
            <Badge variant="outline" className="text-muted-foreground"><Lock className="w-3 h-3 mr-1" />Bloccato</Badge>
          )}
          {['registrata', 'contabilizzato'].includes(invoice.status) && (
            <Button size="sm" variant="outline" onClick={() => openEditDialog(invoice)}>
              <Pencil className="w-3.5 h-3.5 mr-1" />Modifica
            </Button>
          )}
          {/* Pulsante Registra Pagamento per fatture con scadenza aperta */}
          {invoice.scadenza_id && ['da_incassare', 'da_pagare', 'parzialmente_incassata', 'parzialmente_pagata'].includes(invoice.financial_status) && (
            <Button size="sm" variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" onClick={() => openPaymentDialog(invoice)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              {invoice.invoice_type === 'vendita' ? 'Incassa' : 'Paga'}
            </Button>
          )}
          {invoice.scadenza_id && (
            <Button size="sm" variant="ghost" onClick={() => window.location.href = '/management-control-2/scadenziario'}>
              <LinkIcon className="w-3.5 h-3.5 mr-1" />Scadenza
            </Button>
          )}
          {invoice.stornato && invoice.motivo_storno && (
            <span className="text-xs text-muted-foreground ml-1">Storno: {invoice.motivo_storno}</span>
          )}
        </div>
      </TableCell>
    </>
  );

  return (
    <div {...getRootProps()} className="space-y-5 relative">
      <input {...getInputProps()} />
      
      {/* Drag overlay */}
      {isDragActive && (
        <div className="fixed inset-0 bg-primary/5 backdrop-blur-md z-50 flex items-center justify-center">
          <div className="bg-card border-2 border-primary rounded-3xl p-16 text-center shadow-2xl max-w-md">
            <div className="h-20 w-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="w-10 h-10 text-primary animate-bounce" />
            </div>
            <p className="text-2xl font-bold text-foreground">Rilascia qui</p>
            <p className="text-muted-foreground mt-2 text-sm">L'AI analizzerà automaticamente i documenti</p>
          </div>
        </div>
      )}
      
      {/* Uploading/Analyzing overlay */}
      {(isUploading || isAnalyzing) && !showUploadProgress && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-card border rounded-3xl p-10 text-center shadow-2xl max-w-sm">
            <div className="h-16 w-16 mx-auto mb-5 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
            <p className="text-lg font-semibold text-foreground">
              {isAnalyzing ? "Analisi AI in corso..." : "Caricamento..."}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {isAnalyzing ? "Estraggo i dati dal documento" : "Attendi qualche secondo"}
            </p>
          </div>
        </div>
      )}

      {/* Multi-file upload progress dialog */}
      {showUploadProgress && (
        <Dialog open={showUploadProgress} onOpenChange={(open) => {
          if (!open && uploadQueue.every(q => q.status === 'done' || q.status === 'error')) {
            setShowUploadProgress(false);
            setUploadQueue([]);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Import Documenti ({uploadQueue.filter(q => q.status === 'done').length}/{uploadQueue.length})
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {uploadQueue.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className="flex-shrink-0">
                    {item.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                    {(item.status === 'uploading' || item.status === 'analyzing') && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === 'pending' && 'In attesa...'}
                      {item.status === 'uploading' && 'Caricamento...'}
                      {item.status === 'analyzing' && 'Analisi AI...'}
                      {item.status === 'done' && (item.result?.invoice_number ? `Fatt. ${item.result.invoice_number} — €${item.result.total_amount || 0}` : 'Registrato')}
                      {item.status === 'error' && (item.error || 'Errore')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {uploadQueue.every(q => q.status === 'done' || q.status === 'error') && (
              <DialogFooter>
                <Button onClick={() => { setShowUploadProgress(false); setUploadQueue([]); }}>
                  Chiudi
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Hero Upload Area */}
      <Card className="overflow-hidden border-2 border-dashed border-primary/20 bg-gradient-to-br from-primary/[0.03] to-primary/[0.08] hover:border-primary/40 transition-all duration-300 group">
        <div
          {...getRootProps()}
          className="cursor-pointer"
        >
          <input {...getInputProps()} />
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Icon area */}
              <div className="relative flex-shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors group-hover:scale-105 duration-300">
                  <Upload className="w-7 h-7 text-primary" />
                </div>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                  <span className="text-[10px] font-bold text-primary-foreground">AI</span>
                </div>
              </div>
              
              {/* Text */}
              <div className="flex-1 text-center md:text-left space-y-1.5">
                <h3 className="text-lg font-semibold tracking-tight">
                  {isDragActive ? "Rilascia i file qui..." : "Importa fatture e documenti fiscali"}
                </h3>
                <p className="text-sm text-muted-foreground max-w-lg">
                  Trascina qui PDF, XML o immagini — anche multipli. L'AI analizza automaticamente i dati, 
                  riconosce clienti e fornitori e pre-compila la registrazione.
                </p>
                <div className="flex flex-wrap items-center gap-2 justify-center md:justify-start pt-1">
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <FileText className="h-3 w-3" />
                    PDF
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <FileText className="h-3 w-3" />
                    XML / FatturaPA
                  </Badge>
                  <Badge variant="secondary" className="text-xs font-normal gap-1">
                    <Camera className="h-3 w-3" />
                    Foto / Immagini
                  </Badge>
                </div>
              </div>
              
              {/* CTA Button */}
              <div className="flex-shrink-0">
                <label>
                  <Button size="lg" asChild className="gap-2 shadow-md cursor-pointer">
                    <div>
                      <Upload className="w-4 h-4" />
                      Carica documenti
                    </div>
                  </Button>
                  <input
                    type="file"
                    accept="image/*,application/pdf,text/xml,application/xml,.xml,.p7m"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) handleMultiFileUpload(files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Bulk AI Classification Button */}
      {invoices.filter(inv => inv.status === 'bozza').length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Brain className="w-4 h-4" />
            <span>{invoices.filter(inv => inv.status === 'bozza').length} fatture in bozza da classificare</span>
          </div>
          <Button onClick={() => setShowBulkAIDialog(true)} className="gap-2" variant="outline">
            <Sparkles className="w-4 h-4" />
            Contabilizza con AI
          </Button>
        </div>
      )}

      {/* Filters */}
      <RegistryFiltersBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        filterType={filterType}
        onFilterTypeChange={setFilterType}
        filterStatus={filterStatus}
        onFilterStatusChange={setFilterStatus}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedPeriod={selectedPeriod}
        onSelectedPeriodChange={setSelectedPeriod}
        onClearFilters={() => {
          setSearchTerm("");
          setFilterType("all");
          setFilterStatus("all");
        }}
      />

      {/* Vista Documentazione Operativa */}
      {showOperationalDocs ? (
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
                      Nessun rapporto di spesa o incasso da annotare
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
        <InvoiceRegistryTable
          invoices={filteredInvoices as any}
          isLoading={isLoading}
          groupBy="none"
          grouped={null}
          onOpenDetails={(invoice) => {
            setDetailsInvoice(invoice as any);
            setShowDetailsDialog(true);
          }}
          onEdit={(invoice) => openEditDialog(invoice as any)}
          onRegister={(invoice) => openEditDialog(invoice as any)}
          onDelete={(invoice) => {
            if (confirm('Eliminare questa bozza?')) deleteInvoiceMutation.mutate(invoice as any);
          }}
          onRegenerate={(invoice) => {
            if (confirm('Rigenerare la Prima Nota?')) regeneratePrimaNotaMutation.mutate(invoice as any);
          }}
          isRegenerating={regeneratePrimaNotaMutation.isPending}
          onPayment={(invoice) => {
            openPaymentDialog(invoice as any as InvoiceRegistry);
          }}
          onGoScadenziario={() => (window.location.href = '/management-control-2/scadenziario')}
        />
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className={cn(
          "max-h-[90vh] overflow-y-auto",
          uploadedFile ? "max-w-5xl" : "max-w-2xl"
        )}>
          <DialogHeader>
            <DialogTitle>Registrazione Documento Contabile</DialogTitle>
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
            <div className={cn("space-y-5", uploadedFile ? "w-1/2" : "w-full")}>
          
              {/* ═══════════════════════════════════════════════ */}
              {/* 1. TIPO DOCUMENTO                              */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Tipo Documento *</Label>
                <Select 
                  value={formData.event_type} 
                  onValueChange={(v: EventType) => {
                    setFormData(prev => {
                      const updated = { ...prev, event_type: v };
                      if (v === 'fattura_acquisto') {
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
                    handleFormChange('subject_id', '');
                    handleFormChange('subject_name', '');
                    setSubjectSearch('');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fattura_acquisto">📥 Fattura di Acquisto</SelectItem>
                    <SelectItem value="fattura_vendita">📤 Fattura di Vendita</SelectItem>
                    <SelectItem value="nota_credito">📋 Nota di Credito / Debito</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* ═══════════════════════════════════════════════ */}
              {/* 2. DATA REGISTRAZIONE + NUMERO E DATA DOCUMENTO */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-3 pb-4 border-b">
                <Label className="text-sm font-semibold text-muted-foreground">Dati documento</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data Registrazione *</Label>
                    <Input
                      type="date"
                      value={format(new Date(), 'yyyy-MM-dd')}
                      disabled
                      className="bg-muted/50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Numero Documento *</Label>
                    <Input
                      value={formData.invoice_number}
                      onChange={(e) => handleFormChange('invoice_number', e.target.value)}
                      placeholder="Es: 45"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Data Documento *</Label>
                    <Input
                      type="date"
                      value={formData.invoice_date}
                      onChange={(e) => handleFormChange('invoice_date', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* ═══════════════════════════════════════════════ */}
              {/* 3. CLIENTE O FORNITORE                          */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-1.5 pb-4 border-b">
                <Label className="text-xs">{formData.subject_type === 'cliente' ? 'Cliente' : 'Fornitore'} *</Label>
                <Popover open={subjectSearchOpen} onOpenChange={setSubjectSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={subjectSearchOpen}
                      className="w-full justify-between font-normal"
                    >
                      {formData.subject_name || `Cerca ${formData.subject_type}...`}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder={`Cerca ${formData.subject_type}...`}
                        value={subjectSearch}
                        onValueChange={setSubjectSearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <div className="p-2 space-y-2">
                            <p className="text-sm text-muted-foreground">Nessun risultato trovato</p>
                            {subjectSearch.trim().length > 2 && (
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  checkAndMatchSubject(subjectSearch.trim(), formData.subject_type);
                                  setSubjectSearchOpen(false);
                                }}
                              >
                                <UserPlus className="w-4 h-4 mr-2" />
                                Verifica/Crea "{subjectSearch.trim()}"
                              </Button>
                            )}
                          </div>
                        </CommandEmpty>
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

              {/* ═══════════════════════════════════════════════ */}
              {/* 4. CONTO DEL PIANO DEI CONTI                   */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-1.5 pb-4 border-b">
                <Label className="text-xs">
                  {formData.invoice_type === 'acquisto' ? 'Conto di Costo' : 'Conto di Ricavo'} *
                </Label>
                {formData.invoice_type === 'acquisto' ? (
                  <Select value={formData.cost_account_id} onValueChange={(v) => handleFormChange('cost_account_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona conto..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nessuno —</SelectItem>
                      {costAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={formData.revenue_account_id} onValueChange={(v) => handleFormChange('revenue_account_id', v === "__none__" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Seleziona conto..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Nessuno —</SelectItem>
                      {revenueAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>{a.code} - {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {/* Account Split Manager (opzionale) */}
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

              {/* ═══════════════════════════════════════════════ */}
              {/* 5-6-7. IMPONIBILE + IVA + TOTALE               */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-3 pb-4 border-b">
                <Label className="text-sm font-semibold text-muted-foreground">Importi</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imponibile (€) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.imponibile || ''}
                      onChange={(e) => handleFormChange('imponibile', parseFloat(e.target.value) || 0)}
                      placeholder="100,00"
                    />
                  </div>
                   <div className="space-y-1.5">
                     <Label className="text-xs">Regime IVA</Label>
                     <Select value={formData.vat_regime} onValueChange={(v) => handleFormChange('vat_regime', v)}>
                       <SelectTrigger><SelectValue /></SelectTrigger>
                       <SelectContent>
                         <SelectItem value="domestica_imponibile">Ordinario (22%)</SelectItem>
                         <SelectItem value="ridotta_10">Ridotta (10%)</SelectItem>
                         <SelectItem value="ridotta_4">Minima (4%)</SelectItem>
                         <SelectItem value="esente">Esente (0%)</SelectItem>
                         <SelectItem value="reverse_charge">Reverse Charge (0%)</SelectItem>
                         <SelectItem value="ue_non_imponibile">Intra UE (0%)</SelectItem>
                         <SelectItem value="extra_ue">Extra UE (0%)</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
                </div>

                {/* Riepilogo importi */}
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-muted-foreground">Imponibile: </span>
                        <span className="font-medium">€{formData.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">IVA ({formData.iva_rate}%): </span>
                        <span className="font-medium">€{ivaAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Totale: </span>
                        <span className="text-lg font-bold text-primary">€{totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* ═══════════════════════════════════════════════ */}
              {/* 8-9. CENTRO DI COSTO / CENTRO DI RICAVO        */}
              {/* ═══════════════════════════════════════════════ */}
              <div className="space-y-3 pb-4 border-b">
                <Label className="text-sm font-semibold text-muted-foreground">Controllo di gestione</Label>
                <div className="grid grid-cols-2 gap-3">
                  {formData.invoice_type === 'acquisto' ? (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Centro di Costo</Label>
                      <Select value={formData.cost_center_id} onValueChange={(v) => handleFormChange('cost_center_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Es: Officina" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nessuno —</SelectItem>
                          {costCenters.map(cc => (
                            <SelectItem key={cc.id} value={cc.id}>{cc.code} - {cc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="space-y-1.5 col-span-2">
                      <Label className="text-xs">Centro di Ricavo</Label>
                      <Select value={formData.profit_center_id} onValueChange={(v) => handleFormChange('profit_center_id', v === "__none__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Es: Forni" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">— Nessuno —</SelectItem>
                          {profitCenters.map(pc => (
                            <SelectItem key={pc.id} value={pc.id}>{pc.code} - {pc.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>

              {/* ═══════════════════════════════════════════════ */}
              {/* DETTAGLI AGGIUNTIVI (collassabile)              */}
              {/* ═══════════════════════════════════════════════ */}
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between text-muted-foreground hover:text-foreground px-0 h-auto py-2">
                    <span className="flex items-center gap-2 text-xs font-semibold">
                      <Receipt className="w-3.5 h-3.5" />
                      Dettagli aggiuntivi
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-4 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Stato finanziario */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Stato Finanziario</Label>
                      <Select value={formData.financial_status} onValueChange={(v) => handleFormChange('financial_status', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="da_incassare">Da Incassare</SelectItem>
                          <SelectItem value="da_pagare">Da Pagare</SelectItem>
                          <SelectItem value="incassata">Incassata</SelectItem>
                          <SelectItem value="pagata">Pagata</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Metodo di pagamento */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Metodo Pagamento</Label>
                      <Select value={formData.payment_method || ''} onValueChange={(v) => handleFormChange('payment_method', v)}>
                        <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bonifico">Bonifico Bancario</SelectItem>
                          <SelectItem value="banca">Banca (altro)</SelectItem>
                          <SelectItem value="carta">Carta</SelectItem>
                          <SelectItem value="american_express">American Express</SelectItem>
                          <SelectItem value="carta_aziendale">Carta Aziendale</SelectItem>
                          <SelectItem value="contanti">Contanti</SelectItem>
                          <SelectItem value="cassa">Cassa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Date scadenza e pagamento */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data Scadenza</Label>
                      <Input
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => handleFormChange('due_date', e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Data Pagamento</Label>
                      <Input
                        type="date"
                        value={formData.payment_date}
                        onChange={(e) => handleFormChange('payment_date', e.target.value)}
                      />
                    </div>

                    {/* Documento operativo collegato */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Documento Operativo</Label>
                      <Select value={formData.source_document_type} onValueChange={(v) => {
                        const next = v === "__none__" ? "" : v;
                        handleFormChange('source_document_type', next);
                        handleFormChange('source_document_id', '');
                      }}>
                        <SelectTrigger><SelectValue placeholder="Collega (opzionale)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Nessun collegamento</SelectItem>
                          <SelectItem value="ddt">DDT</SelectItem>
                          <SelectItem value="sales_order">Ordine di Vendita</SelectItem>
                          <SelectItem value="service_report">Rapporto Intervento</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {formData.source_document_type && (
                      <div className="space-y-1.5">
                        <Label className="text-xs">Seleziona {formData.source_document_type === 'ddt' ? 'DDT' : formData.source_document_type === 'sales_order' ? 'Ordine' : 'Rapporto'}</Label>
                        <Select value={formData.source_document_id} onValueChange={(v) => handleFormChange('source_document_id', v)}>
                          <SelectTrigger><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                          <SelectContent>
                            {formData.source_document_type === 'ddt' && ddts.map(d => {
                              const customerName = (d.customer as any)?.company_name || (d.customer as any)?.name || (d.ddt_data as any)?.destinatario || '';
                              return (
                                <SelectItem key={d.id} value={d.id}>
                                  <span>{d.ddt_number}{customerName ? ` — ${customerName}` : ''}</span>
                                </SelectItem>
                              );
                            })}
                            {formData.source_document_type === 'sales_order' && salesOrders.map(o => {
                              const customerName = (o.customer as any)?.company_name || (o.customer as any)?.name || '';
                              return (
                                <SelectItem key={o.id} value={o.id}>
                                  <span>{o.number}{customerName ? ` — ${customerName}` : ''}{o.order_date ? ` (${format(new Date(o.order_date), 'dd/MM/yyyy')})` : ''}</span>
                                </SelectItem>
                              );
                            })}
                            {formData.source_document_type === 'service_report' && serviceReports.map(r => {
                              const customerName = (r.customer as any)?.company_name || (r.customer as any)?.name || '';
                              return (
                                <SelectItem key={r.id} value={r.id}>
                                  <span>{r.intervention_date} - {r.intervention_type}{customerName ? ` — ${customerName}` : ''}</span>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Note */}
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-xs">Note</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => handleFormChange('notes', e.target.value)}
                        placeholder="Note aggiuntive..."
                        rows={2}
                      />
                    </div>

                    {/* Scadenze multiple */}
                    {(formData.financial_status === 'da_incassare' || formData.financial_status === 'da_pagare') && (
                      <div className="col-span-2 space-y-3 border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Scadenze di Pagamento
                          </Label>
                          <Button type="button" variant="outline" size="sm" onClick={addScadenzaLine}>
                            <Plus className="w-4 h-4 mr-1" />Aggiungi Scadenza
                          </Button>
                        </div>
                        {scadenzeLines.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nessuna scadenza multipla. Verrà creata una singola scadenza con l'importo totale alla data di scadenza indicata.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {scadenzeLines.map((scad, idx) => (
                              <div key={scad.id} className="flex items-center gap-3 p-2 bg-background rounded border">
                                <span className="text-sm font-medium text-muted-foreground w-8">#{idx + 1}</span>
                                <div className="flex-1 grid grid-cols-2 gap-3">
                                  <div>
                                    <Label className="text-xs">Data Scadenza</Label>
                                    <Input type="date" value={scad.due_date} onChange={(e) => updateScadenzaLine(scad.id, 'due_date', e.target.value)} />
                                  </div>
                                  <div>
                                    <Label className="text-xs">Importo €</Label>
                                    <Input type="number" step="0.01" value={scad.amount} onChange={(e) => updateScadenzaLine(scad.id, 'amount', parseFloat(e.target.value) || 0)} />
                                  </div>
                                </div>
                                <Button type="button" variant="ghost" size="icon" onClick={() => removeScadenzaLine(scad.id)} className="text-destructive hover:text-destructive">
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 border-t">
                              <span className="text-sm text-muted-foreground">Totale scadenze:</span>
                              <span className={`font-semibold ${Math.abs(getScadenzeTotal() - totalAmount) > 0.01 ? 'text-destructive' : 'text-green-600'}`}>
                                €{getScadenzeTotal().toLocaleString('it-IT', { minimumFractionDigits: 2 })} / €{totalAmount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                            {Math.abs(getScadenzeTotal() - totalAmount) > 0.01 && (
                              <p className="text-xs text-destructive">⚠️ Il totale delle scadenze non corrisponde all'importo della fattura</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
            
            {/* AI Analysis for Create */}
            <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">Analisi AI</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => runAiAnalysis(formData, false)}
                  disabled={isAiAnalyzing || !formData.imponibile}
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                >
                  {isAiAnalyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analisi...</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" />Suggerisci classificazione</>
                  )}
                </Button>
              </div>
              
              {aiSuggestion && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                  <Badge className={cn(
                    aiSuggestion.confidence === 'high' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                    aiSuggestion.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' :
                    'bg-red-500/20 text-red-600 border-red-500/30'
                  )}>
                    {aiSuggestion.confidence === 'high' ? '🎯 Alta confidenza' :
                     aiSuggestion.confidence === 'medium' ? '⚡ Media confidenza' : '⚠️ Bassa confidenza'}
                  </Badge>
                  <p className="text-sm text-muted-foreground italic">{aiSuggestion.reasoning}</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => applyAiSuggestion(false)} className="gap-1.5">
                      <Check className="w-3.5 h-3.5" />Applica
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => setAiSuggestion(null)}>Ignora</Button>
                  </div>
                </div>
              )}
              
              {!aiSuggestion && !isAiAnalyzing && (
                <p className="text-xs text-muted-foreground">
                  L'AI suggerirà conto, centro e regime IVA basandosi sullo storico del soggetto.
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => {
                if (formData.invoice_number) {
                  checkDuplicateAndSave();
                } else {
                  createMutation.mutate({ ...formData, accountSplits: splitEnabled ? splitLines : undefined });
                }
              }}
              disabled={!formData.imponibile || !formData.invoice_number || createMutation.isPending}
            >
              {createMutation.isPending ? 'Salvataggio...' : 'Registra Documento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert Dialog per fattura duplicata (creazione manuale) */}
      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Fattura già registrata
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Esiste già una fattura con numero <strong>{duplicateInvoiceInfo.number}</strong> nel registro.</p>
                {duplicateInvoiceInfo.existing && (
                  <div className="mt-2 p-3 bg-muted rounded-lg text-sm space-y-1">
                    <p><span className="font-medium">Soggetto:</span> {duplicateInvoiceInfo.existing.subject_name}</p>
                    <p><span className="font-medium">Data:</span> {format(new Date(duplicateInvoiceInfo.existing.invoice_date), 'dd/MM/yyyy', { locale: it })}</p>
                    <p><span className="font-medium">Importo:</span> €{duplicateInvoiceInfo.existing.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                  </div>
                )}
                <p className="mt-3">Procedere comunque con la registrazione?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSaveDuplicate}>
              Procedi comunque
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog per fattura duplicata (bulk upload) */}
      <AlertDialog open={showBulkDuplicateAlert} onOpenChange={(open) => {
        if (!open && bulkDuplicateResolveRef.current) {
          bulkDuplicateResolveRef.current('skip');
          bulkDuplicateResolveRef.current = null;
        }
        setShowBulkDuplicateAlert(open);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Fattura duplicata rilevata
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>Il file <strong>{bulkDuplicateInfo.fileName}</strong> contiene la fattura n. <strong>{bulkDuplicateInfo.invoiceNumber}</strong> che è già presente nel registro.</p>
                {bulkDuplicateInfo.existing && (
                  <div className="mt-2 p-3 bg-muted rounded-lg text-sm space-y-1">
                    <p><span className="font-medium">Soggetto:</span> {bulkDuplicateInfo.existing.subject_name}</p>
                    <p><span className="font-medium">Data:</span> {format(new Date(bulkDuplicateInfo.existing.invoice_date), 'dd/MM/yyyy', { locale: it })}</p>
                    <p><span className="font-medium">Importo:</span> €{bulkDuplicateInfo.existing.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                    <p><span className="font-medium">Stato:</span> {bulkDuplicateInfo.existing.status}</p>
                  </div>
                )}
                <p className="mt-3">Vuoi sostituire la registrazione esistente o saltare questo file?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              if (bulkDuplicateResolveRef.current) {
                bulkDuplicateResolveRef.current('skip');
                bulkDuplicateResolveRef.current = null;
              }
              setShowBulkDuplicateAlert(false);
            }}>
              Salta (non importare)
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (bulkDuplicateResolveRef.current) {
                bulkDuplicateResolveRef.current('replace');
                bulkDuplicateResolveRef.current = null;
              }
              setShowBulkDuplicateAlert(false);
            }} className="bg-amber-600 hover:bg-amber-700">
              Sostituisci
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk AI Classification Dialog */}
      <BulkAIClassificationDialog
        open={showBulkAIDialog}
        onOpenChange={setShowBulkAIDialog}
        invoices={invoices as any[]}
        accounts={accounts}
        costCenters={costCenters}
        profitCenters={profitCenters}
        onApprove={handleBulkAIApprove}
        onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['invoice-registry'] });
        }}
      />

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
              onClick={() => selectedInvoice && registerMutation.mutate({ invoice: selectedInvoice, scadenze: scadenzeLines })}
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
              <Label>Regime IVA</Label>
              <Select value={editFormData.vat_regime} onValueChange={(v) => handleEditFormChange('vat_regime', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domestica_imponibile">Ordinario (22%)</SelectItem>
                  <SelectItem value="ridotta_10">Ridotta (10%)</SelectItem>
                  <SelectItem value="ridotta_4">Minima (4%)</SelectItem>
                  <SelectItem value="esente">Esente (0%)</SelectItem>
                  <SelectItem value="reverse_charge">Reverse Charge (0%)</SelectItem>
                  <SelectItem value="ue_non_imponibile">Intra UE (0%)</SelectItem>
                  <SelectItem value="extra_ue">Extra UE (0%)</SelectItem>
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
                    {editFormData.source_document_type === 'ddt' && ddts.map(d => {
                      const customerName = (d.customer as any)?.company_name || (d.customer as any)?.name || (d.ddt_data as any)?.destinatario || '';
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          <span>{d.ddt_number}{customerName ? ` — ${customerName}` : ''}</span>
                        </SelectItem>
                      );
                    })}
                    {editFormData.source_document_type === 'sales_order' && salesOrders.map(o => {
                      const customerName = (o.customer as any)?.company_name || (o.customer as any)?.name || '';
                      return (
                        <SelectItem key={o.id} value={o.id}>
                          <span>{o.number}{customerName ? ` — ${customerName}` : ''}{o.order_date ? ` (${format(new Date(o.order_date), 'dd/MM/yyyy')})` : ''}</span>
                        </SelectItem>
                      );
                    })}
                    {editFormData.source_document_type === 'service_report' && serviceReports.map(r => {
                      const customerName = (r.customer as any)?.company_name || (r.customer as any)?.name || '';
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          <span>{r.intervention_date} - {r.intervention_type}{customerName ? ` — ${customerName}` : ''}</span>
                        </SelectItem>
                      );
                    })}
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
            
            {/* AI Accounting Analysis */}
            <div className="col-span-2">
              <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-primary">Analisi AI Contabilizzazione</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => runAiAnalysis(editFormData, true)}
                    disabled={isAiAnalyzing || !editFormData.imponibile}
                    className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    {isAiAnalyzing ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" />Analisi...</>
                    ) : (
                      <><Sparkles className="w-3.5 h-3.5" />Analizza</>
                    )}
                  </Button>
                </div>
                
                {aiSuggestion && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                    {/* Confidence badge */}
                    <div className="flex items-center gap-2">
                      <Badge className={cn(
                        aiSuggestion.confidence === 'high' ? 'bg-green-500/20 text-green-600 border-green-500/30' :
                        aiSuggestion.confidence === 'medium' ? 'bg-amber-500/20 text-amber-600 border-amber-500/30' :
                        'bg-red-500/20 text-red-600 border-red-500/30'
                      )}>
                        {aiSuggestion.confidence === 'high' ? '🎯 Alta confidenza' :
                         aiSuggestion.confidence === 'medium' ? '⚡ Media confidenza' :
                         '⚠️ Bassa confidenza'}
                      </Badge>
                    </div>
                    
                    {/* Reasoning */}
                    <p className="text-sm text-muted-foreground italic">
                      {aiSuggestion.reasoning}
                    </p>
                    
                    {/* Suggestions detail */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {aiSuggestion.cost_account_id && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Conto Costo:</span>
                          <p className="font-medium">{accounts.find(a => a.id === aiSuggestion.cost_account_id)?.name || aiSuggestion.cost_account_id}</p>
                        </div>
                      )}
                      {aiSuggestion.revenue_account_id && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Conto Ricavo:</span>
                          <p className="font-medium">{accounts.find(a => a.id === aiSuggestion.revenue_account_id)?.name || aiSuggestion.revenue_account_id}</p>
                        </div>
                      )}
                      {aiSuggestion.cost_center_id && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Centro Costo:</span>
                          <p className="font-medium">{costCenters.find(c => c.id === aiSuggestion.cost_center_id)?.name || aiSuggestion.cost_center_id}</p>
                        </div>
                      )}
                      {aiSuggestion.profit_center_id && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Centro Ricavo:</span>
                          <p className="font-medium">{profitCenters.find(c => c.id === aiSuggestion.profit_center_id)?.name || aiSuggestion.profit_center_id}</p>
                        </div>
                      )}
                      {aiSuggestion.vat_regime && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Regime IVA:</span>
                          <p className="font-medium">{aiSuggestion.vat_regime === 'domestica_imponibile' ? 'Ordinario' : aiSuggestion.vat_regime === 'reverse_charge' ? 'Reverse Charge' : aiSuggestion.vat_regime}</p>
                        </div>
                      )}
                      {aiSuggestion.iva_rate !== undefined && (
                        <div className="bg-background rounded p-2">
                          <span className="text-muted-foreground">Aliquota IVA:</span>
                          <p className="font-medium">{aiSuggestion.iva_rate}%</p>
                        </div>
                      )}
                    </div>
                    
                    {/* Warnings */}
                    {aiSuggestion.warnings && aiSuggestion.warnings.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded p-2 space-y-1">
                        {aiSuggestion.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
                            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{w}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {/* Apply button */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => applyAiSuggestion(true)}
                        className="gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Applica suggerimenti
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setAiSuggestion(null)}
                      >
                        Ignora
                      </Button>
                    </div>
                  </div>
                )}
                
                {!aiSuggestion && !isAiAnalyzing && (
                  <p className="text-xs text-muted-foreground">
                    L'AI analizzerà la fattura e suggerirà conto, centro di costo/ricavo e regime IVA basandosi sullo storico.
                  </p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Annulla
            </Button>
            {selectedInvoice?.status === 'bozza' ? (
              <>
                <Button 
                  variant="outline"
                  onClick={() => selectedInvoice && updateInvoiceMutation.mutate({ 
                    invoice: selectedInvoice, 
                    updates: editFormData,
                    accountSplits: editSplitEnabled ? editSplitLines : undefined
                  })}
                  disabled={updateInvoiceMutation.isPending}
                >
                  {updateInvoiceMutation.isPending ? 'Salvataggio...' : 'Salva Bozza'}
                </Button>
                <Button 
                  onClick={() => {
                    if (!selectedInvoice) return;
                    updateInvoiceMutation.mutate({ 
                      invoice: selectedInvoice, 
                      updates: editFormData,
                      accountSplits: editSplitEnabled ? editSplitLines : undefined
                    }, {
                      onSuccess: () => {
                        setShowEditDialog(false);
                        const ivaAmount = editFormData.imponibile * (editFormData.iva_rate / 100);
                        const totalAmount = editFormData.imponibile + ivaAmount;
                        const inv = { 
                          ...selectedInvoice, 
                          ...editFormData,
                          iva_amount: ivaAmount,
                          total_amount: totalAmount,
                        } as any as InvoiceRegistry;
                        registerMutation.mutate({ invoice: inv, scadenze: scadenzeLines });
                      }
                    });
                  }}
                  disabled={updateInvoiceMutation.isPending || registerMutation.isPending}
                  className="gap-1.5"
                >
                  <FileCheck className="w-4 h-4" />
                  {registerMutation.isPending ? 'Contabilizzazione...' : 'Contabilizza'}
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => selectedInvoice && updateInvoiceMutation.mutate({ 
                  invoice: selectedInvoice, 
                  updates: editFormData,
                  accountSplits: editSplitEnabled ? editSplitLines : undefined
                })}
                disabled={updateInvoiceMutation.isPending}
              >
                {updateInvoiceMutation.isPending ? 'Salvataggio...' : 'Salva Modifiche'}
              </Button>
            )}
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
                    <SelectItem value="fattura_acquisto">Fattura di Acquisto</SelectItem>
                    <SelectItem value="fattura_vendita">Fattura di Vendita</SelectItem>
                    <SelectItem value="nota_credito">Nota di Credito/Debito</SelectItem>
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

              {/* Stato finale della registrazione */}
              <div className="space-y-2 pt-4 border-t">
                <Label>Stato Finale *</Label>
                <Select 
                  value="contabilizzato"
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
                  Le fatture vengono contabilizzate automaticamente
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

      {/* Dialog Registra Pagamento */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              {selectedInvoice?.invoice_type === 'vendita' ? 'Registra Incasso' : 'Registra Pagamento'}
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fattura:</span>
                    <span className="font-mono font-medium">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Soggetto:</span>
                    <span>{selectedInvoice.subject_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Totale fattura:</span>
                    <span className="font-bold">€{selectedInvoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                  </div>
                  {scadenzaResiduo !== null && scadenzaResiduo < selectedInvoice.total_amount && (
                    <div className="flex justify-between border-t pt-2">
                      <span className="text-muted-foreground">Già versato:</span>
                      <span className="text-green-600 font-medium">€{(selectedInvoice.total_amount - scadenzaResiduo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-muted-foreground font-semibold">Residuo da {selectedInvoice.invoice_type === 'vendita' ? 'incassare' : 'pagare'}:</span>
                    <span className="font-bold text-primary">€{(scadenzaResiduo ?? selectedInvoice.total_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="partial-payment"
                    checked={paymentData.is_partial}
                    onChange={(e) => {
                      const residuo = scadenzaResiduo ?? selectedInvoice.total_amount;
                      setPaymentData(prev => ({
                        ...prev,
                        is_partial: e.target.checked,
                        amount: e.target.checked ? prev.amount : residuo
                      }));
                    }}
                    className="rounded border-muted-foreground/30"
                  />
                  <Label htmlFor="partial-payment" className="text-sm cursor-pointer">Pagamento parziale (acconto)</Label>
                </div>
                
                <div className="space-y-2">
                  <Label>Importo {paymentData.is_partial ? 'acconto' : ''} (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={scadenzaResiduo ?? selectedInvoice.total_amount}
                    value={paymentData.amount || ''}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    disabled={!paymentData.is_partial}
                  />
                  {paymentData.is_partial && (
                    <p className="text-xs text-muted-foreground">
                      Max: €{(scadenzaResiduo ?? selectedInvoice.total_amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Data {selectedInvoice.invoice_type === 'vendita' ? 'incasso' : 'pagamento'} *</Label>
                  <Input
                    type="date"
                    value={paymentData.payment_date}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Metodo di pagamento *</Label>
                  <Select value={paymentData.payment_method} onValueChange={(v) => setPaymentData(prev => ({ ...prev, payment_method: v }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Note (opzionale)</Label>
                  <Textarea
                    value={paymentData.notes}
                    onChange={(e) => setPaymentData(prev => ({ ...prev, notes: e.target.value }))}
                    rows={2}
                    placeholder="Es: Bonifico n. 12345"
                  />
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
                <p className="text-muted-foreground">Verrà creato automaticamente:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Movimento di Prima Nota ({selectedInvoice.invoice_type === 'vendita' ? 'incasso' : 'pagamento'})</li>
                  <li>Scrittura partita doppia</li>
                  <li>Movimento sullo scadenziario</li>
                  {!paymentData.is_partial && <li>Chiusura scadenza</li>}
                </ul>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>Annulla</Button>
            <Button
              onClick={() => selectedInvoice && paymentMutation.mutate({ invoice: selectedInvoice, payment: paymentData })}
              disabled={paymentMutation.isPending || !paymentData.amount || paymentData.amount <= 0}
              className="bg-green-600 hover:bg-green-700"
            >
              {paymentMutation.isPending ? 'Registrazione...' : paymentData.is_partial ? 'Registra Acconto' : 'Registra Pagamento'}
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

      {/* Invoice Details Dialog */}
      <InvoiceDetailsDialog 
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        invoice={detailsInvoice}
        accounts={accounts}
        costCenters={costCenters}
        profitCenters={profitCenters}
        onRegister={(inv) => {
          setShowDetailsDialog(false);
          openEditDialog(inv as any);
        }}
        onEdit={(inv) => {
          setShowDetailsDialog(false);
          openEditDialog(inv as any);
        }}
      />
    </div>
  );
}

// Componente Dialog per i dettagli della fattura
function InvoiceDetailsDialog({
  open,
  onOpenChange,
  invoice,
  accounts,
  costCenters,
  profitCenters,
  onRegister,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceRegistry | null;
  accounts: any[];
  costCenters: any[];
  profitCenters: any[];
  onRegister?: (invoice: InvoiceRegistry) => void;
  onEdit?: (invoice: InvoiceRegistry) => void;
}) {
  const { data: primaNotaData } = useQuery({
    queryKey: ['prima-nota-details', invoice?.prima_nota_id],
    queryFn: async () => {
      if (!invoice?.prima_nota_id) return null;
      
      const { data: primaNota, error: pnError } = await supabase
        .from('prima_nota')
        .select('*')
        .eq('id', invoice.prima_nota_id)
        .single();
      
      if (pnError) throw pnError;
      
      const { data: lines, error: linesError } = await supabase
        .from('prima_nota_lines')
        .select('*')
        .eq('prima_nota_id', invoice.prima_nota_id)
        .order('line_order');
      
      if (linesError) throw linesError;
      
      return { primaNota, lines };
    },
    enabled: open && !!invoice?.prima_nota_id
  });

  const getAccountName = (accountId: string | null) => {
    if (!accountId) return '-';
    const account = accounts.find(a => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : accountId;
  };

  const getCenterName = (centerId: string | null, isCost: boolean) => {
    if (!centerId) return '-';
    const centers = isCost ? costCenters : profitCenters;
    const center = centers.find(c => c.id === centerId);
    return center ? `${center.code} - ${center.name}` : centerId;
  };

  const getVatRegimeLabel = (regime: string) => {
    const labels: Record<string, string> = {
      'domestica_imponibile': 'Ordinario (22%)',
      'ue_non_imponibile': 'Intra UE (0%)',
      'extra_ue': 'Extra UE',
      'reverse_charge': 'Reverse Charge (0%)'
    };
    return labels[regime] || regime;
  };

  if (!invoice) return null;

  const isCost = invoice.invoice_type === 'acquisto';
  const accountSplits = Array.isArray(invoice.account_splits) ? invoice.account_splits : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Dettagli Fattura {invoice.invoice_number}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Info generali */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Informazioni Generali</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Data</p>
                <p className="font-medium">{format(new Date(invoice.invoice_date), 'dd/MM/yyyy', { locale: it })}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium capitalize">{invoice.invoice_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Soggetto</p>
                <p className="font-medium">{invoice.subject_name}</p>
                <p className="text-xs text-muted-foreground capitalize">{invoice.subject_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Regime IVA</p>
                <p className="font-medium">{getVatRegimeLabel(invoice.vat_regime)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Importi */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Importi</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground text-sm">Imponibile</p>
                  <p className="text-xl font-bold">€{invoice.imponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground text-sm">IVA ({invoice.iva_rate}%)</p>
                  <p className="text-xl font-bold">€{invoice.iva_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
                <div className="p-3 bg-primary/10 rounded-lg">
                  <p className="text-muted-foreground text-sm">Totale</p>
                  <p className="text-xl font-bold text-primary">€{invoice.total_amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Classificazione contabile */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Classificazione Contabile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {accountSplits.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Ripartizione su più conti:</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isCost ? 'Conto di Costo' : 'Conto di Ricavo'}</TableHead>
                        <TableHead>{isCost ? 'Centro di Costo' : 'Centro di Ricavo'}</TableHead>
                        <TableHead className="text-right">Importo</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accountSplits.map((split: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell>{getAccountName(split.account_id)}</TableCell>
                          <TableCell>{getCenterName(isCost ? split.cost_center_id : split.profit_center_id, isCost)}</TableCell>
                          <TableCell className="text-right font-medium">€{(split.amount || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right">{(split.percentage || 0).toFixed(1)}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{isCost ? 'Conto di Costo' : 'Conto di Ricavo'}</p>
                    <p className="font-medium">{getAccountName(isCost ? invoice.cost_account_id : invoice.revenue_account_id)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{isCost ? 'Centro di Costo' : 'Centro di Ricavo'}</p>
                    <p className="font-medium">{getCenterName(isCost ? invoice.cost_center_id : invoice.profit_center_id, isCost)}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scritture Contabili (Prima Nota) */}
          {primaNotaData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Receipt className="w-4 h-4" />
                  Scritture Contabili (Partita Doppia)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Conto</TableHead>
                      <TableHead className="text-right">DARE</TableHead>
                      <TableHead className="text-right">AVERE</TableHead>
                      <TableHead>Descrizione</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {primaNotaData.lines?.map((line: any, idx: number) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {line.account_type === 'dynamic' 
                            ? line.dynamic_account_key 
                            : getAccountName(line.chart_account_id)}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {line.dare > 0 ? `€ ${line.dare.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {line.avere > 0 ? `€ ${line.avere.toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{line.description}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/50 font-semibold">
                      <TableCell></TableCell>
                      <TableCell>TOTALE</TableCell>
                      <TableCell className="text-right">
                        € {(primaNotaData.lines?.reduce((sum: number, l: any) => sum + (l.dare || 0), 0) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        € {(primaNotaData.lines?.reduce((sum: number, l: any) => sum + (l.avere || 0), 0) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {Math.abs((primaNotaData.lines?.reduce((sum: number, l: any) => sum + (l.dare || 0) - (l.avere || 0), 0) || 0)) < 0.01 
                          ? <Badge className="bg-green-500/20 text-green-600">Bilanciato</Badge>
                          : <Badge className="bg-red-500/20 text-red-600">Sbilanciato</Badge>}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Stato finanziario */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stato Finanziario</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Stato Documento</p>
                <Badge className={
                  invoice.status === 'contabilizzato' ? 'bg-green-500/20 text-green-600' :
                  invoice.status === 'registrata' ? 'bg-primary/20 text-primary' :
                  'bg-muted'
                }>
                  {invoice.status}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Stato Pagamento</p>
                <Badge className={
                  ['incassata', 'pagata'].includes(invoice.financial_status) ? 'bg-green-500/20 text-green-600' :
                  'bg-amber-500/20 text-amber-600'
                }>
                  {invoice.financial_status?.replace('_', ' ')}
                </Badge>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-muted-foreground">Scadenza</p>
                  <p className="font-medium">{format(new Date(invoice.due_date), 'dd/MM/yyyy', { locale: it })}</p>
                </div>
              )}
              {invoice.payment_method && (
                <div>
                  <p className="text-muted-foreground">Metodo Pagamento</p>
                  <p className="font-medium capitalize">{invoice.payment_method}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {invoice.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{invoice.notes}</p>
              </CardContent>
            </Card>
          )}

          {/* Anteprima allegato */}
          {invoice.attachment_url && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Documento Allegato
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <div className="aspect-[4/3] max-h-[500px]">
                    <AttachmentPreview 
                      url={invoice.attachment_url} 
                      alt={`Fattura ${invoice.invoice_number}`} 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border-t bg-background">
                    <span className="text-xs text-muted-foreground truncate">
                      {(() => {
                        try { return new URL(invoice.attachment_url).pathname.split('/').pop() || 'documento'; } catch { return 'documento'; }
                      })()}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => window.open(invoice.attachment_url!, '_blank')}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Apri originale
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-between">
          <div className="flex gap-2">
            {invoice.status === 'bozza' && onEdit && (
              <Button variant="outline" onClick={() => onEdit(invoice)}>
                <Pencil className="w-4 h-4 mr-1.5" />
                Modifica
              </Button>
            )}
            {invoice.status === 'bozza' && onRegister && (
              <Button onClick={() => onRegister(invoice)} className="gap-1.5">
                <FileCheck className="w-4 h-4" />
                Contabilizza
              </Button>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
