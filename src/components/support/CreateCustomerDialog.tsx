import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  pec?: string;
  sdi_code?: string;
  shipping_address?: string;
}

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customer: Customer) => void;
}

export function CreateCustomerDialog({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [formData, setFormData] = useState({
    company_name: "",
    address: "",
    shipping_address: "",
    city: "",
    postal_code: "",
    province: "",
    country: "",
    tax_id: "",
    sdi_code: "",
    pec: "",
    email: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
    active: true,
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      company_name: "",
      address: "",
      shipping_address: "",
      city: "",
      postal_code: "",
      province: "",
      country: "",
      tax_id: "",
      sdi_code: "",
      pec: "",
      email: "",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      active: true,
    });
    setSameAddress(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_name.trim()) {
      toast({
        title: "Errore",
        description: "Il nome azienda è obbligatorio",
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
          tax_id: formData.tax_id || null,
          pec: formData.pec || null,
          sdi_code: formData.sdi_code || null,
          address: formData.address || null,
          shipping_address: sameAddress ? null : (formData.shipping_address || null),
          city: formData.city || null,
          country: formData.country || null,
          active: formData.active,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Cliente creato con successo",
      });

      onCustomerCreated(data);
      resetForm();
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
          <DialogDescription>Inserisci i dettagli del nuovo cliente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* === SEZIONE 1: ANAGRAFICA CLIENTE === */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b pb-2">Anagrafica Cliente</h4>

            <div className="space-y-2">
              <Label htmlFor="company_name">Nome Azienda *</Label>
              <Input
                id="company_name"
                value={formData.company_name}
                onChange={(e) => handleInputChange('company_name', e.target.value)}
                placeholder="Es. Mari SRL"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Sede Legale</Label>
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
                <Input id="city" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} placeholder="Milano" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="postal_code">CAP</Label>
                <Input id="postal_code" value={formData.postal_code} onChange={(e) => handleInputChange('postal_code', e.target.value)} placeholder="20100" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="province">Provincia</Label>
                <Input id="province" value={formData.province} onChange={(e) => handleInputChange('province', e.target.value)} placeholder="MI" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="country">Paese</Label>
              <Input id="country" value={formData.country} onChange={(e) => handleInputChange('country', e.target.value)} placeholder="Italia" />
            </div>

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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tax_id">Partita IVA</Label>
                <Input id="tax_id" value={formData.tax_id} onChange={(e) => handleInputChange('tax_id', e.target.value)} placeholder="IT12345678901" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sdi_code">Codice SDI</Label>
                <Input id="sdi_code" value={formData.sdi_code} onChange={(e) => handleInputChange('sdi_code', e.target.value)} placeholder="XXXXXXX" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pec">PEC</Label>
              <Input id="pec" type="email" value={formData.pec} onChange={(e) => handleInputChange('pec', e.target.value)} placeholder="pec@cliente.it" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Aziendale</Label>
              <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="info@azienda.com" />
            </div>
          </div>

          {/* === SEZIONE 2: CONTATTO REFERENTE === */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-foreground border-b pb-2">Contatto Referente</h4>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome e Cognome</Label>
              <Input id="contact_name" value={formData.contact_name} onChange={(e) => handleInputChange('contact_name', e.target.value)} placeholder="Nome e cognome referente" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact_email">Email</Label>
                <Input id="contact_email" type="email" value={formData.contact_email} onChange={(e) => handleInputChange('contact_email', e.target.value)} placeholder="referente@cliente.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact_phone">Telefono</Label>
                <Input id="contact_phone" value={formData.contact_phone} onChange={(e) => handleInputChange('contact_phone', e.target.value)} placeholder="+39 xxx xxx xxxx" />
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
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button>
              <Button type="submit" disabled={loading}>{loading ? "Creando..." : "Crea Cliente"}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
