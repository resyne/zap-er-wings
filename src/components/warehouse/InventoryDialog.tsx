import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Loader2, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const filteredMaterials = useMemo(() => {
    return materials.filter(
      (m) =>
        m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.code.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [materials, searchTerm]);

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
        movement_type: "inventario",
        origin_type: "Inventario",
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
      setSearchTerm("");
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

        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca materiale..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {changedItems.length > 0 && (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 w-fit">
            {changedItems.length} articol{changedItems.length === 1 ? "o" : "i"} da aggiornare
          </Badge>
        )}

        <div className="flex-1 overflow-y-auto space-y-1 max-h-[400px] pr-1">
          {filteredMaterials.map((m) => {
            const currentValue = quantities[m.id];
            const isTouched = touched.has(m.id);
            const newQty = parseFloat(currentValue || "");
            const isChanged = isTouched && !isNaN(newQty) && newQty !== m.current_stock;

            return (
              <div
                key={m.id}
                className={`flex items-center gap-3 rounded-lg p-2.5 border transition-colors ${
                  isChanged ? "bg-blue-50 border-blue-200" : "bg-white border-border"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[13px] truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {m.code} · {m.suppliers?.name || "N/A"} · Attuale: <strong>{m.current_stock}</strong> {m.unit}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder={m.current_stock.toString()}
                    value={currentValue ?? ""}
                    onChange={(e) => handleQuantityChange(m.id, e.target.value)}
                    className="w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground w-6">{m.unit}</span>
                </div>
              </div>
            );
          })}
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
