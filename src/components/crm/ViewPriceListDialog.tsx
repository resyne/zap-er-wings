import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Edit, History } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { EditPriceListDialog } from "./EditPriceListDialog";
import { formatAmount } from "@/lib/formatAmount";

interface ViewPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
  onSuccess?: () => void;
}

export function ViewPriceListDialog({
  open,
  onOpenChange,
  priceListId,
  onSuccess,
}: ViewPriceListDialogProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { data: priceList, isLoading: isLoadingList } = useQuery({
    queryKey: ["price-list", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .eq("id", priceListId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: open && !!priceListId,
  });

  const { data: items, isLoading: isLoadingItems, refetch: refetchItems } = useQuery({
    queryKey: ["price-list-items", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select(`
          *,
          product:products(name, code)
        `)
        .eq("price_list_id", priceListId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!priceListId,
  });

  const { data: auditLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["price-list-audit-logs", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_audit_logs")
        .select("*")
        .eq("price_list_id", priceListId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open && !!priceListId,
  });

  const typeLabels: Record<string, string> = {
    generic: "Generico",
    country: "Paese",
    region: "Regione",
    customer_category: "Categoria Cliente",
    reseller: "Rivenditore",
    custom: "Personalizzato",
  };

  const tierLabels: Record<string, string> = {
    T: "Top",
    M: "Medium",
    L: "Low",
  };

  const handleExport = () => {
    if (!priceList || !items) {
      toast.error("Dati non disponibili per l'esportazione");
      return;
    }

    const exportData = items.map((item) => ({
      "Codice Prodotto": item.product?.code || "-",
      "Nome Prodotto": item.product?.name || "-",
      "Costo Materiale": item.cost_price
        ? `€ ${Number(item.cost_price).toFixed(2)}`
        : "-",
      "Prezzo Listino": item.price
        ? `€ ${Number(item.price).toFixed(2)}`
        : "-",
      "Sconto %": item.discount_percentage ? `${Number(item.discount_percentage).toFixed(2)}%` : "-",
      "Quantità Minima": item.minimum_quantity || "-",
      "Note Sconto": item.notes || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Listino");

    // Imposta larghezza colonne
    const colWidths = [
      { wch: 15 }, // Codice
      { wch: 30 }, // Nome
      { wch: 15 }, // Costo
      { wch: 15 }, // Prezzo
      { wch: 10 }, // Sconto
      { wch: 12 }, // Qta Min
      { wch: 40 }, // Note
    ];
    worksheet["!cols"] = colWidths;

    const fileName = `Listino_${priceList.code}_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast.success("Listino esportato con successo");
  };

  const handleEditSuccess = () => {
    refetchItems();
    onSuccess?.();
  };

  const isLoading = isLoadingList || isLoadingItems;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-2xl">
                {priceList?.name || "Dettagli Listino"}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {priceList?.code}
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Modifica
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={!items || items.length === 0}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Esporta
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : (
          <Tabs defaultValue="details" className="space-y-6">
            <TabsList>
              <TabsTrigger value="details">Dettagli</TabsTrigger>
              <TabsTrigger value="logs">
                <History className="mr-2 h-4 w-4" />
                Storico Modifiche
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-6">
            {priceList && (
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      <Badge className="mt-1">
                        {typeLabels[priceList.list_type]}
                      </Badge>
                    </div>
                    {priceList.target_type && (
                      <div>
                        <p className="text-sm text-muted-foreground">Target</p>
                        <Badge variant="outline" className="mt-1">
                          {priceList.target_type === "cliente"
                            ? "Cliente"
                            : "Partner"}{" "}
                          {priceList.tier && `- ${tierLabels[priceList.tier]}`}
                        </Badge>
                      </div>
                    )}
                    {priceList.default_multiplier && (
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Moltiplicatore Default
                        </p>
                        <Badge variant="secondary" className="mt-1">
                          x{Number(priceList.default_multiplier).toFixed(2)}
                        </Badge>
                      </div>
                    )}
                    {priceList.country && (
                      <div>
                        <p className="text-sm text-muted-foreground">Paese</p>
                        <p className="mt-1 font-medium">{priceList.country}</p>
                      </div>
                    )}
                  </div>
                  {priceList.description && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Descrizione
                      </p>
                      <p className="mt-1">{priceList.description}</p>
                    </div>
                  )}
                  {priceList.valid_from && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground">
                        Validità
                      </p>
                      <p className="mt-1">
                        Dal{" "}
                        {new Date(priceList.valid_from).toLocaleDateString(
                          "it-IT"
                        )}
                        {priceList.valid_to && (
                          <>
                            {" "}
                            al{" "}
                            {new Date(priceList.valid_to).toLocaleDateString(
                              "it-IT"
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <div>
              <h3 className="text-lg font-semibold mb-4">Prodotti nel Listino</h3>
              {items && items.length > 0 ? (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Codice</TableHead>
                          <TableHead>Prodotto</TableHead>
                          <TableHead className="text-right">Costo</TableHead>
                          <TableHead className="text-right">
                            Prezzo Listino
                          </TableHead>
                          <TableHead className="text-right">Sconto %</TableHead>
                          <TableHead className="text-right">Qta Min</TableHead>
                          <TableHead>Note Sconto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="font-mono text-sm">
                              {item.product?.code || "-"}
                            </TableCell>
                            <TableCell>{item.product?.name || "-"}</TableCell>
                            <TableCell className="text-right">
                              {item.cost_price
                                ? `€ ${Number(item.cost_price).toFixed(2)}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.price
                                ? `€ ${Number(item.price).toFixed(2)}`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.discount_percentage
                                ? `${Number(item.discount_percentage).toFixed(2)}%`
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.minimum_quantity || "-"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {item.notes || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center">
                    <p className="text-muted-foreground">
                      Nessun prodotto nel listino
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">Storico Modifiche</h3>
                {isLoadingLogs ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Caricamento...</p>
                  </div>
                ) : auditLogs && auditLogs.length > 0 ? (
                  <div className="space-y-4">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="border-l-2 border-primary pl-4 py-2"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                log.action === "created"
                                  ? "default"
                                  : log.action === "updated"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {log.action === "created"
                                ? "Creato"
                                : log.action === "updated"
                                ? "Modificato"
                                : "Eliminato"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {log.user_id ? "Utente" : "Sistema"}
                            </span>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleString("it-IT")}
                          </span>
                        </div>

                        {log.changed_fields && log.changed_fields.length > 0 && (
                          <div className="text-sm space-y-1">
                            <p className="font-medium">Campi modificati:</p>
                            {log.changed_fields.map((field) => (
                              <div key={field} className="ml-4">
                                <span className="text-muted-foreground">
                                  {field}:
                                </span>
                                <div className="ml-2">
                                  <span className="line-through text-muted-foreground">
                                    {formatFieldValue(field, log.old_values?.[field])}
                                  </span>
                                  {" → "}
                                  <span className="text-foreground font-medium">
                                    {formatFieldValue(field, log.new_values?.[field])}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">
                      Nessuna modifica registrata
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        )}
      </DialogContent>

      {editDialogOpen && (
        <EditPriceListDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          priceListId={priceListId}
          onSuccess={handleEditSuccess}
        />
      )}
    </Dialog>
  );
}

function formatFieldValue(field: string, value: any): string {
  if (value === null || value === undefined) return "-";
  
  if (field === "default_multiplier") {
    return `x${Number(value).toFixed(2)}`;
  }
  
  if (field === "valid_from" || field === "valid_to") {
    return new Date(value).toLocaleDateString("it-IT");
  }
  
  return String(value);
}
