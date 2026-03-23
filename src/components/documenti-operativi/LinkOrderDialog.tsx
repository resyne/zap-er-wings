import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Search, ShoppingCart, Check, X, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

interface LinkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  docType: "report" | "ddt";
  docId: string;
  docLabel: string;
  onLinked: () => void;
}

export function LinkOrderDialog({ open, onOpenChange, docType, docId, docLabel, onLinked }: LinkOrderDialogProps) {
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from("sales_orders")
      .select("id, number, order_date, customer_id, total_amount, status")
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setOrders(data || []);
        setLoading(false);
      });
  }, [open]);

  // Fetch customer names
  const customerIds = useMemo(() => [...new Set(orders.map(o => o.customer_id).filter(Boolean))], [orders]);
  const [custMap, setCustMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (customerIds.length === 0) return;
    supabase.from("customers").select("id, name, company_name").in("id", customerIds).then(({ data }) => {
      setCustMap(new Map((data || []).map(c => [c.id, c.company_name || c.name])));
    });
  }, [customerIds]);

  const filtered = orders.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return o.number?.toLowerCase().includes(s) || custMap.get(o.customer_id)?.toLowerCase().includes(s);
  });

  const handleLink = async (orderId: string) => {
    setLinking(true);
    const table = docType === "report" ? "service_reports" : "ddts";
    const { error } = await supabase.from(table).update({ sales_order_id: orderId } as any).eq("id", docId);
    if (error) {
      toast.error("Errore nel collegamento");
    } else {
      toast.success("Ordine collegato con successo");
      onLinked();
      onOpenChange(false);
    }
    setLinking(false);
  };

  const handleUnlink = async () => {
    setLinking(true);
    const table = docType === "report" ? "service_reports" : "ddts";
    const { error } = await supabase.from(table).update({ sales_order_id: null } as any).eq("id", docId);
    if (error) {
      toast.error("Errore nello scollegamento");
    } else {
      toast.success("Ordine scollegato");
      onLinked();
      onOpenChange(false);
    }
    setLinking(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Collega ordine a {docLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca per numero o cliente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[350px]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nessun ordine trovato</p>
            ) : (
              <div className="space-y-1.5">
                {filtered.map(order => (
                  <button
                    key={order.id}
                    onClick={() => handleLink(order.id)}
                    disabled={linking}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="font-mono font-medium text-sm">{order.number}</p>
                      <p className="text-xs text-muted-foreground">
                        {custMap.get(order.customer_id) || "—"} • {order.order_date ? format(new Date(order.order_date), "dd/MM/yyyy", { locale: it }) : "—"}
                        {order.total_amount ? ` • €${Number(order.total_amount).toFixed(2)}` : ""}
                      </p>
                    </div>
                    <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <Button variant="outline" size="sm" onClick={handleUnlink} disabled={linking} className="w-full gap-2 text-muted-foreground">
            <X className="h-3.5 w-3.5" />
            Scollega ordine esistente
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
