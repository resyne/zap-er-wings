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
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface ViewPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
}

export function ViewPriceListDialog({
  open,
  onOpenChange,
  priceListId,
}: ViewPriceListDialogProps) {
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

  const { data: items, isLoading: isLoadingItems } = useQuery({
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
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!items || items.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Esporta Excel
            </Button>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : (
          <div className="space-y-6">
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
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
