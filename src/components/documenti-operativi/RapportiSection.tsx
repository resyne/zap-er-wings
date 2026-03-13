import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, Wrench } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Bozza", variant: "outline" },
  completed: { label: "Completato", variant: "default" },
  sent: { label: "Inviato", variant: "secondary" },
};

export default function RapportiSection() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Rapporti di Intervento</CardTitle>
            <CardDescription>Rapporti delle attività di assistenza tecnica</CardDescription>
          </div>
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca rapporti..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <Wrench className="h-8 w-8 mb-2" /><p>Nessun rapporto trovato</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tecnico</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Fatturato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(report => {
                  const st = statusLabels[report.status] || { label: report.status, variant: "outline" as const };
                  return (
                    <TableRow key={report.id} className={report.archived ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{report.report_number || "-"}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{custMap.get(report.customer_id || "") || "-"}</TableCell>
                      <TableCell>{format(new Date(report.intervention_date), "dd/MM/yyyy", { locale: it })}</TableCell>
                      <TableCell><Badge variant="outline">{report.intervention_type}</Badge></TableCell>
                      <TableCell>{report.technician_name || "-"}</TableCell>
                      <TableCell>{report.total_amount != null ? `€ ${report.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell>
                        {report.invoiced ? (
                          <Badge variant="default">{report.invoice_number || "Sì"}</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
