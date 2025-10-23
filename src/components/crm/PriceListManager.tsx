import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2 } from "lucide-react";
import { CreatePriceListDialog } from "./CreatePriceListDialog";
import { toast } from "sonner";

export function PriceListManager() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: priceLists, isLoading, refetch } = useQuery({
    queryKey: ["price-lists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const typeLabels: Record<string, string> = {
    country: "Paese",
    region: "Regione",
    customer_category: "Categoria Cliente",
    reseller: "Rivenditore",
    custom: "Personalizzato",
  };

  const typeColors: Record<string, string> = {
    country: "bg-blue-500",
    region: "bg-green-500",
    customer_category: "bg-purple-500",
    reseller: "bg-orange-500",
    custom: "bg-gray-500",
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo listino?")) return;

    try {
      const { error } = await supabase
        .from("price_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Listino eliminato con successo");
      refetch();
    } catch (error: any) {
      console.error("Error deleting price list:", error);
      toast.error(error.message || "Errore nell'eliminazione del listino");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Gestione Listini</h2>
          <p className="text-muted-foreground">
            Crea e gestisci i listini prezzi per paese, regione o categoria cliente
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Listino
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        ) : priceLists && priceLists.length > 0 ? (
          priceLists.map((priceList) => (
            <Card key={priceList.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{priceList.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {priceList.code}
                    </CardDescription>
                  </div>
                  <Badge className={typeColors[priceList.list_type]}>
                    {typeLabels[priceList.list_type]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {priceList.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {priceList.description}
                  </p>
                )}

                <div className="space-y-1 text-sm">
                  {priceList.country && (
                    <div>
                      <span className="font-medium">Paese:</span> {priceList.country}
                    </div>
                  )}
                  {priceList.region && (
                    <div>
                      <span className="font-medium">Regione:</span> {priceList.region}
                    </div>
                  )}
                  {priceList.customer_category && (
                    <div>
                      <span className="font-medium">Categoria:</span> {priceList.customer_category}
                    </div>
                  )}
                </div>

                {priceList.valid_from && (
                  <div className="text-sm text-muted-foreground pt-2 border-t">
                    Valido dal: {new Date(priceList.valid_from).toLocaleDateString("it-IT")}
                    {priceList.valid_to && (
                      <> al {new Date(priceList.valid_to).toLocaleDateString("it-IT")}</>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-3">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(priceList.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">
              Nessun listino trovato. Crea il tuo primo listino!
            </p>
          </div>
        )}
      </div>

      <CreatePriceListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refetch}
      />
    </div>
  );
}
