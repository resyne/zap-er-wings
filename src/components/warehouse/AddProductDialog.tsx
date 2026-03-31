import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Box } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: { id: string; name: string }[];
  subcategories: { id: string; category_id: string; name: string }[];
}

export function AddProductDialog({ open, onOpenChange, categories, subcategories }: AddProductDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    code: "",
    product_type: "finished",
    unit_of_measure: "pz",
    current_stock: "0",
    minimum_stock: "0",
    maximum_stock: "100",
    sale_price: "",
    production_cost: "",
    warehouse_location: "",
    category_id: "",
    subcategory_id: "",
    description: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "", code: "", product_type: "finished", unit_of_measure: "pz",
        current_stock: "0", minimum_stock: "0", maximum_stock: "100",
        sale_price: "", production_cost: "", warehouse_location: "",
        category_id: "", subcategory_id: "", description: "",
      });
    }
  }, [open]);

  const filteredSubs = subcategories.filter(s => s.category_id === form.category_id);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Il nome è obbligatorio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const autoCode = `PROD-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await supabase.from("products").insert({
        name: form.name.trim(),
        code: autoCode,
        product_type: form.product_type,
        unit_of_measure: form.unit_of_measure,
        current_stock: Number(form.current_stock) || 0,
        minimum_stock: Number(form.minimum_stock) || 0,
        maximum_stock: Number(form.maximum_stock) || 100,
        sale_price: form.sale_price ? Number(form.sale_price) : null,
        production_cost: form.production_cost ? Number(form.production_cost) : null,
        warehouse_location: form.warehouse_location || null,
        product_category_id: form.category_id || null,
        product_subcategory_id: form.subcategory_id || null,
        description: form.description || null,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: "Prodotto creato con successo" });
      queryClient.invalidateQueries({ queryKey: ["zapp-products"] });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Box className="h-5 w-5 text-primary" />
            Nuovo Prodotto
          </DialogTitle>
          <DialogDescription>Aggiungi un nuovo prodotto finito al magazzino</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Nome *</Label>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome prodotto" className="h-9" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={form.product_type} onValueChange={v => setForm(f => ({ ...f, product_type: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="finished">Prodotto finito</SelectItem>
                  <SelectItem value="semi_finished">Semilavorato</SelectItem>
                  <SelectItem value="accessory">Accessorio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Unità</Label>
              <Select value={form.unit_of_measure} onValueChange={v => setForm(f => ({ ...f, unit_of_measure: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pz">pz</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lt">lt</SelectItem>
                  <SelectItem value="mt">mt</SelectItem>
                  <SelectItem value="set">set</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Stock attuale</Label>
              <Input type="number" value={form.current_stock} onChange={e => setForm(f => ({ ...f, current_stock: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Min</Label>
              <Input type="number" value={form.minimum_stock} onChange={e => setForm(f => ({ ...f, minimum_stock: e.target.value }))} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Max</Label>
              <Input type="number" value={form.maximum_stock} onChange={e => setForm(f => ({ ...f, maximum_stock: e.target.value }))} className="h-9" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Prezzo vendita (€)</Label>
              <Input type="number" step="0.01" value={form.sale_price} onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))} placeholder="0.00" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Costo produzione (€)</Label>
              <Input type="number" step="0.01" value={form.production_cost} onChange={e => setForm(f => ({ ...f, production_cost: e.target.value }))} placeholder="0.00" className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Ubicazione</Label>
            <Input value={form.warehouse_location} onChange={e => setForm(f => ({ ...f, warehouse_location: e.target.value }))} placeholder="Es. Scaffale A3" className="h-9" />
          </div>

          {categories.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Categoria</Label>
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v, subcategory_id: "" }))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Categoria..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {filteredSubs.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Sottocategoria</Label>
                  <Select value={form.subcategory_id} onValueChange={v => setForm(f => ({ ...f, subcategory_id: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Sotto..." /></SelectTrigger>
                    <SelectContent>
                      {filteredSubs.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Descrizione</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Descrizione opzionale..." className="min-h-[60px]" />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Annulla</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Crea Prodotto
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
