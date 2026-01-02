import { useState } from "react";
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
  Save, MessageSquare, Pause, Send, AlertCircle, Image, Trash2, HelpCircle
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  account_code?: string | null;
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
}

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
  
  // Classification form state
  const [classificationForm, setClassificationForm] = useState({
    event_type: "",
    affects_income_statement: false,
    account_code: "",
    temporal_competence: "immediata",
    is_recurring: false,
    recurrence_period: "",
    recurrence_start_date: "",
    recurrence_end_date: "",
    cost_center_id: "",
    profit_center_id: "",
    center_percentage: 100,
    economic_subject_type: "",
    financial_status: "",
    payment_date: "",
    cfo_notes: "",
  });

  // Fetch entries to classify
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["accounting-entries-to-classify"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select("*")
        .in("status", ["da_classificare", "in_classificazione", "sospeso"])
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
        .select("id, code, name, account_type")
        .eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data as ChartAccount[];
    },
  });

  // Save classification mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { id: string; status: string }) => {
      const updateData: Record<string, unknown> = {
        status: data.status,
        event_type: classificationForm.event_type || null,
        affects_income_statement: classificationForm.affects_income_statement,
        account_code: classificationForm.account_code || null,
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
    setClassificationForm({
      event_type: entry.event_type || "",
      affects_income_statement: entry.affects_income_statement ?? false,
      account_code: entry.account_code || "",
      temporal_competence: entry.temporal_competence || "immediata",
      is_recurring: entry.is_recurring ?? false,
      recurrence_period: entry.recurrence_period || "",
      recurrence_start_date: entry.recurrence_start_date || "",
      recurrence_end_date: entry.recurrence_end_date || "",
      cost_center_id: entry.cost_center_id || "",
      profit_center_id: entry.profit_center_id || "",
      center_percentage: entry.center_percentage ?? 100,
      economic_subject_type: entry.economic_subject_type || "",
      financial_status: entry.financial_status || "",
      payment_date: entry.payment_date || "",
      cfo_notes: entry.cfo_notes || "",
    });
  };

  const validateForPrimaNota = (): string[] => {
    const errors: string[] = [];
    
    if (!classificationForm.event_type) {
      errors.push("Tipo di evento obbligatorio");
    }
    
    if (classificationForm.affects_income_statement && !classificationForm.account_code) {
      errors.push("Conto economico obbligatorio se incide sul C/E");
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
    setClassificationForm(prev => ({
      ...prev,
      event_type: value,
      affects_income_statement: affectsIncome,
      // Clear account code if affects_income is false
      account_code: affectsIncome ? prev.account_code : "",
    }));
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

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Classificazione Eventi</h1>
        <p className="text-muted-foreground">
          {entries.length} eventi da classificare
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
            <p className="text-lg font-medium">Nessun evento da classificare</p>
            <p className="text-muted-foreground">Tutti gli eventi sono stati classificati</p>
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
            <DialogTitle className="flex items-center gap-2">
              Classifica Evento
              {selectedEntry && getStatusBadge(selectedEntry.status)}
            </DialogTitle>
          </DialogHeader>

          {selectedEntry && (
            <ScrollArea className="max-h-[calc(95vh-8rem)]">
              <div className="px-6 pb-6 space-y-6">
                
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
                            <TooltipContent side="right" className="max-w-sm p-4 text-sm">
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
                              account_code: checked ? prev.account_code : ""
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

                    {/* Account Code - only visible when affects_income_statement is true */}
                    {classificationForm.affects_income_statement && (
                      <div className="space-y-2">
                        <Label>Conto Economico *</Label>
                        <Select
                          value={classificationForm.account_code}
                          onValueChange={(value) =>
                            setClassificationForm(prev => ({ ...prev, account_code: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona conto" />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.code}>
                                {account.code} - {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
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
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Destinazione Economica
                  </h3>

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

              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
