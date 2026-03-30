import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Package, Building2, Layers, Calendar, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Material {
  id: string;
  code: string;
  name: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  maximum_stock: number;
  supplier_id?: string;
  suppliers?: { name: string } | null;
  last_inventory_date?: string | null;
}

interface MaterialDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  material: Material | null;
  warehouseCategories: { id: string; name: string; sort_order: number }[];
  warehouseSubcategories: { id: string; category_id: string; name: string; supplier_id?: string | null; sort_order: number }[];
}

export function MaterialDetailDialog({ open, onOpenChange, material, warehouseCategories, warehouseSubcategories }: MaterialDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string>("");

  if (!material) return null;

  // Find current category mapping via supplier
  const currentSub = warehouseSubcategories.find(s => s.supplier_id === material.supplier_id);
  const currentCat = currentSub ? warehouseCategories.find(c => c.id === currentSub.category_id) : null;

  const isLow = material.current_stock <= material.minimum_stock && material.current_stock > 0;
  const isOut = material.current_stock <= 0;
  const isExcess = material.current_stock >= material.maximum_stock;
  const stockPercent = material.maximum_stock > 0 ? Math.min((material.current_stock / material.maximum_stock) * 100, 100) : 0;

  const handleReassignSupplier = async () => {
    if (!selectedSubcategory || !material.supplier_id) return;
    setSaving(true);
    // Move the supplier to the selected subcategory
    // First remove from old subcategory
    const { error: removeError } = await supabase
      .from("warehouse_subcategories")
      .update({ supplier_id: null })
      .eq("supplier_id", material.supplier_id);

    if (removeError) {
      toast({ title: "Errore", variant: "destructive" });
      setSaving(false);
      return;
    }

    // Set the new subcategory's supplier_id
    const { error } = await supabase
      .from("warehouse_subcategories")
      .update({ supplier_id: material.supplier_id })
      .eq("id", selectedSubcategory);

    setSaving(false);
    if (error) {
      toast({ title: "Errore", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria aggiornata" });
    queryClient.invalidateQueries({ queryKey: ["warehouse-subcategories"] });
    queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
    setSelectedSubcategory("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className={`h-5 w-5 ${isOut ? "text-destructive" : isLow ? "text-amber-500" : "text-green-600"}`} />
            {material.name}
          </DialogTitle>
          <DialogDescription>{material.code}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stock info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Giacenza attuale</span>
              <span className="font-bold text-lg">{material.current_stock} {material.unit}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${isOut ? "bg-destructive" : isLow ? "bg-amber-500" : isExcess ? "bg-blue-500" : "bg-green-500"}`}
                style={{ width: `${stockPercent}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Min: {material.minimum_stock}</span>
              <span>Max: {material.maximum_stock}</span>
            </div>
            <div className="flex justify-end">
              {isOut ? (
                <Badge variant="destructive" className="text-[10px]">Esaurito</Badge>
              ) : isLow ? (
                <Badge variant="destructive" className="text-[10px]">Sotto scorta</Badge>
              ) : isExcess ? (
                <Badge variant="secondary" className="text-[10px]">Eccesso</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-green-700 border-green-300">OK</Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Supplier */}
          {material.suppliers?.name && (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fornitore:</span>
              <span className="text-sm font-medium">{material.suppliers.name}</span>
            </div>
          )}

          {/* Current category */}
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Categoria:</span>
            <span className="text-sm font-medium">
              {currentCat ? `${currentCat.name} → ${currentSub?.name}` : "Non assegnata"}
            </span>
          </div>

          {/* Last inventory */}
          {material.last_inventory_date && (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Ultimo inventario:</span>
              <span className="text-sm font-medium">
                {format(new Date(material.last_inventory_date), "dd MMM yyyy", { locale: it })}
              </span>
            </div>
          )}

          <Separator />

          {/* Reassign category */}
          {material.supplier_id && warehouseSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Sposta in sottocategoria</Label>
              <div className="flex gap-2">
                <Select value={selectedSubcategory} onValueChange={setSelectedSubcategory}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseCategories.map(cat => (
                      <React.Fragment key={cat.id}>
                        <SelectItem value={`__header_${cat.id}`} disabled className="font-bold text-xs text-muted-foreground">
                          {cat.name}
                        </SelectItem>
                        {warehouseSubcategories.filter(s => s.category_id === cat.id).map(sub => (
                          <SelectItem key={sub.id} value={sub.id} className="pl-6">
                            {sub.name}
                          </SelectItem>
                        ))}
                      </React.Fragment>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  size="sm"
                  onClick={handleReassignSupplier}
                  disabled={!selectedSubcategory || saving || selectedSubcategory.startsWith("__header_")}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Nota: sposta tutti i materiali di questo fornitore nella sottocategoria selezionata.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
