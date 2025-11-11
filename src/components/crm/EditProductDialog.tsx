import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EditProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSuccess?: () => void;
}

export function EditProductDialog({ open, onOpenChange, product, onSuccess }: EditProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    product_type: "component",
    base_price: "",
    unit_of_measure: "pz",
    material_id: "",
    bom_id: "",
  });

  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name || "",
        description: product.description || "",
        product_type: product.product_type || "component",
        base_price: product.base_price ? String(product.base_price) : "",
        unit_of_measure: product.unit_of_measure || "pz",
        material_id: product.material_id || "",
        bom_id: product.bom_id || "",
      });
    }
  }, [product]);

  const { data: materials } = useQuery({
    queryKey: ["materials-for-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, cost")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: boms } = useQuery({
    queryKey: ["boms-level-0"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boms")
        .select("id, name, code:name")
        .eq("level", 0)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Calcola il costo della BOM quando viene selezionata
  const calculateBomCost = async (bomId: string) => {
    try {
      // Ottieni tutte le inclusioni della BOM di livello 0
      const { data: inclusions, error: inclusionsError } = await supabase
        .from("bom_inclusions")
        .select(`
          quantity,
          included_bom_id,
          boms!bom_inclusions_included_bom_id_fkey(
            level,
            material_id,
            materials(cost)
          )
        `)
        .eq("parent_bom_id", bomId);

      if (inclusionsError) throw inclusionsError;

      let totalCost = 0;

      for (const inclusion of inclusions || []) {
        const bom = inclusion.boms;
        if (bom && bom.level === 2 && bom.material_id && bom.materials) {
          const materialCost = bom.materials.cost || 0;
          totalCost += materialCost * inclusion.quantity;
        }
      }

      return totalCost;
    } catch (error) {
      console.error("Error calculating BOM cost:", error);
      return 0;
    }
  };

  // Gestisce la selezione del materiale
  const handleMaterialSelect = (materialId: string) => {
    const material = materials?.find((m) => m.id === materialId);
    setFormData({
      ...formData,
      material_id: materialId,
      bom_id: "",
      base_price: material?.cost ? String(material.cost) : formData.base_price,
    });
    setMaterialOpen(false);
  };

  // Gestisce la selezione della BOM
  const handleBomSelect = async (bomId: string) => {
    const cost = await calculateBomCost(bomId);
    setFormData({
      ...formData,
      bom_id: bomId,
      material_id: "",
      base_price: cost > 0 ? String(cost.toFixed(2)) : formData.base_price,
    });
    setBomOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase
        .from("products")
        .update({
          name: formData.name,
          description: formData.description || null,
          product_type: formData.product_type,
          base_price: formData.base_price ? parseFloat(formData.base_price) : null,
          unit_of_measure: formData.unit_of_measure,
          material_id: formData.material_id || null,
          bom_id: formData.bom_id || null,
        })
        .eq("id", product.id);

      if (error) throw error;

      toast.success("Prodotto aggiornato con successo");
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error updating product:", error);
      toast.error(error.message || "Errore nell'aggiornamento del prodotto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Prodotto</DialogTitle>
          <DialogDescription>
            Modifica i dati del prodotto {product?.code}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <Label className="text-sm text-muted-foreground">Codice Prodotto</Label>
            <p className="text-sm font-medium">{product?.code}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="product_type">Tipo *</Label>
              <Select
                value={formData.product_type}
                onValueChange={(value) => setFormData({ ...formData, product_type: value })}
              >
                <SelectTrigger id="product_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machinery">Macchinario</SelectItem>
                  <SelectItem value="oven">Forno</SelectItem>
                  <SelectItem value="component">Componente</SelectItem>
                  <SelectItem value="spare_part">Ricambio</SelectItem>
                  <SelectItem value="service">Servizio</SelectItem>
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
              placeholder="Nome del prodotto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrizione dettagliata del prodotto"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="base_price">Prezzo Base (€)</Label>
              <Input
                id="base_price"
                type="number"
                step="0.01"
                value={formData.base_price}
                onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_of_measure">Unità di Misura</Label>
              <Input
                id="unit_of_measure"
                value={formData.unit_of_measure}
                onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
                placeholder="pz"
              />
            </div>
          </div>

          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Riferimento Prezzo</Label>
              <p className="text-xs text-muted-foreground">
                Collega il prodotto ad un materiale OPPURE ad una BOM per definire il prezzo di riferimento
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Materiale Magazzino</Label>
                <Popover open={materialOpen} onOpenChange={setMaterialOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={materialOpen}
                      className="w-full justify-between"
                    >
                      {formData.material_id
                        ? materials?.find((m) => m.id === formData.material_id)?.name
                        : "Seleziona materiale"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Cerca materiale..." />
                      <CommandList>
                        <CommandEmpty>Nessun materiale trovato.</CommandEmpty>
                        <CommandGroup>
                          {materials?.map((material) => (
                            <CommandItem
                              key={material.id}
                              value={`${material.code} ${material.name}`}
                              onSelect={() => handleMaterialSelect(material.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.material_id === material.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{material.code} - {material.name}</span>
                                {material.cost && (
                                  <span className="text-xs text-muted-foreground">
                                    € {Number(material.cost).toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formData.material_id && materials && (
                  <p className="text-xs text-muted-foreground">
                    Prezzo da anagrafica materiale
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>BOM Livello 0</Label>
                <Popover open={bomOpen} onOpenChange={setBomOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={bomOpen}
                      className="w-full justify-between"
                    >
                      {formData.bom_id
                        ? boms?.find((b) => b.id === formData.bom_id)?.name
                        : "Seleziona BOM"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Cerca BOM..." />
                      <CommandList>
                        <CommandEmpty>Nessuna BOM trovata.</CommandEmpty>
                        <CommandGroup>
                          {boms?.map((bom) => (
                            <CommandItem
                              key={bom.id}
                              value={bom.name}
                              onSelect={() => handleBomSelect(bom.id)}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  formData.bom_id === bom.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {bom.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formData.bom_id && (
                  <p className="text-xs text-muted-foreground">
                    Prezzo calcolato dalla distinta base
                  </p>
                )}
              </div>
            </div>
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
              {loading ? "Salvataggio..." : "Salva Modifiche"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}