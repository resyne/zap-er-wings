import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customPaymentTerms, setCustomPaymentTerms] = useState('');
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  
  const [newOffer, setNewOffer] = useState({
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: 'richiesta_offerta' as const,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    payment_terms: ''
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadUsers();
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

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, first_name, last_name')
      .order('first_name');
    
    setUsers(data || []);
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

      // Determina i payment_terms
      const finalPaymentTerms = newOffer.payment_terms === 'custom' 
        ? customPaymentTerms 
        : newOffer.payment_terms;

      // Crea l'offerta - il trigger creerà automaticamente il lead e il codice univoco
      const { data: offerData, error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: newOffer.customer_id,
          customer_name: customer.name,
          title: newOffer.title,
          description: newOffer.description,
          amount: newOffer.amount,
          valid_until: newOffer.valid_until || null,
          status: newOffer.status,
          priority: newOffer.priority,
          payment_terms: finalPaymentTerms || null
        }])
        .select('unique_code')
        .single();

      if (error) throw error;

      // Genera il link pubblico con il dominio personalizzato
      const publicLink = `https://www.erp.abbattitorizapper.it/offerta/${offerData.unique_code}`;

      toast({
        title: "Offerta Creata",
        description: (
          <div className="space-y-2">
            <p>L'offerta è stata creata con successo.</p>
            <div className="bg-background/50 p-2 rounded">
              <p className="text-xs font-mono break-all">{publicLink}</p>
            </div>
            <p className="text-xs">Copia il link per condividerlo con il cliente.</p>
          </div>
        ),
      });

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
    // Mantiene il cliente selezionato per permettere di aggiungere più offerte consecutive
    const currentCustomerId = newOffer.customer_id;
    setNewOffer({
      customer_id: currentCustomerId,
      title: '',
      description: '',
      amount: 0,
      valid_until: '',
      status: 'richiesta_offerta',
      priority: 'medium',
      payment_terms: ''
    });
    setCustomPaymentTerms('');
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
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between"
                >
                  {newOffer.customer_id
                    ? (() => {
                        const customer = customers.find((c) => c.id === newOffer.customer_id);
                        return customer ? `${customer.code} - ${customer.name}` : "Seleziona cliente";
                      })()
                    : "Seleziona cliente"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca cliente..." />
                  <CommandList>
                    <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={`${customer.code} ${customer.name}`}
                          onSelect={() => {
                            setNewOffer({ ...newOffer, customer_id: customer.id });
                            setCustomerSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              newOffer.customer_id === customer.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {customer.code} - {customer.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
              <Label htmlFor="priority">Urgenza *</Label>
              <Select value={newOffer.priority} onValueChange={(value: any) => setNewOffer({ ...newOffer, priority: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Bassa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            <Label htmlFor="payment_terms">Condizioni di Pagamento</Label>
            <Select value={newOffer.payment_terms || "none"} onValueChange={(value) => setNewOffer({ ...newOffer, payment_terms: value === "none" ? "" : value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona condizioni" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna</SelectItem>
                <SelectItem value="Alla consegna">Alla consegna</SelectItem>
                <SelectItem value="30 giorni">30 giorni</SelectItem>
                <SelectItem value="60 giorni">60 giorni</SelectItem>
                <SelectItem value="90 giorni">90 giorni</SelectItem>
                <SelectItem value="50% anticipo, 50% alla consegna">50% anticipo, 50% alla consegna</SelectItem>
                <SelectItem value="custom">Altro (specificare)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {newOffer.payment_terms === 'custom' && (
            <div>
              <Label htmlFor="custom_payment">Specificare condizioni di pagamento</Label>
              <Input
                id="custom_payment"
                value={customPaymentTerms}
                onChange={(e) => setCustomPaymentTerms(e.target.value)}
                placeholder="Es: 30% anticipo, saldo rateizzato in 3 mesi"
              />
            </div>
          )}

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
