import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Package, ListChecks, Pencil, Trash2 } from "lucide-react";
import { CreateProductDialog } from "@/components/crm/CreateProductDialog";
import { EditProductDialog } from "@/components/crm/EditProductDialog";
import { ProductPriceListDialog } from "@/components/crm/ProductPriceListDialog";
import { PriceListManager } from "@/components/crm/PriceListManager";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function ProductCatalogPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [priceListDialogOpen, setPriceListDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);

  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ["products", searchQuery, selectedType],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          *,
          materials(code, name),
          boms(name, code:name)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (searchQuery) {
        query = query.or(`name.ilike.%${searchQuery}%,code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      if (selectedType !== "all") {
        query = query.eq("product_type", selectedType);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const productTypes = [
    { value: "all", label: "Tutti" },
    { value: "machinery", label: "Macchinari" },
    { value: "component", label: "Componenti" },
    { value: "spare_part", label: "Ricambi" },
    { value: "service", label: "Servizi" },
  ];

  const typeColors: Record<string, string> = {
    machinery: "bg-blue-500",
    component: "bg-green-500",
    spare_part: "bg-yellow-500",
    service: "bg-purple-500",
  };

  const typeLabels: Record<string, string> = {
    machinery: "Macchinario",
    component: "Componente",
    spare_part: "Ricambio",
    service: "Servizio",
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await supabase
        .from("products")
        .update({ is_active: false })
        .eq("id", selectedProduct.id);

      if (error) throw error;

      toast.success("Prodotto eliminato con successo");
      setDeleteDialogOpen(false);
      setSelectedProduct(null);
      refetch();
    } catch (error: any) {
      console.error("Error deleting product:", error);
      toast.error(error.message || "Errore nell'eliminazione del prodotto");
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Anagrafica Prodotti</h1>
          <p className="text-muted-foreground">
            Gestisci il catalogo prodotti e i listini prezzi
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Prodotto
        </Button>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">
            <Package className="mr-2 h-4 w-4" />
            Prodotti
          </TabsTrigger>
          <TabsTrigger value="pricelists">
            <ListChecks className="mr-2 h-4 w-4" />
            Listini
          </TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ricerca e Filtri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca per nome, codice o descrizione..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {productTypes.map((type) => (
                  <Button
                    key={type.value}
                    variant={selectedType === type.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedType(type.value)}
                  >
                    {type.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              <div className="col-span-full text-center py-12">
                <p className="text-muted-foreground">Caricamento...</p>
              </div>
            ) : products && products.length > 0 ? (
              products.map((product) => (
                <Card key={product.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{product.name}</CardTitle>
                        <CardDescription className="mt-1">
                          Codice: {product.code}
                        </CardDescription>
                      </div>
                      <Badge className={typeColors[product.product_type]}>
                        {typeLabels[product.product_type]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {product.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>
                    )}

                    {product.base_price && (
                      <div className="flex items-center justify-between pt-2 border-t">
                        <span className="text-sm font-medium">Prezzo base:</span>
                        <span className="text-lg font-bold">
                          € {Number(product.base_price).toFixed(2)}
                        </span>
                      </div>
                    )}

                    {(product.materials || product.boms) && (
                      <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        {product.materials && (
                          <div>Materiale: {product.materials.name}</div>
                        )}
                        {product.boms && (
                          <div>BOM: {product.boms.name}</div>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setEditDialogOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProduct(product);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setSelectedProduct(product);
                          setPriceListDialogOpen(true);
                        }}
                      >
                        <ListChecks className="mr-2 h-4 w-4" />
                        Listini
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Package className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  Nessun prodotto trovato
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pricelists">
          <PriceListManager />
        </TabsContent>
      </Tabs>

      <CreateProductDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={refetch}
      />

      {selectedProduct && (
        <>
          <EditProductDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            product={selectedProduct}
            onSuccess={refetch}
          />
          
          <ProductPriceListDialog
            open={priceListDialogOpen}
            onOpenChange={setPriceListDialogOpen}
            product={selectedProduct}
            onSuccess={refetch}
          />
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare il prodotto "{selectedProduct?.name}"? 
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduct}>
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
