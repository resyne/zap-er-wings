import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Wrench, Archive, MoreHorizontal, LinkIcon, AlertTriangle, FileCheck } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LinkAccountingDocDialog } from "./LinkAccountingDocDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Bozza", variant: "outline" },
  completed: { label: "Completato", variant: "default" },
  sent: { label: "Inviato", variant: "secondary" },
};

export default function RapportiSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; reportId: string; reportLabel: string; currentLinkedId: string | null }>({
    open: false, reportId: "", reportLabel: "", currentLinkedId: null
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["service-reports-operativi", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("service_reports")
        .select("id, report_number, intervention_date, intervention_type, technician_name, total_amount, status, invoiced, invoice_number, archived, customer_id, work_performed")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const customerIds = [...new Set(reports.map(r => r.customer_id).filter(Boolean))];
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-reports", customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data } = await supabase.from("customers").select("id, name, company_name").in("id", customerIds as string[]);
      return data || [];
    },
    enabled: customerIds.length > 0,
  });

  const custMap = new Map(customers.map(c => [c.id, c.company_name || c.name]));

  const filtered = reports.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.report_number?.toLowerCase().includes(s) ||
      r.technician_name?.toLowerCase().includes(s) ||
      custMap.get(r.customer_id || "")?.toLowerCase().includes(s)
    );
  });

  const pendingCount = reports.filter(r => !r.invoiced && !r.archived && r.status === "completed").length;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{pendingCount} rapporti completati</span> senza documento contabile collegato
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca rapporti per numero, tecnico o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <Button variant={showArchived ? "default" : "ghost"} size="sm" className="h-9 text-xs" onClick={() => setShowArchived(!showArchived)}>
          <Archive className="h-3.5 w-3.5 mr-1.5" />
          {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
        </Button>
      </div>

      {isLoading ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Caricamento rapporti...</p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <Wrench className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Nessun rapporto trovato</p>
                <p className="text-sm text-muted-foreground">I rapporti di intervento appariranno qui</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numero</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tecnico</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Importo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fatturazione</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(report => {
                    const st = statusLabels[report.status] || { label: report.status, variant: "outline" as const };
                    const hasAccounting = !!report.invoiced;
                    return (
                      <TableRow key={report.id} className={cn("hover:bg-muted/50 group", report.archived && "opacity-50")}>
                        <TableCell className="font-mono font-medium">{report.report_number || "—"}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{custMap.get(report.customer_id || "") || "—"}</TableCell>
                        <TableCell className="text-sm">{format(new Date(report.intervention_date), "dd/MM/yyyy", { locale: it })}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{report.intervention_type}</Badge></TableCell>
                        <TableCell>{report.technician_name || "—"}</TableCell>
                        <TableCell className="text-right font-medium">{report.total_amount != null ? `€ ${report.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                        <TableCell>
                          <button
                            onClick={() => setLinkDialog({
                              open: true,
                              reportId: report.id,
                              reportLabel: report.report_number || "Rapporto",
                              currentLinkedId: null
                            })}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {hasAccounting ? (
                              <Badge variant="default" className="text-xs gap-1">
                                <FileCheck className="h-3 w-3" />
                                {report.invoice_number || "Fatturato"}
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs gap-1 text-amber-600 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20">
                                <AlertTriangle className="h-3 w-3" />
                                Da fatturare
                              </Badge>
                            )}
                          </button>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setLinkDialog({
                                open: true,
                                reportId: report.id,
                                reportLabel: report.report_number || "Rapporto",
                                currentLinkedId: null
                              })}>
                                <LinkIcon className="h-4 w-4 mr-2" />
                                {hasAccounting ? "Cambia fattura" : "Collega fattura"}
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
        docType="report"
        docId={linkDialog.reportId}
        docLabel={linkDialog.reportLabel}
        currentLinkedId={linkDialog.currentLinkedId}
        onLinked={() => queryClient.invalidateQueries({ queryKey: ["service-reports-operativi"] })}
      />
    </div>
  );
}
