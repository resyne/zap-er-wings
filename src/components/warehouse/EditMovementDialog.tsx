import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil } from "lucide-react";

interface EditMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement: {
    id: string;
    item_description: string;
    quantity: number;
    unit: string;
    warehouse: string;
    notes: string | null;
  } | null;
}

export function EditMovementDialog({ open, onOpenChange, movement }: EditMovementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    item_description: "",
    quantity: "",
    unit: "pz",
    warehouse: "sede-principale",
    notes: "",
  });

  useEffect(() => {
    if (movement) {
      setFormData({
        item_description: movement.item_description,
        quantity: movement.quantity.toString(),
        unit: movement.unit,
        warehouse: movement.warehouse,
        notes: movement.notes || "",
      });
    }
  }, [movement]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_description || !formData.quantity || !movement) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("stock_movements")
        .update({
          item_description: formData.item_description,
          quantity: parseFloat(formData.quantity),
          unit: formData.unit,
          warehouse: formData.warehouse,
          notes: formData.notes || null,
        })
        .eq("id", movement.id);

      if (error) throw error;

      toast({ title: "Movimento aggiornato" });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating movement:", error);
      toast({ title: "Errore", description: "Impossibile aggiornare il movimento", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Modifica Movimento
          </DialogTitle>
          <DialogDescription>
            Modifica i dettagli del movimento di magazzino
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="item_description">Descrizione Articolo *</Label>
            <Input
              id="item_description"
              value={formData.item_description}
              onChange={(e) => setFormData({ ...formData, item_description: e.target.value })}
              placeholder="Es. Forno rotativo mod. XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantità *</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Unità di Misura</Label>
              <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
            <Label htmlFor="warehouse">Deposito</Label>
            <Select value={formData.warehouse} onValueChange={(v) => setFormData({ ...formData, warehouse: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sede-principale">Sede Principale</SelectItem>
                <SelectItem value="magazzino-esterno">Magazzino Esterno</SelectItem>
                <SelectItem value="produzione">Produzione</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Note</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Note aggiuntive sul movimento..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Modifiche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
