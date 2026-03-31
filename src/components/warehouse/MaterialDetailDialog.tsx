import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Package, Building2, Layers, Calendar, Save, Loader2, TrendingUp, TrendingDown } from "lucide-react";
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
  warehouse_category_id?: string | null;
  warehouse_subcategory_id?: string | null;
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
  const [selectedCat, setSelectedCat] = useState<string>("");
  const [movementMode, setMovementMode] = useState<"carico" | "scarico" | null>(null);
  const [movementQty, setMovementQty] = useState("");
  const [movementNotes, setMovementNotes] = useState("");
  const [movementSaving, setMovementSaving] = useState(false);
  const [selectedSub, setSelectedSub] = useState<string>("");

  if (!material) return null;

  // Current category - from direct assignment or from supplier mapping
  const directCat = warehouseCategories.find(c => c.id === material.warehouse_category_id);
  const directSub = warehouseSubcategories.find(s => s.id === material.warehouse_subcategory_id);
  const supplierSub = warehouseSubcategories.find(s => s.supplier_id === material.supplier_id);
  const supplierCat = supplierSub ? warehouseCategories.find(c => c.id === supplierSub.category_id) : null;

  const currentCat = directCat || supplierCat;
  const currentSub = directSub || supplierSub;

  const filteredSubs = warehouseSubcategories.filter(s => s.category_id === selectedCat);

  const isLow = material.current_stock <= material.minimum_stock && material.current_stock > 0;
  const isOut = material.current_stock <= 0;
  const isExcess = material.current_stock >= material.maximum_stock;
  const stockPercent = material.maximum_stock > 0 ? Math.min((material.current_stock / material.maximum_stock) * 100, 100) : 0;

  const handleSave = async () => {
    if (!selectedCat) return;
    setSaving(true);
    const { error } = await supabase.from("materials").update({
      warehouse_category_id: selectedCat,
      warehouse_subcategory_id: selectedSub || null,
    }).eq("id", material.id);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria aggiornata" });
    queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
    setSelectedCat("");
    setSelectedSub("");
  };

  const handleRemoveCategory = async () => {
    setSaving(true);
    const { error } = await supabase.from("materials").update({
      warehouse_category_id: null,
      warehouse_subcategory_id: null,
    }).eq("id", material.id);
    setSaving(false);
    if (error) {
      toast({ title: "Errore", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria rimossa" });
    queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
  };

  const handleMovement = async () => {
    if (!movementMode || !movementQty || Number(movementQty) <= 0) return;
    const qty = Number(movementQty);
    if (movementMode === "scarico" && qty > material.current_stock) {
      toast({ title: "Quantità insufficiente", variant: "destructive" });
      return;
    }
    setMovementSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Non autenticato");
      const { error: movError } = await supabase.from("stock_movements").insert({
        material_id: material.id,
        item_description: material.name,
        movement_type: movementMode,
        quantity: qty,
        unit: material.unit,
        origin_type: "manuale",
        status: "confermato",
        notes: movementNotes || null,
        created_by: userData.user.id,
        supplier_id: material.supplier_id || null,
      });
      if (movError) throw movError;
      const newStock = movementMode === "carico" ? material.current_stock + qty : material.current_stock - qty;
      const { error: upErr } = await supabase.from("materials").update({ current_stock: newStock }).eq("id", material.id);
      if (upErr) throw upErr;
      toast({ title: `${movementMode === "carico" ? "Carico" : "Scarico"} registrato` });
      queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-movements"] });
      setMovementMode(null);
      setMovementQty("");
      setMovementNotes("");
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setMovementSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Quick movement buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => { setMovementMode("carico"); setMovementQty(""); setMovementNotes(""); }}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1" /> Carico
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              onClick={() => { setMovementMode("scarico"); setMovementQty(""); setMovementNotes(""); }}
            >
              <TrendingDown className="h-3.5 w-3.5 mr-1" /> Scarico
            </Button>
          </div>

          {/* Movement form */}
          {movementMode && (
            <div className="bg-muted/50 rounded-lg p-3 space-y-3 border border-border">
              <p className="text-sm font-semibold flex items-center gap-1.5">
                {movementMode === "carico" ? <TrendingUp className="h-4 w-4 text-green-600" /> : <TrendingDown className="h-4 w-4 text-red-600" />}
                {movementMode === "carico" ? "Carico" : "Scarico"} - {material.name}
              </p>
              <div className="space-y-2">
                <Label className="text-xs">Quantità ({material.unit})</Label>
                <Input
                  type="number"
                  min="1"
                  value={movementQty}
                  onChange={(e) => setMovementQty(e.target.value)}
                  placeholder="Quantità..."
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Note (opzionale)</Label>
                <Textarea
                  value={movementNotes}
                  onChange={(e) => setMovementNotes(e.target.value)}
                  placeholder="Note..."
                  className="min-h-[60px]"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => setMovementMode(null)} disabled={movementSaving}>
                  Annulla
                </Button>
                <Button
                  size="sm"
                  className={`flex-1 ${movementMode === "carico" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"} text-white`}
                  onClick={handleMovement}
                  disabled={!movementQty || Number(movementQty) <= 0 || movementSaving}
                >
                  {movementSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Conferma
                </Button>
              </div>
            </div>
          )}

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
              {currentCat ? `${currentCat.name}${currentSub ? ` → ${currentSub.name}` : ""}` : "Non assegnata"}
            </span>
            {directCat && (
              <Button variant="ghost" size="sm" className="h-6 text-[11px] text-destructive hover:text-destructive" onClick={handleRemoveCategory} disabled={saving}>
                Rimuovi
              </Button>
            )}
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

          {/* Category assignment */}
          {warehouseCategories.length > 0 && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">{currentCat ? "Cambia categoria" : "Assegna categoria"}</Label>
              <div className="space-y-2">
                <Select value={selectedCat} onValueChange={(v) => { setSelectedCat(v); setSelectedSub(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseCategories.map(c => (
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
