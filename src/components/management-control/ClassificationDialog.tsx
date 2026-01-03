import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ArrowUp, ArrowDown, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ClassificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movimentoData: {
    id: string;
    data_movimento: string;
    importo: number;
    direzione: "entrata" | "uscita";
    metodo_pagamento: string;
    soggetto_nome?: string | null;
    soggetto_tipo?: string | null;
    riferimento?: string | null;
    allegato_url?: string | null;
  } | null;
  onClassify: (data: ClassificationFormData) => void;
  isPending?: boolean;
}

export interface ClassificationFormData {
  event_type: string;
  affects_income_statement: boolean;
  chart_account_id: string;
  temporal_competence: string;
  is_recurring: boolean;
  recurrence_period: string;
  cost_center_id: string;
  profit_center_id: string;
  center_percentage: number;
  economic_subject_type: string;
  financial_status: string;
  payment_date: string;
  cfo_notes: string;
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

const accountCategories = [
  { value: "revenue", label: "Ricavi", accountType: "revenue" },
  { value: "cogs", label: "Costo del Venduto (COGS)", accountType: "cogs" },
  { value: "opex", label: "Spese Operative (Opex)", accountType: "opex" },
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

const recurrencePeriods = [
  { value: "mensile", label: "Mensile" },
  { value: "trimestrale", label: "Trimestrale" },
  { value: "semestrale", label: "Semestrale" },
  { value: "annuale", label: "Annuale" },
];

export default function ClassificationDialog({
  open,
  onOpenChange,
  movimentoData,
  onClassify,
  isPending = false,
}: ClassificationDialogProps) {
  const [accountCategory, setAccountCategory] = useState("");
  const [isAIClassifying, setIsAIClassifying] = useState(false);
  const [form, setForm] = useState<ClassificationFormData>({
    event_type: "",
    affects_income_statement: false,
    chart_account_id: "",
    temporal_competence: "immediata",
    is_recurring: false,
    recurrence_period: "",
    cost_center_id: "",
    profit_center_id: "",
    center_percentage: 100,
    economic_subject_type: "",
    financial_status: "",
    payment_date: "",
    cfo_notes: "",
  });

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && movimentoData) {
      // Auto-set based on direzione
      const isEntrata = movimentoData.direzione === "entrata";
      setForm({
        event_type: isEntrata ? "ricavo" : "costo",
        affects_income_statement: true,
        chart_account_id: "",
        temporal_competence: "immediata",
        is_recurring: false,
        recurrence_period: "",
        cost_center_id: "",
        profit_center_id: "",
        center_percentage: 100,
        economic_subject_type: isEntrata ? "cliente" : "fornitore",
        financial_status: isEntrata ? "incassato" : "pagato",
        payment_date: movimentoData.data_movimento,
        cfo_notes: "",
      });
      setAccountCategory(isEntrata ? "revenue" : "opex");
    }
  }, [open, movimentoData]);

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

  // Filter accounts by category
  const filteredAccounts = accounts.filter((a) => {
    if (!accountCategory) return true;
    return a.account_type === accountCategory && (a.level === null || a.level === undefined || a.level >= 2);
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(value);
  };

  const handleAIClassify = async () => {
    if (!movimentoData) return;
    
    setIsAIClassifying(true);
    try {
      const entryForAI = {
        direction: movimentoData.direzione,
        amount: movimentoData.importo,
        document_date: movimentoData.data_movimento,
        payment_method: movimentoData.metodo_pagamento,
        subject_type: movimentoData.soggetto_tipo,
        note: movimentoData.soggetto_nome || "",
        attachment_url: movimentoData.allegato_url || "",
      };

      const { data, error } = await supabase.functions.invoke("classify-accounting-entry", {
        body: {
          entry: entryForAI,
          chartOfAccounts: accounts.filter((a) => a.level === null || a.level === undefined || a.level >= 2),
          costCenters,
          profitCenters,
        },
      });

      if (error) throw error;

      if (data?.success && data?.classification) {
        const c = data.classification;
        
        if (c.account_category) {
          setAccountCategory(c.account_category);
        }

        setForm((prev) => ({
          ...prev,
          event_type: c.event_type || prev.event_type,
          affects_income_statement: c.affects_income_statement ?? prev.affects_income_statement,
          chart_account_id: c.chart_account_id || prev.chart_account_id,
          temporal_competence: c.temporal_competence || prev.temporal_competence,
          cost_center_id: c.cost_center_id || prev.cost_center_id,
          profit_center_id: c.profit_center_id || prev.profit_center_id,
          financial_status: c.financial_status || prev.financial_status,
          economic_subject_type: c.subject_type || prev.economic_subject_type,
        }));

        toast.success("Classificazione AI completata! Verifica e conferma.");
      } else {
        toast.error(data?.error || "Errore nella classificazione AI");
      }
    } catch (err) {
      console.error("AI classification error:", err);
      toast.error("Errore durante la classificazione AI");
    } finally {
      setIsAIClassifying(false);
    }
  };

  const handleSubmit = () => {
    if (!form.event_type) {
      toast.error("Seleziona il tipo di evento");
      return;
    }
    onClassify(form);
  };

  if (!movimentoData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Classifica Movimento</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAIClassify}
              disabled={isAIClassifying}
            >
              {isAIClassifying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Classifica con AI
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)]">
          <div className="space-y-6 pr-4">
            {/* Movement Summary */}
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Data:</span>
                <span className="font-medium">
                  {format(new Date(movimentoData.data_movimento), "dd/MM/yyyy", { locale: it })}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Importo:</span>
                <span className={`font-medium flex items-center gap-2 ${movimentoData.direzione === "entrata" ? "text-green-600" : "text-red-600"}`}>
                  {movimentoData.direzione === "entrata" ? (
                    <ArrowUp className="h-4 w-4" />
                  ) : (
                    <ArrowDown className="h-4 w-4" />
                  )}
                  {movimentoData.direzione === "entrata" ? "+" : "-"}
                  {formatCurrency(Number(movimentoData.importo))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Metodo:</span>
                <span className="font-medium capitalize">{movimentoData.metodo_pagamento}</span>
              </div>
              {movimentoData.soggetto_nome && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Soggetto:</span>
                  <span className="font-medium">{movimentoData.soggetto_nome}</span>
                </div>
              )}
            </div>

            <Separator />

            {/* Event Type */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo Evento *</Label>
                <Select
                  value={form.event_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, event_type: value }))}
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

              <div className="space-y-2">
                <Label>Stato Finanziario</Label>
                <Select
                  value={form.financial_status}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, financial_status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
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
            </div>

            {/* Affects Income Statement */}
            <div className="flex items-center justify-between">
              <Label htmlFor="affects_ce">Incide sul Conto Economico</Label>
              <Switch
                id="affects_ce"
                checked={form.affects_income_statement}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, affects_income_statement: checked }))
                }
              />
            </div>

            <Separator />

            {/* Account Category and Chart Account */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Categoria Conto</Label>
                <Select value={accountCategory} onValueChange={setAccountCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {accountCategories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Piano dei Conti</Label>
                <Select
                  value={form.chart_account_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, chart_account_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona conto" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Cost/Profit Center */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Centro di Costo</Label>
                <Select
                  value={form.cost_center_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, cost_center_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona centro di costo" />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Centro di Ricavo</Label>
                <Select
                  value={form.profit_center_id}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, profit_center_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona centro di ricavo" />
                  </SelectTrigger>
                  <SelectContent>
                    {profitCenters.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.code} - {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Subject Type and Temporal Competence */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo Soggetto</Label>
                <Select
                  value={form.economic_subject_type}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, economic_subject_type: value }))}
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

              <div className="space-y-2">
                <Label>Competenza Temporale</Label>
                <Select
                  value={form.temporal_competence}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, temporal_competence: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona competenza" />
                  </SelectTrigger>
                  <SelectContent>
                    {temporalCompetences.map((comp) => (
                      <SelectItem key={comp.value} value={comp.value}>
                        {comp.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Recurring */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="is_recurring">Costo Ricorrente</Label>
                <Switch
                  id="is_recurring"
                  checked={form.is_recurring}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_recurring: checked }))
                  }
                />
              </div>

              {form.is_recurring && (
                <div className="space-y-2">
                  <Label>Periodicità</Label>
                  <Select
                    value={form.recurrence_period}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, recurrence_period: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona periodicità" />
                    </SelectTrigger>
                    <SelectContent>
                      {recurrencePeriods.map((period) => (
                        <SelectItem key={period.value} value={period.value}>
                          {period.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <Separator />

            {/* CFO Notes */}
            <div className="space-y-2">
              <Label>Note CFO</Label>
              <Textarea
                value={form.cfo_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, cfo_notes: e.target.value }))}
                placeholder="Note aggiuntive per il CFO..."
                rows={3}
              />
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={isPending || isAIClassifying}>
            {isPending ? "Salvataggio..." : "Salva Classificazione"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
