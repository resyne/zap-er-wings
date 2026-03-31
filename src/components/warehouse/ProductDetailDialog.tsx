import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Box, MapPin, Euro, Layers, Calendar, Save, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ProductDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any | null;
  categories: { id: string; name: string; sort_order: number }[];
  subcategories: { id: string; category_id: string; name: string; sort_order: number }[];
}

export function ProductDetailDialog({ open, onOpenChange, product, categories, subcategories }: ProductDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [selectedSub, setSelectedSub] = useState<string>("");

  if (!product) return null;

  const currentCat = categories.find(c => c.id === product.product_category_id);
  const currentSub = subcategories.find(s => s.id === product.product_subcategory_id);
  const filteredSubs = subcategories.filter(s => s.category_id === (selectedCat || product.product_category_id));

  const isLow = product.current_stock <= (product.minimum_stock || 0) && product.current_stock > 0;
  const isOut = product.current_stock <= 0;
  const maxStock = product.maximum_stock || 100;
  const stockPercent = Math.min((product.current_stock / maxStock) * 100, 100);

  const handleSave = async () => {
    const catId = selectedCat || product.product_category_id;
    if (!catId) return;
    setSaving(true);
    const { error } = await supabase.from("products").update({
      product_category_id: catId,
      product_subcategory_id: selectedSub || null,
    }).eq("id", product.id);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria aggiornata" });
    queryClient.invalidateQueries({ queryKey: ["zapp-products"] });
    setSelectedCat("");
    setSelectedSub("");
  };

  const handleRemoveCategory = async () => {
    setSaving(true);
    const { error } = await supabase.from("products").update({
      product_category_id: null,
      product_subcategory_id: null,
    }).eq("id", product.id);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria rimossa" });
    queryClient.invalidateQueries({ queryKey: ["zapp-products"] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className={`h-5 w-5 ${isOut ? "text-destructive" : isLow ? "text-amber-500" : "text-primary"}`} />
            {product.name}
          </DialogTitle>
          <DialogDescription>{product.code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stock info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Giacenza attuale</span>
              <span className="font-bold text-lg">{product.current_stock} {product.unit_of_measure || "pz"}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isOut ? "bg-destructive" : isLow ? "bg-amber-500" : "bg-green-500"}`}
                style={{ width: `${stockPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Min: {product.minimum_stock || 0}</span>
              <span>Max: {product.maximum_stock || "—"}</span>
            </div>
            <div className="flex justify-end">
              {isOut ? (
                <Badge variant="destructive" className="text-[10px]">Esaurito</Badge>
              ) : isLow ? (
                <Badge variant="destructive" className="text-[10px]">Sotto scorta</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">OK</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Details */}
          {product.warehouse_location && (
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ubicazione:</span>
              <span className="text-sm font-medium">{product.warehouse_location}</span>
            </div>
          )}

          {(product.sale_price || 0) > 0 && (
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Prezzo vendita:</span>
              <span className="text-sm font-medium">€ {Number(product.sale_price).toLocaleString("it-IT")}</span>
            </div>
          )}

          {(product.production_cost || 0) > 0 && (
            <div className="flex items-center gap-2">
              <Euro className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Costo produzione:</span>
              <span className="text-sm font-medium">€ {Number(product.production_cost).toLocaleString("it-IT")}</span>
            </div>
          )}

          {product.last_inventory_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ultimo inventario:</span>
              <span className="text-sm font-medium">
                {format(new Date(product.last_inventory_date), "dd MMM yyyy", { locale: it })}
              </span>
            </div>
          )}

          {/* Current category */}
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Categoria:</span>
            <span className="text-sm font-medium">
              {currentCat ? `${currentCat.name}${currentSub ? ` → ${currentSub.name}` : ""}` : "Non assegnata"}
            </span>
            {currentCat && (
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive" onClick={handleRemoveCategory} disabled={saving}>
                Rimuovi
              </Button>
            )}
          </div>

          <Separator />

          {/* Category assignment */}
          {categories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{currentCat ? "Cambia categoria" : "Assegna categoria"}</Label>
              <div className="space-y-2">
                <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {filteredSubs.length > 0 && (
                  <Select value={selectedSub} onValueChange={setSelectedSub}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sottocategoria (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSubs.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleSave}
                disabled={!selectedCat || saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                {currentCat ? "Aggiorna categoria" : "Assegna categoria"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
