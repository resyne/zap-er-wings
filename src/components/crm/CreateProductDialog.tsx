import { useState } from "react";
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

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProductDialog({ open, onOpenChange, onSuccess }: CreateProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [materialOpen, setMaterialOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    product_type: "component",
    unit_of_measure: "pz",
    material_id: "",
    bom_id: "",
  });

  const { data: materials } = useQuery({
    queryKey: ["materials-for-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name")
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

  // Gestisce la selezione del materiale
  const handleMaterialSelect = (materialId: string) => {
    setFormData({
      ...formData,
      material_id: materialId,
      bom_id: "",
    });
    setMaterialOpen(false);
  };

  // Gestisce la selezione della BOM
  const handleBomSelect = async (bomId: string) => {
    setFormData({
      ...formData,
      bom_id: bomId,
      material_id: "",
    });
    setBomOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("products").insert([
        {
          code: "",
          name: formData.name,
          description: formData.description || null,
          product_type: formData.product_type,
          unit_of_measure: formData.unit_of_measure,
          material_id: formData.material_id || null,
          bom_id: formData.bom_id || null,
        },
      ]);

      if (error) throw error;

      toast.success("Prodotto creato con successo");
      onOpenChange(false);
      onSuccess?.();
      
      setFormData({
        name: "",
        description: "",
        product_type: "component",
        unit_of_measure: "pz",
        material_id: "",
        bom_id: "",
      });
    } catch (error: any) {
      console.error("Error creating product:", error);
      toast.error(error.message || "Errore nella creazione del prodotto");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Prodotto</DialogTitle>
          <DialogDescription>
            Crea un nuovo prodotto nel catalogo
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 p-3 bg-muted/50 rounded-lg border">
            <Label className="text-sm text-muted-foreground">Codice Prodotto</Label>
            <p className="text-sm">Verrà generato automaticamente (es. 33-0001)</p>
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

          <div className="space-y-2">
            <Label htmlFor="unit_of_measure">Unità di Misura</Label>
            <Input
              id="unit_of_measure"
              value={formData.unit_of_measure}
              onChange={(e) => setFormData({ ...formData, unit_of_measure: e.target.value })}
              placeholder="pz"
            />
          </div>

          <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Riferimento Costo</Label>
              <p className="text-xs text-muted-foreground">
                Collega il prodotto ad un materiale OPPURE ad una BOM per calcolare il costo
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
                              <span>{material.code} - {material.name}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {formData.material_id && materials && (
                  <p className="text-xs text-muted-foreground">
                    Costo da anagrafica materiale
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
                    Costo calcolato dalla distinta base
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
              {loading ? "Creazione..." : "Crea Prodotto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
