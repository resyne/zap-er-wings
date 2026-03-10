import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format, endOfQuarter } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, FileText, CheckCircle, Lock, RefreshCw,
  Calendar, TrendingUp, TrendingDown, Eye, Undo2,
  Filter, ChevronDown, Percent, User, Banknote,
  FileCheck, ExternalLink, Paperclip, Building2, CreditCard, Receipt
} from "lucide-react";
import { IVA_MODE_LABELS, formatPaymentMethod, formatEuro } from "@/lib/accounting-utils";
import { MovementDetailDialog } from "./MovementDetailDialog";
import { RectifyDialog } from "./RectifyDialog";

// =====================================================
// TYPES
// =====================================================

export interface PrimaNotaLine {
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

export interface PrimaNotaMovement {
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
  iva_mode: string | null;
  iva_aliquota: number | null;
  imponibile: number | null;
  iva_amount: number | null;
  totale: number | null;
  payment_method: string | null;
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
  linked_invoice?: {
    id: string;
    invoice_number: string;
    invoice_type: string;
    subject_name: string;
    subject_type: string;
    financial_status: string;
    scadenza_id: string | null;
    contabilizzazione_valida: boolean | null;
  } | null;
  linked_scadenza?: {
    id: string;
    stato: string;
    importo_totale: number;
    importo_residuo: number;
    soggetto_nome: string | null;
    soggetto_tipo: string | null;
  } | null;
  payment_attachments?: any[];
}

// =====================================================
// HELPERS
// =====================================================

const formatIvaMode = (mode: string | null) => {
  if (!mode) return <span className="text-muted-foreground">-</span>;
  return <Badge variant="outline" className="text-xs">{IVA_MODE_LABELS[mode] || mode}</Badge>;
};

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon: React.ReactNode }> = {
    generato: { variant: "secondary", label: "Generato", icon: <FileText className="h-3 w-3" /> },
    registrato: { variant: "default", label: "Registrato", icon: <CheckCircle className="h-3 w-3" /> },
    bloccato: { variant: "outline", label: "Bloccato", icon: <Lock className="h-3 w-3" /> },
    rettificato: { variant: "destructive", label: "Rettificato", icon: <Undo2 className="h-3 w-3" /> },
  };
  const config = variants[status] || { variant: "secondary", label: status, icon: null };
  return <Badge variant={config.variant} className="gap-1">{config.icon}{config.label}</Badge>;
};

// =====================================================
// COMPONENT
// =====================================================

export function LibroGiornaleTab() {
  const queryClient = useQueryClient();
  const [filterPeriodType, setFilterPeriodType] = useState<string>("month");
  const [filterPeriod, setFilterPeriod] = useState<string>(format(new Date(), "yyyy-MM"));
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedMovement, setSelectedMovement] = useState<PrimaNotaMovement | null>(null);
  const [rectifyDialogOpen, setRectifyDialogOpen] = useState(false);

  const getDateRange = () => {
    switch (filterPeriodType) {
      case "month": return { period: filterPeriod };
      case "quarter": {
        const q = parseInt(filterPeriod.split("-Q")[1] || "1");
        const year = parseInt(filterPeriod.split("-Q")[0] || format(new Date(), "yyyy"));
        const quarterStart = new Date(year, (q - 1) * 3, 1);
        return { from: format(quarterStart, "yyyy-MM-dd"), to: format(endOfQuarter(quarterStart), "yyyy-MM-dd") };
      }
      case "year": return { from: `${filterPeriod}-01-01`, to: `${filterPeriod}-12-31` };
      case "custom": return { from: filterDateFrom, to: filterDateTo };
      case "all": return {};
      default: return { period: filterPeriod };
    }
  };

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["prima-nota", filterPeriodType, filterPeriod, filterDateFrom, filterDateTo, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from("prima_nota")
        .select(`*, chart_account:chart_of_accounts(code, name), cost_center:cost_centers(code, name), profit_center:profit_centers(code, name), accounting_entry:accounting_entries!inner(direction, document_type, document_date, attachment_url, iva_mode, iva_aliquota, imponibile, iva_amount, totale, payment_method, financial_status)`)
        .order("competence_date", { ascending: false })
        .order("created_at", { ascending: false });

      if (filterPeriodType === "month" && filterPeriod) {
        query = query.eq("accounting_period", filterPeriod);
      } else if (["quarter", "year", "custom"].includes(filterPeriodType)) {
        const range = getDateRange();
        if ('from' in range && range.from && 'to' in range && range.to) {
          query = query.gte("competence_date", range.from).lte("competence_date", range.to);
        }
      }
      if (filterStatus !== "all") query = query.eq("status", filterStatus);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        const movementIds = data.map(m => m.id);
        const [{ data: linesData }, { data: movimentiData }, { data: invoicesData }] = await Promise.all([
          supabase.from("prima_nota_lines").select(`*, chart_account:chart_of_accounts(code, name), structural_account:structural_accounts(code, name)`).in("prima_nota_id", movementIds).order("line_order"),
          supabase.from("scadenza_movimenti").select("id, prima_nota_id, scadenza_id, attachments, importo, metodo_pagamento, note").in("prima_nota_id", movementIds),
          supabase.from("invoice_registry").select(`id, invoice_number, invoice_type, subject_name, subject_type, financial_status, scadenza_id, contabilizzazione_valida, prima_nota_id`).in("prima_nota_id", movementIds),
        ]);

        const scadenzaIds = movimentiData?.filter(m => m.scadenza_id).map(m => m.scadenza_id as string) || [];
        const { data: scadenzeData } = scadenzaIds.length > 0
          ? await supabase.from("scadenze").select("id, stato, importo_totale, importo_residuo, soggetto_nome, soggetto_tipo, data_documento, data_scadenza, tipo, note, iva_mode, evento_id").in("id", scadenzaIds)
          : { data: [] };

        // Build maps
        const linesMap = new Map<string, PrimaNotaLine[]>();
        linesData?.forEach(l => { const arr = linesMap.get(l.prima_nota_id) || []; arr.push(l); linesMap.set(l.prima_nota_id, arr); });
        const scadenzeMap = new Map(scadenzeData?.map(s => [s.id, s]) || []);
        const movimentiMap = new Map(movimentiData?.filter(m => m.prima_nota_id).map(m => [m.prima_nota_id!, m]) || []);
        const invoicesMap = new Map(invoicesData?.filter(i => i.prima_nota_id).map(i => [i.prima_nota_id!, i]) || []);

        data.forEach(m => {
          (m as any).lines = linesMap.get(m.id) || [];
          const linkedMov = movimentiMap.get(m.id);
          if (linkedMov?.scadenza_id) (m as any).linked_scadenza = scadenzeMap.get(linkedMov.scadenza_id) || null;
          const linkedInv = invoicesMap.get(m.id);
          if (linkedInv) {
            (m as any).linked_invoice = linkedInv;
            if (!linkedMov?.scadenza_id && linkedInv.scadenza_id) (m as any).linked_scadenza = scadenzeMap.get(linkedInv.scadenza_id) || null;
          }
          (m as any).payment_attachments = linkedMov?.attachments && Array.isArray(linkedMov.attachments) ? linkedMov.attachments : [];
        });
      }
      return data as PrimaNotaMovement[];
    },
  });

  const summary = movements.reduce(
    (acc, m) => {
      if (m.status === "rettificato" || m.is_rectification) return acc;
      const imponibile = m.imponibile || Math.abs(m.amount);
      const iva = m.iva_amount || 0;
      if (m.amount > 0) { acc.revenues += imponibile; acc.ivaDebito += iva; }
      else { acc.costs += imponibile; acc.ivaCredito += iva; }
      if (m.lines && m.lines.length > 0) {
        m.lines.forEach(line => {
          const key = line.dynamic_account_key?.toLowerCase() || "";
          if (["banca", "carta", "cassa"].includes(key)) {
            if (line.dare > 0) acc.inflows += line.dare;
            if (line.avere > 0) acc.outflows += line.avere;
          }
        });
      }
      return acc;
    },
    { revenues: 0, costs: 0, inflows: 0, outflows: 0, ivaDebito: 0, ivaCredito: 0 }
  );

  const toggleRow = (id: string) => {
    const next = new Set(expandedRows);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpandedRows(next);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={filterPeriodType} onValueChange={(val) => {
                setFilterPeriodType(val);
                if (val === "month") setFilterPeriod(format(new Date(), "yyyy-MM"));
                else if (val === "quarter") setFilterPeriod(`${format(new Date(), "yyyy")}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
                else if (val === "year") setFilterPeriod(format(new Date(), "yyyy"));
              }}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
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
              <Input type="month" value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="w-40" />
            )}
            {filterPeriodType === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="w-36" />
                <span className="text-muted-foreground">—</span>
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="w-36" />
              </div>
            )}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Stato" /></SelectTrigger>
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

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Ricavi" value={summary.revenues} color="text-emerald-600" subLabel={summary.ivaDebito > 0 ? `IVA deb: ${formatEuro(summary.ivaDebito)}` : undefined} />
        <SummaryCard icon={<TrendingDown className="h-4 w-4" />} label="Costi" value={summary.costs} color="text-red-600" subLabel={summary.ivaCredito > 0 ? `IVA cred: ${formatEuro(summary.ivaCredito)}` : undefined} />
        <SummaryCard icon={<ArrowUp className="h-4 w-4" />} label="Entrate" value={summary.inflows} color="text-blue-600" />
        <SummaryCard icon={<ArrowDown className="h-4 w-4" />} label="Uscite" value={summary.outflows} color="text-orange-600" />
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
      ) : movements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">Nessun movimento per questo periodo</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="w-8 p-3"></th>
                    <th className="text-left p-3 font-medium">Data</th>
                    <th className="text-left p-3 font-medium">Tipo</th>
                    <th className="text-left p-3 font-medium">Conto</th>
                    <th className="text-center p-3 font-medium">IVA</th>
                    <th className="text-right p-3 font-medium">Imponibile</th>
                    <th className="text-right p-3 font-medium">Totale</th>
                    <th className="text-center p-3 font-medium">Stato</th>
                    <th className="text-center p-3 font-medium w-20">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <MovementRow
                      key={m.id}
                      movement={m}
                      expanded={expandedRows.has(m.id)}
                      onToggle={() => toggleRow(m.id)}
                      onView={() => setSelectedMovement(m)}
                      onRectify={() => { setSelectedMovement(m); setRectifyDialogOpen(true); }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <MovementDetailDialog
        movement={selectedMovement}
        open={!!selectedMovement && !rectifyDialogOpen}
        onOpenChange={(open) => !open && setSelectedMovement(null)}
      />
      <RectifyDialog
        movement={selectedMovement}
        open={rectifyDialogOpen}
        onOpenChange={setRectifyDialogOpen}
        onSuccess={() => { setSelectedMovement(null); }}
      />
    </div>
  );
}

// =====================================================
// SUB-COMPONENTS
// =====================================================

function SummaryCard({ icon, label, value, color, subLabel }: { icon: React.ReactNode; label: string; value: number; color: string; subLabel?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 ${color}`}>
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-xl font-bold mt-1">{formatEuro(value)}</p>
        {subLabel && <p className="text-xs text-muted-foreground mt-0.5">{subLabel}</p>}
      </CardContent>
    </Card>
  );
}

function MovementRow({ movement: m, expanded, onToggle, onView, onRectify }: {
  movement: PrimaNotaMovement; expanded: boolean; onToggle: () => void; onView: () => void; onRectify: () => void;
}) {
  return (
    <>
      <tr
        className={`border-t hover:bg-muted/30 transition-colors cursor-pointer ${m.is_rectification ? "bg-amber-50/50 dark:bg-amber-900/10" : ""} ${m.status === "rettificato" ? "opacity-50" : ""}`}
        onClick={onToggle}
      >
        <td className="p-3">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        </td>
        <td className="p-3">
          {format(new Date(m.competence_date), "dd/MM/yyyy", { locale: it })}
          {m.installment_number && <span className="text-xs text-muted-foreground ml-1">({m.installment_number}/{m.total_installments})</span>}
        </td>
        <td className="p-3">
          <div className="flex items-center gap-1">
            <Badge variant={m.movement_type === "economico" ? "default" : "outline"} className="text-xs">
              {m.movement_type === "economico" ? "Econ" : "Fin"}
            </Badge>
            {m.payment_method && <Badge variant="secondary" className="text-xs">{formatPaymentMethod(m.payment_method)}</Badge>}
          </div>
        </td>
        <td className="p-3">
          {m.chart_account ? <span>{m.chart_account.code} - {m.chart_account.name}</span> : <span className="text-muted-foreground">-</span>}
        </td>
        <td className="p-3 text-center">
          {m.iva_mode ? formatIvaMode(m.iva_mode) : <span className="text-muted-foreground">-</span>}
        </td>
        <td className="p-3 text-right">
          {m.imponibile ? <span className={m.amount >= 0 ? "text-emerald-600" : "text-red-600"}>{formatEuro(Math.abs(m.imponibile))}</span> : <span className="text-muted-foreground">-</span>}
        </td>
        <td className={`p-3 text-right font-semibold ${m.amount >= 0 ? "text-emerald-600" : "text-red-600"}`}>
          {formatEuro(Math.abs(m.totale || m.amount))}
          {m.iva_amount && m.iva_amount > 0 && <div className="text-xs font-normal text-muted-foreground">(IVA: {formatEuro(m.iva_amount)})</div>}
        </td>
        <td className="p-3 text-center">{getStatusBadge(m.status)}</td>
        <td className="p-3 text-center">
          <div className="flex justify-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onView} title="Dettagli">
              <Eye className="h-3.5 w-3.5" />
            </Button>
            {m.status === "registrato" && !m.is_rectification && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-600" title="Storna" onClick={onRectify}>
                <Undo2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={9} className="bg-muted/20 p-0">
            <ExpandedDetail movement={m} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({ movement: m }: { movement: PrimaNotaMovement }) {
  return (
    <div className="p-4 space-y-4">
      {/* Condensed reference info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-background rounded-md border text-sm">
        <div>
          <Label className="text-xs text-muted-foreground">Tipo</Label>
          <p className="font-medium flex items-center gap-1">
            {m.amount >= 0 ? <><TrendingUp className="h-3 w-3 text-emerald-600" /> Incasso</> : <><TrendingDown className="h-3 w-3 text-red-600" /> Pagamento</>}
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Documento</Label>
          <p className="font-medium">{m.linked_invoice ? `Fattura n. ${m.linked_invoice.invoice_number}` : "-"}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">{m.amount >= 0 ? "Cliente" : "Fornitore"}</Label>
          <p className="font-medium flex items-center gap-1">
            {m.linked_invoice?.subject_type === "customer" ? <User className="h-3 w-3 text-muted-foreground" /> : <Building2 className="h-3 w-3 text-muted-foreground" />}
            {m.linked_invoice?.subject_name || m.linked_scadenza?.soggetto_nome || "-"}
          </p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Stato Fin.</Label>
          <div>
            {m.accounting_entry?.financial_status === "incassato" || m.accounting_entry?.financial_status === "pagato" ? (
              <Badge className="bg-emerald-600 text-xs">{m.accounting_entry.financial_status === "incassato" ? "Incassato" : "Pagato"}</Badge>
            ) : m.accounting_entry?.financial_status === "da_incassare" || m.accounting_entry?.financial_status === "da_pagare" ? (
              <Badge variant="secondary" className="text-xs">{m.accounting_entry.financial_status === "da_incassare" ? "Da incassare" : "Da pagare"}</Badge>
            ) : <span className="text-muted-foreground">-</span>}
          </div>
        </div>
      </div>

      {/* Stato operativo - condensato */}
      <div className="flex flex-wrap gap-2">
        {m.linked_scadenza?.stato === "chiusa" && <Badge className="bg-emerald-600 gap-1 text-xs"><CheckCircle className="h-3 w-3" />Scadenza chiusa</Badge>}
        {m.linked_scadenza?.stato === "aperta" && <Badge variant="secondary" className="gap-1 text-xs"><Calendar className="h-3 w-3" />Scad. aperta (res: {formatEuro(m.linked_scadenza.importo_residuo || 0)})</Badge>}
        {m.linked_scadenza?.stato === "stornata" && <Badge variant="destructive" className="gap-1 text-xs"><Undo2 className="h-3 w-3" />Stornata</Badge>}
        {m.linked_scadenza?.importo_residuo === 0 && m.linked_scadenza?.stato === "chiusa" && <Badge className="bg-blue-600 gap-1 text-xs"><FileCheck className="h-3 w-3" />{m.amount >= 0 ? "Credito" : "Debito"} estinto</Badge>}
        {m.is_rectification && <Badge variant="destructive" className="gap-1 text-xs"><Undo2 className="h-3 w-3" />Storno</Badge>}
        {m.linked_invoice?.contabilizzazione_valida && <Badge variant="outline" className="gap-1 text-xs border-emerald-500 text-emerald-600"><CheckCircle className="h-3 w-3" />Contab. valida</Badge>}
      </div>

      {/* Allegati */}
      {m.payment_attachments && m.payment_attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {m.payment_attachments.map((att: any, idx: number) => (
            <a key={idx} href={att.file_url || att.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-md hover:bg-muted/80 transition-colors text-xs">
              <Paperclip className="h-3 w-3" />
              <span className="max-w-28 truncate">{att.file_name || att.name || `Allegato ${idx + 1}`}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </a>
          ))}
        </div>
      )}

      {/* Scritture in Partita Doppia */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
          <Receipt className="h-3.5 w-3.5" />Scritture Contabili
        </p>
        {m.lines && m.lines.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-xs">#</TableHead>
                <TableHead className="text-xs">Conto</TableHead>
                <TableHead className="text-right w-28 text-xs">DARE</TableHead>
                <TableHead className="text-right w-28 text-xs">AVERE</TableHead>
                <TableHead className="text-xs">Descrizione</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {m.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-xs py-2">{line.line_order}</TableCell>
                  <TableCell className="py-2 text-xs">
                    {line.chart_account ? `${line.chart_account.code} - ${line.chart_account.name}` :
                      line.structural_account ? `${line.structural_account.code} - ${line.structural_account.name}` :
                        line.dynamic_account_key ? <Badge variant="outline" className="font-mono text-xs">{line.dynamic_account_key}</Badge> : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono py-2 text-xs">
                    {line.dare > 0 ? <span className="text-blue-600">{formatEuro(line.dare)}</span> : "-"}
                  </TableCell>
                  <TableCell className="text-right font-mono py-2 text-xs">
                    {line.avere > 0 ? <span className="text-emerald-600">{formatEuro(line.avere)}</span> : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground py-2 text-xs">{line.description}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-medium">
                <TableCell colSpan={2} className="text-right text-xs py-2">TOTALE</TableCell>
                <TableCell className="text-right font-mono text-blue-600 text-xs py-2">{formatEuro(m.lines.reduce((s, l) => s + l.dare, 0))}</TableCell>
                <TableCell className="text-right font-mono text-emerald-600 text-xs py-2">{formatEuro(m.lines.reduce((s, l) => s + l.avere, 0))}</TableCell>
                <TableCell className="py-2">
                  {m.lines.reduce((s, l) => s + l.dare, 0) === m.lines.reduce((s, l) => s + l.avere, 0) ? (
                    <Badge variant="default" className="gap-1 text-xs"><CheckCircle className="h-3 w-3" />OK</Badge>
                  ) : <Badge variant="destructive" className="text-xs">Sbilanciato</Badge>}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <p className="text-xs text-muted-foreground italic">Nessuna scrittura contabile</p>
        )}
      </div>

      {/* IVA Reference - compatto */}
      <div className="grid grid-cols-5 gap-3 p-3 bg-background rounded-md border text-xs">
        <div><Label className="text-xs text-muted-foreground">Regime</Label><p className="font-medium">{IVA_MODE_LABELS[m.iva_mode || ""] || "-"}</p></div>
        <div><Label className="text-xs text-muted-foreground">Aliq.</Label><p className="font-medium">{m.iva_aliquota ? `${m.iva_aliquota}%` : "-"}</p></div>
        <div><Label className="text-xs text-muted-foreground">Impon.</Label><p className="font-medium">{formatEuro(m.imponibile || 0)}</p></div>
        <div><Label className="text-xs text-muted-foreground">IVA</Label><p className="font-medium">{formatEuro(m.iva_amount || 0)}</p></div>
        <div><Label className="text-xs text-muted-foreground">Totale</Label><p className="font-medium">{formatEuro(m.totale || m.amount || 0)}</p></div>
      </div>
    </div>
  );
}
