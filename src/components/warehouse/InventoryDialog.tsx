import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Save, Building2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: Material[];
}

export function InventoryDialog({ open, onOpenChange, materials }: InventoryDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set(["__all__"]));

  // Group by supplier
  const groupedBySupplier = useMemo(() => {
    const groups: Record<string, { supplierName: string; materials: Material[] }> = {};
    for (const m of materials) {
      const key = m.supplier_id || "__no_supplier__";
      const supplierName = m.suppliers?.name || "Senza fornitore";
      if (!groups[key]) groups[key] = { supplierName, materials: [] };
      groups[key].materials.push(m);
    }
    return Object.entries(groups).sort(([kA, a], [kB, b]) => {
      if (kA === "__no_supplier__") return 1;
      if (kB === "__no_supplier__") return -1;
      return a.supplierName.localeCompare(b.supplierName);
    });
  }, [materials]);

  const isAllExpanded = expandedSuppliers.has("__all__");
  const isExpanded = (key: string) => isAllExpanded || expandedSuppliers.has(key);

  const toggleSupplier = (key: string) => {
    setExpandedSuppliers((prev) => {
      if (isAllExpanded) {
        const allKeys = new Set(groupedBySupplier.map(([k]) => k));
        allKeys.delete(key);
        return allKeys;
      }
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleQuantityChange = (materialId: string, value: string) => {
    setQuantities((prev) => ({ ...prev, [materialId]: value }));
    setTouched((prev) => new Set(prev).add(materialId));
  };

  const changedItems = useMemo(() => {
    return materials.filter((m) => {
      if (!touched.has(m.id)) return false;
      const newQty = parseFloat(quantities[m.id] || "");
      return !isNaN(newQty) && newQty !== m.current_stock;
    });
  }, [materials, quantities, touched]);

  const handleSubmit = async () => {
    if (changedItems.length === 0) {
      toast({ title: "Nessuna modifica", description: "Non hai modificato nessuna quantità", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const movements = changedItems.map((m) => ({
        movement_date: new Date().toISOString(),
        movement_type: "carico",
        origin_type: "inventario",
        item_description: `Inventario: ${m.name}`,
        quantity: parseFloat(quantities[m.id]),
        unit: m.unit,
        warehouse: "sede-principale",
        status: "confermato",
        notes: `Inventario manuale. Vecchia quantità: ${m.current_stock}`,
        created_by: user?.id,
        material_id: m.id,
        supplier_id: m.supplier_id || null,
      }));

      const { error } = await supabase.from("stock_movements").insert(movements);
      if (error) throw error;

      // Aggiorna current_stock e last_inventory_date su ogni materiale
      const updatePromises = changedItems.map((m) => {
        const newQty = parseFloat(quantities[m.id]);
        return supabase
          .from("materials")
          .update({
            current_stock: newQty,
            last_inventory_date: new Date().toISOString(),
          })
          .eq("id", m.id);
      });

      const results = await Promise.all(updatePromises);
      const updateError = results.find((r) => r.error);
      if (updateError?.error) throw updateError.error;

      toast({
        title: "Inventario salvato",
        description: `${changedItems.length} articol${changedItems.length === 1 ? "o" : "i"} aggiornato${changedItems.length === 1 ? "" : "i"}`,
      });

      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-movements"] });
      onOpenChange(false);
      setQuantities({});
      setTouched(new Set());
    } catch (error) {
      console.error("Error saving inventory:", error);
      toast({ title: "Errore", description: "Impossibile salvare l'inventario", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />
            Inventario
          </DialogTitle>
          <DialogDescription>
            Inserisci le quantità reali contate. Solo gli articoli modificati verranno aggiornati.
          </DialogDescription>
        </DialogHeader>

        {changedItems.length > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 w-fit">
            {changedItems.length} articol{changedItems.length === 1 ? "o" : "i"} da aggiornare
          </Badge>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 max-h-[450px] pr-1">
          {groupedBySupplier.map(([key, group]) => (
            <Collapsible key={key} open={isExpanded(key)} onOpenChange={() => toggleSupplier(key)}>
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 border border-border hover:bg-muted transition-colors">
                  <Building2 className="h-4 w-4 text-amber-700" />
                  <span className="font-semibold text-sm flex-1 text-left">{group.supplierName}</span>
                  <span className="text-xs text-muted-foreground">{group.materials.length} articoli</span>
                  {isExpanded(key) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="space-y-1 mt-1 ml-2 border-l-2 border-amber-200 pl-2">
                  {group.materials.map((m) => {
                    const currentValue = quantities[m.id];
                    const isTouched = touched.has(m.id);
                    const newQty = parseFloat(currentValue || "");
                    const isChanged = isTouched && !isNaN(newQty) && newQty !== m.current_stock;

                    return (
                      <div
                        key={m.id}
                        className={`flex items-center gap-2 rounded-lg p-2 border transition-colors ${
                          isChanged ? "bg-blue-50 border-blue-200" : "bg-white border-border"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[13px] truncate">{m.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {m.code} · Attuale: <strong>{m.current_stock}</strong> {m.unit}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            placeholder={m.current_stock.toString()}
                            value={currentValue ?? ""}
                            onChange={(e) => handleQuantityChange(m.id, e.target.value)}
                            className="w-20 text-center h-8"
                          />
                          <span className="text-[11px] text-muted-foreground w-5">{m.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || changedItems.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Salva Inventario ({changedItems.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
