import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, ShoppingCart, Archive, MoreHorizontal, LinkIcon, AlertTriangle, FileCheck, Unlink, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { LinkAccountingDocDialog } from "./LinkAccountingDocDialog";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Bozza", variant: "outline" },
  confirmed: { label: "Confermato", variant: "default" },
  in_progress: { label: "In Lavorazione", variant: "secondary" },
  completed: { label: "Completato", variant: "default" },
  completato: { label: "Completato", variant: "default" },
  cancelled: { label: "Annullato", variant: "destructive" },
  commissionato: { label: "Commissionato", variant: "secondary" },
  in_lavorazione: { label: "In Lavorazione", variant: "secondary" },
};

const typeMap: Record<string, string> = {
  odp: "Produzione",
  odpel: "Prod. + Install.",
  odl: "Intervento",
  ods: "Spedizione",
};

export default function OrdiniSection() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [linkDialog, setLinkDialog] = useState<{ open: boolean; orderId: string; orderNumber: string; currentLinkedId: string | null }>({
    open: false, orderId: "", orderNumber: "", currentLinkedId: null
  });
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["sales-orders-operativi", showArchived],
    queryFn: async () => {
      let q = supabase
        .from("sales_orders")
        .select("id, number, order_date, customer_id, total_amount, status, order_type, invoiced, invoice_number, archived, order_source, accounting_document_id, non_contabilizzato")
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

  const pendingCount = orders.filter(o => !o.invoiced && !o.non_contabilizzato && !o.archived).length;

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <p className="text-sm text-amber-700">
            <span className="font-semibold">{pendingCount} ordini</span> senza documento contabile collegato
          </p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca ordini per numero o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
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
              <p className="text-sm text-muted-foreground">Caricamento ordini...</p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <ShoppingCart className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Nessun ordine trovato</p>
                <p className="text-sm text-muted-foreground">Gli ordini arrivano da ERP e Z-APP</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border shadow-sm overflow-hidden">
          <CardContent className="p-0">
            <ScrollArea className="h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Numero</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Tipo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Importo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Fatturazione</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(order => {
                    const st = statusMap[order.status || ""] || { label: order.status || "—", variant: "outline" as const };
                    const hasAccounting = !!order.accounting_document_id || !!order.invoiced;
                    const isExcluded = order.non_contabilizzato;
                    return (
                      <TableRow
                        key={order.id}
                        className={cn("hover:bg-muted/50 group cursor-pointer", order.archived && "opacity-50")}
                        onClick={() => setSelectedOrder(order)}
                      >
                        <TableCell className="font-mono font-medium text-primary">{order.number}</TableCell>
                        <TableCell className="max-w-[180px] truncate">{custMap.get(order.customer_id || "") || "—"}</TableCell>
                        <TableCell className="text-sm">{order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{typeMap[order.order_type || ""] || order.order_type || "—"}</Badge></TableCell>
                        <TableCell className="text-right font-medium">{order.total_amount != null ? `€ ${order.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}` : "—"}</TableCell>
                        <TableCell><Badge variant={st.variant} className="text-xs">{st.label}</Badge></TableCell>
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setLinkDialog({
                                open: true,
                                orderId: order.id,
                                orderNumber: order.number,
                                currentLinkedId: order.accounting_document_id
                              });
                            }}
                            className="cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            {hasAccounting ? (
                              <Badge variant="default" className="text-xs gap-1">
                                <FileCheck className="h-3 w-3" />
                                {order.invoice_number || "Fatturato"}
                              </Badge>
                            ) : isExcluded ? (
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
                              <DropdownMenuItem onClick={() => setSelectedOrder(order)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Dettagli
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setLinkDialog({
                                open: true,
                                orderId: order.id,
                                orderNumber: order.number,
                                currentLinkedId: order.accounting_document_id
                              })}>
                                <LinkIcon className="h-4 w-4 mr-2" />
                                {hasAccounting ? "Cambia doc. contabile" : "Collega doc. contabile"}
                              </DropdownMenuItem>
                              {hasAccounting && (
                                <DropdownMenuItem onClick={() => setLinkDialog({
                                  open: true,
                                  orderId: order.id,
                                  orderNumber: order.number,
                                  currentLinkedId: order.accounting_document_id
                                })}>
                                  <Unlink className="h-4 w-4 mr-2" />
                                  Scollega
                                </DropdownMenuItem>
                              )}
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
        docType="order"
        docId={linkDialog.orderId}
        docLabel={linkDialog.orderNumber}
        currentLinkedId={linkDialog.currentLinkedId}
        onLinked={() => queryClient.invalidateQueries({ queryKey: ["sales-orders-operativi"] })}
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
