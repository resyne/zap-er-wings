import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [sameAddress, setSameAddress] = useState(true);
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    shipping_address: "",
    city: "",
    country: "",
    tax_id: "",
    pec: "",
    sdi_code: "",
    active: true,
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    if (customer) {
      const hasShippingAddress = customer.shipping_address && customer.shipping_address.trim() !== '';
      setSameAddress(!hasShippingAddress);
      
      setFormData({
        name: customer.name || "",
        code: customer.code || "",
        email: customer.email || "",
        phone: customer.phone || "",
        address: customer.address || "",
        shipping_address: customer.shipping_address || "",
        city: customer.city || "",
        country: customer.country || "",
        tax_id: customer.tax_id || "",
        pec: customer.pec || "",
        sdi_code: customer.sdi_code || "",
        active: customer.active !== false,
        contact_name: customer.contact_name || "",
        contact_email: customer.contact_email || "",
        contact_phone: customer.contact_phone || "",
      });
    }
  }, [customer]);

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome azienda è obbligatorio",
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
          company_name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          shipping_address: sameAddress ? null : (formData.shipping_address || null),
          city: formData.city || null,
          country: formData.country || null,
          tax_id: formData.tax_id || null,
          pec: formData.pec || null,
          sdi_code: formData.sdi_code || null,
          active: formData.active,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          updated_at: new Date().toISOString()
        } as any)
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
          <DialogDescription>Modifica i dettagli del cliente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* === SEZIONE 1: ANAGRAFICA CLIENTE === */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b pb-2">Anagrafica Cliente</h4>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Azienda *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Es. Mari SRL"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Codice</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value)}
                  placeholder="Codice cliente"
                />
              </div>
            </div>

            {/* Sede legale */}
            <div className="space-y-2">
              <Label htmlFor="address">Sede Legale</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => handleInputChange('address', e.target.value)}
                placeholder="Via, numero civico"
              />
            </div>

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

            {/* Sede operativa */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="same_address"
                checked={sameAddress}
                onCheckedChange={(checked) => {
                  setSameAddress(checked as boolean);
                  if (checked) handleInputChange('shipping_address', '');
                }}
              />
              <Label htmlFor="same_address" className="text-sm">Sede operativa coincide con sede legale</Label>
            </div>

            {!sameAddress && (
              <div className="space-y-2">
                <Label htmlFor="shipping_address">Sede Operativa</Label>
                <Input
                  id="shipping_address"
                  value={formData.shipping_address}
                  onChange={(e) => handleInputChange('shipping_address', e.target.value)}
                  placeholder="Via, numero civico"
                />
              </div>
            )}

            {/* Dati fiscali */}
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
              <div className="space-y-2">
                <Label htmlFor="sdi_code">Codice SDI</Label>
                <Input
                  id="sdi_code"
                  value={formData.sdi_code}
                  onChange={(e) => handleInputChange('sdi_code', e.target.value)}
                  placeholder="XXXXXXX"
                />
              </div>
            </div>

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
              <Label htmlFor="email">Email Aziendale</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="info@azienda.com"
              />
            </div>
          </div>

          {/* === SEZIONE 2: CONTATTO REFERENTE === */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b pb-2">Contatto Referente</h4>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome e Cognome</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => handleInputChange('contact_name', e.target.value)}
                placeholder="Nome e cognome referente"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input
                  id="contact_email"
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => handleInputChange('contact_email', e.target.value)}
                  placeholder="referente@cliente.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefono</Label>
                <Input
                  id="contact_phone"
                  value={formData.contact_phone}
                  onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                  placeholder="+39 xxx xxx xxxx"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => handleInputChange('active', checked)}
              />
              <Label htmlFor="active">Cliente attivo</Label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Salva Modifiche"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
