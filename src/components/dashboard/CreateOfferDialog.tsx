import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedGlobalPriceListId, setSelectedGlobalPriceListId] = useState<string>('');
  const [currentProductPrice, setCurrentProductPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [selectionType, setSelectionType] = useState<'customer' | 'lead'>('customer');
  const [selectedLeadId, setSelectedLeadId] = useState<string>('');
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
    language: 'it' as 'it' | 'en' | 'fr',
    timeline_produzione: '',
    timeline_consegna: '',
    timeline_installazione: '',
    timeline_collaudo: '',
    incluso_fornitura: '',
    escluso_fornitura: '',
    payment_method: '',
    payment_agreement: '',
    vat_regime: 'standard' as 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue',
    company_entity: 'climatel' as 'climatel' | 'unita1'
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadLeads();
      loadPriceLists();
      // Precompila i dati dal lead se forniti
      if (leadData) {
        setNewOffer(prev => ({
          ...prev,
          title: leadData.customerName ? `Offerta per ${leadData.customerName}` : prev.title,
          amount: leadData.amount || prev.amount,
        }));
        // Auto-select lead if coming from lead page
        if (leadData.leadId) {
          setSelectionType('lead');
          setSelectedLeadId(leadData.leadId);
        }
      }
    }
  }, [open, leadData]);

  useEffect(() => {
    if (open) {
      loadProducts(selectedGlobalPriceListId);
    }
  }, [open, selectedGlobalPriceListId]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, name, email, code, company_name')
      .eq('active', true)
      .order('name');
    
    setCustomers(data || []);
  };

  const loadLeads = async () => {
    const { data } = await supabase
      .from('leads')
      .select('id, name, email, phone, company, pipeline')
      .order('name');
    
    setLeads(data || []);
  };

  const loadProducts = async (priceListId?: string) => {
    if (priceListId && priceListId !== 'none') {
      // Se c'è un listino selezionato, carica solo i prodotti di quel listino
      const { data } = await supabase
        .from('price_list_items')
        .select(`
          price,
          products:product_id (
            id,
            name,
            code,
            base_price,
            description
          )
        `)
        .eq('price_list_id', priceListId);
      
      if (data) {
        const productsWithPrice = (data as any[]).map((item: any) => ({
          ...item.products,
          price_from_list: item.price
        }));
        setProducts(productsWithPrice || []);
      }
    } else {
      // Altrimenti carica tutti i prodotti
      const { data } = await supabase
        .from('products')
        .select('id, name, code, base_price, description')
        .eq('is_active', true)
        .order('name');
      
      setProducts(data || []);
    }
  };

  const loadPriceLists = async () => {
    const { data } = await supabase
      .from('price_lists')
      .select('id, name, code')
      .eq('is_active', true)
      .order('name');
    
    setPriceLists(data || []);
  };

  const handleProductChange = async (productId: string) => {
    setCurrentProductId(productId);
    setCurrentProductPrice(0);
    
    if (productId) {
      const product = products.find(p => p.id === productId);
      if (product) {
        // Se c'è un listino globale selezionato, usa il prezzo da lì
        if (selectedGlobalPriceListId && product.price_from_list) {
          setCurrentProductPrice(product.price_from_list);
        } else {
          // Altrimenti usa il prezzo base
          setCurrentProductPrice(product.base_price || 0);
        }
      }
    }
  };

  const handleGlobalPriceListChange = (priceListId: string) => {
    setSelectedGlobalPriceListId(priceListId === 'none' ? '' : priceListId);
    setCurrentProductId('');
    setCurrentProductPrice(0);
  };

  const handleCreateOffer = async () => {
    try {
      let customerName = '';
      let customerId = newOffer.customer_id;
      let leadId = leadData?.leadId || null;

      if (selectionType === 'customer') {
        const customer = customers.find(c => c.id === newOffer.customer_id);
        if (!customer) {
          toast({
            title: "Errore",
            description: "Seleziona un cliente valido",
            variant: "destructive",
          });
          return;
        }
        customerName = customer.name;
      } else {
        const lead = leads.find(l => l.id === selectedLeadId);
        if (!lead) {
          toast({
            title: "Errore",
            description: "Seleziona un lead valido",
            variant: "destructive",
          });
          return;
        }
        customerName = lead.company || lead.name;
        customerId = null;
        leadId = selectedLeadId;
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
          customer_id: customerId,
          customer_name: customerName,
          title: newOffer.title,
          description: newOffer.description,
          amount: calculatedAmount || newOffer.amount,
          valid_until: newOffer.valid_until || null,
          status: newOffer.status,
          template: newOffer.template,
          language: newOffer.language,
          timeline_produzione: newOffer.timeline_produzione || null,
          timeline_consegna: newOffer.timeline_consegna || null,
          timeline_installazione: newOffer.timeline_installazione || null,
          timeline_collaudo: newOffer.timeline_collaudo || null,
          incluso_fornitura: inclusoFornitura || null,
          escluso_fornitura: newOffer.escluso_fornitura || null,
          payment_method: newOffer.payment_method || null,
          payment_agreement: newOffer.payment_agreement || null,
          vat_regime: newOffer.vat_regime,
          company_entity: newOffer.company_entity,
          lead_id: leadId
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
      language: 'it',
      timeline_produzione: '',
      timeline_consegna: '',
      timeline_installazione: '',
      timeline_collaudo: '',
      incluso_fornitura: '',
      escluso_fornitura: '',
      payment_method: '',
      payment_agreement: '',
      vat_regime: 'standard',
      company_entity: 'climatel'
    });
    setSelectedProducts([]);
    setIncludeCertificazione(true);
    setIncludeGaranzia(true);
    setInclusoCustom('');
    setEsclusoCaricoPredisposizione(false);
    setCurrentProductId('');
    setSelectedGlobalPriceListId('');
    setCurrentProductPrice(0);
    setSelectionType('customer');
    setSelectedLeadId('');
  };

  const formContent = (
    <ScrollArea className={cn(
      "pr-4",
      isMobile ? "h-[calc(100vh-180px)]" : "max-h-[calc(90vh-120px)]"
    )}>
      <div className="space-y-4 pb-4">
        {/* Selection type toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectionType === 'customer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionType('customer');
              setSelectedLeadId('');
            }}
            className="flex-1"
          >
            Cliente
          </Button>
          <Button
            type="button"
            variant={selectionType === 'lead' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setSelectionType('lead');
              setNewOffer({ ...newOffer, customer_id: '' });
            }}
            className="flex-1"
          >
            Lead
          </Button>
        </div>

        {selectionType === 'customer' ? (
          <div>
            <Label htmlFor="customer">Azienda *</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between text-sm"
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
              <PopoverContent className={cn("p-0", isMobile ? "w-[calc(100vw-2rem)]" : "w-[400px]")} align="start">
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
        ) : (
          <div>
            <Label htmlFor="lead">Lead *</Label>
            <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerSearchOpen}
                  className="w-full justify-between text-sm"
                >
                  {selectedLeadId
                    ? (() => {
                        const lead = leads.find((l) => l.id === selectedLeadId);
                        return lead ? (lead.company || lead.name) : "Seleziona lead";
                      })()
                    : "Seleziona lead"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className={cn("p-0", isMobile ? "w-[calc(100vw-2rem)]" : "w-[400px]")} align="start">
                <Command>
                  <CommandInput placeholder="Cerca lead..." />
                  <CommandList>
                    <CommandEmpty>Nessun lead trovato.</CommandEmpty>
                    <CommandGroup>
                      {leads.map((lead) => (
                        <CommandItem
                          key={lead.id}
                          value={`${lead.company || ''} ${lead.name}`}
                          onSelect={() => {
                            setSelectedLeadId(lead.id);
                            setCustomerSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLeadId === lead.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{lead.company || lead.name}</span>
                            {lead.company && <span className="text-xs text-muted-foreground">{lead.name}</span>}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              Seleziona un lead se l'azienda non è ancora in anagrafica clienti
            </p>
          </div>
        )}

        <div>
          <Label htmlFor="priceList">Listino di Riferimento (opzionale)</Label>
          <Select
            value={selectedGlobalPriceListId || 'none'}
            onValueChange={handleGlobalPriceListChange}
          >
            <SelectTrigger>
              <SelectValue placeholder="Nessun listino - Mostra tutti i prodotti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nessun listino - Mostra tutti i prodotti</SelectItem>
              {priceLists.map((priceList) => (
                <SelectItem key={priceList.id} value={priceList.id}>
                  {priceList.code} - {priceList.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Selezionando un listino verranno mostrati solo i prodotti presenti in quel listino
          </p>
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

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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

          <div>
            <Label htmlFor="language">Lingua Offerta</Label>
            <Select 
              value={newOffer.language} 
              onValueChange={(value: 'it' | 'en' | 'fr') => 
                setNewOffer({ ...newOffer, language: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona lingua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                <SelectItem value="en">🇬🇧 Inglese</SelectItem>
                <SelectItem value="fr">🇫🇷 Francese</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Il contenuto verrà tradotto automaticamente
            </p>
          </div>
        </div>

        {/* Selettore entità aziendale */}
        <div>
          <Label htmlFor="company_entity">Intestazione e Coordinate Bancarie</Label>
          <Select 
            value={newOffer.company_entity} 
            onValueChange={(value: 'climatel' | 'unita1') => 
              setNewOffer({ ...newOffer, company_entity: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona entità" />
            </SelectTrigger>
            <SelectContent className="z-[100] bg-background">
              <SelectItem value="climatel">CLIMATEL di Elefante Pasquale</SelectItem>
              <SelectItem value="unita1">UNITA 1 di Stanislao Elefante</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Seleziona quale intestazione e coordinate bancarie utilizzare nell'offerta
          </p>
        </div>

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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

        <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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

        <div>
          <Label htmlFor="vat-regime">Regime IVA</Label>
          <Select 
            value={newOffer.vat_regime} 
            onValueChange={(value: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue') => 
              setNewOffer({ ...newOffer, vat_regime: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona regime IVA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="standard">Regime Standard (IVA 22%)</SelectItem>
              <SelectItem value="reverse_charge">Reverse Charge - N.6.7 (IVA 0%)</SelectItem>
              <SelectItem value="intra_ue">Cessione Intra UE - N.3.2 (IVA 0%)</SelectItem>
              <SelectItem value="extra_ue">Cessione Extra UE - N.3.1 (IVA 0%)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            Seleziona il regime IVA applicabile all'offerta
          </p>
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
                  notes: ''
                }]);
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isMobile ? "Aggiungi" : "Aggiungi Voce Manuale"}
            </Button>
          </div>

          <div>
            <Label>Seleziona Prodotto</Label>
            <Select
              value={currentProductId}
              onValueChange={handleProductChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona prodotto" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id}>
                    {product.code} - {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedGlobalPriceListId && (
              <p className="text-xs text-muted-foreground mt-1">
                Prodotti filtrati dal listino selezionato
              </p>
            )}
          </div>

          {currentProductId && (
            <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg border">
              <div className="flex-1 text-sm">
                {(() => {
                  const product = products.find(p => p.id === currentProductId);
                  if (!product) return null;
                  
                  return (
                    <div>
                      <span className="font-medium">{product.code} - {product.name}</span>
                      <div className="text-muted-foreground">
                        Prezzo: <span className="font-semibold text-foreground">€{currentProductPrice.toFixed(2)}</span>
                        <span className="text-xs ml-2">
                          {selectedGlobalPriceListId ? (
                            `(da listino ${priceLists.find(pl => pl.id === selectedGlobalPriceListId)?.code})`
                          ) : (
                            '(prezzo base)'
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
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
                      unit_price: currentProductPrice,
                      discount_percent: 0,
                      vat_rate: 22,
                      notes: selectedGlobalPriceListId 
                        ? `Listino: ${priceLists.find(pl => pl.id === selectedGlobalPriceListId)?.code}`
                        : ''
                    }]);
                    setCurrentProductId('');
                    setCurrentProductPrice(0);
                  }
                }}
                disabled={!currentProductId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi
              </Button>
            </div>
          )}

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
                  <div className={cn("grid gap-2", isMobile ? "grid-cols-3" : "grid-cols-3")}>
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
                      <Label className="text-xs">Prezzo Unit.</Label>
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
                        step="1"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label htmlFor="status">Stato</Label>
          <Select 
            value={newOffer.status} 
            onValueChange={(value: any) => setNewOffer({ ...newOffer, status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="richiesta_offerta">Richiesta Offerta</SelectItem>
              <SelectItem value="offerta_pronta">Offerta Pronta</SelectItem>
              <SelectItem value="offerta_inviata">Offerta Inviata</SelectItem>
              <SelectItem value="negoziazione">Negoziazione</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </ScrollArea>
  );

  const actionButtons = (
    <div className={cn("flex gap-2 pt-4", isMobile ? "flex-col" : "justify-end")}>
      <Button variant="outline" onClick={() => onOpenChange(false)} className={isMobile ? "w-full" : ""}>
        Annulla
      </Button>
      <Button onClick={handleCreateOffer} disabled={loading} className={isMobile ? "w-full" : ""}>
        {loading ? "Creazione..." : "Crea Offerta"}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh]">
          <DrawerHeader>
            <DrawerTitle>
              {defaultStatus === 'richiesta_offerta' ? 'Nuova Richiesta di Offerta' : 'Nuova Offerta'}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 flex-1 flex flex-col">
            {formContent}
            {actionButtons}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            {defaultStatus === 'richiesta_offerta' ? 'Nuova Richiesta di Offerta' : 'Nuova Offerta'}
          </DialogTitle>
        </DialogHeader>
        {formContent}
        {actionButtons}
      </DialogContent>
    </Dialog>
  );
}
