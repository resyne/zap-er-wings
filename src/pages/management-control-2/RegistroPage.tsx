import { AIDocumentUpload } from "@/components/dashboard/AIDocumentUpload";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export default function RegistroPage() {
  const { data: myRegistrations = [], isLoading: loadingRegistrations } = useQuery({
    queryKey: ["my-registrations"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      
      const { data, error } = await supabase
        .from("movimenti_finanziari")
        .select("*")
        .eq("created_by", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(value);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <BozzeDaValidareSection />
      <AIDocumentUpload />

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Le mie registrazioni recenti</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0 sm:pt-0">
          {loadingRegistrations ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : myRegistrations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessuna registrazione effettuata
            </div>
          ) : (
            <>
              <div className="sm:hidden space-y-3">
                {myRegistrations.map((reg: any) => (
                  <div key={reg.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {reg.direzione === "entrata" ? (
                          <ArrowUp className="h-4 w-4 text-green-600" />
                        ) : (
                          <ArrowDown className="h-4 w-4 text-red-600" />
                        )}
                        <span className={cn("font-medium", reg.direzione === "entrata" ? "text-green-600" : "text-red-600")}>
                          {formatCurrency(Number(reg.importo))}
                        </span>
                      </div>
                      <Badge variant={reg.stato === "contabilizzato" ? "default" : "secondary"} className="text-xs">
                        {reg.stato}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{format(new Date(reg.data_movimento), "dd/MM/yyyy", { locale: it })}</span>
                      <span className="capitalize">{reg.metodo_pagamento}</span>
                    </div>
                    {reg.soggetto_nome && (
                      <p className="text-xs text-muted-foreground truncate">{reg.soggetto_nome}</p>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="hidden sm:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Metodo</TableHead>
                      <TableHead>Soggetto</TableHead>
                      <TableHead>Stato</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myRegistrations.map((reg: any) => (
                      <TableRow key={reg.id}>
                        <TableCell>
                          {format(new Date(reg.data_movimento), "dd/MM/yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {reg.direzione === "entrata" ? (
                              <ArrowUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <ArrowDown className="h-4 w-4 text-red-600" />
                            )}
                            <span className={reg.direzione === "entrata" ? "text-green-600" : "text-red-600"}>
                              {reg.direzione === "entrata" ? "Entrata" : "Uscita"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatCurrency(Number(reg.importo))}
                        </TableCell>
                        <TableCell className="capitalize">{reg.metodo_pagamento}</TableCell>
                        <TableCell>{reg.soggetto_nome || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={reg.stato === "contabilizzato" ? "default" : "secondary"}>
                            {reg.stato}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
