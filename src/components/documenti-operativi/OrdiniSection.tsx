import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, ShoppingCart } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Bozza", variant: "outline" },
  confirmed: { label: "Confermato", variant: "default" },
  in_progress: { label: "In Lavorazione", variant: "secondary" },
  completed: { label: "Completato", variant: "default" },
  cancelled: { label: "Annullato", variant: "destructive" },
};

const typeMap: Record<string, string> = {
  odp: "Produzione",
  odpel: "Prod. + Install.",
  odl: "Intervento",
  ods: "Spedizione",
};

export default function OrdiniSection() {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-orders-operativi", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("sales_orders")
        .select("id, number, order_date, customer_id, total_amount, status, order_type, invoiced, invoice_number, archived, order_source")
        .order("created_at", { ascending: false });
      if (!showArchived) q = q.or("archived.is.null,archived.eq.false");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const customerIds = [...new Set(orders.map(o => o.customer_id).filter(Boolean))];
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-for-orders", customerIds],
    queryFn: async () => {
      if (customerIds.length === 0) return [];
      const { data } = await supabase.from("customers").select("id, name, company_name").in("id", customerIds);
      return data || [];
    },
    enabled: customerIds.length > 0,
  });

  const custMap = new Map(customers.map(c => [c.id, c.company_name || c.name]));

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.number?.toLowerCase().includes(s) ||
      custMap.get(o.customer_id || "")?.toLowerCase().includes(s)
    );
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Ordini di Vendita</CardTitle>
            <CardDescription>Ordini inseriti tramite ERP e Z-APP</CardDescription>
          </div>
          <Button variant={showArchived ? "default" : "outline"} size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca ordini..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <ShoppingCart className="h-8 w-8 mb-2" /><p>Nessun ordine trovato</p>
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
                  <TableHead>Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Fatturato</TableHead>
                  <TableHead>Origine</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(order => {
                  const st = statusMap[order.status || ""] || { label: order.status || "-", variant: "outline" as const };
                  return (
                    <TableRow key={order.id} className={order.archived ? "opacity-50" : ""}>
                      <TableCell className="font-medium">{order.number}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{custMap.get(order.customer_id || "") || "-"}</TableCell>
                      <TableCell>{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy", { locale: it }) : "-"}</TableCell>
                      <TableCell><Badge variant="outline">{typeMap[order.order_type || ""] || order.order_type || "-"}</Badge></TableCell>
                      <TableCell>{order.total_amount != null ? `€ ${order.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "-"}</TableCell>
                      <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                      <TableCell>
                        {order.invoiced ? (
                          <Badge variant="default">{order.invoice_number || "Sì"}</Badge>
                        ) : (
                          <Badge variant="outline">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {order.order_source === "z-app" ? "Z-APP" : "ERP"}
                        </Badge>
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
