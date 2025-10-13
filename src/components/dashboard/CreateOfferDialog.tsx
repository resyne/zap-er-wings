import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateOfferDialog({ open, onOpenChange, onSuccess }: CreateOfferDialogProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [newOffer, setNewOffer] = useState({
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: 'richiesta_offerta' as const
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
    }
  }, [open]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, code')
      .eq('active', true)
      .order('name');
    
    setCustomers(data || []);
  };

  const handleCreateOffer = async () => {
    try {
      const customer = customers.find(c => c.id === newOffer.customer_id);
      if (!customer) {
        toast({
          title: "Errore",
          description: "Seleziona un cliente valido",
          variant: "destructive",
        });
        return;
      }

      if (!newOffer.title) {
        toast({
          title: "Errore",
          description: "Il titolo è obbligatorio",
          variant: "destructive",
        });
        return;
      }

      setLoading(true);

      const offerNumber = `OFF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Crea l'offerta - il trigger creerà automaticamente il lead
      const { error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: newOffer.customer_id,
          customer_name: customer.name,
          title: newOffer.title,
          description: newOffer.description,
          amount: newOffer.amount,
          valid_until: newOffer.valid_until || null,
          status: newOffer.status
        }]);

      if (error) throw error;

      toast({
        title: "Offerta Creata",
        description: "L'offerta e il lead collegato sono stati creati con successo",
      });

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error('Error creating offer:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'offerta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setNewOffer({
      customer_id: '',
      title: '',
      description: '',
      amount: 0,
      valid_until: '',
      status: 'richiesta_offerta'
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova Richiesta di Offerta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="customer">Cliente *</Label>
            <Select value={newOffer.customer_id} onValueChange={(value) => setNewOffer({ ...newOffer, customer_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona cliente" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.code} - {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Titolo Offerta *</Label>
            <Input
              id="title"
              value={newOffer.title}
              onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
              placeholder="Es: Fornitura macchinari industriali"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrizione</Label>
            <Textarea
              id="description"
              value={newOffer.description}
              onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
              placeholder="Dettagli della richiesta..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Importo Stimato (€)</Label>
              <Input
                id="amount"
                type="number"
                value={newOffer.amount}
                onChange={(e) => setNewOffer({ ...newOffer, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="valid_until">Valida Fino al</Label>
              <Input
                id="valid_until"
                type="date"
                value={newOffer.valid_until}
                onChange={(e) => setNewOffer({ ...newOffer, valid_until: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="status">Stato</Label>
            <Select value={newOffer.status} onValueChange={(value: any) => setNewOffer({ ...newOffer, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="richiesta_offerta">Richiesta di Offerta</SelectItem>
                <SelectItem value="offerta_pronta">Offerta Pronta</SelectItem>
                <SelectItem value="offerta_inviata">Offerta Inviata</SelectItem>
                <SelectItem value="negoziazione">Negoziazione</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleCreateOffer} disabled={loading}>
            {loading ? "Creazione..." : "Crea Offerta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
