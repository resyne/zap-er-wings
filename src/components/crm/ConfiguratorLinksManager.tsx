import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Copy, ExternalLink, Eye, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/lib/formatAmount";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useState } from "react";

export function ConfiguratorLinksManager() {
  const queryClient = useQueryClient();
  const [selectedLink, setSelectedLink] = useState<any>(null);

  const { data: links, isLoading } = useQuery({
    queryKey: ["configurator-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("configurator_links")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("configurator_links")
        .update({ is_active: !isActive })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-links"] });
      toast.success("Stato aggiornato");
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("configurator_links")
        .update({ status })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["configurator-links"] });
      toast.success("Stato aggiornato");
      setSelectedLink(null);
    },
  });

  const copyLink = (code: string) => {
    const baseUrl = window.location.origin;
    const link = `${baseUrl}/configurator/${code}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiato negli appunti!");
  };

  const getStatusBadge = (link: any) => {
    if (link.submitted_at) {
      if (link.status === "converted") {
        return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Convertito</Badge>;
      }
      if (link.status === "rejected") {
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rifiutato</Badge>;
      }
      return <Badge className="bg-blue-600"><CheckCircle2 className="h-3 w-3 mr-1" />Completato</Badge>;
    }
    if (!link.is_active) {
      return <Badge variant="secondary">Disattivo</Badge>;
    }
    if (link.expires_at && new Date(link.expires_at) < new Date()) {
      return <Badge variant="outline">Scaduto</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />In attesa</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Caricamento...</div>;
  }

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {!links || links.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nessun link generato
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Configurazione</TableHead>
                  <TableHead>Prezzo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link: any) => (
                  <TableRow key={link.id}>
                    <TableCell className="font-medium">{link.name}</TableCell>
                    <TableCell>
                      {link.customer_name ? (
                        <div className="space-y-1">
                          <div className="font-medium">{link.customer_name}</div>
                          {link.customer_email && (
                            <div className="text-sm text-muted-foreground">{link.customer_email}</div>
                          )}
                          {link.customer_phone && (
                            <div className="text-sm text-muted-foreground">{link.customer_phone}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.selected_model ? (
                        <div className="space-y-1">
                          <div>{link.selected_model}</div>
                          <div className="text-sm text-muted-foreground">
                            {link.selected_power} • {link.selected_size}cm
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {link.selected_installation === "shipping" ? "Con spedizione" : "Montaggio in loco"}
                          </div>
                        </div>
                      ) : link.preselected_model ? (
                        <div className="text-sm text-muted-foreground">
                          Preselezionato: {link.preselected_model}
                          {link.preselected_power && ` • ${link.preselected_power}`}
                          {link.preselected_size && ` • ${link.preselected_size}cm`}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.total_price ? (
                        <span className="font-semibold">{formatAmount(link.total_price)}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(link)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm">
                          {format(new Date(link.created_at), "dd MMM yyyy", { locale: it })}
                        </div>
                        {link.submitted_at && (
                          <div className="text-xs text-muted-foreground">
                            Completato: {format(new Date(link.submitted_at), "dd MMM yyyy", { locale: it })}
                          </div>
                        )}
                        {link.expires_at && (
                          <div className="text-xs text-muted-foreground">
                            Scade: {format(new Date(link.expires_at), "dd MMM yyyy", { locale: it })}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyLink(link.code)}
                          title="Copia link"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(`/configurator/${link.code}`, "_blank")}
                          title="Apri configuratore"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {link.submitted_at && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedLink(link)}
                            title="Dettagli"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog dettagli configurazione */}
      <Dialog open={!!selectedLink} onOpenChange={() => setSelectedLink(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Configurazione</DialogTitle>
            <DialogDescription>
              Richiesta del cliente per {selectedLink?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedLink && (
            <div className="space-y-6">
              {/* Informazioni Cliente */}
              <div>
                <h3 className="font-semibold mb-2">Cliente</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nome:</span>
                    <div className="font-medium">{selectedLink.customer_name}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span>
                    <div className="font-medium">{selectedLink.customer_email}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Telefono:</span>
                    <div className="font-medium">{selectedLink.customer_phone || "-"}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Azienda:</span>
                    <div className="font-medium">{selectedLink.customer_company || "-"}</div>
                  </div>
                </div>
              </div>

              {/* Configurazione Scelta */}
              <div>
                <h3 className="font-semibold mb-2">Configurazione Scelta</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Modello:</span>
                    <div className="font-medium">{selectedLink.selected_model}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Alimentazione:</span>
                    <div className="font-medium">{selectedLink.selected_power}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dimensione:</span>
                    <div className="font-medium">{selectedLink.selected_size}cm</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Installazione:</span>
                    <div className="font-medium">
                      {selectedLink.selected_installation === "shipping" ? "Spedizione" : "Montaggio in loco"}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Prezzo Totale:</span>
                    <div className="text-xl font-bold text-primary">
                      {formatAmount(selectedLink.total_price)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Note */}
              {selectedLink.notes && (
                <div>
                  <h3 className="font-semibold mb-2">Note</h3>
                  <p className="text-sm text-muted-foreground">{selectedLink.notes}</p>
                </div>
              )}

              {/* Azioni */}
              {selectedLink.status === "submitted" && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => updateStatusMutation.mutate({ id: selectedLink.id, status: "rejected" })}
                  >
                    Rifiuta
                  </Button>
                  <Button
                    onClick={() => updateStatusMutation.mutate({ id: selectedLink.id, status: "converted" })}
                  >
                    Converti in Ordine
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
