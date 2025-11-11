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
    list_type: "generic",
    country: "",
    target_type: "cliente",
    tier: "M",
    default_multiplier: "1.5",
    valid_from: "",
    valid_to: "",
  });
  const [items, setItems] = useState<Array<{ 
    product_id: string; 
    cost: number;
    price: string; 
    discount: string;
    notes: string;
  }>>([]);

  const { data: products } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          id, 
          code, 
          name, 
          base_price,
          materials(cost)
        `)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const addItem = () => {
    setItems([...items, { product_id: "", cost: 0, price: "", discount: "", notes: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: string | number) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    // Se cambia il prodotto, aggiorna automaticamente il costo e calcola il prezzo
    if (field === "product_id" && value) {
      const product = products?.find(p => p.id === value);
      const cost = product?.materials?.cost || 0;
      const multiplier = parseFloat(formData.default_multiplier) || 1;
      const calculatedPrice = cost * multiplier;
      
      newItems[index].cost = cost;
      newItems[index].price = calculatedPrice.toFixed(2);
    }
    
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
            target_type: formData.target_type,
            tier: formData.tier,
            default_multiplier: parseFloat(formData.default_multiplier),
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
            cost_price: item.cost,
            discount_percentage: item.discount ? parseFloat(item.discount) : 0,
            notes: item.notes || null,
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
        list_type: "generic",
        country: "",
        target_type: "cliente",
        tier: "M",
        default_multiplier: "1.5",
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
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="es. LIST-IT-CLI-M"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="list_type">Ambito *</Label>
              <Select
                value={formData.list_type}
                onValueChange={(value) => setFormData({ ...formData, list_type: value })}
              >
                <SelectTrigger id="list_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generic">Generico</SelectItem>
                  <SelectItem value="country">Paese</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_multiplier">Moltiplicatore Default *</Label>
              <Input
                id="default_multiplier"
                type="number"
                step="0.01"
                value={formData.default_multiplier}
                onChange={(e) => setFormData({ ...formData, default_multiplier: e.target.value })}
                placeholder="1.5"
                required
              />
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
            {formData.list_type === "country" && (
              <div className="space-y-2">
                <Label htmlFor="country">Paese *</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                  placeholder="es. Italia, Francia"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="target_type">Target *</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value) => setFormData({ ...formData, target_type: value })}
              >
                <SelectTrigger id="target_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cliente">Cliente</SelectItem>
                  <SelectItem value="partner">Partner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tier">Categoria *</Label>
              <Select
                value={formData.tier}
                onValueChange={(value) => setFormData({ ...formData, tier: value })}
              >
                <SelectTrigger id="tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="T">Top (T)</SelectItem>
                  <SelectItem value="M">Medium (M)</SelectItem>
                  <SelectItem value="L">Low (L)</SelectItem>
                </SelectContent>
              </Select>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prodotto</TableHead>
                      <TableHead>Costo (€)</TableHead>
                      <TableHead>Molt.</TableHead>
                      <TableHead>Prezzo (€)</TableHead>
                      <TableHead>Sconto (%)</TableHead>
                      <TableHead>Note Sconto Max</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, index) => {
                      const multiplier = parseFloat(formData.default_multiplier) || 1;
                      return (
                        <TableRow key={index}>
                          <TableCell className="min-w-[200px]">
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
                              value={item.cost || ""}
                              readOnly
                              className="bg-muted"
                              placeholder="0.00"
                            />
                          </TableCell>
                          <TableCell>
                            <span className="text-sm font-medium">x{multiplier.toFixed(2)}</span>
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
                              className="w-20"
                            />
                          </TableCell>
                          <TableCell className="min-w-[200px]">
                            <Input
                              value={item.notes}
                              onChange={(e) => updateItem(index, "notes", e.target.value)}
                              placeholder="es. max 10%"
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
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
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
