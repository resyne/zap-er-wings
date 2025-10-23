import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateProductDialog({ open, onOpenChange, onSuccess }: CreateProductDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    product_type: "component",
    base_price: "",
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("products").insert([
        {
          code: formData.code,
          name: formData.name,
          description: formData.description || null,
          product_type: formData.product_type,
          base_price: formData.base_price ? parseFloat(formData.base_price) : null,
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
        code: "",
        name: "",
        description: "",
        product_type: "component",
        base_price: "",
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                placeholder="es. PROD-001"
                required
              />
            </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="material_id">Materiale Collegato</Label>
              <Select
                value={formData.material_id}
                onValueChange={(value) => setFormData({ ...formData, material_id: value })}
              >
                <SelectTrigger id="material_id">
                  <SelectValue placeholder="Seleziona materiale..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {materials?.map((material) => (
                    <SelectItem key={material.id} value={material.id}>
                      {material.code} - {material.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bom_id">BOM Livello 0</Label>
              <Select
                value={formData.bom_id}
                onValueChange={(value) => setFormData({ ...formData, bom_id: value })}
              >
                <SelectTrigger id="bom_id">
                  <SelectValue placeholder="Seleziona BOM..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuno</SelectItem>
                  {boms?.map((bom) => (
                    <SelectItem key={bom.id} value={bom.id}>
                      {bom.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
