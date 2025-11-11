import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface EditPriceListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceListId: string;
  onSuccess?: () => void;
}

export function EditPriceListDialog({
  open,
  onOpenChange,
  priceListId,
  onSuccess,
}: EditPriceListDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<Array<{ 
    id?: string;
    product_id: string; 
    cost: number;
    price: string; 
    discount: string;
    notes: string;
  }>>([]);

  const { data: priceList, isLoading } = useQuery({
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
    enabled: open,
  });

  const { data: existingItems } = useQuery({
    queryKey: ["price-list-items", priceListId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_list_items")
        .select(`
          id,
          product_id,
          price,
          cost_price,
          discount_percentage,
          notes,
          products:product_id (
            id,
            code,
            name,
            materials(cost)
          )
        `)
        .eq("price_list_id", priceListId);

      if (error) throw error;
      return data;
    },
    enabled: open && !!priceListId,
  });

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    list_type: "generic",
    target_type: "",
    tier: "",
    default_multiplier: "",
    country: "",
    valid_from: "",
    valid_to: "",
  });

  // Update form data when priceList is loaded
  useEffect(() => {
    if (priceList) {
      setFormData({
        name: priceList.name || "",
        code: priceList.code || "",
        description: priceList.description || "",
        list_type: priceList.list_type || "generic",
        target_type: priceList.target_type || "",
        tier: priceList.tier || "",
        default_multiplier: priceList.default_multiplier?.toString() || "",
        country: priceList.country || "",
        valid_from: priceList.valid_from || "",
        valid_to: priceList.valid_to || "",
      });
    }
  }, [priceList]);

  // Load existing items
  useEffect(() => {
    if (existingItems) {
      setItems(existingItems.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        cost: item.cost_price || 0,
        price: item.price?.toString() || "",
        discount: item.discount_percentage?.toString() || "",
        notes: item.notes || "",
      })));
    }
  }, [existingItems]);

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

  const handleSave = async () => {
    if (!formData.name || !formData.code) {
      toast.error("Nome e codice sono obbligatori");
      return;
    }

    setIsSaving(true);
    try {
      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Prepare update data
      const updateData: any = {
        name: formData.name,
        code: formData.code,
        description: formData.description || null,
        list_type: formData.list_type,
        target_type: formData.target_type || null,
        tier: formData.tier || null,
        default_multiplier: formData.default_multiplier
          ? parseFloat(formData.default_multiplier)
          : null,
        country: formData.country || null,
        valid_from: formData.valid_from || null,
        valid_to: formData.valid_to || null,
      };

      // Update price list
      const { error: updateError } = await supabase
        .from("price_lists")
        .update(updateData)
        .eq("id", priceListId);

      if (updateError) throw updateError;

      // Handle price list items
      // 1. Delete items that are no longer present
      const existingItemIds = existingItems?.map(item => item.id) || [];
      const currentItemIds = items.filter(item => item.id).map(item => item.id);
      const itemsToDelete = existingItemIds.filter(id => !currentItemIds.includes(id));
      
      if (itemsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from("price_list_items")
          .delete()
          .in("id", itemsToDelete);
        
        if (deleteError) throw deleteError;
      }

      // 2. Update existing items and insert new ones
      for (const item of items) {
        if (!item.product_id || !item.price) continue;

        const itemData = {
          price_list_id: priceListId,
          product_id: item.product_id,
          price: parseFloat(item.price),
          cost_price: item.cost,
          discount_percentage: item.discount ? parseFloat(item.discount) : 0,
          notes: item.notes || null,
        };

        if (item.id) {
          // Update existing item
          const { error: updateItemError } = await supabase
            .from("price_list_items")
            .update(itemData)
            .eq("id", item.id);
          
          if (updateItemError) throw updateItemError;
        } else {
          // Insert new item
          const { error: insertItemError } = await supabase
            .from("price_list_items")
            .insert(itemData);
          
          if (insertItemError) throw insertItemError;
        }
      }

      // Create audit log
      const changedFields: string[] = [];
      const oldValues: any = {};
      const newValues: any = {};

      Object.keys(updateData).forEach((key) => {
        if (priceList && priceList[key] !== updateData[key]) {
          changedFields.push(key);
          oldValues[key] = priceList[key];
          newValues[key] = updateData[key];
        }
      });

      if (changedFields.length > 0 || items.length !== existingItems?.length) {
        await supabase.from("price_list_audit_logs").insert({
          price_list_id: priceListId,
          user_id: user?.id,
          action: "updated",
          old_values: oldValues,
          new_values: newValues,
          changed_fields: changedFields,
        });
      }

      toast.success("Listino aggiornato con successo");
      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error updating price list:", error);
      toast.error(error.message || "Errore nell'aggiornamento del listino");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || !priceList) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Caricamento...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Listino</DialogTitle>
          <DialogDescription>
            Modifica i dettagli del listino prezzi e gestisci i prodotti associati
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="es. LIST-IT-CLI-M"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="list_type">Ambito *</Label>
              <Select
                value={formData.list_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, list_type: value })
                }
              >
                <SelectTrigger>
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
                min="0"
                value={formData.default_multiplier}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_multiplier: e.target.value,
                  })
                }
                placeholder="1.5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="es. Listino Francia 2024"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
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
                  onChange={(e) =>
                    setFormData({ ...formData, country: e.target.value })
                  }
                  placeholder="es. Italia, Francia"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="target_type">Target *</Label>
              <Select
                value={formData.target_type}
                onValueChange={(value) =>
                  setFormData({ ...formData, target_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona target" />
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
                onValueChange={(value) =>
                  setFormData({ ...formData, tier: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tier" />
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
                onChange={(e) =>
                  setFormData({ ...formData, valid_from: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="valid_to">Valido Fino Al</Label>
              <Input
                id="valid_to"
                type="date"
                value={formData.valid_to}
                onChange={(e) =>
                  setFormData({ ...formData, valid_to: e.target.value })
                }
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

            {items.length > 0 ? (
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
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Nessun prodotto nel listino. Clicca su "Aggiungi Prodotto" per iniziare.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}