import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Loader2, Search } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface ManualMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: "carico" | "scarico";
}

export function ManualMovementDialog({ open, onOpenChange, movementType }: ManualMovementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [materialOpen, setMaterialOpen] = useState(false);
  const [materialSearch, setMaterialSearch] = useState("");

  const [formData, setFormData] = useState({
    item_description: "",
    quantity: "",
    unit: "pz",
    warehouse: "sede-principale",
    notes: "",
    material_id: "",
    supplier_id: "",
  });

  // Fetch materials from suppliers with show_in_warehouse=true
  const { data: materials = [] } = useQuery({
    queryKey: ["materials-for-movement"],
    queryFn: async () => {
      // First get enabled supplier IDs
      const { data: suppliers, error: sErr } = await supabase
        .from("suppliers")
        .select("id")
        .eq("active", true)
        .eq("show_in_warehouse", true);
      if (sErr) throw sErr;
      const supplierIds = (suppliers || []).map(s => s.id);
      if (supplierIds.length === 0) return [];

      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, unit, current_stock, supplier_id, suppliers(name)")
        .eq("active", true)
        .in("supplier_id", supplierIds)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // Group materials by supplier
  const groupedMaterials = useMemo(() => {
    const groups: Record<string, { supplierName: string; items: typeof materials }> = {};
    for (const m of materials) {
      const key = (m as any).suppliers?.name || "Altro";
      if (!groups[key]) groups[key] = { supplierName: key, items: [] };
      groups[key].items.push(m);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [materials]);

  const filteredGrouped = useMemo(() => {
    if (!materialSearch) return groupedMaterials;
    const term = materialSearch.toLowerCase();
    return groupedMaterials
      .map(([key, group]) => [key, { ...group, items: group.items.filter((m: any) => m.name.toLowerCase().includes(term) || m.code.toLowerCase().includes(term)) }] as const)
      .filter(([, group]) => group.items.length > 0);
  }, [groupedMaterials, materialSearch]);

  const selectedMaterial = materials.find((m: any) => m.id === formData.material_id) as any;

  useEffect(() => {
    if (selectedMaterial) {
      setFormData((prev) => ({
        ...prev,
        item_description: selectedMaterial.name,
        unit: selectedMaterial.unit || prev.unit,
        supplier_id: selectedMaterial.supplier_id || "",
      }));
    }
  }, [selectedMaterial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.material_id || !formData.quantity) {
      toast({ title: "Errore", description: "Seleziona un materiale e inserisci la quantità", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("stock_movements").insert({
        movement_date: new Date().toISOString(),
        movement_type: movementType,
        origin_type: "Manuale",
        item_description: formData.item_description,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        warehouse: formData.warehouse,
        status: "confermato",
        notes: formData.notes || null,
        created_by: user?.id,
        material_id: formData.material_id,
        supplier_id: formData.supplier_id || null,
      });
      if (error) throw error;
      toast({ title: "Movimento creato", description: `${movementType === "carico" ? "Carico" : "Scarico"} registrato con successo` });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-materials"] });
      queryClient.invalidateQueries({ queryKey: ["zapp-movements"] });
      queryClient.invalidateQueries({ queryKey: ["materials-for-movement"] });
      onOpenChange(false);
      setFormData({ item_description: "", quantity: "", unit: "pz", warehouse: "sede-principale", notes: "", material_id: "", supplier_id: "" });
      setMaterialSearch("");
    } catch (error) {
      console.error("Error creating movement:", error);
      toast({ title: "Errore", description: "Impossibile creare il movimento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Icon = movementType === "carico" ? TrendingUp : TrendingDown;
  const color = movementType === "carico" ? "text-green-600" : "text-red-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} />
            {movementType === "carico" ? "Carico Merci" : "Scarico Merci"}
          </DialogTitle>
          <DialogDescription>
            Registra un movimento manuale di {movementType === "carico" ? "carico" : "scarico"} merci
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Materiale *</Label>
            <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {selectedMaterial ? (
                    <span className="truncate">{selectedMaterial.name} ({selectedMaterial.code})</span>
                  ) : (
                    <span className="text-muted-foreground">Seleziona materiale...</span>
                  )}
                  <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca materiale..." value={materialSearch} onValueChange={setMaterialSearch} />
                  <CommandList>
                    <CommandEmpty>Nessun materiale trovato</CommandEmpty>
                    {filteredGrouped.map(([key, group]) => (
                      <CommandGroup key={key} heading={group.supplierName}>
                        {group.items.map((material: any) => (
                          <CommandItem
                            key={material.id}
                            value={`${material.name} ${material.code}`}
                            onSelect={() => {
                              setFormData((prev) => ({ ...prev, material_id: material.id }));
                              setMaterialOpen(false);
                              setMaterialSearch("");
                            }}
                          >
                            <span className="font-medium">{material.name}</span>
                            <span className="ml-2 text-muted-foreground text-xs">({material.code}) · {material.current_stock} {material.unit}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedMaterial && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
              Fornitore: <strong>{selectedMaterial.suppliers?.name}</strong> · Scorta attuale: <strong>{selectedMaterial.current_stock} {selectedMaterial.unit}</strong>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantità *</Label>
              <Input id="quantity" type="number" min="0.01" step="0.01" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} placeholder="1" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unità di Misura</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pz">Pezzi</SelectItem>
                  <SelectItem value="kg">Kg</SelectItem>
                  <SelectItem value="mt">Metri</SelectItem>
                  <SelectItem value="lt">Litri</SelectItem>
                  <SelectItem value="set">Set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Note aggiuntive..." rows={2} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
            <Button type="submit" disabled={loading} className={movementType === "carico" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Registra {movementType === "carico" ? "Carico" : "Scarico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
