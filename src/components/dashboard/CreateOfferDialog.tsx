import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CreateOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  defaultStatus?: 'richiesta_offerta' | 'offerta_pronta' | 'offerta_inviata' | 'negoziazione' | 'accettata' | 'rifiutata';
  leadData?: {
    leadId?: string;
    customerName?: string;
    amount?: number;
  };
}

export function CreateOfferDialog({ open, onOpenChange, onSuccess, defaultStatus = 'richiesta_offerta', leadData }: CreateOfferDialogProps) {
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [includeCertificazione, setIncludeCertificazione] = useState(true);
  const [includeGaranzia, setIncludeGaranzia] = useState(true);
  const [inclusoCustom, setInclusoCustom] = useState('');
  const [esclusoCaricoPredisposizione, setEsclusoCaricoPredisposizione] = useState(false);
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [selectedProducts, setSelectedProducts] = useState<Array<{
    product_id: string;
    product_name: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount_percent: number;
    vat_rate: number;
    reverse_charge: boolean;
    notes?: string;
  }>>([]);
  
  const [newOffer, setNewOffer] = useState({
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: defaultStatus,
    template: 'zapper' as 'zapper' | 'vesuviano' | 'zapperpro',
    timeline_produzione: '',
    timeline_consegna: '',
    timeline_installazione: '',
    timeline_collaudo: '',
    incluso_fornitura: '',
    escluso_fornitura: '',
    payment_method: '',
    payment_agreement: '',
    reverse_charge: false
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadProducts();
      // Precompila i dati dal lead se forniti
      if (leadData) {
        setNewOffer(prev => ({
          ...prev,
          title: leadData.customerName ? `Offerta per ${leadData.customerName}` : prev.title,
          amount: leadData.amount || prev.amount,
        }));
      }
    }
  }, [open, leadData]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, code, company_name')
      .eq('active', true)
      .order('name');
    
    setCustomers(data || []);
  };

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, code, base_price, description')
      .order('name');
    
    setProducts(data || []);
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

      // Build incluso_fornitura string
      let inclusoItems: string[] = [];
      if (includeCertificazione) inclusoItems.push('✓ Certificazione di conformità');
      if (includeGaranzia) inclusoItems.push('✓ 1 anno di garanzia');
      if (inclusoCustom) {
        inclusoItems = inclusoItems.concat(inclusoCustom.split('\n').filter(line => line.trim()));
      }
      const inclusoFornitura = inclusoItems.join('\n');

      // Calculate total amount from selected products
      const calculatedAmount = selectedProducts.reduce((total, item) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        return total + (subtotal - discount);
      }, 0);

      const offerNumber = `OFF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Crea l'offerta - il trigger creerà automaticamente il lead e il codice univoco
      const { data: offerData, error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: newOffer.customer_id,
          customer_name: customer.name,
          title: newOffer.title,
          description: newOffer.description,
          amount: calculatedAmount || newOffer.amount,
          valid_until: newOffer.valid_until || null,
          status: newOffer.status,
          template: newOffer.template,
          timeline_produzione: newOffer.timeline_produzione || null,
          timeline_consegna: newOffer.timeline_consegna || null,
          timeline_installazione: newOffer.timeline_installazione || null,
          timeline_collaudo: newOffer.timeline_collaudo || null,
          incluso_fornitura: inclusoFornitura || null,
          escluso_fornitura: newOffer.escluso_fornitura || null,
          payment_method: newOffer.payment_method || null,
          payment_agreement: newOffer.payment_agreement || null,
          reverse_charge: newOffer.reverse_charge,
          lead_id: leadData?.leadId || null
        }])
        .select('id, unique_code')
        .single();

      if (error) throw error;

      // Insert offer items if any
      if (selectedProducts.length > 0) {
        const offerItems = selectedProducts.map(item => ({
          offer_id: offerData.id,
          product_id: item.product_id.startsWith('manual-') ? null : item.product_id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          notes: item.notes || null
        }));

        const { error: itemsError } = await supabase
          .from('offer_items')
          .insert(offerItems);

        if (itemsError) throw itemsError;
      }

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
    } catch (error: any) {
      console.error('Error creating offer:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione dell'offerta",
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
      status: defaultStatus,
      template: 'zapper',
      timeline_produzione: '',
      timeline_consegna: '',
      timeline_installazione: '',
      timeline_collaudo: '',
      incluso_fornitura: '',
      escluso_fornitura: '',
      payment_method: '',
      payment_agreement: '',
      reverse_charge: false
    });
    setSelectedProducts([]);
    setIncludeCertificazione(true);
    setIncludeGaranzia(true);
    setInclusoCustom('');
    setEsclusoCaricoPredisposizione(false);
    setCurrentProductId('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{defaultStatus === 'richiesta_offerta' ? 'Nuova Richiesta di Offerta' : 'Nuova Offerta'}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="customer">Azienda *</Label>
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
                          return customer ? `${customer.code} - ${customer.company_name || customer.name}` : "Seleziona azienda";
                        })()
                      : "Seleziona azienda"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Cerca azienda..." />
                    <CommandList>
                      <CommandEmpty>Nessuna azienda trovata.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.code} ${customer.company_name || customer.name}`}
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
                            {customer.code} - {customer.company_name || customer.name}
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
                placeholder="Es: Forno professionale per ristorante"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={newOffer.description}
                onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                placeholder="Descrizione dettagliata dell'offerta..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="template">Template Offerta</Label>
              <Select 
                value={newOffer.template} 
                onValueChange={(value: 'zapper' | 'vesuviano' | 'zapperpro') => 
                  setNewOffer({ ...newOffer, template: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zapper">ZAPPER - Renewed Air</SelectItem>
                  <SelectItem value="vesuviano">Vesuviano - Tradizione e Qualità</SelectItem>
                  <SelectItem value="zapperpro">ZAPPER PRO - Professional Solutions</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tempi di Produzione</Label>
                <Input
                  value={newOffer.timeline_produzione}
                  onChange={(e) => setNewOffer({ ...newOffer, timeline_produzione: e.target.value })}
                  placeholder="Es: 2-3 settimane"
                />
              </div>
              <div>
                <Label>Tempi di Consegna</Label>
                <Input
                  value={newOffer.timeline_consegna}
                  onChange={(e) => setNewOffer({ ...newOffer, timeline_consegna: e.target.value })}
                  placeholder="Es: 3-5 giorni"
                />
              </div>
              <div>
                <Label>Tempi di Installazione</Label>
                <Input
                  value={newOffer.timeline_installazione}
                  onChange={(e) => setNewOffer({ ...newOffer, timeline_installazione: e.target.value })}
                  placeholder="Es: 1 giorno"
                />
              </div>
              <div>
                <Label>Tempi di Collaudo</Label>
                <Input
                  value={newOffer.timeline_collaudo}
                  onChange={(e) => setNewOffer({ ...newOffer, timeline_collaudo: e.target.value })}
                  placeholder="Es: 2 ore"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Cosa Include la Fornitura</Label>
              <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="certificazione"
                    checked={includeCertificazione}
                    onCheckedChange={(checked) => setIncludeCertificazione(checked === true)}
                  />
                  <label htmlFor="certificazione" className="text-sm cursor-pointer">
                    ✓ Certificazione di conformità
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="garanzia"
                    checked={includeGaranzia}
                    onCheckedChange={(checked) => setIncludeGaranzia(checked === true)}
                  />
                  <label htmlFor="garanzia" className="text-sm cursor-pointer">
                    ✓ 1 anno di garanzia
                  </label>
                </div>
              </div>
              <Textarea
                value={inclusoCustom}
                onChange={(e) => setInclusoCustom(e.target.value)}
                placeholder="Una voce per riga (usa ✓ per le spunte)"
                rows={3}
              />
            </div>

            <div>
              <Label>Cosa Esclude la Fornitura</Label>
              <div className="flex items-center gap-2 mb-2">
                <Checkbox
                  id="escluso-carico"
                  checked={esclusoCaricoPredisposizione}
                  onCheckedChange={(checked) => {
                    setEsclusoCaricoPredisposizione(checked === true);
                    const testoEsclusione = "Si richiede al cliente di predisporre prima del ns. arrivo di punti di carico/scarico acqua e una presa elettrica. N.B. qualora in fase di installazione non vi è stata fatta predisposizione, l'allaccio elettrico ha un costo supplementare di 200,00 € e l'allaccio idrico ha un costo supplementare di 200,00 €.";
                    if (checked) {
                      setNewOffer({ 
                        ...newOffer, 
                        escluso_fornitura: newOffer.escluso_fornitura 
                          ? `${newOffer.escluso_fornitura}\n${testoEsclusione}`
                          : testoEsclusione
                      });
                    } else {
                      setNewOffer({ 
                        ...newOffer, 
                        escluso_fornitura: newOffer.escluso_fornitura?.replace(testoEsclusione, '').replace(/\n\n+/g, '\n').trim() || ''
                      });
                    }
                  }}
                />
                <label htmlFor="escluso-carico" className="text-sm cursor-pointer">
                  Carico e scarico acqua / collegamento elettrico
                </label>
              </div>
              <Textarea
                value={newOffer.escluso_fornitura}
                onChange={(e) => setNewOffer({ ...newOffer, escluso_fornitura: e.target.value })}
                placeholder="Es: Non sono inclusi lavori di muratura..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Metodo di Pagamento</Label>
                <Select 
                  value={newOffer.payment_method} 
                  onValueChange={(value) => setNewOffer({ ...newOffer, payment_method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona metodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bonifico">Bonifico bancario</SelectItem>
                    <SelectItem value="contrassegno">Contrassegno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Accordi di Pagamento</Label>
                <Select 
                  value={newOffer.payment_agreement || ''} 
                  onValueChange={(value) => setNewOffer({ ...newOffer, payment_agreement: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona accordo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50% acconto - 50% a consegna">50% acconto - 50% a consegna</SelectItem>
                    <SelectItem value="Pagamento anticipato">Pagamento anticipato</SelectItem>
                    <SelectItem value="altro - personalizzato">altro - personalizzato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="offer-reverse-charge"
                checked={newOffer.reverse_charge}
                onCheckedChange={(checked) => setNewOffer({ ...newOffer, reverse_charge: checked === true })}
              />
              <label htmlFor="offer-reverse-charge" className="text-sm cursor-pointer">
                Reverse Charge (IVA a 0% - Inversione contabile)
              </label>
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

            {/* Sezione Prodotti */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Prodotti e Servizi</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedProducts([...selectedProducts, {
                      product_id: `manual-${Date.now()}`,
                      product_name: '',
                      description: '',
                      quantity: 1,
                      unit_price: 0,
                      discount_percent: 0,
                      vat_rate: 22,
                      reverse_charge: false,
                      notes: ''
                    }]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Voce Manuale
                </Button>
              </div>
              <div className="flex gap-2">
                <Select
                  value={currentProductId}
                  onValueChange={setCurrentProductId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona prodotto" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.code} - {product.name} - €{product.base_price?.toFixed(2) || '0.00'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={() => {
                    const product = products.find(p => p.id === currentProductId);
                    if (product) {
                      setSelectedProducts([...selectedProducts, {
                        product_id: product.id,
                        product_name: product.name,
                        description: product.description || '',
                        quantity: 1,
                        unit_price: product.base_price || 0,
                        discount_percent: 0,
                        vat_rate: 22,
                        reverse_charge: false,
                        notes: ''
                      }]);
                      setCurrentProductId('');
                    }
                  }}
                  disabled={!currentProductId}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi
                </Button>
              </div>

              {/* Lista articoli selezionati */}
              {selectedProducts.length > 0 && (
                <div className="border rounded-lg p-3 space-y-2">
                  {selectedProducts.map((item, index) => (
                    <div key={index} className="border rounded p-4 space-y-3 bg-muted/50">
                      <div className="flex items-start justify-between gap-2">
                        <Input
                          placeholder="Nome prodotto/servizio"
                          value={item.product_name}
                          onChange={(e) => {
                            const updated = [...selectedProducts];
                            updated[index].product_name = e.target.value;
                            setSelectedProducts(updated);
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedProducts(selectedProducts.filter((_, i) => i !== index))}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Descrizione"
                        value={item.description}
                        onChange={(e) => {
                          const updated = [...selectedProducts];
                          updated[index].description = e.target.value;
                          setSelectedProducts(updated);
                        }}
                        rows={2}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <Label className="text-xs">Quantità</Label>
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const updated = [...selectedProducts];
                              updated[index].quantity = parseFloat(e.target.value) || 0;
                              setSelectedProducts(updated);
                            }}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Prezzo Unitario</Label>
                          <Input
                            type="number"
                            value={item.unit_price}
                            onChange={(e) => {
                              const updated = [...selectedProducts];
                              updated[index].unit_price = parseFloat(e.target.value) || 0;
                              setSelectedProducts(updated);
                            }}
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Sconto %</Label>
                          <Input
                            type="number"
                            value={item.discount_percent}
                            onChange={(e) => {
                              const updated = [...selectedProducts];
                              updated[index].discount_percent = parseFloat(e.target.value) || 0;
                              setSelectedProducts(updated);
                            }}
                            min="0"
                            max="100"
                            step="0.01"
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium text-right">
                        Totale: €{((item.quantity * item.unit_price) * (1 - item.discount_percent / 100)).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="text-lg font-bold text-right pt-2 border-t">
                    Totale Generale: €{selectedProducts.reduce((total, item) => {
                      return total + ((item.quantity * item.unit_price) * (1 - item.discount_percent / 100));
                    }, 0).toFixed(2)}
                  </div>
                </div>
              )}
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
        </ScrollArea>

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
