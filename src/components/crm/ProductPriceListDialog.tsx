import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ProductPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSuccess?: () => void;
}

export function ProductPriceListDialog({ open, onOpenChange, product }: ProductPriceListDialogProps) {
  const { data: priceListItems, isLoading } = useQuery({
    queryKey: ["price-list-items", product?.id],
    queryFn: async () => {
      if (!product?.id) return [];
      
      const { data, error } = await supabase
        .from("price_list_items")
        .select(`
          *,
          price_lists(*)
        `)
        .eq("product_id", product.id);

      if (error) throw error;
      return data;
    },
    enabled: !!product?.id,
  });

  const typeLabels: Record<string, string> = {
    country: "Paese",
    region: "Regione",
    customer_category: "Categoria Cliente",
    reseller: "Rivenditore",
    custom: "Personalizzato",
  };

  const getListTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      country: "bg-blue-500",
      region: "bg-green-500",
      customer_category: "bg-purple-500",
      reseller: "bg-orange-500",
      custom: "bg-gray-500",
    };
    return <Badge className={colors[type]}>{typeLabels[type]}</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Listini - {product?.name}</DialogTitle>
          <DialogDescription>
            Codice: {product?.code} | Prezzo base: € {Number(product?.base_price || 0).toFixed(2)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Caricamento listini...</p>
            </div>
          ) : priceListItems && priceListItems.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Prezzi per Listino</CardTitle>
                <CardDescription>
                  Visualizza i prezzi configurati per questo prodotto in diversi listini
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Listino</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Dettagli</TableHead>
                      <TableHead className="text-right">Prezzo</TableHead>
                      <TableHead className="text-right">Sconto</TableHead>
                      <TableHead className="text-right">Q.tà Min</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {priceListItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">
                          {item.price_lists.name}
                        </TableCell>
                        <TableCell>
                          {getListTypeBadge(item.price_lists.list_type)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.price_lists.country && `Paese: ${item.price_lists.country}`}
                          {item.price_lists.region && `Regione: ${item.price_lists.region}`}
                          {item.price_lists.customer_category && `Categoria: ${item.price_lists.customer_category}`}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          € {Number(item.price).toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.discount_percentage ? `${item.discount_percentage}%` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.minimum_quantity || 1}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground">
                  Nessun listino configurato per questo prodotto
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
