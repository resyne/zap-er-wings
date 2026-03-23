import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Search, ShoppingCart, Truck, Wrench, ChevronLeft, ChevronRight,
  AlertTriangle, FileCheck, MoreHorizontal, Archive, Eye, LinkIcon,
  Calendar, Filter
} from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subDays, subWeeks, subMonths, isWithinInterval } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LinkAccountingDocDialog, DocType } from "@/components/documenti-operativi/LinkAccountingDocDialog";
import { OrderDetailSheet } from "@/components/documenti-operativi/OrderDetailSheet";
import { ReportDetailSheet } from "@/components/documenti-operativi/ReportDetailSheet";

type PeriodMode = "day" | "week" | "month";
type DocTypeFilter = "all" | "order" | "ddt" | "report";

interface UnifiedDoc {
  id: string;
  type: "order" | "ddt" | "report";
  number: string;
  customer: string;
  customerId: string | null;
  date: Date;
  dateStr: string;
  amount: number | null;
  status: string;
  statusLabel: string;
  invoiced: boolean;
  invoiceNumber: string | null;
  accountingDocId: string | null;
  isExcluded: boolean;
  archived: boolean;
  raw: any;
}

const typeConfig = {
  order: { label: "Ordine", icon: ShoppingCart, color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  ddt: { label: "DDT", icon: Truck, color: "bg-violet-500/10 text-violet-700 border-violet-500/20" },
  report: { label: "Rapporto", icon: Wrench, color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

const orderStatusMap: Record<string, string> = {
  draft: "Bozza", confirmed: "Confermato", in_progress: "In Lavorazione",
  completed: "Completato", completato: "Completato", cancelled: "Annullato",
  commissionato: "Commissionato", in_lavorazione: "In Lavorazione",
};

function getPeriodRange(date: Date, mode: PeriodMode) {
  if (mode === "day") return { start: startOfDay(date), end: endOfDay(date) };
  if (mode === "week") return { start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) };
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

function navigatePeriod(date: Date, mode: PeriodMode, dir: 1 | -1) {
  if (mode === "day") return dir === 1 ? addDays(date, 1) : subDays(date, 1);
  if (mode === "week") return dir === 1 ? addWeeks(date, 1) : subWeeks(date, 1);
  return dir === 1 ? addMonths(date, 1) : subMonths(date, 1);
}

function formatPeriodLabel(date: Date, mode: PeriodMode) {
  if (mode === "day") return format(date, "EEEE d MMMM yyyy", { locale: it });
  if (mode === "week") {
    const { start, end } = getPeriodRange(date, "week");
    return `${format(start, "d MMM", { locale: it })} — ${format(end, "d MMM yyyy", { locale: it })}`;
  }
  return format(date, "MMMM yyyy", { locale: it });
}

export default function DocumentiOperativiPage() {
  const queryClient = useQueryClient();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [typeFilter, setTypeFilter] = useState<DocTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; docType: DocType; docId: string; docLabel: string; currentLinkedId: string | null }>({
    open: false, docType: "order", docId: "", docLabel: "", currentLinkedId: null
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Fetch orders
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ["doc-op-orders", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("sales_orders")
        .select("id, number, order_date, customer_id, total_amount, status, order_type, invoiced, invoice_number, archived, order_source, accounting_document_id, non_contabilizzato")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch DDTs
  const { data: ddts = [], isLoading: loadingDdts } = useQuery({
    queryKey: ["doc-op-ddts", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("ddts")
        .select("id, ddt_number, ddt_data, customer_id, direction, document_date, status, archived, attachment_url, created_at, invoiced, invoice_number")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch reports
  const { data: reports = [], isLoading: loadingReports } = useQuery({
    queryKey: ["doc-op-reports", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("service_reports")
        .select("id, report_number, intervention_date, intervention_type, technician_name, total_amount, status, invoiced, invoice_number, archived, customer_id")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data } = await q;
      return data || [];
    },
  });

  // Fetch customers
  const allCustomerIds = useMemo(() => {
    const ids = new Set<string>();
    orders.forEach(o => o.customer_id && ids.add(o.customer_id));
    ddts.forEach(d => d.customer_id && ids.add(d.customer_id));
    reports.forEach(r => r.customer_id && ids.add(r.customer_id));
    return [...ids];
  }, [orders, ddts, reports]);

  const { data: customers = [] } = useQuery({
    queryKey: ["doc-op-customers", allCustomerIds],
    queryFn: async () => {
      if (allCustomerIds.length === 0) return [];
      const { data } = await supabase.from("customers").select("id, name, company_name").in("id", allCustomerIds);
      return data || [];
    },
    enabled: allCustomerIds.length > 0,
  });

  const custMap = useMemo(() => new Map(customers.map(c => [c.id, c.company_name || c.name])), [customers]);

  // Build unified list
  const allDocs: UnifiedDoc[] = useMemo(() => {
    const docs: UnifiedDoc[] = [];

    orders.forEach(o => {
      const d = o.order_date ? new Date(o.order_date) : new Date();
      docs.push({
        id: o.id, type: "order", number: o.number || "—",
        customer: custMap.get(o.customer_id || "") || "—",
        customerId: o.customer_id,
        date: d, dateStr: o.order_date || "",
        amount: o.total_amount, status: o.status || "",
        statusLabel: orderStatusMap[o.status || ""] || o.status || "—",
        invoiced: o.invoiced || false, invoiceNumber: o.invoice_number,
        accountingDocId: o.accounting_document_id,
        isExcluded: o.non_contabilizzato || false,
        archived: o.archived || false, raw: o,
      });
    });

    ddts.forEach(d => {
      const ddtData = d.ddt_data as any;
      const dateVal = d.document_date ? new Date(d.document_date) : new Date(d.created_at);
      const counterpart = d.direction === "inbound" ? ddtData?.intestazione : ddtData?.destinatario;
      docs.push({
        id: d.id, type: "ddt", number: d.ddt_number || "—",
        customer: custMap.get(d.customer_id || "") || counterpart || "—",
        customerId: d.customer_id,
        date: dateVal, dateStr: d.document_date || d.created_at,
        amount: null, status: d.direction || "",
        statusLabel: d.direction === "inbound" ? "Entrata" : "Uscita",
        invoiced: (d as any).invoiced || false, invoiceNumber: (d as any).invoice_number,
        accountingDocId: null, isExcluded: false,
        archived: d.archived || false, raw: d,
      });
    });

    reports.forEach(r => {
      const d = r.intervention_date ? new Date(r.intervention_date) : new Date();
      docs.push({
        id: r.id, type: "report", number: r.report_number || "—",
        customer: custMap.get(r.customer_id || "") || "—",
        customerId: r.customer_id,
        date: d, dateStr: r.intervention_date || "",
        amount: r.total_amount, status: r.status || "",
        statusLabel: r.status === "completed" ? "Completato" : r.status === "draft" ? "Bozza" : r.status || "—",
        invoiced: r.invoiced || false, invoiceNumber: r.invoice_number,
        accountingDocId: null, isExcluded: false,
        archived: r.archived || false, raw: r,
      });
    });

    docs.sort((a, b) => b.date.getTime() - a.date.getTime());
    return docs;
  }, [orders, ddts, reports, custMap]);

  // Filter by period, type, search
  const filteredDocs = useMemo(() => {
    const { start, end } = getPeriodRange(currentDate, periodMode);
    return allDocs.filter(doc => {
      if (!isWithinInterval(doc.date, { start, end })) return false;
      if (typeFilter !== "all" && doc.type !== typeFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!doc.number.toLowerCase().includes(s) && !doc.customer.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [allDocs, currentDate, periodMode, typeFilter, search]);

  // Stats
  const stats = useMemo(() => {
    const pending = filteredDocs.filter(d => !d.invoiced && !d.isExcluded).length;
    const invoiced = filteredDocs.filter(d => d.invoiced).length;
    return { total: filteredDocs.length, pending, invoiced };
  }, [filteredDocs]);

  const isLoading = loadingOrders || loadingDdts || loadingReports;

  const handleOpenLink = (doc: UnifiedDoc) => {
    setLinkDialog({
      open: true,
      docType: doc.type,
      docId: doc.id,
      docLabel: doc.number,
      currentLinkedId: doc.accountingDocId,
    });
  };

  const handleRowClick = (doc: UnifiedDoc) => {
    if (doc.type === "order") {
      setSelectedOrder(doc.raw);
    }
    // For DDT and reports, open link dialog directly
    if (doc.type === "ddt" || doc.type === "report") {
      handleOpenLink(doc);
    }
  };

  const typeFilterButtons: { value: DocTypeFilter; label: string; icon: typeof ShoppingCart }[] = [
    { value: "all", label: "Tutti", icon: Filter },
    { value: "order", label: "Ordini", icon: ShoppingCart },
    { value: "ddt", label: "DDT", icon: Truck },
    { value: "report", label: "Rapporti", icon: Wrench },
  ];

  return (
    <div className="space-y-4">
      {/* Period navigator + mode selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-1.5 bg-muted/50 rounded-xl p-1">
          {(["day", "week", "month"] as PeriodMode[]).map(m => (
            <Button
              key={m}
              variant={periodMode === m ? "default" : "ghost"}
              size="sm"
              className={cn("h-8 text-xs px-3 rounded-lg", periodMode === m && "shadow-sm")}
              onClick={() => setPeriodMode(m)}
            >
              {m === "day" ? "Giorno" : m === "week" ? "Settimana" : "Mese"}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-1 justify-center">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => navigatePeriod(d, periodMode, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="text-sm font-semibold capitalize min-w-[200px] text-center hover:text-primary transition-colors"
          >
            {formatPeriodLabel(currentDate, periodMode)}
          </button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(d => navigatePeriod(d, periodMode, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button variant={showArchived ? "default" : "ghost"} size="sm" className="h-8 text-xs" onClick={() => setShowArchived(!showArchived)}>
          <Archive className="h-3.5 w-3.5 mr-1.5" />
          Archiviati
        </Button>
      </div>

      {/* Type filter chips + search */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex items-center gap-1.5">
          {typeFilterButtons.map(t => {
            const Icon = t.icon;
            const isActive = typeFilter === t.value;
            const count = t.value === "all"
              ? filteredDocs.length
              : filteredDocs.filter(d => d.type === t.value).length;
            return (
              <Button
                key={t.value}
                variant={isActive ? "default" : "outline"}
                size="sm"
                className={cn("h-8 text-xs gap-1.5 rounded-full px-3", !isActive && "border-dashed")}
                onClick={() => setTypeFilter(t.value)}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {count > 0 && <span className="ml-0.5 text-[10px] opacity-70">({count})</span>}
              </Button>
            );
          })}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca per numero o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
      </div>

      {/* Summary mini stats */}
      {stats.pending > 0 && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{stats.pending}</span> documenti da fatturare nel periodo
            {stats.invoiced > 0 && <span className="text-muted-foreground ml-2">• {stats.invoiced} fatturati</span>}
          </p>
        </div>
      )}

      {/* Unified Table */}
      {isLoading ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground mt-3">Caricamento documenti...</p>
          </CardContent>
        </Card>
      ) : filteredDocs.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="h-12 w-12 mx-auto rounded-2xl bg-muted flex items-center justify-center">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="font-medium mt-3">Nessun documento nel periodo</p>
            <p className="text-sm text-muted-foreground mt-1">Prova a cambiare il periodo o i filtri</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-340px)] min-h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[90px]">Tipo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numero</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Importo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fatturazione</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDocs.map(doc => {
                    const tc = typeConfig[doc.type];
                    const Icon = tc.icon;
                    return (
                      <TableRow
                        key={`${doc.type}-${doc.id}`}
                        className={cn("hover:bg-muted/50 group cursor-pointer", doc.archived && "opacity-50")}
                        onClick={() => handleRowClick(doc)}
                      >
                        <TableCell>
                          <Badge variant="outline" className={cn("text-[10px] gap-1 border", tc.color)}>
                            <Icon className="h-3 w-3" />
                            {tc.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-sm">{doc.number}</TableCell>
                        <TableCell className="max-w-[180px] truncate text-sm">{doc.customer}</TableCell>
                        <TableCell className="text-sm">{format(doc.date, "dd/MM/yyyy", { locale: it })}</TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {doc.amount != null ? `€ ${doc.amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{doc.statusLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleOpenLink(doc); }}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {doc.invoiced ? (
                              <Badge variant="default" className="text-xs gap-1">
                                <FileCheck className="h-3 w-3" />
                                {doc.invoiceNumber || "Fatturato"}
                              </Badge>
                            ) : doc.isExcluded ? (
                              <Badge variant="outline" className="text-xs text-muted-foreground">N/A</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1 text-amber-600 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20">
                                <AlertTriangle className="h-3 w-3" />
                                Da fatturare
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {doc.type === "order" && (
                                <DropdownMenuItem onClick={() => setSelectedOrder(doc.raw)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Dettagli ordine
                                </DropdownMenuItem>
                              )}
                              {doc.type === "ddt" && doc.raw.attachment_url && (
                                <DropdownMenuItem asChild>
                                  <a href={doc.raw.attachment_url} target="_blank" rel="noopener noreferrer">
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualizza DDT
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => handleOpenLink(doc)}>
                                <LinkIcon className="h-4 w-4 mr-2" />
                                {doc.invoiced ? "Cambia fattura" : "Collega fattura"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      <LinkAccountingDocDialog
        open={linkDialog.open}
        onOpenChange={open => setLinkDialog(prev => ({ ...prev, open }))}
        docType={linkDialog.docType}
        docId={linkDialog.docId}
        docLabel={linkDialog.docLabel}
        currentLinkedId={linkDialog.currentLinkedId}
        onLinked={() => {
          queryClient.invalidateQueries({ queryKey: ["doc-op-orders"] });
          queryClient.invalidateQueries({ queryKey: ["doc-op-ddts"] });
          queryClient.invalidateQueries({ queryKey: ["doc-op-reports"] });
        }}
      />

      <OrderDetailSheet
        open={!!selectedOrder}
        onOpenChange={open => { if (!open) setSelectedOrder(null); }}
        order={selectedOrder}
        customerName={selectedOrder ? custMap.get(selectedOrder.customer_id || "") || "—" : "—"}
      />
    </div>
  );
}
