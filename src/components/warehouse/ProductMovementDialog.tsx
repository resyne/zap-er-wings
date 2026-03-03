import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Product {
  id: string;
  code: string;
  name: string;
  unit_of_measure: string | null;
  current_stock: number;
}

interface ProductMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: "carico" | "scarico";
  products: Product[];
}

export function ProductMovementDialog({ open, onOpenChange, movementType, products }: ProductMovementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedProductId("");
      setQuantity("");
      setNotes("");
    }
  }, [open]);

  const isCarico = movementType === "carico";
  const selectedProduct = products.find(p => p.id === selectedProductId);

  const handleSave = async () => {
    if (!selectedProductId || !quantity || Number(quantity) <= 0) {
      toast({ title: "Compila tutti i campi", variant: "destructive" });
      return;
    }

    const qty = Number(quantity);
    if (!isCarico && selectedProduct && qty > selectedProduct.current_stock) {
      toast({ title: "Quantità insufficiente in magazzino", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non autenticato");

      // Insert movement
      const { error: movError } = await supabase
        .from("product_stock_movements")
        .insert({
          product_id: selectedProductId,
          movement_type: movementType,
          quantity: qty,
          unit: selectedProduct?.unit_of_measure || "pz",
          notes: notes || null,
          created_by: userData.user.id,
        });
      if (movError) throw movError;

      // Update product stock
      const newStock = isCarico
        ? (selectedProduct?.current_stock || 0) + qty
        : (selectedProduct?.current_stock || 0) - qty;

      const { error: updateError } = await supabase
        .from("products")
        .update({ current_stock: newStock })
        .eq("id", selectedProductId);
      if (updateError) throw updateError;

      toast({ title: `${isCarico ? "Carico" : "Scarico"} registrato` });
      queryClient.invalidateQueries({ queryKey: ["zapp-products"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-product-movements"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCarico ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
            {isCarico ? "Carico Prodotto" : "Scarico Prodotto"}
          </DialogTitle>
          <DialogDescription>
            {isCarico ? "Registra prodotti finiti in magazzino" : "Scarica prodotti dal magazzino"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Prodotto</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona prodotto..." />
              </SelectTrigger>
              <SelectContent>
                {products.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.current_stock} {p.unit_of_measure || "pz"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Quantità</Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Es. 5"
            />
          </div>

          <div>
            <Label>Note (opzionale)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Aggiungi note..."
              rows={2}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving || !selectedProductId || !quantity}
            className={`w-full ${isCarico ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {isCarico ? "Registra Carico" : "Registra Scarico"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
