
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
    email: '',
    shipping_address: ''
  });
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
          email: formData.email || null
        })
        .select()
        .single();

      if (error) throw error;

      onContactCreated(data);
      
      // Reset form
      setFormData({
        first_name: '',
        last_name: '',
        company_name: '',
        piva: '',
        address: '',
        sdi_code: '',
        pec: '',
        phone: '',
        email: '',
        shipping_address: ''
      });

      toast({
        title: "Contatto creato",
        description: "Il contatto è stato creato con successo",
      });
    } catch (error) {
      console.error('Error creating contact:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione del contatto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crea Nuovo Cliente</DialogTitle>
          <DialogDescription>
            Inserisci i dati del nuovo cliente. Nome e Cognome sono obbligatori.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dati Anagrafici */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Dati Anagrafici</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) => handleInputChange('first_name', e.target.value)}
                  placeholder="Nome"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Cognome *</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) => handleInputChange('last_name', e.target.value)}
                  placeholder="Cognome"
                  required
                />
              </div>
            </div>
          </div>

          {/* Dati Azienda */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Dati Azienda</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="company_name">Azienda</Label>
                <Input
                  id="company_name"
                  value={formData.company_name}
                  onChange={(e) => handleInputChange('company_name', e.target.value)}
                  placeholder="Nome azienda"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="piva">P.IVA</Label>
                <Input
                  id="piva"
                  value={formData.piva}
                  onChange={(e) => handleInputChange('piva', e.target.value)}
                  placeholder="12345678901"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sdi_code">Codice Destinatario / SDI</Label>
                <Input
                  id="sdi_code"
                  value={formData.sdi_code}
                  onChange={(e) => handleInputChange('sdi_code', e.target.value)}
                  placeholder="ABCDEFG"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pec">PEC</Label>
                <Input
                  id="pec"
                  type="email"
                  value={formData.pec}
                  onChange={(e) => handleInputChange('pec', e.target.value)}
                  placeholder="azienda@pec.it"
                />
              </div>
            </div>
          </div>

          {/* Contatti */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Contatti</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Numero di Telefono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  placeholder="+39 123 456 7890"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="email@esempio.com"
                />
              </div>
            </div>
          </div>

          {/* Indirizzi */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Indirizzi</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="address">Indirizzo</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  placeholder="Via Roma 123, 20121 Milano (MI)"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipping_address">Indirizzo di Spedizione (se diverso)</Label>
                <Textarea
                  id="shipping_address"
                  value={formData.shipping_address}
                  onChange={(e) => handleInputChange('shipping_address', e.target.value)}
                  placeholder="Lascia vuoto se uguale all'indirizzo di intestazione"
                  rows={2}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
            >
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Crea Contatto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
