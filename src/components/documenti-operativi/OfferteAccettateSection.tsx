import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function OfferteAccettateSection() {
  const [search, setSearch] = useState("");

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ["offers-accepted"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("offers")
        .select("id, number, title, customer_name, customer_id, amount, status, approved, approved_at, approved_by_name, created_at, archived")
        .in("status", ["accepted", "converted"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = offers.filter(o => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.number?.toLowerCase().includes(s) ||
      o.title?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca offerte per numero, titolo o cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>

      {/* Table */}
      {isLoading ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Caricamento offerte...</p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="py-16 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center">
                <CheckSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Nessuna offerta accettata</p>
                <p className="text-sm text-muted-foreground">Le offerte accettate appariranno qui</p>
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
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Titolo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Cliente</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Importo</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data Accettazione</TableHead>
                    <TableHead className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(offer => (
                    <TableRow key={offer.id} className={cn("hover:bg-muted/50", offer.archived && "opacity-50")}>
                      <TableCell className="font-mono font-medium">{offer.number}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{offer.title}</TableCell>
                      <TableCell className="max-w-[180px] truncate">{offer.customer_name}</TableCell>
                      <TableCell className="text-right font-medium">€ {offer.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-sm">{offer.approved_at ? format(new Date(offer.approved_at), "dd/MM/yyyy", { locale: it }) : "—"}</TableCell>
                      <TableCell>
                        <Badge variant={offer.status === "converted" ? "default" : "secondary"} className="text-xs">
                          {offer.status === "converted" ? "Convertita" : "Accettata"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
