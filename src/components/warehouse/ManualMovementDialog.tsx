import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

interface ManualMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movementType: "carico" | "scarico";
}

export function ManualMovementDialog({ open, onOpenChange, movementType }: ManualMovementDialogProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.item_description || !formData.quantity) {
      toast({ title: "Errore", description: "Compila tutti i campi obbligatori", variant: "destructive" });
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
        status: "proposto",
        notes: formData.notes || null,
        created_by: user?.id,
      });

      if (error) throw error;

      toast({ title: "Movimento creato", description: `${movementType === "carico" ? "Carico" : "Scarico"} registrato con successo` });
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      onOpenChange(false);
      setFormData({ item_description: "", quantity: "", unit: "pz", warehouse: "sede-principale", notes: "" });
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
      <DialogContent className="sm:max-w-[500px]">
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
