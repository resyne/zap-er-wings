import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ClipboardList, TrendingUp, TrendingDown, Minus, User, Calendar } from "lucide-react";

interface InventoryLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InventoryLogDialog({ open, onOpenChange }: InventoryLogDialogProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["inventory-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Group logs by date+user (session)
  const grouped = logs.reduce<Record<string, typeof logs>>((acc, log) => {
    const dateKey = format(new Date(log.created_at), "yyyy-MM-dd HH:mm", { locale: it });
    const key = `${dateKey}__${log.user_name || "Utente"}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Storico Inventari
          </DialogTitle>
          <DialogDescription>
            Log di tutti gli inventari effettuati, con dettaglio delle modifiche.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[600px]">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-30" />
              Nessun inventario registrato
            </div>
          ) : (
            <div className="space-y-4 pr-2">
              {Object.entries(grouped).map(([key, items]) => {
                const first = items[0];
                const sessionDate = format(new Date(first.created_at), "dd MMM yyyy, HH:mm", { locale: it });
                const userName = first.user_name || "Utente";

                return (
                  <div key={key} className="border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 px-3 py-2 flex items-center gap-2 text-sm">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{sessionDate}</span>
                      <span className="text-muted-foreground">·</span>
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>{userName}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {items.length} articol{items.length === 1 ? "o" : "i"}
                      </Badge>
                    </div>
                    <div className="divide-y">
                      {items.map((log) => {
                        const diff = log.difference;
                        return (
                          <div key={log.id} className="px-3 py-2 flex items-center gap-2 text-sm">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{log.material_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {log.material_code}
                                {log.supplier_name && ` · ${log.supplier_name}`}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 space-y-0.5">
                              <div className="text-xs text-muted-foreground">
                                {log.old_quantity} → {log.new_quantity} {log.unit}
                              </div>
                              <div className="flex items-center justify-end gap-1">
                                {diff > 0 ? (
                                  <Badge className="bg-green-100 text-green-700 border-green-200 text-xs gap-0.5">
                                    <TrendingUp className="h-3 w-3" />+{diff}
                                  </Badge>
                                ) : diff < 0 ? (
                                  <Badge className="bg-red-100 text-red-700 border-red-200 text-xs gap-0.5">
                                    <TrendingDown className="h-3 w-3" />{diff}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs gap-0.5">
                                    <Minus className="h-3 w-3" />0
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
