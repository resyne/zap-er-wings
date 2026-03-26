import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Building2, User, MapPin, FileText } from "lucide-react";

interface CreateCustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated: (customerId?: string) => void;
}

function SectionHeader({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 mb-3 border-b">
      <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
    </div>
  );
}

export function CreateCustomerDialog({ open, onOpenChange, onCustomerCreated }: CreateCustomerDialogProps) {
  const [loading, setLoading] = useState(false);
  const [sameAddress, setSameAddress] = useState(true);
  const [formData, setFormData] = useState({
    company_name: "", address: "", shipping_address: "", city: "", postal_code: "",
    province: "", country: "", tax_id: "", sdi_code: "", pec: "", email: "",
    contact_name: "", contact_email: "", contact_phone: "", active: true, incomplete_registry: false,
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      company_name: "", address: "", shipping_address: "", city: "", postal_code: "",
      province: "", country: "", tax_id: "", sdi_code: "", pec: "", email: "",
      contact_name: "", contact_email: "", contact_phone: "", active: true, incomplete_registry: false,
    });
    setSameAddress(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name.trim()) {
      toast({ title: "Errore", description: "Il nome azienda è obbligatorio", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert({
          name: formData.company_name, code: '', company_name: formData.company_name,
          email: formData.email || null, tax_id: formData.tax_id || null,
          pec: formData.pec || null, sdi_code: formData.sdi_code || null,
          address: formData.address || null,
          shipping_address: sameAddress ? null : (formData.shipping_address || null),
          city: formData.city || null, country: formData.country || null,
          active: formData.active, incomplete_registry: formData.incomplete_registry,
          contact_name: formData.contact_name || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
        } as any)
        .select().single();
      if (error) throw error;
      toast({ title: "Successo", description: "Cliente creato con successo" });
      onCustomerCreated(data?.id);
      resetForm();
      onOpenChange(false);
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader>
            <DialogTitle className="text-xl">Crea Nuovo Cliente</DialogTitle>
            <DialogDescription>Inserisci i dettagli del nuovo cliente</DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-6">
          {/* ANAGRAFICA */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <SectionHeader icon={Building2} title="Anagrafica Cliente" />
            <div className="space-y-1.5">
              <Label htmlFor="company_name" className="text-xs">Nome Azienda *</Label>
              <Input id="company_name" value={formData.company_name} onChange={(e) => handleInputChange('company_name', e.target.value)} placeholder="Es. Mari SRL" required className="h-9" />
            </div>
          </div>

          {/* SEDI */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <SectionHeader icon={MapPin} title="Sedi" />

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-xs">Sede Legale</Label>
              <Input id="address" value={formData.address} onChange={(e) => handleInputChange('address', e.target.value)} placeholder="Via, numero civico" className="h-9" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="city" className="text-xs">Città</Label>
                <Input id="city" value={formData.city} onChange={(e) => handleInputChange('city', e.target.value)} placeholder="Milano" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="postal_code" className="text-xs">CAP</Label>
                <Input id="postal_code" value={formData.postal_code} onChange={(e) => handleInputChange('postal_code', e.target.value)} placeholder="20100" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="province" className="text-xs">Provincia</Label>
                <Input id="province" value={formData.province} onChange={(e) => handleInputChange('province', e.target.value)} placeholder="MI" className="h-9" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="country" className="text-xs">Paese</Label>
              <Input id="country" value={formData.country} onChange={(e) => handleInputChange('country', e.target.value)} placeholder="Italia" className="h-9" />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <Checkbox id="same_address" checked={sameAddress} onCheckedChange={(checked) => { setSameAddress(checked as boolean); if (checked) handleInputChange('shipping_address', ''); }} />
              <Label htmlFor="same_address" className="text-xs text-muted-foreground cursor-pointer">Sede operativa coincide con sede legale</Label>
            </div>

            {!sameAddress && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="shipping_address" className="text-xs">Sede Operativa</Label>
                <Input id="shipping_address" value={formData.shipping_address} onChange={(e) => handleInputChange('shipping_address', e.target.value)} placeholder="Via, numero civico" className="h-9" />
              </div>
            )}
          </div>

          {/* DATI FISCALI */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <SectionHeader icon={FileText} title="Dati Fiscali e Contatti" />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tax_id" className="text-xs">Partita IVA</Label>
                <Input id="tax_id" value={formData.tax_id} onChange={(e) => handleInputChange('tax_id', e.target.value)} placeholder="IT12345678901" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sdi_code" className="text-xs">Codice SDI</Label>
                <Input id="sdi_code" value={formData.sdi_code} onChange={(e) => handleInputChange('sdi_code', e.target.value)} placeholder="XXXXXXX" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pec" className="text-xs">PEC</Label>
                <Input id="pec" type="email" value={formData.pec} onChange={(e) => handleInputChange('pec', e.target.value)} placeholder="pec@cliente.it" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">Email Aziendale</Label>
                <Input id="email" type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} placeholder="info@azienda.com" className="h-9" />
              </div>
            </div>
          </div>

          {/* REFERENTE */}
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <SectionHeader icon={User} title="Contatto Referente" />

            <div className="space-y-1.5">
              <Label htmlFor="contact_name" className="text-xs">Nome e Cognome</Label>
              <Input id="contact_name" value={formData.contact_name} onChange={(e) => handleInputChange('contact_name', e.target.value)} placeholder="Nome e cognome referente" className="h-9" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="contact_email" className="text-xs">Email</Label>
                <Input id="contact_email" type="email" value={formData.contact_email} onChange={(e) => handleInputChange('contact_email', e.target.value)} placeholder="referente@cliente.com" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="contact_phone" className="text-xs">Telefono</Label>
                <Input id="contact_phone" value={formData.contact_phone} onChange={(e) => handleInputChange('contact_phone', e.target.value)} placeholder="+39 xxx xxx xxxx" className="h-9" />
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2">
              <Switch id="active" checked={formData.active} onCheckedChange={(checked) => handleInputChange('active', checked)} />
              <Label htmlFor="active" className="text-sm">Cliente attivo</Label>
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
