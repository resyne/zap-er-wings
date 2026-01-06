import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format, addMonths, startOfMonth, endOfQuarter } from "date-fns";
import { it } from "date-fns/locale";
import { 
  ArrowUp, ArrowDown, FileText, CheckCircle, Lock, RefreshCw,
  Calendar, TrendingUp, TrendingDown, AlertCircle, Eye, Undo2,
  Filter, ChevronDown, Receipt, Percent
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

// =====================================================
// INTERFACES
// =====================================================

interface PrimaNotaLine {
  id: string;
  prima_nota_id: string;
  line_order: number;
  chart_account_id: string | null;
  structural_account_id: string | null;
  account_type: string;
  dynamic_account_key: string | null;
  dare: number;
  avere: number;
  description: string | null;
  chart_account?: { code: string; name: string } | null;
  structural_account?: { code: string; name: string } | null;
}

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
  // IVA fields
  iva_mode: string | null;
  iva_aliquota: number | null;
  imponibile: number | null;
  iva_amount: number | null;
  totale: number | null;
  payment_method: string | null;
  // Joined data
  chart_account?: { code: string; name: string } | null;
  cost_center?: { code: string; name: string } | null;
  profit_center?: { code: string; name: string } | null;
  accounting_entry?: {
    direction: string;
    document_type: string;
    document_date: string;
    attachment_url: string;
    iva_mode: string | null;
    iva_aliquota: number | null;
    imponibile: number | null;
    iva_amount: number | null;
    totale: number | null;
    payment_method: string | null;
    financial_status: string | null;
  } | null;
  lines?: PrimaNotaLine[];
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
  payment_method: string | null;
  // IVA fields
  iva_mode: string | null;
  iva_aliquota: number | null;
  imponibile: number | null;
  iva_amount: number | null;
  totale: number | null;
  chart_account?: { code: string; name: string } | null;
  cost_center?: { code: string; name: string } | null;
  profit_center?: { code: string; name: string } | null;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

const IVA_MODE_LABELS: Record<string, string> = {
  DOMESTICA_IMPONIBILE: "IVA Domestica",
  CESSIONE_UE_NON_IMPONIBILE: "Cessione UE",
  CESSIONE_EXTRA_UE_NON_IMPONIBILE: "Extra-UE",
  VENDITA_RC_EDILE: "RC Edile (Vendita)",
  ACQUISTO_RC_EDILE: "RC Edile (Acquisto)",
};

const formatIvaMode = (mode: string | null) => {
  if (!mode) return <span className="text-muted-foreground">-</span>;
  return (
    <Badge variant="outline" className="text-xs">
      {IVA_MODE_LABELS[mode] || mode}
    </Badge>
  );
};

const formatPaymentMethod = (method: string | null) => {
  if (!method) return "-";
  const labels: Record<string, string> = {
    banca: "Banca",
    cassa: "Cassa",
    carta: "Carta",
  };
  return labels[method] || method;
};

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function PrimaNotaPage() {
  const queryClient = useQueryClient();
  const [selectedMovement, setSelectedMovement] = useState<PrimaNotaMovement | null>(null);
  const [rectifyDialogOpen, setRectifyDialogOpen] = useState(false);
  const [rectificationReason, setRectificationReason] = useState("");
  const [filterPeriodType, setFilterPeriodType] = useState<string>("month");
  const [filterPeriod, setFilterPeriod] = useState<string>(format(new Date(), "yyyy-MM"));
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Calculate date range based on period type
  const getDateRange = () => {
    const now = new Date();
    switch (filterPeriodType) {
      case "month":
        return { period: filterPeriod };
      case "quarter": {
        const q = parseInt(filterPeriod.split("-Q")[1] || "1");
        const year = parseInt(filterPeriod.split("-Q")[0] || format(now, "yyyy"));
        const quarterStart = new Date(year, (q - 1) * 3, 1);
        return {
          from: format(quarterStart, "yyyy-MM-dd"),
          to: format(endOfQuarter(quarterStart), "yyyy-MM-dd"),
        };
      }
      case "year":
        return {
          from: `${filterPeriod}-01-01`,
          to: `${filterPeriod}-12-31`,
        };
      case "custom":
        return {
          from: filterDateFrom,
          to: filterDateTo,
        };
      case "all":
        return {};
      default:
        return { period: filterPeriod };
    }
  };

  // Fetch prima nota movements with lines
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["prima-nota", filterPeriodType, filterPeriod, filterDateFrom, filterDateTo, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("prima_nota")
        .select(`
          *,
          chart_account:chart_of_accounts(code, name),
          cost_center:cost_centers(code, name),
          profit_center:profit_centers(code, name),
          accounting_entry:accounting_entries(
            direction, document_type, document_date, attachment_url,
            iva_mode, iva_aliquota, imponibile, iva_amount, totale,
            payment_method, financial_status
          )
        `)
        .order("competence_date", { ascending: false })
        .order("created_at", { ascending: false });

      // Apply period filter based on type
      if (filterPeriodType === "month" && filterPeriod) {
        query = query.eq("accounting_period", filterPeriod);
      } else if (filterPeriodType === "quarter" || filterPeriodType === "year" || filterPeriodType === "custom") {
        const range = getDateRange();
        if (range.from && range.to) {
          query = query.gte("competence_date", range.from).lte("competence_date", range.to);
        }
      }

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      // Fetch lines for all movements
      if (data && data.length > 0) {
        const movementIds = data.map(m => m.id);
        const { data: linesData } = await supabase
          .from("prima_nota_lines")
          .select(`
            *,
            chart_account:chart_of_accounts(code, name),
            structural_account:structural_accounts(code, name)
          `)
          .in("prima_nota_id", movementIds)
          .order("line_order");
        
        // Attach lines to movements
        const linesMap = new Map<string, PrimaNotaLine[]>();
        linesData?.forEach(line => {
          const existing = linesMap.get(line.prima_nota_id) || [];
          existing.push(line);
          linesMap.set(line.prima_nota_id, existing);
        });
        
        data.forEach(m => {
          (m as PrimaNotaMovement).lines = linesMap.get(m.id) || [];
        });
      }
      
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
          financial_status, affects_income_statement, payment_method,
          iva_mode, iva_aliquota, imponibile, iva_amount, totale,
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

  // =====================================================
  // FIX 1 & 2 & 4: Generate prima nota with double-entry lines
  // =====================================================
  const generateMutation = useMutation({
    mutationFn: async (entry: PendingEntry) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      // Calculate IVA values
      const ivaMode = entry.iva_mode || "DOMESTICA_IMPONIBILE";
      const ivaAliquota = entry.iva_aliquota || 22;
      const imponibile = entry.imponibile || entry.amount;
      let ivaAmount = entry.iva_amount || 0;
      let totale = entry.totale || entry.amount;

      // FIX 3: Validate IVA based on mode
      if (ivaMode === "DOMESTICA_IMPONIBILE") {
        // IVA normale: imponibile + iva = totale
        if (!entry.iva_amount && !entry.totale) {
          ivaAmount = imponibile * (ivaAliquota / 100);
          totale = imponibile + ivaAmount;
        }
      } else if (["CESSIONE_UE_NON_IMPONIBILE", "CESSIONE_EXTRA_UE_NON_IMPONIBILE", "VENDITA_RC_EDILE"].includes(ivaMode)) {
        // Non imponibile: IVA = 0, totale = imponibile
        ivaAmount = 0;
        totale = imponibile;
      } else if (ivaMode === "ACQUISTO_RC_EDILE") {
        // Reverse charge acquisto: IVA calcolata internamente
        ivaAmount = imponibile * (ivaAliquota / 100);
        totale = imponibile; // Fornitore fattura solo imponibile
      }

      const isRevenue = entry.event_type === "ricavo" || entry.direction === "entrata";
      const isPaid = ["pagato", "incassato"].includes(entry.financial_status || "");
      const paymentMethod = entry.payment_method || "banca";

      // FIX 2: Single movement if paid immediately
      const movementType = isPaid ? "economico" : "economico";
      const description = isPaid 
        ? `${isRevenue ? "Ricavo" : "Costo"} - Pagato subito`
        : `${isRevenue ? "Ricavo" : "Costo"} - ${entry.temporal_competence === "rateizzata" ? "Rateizzato" : "Competenza immediata"}`;

      // Create movements based on temporal competence
      const movementsToCreate: any[] = [];
      const linesToCreate: any[] = [];

      // CASE A: Immediate or deferred competence - single movement
      if (entry.temporal_competence !== "rateizzata") {
        const movementId = crypto.randomUUID();
        
        movementsToCreate.push({
          id: movementId,
          accounting_entry_id: entry.id,
          movement_type: movementType,
          competence_date: entry.document_date,
          amount: isRevenue ? totale : -totale,
          chart_account_id: entry.chart_account_id,
          cost_center_id: entry.cost_center_id,
          profit_center_id: entry.profit_center_id,
          center_percentage: entry.center_percentage || 100,
          description,
          status: "generato",
          is_rectification: false,
          iva_mode: ivaMode,
          iva_aliquota: ivaAliquota,
          imponibile,
          iva_amount: ivaAmount,
          totale,
          payment_method: isPaid ? paymentMethod : null,
          created_by: userId,
        });

        // FIX 1 & 4: Generate double-entry lines
        const lines = generateDoubleEntryLines(
          movementId,
          isRevenue,
          isPaid,
          ivaMode,
          ivaAliquota,
          imponibile,
          ivaAmount,
          totale,
          paymentMethod,
          entry.chart_account_id
        );
        linesToCreate.push(...lines);
      }
      // CASE B: Installment competence - N movements
      else if (entry.recurrence_start_date && entry.recurrence_end_date) {
        const startDate = new Date(entry.recurrence_start_date);
        const endDate = new Date(entry.recurrence_end_date);
        
        let months = 0;
        let currentDate = startOfMonth(startDate);
        while (currentDate <= endDate) {
          months++;
          currentDate = addMonths(currentDate, 1);
        }

        if (months > 0) {
          const installmentImponibile = imponibile / months;
          const installmentIva = ivaAmount / months;
          const installmentTotale = totale / months;
          
          for (let i = 0; i < months; i++) {
            const competenceDate = addMonths(startOfMonth(startDate), i);
            const movementId = crypto.randomUUID();
            
            movementsToCreate.push({
              id: movementId,
              accounting_entry_id: entry.id,
              movement_type: "economico",
              competence_date: format(competenceDate, "yyyy-MM-dd"),
              amount: isRevenue ? installmentTotale : -installmentTotale,
              chart_account_id: entry.chart_account_id,
              cost_center_id: entry.cost_center_id,
              profit_center_id: entry.profit_center_id,
              center_percentage: entry.center_percentage || 100,
              description: `Competenza rateizzata ${i + 1}/${months}`,
              installment_number: i + 1,
              total_installments: months,
              status: "generato",
              is_rectification: false,
              iva_mode: ivaMode,
              iva_aliquota: ivaAliquota,
              imponibile: installmentImponibile,
              iva_amount: installmentIva,
              totale: installmentTotale,
              payment_method: null,
              created_by: userId,
            });

            // Lines for each installment
            const lines = generateDoubleEntryLines(
              movementId,
              isRevenue,
              false, // Installments are not paid immediately
              ivaMode,
              ivaAliquota,
              installmentImponibile,
              installmentIva,
              installmentTotale,
              null,
              entry.chart_account_id
            );
            linesToCreate.push(...lines);
          }
        }
      }

      // Insert movements
      if (movementsToCreate.length > 0) {
        const { error: insertError } = await supabase
          .from("prima_nota")
          .insert(movementsToCreate);

        if (insertError) throw insertError;

        // Insert lines
        if (linesToCreate.length > 0) {
          const { error: linesError } = await supabase
            .from("prima_nota_lines")
            .insert(linesToCreate);

          if (linesError) throw linesError;
        }
      }

      // Update entry status
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
      toast.success(`Generati ${count} movimenti con scritture in partita doppia`);
    },
    onError: () => {
      toast.error("Errore nella generazione della Prima Nota");
    },
  });

  // Generate double-entry lines based on FIX 4 rules
  function generateDoubleEntryLines(
    movementId: string,
    isRevenue: boolean,
    isPaid: boolean,
    ivaMode: string,
    ivaAliquota: number,
    imponibile: number,
    ivaAmount: number,
    totale: number,
    paymentMethod: string | null,
    chartAccountId: string | null
  ): any[] {
    const lines: any[] = [];
    let lineOrder = 1;

    // Determine DARE account (what we receive)
    const dareAccountKey = isPaid 
      ? paymentMethod?.toUpperCase() || "BANCA"
      : isRevenue ? "CREDITI_CLIENTI" : "CONTO_ECONOMICO";

    // FIX 4A: Vendita domestica imponibile
    if (ivaMode === "DOMESTICA_IMPONIBILE") {
      // DARE: Metodo pagamento / Crediti clienti = Totale
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "dynamic",
        dynamic_account_key: isPaid ? (paymentMethod?.toUpperCase() || "BANCA") : (isRevenue ? "CREDITI_CLIENTI" : "DEBITI_FORNITORI"),
        chart_account_id: null,
        dare: isRevenue ? totale : 0,
        avere: isRevenue ? 0 : totale,
        description: isPaid ? `Incasso/Pagamento ${formatPaymentMethod(paymentMethod)}` : (isRevenue ? "Crediti vs clienti" : "Debiti vs fornitori"),
      });

      // AVERE: Ricavi/Costi = Imponibile
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "chart",
        chart_account_id: chartAccountId,
        dynamic_account_key: null,
        dare: isRevenue ? 0 : imponibile,
        avere: isRevenue ? imponibile : 0,
        description: isRevenue ? "Ricavi" : "Costi",
      });

      // AVERE: IVA a debito/credito = IVA
      if (ivaAmount > 0) {
        lines.push({
          prima_nota_id: movementId,
          line_order: lineOrder++,
          account_type: "dynamic",
          dynamic_account_key: isRevenue ? "IVA_DEBITO" : "IVA_CREDITO",
          chart_account_id: null,
          dare: isRevenue ? 0 : ivaAmount,
          avere: isRevenue ? ivaAmount : 0,
          description: `IVA ${ivaAliquota}%`,
        });
      }
    }
    // FIX 4B: Cessione UE / Extra-UE / RC Vendita - no IVA
    else if (["CESSIONE_UE_NON_IMPONIBILE", "CESSIONE_EXTRA_UE_NON_IMPONIBILE", "VENDITA_RC_EDILE"].includes(ivaMode)) {
      // DARE: Metodo pagamento / Crediti = Totale (= imponibile)
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "dynamic",
        dynamic_account_key: isPaid ? (paymentMethod?.toUpperCase() || "BANCA") : (isRevenue ? "CREDITI_CLIENTI" : "DEBITI_FORNITORI"),
        chart_account_id: null,
        dare: isRevenue ? totale : 0,
        avere: isRevenue ? 0 : totale,
        description: isPaid ? `Incasso/Pagamento ${formatPaymentMethod(paymentMethod)}` : (isRevenue ? "Crediti vs clienti" : "Debiti vs fornitori"),
      });

      // AVERE: Ricavi = Totale
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "chart",
        chart_account_id: chartAccountId,
        dynamic_account_key: null,
        dare: isRevenue ? 0 : totale,
        avere: isRevenue ? totale : 0,
        description: `${isRevenue ? "Ricavi" : "Costi"} (${IVA_MODE_LABELS[ivaMode]})`,
      });
    }
    // FIX 4C: Reverse charge acquisto - IVA calcolata
    else if (ivaMode === "ACQUISTO_RC_EDILE") {
      // DARE: Costi = Imponibile
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "chart",
        chart_account_id: chartAccountId,
        dynamic_account_key: null,
        dare: imponibile,
        avere: 0,
        description: "Costi (RC Edile)",
      });

      // AVERE: Debiti fornitori / Banca = Imponibile
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "dynamic",
        dynamic_account_key: isPaid ? (paymentMethod?.toUpperCase() || "BANCA") : "DEBITI_FORNITORI",
        chart_account_id: null,
        dare: 0,
        avere: imponibile,
        description: isPaid ? `Pagamento ${formatPaymentMethod(paymentMethod)}` : "Debiti vs fornitori",
      });

      // DARE: IVA a credito = IVA calcolata
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "dynamic",
        dynamic_account_key: "IVA_CREDITO",
        chart_account_id: null,
        dare: ivaAmount,
        avere: 0,
        description: `IVA a credito (RC) ${ivaAliquota}%`,
      });

      // AVERE: IVA a debito = IVA calcolata
      lines.push({
        prima_nota_id: movementId,
        line_order: lineOrder++,
        account_type: "dynamic",
        dynamic_account_key: "IVA_DEBITO",
        chart_account_id: null,
        dare: 0,
        avere: ivaAmount,
        description: `IVA a debito (RC) ${ivaAliquota}%`,
      });
    }

    return lines;
  }


  // Rectify movement - with automatic Registro Contabile update
  const rectifyMutation = useMutation({
    mutationFn: async ({ movementId, reason }: { movementId: string; reason: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      
      const { data: original, error: fetchError } = await supabase
        .from("prima_nota")
        .select("*")
        .eq("id", movementId)
        .single();

      if (fetchError || !original) throw fetchError;

      // Create rectification movement
      const { data: rectification, error: insertError } = await supabase
        .from("prima_nota")
        .insert({
          accounting_entry_id: original.accounting_entry_id,
          movement_type: original.movement_type,
          competence_date: original.competence_date,
          amount: -original.amount,
          chart_account_id: original.chart_account_id,
          cost_center_id: original.cost_center_id,
          profit_center_id: original.profit_center_id,
          center_percentage: original.center_percentage,
          description: `RETTIFICA: ${reason}`,
          status: "generato",
          is_rectification: true,
          original_movement_id: movementId,
          iva_mode: original.iva_mode,
          iva_aliquota: original.iva_aliquota,
          imponibile: original.imponibile ? -original.imponibile : null,
          iva_amount: original.iva_amount ? -original.iva_amount : null,
          totale: original.totale ? -original.totale : null,
          payment_method: original.payment_method,
          created_by: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Get original lines and create reversed lines
      const { data: originalLines } = await supabase
        .from("prima_nota_lines")
        .select("*")
        .eq("prima_nota_id", movementId);

      if (originalLines && originalLines.length > 0) {
        const reversedLines = originalLines.map(line => ({
          prima_nota_id: rectification.id,
          line_order: line.line_order,
          chart_account_id: line.chart_account_id,
          structural_account_id: line.structural_account_id,
          account_type: line.account_type,
          dynamic_account_key: line.dynamic_account_key,
          dare: line.avere, // Swap dare/avere
          avere: line.dare,
          description: `RETTIFICA: ${line.description}`,
        }));

        await supabase.from("prima_nota_lines").insert(reversedLines);
      }

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

      // =====================================================
      // AUTOMATISMO POST-STORNO: Aggiorna Registro Contabile
      // =====================================================
      // Trova l'evento collegato a questa scrittura (via prima_nota_id)
      const { data: linkedEvent } = await supabase
        .from("invoice_registry")
        .select("id, periodo_chiuso, evento_lockato, scadenza_id")
        .eq("prima_nota_id", movementId)
        .maybeSingle();

      if (linkedEvent) {
        const isPeriodoClosed = linkedEvent.periodo_chiuso || linkedEvent.evento_lockato;
        
        // Aggiorna l'evento nel Registro Contabile
        const { error: registryError } = await supabase
          .from("invoice_registry")
          .update({
            // 1.1 Stato evento
            status: isPeriodoClosed ? "rettificato" : "da_riclassificare",
            // 1.2 Validità contabile
            contabilizzazione_valida: false,
            // 1.3 Tracciamento storno (audit)
            stornato: true,
            data_storno: new Date().toISOString(),
            utente_storno: userId,
            motivo_storno: reason,
            scrittura_stornata_id: movementId,
            scrittura_storno_id: rectification.id,
          })
          .eq("id", linkedEvent.id);

        if (registryError) {
          console.error("Errore aggiornamento Registro Contabile:", registryError);
        }

        // =====================================================
        // AGGIORNA SCADENZA: Saldo a 0 dopo storno
        // =====================================================
        // Se l'evento ha una scadenza collegata, la dobbiamo annullare
        // perché il saldo contabile è ora 0 (storno ha neutralizzato)
        if (linkedEvent.scadenza_id) {
          const { error: scadenzaError } = await supabase
            .from("scadenze")
            .update({
              stato: "stornata",
              importo_residuo: 0,
              note: `[STORNATA ${new Date().toLocaleDateString('it-IT')}] Motivo: ${reason}`
            })
            .eq("id", linkedEvent.scadenza_id);

          if (scadenzaError) {
            console.error("Errore aggiornamento Scadenza:", scadenzaError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-registry"] });
      toast.success("Movimento rettificato - Evento aggiornato nel Registro Contabile");
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

  // Toggle row expansion
  const toggleRowExpansion = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  // Summary calculations
  // Entrate/Uscite are calculated from financial accounts in prima_nota_lines:
  // - If financial account (banca/carta/cassa) is in AVERE → USCITA (outflow)
  // - If financial account (banca/carta/cassa) is in DARE → ENTRATA (inflow)
  const summary = movements.reduce(
    (acc, m) => {
      // Exclude both rectified movements AND their rectifications from the economic summary
      // When a movement is rectified, its original is excluded (status="rettificato")
      // and the rectification entry should also be excluded since it only serves to neutralize
      if (m.status === "rettificato" || m.is_rectification) return acc;
      
      const imponibile = m.imponibile || Math.abs(m.amount);
      const iva = m.iva_amount || 0;
      
      // Economic part: Ricavi e Costi (only for active non-rectification movements)
      if (m.amount > 0) {
        acc.revenues += imponibile;
        acc.ivaDebito += iva;
      } else {
        acc.costs += imponibile;
        acc.ivaCredito += iva;
      }
      
      // Financial part: Entrate e Uscite from prima_nota_lines
      // Look for financial accounts (banca, carta, cassa) in the lines
      if (m.lines && m.lines.length > 0) {
        m.lines.forEach(line => {
          const accountKey = line.dynamic_account_key?.toLowerCase() || "";
          const isFinancialAccount = ["banca", "carta", "cassa"].includes(accountKey);
          
          if (isFinancialAccount) {
            // DARE = money coming in (inflow), AVERE = money going out (outflow)
            if (line.dare > 0) {
              acc.inflows += line.dare;
            }
            if (line.avere > 0) {
              acc.outflows += line.avere;
            }
          }
        });
      }
      
      return acc;
    },
    { revenues: 0, costs: 0, inflows: 0, outflows: 0, ivaDebito: 0, ivaCredito: 0 }
  );

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Prima Nota</h1>
        <p className="text-muted-foreground">
          Scritture contabili in partita doppia generate dagli eventi classificati
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
                  <Select value={filterPeriodType} onValueChange={(val) => {
                    setFilterPeriodType(val);
                    if (val === "month") setFilterPeriod(format(new Date(), "yyyy-MM"));
                    else if (val === "quarter") setFilterPeriod(`${format(new Date(), "yyyy")}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
                    else if (val === "year") setFilterPeriod(format(new Date(), "yyyy"));
                  }}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">Mese</SelectItem>
                      <SelectItem value="quarter">Trimestre</SelectItem>
                      <SelectItem value="year">Anno</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                      <SelectItem value="all">Tutto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {filterPeriodType === "month" && (
                  <Input
                    type="month"
                    value={filterPeriod}
                    onChange={(e) => setFilterPeriod(e.target.value)}
                    className="w-40"
                  />
                )}

                {filterPeriodType === "custom" && (
                  <>
                    <Input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-36"
                    />
                    <span>-</span>
                    <Input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-36"
                    />
                  </>
                )}

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Stato" />
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
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-sm font-medium">Ricavi (Imponibile)</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.revenues.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
                {summary.ivaDebito > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    IVA a debito: € {summary.ivaDebito.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-red-600">
                  <TrendingDown className="h-5 w-5" />
                  <span className="text-sm font-medium">Costi (Imponibile)</span>
                </div>
                <p className="text-2xl font-bold mt-1">
                  € {summary.costs.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </p>
                {summary.ivaCredito > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    IVA a credito: € {summary.ivaCredito.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                  </p>
                )}
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
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="w-8 p-3"></th>
                        <th className="text-left p-3 text-sm font-medium">Data</th>
                        <th className="text-left p-3 text-sm font-medium">Tipo</th>
                        <th className="text-left p-3 text-sm font-medium">Conto</th>
                        {/* FIX 5: IVA column */}
                        <th className="text-center p-3 text-sm font-medium">IVA</th>
                        {/* FIX 6: Separate amounts */}
                        <th className="text-right p-3 text-sm font-medium">Imponibile</th>
                        <th className="text-right p-3 text-sm font-medium">Totale</th>
                        <th className="text-center p-3 text-sm font-medium">Stato</th>
                        <th className="text-center p-3 text-sm font-medium">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movements.map((m) => (
                        <>
                          <tr 
                            key={m.id} 
                            className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${m.is_rectification ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""} ${m.status === "rettificato" ? "opacity-50" : ""}`}
                            onClick={() => toggleRowExpansion(m.id)}
                          >
                            <td className="p-3">
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <ChevronDown className={`h-4 w-4 transition-transform ${expandedRows.has(m.id) ? "rotate-180" : ""}`} />
                              </Button>
                            </td>
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
                              {m.payment_method && (
                                <Badge variant="secondary" className="ml-1 text-xs">
                                  {formatPaymentMethod(m.payment_method)}
                                </Badge>
                              )}
                            </td>
                            <td className="p-3 text-sm">
                              {m.chart_account ? (
                                <span>{m.chart_account.code} - {m.chart_account.name}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            {/* FIX 5: IVA reference */}
                            <td className="p-3 text-center">
                              {m.iva_mode ? (
                                <div className="flex flex-col items-center gap-1">
                                  {formatIvaMode(m.iva_mode)}
                                  {m.iva_aliquota && m.iva_mode === "DOMESTICA_IMPONIBILE" && (
                                    <span className="text-xs text-muted-foreground">{m.iva_aliquota}%</span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            {/* FIX 6: Imponibile */}
                            <td className="p-3 text-sm text-right">
                              {m.imponibile ? (
                                <span className={m.amount >= 0 ? "text-green-600" : "text-red-600"}>
                                  € {Math.abs(m.imponibile).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            {/* FIX 6: Totale (prominente) */}
                            <td className={`p-3 text-sm text-right font-bold ${m.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                              € {Math.abs(m.totale || m.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                              {m.iva_amount && m.iva_amount > 0 && (
                                <div className="text-xs font-normal text-muted-foreground">
                                  (IVA: € {m.iva_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })})
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {getStatusBadge(m.status)}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                                {/* Visualizza dettagli */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setSelectedMovement(m)}
                                  title="Visualizza dettagli"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                
                                {/* STORNO - unica funzione ammessa in Prima Nota */}
                                {/* Solo per movimenti registrati, non già rettificati, e non rettifiche */}
                                {m.status === "registrato" && !m.is_rectification && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-orange-600"
                                    title="Storna scrittura"
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
                          {/* FIX 1: Expandable double-entry lines */}
                          {expandedRows.has(m.id) && (
                            <tr key={`${m.id}-lines`}>
                              <td colSpan={9} className="bg-muted/20 p-0">
                                <div className="p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Receipt className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Scritture Contabili (Partita Doppia)</span>
                                  </div>
                                  {m.lines && m.lines.length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-12">#</TableHead>
                                          <TableHead>Conto</TableHead>
                                          <TableHead className="text-right w-32">DARE</TableHead>
                                          <TableHead className="text-right w-32">AVERE</TableHead>
                                          <TableHead>Descrizione</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {m.lines.map((line) => (
                                          <TableRow key={line.id}>
                                            <TableCell className="font-mono text-xs">{line.line_order}</TableCell>
                                            <TableCell>
                                              {line.chart_account ? (
                                                <span>{line.chart_account.code} - {line.chart_account.name}</span>
                                              ) : line.structural_account ? (
                                                <span>{line.structural_account.code} - {line.structural_account.name}</span>
                                              ) : line.dynamic_account_key ? (
                                                <Badge variant="outline" className="font-mono text-xs">
                                                  {line.dynamic_account_key}
                                                </Badge>
                                              ) : (
                                                "-"
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                              {line.dare > 0 ? (
                                                <span className="text-blue-600">
                                                  € {line.dare.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                                </span>
                                              ) : (
                                                "-"
                                              )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">
                                              {line.avere > 0 ? (
                                                <span className="text-green-600">
                                                  € {line.avere.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                                </span>
                                              ) : (
                                                "-"
                                              )}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                              {line.description}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                        {/* Totals row */}
                                        <TableRow className="bg-muted/50 font-medium">
                                          <TableCell colSpan={2} className="text-right">TOTALE</TableCell>
                                          <TableCell className="text-right font-mono text-blue-600">
                                            € {m.lines.reduce((sum, l) => sum + l.dare, 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                          </TableCell>
                                          <TableCell className="text-right font-mono text-green-600">
                                            € {m.lines.reduce((sum, l) => sum + l.avere, 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                                          </TableCell>
                                          <TableCell>
                                            {m.lines.reduce((sum, l) => sum + l.dare, 0) === m.lines.reduce((sum, l) => sum + l.avere, 0) ? (
                                              <Badge variant="default" className="gap-1">
                                                <CheckCircle className="h-3 w-3" />
                                                Bilanciato
                                              </Badge>
                                            ) : (
                                              <Badge variant="destructive">Sbilanciato!</Badge>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <p className="text-sm text-muted-foreground italic">
                                      Nessuna scrittura contabile (movimento precedente alla partita doppia)
                                    </p>
                                  )}
                                  
                                  {/* FIX 5: IVA section always visible */}
                                  <div className="mt-4 p-3 bg-background rounded-md border">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Percent className="h-4 w-4 text-muted-foreground" />
                                      <span className="text-sm font-medium">Riferimento IVA</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Regime</Label>
                                        <p className="font-medium">{IVA_MODE_LABELS[m.iva_mode || ""] || "Non specificato"}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Aliquota</Label>
                                        <p className="font-medium">{m.iva_aliquota ? `${m.iva_aliquota}%` : "-"}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Imponibile</Label>
                                        <p className="font-medium">€ {(m.imponibile || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">IVA</Label>
                                        <p className="font-medium">€ {(m.iva_amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Totale</Label>
                                        <p className="font-medium">€ {(m.totale || m.amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
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
                              ? "bg-green-100 text-green-600 dark:bg-green-900/30"
                              : "bg-red-100 text-red-600 dark:bg-red-900/30"
                          }`}
                        >
                          {entry.direction === "entrata" ? (
                            <ArrowUp className="h-5 w-5" />
                          ) : (
                            <ArrowDown className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          {/* FIX 6: Show separate amounts */}
                          <div className="font-bold text-lg">
                            € {(entry.totale || entry.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                          </div>
                          <div className="text-sm text-muted-foreground flex gap-3">
                            <span>Imponibile: € {(entry.imponibile || entry.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                            {entry.iva_amount && entry.iva_amount > 0 && (
                              <span>IVA: € {entry.iva_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <span>{format(new Date(entry.document_date), "dd MMM yyyy", { locale: it })}</span>
                            {entry.iva_mode && formatIvaMode(entry.iva_mode)}
                            {entry.financial_status && (
                              <Badge variant={["pagato", "incassato"].includes(entry.financial_status) ? "default" : "secondary"} className="text-xs">
                                {entry.financial_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          {entry.chart_account && (
                            <div>{entry.chart_account.code} - {entry.chart_account.name}</div>
                          )}
                          {entry.payment_method && (
                            <div className="text-muted-foreground">Pagamento: {formatPaymentMethod(entry.payment_method)}</div>
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
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettaglio Movimento</DialogTitle>
          </DialogHeader>
          {selectedMovement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
                  <Label className="text-xs text-muted-foreground">Stato</Label>
                  <div className="mt-1">{getStatusBadge(selectedMovement.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Metodo Pagamento</Label>
                  <p className="font-medium">{formatPaymentMethod(selectedMovement.payment_method)}</p>
                </div>
              </div>

              <Separator />

              {/* FIX 6: Prominent amount display */}
              <Card className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <Label className="text-xs text-muted-foreground">Imponibile</Label>
                      <p className="text-xl font-bold">
                        € {(selectedMovement.imponibile || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">IVA</Label>
                      <p className="text-xl font-bold">
                        € {(selectedMovement.iva_amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Totale</Label>
                      <p className={`text-2xl font-bold ${selectedMovement.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                        € {Math.abs(selectedMovement.totale || selectedMovement.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* FIX 5: IVA Section */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Regime IVA</Label>
                <div className="flex items-center gap-4">
                  {formatIvaMode(selectedMovement.iva_mode)}
                  {selectedMovement.iva_aliquota && (
                    <span className="text-sm">Aliquota: {selectedMovement.iva_aliquota}%</span>
                  )}
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

              {selectedMovement.description && (
                <div>
                  <Label className="text-xs text-muted-foreground">Descrizione</Label>
                  <p>{selectedMovement.description}</p>
                </div>
              )}

              {selectedMovement.is_rectification && (
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    Questo movimento è una rettifica
                  </p>
                </div>
              )}

              {selectedMovement.status === "rettificato" && selectedMovement.rectification_reason && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <p className="text-sm text-red-800 dark:text-red-200">
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
              La rettifica creerà un movimento opposto con scritture contabili inverse.
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
