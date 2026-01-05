import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  ArrowUp, ArrowDown, FileText, CheckCircle, ExternalLink, 
  Save, MessageSquare, Pause, Send, AlertCircle, Image, Trash2, HelpCircle, Sparkles, Loader2, UserPlus, Building2, Check
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { findSimilarSubjects, SubjectMatch } from "@/lib/fuzzyMatch";
import { SimilarSubjectDialog, SimilarSubjectAction } from "@/components/shared/SimilarSubjectDialog";

interface DetectedSubject {
  type: "cliente" | "fornitore";
  name: string;
  tax_id?: string;
  address?: string;
  city?: string;
  existing_id?: string;
  found: boolean;
}

interface AccountingEntry {
  id: string;
  direction: string;
  document_type: string;
  amount: number;
  document_date: string;
  attachment_url: string;
  payment_method: string | null;
  subject_type: string | null;
  note: string | null;
  status: string;
  created_at: string;
  // Classification fields
  event_type?: string | null;
  affects_income_statement?: boolean | null;
  chart_account_id?: string | null;
  temporal_competence?: string | null;
  is_recurring?: boolean | null;
  recurrence_period?: string | null;
  recurrence_start_date?: string | null;
  recurrence_end_date?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  center_percentage?: number | null;
  economic_subject_type?: string | null;
  economic_subject_id?: string | null;
  financial_status?: string | null;
  payment_date?: string | null;
  cfo_notes?: string | null;
}

interface CostCenter {
  id: string;
  name: string;
  code: string;
}

interface ProfitCenter {
  id: string;
  name: string;
  code: string;
}

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  account_type: string;
  level?: number | null;
}

// Macro-categorie contabili per filtro progressivo
const accountCategories = [
  { value: "revenue", label: "Ricavi", accountType: "revenue" },
  { value: "cogs", label: "Costo del Venduto (COGS)", accountType: "cogs" },
  { value: "opex", label: "Spese Operative (Opex)", accountType: "opex" },
];

const documentTypes = [
  { value: "fattura", label: "Fattura" },
  { value: "scontrino", label: "Scontrino / Ricevuta" },
  { value: "estratto_conto", label: "Estratto conto" },
  { value: "documento_interno", label: "Documento interno" },
  { value: "rapporto_intervento", label: "Rapporto di intervento" },
  { value: "altro", label: "Altro" },
];

const paymentMethods = [
  { value: "contanti", label: "Contanti" },
  { value: "carta", label: "Carta" },
  { value: "bonifico", label: "Bonifico" },
  { value: "anticipo_personale", label: "Anticipo personale" },
  { value: "non_so", label: "Non so" },
];

const eventTypes = [
  { value: "ricavo", label: "Ricavo" },
  { value: "costo", label: "Costo" },
  { value: "evento_finanziario", label: "Evento finanziario" },
  { value: "assestamento", label: "Assestamento" },
  { value: "evento_interno", label: "Evento interno" },
];

const temporalCompetences = [
  { value: "immediata", label: "Immediata" },
  { value: "differita", label: "Differita" },
  { value: "rateizzata", label: "Rateizzata" },
];

const financialStatuses = [
  { value: "pagato", label: "Pagato" },
  { value: "da_pagare", label: "Da pagare" },
  { value: "incassato", label: "Incassato" },
  { value: "da_incassare", label: "Da incassare" },
  { value: "anticipato_dipendente", label: "Anticipato da dipendente" },
];

const economicSubjectTypes = [
  { value: "cliente", label: "Cliente" },
  { value: "fornitore", label: "Fornitore" },
  { value: "dipendente", label: "Dipendente" },
  { value: "progetto", label: "Progetto" },
];

export default function EventClassificationPage() {
  const queryClient = useQueryClient();
  const [selectedEntry, setSelectedEntry] = useState<AccountingEntry | null>(null);
  const [accountCategory, setAccountCategory] = useState<string>("");
  const [isClassifying, setIsClassifying] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);
  const [detectedSubject, setDetectedSubject] = useState<DetectedSubject | null>(null);
  const [showSubjectDialog, setShowSubjectDialog] = useState(false);
  const [isCreatingSubject, setIsCreatingSubject] = useState(false);
  const [viewMode, setViewMode] = useState<"da_classificare" | "classificati" | "contabilizzati">("da_classificare");
  
  // Fuzzy match state
  const [showSimilarDialog, setShowSimilarDialog] = useState(false);
  const [similarMatches, setSimilarMatches] = useState<SubjectMatch[]>([]);
  const [pendingSubjectName, setPendingSubjectName] = useState<string>("");
  // Classification form state
  const [classificationForm, setClassificationForm] = useState({
    event_type: "",
    affects_income_statement: false,
    chart_account_id: "",
    temporal_competence: "immediata",
    is_recurring: false,
    recurrence_period: "",
    recurrence_start_date: "",
    recurrence_end_date: "",
    cost_center_id: "",
    profit_center_id: "",
    center_percentage: 100,
    economic_subject_type: "",
    economic_subject_id: "",
    financial_status: "",
    payment_date: "",
    cfo_notes: "",
  });

  // Fetch entries based on view mode
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["accounting-entries-to-classify", viewMode],
    queryFn: async () => {
      let statusFilter: string[] = [];
      
      if (viewMode === "da_classificare") {
        statusFilter = ["da_classificare", "in_classificazione", "sospeso"];
      } else if (viewMode === "classificati") {
        statusFilter = ["classificato", "pronto_prima_nota"];
      } else if (viewMode === "contabilizzati") {
        statusFilter = ["contabilizzato"];
      }
      
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("*")
        .in("status", statusFilter)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AccountingEntry[];
    },
  });

  // Fetch cost centers
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as CostCenter[];
    },
  });

  // Fetch profit centers
  const { data: profitCenters = [] } = useQuery({
    queryKey: ["profit-centers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profit_centers")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as ProfitCenter[];
    },
  });

  // Fetch chart of accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-of-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chart_of_accounts")
        .select("id, code, name, account_type, level")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as ChartAccount[];
    },
  });

  // Fetch customers for fuzzy matching
  const { data: allCustomers = [] } = useQuery({
    queryKey: ["all-customers-for-matching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, code, tax_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch suppliers for fuzzy matching
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ["all-suppliers-for-matching"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, code, tax_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Save classification mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = {
        status: data.status,
        event_type: classificationForm.event_type || null,
        affects_income_statement: classificationForm.affects_income_statement,
        chart_account_id: classificationForm.chart_account_id || null,
        temporal_competence: classificationForm.temporal_competence,
        is_recurring: classificationForm.is_recurring,
        recurrence_period: classificationForm.is_recurring ? classificationForm.recurrence_period : null,
        recurrence_start_date: classificationForm.temporal_competence === "rateizzata" ? classificationForm.recurrence_start_date || null : null,
        recurrence_end_date: classificationForm.temporal_competence === "rateizzata" ? classificationForm.recurrence_end_date || null : null,
        cost_center_id: classificationForm.cost_center_id || null,
        profit_center_id: classificationForm.profit_center_id || null,
        center_percentage: classificationForm.center_percentage,
        economic_subject_type: classificationForm.economic_subject_type || null,
        financial_status: classificationForm.financial_status || null,
        payment_date: classificationForm.payment_date || null,
        cfo_notes: classificationForm.cfo_notes || null,
      };

      if (data.status === "classificato" || data.status === "pronto_prima_nota") {
        const { data: userData } = await supabase.auth.getUser();
        updateData.classified_by = userData.user?.id;
        updateData.classified_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("accounting_entries")
        .update(updateData)
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      const messages: Record<string, string> = {
        classificato: "Classificazione salvata",
        sospeso: "Evento sospeso",
        richiesta_integrazione: "Richiesta integrazione inviata",
        pronto_prima_nota: "Evento inviato a Prima Nota",
      };
      toast.success(messages[variables.status] || "Operazione completata");
      setSelectedEntry(null);
    },
    onError: () => {
      toast.error("Errore durante l'operazione");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("accounting_entries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Registrazione eliminata");
      setSelectedEntry(null);
    },
    onError: () => {
      toast.error("Errore durante l'eliminazione");
    },
  });

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleOpenEntry = (entry: AccountingEntry) => {
    setSelectedEntry(entry);
    setAiReasoning(null);
    setDetectedSubject(null);
    
    // Determine category from existing chart_account_id
    let category = "";
    if (entry.chart_account_id) {
      const existingAccount = accounts.find(a => a.id === entry.chart_account_id);
      if (existingAccount) {
        category = existingAccount.account_type;
      }
    }
    setAccountCategory(category);
    
    setClassificationForm({
      event_type: entry.event_type || "",
      affects_income_statement: entry.affects_income_statement ?? false,
      chart_account_id: entry.chart_account_id || "",
      temporal_competence: entry.temporal_competence || "immediata",
      is_recurring: entry.is_recurring ?? false,
      recurrence_period: entry.recurrence_period || "",
      recurrence_start_date: entry.recurrence_start_date || "",
      recurrence_end_date: entry.recurrence_end_date || "",
      cost_center_id: entry.cost_center_id || "",
      profit_center_id: entry.profit_center_id || "",
      center_percentage: entry.center_percentage ?? 100,
      economic_subject_type: entry.economic_subject_type || "",
      economic_subject_id: entry.economic_subject_id || "",
      financial_status: entry.financial_status || "",
      payment_date: entry.payment_date || "",
      cfo_notes: entry.cfo_notes || "",
    });
  };

  // AI Classification
  const handleAIClassify = async () => {
    if (!selectedEntry) return;
    
    setIsClassifying(true);
    setAiReasoning(null);
    setDetectedSubject(null);
    
    try {
      const { data, error } = await supabase.functions.invoke("classify-accounting-entry", {
        body: {
          entry: selectedEntry,
          chartOfAccounts: accounts.filter(a => a.level === null || a.level === undefined || a.level >= 2),
          costCenters,
          profitCenters,
        },
      });

      if (error) throw error;
      
      if (data?.success && data?.classification) {
        const c = data.classification;
        
        // Set account category first
        if (c.account_category) {
          setAccountCategory(c.account_category);
        }
        
        // Update form with AI suggestions
        setClassificationForm(prev => ({
          ...prev,
          event_type: c.event_type || prev.event_type,
          affects_income_statement: c.affects_income_statement ?? prev.affects_income_statement,
          chart_account_id: c.chart_account_id || prev.chart_account_id,
          temporal_competence: c.temporal_competence || prev.temporal_competence,
          cost_center_id: c.cost_center_id || prev.cost_center_id,
          profit_center_id: c.profit_center_id || prev.profit_center_id,
          financial_status: c.financial_status || prev.financial_status,
          economic_subject_type: c.subject_type || prev.economic_subject_type,
          economic_subject_id: c.existing_subject?.id || prev.economic_subject_id,
        }));
        
        if (c.reasoning) {
          setAiReasoning(c.reasoning);
        }
        
        // Handle detected subject (customer or supplier)
        if (c.subject_name) {
          // Determine the AI-suggested type
          let suggestedType: "cliente" | "fornitore" = c.subject_type || (c.event_type === "ricavo" ? "cliente" : "fornitore");
          
          // Check if we found a match in either table
          const foundAsCustomer = !!c.customer_match;
          const foundAsSupplier = !!c.supplier_match;
          
          // If AI says fornitore but we found it as cliente, switch
          if (suggestedType === "fornitore" && foundAsCustomer && !foundAsSupplier) {
            suggestedType = "cliente";
          } else if (suggestedType === "cliente" && foundAsSupplier && !foundAsCustomer) {
            suggestedType = "fornitore";
          }
          
          const existingMatch = suggestedType === "cliente" ? c.customer_match : c.supplier_match;
          
          const detected: DetectedSubject = {
            type: suggestedType,
            name: c.subject_name,
            tax_id: c.subject_tax_id,
            address: c.subject_address,
            city: c.subject_city,
            existing_id: existingMatch?.id,
            found: !!existingMatch,
          };
          setDetectedSubject(detected);
          
          // Store the full match data for potential type switching
          (detected as any).customerMatch = c.customer_match;
          (detected as any).supplierMatch = c.supplier_match;
          
          // If not found, show dialog to create
          if (!detected.found) {
            setShowSubjectDialog(true);
          } else {
            toast.success(`${detected.type === "cliente" ? "Cliente" : "Fornitore"} trovato in anagrafica: ${existingMatch?.name || existingMatch?.company_name || detected.name}`);
          }
        }
        
        toast.success("Classificazione AI completata! Verifica e conferma.");
      } else {
        toast.error(data?.error || "Errore nella classificazione AI");
      }
    } catch (err) {
      console.error("AI classification error:", err);
      toast.error("Errore durante la classificazione AI");
    } finally {
      setIsClassifying(false);
    }
  };

  // Check for similar subjects before creating
  const checkForSimilarSubjects = () => {
    if (!detectedSubject) return;
    
    const subjectName = detectedSubject.name;
    const subjectList = detectedSubject.type === "cliente" ? allCustomers : allSuppliers;
    
    const matches = findSimilarSubjects(subjectName, subjectList, 0.5);
    
    if (matches.length > 0) {
      // Found similar subjects - show the dialog
      setPendingSubjectName(subjectName);
      setSimilarMatches(matches);
      setShowSimilarDialog(true);
      setShowSubjectDialog(false);
    } else {
      // No similar subjects found - proceed with creation
      createNewSubject();
    }
  };

  // Handle similar subject dialog action
  const handleSimilarSubjectAction = async (action: SimilarSubjectAction, selectedMatch?: SubjectMatch) => {
    if (!detectedSubject) return;
    
    setIsCreatingSubject(true);
    try {
      if (action === "use_existing" && selectedMatch) {
        // Use existing subject
        setClassificationForm(prev => ({
          ...prev,
          economic_subject_type: detectedSubject.type,
          economic_subject_id: selectedMatch.id,
        }));
        setDetectedSubject(prev => prev ? { ...prev, existing_id: selectedMatch.id, found: true } : null);
        toast.success(`Collegato a "${selectedMatch.name}" esistente`);
      } else if (action === "update_existing" && selectedMatch) {
        // Update existing subject name
        if (detectedSubject.type === "cliente") {
          await supabase
            .from("customers")
            .update({ name: detectedSubject.name, company_name: detectedSubject.name })
            .eq("id", selectedMatch.id);
        } else {
          await supabase
            .from("suppliers")
            .update({ name: detectedSubject.name })
            .eq("id", selectedMatch.id);
        }
        
        setClassificationForm(prev => ({
          ...prev,
          economic_subject_type: detectedSubject.type,
          economic_subject_id: selectedMatch.id,
        }));
        setDetectedSubject(prev => prev ? { ...prev, existing_id: selectedMatch.id, found: true } : null);
        queryClient.invalidateQueries({ queryKey: detectedSubject.type === "cliente" ? ["all-customers-for-matching"] : ["all-suppliers-for-matching"] });
        toast.success(`"${selectedMatch.name}" aggiornato a "${detectedSubject.name}"`);
      } else if (action === "create_new") {
        // Create new subject
        await createNewSubject();
      }
      
      setShowSimilarDialog(false);
    } catch (err) {
      console.error("Error handling similar subject action:", err);
      toast.error("Errore durante l'operazione");
    } finally {
      setIsCreatingSubject(false);
    }
  };

  // Create new customer or supplier
  const createNewSubject = async () => {
    if (!detectedSubject) return;
    
    setIsCreatingSubject(true);
    try {
      if (detectedSubject.type === "cliente") {
        // Code is auto-generated by the database trigger
        const { data, error } = await supabase
          .from("customers")
          .insert({
            name: detectedSubject.name,
            company_name: detectedSubject.name,
            tax_id: detectedSubject.tax_id || null,
            address: detectedSubject.address || null,
            city: detectedSubject.city || null,
            active: true,
          } as any)
          .select()
          .single();
        
        if (error) throw error;
        
        setClassificationForm(prev => ({
          ...prev,
          economic_subject_type: "cliente",
          economic_subject_id: data.id,
        }));
        
        setDetectedSubject(prev => prev ? { ...prev, existing_id: data.id, found: true } : null);
        queryClient.invalidateQueries({ queryKey: ["all-customers-for-matching"] });
        toast.success(`Cliente "${detectedSubject.name}" creato con successo!`);
      } else {
        // Generate random access code and unique code for supplier
        const accessCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const supplierCode = `FORN-${Date.now().toString(36).toUpperCase()}`;
        
        const { data, error } = await supabase
          .from("suppliers")
          .insert({
            code: supplierCode,
            name: detectedSubject.name,
            tax_id: detectedSubject.tax_id || null,
            address: detectedSubject.address || null,
            city: detectedSubject.city || null,
            access_code: accessCode,
          } as any)
          .select()
          .single();
        
        if (error) throw error;
        
        setClassificationForm(prev => ({
          ...prev,
          economic_subject_type: "fornitore",
          economic_subject_id: data.id,
        }));
        
        setDetectedSubject(prev => prev ? { ...prev, existing_id: data.id, found: true } : null);
        queryClient.invalidateQueries({ queryKey: ["all-suppliers-for-matching"] });
        toast.success(`Fornitore "${detectedSubject.name}" creato con successo!`);
      }
      
      setShowSubjectDialog(false);
    } catch (err) {
      console.error("Error creating subject:", err);
      toast.error("Errore durante la creazione");
    } finally {
      setIsCreatingSubject(false);
    }
  };

  const validateForPrimaNota = (): string[] => {
    const errors: string[] = [];
    
    if (!classificationForm.event_type) {
      errors.push("Tipo di evento obbligatorio");
    }
    
    if (classificationForm.affects_income_statement && !classificationForm.chart_account_id) {
      errors.push("Piano dei Conti obbligatorio se incide sul C/E");
    }
    
    const isEconomicEvent = ["ricavo", "costo"].includes(classificationForm.event_type);
    if (isEconomicEvent && !classificationForm.cost_center_id && !classificationForm.profit_center_id) {
      errors.push("Centro di costo/ricavo obbligatorio per eventi economici");
    }
    
    if (classificationForm.temporal_competence === "rateizzata") {
      if (!classificationForm.recurrence_start_date || !classificationForm.recurrence_end_date) {
        errors.push("Date di rateizzazione obbligatorie");
      }
    }
    
    return errors;
  };

  const handleSave = () => {
    if (!selectedEntry) return;
    saveMutation.mutate({ id: selectedEntry.id, status: "in_classificazione" });
  };

  const handleSuspend = () => {
    if (!selectedEntry) return;
    saveMutation.mutate({ id: selectedEntry.id, status: "sospeso" });
  };

  const handleRequestIntegration = () => {
    if (!selectedEntry) return;
    if (!classificationForm.cfo_notes) {
      toast.error("Inserisci una nota con la richiesta di integrazione");
      return;
    }
    saveMutation.mutate({ id: selectedEntry.id, status: "richiesta_integrazione" });
  };

  const handleSendToPrimaNota = () => {
    if (!selectedEntry) return;
    
    const errors = validateForPrimaNota();
    if (errors.length > 0) {
      errors.forEach(err => toast.error(err));
      return;
    }
    
    saveMutation.mutate({ id: selectedEntry.id, status: "pronto_prima_nota" });
  };

  const getDocumentTypeLabel = (value: string) => {
    return documentTypes.find((t) => t.value === value)?.label || value;
  };

  const getPaymentMethodLabel = (value: string) => {
    return paymentMethods.find((m) => m.value === value)?.label || value;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      da_classificare: { variant: "secondary", label: "Da classificare" },
      in_classificazione: { variant: "outline", label: "In classificazione" },
      sospeso: { variant: "destructive", label: "Sospeso" },
      richiesta_integrazione: { variant: "outline", label: "Richiesta integrazione" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  // Auto-set affects_income_statement based on event_type
  // For Costo/Ricavo it's always YES, for others it can be changed
  const handleEventTypeChange = (value: string) => {
    const affectsIncome = ["ricavo", "costo", "assestamento"].includes(value);
    
    // Auto-select category based on event type
    let autoCategory = "";
    if (value === "ricavo") {
      autoCategory = "revenue";
    }
    // For costo, user must choose between cogs and opex
    
    setAccountCategory(autoCategory);
    setClassificationForm(prev => ({
      ...prev,
      event_type: value,
      affects_income_statement: affectsIncome,
      // Clear chart_account_id when event type changes
      chart_account_id: "",
    }));
  };

  // Get available categories based on event type
  const getAvailableCategories = () => {
    const eventType = classificationForm.event_type;
    if (eventType === "ricavo") {
      return accountCategories.filter(c => c.value === "revenue");
    }
    if (eventType === "costo") {
      return accountCategories.filter(c => c.value === "cogs" || c.value === "opex");
    }
    // For assestamento, show all
    return accountCategories;
  };

  // Get filtered accounts based on selected category
  const getFilteredAccounts = () => {
    if (!accountCategory) return [];
    return accounts.filter(a => 
      a.account_type === accountCategory && 
      (a.level === null || a.level === undefined || a.level >= 2)
    );
  };

  // Handle category change
  const handleCategoryChange = (value: string) => {
    setAccountCategory(value);
    setClassificationForm(prev => ({ ...prev, chart_account_id: "" }));
  };

  // Check if affects_income_statement should be locked
  const isAffectsIncomeStatementLocked = () => {
    return ["ricavo", "costo"].includes(classificationForm.event_type);
  };

  // Check if financial status requires payment date
  const requiresPaymentDate = () => {
    return ["pagato", "incassato"].includes(classificationForm.financial_status);
  };

  // Auto-set financial_status based on direction
  const getDefaultFinancialStatus = (direction: string) => {
    return direction === "entrata" ? "incassato" : "pagato";
  };

  const isImage = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  // Storno mutation for contabilizzati entries
  const stornoMutation = useMutation({
    mutationFn: async (entry: AccountingEntry) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Create a reversal entry
      const { error } = await supabase.from("accounting_entries").insert({
        direction: entry.direction === "entrata" ? "uscita" : "entrata",
        document_type: "storno",
        amount: entry.amount,
        document_date: new Date().toISOString().split("T")[0],
        attachment_url: "",
        payment_method: entry.payment_method,
        subject_type: entry.subject_type,
        note: `Storno di registrazione ${entry.id}`,
        status: "contabilizzato",
        user_id: userData.user?.id,
        event_type: entry.event_type,
        affects_income_statement: entry.affects_income_statement,
        chart_account_id: entry.chart_account_id,
        temporal_competence: entry.temporal_competence,
        cost_center_id: entry.cost_center_id,
        profit_center_id: entry.profit_center_id,
        center_percentage: entry.center_percentage,
        economic_subject_type: entry.economic_subject_type,
        financial_status: entry.financial_status,
        cfo_notes: `Storno automatico`,
        classified_by: userData.user?.id,
        classified_at: new Date().toISOString(),
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounting-entries-to-classify"] });
      toast.success("Storno creato con successo");
      setSelectedEntry(null);
    },
    onError: () => {
      toast.error("Errore durante lo storno");
    },
  });

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Classificazione Eventi</h1>
        <p className="text-muted-foreground">
          Gestisci la classificazione degli eventi contabili
        </p>
      </div>

      {/* View Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={viewMode === "da_classificare" ? "default" : "outline"}
          onClick={() => setViewMode("da_classificare")}
          size="sm"
        >
          Da Classificare
        </Button>
        <Button
          variant={viewMode === "classificati" ? "default" : "outline"}
          onClick={() => setViewMode("classificati")}
          size="sm"
        >
          Classificati
        </Button>
        <Button
          variant={viewMode === "contabilizzati" ? "default" : "outline"}
          onClick={() => setViewMode("contabilizzati")}
          size="sm"
        >
          Contabilizzati
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">
              {viewMode === "da_classificare" && "Nessun evento da classificare"}
              {viewMode === "classificati" && "Nessun evento classificato"}
              {viewMode === "contabilizzati" && "Nessun evento contabilizzato"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card
              key={entry.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => handleOpenEntry(entry)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-full ${
                        entry.direction === "entrata"
                          ? "bg-green-100 text-green-600"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {entry.direction === "entrata" ? (
                        <ArrowUp className="h-5 w-5" />
                      ) : (
                        <ArrowDown className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">
                        € {entry.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getDocumentTypeLabel(entry.document_type)} •{" "}
                        {format(new Date(entry.document_date), "dd MMM yyyy", { locale: it })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(entry.status)}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Eliminare questa registrazione?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Questa azione non può essere annullata. La registrazione sarà eliminata permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => handleDelete(entry.id)}
                          >
                            Elimina
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedEntry} onOpenChange={() => setSelectedEntry(null)}>
        <DialogContent className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                Classifica Evento
                {selectedEntry && getStatusBadge(selectedEntry.status)}
              </DialogTitle>
              <Button
                onClick={handleAIClassify}
                disabled={isClassifying}
                variant="outline"
                className="gap-2 bg-gradient-to-r from-violet-500/10 to-purple-500/10 border-violet-300 hover:border-violet-400 hover:bg-violet-500/20"
              >
                {isClassifying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-violet-600" />
                )}
                {isClassifying ? "Analizzo..." : "Classifica con AI"}
              </Button>
            </div>
          </DialogHeader>

          {selectedEntry && (
            <ScrollArea className="max-h-[calc(95vh-8rem)]">
              <div className="px-6 pb-6 space-y-6">
                
                {/* AI Reasoning Banner */}
                {aiReasoning && (
                  <div className="p-3 bg-violet-50 border border-violet-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Sparkles className="h-4 w-4 text-violet-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-violet-800">Suggerimento AI</p>
                        <p className="text-sm text-violet-700">{aiReasoning}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Detected Subject Banner */}
                {detectedSubject && (
                  <div className={`p-3 rounded-lg border ${
                    detectedSubject.found 
                      ? "bg-green-50 border-green-200" 
                      : "bg-amber-50 border-amber-200"
                  }`}>
                    <div className="flex items-start gap-2">
                      {detectedSubject.found ? (
                        <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      ) : (
                        <UserPlus className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${detectedSubject.found ? "text-green-800" : "text-amber-800"}`}>
                          {detectedSubject.type === "cliente" ? "Cliente" : "Fornitore"} {detectedSubject.found ? "trovato" : "non trovato"}: {detectedSubject.name}
                        </p>
                        <p className={`text-xs ${detectedSubject.found ? "text-green-700" : "text-amber-700"}`}>
                          {detectedSubject.tax_id && `P.IVA: ${detectedSubject.tax_id}`}
                          {detectedSubject.city && ` • ${detectedSubject.city}`}
                        </p>
                      </div>
                      {!detectedSubject.found && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0 text-amber-700 border-amber-300 hover:bg-amber-100"
                          onClick={() => setShowSubjectDialog(true)}
                        >
                          <UserPlus className="h-3 w-3 mr-1" />
                          Crea
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                
                {/* SECTION 1: Read-only inherited data */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Dati Originali (dal registro)
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Direction */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Direzione</Label>
                      <div className={`flex items-center gap-2 p-2 rounded-md ${
                        selectedEntry.direction === "entrata" 
                          ? "bg-green-50 text-green-700" 
                          : "bg-red-50 text-red-700"
                      }`}>
                        {selectedEntry.direction === "entrata" ? (
                          <ArrowUp className="h-4 w-4" />
                        ) : (
                          <ArrowDown className="h-4 w-4" />
                        )}
                        <span className="font-medium capitalize">{selectedEntry.direction}</span>
                      </div>
                    </div>

                    {/* Document Type */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tipo Documento</Label>
                      <div className="p-2 bg-muted rounded-md font-medium">
                        {getDocumentTypeLabel(selectedEntry.document_type)}
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Importo</Label>
                      <div className="p-2 bg-muted rounded-md font-medium">
                        € {selectedEntry.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </div>
                    </div>

                    {/* Document Date */}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Data Documento</Label>
                      <div className="p-2 bg-muted rounded-md">
                        {format(new Date(selectedEntry.document_date), "dd/MM/yyyy", { locale: it })}
                      </div>
                    </div>

                    {/* Payment Method */}
                    {selectedEntry.payment_method && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Metodo Pagamento</Label>
                        <div className="p-2 bg-muted rounded-md">
                          {getPaymentMethodLabel(selectedEntry.payment_method)}
                        </div>
                      </div>
                    )}

                    {/* Subject */}
                    {selectedEntry.subject_type && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Soggetto</Label>
                        <div className="p-2 bg-muted rounded-md capitalize">
                          {selectedEntry.subject_type}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Employee Notes */}
                  {selectedEntry.note && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Note del dipendente</Label>
                      <div className="p-3 bg-muted rounded-md text-sm">
                        {selectedEntry.note}
                      </div>
                    </div>
                  )}

                  {/* Attachment Preview */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Allegato</Label>
                    <div className="flex items-start gap-4">
                      {isImage(selectedEntry.attachment_url) ? (
                        <a
                          href={selectedEntry.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img 
                            src={selectedEntry.attachment_url} 
                            alt="Documento"
                            className="max-w-[200px] max-h-[150px] rounded-md border object-cover hover:opacity-80 transition-opacity"
                          />
                        </a>
                      ) : (
                        <a
                          href={selectedEntry.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 border rounded-md hover:bg-accent transition-colors"
                        >
                          <FileText className="h-5 w-5" />
                          <span>Visualizza documento</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                <Separator />

                {/* SECTION 2: Classification Fields */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Classificazione
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Event Type */}
                    <div className="space-y-2">
                      <Label>Tipo di Evento *</Label>
                      <Select
                        value={classificationForm.event_type}
                        onValueChange={handleEventTypeChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo evento" />
                        </SelectTrigger>
                        <SelectContent>
                          {eventTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Affects Income Statement */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Incide sul Conto Economico?</Label>
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="start" className="max-w-lg p-4 text-sm z-[100]">
                              <div className="space-y-3">
                                <div>
                                  <p className="font-semibold text-green-600">✅ SÌ</p>
                                  <p className="text-muted-foreground">Quando stai registrando un <strong>COSTO</strong> o un <strong>RICAVO</strong>, cioè qualcosa che fa guadagnare o perdere soldi all'azienda.</p>
                                  <p className="text-xs text-muted-foreground mt-1">Es: parcheggio, carburante, marketing, stipendi, consulenze, vendita servizi, ammortamenti</p>
                                </div>
                                <div>
                                  <p className="font-semibold text-red-600">❌ NO</p>
                                  <p className="text-muted-foreground">Quando stai solo registrando un <strong>PAGAMENTO</strong> o un <strong>INCASSO</strong>, cioè soldi che entrano o escono, ma il costo/ricavo esiste già.</p>
                                  <p className="text-xs text-muted-foreground mt-1">Es: pagamento fattura, incasso cliente, rimborso dipendente, giroconto</p>
                                </div>
                                <div className="pt-2 border-t">
                                  <p className="text-xs font-medium">💡 Regola lampo:</p>
                                  <p className="text-xs text-muted-foreground">"Quanto ho guadagnato o speso" → SÌ</p>
                                  <p className="text-xs text-muted-foreground">"Come ho pagato o incassato" → NO</p>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <div className={`flex items-center gap-3 p-2 border rounded-md ${isAffectsIncomeStatementLocked() ? "bg-muted/50" : ""}`}>
                        <Switch
                          checked={classificationForm.affects_income_statement}
                          onCheckedChange={(checked) =>
                            setClassificationForm(prev => ({ 
                              ...prev, 
                              affects_income_statement: checked,
                              chart_account_id: checked ? prev.chart_account_id : ""
                            }))
                          }
                          disabled={isAffectsIncomeStatementLocked()}
                        />
                        <span className="text-sm">
                          {classificationForm.affects_income_statement ? "Sì" : "No"}
                        </span>
                        {isAffectsIncomeStatementLocked() && (
                          <span className="text-xs text-muted-foreground ml-2">
                            (automatico per {classificationForm.event_type === "ricavo" ? "Ricavo" : "Costo"})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Piano dei Conti - Two step selection when affects_income_statement is true */}
                    {classificationForm.affects_income_statement && (
                      <>
                        {/* Step 1: Categoria Contabile */}
                        <div className="space-y-2">
                          <Label>Categoria Contabile *</Label>
                          <Select
                            value={accountCategory}
                            onValueChange={handleCategoryChange}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Seleziona categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableCategories().map((cat) => (
                                <SelectItem key={cat.value} value={cat.value}>
                                  {cat.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Macro-categoria del costo/ricavo
                          </p>
                        </div>

                        {/* Step 2: Conto Specifico - only visible when category is selected */}
                        {accountCategory && (
                          <div className="space-y-2">
                            <Label>Conto Specifico *</Label>
                            <Select
                              value={classificationForm.chart_account_id}
                              onValueChange={(value) =>
                                setClassificationForm(prev => ({ ...prev, chart_account_id: value }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Seleziona conto" />
                              </SelectTrigger>
                              <SelectContent>
                                {getFilteredAccounts().map((account) => (
                                  <SelectItem key={account.id} value={account.id}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Classifica CHE COSA è il costo/ricavo
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Temporal Competence */}
                    <div className="space-y-2">
                      <Label>Competenza Temporale</Label>
                      <Select
                        value={classificationForm.temporal_competence}
                        onValueChange={(value) =>
                          setClassificationForm(prev => ({ ...prev, temporal_competence: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {temporalCompetences.map((tc) => (
                            <SelectItem key={tc.value} value={tc.value}>
                              {tc.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Competenza dates - for differita and rateizzata */}
                  {(classificationForm.temporal_competence === "rateizzata" || classificationForm.temporal_competence === "differita") && (
                    <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                      <div className="space-y-2">
                        <Label>Periodo di competenza - Inizio *</Label>
                        <Input
                          type="date"
                          value={classificationForm.recurrence_start_date}
                          onChange={(e) =>
                            setClassificationForm(prev => ({ ...prev, recurrence_start_date: e.target.value }))
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Periodo di competenza - Fine *</Label>
                        <Input
                          type="date"
                          value={classificationForm.recurrence_end_date}
                          onChange={(e) =>
                            setClassificationForm(prev => ({ ...prev, recurrence_end_date: e.target.value }))
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Recurrence */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={classificationForm.is_recurring}
                        onCheckedChange={(checked) =>
                          setClassificationForm(prev => ({ ...prev, is_recurring: checked }))
                        }
                      />
                      <div className="flex items-center gap-2">
                        <Label>Ricorrente</Label>
                        <TooltipProvider>
                          <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors" />
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs p-3 text-sm">
                              <p className="font-medium mb-1">💡 Quando attivare?</p>
                              <p className="text-muted-foreground">
                                Attiva solo se questo evento <strong>si ripeterà nel tempo</strong> (es: canone mensile, abbonamento, affitto).
                              </p>
                              <p className="text-xs text-muted-foreground mt-2">
                                ⚠️ Ricorrente ≠ Rateizzato. Ricorrente = "si ripeterà", Rateizzato = "è già stato diviso in rate".
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                    {classificationForm.is_recurring && (
                      <Input
                        className="max-w-[200px]"
                        placeholder="Es: mensile, trimestrale..."
                        value={classificationForm.recurrence_period}
                        onChange={(e) =>
                          setClassificationForm(prev => ({ ...prev, recurrence_period: e.target.value }))
                        }
                      />
                    )}
                  </div>
                </div>

                <Separator />

                {/* SECTION 3: Economic Destination */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                      Destinazione Economica (ORIGINE)
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Indica DOVE e PERCHÉ nasce questo costo/ricavo
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Cost Center - only for outgoing (uscita) */}
                    {selectedEntry.direction === "uscita" && (
                      <div className="space-y-2">
                        <Label>Centro di Costo</Label>
                        <Select
                          value={classificationForm.cost_center_id}
                          onValueChange={(value) =>
                            setClassificationForm(prev => ({ ...prev, cost_center_id: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona centro di costo" />
                          </SelectTrigger>
                          <SelectContent>
                            {costCenters.map((cc) => (
                              <SelectItem key={cc.id} value={cc.id}>
                                {cc.code} - {cc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Es: Reparto, Progetto, Cliente che genera il costo
                        </p>
                      </div>
                    )}

                    {/* Profit Center - only for incoming (entrata) */}
                    {selectedEntry.direction === "entrata" && (
                      <div className="space-y-2">
                        <Label>Centro di Ricavo</Label>
                        <Select
                          value={classificationForm.profit_center_id}
                          onValueChange={(value) =>
                            setClassificationForm(prev => ({ ...prev, profit_center_id: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona centro di ricavo" />
                          </SelectTrigger>
                          <SelectContent>
                            {profitCenters.map((pc) => (
                              <SelectItem key={pc.id} value={pc.id}>
                                {pc.code} - {pc.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Es: Prodotto, Cliente, Linea di business che genera il ricavo
                        </p>
                      </div>
                    )}

                    {/* Center Percentage - hidden by default, show only if user needs to change from 100% */}
                    {classificationForm.center_percentage !== 100 && (
                      <div className="space-y-2">
                        <Label>Percentuale Allocazione (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={classificationForm.center_percentage}
                          onChange={(e) =>
                            setClassificationForm(prev => ({ ...prev, center_percentage: Number(e.target.value) }))
                          }
                        />
                      </div>
                    )}

                    {/* Economic Subject Type */}
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Soggetto Economico (opzionale)</Label>
                      <Select
                        value={classificationForm.economic_subject_type}
                        onValueChange={(value) =>
                          setClassificationForm(prev => ({ ...prev, economic_subject_type: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo soggetto" />
                        </SelectTrigger>
                        <SelectContent>
                          {economicSubjectTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* SECTION 4: Financial Status */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Stato Finanziario
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Financial Status */}
                    <div className="space-y-2">
                      <Label>Stato</Label>
                      <Select
                        value={classificationForm.financial_status || getDefaultFinancialStatus(selectedEntry.direction)}
                        onValueChange={(value) =>
                          setClassificationForm(prev => ({ ...prev, financial_status: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {financialStatuses.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Payment Date - highlighted when required */}
                    {requiresPaymentDate() && (
                      <div className="space-y-2">
                        <Label className={requiresPaymentDate() && !classificationForm.payment_date ? "text-orange-600 font-medium" : ""}>
                          Data Pagamento/Incasso {requiresPaymentDate() ? "*" : ""}
                        </Label>
                        <Input
                          type="date"
                          value={classificationForm.payment_date}
                          onChange={(e) =>
                            setClassificationForm(prev => ({ ...prev, payment_date: e.target.value }))
                          }
                          className={requiresPaymentDate() && !classificationForm.payment_date ? "border-orange-400" : ""}
                        />
                        {requiresPaymentDate() && !classificationForm.payment_date && (
                          <p className="text-xs text-orange-600">Consigliato inserire la data per lo stato selezionato</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* SECTION 5: CFO Notes */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Note CFO
                  </h3>
                  <Textarea
                    value={classificationForm.cfo_notes}
                    onChange={(e) =>
                      setClassificationForm(prev => ({ ...prev, cfo_notes: e.target.value }))
                    }
                    placeholder="Motivazioni, eccezioni, policy applicata..."
                    rows={3}
                  />
                </div>

                <Separator />

                {/* ACTIONS */}
                {/* Action buttons based on status */}
                {viewMode === "contabilizzati" ? (
                  /* For contabilizzati: only storno */
                  <div className="flex flex-wrap gap-3 pt-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Storna Registrazione
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Stornare questa registrazione?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Verrà creata una registrazione di storno con importo e direzione opposta.
                            La registrazione originale rimarrà inalterata.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annulla</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => selectedEntry && stornoMutation.mutate(selectedEntry)}
                            className="bg-red-600 text-white hover:bg-red-700"
                          >
                            Conferma Storno
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ) : viewMode === "classificati" ? (
                  /* For classificati: allow reclassification */
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salva Modifiche
                    </Button>
                    
                    <Button
                      onClick={() => {
                        if (selectedEntry) {
                          saveMutation.mutate({ id: selectedEntry.id, status: "da_classificare" });
                        }
                      }}
                      disabled={saveMutation.isPending}
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      Rimetti in Classificazione
                    </Button>
                    
                    <Button
                      onClick={handleSendToPrimaNota}
                      disabled={saveMutation.isPending}
                      className="ml-auto bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Invia a Prima Nota
                    </Button>
                  </div>
                ) : (
                  /* For da_classificare: full actions */
                  <div className="flex flex-wrap gap-3 pt-2">
                    <Button
                      onClick={handleSave}
                      disabled={saveMutation.isPending}
                      variant="outline"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Salva Bozza
                    </Button>
                    
                    <Button
                      onClick={handleRequestIntegration}
                      disabled={saveMutation.isPending}
                      variant="outline"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Richiedi Integrazione
                    </Button>
                    
                    <Button
                      onClick={handleSuspend}
                      disabled={saveMutation.isPending}
                      variant="outline"
                      className="text-amber-600 border-amber-300 hover:bg-amber-50"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Sospendi
                    </Button>
                    
                    <Button
                      onClick={handleSendToPrimaNota}
                      disabled={saveMutation.isPending}
                      className="ml-auto bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Invia a Prima Nota
                    </Button>
                  </div>
                )}

              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Subject Creation Dialog */}
      <Dialog open={showSubjectDialog} onOpenChange={setShowSubjectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detectedSubject?.type === "cliente" ? (
                <Building2 className="h-5 w-5 text-blue-600" />
              ) : (
                <UserPlus className="h-5 w-5 text-orange-600" />
              )}
              Nuovo Soggetto Rilevato
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              L'AI ha estratto i seguenti dati dal documento. Verifica il tipo di soggetto e crea in anagrafica se necessario.
            </p>
            
            {/* Toggle Cliente / Fornitore */}
            <div className="flex items-center justify-center gap-4 p-3 bg-muted/50 rounded-lg">
              <Button
                type="button"
                variant={detectedSubject?.type === "cliente" ? "default" : "outline"}
                size="sm"
                className={detectedSubject?.type === "cliente" ? "bg-blue-600 hover:bg-blue-700" : ""}
                onClick={() => {
                  if (detectedSubject) {
                    const customerMatch = (detectedSubject as any).customerMatch;
                    setDetectedSubject({
                      ...detectedSubject,
                      type: "cliente",
                      existing_id: customerMatch?.id,
                      found: !!customerMatch,
                    });
                    if (customerMatch) {
                      setClassificationForm(prev => ({
                        ...prev,
                        economic_subject_type: "cliente",
                        economic_subject_id: customerMatch.id,
                      }));
                    }
                  }
                }}
              >
                <Building2 className="h-4 w-4 mr-1" />
                Cliente
              </Button>
              <Button
                type="button"
                variant={detectedSubject?.type === "fornitore" ? "default" : "outline"}
                size="sm"
                className={detectedSubject?.type === "fornitore" ? "bg-orange-600 hover:bg-orange-700" : ""}
                onClick={() => {
                  if (detectedSubject) {
                    const supplierMatch = (detectedSubject as any).supplierMatch;
                    setDetectedSubject({
                      ...detectedSubject,
                      type: "fornitore",
                      existing_id: supplierMatch?.id,
                      found: !!supplierMatch,
                    });
                    if (supplierMatch) {
                      setClassificationForm(prev => ({
                        ...prev,
                        economic_subject_type: "fornitore",
                        economic_subject_id: supplierMatch.id,
                      }));
                    }
                  }
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Fornitore
              </Button>
            </div>
            
            {/* Found status */}
            {detectedSubject?.found ? (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Trovato in anagrafica {detectedSubject.type === "cliente" ? "clienti" : "fornitori"}!
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Non trovato in anagrafica {detectedSubject?.type === "cliente" ? "clienti" : "fornitori"}
                  </span>
                </div>
              </div>
            )}
            
            <div className="bg-muted/50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Nome:</span>
                <span className="font-medium">{detectedSubject?.name}</span>
              </div>
              {detectedSubject?.tax_id && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">P.IVA:</span>
                  <span className="font-medium">{detectedSubject.tax_id}</span>
                </div>
              )}
              {detectedSubject?.city && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Città:</span>
                  <span className="font-medium">{detectedSubject.city}</span>
                </div>
              )}
              {detectedSubject?.address && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Indirizzo:</span>
                  <span className="font-medium text-right text-xs">{detectedSubject.address}</span>
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSubjectDialog(false)}
            >
              {detectedSubject?.found ? "Chiudi" : "Salta"}
            </Button>
            {!detectedSubject?.found && (
              <Button
                onClick={checkForSimilarSubjects}
                disabled={isCreatingSubject}
                className={detectedSubject?.type === "cliente" ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}
              >
                {isCreatingSubject ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Crea {detectedSubject?.type === "cliente" ? "Cliente" : "Fornitore"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Similar Subject Dialog */}
      <SimilarSubjectDialog
        open={showSimilarDialog}
        onOpenChange={setShowSimilarDialog}
        newName={pendingSubjectName || detectedSubject?.name || ""}
        matches={similarMatches}
        subjectType={detectedSubject?.type || "fornitore"}
        onAction={handleSimilarSubjectAction}
        isLoading={isCreatingSubject}
      />
    </div>
  );
}
