import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface EditCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: any;
  onCustomerUpdated: () => void;
}

export function EditCustomerDialog({ open, onOpenChange, customer, onCustomerUpdated }: EditCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sameBillingAddress, setSameBillingAddress] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    company_name: "",
    email: "",
    phone: "",
    address: "",
    shipping_address: "",
    city: "",
    country: "",
    tax_id: "",
    active: true
  });
  const { toast } = useToast();

  useEffect(() => {
    if (customer) {
      const hasShippingAddress = customer.shipping_address && customer.shipping_address.trim() !== '';
      setSameBillingAddress(!hasShippingAddress);
      
      setFormData({
        name: customer.name || "",
        code: customer.code || "",
        company_name: customer.company_name || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        shipping_address: customer.shipping_address || "",
        city: customer.city || "",
        country: customer.country || "",
        tax_id: customer.tax_id || "",
        active: customer.active !== false
      });
    }
  }, [customer]);

  const handleInputChange = (field: string, value: string | boolean) => {
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
      const { error } = await supabase
        .from('customers')
        .update({
          name: formData.name,
          code: formData.code,
          company_name: formData.company_name || null,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          shipping_address: sameBillingAddress ? null : (formData.shipping_address || null),
          city: formData.city || null,
          country: formData.country || null,
          tax_id: formData.tax_id || null,
          active: formData.active,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);

      if (error) throw error;

      onCustomerUpdated();
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

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Cliente</DialogTitle>
          <DialogDescription>
            Modifica i dettagli del cliente
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

          <div className="space-y-2">
            <Label htmlFor="company_name">Nome Azienda</Label>
            <Input
              id="company_name"
              value={formData.company_name}
              onChange={(e) => handleInputChange('company_name', e.target.value)}
              placeholder="Nome dell'azienda"
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

          <div className="space-y-2">
            <Label htmlFor="address">Indirizzo di Fatturazione</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => handleInputChange('address', e.target.value)}
              placeholder="Via, numero civico"
              rows={2}
            />
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <Checkbox
              id="same_billing"
              checked={sameBillingAddress}
              onCheckedChange={(checked) => {
                setSameBillingAddress(checked as boolean);
                if (checked) {
                  handleInputChange('shipping_address', '');
                }
              }}
            />
            <Label htmlFor="same_billing">Stesso indirizzo di fatturazione</Label>
          </div>

          {!sameBillingAddress && (
            <div className="space-y-2">
              <Label htmlFor="shipping_address">Indirizzo di Spedizione</Label>
              <Textarea
                id="shipping_address"
                value={formData.shipping_address}
                onChange={(e) => handleInputChange('shipping_address', e.target.value)}
                placeholder="Via, numero civico"
                rows={2}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
              <Label htmlFor="country">Paese</Label>
              <Input
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                placeholder="Italia"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax_id">Partita IVA</Label>
              <Input
                id="tax_id"
                value={formData.tax_id}
                onChange={(e) => handleInputChange('tax_id', e.target.value)}
                placeholder="IT12345678901"
              />
            </div>
            <div className="flex items-center space-x-2 pt-6">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange('active', checked)}
              />
              <Label htmlFor="active">Cliente attivo</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salva Modifiche"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}