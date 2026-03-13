import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, CheckSquare } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

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
    <Card>
      <CardHeader>
        <CardTitle>Offerte Accettate</CardTitle>
        <CardDescription>Offerte commerciali accettate o convertite in ordine</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca offerte..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <CheckSquare className="h-8 w-8 mb-2" /><p>Nessuna offerta accettata trovata</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Importo</TableHead>
                  <TableHead>Data Accettazione</TableHead>
                  <TableHead>Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(offer => (
                  <TableRow key={offer.id} className={offer.archived ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{offer.number}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{offer.title}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{offer.customer_name}</TableCell>
                    <TableCell>€ {offer.amount?.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{offer.approved_at ? format(new Date(offer.approved_at), "dd/MM/yyyy", { locale: it }) : "-"}</TableCell>
                    <TableCell>
                      <Badge variant={offer.status === "converted" ? "default" : "secondary"}>
                        {offer.status === "converted" ? "Convertita" : "Accettata"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
