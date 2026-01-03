import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  company_name?: string;
  piva?: string;
  address?: string;
  sdi_code?: string;
  pec?: string;
  phone?: string;
  email?: string;
  mobile?: string;
  shipping_address?: string;
}

interface CreateContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContactCreated: (contact: Contact) => void;
}

export function CreateContactDialog({ open, onOpenChange, onContactCreated }: CreateContactDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    company_name: '',
    piva: '',
    address: '',
    sdi_code: '',
    pec: '',
    phone: '',
    mobile: '',
    email: '',
    shipping_address: ''
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      company_name: '',
      piva: '',
      address: '',
      sdi_code: '',
      pec: '',
      phone: '',
      mobile: '',
      email: '',
      shipping_address: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.first_name || !formData.last_name) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Nome e Cognome sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .insert({
          first_name: formData.first_name,
          last_name: formData.last_name,
          company_name: formData.company_name || null,
          piva: formData.piva || null,
          address: formData.address || null,
          sdi_code: formData.sdi_code || null,
          pec: formData.pec || null,
          phone: formData.phone || null,
          mobile: formData.mobile || null,
          email: formData.email || null,
          shipping_address: formData.shipping_address || null
        })
        .select()
        .single();

      if (error) throw error;

      onContactCreated(data);
      resetForm();
      onOpenChange(false);

      toast({
        title: "Cliente creato",
        description: `${data.first_name} ${data.last_name} è stato aggiunto con successo`,
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del cliente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nuovo Cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo cliente. I campi con * sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Dati Anagrafici */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dati Anagrafici</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="first_name" className="text-sm">Nome *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Mario"
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="last_name" className="text-sm">Cognome *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Rossi"
                  className="h-11"
                  required
                />
              </div>
            </div>
          </div>

          {/* Dati Azienda */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Dati Azienda</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="company_name" className="text-sm">Ragione Sociale</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Azienda SRL"
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="piva" className="text-sm">P.IVA / C.F.</Label>
                  <Input
                    id="piva"
                    value={formData.piva}
                    onChange={(e) => handleInputChange('piva', e.target.value)}
                    placeholder="12345678901"
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sdi_code" className="text-sm">Codice SDI</Label>
                  <Input
                    id="sdi_code"
                    value={formData.sdi_code}
                    onChange={(e) => handleInputChange('sdi_code', e.target.value)}
                    placeholder="ABCDEFG"
                    className="h-11"
                    maxLength={7}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pec" className="text-sm">PEC</Label>
                <Input
                  id="pec"
                  type="email"
                  value={formData.pec}
                  onChange={(e) => handleInputChange('pec', e.target.value)}
                  placeholder="azienda@pec.it"
                  className="h-11"
                />
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contatti</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-sm">Telefono Fisso</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="081 123 4567"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mobile" className="text-sm">Cellulare</Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={formData.mobile}
                  onChange={(e) => handleInputChange('mobile', e.target.value)}
                  placeholder="333 123 4567"
                  className="h-11"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="mario.rossi@email.com"
                className="h-11"
              />
            </div>
          </div>

          {/* Indirizzi */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Indirizzi</h3>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm">Indirizzo Sede / Fatturazione</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Via Roma 123, 84018 Scafati (SA)"
                  rows={2}
                  className="resize-none"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="shipping_address" className="text-sm">Indirizzo di Spedizione (se diverso)</Label>
                <Textarea
                  id="shipping_address"
                  value={formData.shipping_address}
                  onChange={(e) => handleInputChange('shipping_address', e.target.value)}
                  placeholder="Lascia vuoto se uguale all'indirizzo sede"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              className="w-full sm:w-auto h-11"
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto h-11">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
