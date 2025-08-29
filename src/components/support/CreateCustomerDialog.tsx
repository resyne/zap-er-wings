import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customer: { id: string; name: string; code: string }) => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    tax_id: ""
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.code.trim()) {
      toast({
        title: "Errore",
        description: "Nome e codice sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([{
          name: formData.name,
          code: formData.code,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          tax_id: formData.tax_id || null
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });

      onCustomerCreated(data);
      setFormData({
        name: "",
        code: "",
        email: "",
        phone: "",
        address: "",
        tax_id: ""
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli del nuovo cliente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nome cliente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Codice *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => handleInputChange('code', e.target.value)}
                placeholder="Codice cliente"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@cliente.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                placeholder="+39 xxx xxx xxxx"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Indirizzo</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Via, Città, CAP"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_id">Partita IVA</Label>
            <Input
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => handleInputChange('tax_id', e.target.value)}
              placeholder="IT12345678901"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crea Cliente"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}