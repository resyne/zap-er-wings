import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, addMonths, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { 
  ArrowUp, ArrowDown, FileText, CheckCircle, Lock, RefreshCw,
  Calendar, TrendingUp, TrendingDown, AlertCircle, Eye, Undo2,
  Filter, Download
} from "lucide-react";

interface PrimaNotaMovement {
  id: string;
  accounting_entry_id: string;
  movement_type: string;
  competence_date: string;
  amount: number;
  chart_account_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  center_percentage: number | null;
  description: string | null;
  installment_number: number | null;
  total_installments: number | null;
  status: string;
  rectified_by: string | null;
  rectification_reason: string | null;
  is_rectification: boolean;
  original_movement_id: string | null;
  created_at: string;
  accounting_period: string | null;
  // Joined data
  chart_account?: { code: string; name: string } | null;
  cost_center?: { code: string; name: string } | null;
  profit_center?: { code: string; name: string } | null;
  accounting_entry?: {
    direction: string;
    document_type: string;
    document_date: string;
    attachment_url: string;
  } | null;
}

interface PendingEntry {
  id: string;
  direction: string;
  document_type: string;
  amount: number;
  document_date: string;
  event_type: string | null;
  temporal_competence: string | null;
  recurrence_start_date: string | null;
  recurrence_end_date: string | null;
  chart_account_id: string | null;
  cost_center_id: string | null;
  profit_center_id: string | null;
  center_percentage: number | null;
  financial_status: string | null;
  affects_income_statement: boolean | null;
  chart_account?: { code: string; name: string } | null;
  cost_center?: { code: string; name: string } | null;
  profit_center?: { code: string; name: string } | null;
}

export default function PrimaNotaPage() {
  const queryClient = useQueryClient();
  const [selectedMovement, setSelectedMovement] = useState<PrimaNotaMovement | null>(null);
  const [rectifyDialogOpen, setRectifyDialogOpen] = useState(false);
  const [rectificationReason, setRectificationReason] = useState("");
  const [filterPeriod, setFilterPeriod] = useState<string>(format(new Date(), "yyyy-MM"));
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch prima nota movements
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["prima-nota", filterPeriod, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("prima_nota")
        .select(`
          *,
          chart_account:chart_of_accounts(code, name),
          cost_center:cost_centers(code, name),
          profit_center:profit_centers(code, name),
          accounting_entry:accounting_entries(direction, document_type, document_date, attachment_url)
        `)
        .order("competence_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filterPeriod) {
        query = query.eq("accounting_period", filterPeriod);
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as PrimaNotaMovement[];
    },
  });

  // Fetch pending entries (pronto_prima_nota)
  const { data: pendingEntries = [] } = useQuery({
    queryKey: ["pending-prima-nota-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select(`
          id, direction, document_type, amount, document_date,
          event_type, temporal_competence, recurrence_start_date, recurrence_end_date,
          chart_account_id, cost_center_id, profit_center_id, center_percentage,
          financial_status, affects_income_statement,
          chart_account:chart_of_accounts(code, name),
          cost_center:cost_centers(code, name),
          profit_center:profit_centers(code, name)
        `)
        .eq("status", "pronto_prima_nota")
        .order("document_date", { ascending: false });

      if (error) throw error;
      return data as PendingEntry[];
    },
  });

  // Generate prima nota from entry
  const generateMutation = useMutation({
    mutationFn: async (entry: PendingEntry) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const movementsToCreate: Omit<PrimaNotaMovement, "id" | "created_at" | "chart_account" | "cost_center" | "profit_center" | "accounting_entry">[] = [];

      // Base amount (negative for costs, positive for revenues)
      const baseAmount = entry.direction === "uscita" ? -Math.abs(entry.amount) : Math.abs(entry.amount);

      // CASE A: Immediate competence - 1 movement
      if (entry.temporal_competence === "immediata" || !entry.temporal_competence) {
        // Economic movement (if affects income statement)
        if (entry.affects_income_statement) {
          movementsToCreate.push({
            accounting_entry_id: entry.id,
            movement_type: "economico",
            competence_date: entry.document_date,
            amount: baseAmount,
            chart_account_id: entry.chart_account_id,
            cost_center_id: entry.cost_center_id,
            profit_center_id: entry.profit_center_id,
            center_percentage: entry.center_percentage || 100,
            description: `${entry.event_type === "ricavo" ? "Ricavo" : "Costo"} - Competenza immediata`,
            installment_number: null,
            total_installments: null,
            status: "generato",
            rectified_by: null,
            rectification_reason: null,
            is_rectification: false,
            original_movement_id: null,
            accounting_period: null,
          });
        }

        // Financial movement (if paid/collected)
        if (["pagato", "incassato"].includes(entry.financial_status || "")) {
          movementsToCreate.push({
            accounting_entry_id: entry.id,
            movement_type: "finanziario",
            competence_date: entry.document_date,
            amount: baseAmount,
            chart_account_id: null, // No chart account for financial movements
            cost_center_id: null,
            profit_center_id: null,
            center_percentage: null,
            description: `Movimento finanziario - ${entry.financial_status === "pagato" ? "Pagamento" : "Incasso"}`,
            installment_number: null,
            total_installments: null,
            status: "generato",
            rectified_by: null,
            rectification_reason: null,
            is_rectification: false,
            original_movement_id: null,
            accounting_period: null,
          });
        }
      }

      // CASE B: Installment competence - N movements
      if (entry.temporal_competence === "rateizzata" && entry.recurrence_start_date && entry.recurrence_end_date) {
        const startDate = new Date(entry.recurrence_start_date);
        const endDate = new Date(entry.recurrence_end_date);
        
        // Calculate number of months
        let months = 0;
        let currentDate = startOfMonth(startDate);
        while (currentDate <= endDate) {
          months++;
          currentDate = addMonths(currentDate, 1);
        }

        if (months > 0) {
          const installmentAmount = baseAmount / months;
          
          for (let i = 0; i < months; i++) {
            const competenceDate = addMonths(startOfMonth(startDate), i);
            
            movementsToCreate.push({
              accounting_entry_id: entry.id,
              movement_type: "economico",
              competence_date: format(competenceDate, "yyyy-MM-dd"),
              amount: installmentAmount,
              chart_account_id: entry.chart_account_id,
              cost_center_id: entry.cost_center_id,
              profit_center_id: entry.profit_center_id,
              center_percentage: entry.center_percentage || 100,
              description: `Competenza rateizzata ${i + 1}/${months}`,
              installment_number: i + 1,
              total_installments: months,
              status: "generato",
              rectified_by: null,
              rectification_reason: null,
              is_rectification: false,
              original_movement_id: null,
              accounting_period: null,
            });
          }
        }
      }

      // CASE C: Deferred competence - future movement
      if (entry.temporal_competence === "differita") {
        // Create single movement at document date (can be adjusted based on policy)
        if (entry.affects_income_statement) {
          movementsToCreate.push({
            accounting_entry_id: entry.id,
            movement_type: "economico",
            competence_date: entry.document_date,
            amount: baseAmount,
            chart_account_id: entry.chart_account_id,
            cost_center_id: entry.cost_center_id,
            profit_center_id: entry.profit_center_id,
            center_percentage: entry.center_percentage || 100,
            description: `${entry.event_type === "ricavo" ? "Ricavo" : "Costo"} - Competenza differita`,
            installment_number: null,
            total_installments: null,
            status: "generato",
            rectified_by: null,
            rectification_reason: null,
            is_rectification: false,
            original_movement_id: null,
            accounting_period: null,
          });
        }
      }

      // Financial-only event
      if (entry.event_type === "evento_finanziario") {
        movementsToCreate.push({
          accounting_entry_id: entry.id,
          movement_type: "finanziario",
          competence_date: entry.document_date,
          amount: baseAmount,
          chart_account_id: null,
          cost_center_id: null,
          profit_center_id: null,
          center_percentage: null,
          description: "Evento finanziario",
          installment_number: null,
          total_installments: null,
          status: "generato",
          rectified_by: null,
          rectification_reason: null,
          is_rectification: false,
          original_movement_id: null,
          accounting_period: null,
        });
      }

      // Insert all movements
      if (movementsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("prima_nota")
          .insert(movementsToCreate.map(m => ({ ...m, created_by: userId })));

        if (insertError) throw insertError;
      }

      // Update entry status to 'registrato'
      const { error: updateError } = await supabase
        .from("accounting_entries")
        .update({ status: "registrato" })
        .eq("id", entry.id);

      if (updateError) throw updateError;

      return movementsToCreate.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["pending-prima-nota-entries"] });
      toast.success(`Generati ${count} movimenti di Prima Nota`);
    },
    onError: () => {
      toast.error("Errore nella generazione della Prima Nota");
    },
  });

  // Register movement
  const registerMutation = useMutation({
    mutationFn: async (movementId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("prima_nota")
        .update({
          status: "registrato",
          registered_at: new Date().toISOString(),
          registered_by: userData.user?.id,
        })
        .eq("id", movementId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      toast.success("Movimento registrato");
      setSelectedMovement(null);
    },
    onError: () => {
      toast.error("Errore nella registrazione");
    },
  });

  // Rectify movement
  const rectifyMutation = useMutation({
    mutationFn: async ({ movementId, reason }: { movementId: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      // Get original movement
      const { data: original, error: fetchError } = await supabase
        .from("prima_nota")
        .select("*")
        .eq("id", movementId)
        .single();

      if (fetchError || !original) throw fetchError;

      // Create rectification movement (opposite amount)
      const { data: rectification, error: insertError } = await supabase
        .from("prima_nota")
        .insert({
          accounting_entry_id: original.accounting_entry_id,
          movement_type: original.movement_type,
          competence_date: original.competence_date,
          amount: -original.amount, // Opposite amount
          chart_account_id: original.chart_account_id,
          cost_center_id: original.cost_center_id,
          profit_center_id: original.profit_center_id,
          center_percentage: original.center_percentage,
          description: `RETTIFICA: ${reason}`,
          status: "generato",
          is_rectification: true,
          original_movement_id: movementId,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Mark original as rectified
      const { error: updateError } = await supabase
        .from("prima_nota")
        .update({
          status: "rettificato",
          rectified_by: rectification.id,
          rectification_reason: reason,
        })
        .eq("id", movementId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      toast.success("Movimento rettificato");
      setRectifyDialogOpen(false);
      setRectificationReason("");
      setSelectedMovement(null);
    },
    onError: () => {
      toast.error("Errore nella rettifica");
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
      generato: { variant: "secondary", label: "Generato", icon: <FileText className="h-3 w-3" /> },
      registrato: { variant: "default", label: "Registrato", icon: <CheckCircle className="h-3 w-3" /> },
      bloccato: { variant: "outline", label: "Bloccato", icon: <Lock className="h-3 w-3" /> },
      rettificato: { variant: "destructive", label: "Rettificato", icon: <Undo2 className="h-3 w-3" /> },
    };
    const config = variants[status] || { variant: "secondary", label: status, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  // Summary calculations
  const summary = movements.reduce(
    (acc, m) => {
      if (m.status === "rettificato") return acc; // Skip rectified
      if (m.movement_type === "economico") {
        if (m.amount > 0) acc.revenues += m.amount;
        else acc.costs += Math.abs(m.amount);
      } else {
        if (m.amount > 0) acc.inflows += m.amount;
        else acc.outflows += Math.abs(m.amount);
      }
      return acc;
    },
    { revenues: 0, costs: 0, inflows: 0, outflows: 0 }
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prima Nota</h1>
        <p className="text-muted-foreground">
          Movimenti contabili generati dagli eventi classificati
        </p>
      </div>

      <Tabs defaultValue="movements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="movements" className="gap-2">
            <FileText className="h-4 w-4" />
            Movimenti
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            Da Generare
            {pendingEntries.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {pendingEntries.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* MOVEMENTS TAB */}
        <TabsContent value="movements" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">Periodo:</Label>
                  <Input
                    type="month"
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="w-40"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Stato:</Label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutti</SelectItem>
                      <SelectItem value="generato">Generato</SelectItem>
                      <SelectItem value="registrato">Registrato</SelectItem>
                      <SelectItem value="bloccato">Bloccato</SelectItem>
                      <SelectItem value="rettificato">Rettificato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Ricavi</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.revenues.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  <span className="text-sm font-medium">Costi</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.costs.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-blue-600">
                  <ArrowUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Entrate</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.inflows.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-orange-600">
                  <ArrowDown className="h-5 w-5" />
                  <span className="text-sm font-medium">Uscite</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.outflows.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Movements List */}
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-lg font-medium">Nessun movimento per questo periodo</p>
                <p className="text-muted-foreground">Seleziona un altro periodo o genera nuovi movimenti</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-left p-3 text-sm font-medium">Data</th>
                        <th className="text-left p-3 text-sm font-medium">Tipo</th>
                        <th className="text-left p-3 text-sm font-medium">Conto</th>
                        <th className="text-left p-3 text-sm font-medium">Centro</th>
                        <th className="text-right p-3 text-sm font-medium">Importo</th>
                        <th className="text-center p-3 text-sm font-medium">Stato</th>
                        <th className="text-center p-3 text-sm font-medium">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <tr 
                          key={m.id} 
                          className={`border-t hover:bg-muted/30 transition-colors ${m.is_rectification ? "bg-yellow-50/50" : ""} ${m.status === "rettificato" ? "opacity-50" : ""}`}
                        >
                          <td className="p-3 text-sm">
                            {format(new Date(m.competence_date), "dd/MM/yyyy", { locale: it })}
                            {m.installment_number && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({m.installment_number}/{m.total_installments})
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <Badge variant={m.movement_type === "economico" ? "default" : "outline"}>
                              {m.movement_type === "economico" ? "Economico" : "Finanziario"}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm">
                            {m.chart_account ? (
                              <span>{m.chart_account.code} - {m.chart_account.name}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 text-sm">
                            {m.cost_center ? (
                              <span>{m.cost_center.code} - {m.cost_center.name}</span>
                            ) : m.profit_center ? (
                              <span>{m.profit_center.code} - {m.profit_center.name}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className={`p-3 text-sm text-right font-medium ${m.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {m.amount >= 0 ? "+" : ""}€ {m.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-3 text-center">
                            {getStatusBadge(m.status)}
                          </td>
                          <td className="p-3 text-center">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => setSelectedMovement(m)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {m.status === "generato" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-green-600"
                                  onClick={() => registerMutation.mutate(m.id)}
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                              )}
                              {m.status === "registrato" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-orange-600"
                                  onClick={() => {
                                    setSelectedMovement(m);
                                    setRectifyDialogOpen(true);
                                  }}
                                >
                                  <Undo2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* PENDING TAB */}
        <TabsContent value="pending" className="space-y-4">
          {pendingEntries.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-lg font-medium">Nessun evento in attesa</p>
                <p className="text-muted-foreground">Tutti gli eventi sono stati processati</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {pendingEntries.map((entry) => (
                <Card key={entry.id} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
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
                            {format(new Date(entry.document_date), "dd MMM yyyy", { locale: it })}
                            {entry.temporal_competence === "rateizzata" && entry.recurrence_start_date && entry.recurrence_end_date && (
                              <span className="ml-2">
                                • Rateizzato: {format(new Date(entry.recurrence_start_date), "MMM yyyy", { locale: it })} - {format(new Date(entry.recurrence_end_date), "MMM yyyy", { locale: it })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          {entry.chart_account && (
                            <div>{entry.chart_account.code} - {entry.chart_account.name}</div>
                          )}
                          {entry.cost_center && (
                            <div className="text-muted-foreground">{entry.cost_center.name}</div>
                          )}
                          {entry.profit_center && (
                            <div className="text-muted-foreground">{entry.profit_center.name}</div>
                          )}
                        </div>
                        <Button
                          onClick={() => generateMutation.mutate(entry)}
                          disabled={generateMutation.isPending}
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${generateMutation.isPending ? "animate-spin" : ""}`} />
                          Genera PN
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Movement Detail Dialog */}
      <Dialog open={!!selectedMovement && !rectifyDialogOpen} onOpenChange={(open) => !open && setSelectedMovement(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Dettaglio Movimento</DialogTitle>
          </DialogHeader>
          {selectedMovement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Data Competenza</Label>
                  <p className="font-medium">
                    {format(new Date(selectedMovement.competence_date), "dd MMMM yyyy", { locale: it })}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Tipo</Label>
                  <p className="font-medium capitalize">{selectedMovement.movement_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Importo</Label>
                  <p className={`font-medium ${selectedMovement.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    € {selectedMovement.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Stato</Label>
                  <div className="mt-1">{getStatusBadge(selectedMovement.status)}</div>
                </div>
              </div>

              <Separator />

              {selectedMovement.chart_account && (
                <div>
                  <Label className="text-xs text-muted-foreground">Piano dei Conti</Label>
                  <p className="font-medium">
                    {selectedMovement.chart_account.code} - {selectedMovement.chart_account.name}
                  </p>
                </div>
              )}

              {(selectedMovement.cost_center || selectedMovement.profit_center) && (
                <div>
                  <Label className="text-xs text-muted-foreground">Centro di {selectedMovement.cost_center ? "Costo" : "Ricavo"}</Label>
                  <p className="font-medium">
                    {selectedMovement.cost_center 
                      ? `${selectedMovement.cost_center.code} - ${selectedMovement.cost_center.name}`
                      : `${selectedMovement.profit_center?.code} - ${selectedMovement.profit_center?.name}`
                    }
                    {selectedMovement.center_percentage && selectedMovement.center_percentage < 100 && (
                      <span className="text-muted-foreground ml-2">({selectedMovement.center_percentage}%)</span>
                    )}
                  </p>
                </div>
              )}

              {selectedMovement.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Descrizione</Label>
                  <p>{selectedMovement.description}</p>
                </div>
              )}

              {selectedMovement.is_rectification && (
                <div className="bg-yellow-50 p-3 rounded-md">
                  <p className="text-sm text-yellow-800">
                    Questo movimento è una rettifica
                  </p>
                </div>
              )}

              {selectedMovement.status === "rettificato" && selectedMovement.rectification_reason && (
                <div className="bg-red-50 p-3 rounded-md">
                  <p className="text-sm text-red-800">
                    <strong>Rettificato:</strong> {selectedMovement.rectification_reason}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rectify Dialog */}
      <Dialog open={rectifyDialogOpen} onOpenChange={setRectifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rettifica Movimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              La rettifica creerà un movimento opposto e manterrà lo storico. Il movimento originale non verrà cancellato.
            </p>
            <div className="space-y-2">
              <Label>Motivo della rettifica *</Label>
              <Textarea
                placeholder="Descrivi il motivo della rettifica..."
                value={rectificationReason}
                onChange={(e) => setRectificationReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRectifyDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (!rectificationReason.trim()) {
                  toast.error("Inserisci un motivo per la rettifica");
                  return;
                }
                if (selectedMovement) {
                  rectifyMutation.mutate({
                    movementId: selectedMovement.id,
                    reason: rectificationReason,
                  });
                }
              }}
              disabled={rectifyMutation.isPending}
            >
              Conferma Rettifica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
