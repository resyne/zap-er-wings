import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customerId?: string) => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sameBillingAddress, setSameBillingAddress] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    company_name: "",
    referent_name: "",
    email: "",
    phone: "",
    tax_id: "",
    pec: "",
    sdi_code: "",
    address: "",
    shipping_address: "",
    city: "",
    postal_code: "",
    province: "",
    country: "",
    active: true,
    incomplete_registry: false
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name.trim()) {
      toast({
        title: "Errore",
        description: "Intestazione è obbligatoria",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: formData.company_name,
          code: '',
          company_name: formData.company_name,
          email: formData.email || null,
          phone: formData.phone || null,
          tax_id: formData.tax_id || null,
          pec: formData.pec || null,
          sdi_code: formData.sdi_code || null,
          address: formData.address || null,
          shipping_address: sameBillingAddress ? null : (formData.shipping_address || null),
          city: formData.city || null,
          country: formData.country || null,
          active: formData.active,
          incomplete_registry: formData.incomplete_registry
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });

      onCustomerCreated(data?.id);
      setSameBillingAddress(true);
      setFormData({
        name: "",
        company_name: "",
        referent_name: "",
        email: "",
        phone: "",
        tax_id: "",
        pec: "",
        sdi_code: "",
        address: "",
        shipping_address: "",
        city: "",
        postal_code: "",
        province: "",
        country: "",
        active: true,
        incomplete_registry: false
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
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dettagli del nuovo cliente
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Intestazione */}
          <div className="space-y-2">
            <Label htmlFor="company_name">Intestazione *</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Es. Mari SRL"
              required
            />
          </div>

          {/* Indirizzo sede: Via, Città, CAP, Provincia, Paese */}
          <div className="space-y-2">
            <Label htmlFor="address">Indirizzo di Fatturazione</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Via, numero civico"
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Città</Label>
              <Input
                id="city"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                placeholder="Milano"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postal_code">CAP</Label>
              <Input
                id="postal_code"
                value={formData.postal_code}
                onChange={(e) => handleInputChange('postal_code', e.target.value)}
                placeholder="20100"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="province">Provincia</Label>
              <Input
                id="province"
                value={formData.province}
                onChange={(e) => handleInputChange('province', e.target.value)}
                placeholder="MI"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="country">Paese</Label>
            <Input
              id="country"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="Italia"
            />
          </div>

          {/* P.IVA */}
          <div className="space-y-2">
            <Label htmlFor="tax_id">Partita IVA</Label>
            <Input
              id="tax_id"
              value={formData.tax_id}
              onChange={(e) => handleInputChange('tax_id', e.target.value)}
              placeholder="IT12345678901"
            />
          </div>

          {/* Indirizzo di spedizione */}
          <div className="space-y-2">
            <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
            <Textarea
              id="shipping_address"
              value={sameBillingAddress ? formData.address : formData.shipping_address}
              onChange={(e) => handleInputChange('shipping_address', e.target.value)}
              placeholder="Via, numero civico"
              rows={2}
              disabled={sameBillingAddress}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="same_billing"
              checked={sameBillingAddress}
              onCheckedChange={(checked) => {
                setSameBillingAddress(checked as boolean);
                if (checked) handleInputChange('shipping_address', '');
              }}
            />
            <Label htmlFor="same_billing">Stesso indirizzo di fatturazione</Label>
          </div>

          {/* Referente e contatti */}
          <div className="space-y-2">
            <Label htmlFor="referent_name">Nome Referente</Label>
            <Input
              id="referent_name"
              value={formData.referent_name}
              onChange={(e) => handleInputChange('referent_name', e.target.value)}
              placeholder="Nome e cognome referente"
            />
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pec">PEC</Label>
              <Input
                id="pec"
                type="email"
                value={formData.pec}
                onChange={(e) => handleInputChange('pec', e.target.value)}
                placeholder="pec@cliente.it"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sdi_code">Codice Destinatario</Label>
              <Input
                id="sdi_code"
                value={formData.sdi_code}
                onChange={(e) => handleInputChange('sdi_code', e.target.value)}
                placeholder="XXXXXXX"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange('active', checked)}
              />
              <Label htmlFor="active">Cliente attivo</Label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="incomplete_registry"
                checked={formData.incomplete_registry}
                onCheckedChange={(checked) => handleInputChange('incomplete_registry', checked as boolean)}
              />
              <Label htmlFor="incomplete_registry">Anagrafica da completare</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
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