import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface CreatePriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreatePriceListDialog({ open, onOpenChange, onSuccess }: CreatePriceListDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    list_type: "country",
    country: "",
    region: "",
    customer_category: "",
    valid_from: "",
    valid_to: "",
  });
  const [items, setItems] = useState<Array<{ product_id: string; price: string; discount: string }>>([]);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, code, name, base_price")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addItem = () => {
    setItems([...items, { product_id: "", price: "", discount: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Create price list
      const { data: priceList, error: priceListError } = await supabase
        .from("price_lists")
        .insert([
          {
            code: formData.code,
            name: formData.name,
            description: formData.description || null,
            list_type: formData.list_type,
            country: formData.country || null,
            region: formData.region || null,
            customer_category: formData.customer_category || null,
            valid_from: formData.valid_from || null,
            valid_to: formData.valid_to || null,
          },
        ])
        .select()
        .single();

      if (priceListError) throw priceListError;

      // Add price list items
      if (items.length > 0) {
        const itemsToInsert = items
          .filter((item) => item.product_id && item.price)
          .map((item) => ({
            price_list_id: priceList.id,
            product_id: item.product_id,
            price: parseFloat(item.price),
            discount_percentage: item.discount ? parseFloat(item.discount) : 0,
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from("price_list_items")
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      toast.success("Listino creato con successo");
      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setFormData({
        code: "",
        name: "",
        description: "",
        list_type: "country",
        country: "",
        region: "",
        customer_category: "",
        valid_from: "",
        valid_to: "",
      });
      setItems([]);
    } catch (error: any) {
      console.error("Error creating price list:", error);
      toast.error(error.message || "Errore nella creazione del listino");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Listino</DialogTitle>
          <DialogDescription>
            Crea un nuovo listino prezzi e aggiungi i prodotti con i relativi prezzi
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="es. LIST-FR-2024"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="list_type">Tipo *</Label>
              <Select
                value={formData.list_type}
                onValueChange={(value) => setFormData({ ...formData, list_type: value })}
              >
                <SelectTrigger id="list_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="country">Paese</SelectItem>
                  <SelectItem value="region">Regione</SelectItem>
                  <SelectItem value="customer_category">Categoria Cliente</SelectItem>
                  <SelectItem value="reseller">Rivenditore</SelectItem>
                  <SelectItem value="custom">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="es. Listino Francia 2024"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione del listino"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Paese</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                placeholder="es. Francia"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="region">Regione</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                placeholder="es. Sud, Centro, Nord"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_category">Categoria Cliente</Label>
              <Input
                id="customer_category"
                value={formData.customer_category}
                onChange={(e) => setFormData({ ...formData, customer_category: e.target.value })}
                placeholder="es. Rivenditore A"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valid_from">Valido Dal</Label>
              <Input
                id="valid_from"
                type="date"
                value={formData.valid_from}
                onChange={(e) => setFormData({ ...formData, valid_from: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_to">Valido Fino Al</Label>
              <Input
                id="valid_to"
                type="date"
                value={formData.valid_to}
                onChange={(e) => setFormData({ ...formData, valid_to: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-3 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label>Prodotti e Prezzi</Label>
              <Button type="button" variant="outline" size="sm" onClick={addItem}>
                Aggiungi Prodotto
              </Button>
            </div>

            {items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prodotto</TableHead>
                    <TableHead>Prezzo (€)</TableHead>
                    <TableHead>Sconto (%)</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={item.product_id}
                          onValueChange={(value) => updateItem(index, "product_id", value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona..." />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.code} - {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.price}
                          onChange={(e) => updateItem(index, "price", e.target.value)}
                          placeholder="0.00"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.discount}
                          onChange={(e) => updateItem(index, "discount", e.target.value)}
                          placeholder="0"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeItem(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creazione..." : "Crea Listino"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
