import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Check, ChevronsUpDown, Plus, X, User, FileText, Clock, Package, CreditCard, ChevronDown, ChevronRight, Building2, ListChecks, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { OfferLivePreview } from "./OfferLivePreview";

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

// Section wrapper component
function FormSection({ 
  title, 
  icon: Icon, 
  children, 
  defaultOpen = true,
  badge
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-lg border bg-card overflow-hidden">
        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">{title}</span>
            {badge && (
              <Badge variant="secondary" className="text-xs">
                {badge}
              </Badge>
            )}
          </div>
          {isOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-4 space-y-4">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function CreateOfferDialog({ open, onOpenChange, onSuccess, defaultStatus = 'richiesta_offerta', leadData }: CreateOfferDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [showPreview, setShowPreview] = useState(true);
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
  const [esclusoPuliziaCanna, setEsclusoPuliziaCanna] = useState(false);
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [productSearchOpen, setProductSearchOpen] = useState(false);
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

  // Calculate total from products
  const calculatedTotal = useMemo(() => {
    return selectedProducts.reduce((total, item) => {
      const subtotal = item.quantity * item.unit_price;
      const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
      return total + (subtotal - discount);
    }, 0);
  }, [selectedProducts]);

  useEffect(() => {
    if (open) {
      loadCustomers();
      loadLeads();
      loadPriceLists();
      if (leadData) {
        setNewOffer(prev => ({
          ...prev,
          title: leadData.customerName ? `Offerta per ${leadData.customerName}` : prev.title,
          amount: leadData.amount || prev.amount,
        }));
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
      .select('id, company_name, contact_name, email, phone, pipeline')
      .order('company_name');
    setLeads(data || []);
  };

  const loadProducts = async (priceListId?: string) => {
    if (priceListId && priceListId !== 'none') {
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
        if (selectedGlobalPriceListId && product.price_from_list) {
          setCurrentProductPrice(product.price_from_list);
        } else {
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
        customerName = lead.company_name || lead.contact_name;
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

      let inclusoItems: string[] = [];
      if (includeCertificazione) inclusoItems.push('✓ Certificazione di conformità');
      if (includeGaranzia) inclusoItems.push('✓ 1 anno di garanzia');
      if (inclusoCustom) {
        inclusoItems = inclusoItems.concat(inclusoCustom.split('\n').filter(line => line.trim()));
      }
      const inclusoFornitura = inclusoItems.join('\n');

      const offerNumber = `OFF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const { data: offerData, error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: customerId,
          customer_name: customerName,
          title: newOffer.title,
          description: newOffer.description,
          amount: calculatedTotal || newOffer.amount,
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
    setEsclusoPuliziaCanna(false);
    setCurrentProductId('');
    setSelectedGlobalPriceListId('');
    setCurrentProductPrice(0);
    setSelectionType('customer');
    setSelectedLeadId('');
  };

  const addManualProduct = () => {
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
  };

  const addSelectedProduct = () => {
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
  };

  const updateProduct = (index: number, field: string, value: any) => {
    const updated = [...selectedProducts];
    (updated[index] as any)[field] = value;
    setSelectedProducts(updated);
  };

  const removeProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const handleEsclusoCaricoPredisposizione = (checked: boolean) => {
    setEsclusoCaricoPredisposizione(checked);
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
  };

  const handleEsclusoPuliziaCanna = (checked: boolean) => {
    setEsclusoPuliziaCanna(checked);
    const testoPulizia = "È obbligatoria la pulizia della canna fumaria prima del nostro intervento, a meno che non sia già pulita da massimo 45 giorni.";
    if (checked) {
      setNewOffer({ 
        ...newOffer, 
        escluso_fornitura: newOffer.escluso_fornitura 
          ? `${newOffer.escluso_fornitura}\n${testoPulizia}`
          : testoPulizia
      });
    } else {
      setNewOffer({ 
        ...newOffer, 
        escluso_fornitura: newOffer.escluso_fornitura?.replace(testoPulizia, '').replace(/\n\n+/g, '\n').trim() || ''
      });
    }
  };

  const formContent = (
    <ScrollArea className={cn(
      "pr-4 h-full",
      isMobile ? "h-[calc(100vh-180px)]" : "h-[calc(90vh-180px)]"
    )}>
      <div className="space-y-3 pb-4">
        {/* Section 1: Cliente/Lead */}
        <FormSection title="Cliente / Lead" icon={User} defaultOpen={true}>
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
            <div className="space-y-1.5">
              <Label className="text-xs">Azienda *</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between text-sm h-9"
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
            <div className="space-y-1.5">
              <Label className="text-xs">Lead *</Label>
              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={customerSearchOpen}
                    className="w-full justify-between text-sm h-9"
                  >
                    {selectedLeadId
                      ? (() => {
                          const lead = leads.find((l) => l.id === selectedLeadId);
                          return lead ? (lead.company_name || lead.contact_name) : "Seleziona lead";
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
                            value={`${lead.company_name || ''} ${lead.contact_name || ''}`}
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
                              <span>{lead.company_name || lead.contact_name}</span>
                              {lead.company_name && <span className="text-xs text-muted-foreground">{lead.contact_name}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                Seleziona un lead se l'azienda non è in anagrafica
              </p>
            </div>
          )}
        </FormSection>

        {/* Section 2: Dettagli Offerta */}
        <FormSection title="Dettagli Offerta" icon={FileText} defaultOpen={true}>
          <div className="space-y-1.5">
            <Label className="text-xs">Titolo Offerta *</Label>
            <Input
              value={newOffer.title}
              onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
              placeholder="Es: Forno professionale per ristorante"
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrizione</Label>
            <Textarea
              value={newOffer.description}
              onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
              placeholder="Descrizione dettagliata dell'offerta..."
              rows={2}
              className="resize-none"
            />
          </div>

          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1.5">
              <Label className="text-xs">Template</Label>
              <Select 
                value={newOffer.template} 
                onValueChange={(value: 'zapper' | 'vesuviano' | 'zapperpro') => 
                  setNewOffer({ ...newOffer, template: value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleziona template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zapper">ZAPPER</SelectItem>
                  <SelectItem value="vesuviano">Vesuviano</SelectItem>
                  <SelectItem value="zapperpro">ZAPPER PRO</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Lingua</Label>
              <Select 
                value={newOffer.language} 
                onValueChange={(value: 'it' | 'en' | 'fr') => 
                  setNewOffer({ ...newOffer, language: value })
                }
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleziona lingua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                  <SelectItem value="en">🇬🇧 Inglese</SelectItem>
                  <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Intestazione e Coordinate Bancarie</Label>
            <Select 
              value={newOffer.company_entity} 
              onValueChange={(value: 'climatel' | 'unita1') => 
                setNewOffer({ ...newOffer, company_entity: value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleziona entità" />
              </SelectTrigger>
              <SelectContent className="z-[100] bg-background">
                <SelectItem value="climatel">CLIMATEL di Elefante Pasquale</SelectItem>
                <SelectItem value="unita1">UNITA 1 di Stanislao Elefante</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1.5">
              <Label className="text-xs">Valida Fino al</Label>
              <Input
                type="date"
                value={newOffer.valid_until}
                onChange={(e) => setNewOffer({ ...newOffer, valid_until: e.target.value })}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Stato</Label>
              <Select 
                value={newOffer.status} 
                onValueChange={(value: any) => setNewOffer({ ...newOffer, status: value })}
              >
                <SelectTrigger className="h-9">
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
        </FormSection>

        {/* Section 3: Pagamento - moved before products */}
        <FormSection title="Pagamento e IVA" icon={CreditCard} defaultOpen={false}>
          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1.5">
              <Label className="text-xs">Metodo di Pagamento</Label>
              <Select 
                value={newOffer.payment_method} 
                onValueChange={(value) => setNewOffer({ ...newOffer, payment_method: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleziona metodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bonifico">Bonifico bancario</SelectItem>
                  <SelectItem value="contrassegno">Contrassegno</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs">Accordi di Pagamento</Label>
              <Select 
                value={newOffer.payment_agreement || ''} 
                onValueChange={(value) => setNewOffer({ ...newOffer, payment_agreement: value })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Seleziona accordo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50% acconto - 50% a consegna">50% acconto - 50% a consegna</SelectItem>
                  <SelectItem value="Pagamento anticipato">Pagamento anticipato</SelectItem>
                  <SelectItem value="altro - personalizzato">Altro - personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Regime IVA</Label>
            <Select 
              value={newOffer.vat_regime} 
              onValueChange={(value: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue') => 
                setNewOffer({ ...newOffer, vat_regime: value })
              }
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Seleziona regime IVA" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (IVA 22%)</SelectItem>
                <SelectItem value="reverse_charge">Reverse Charge - N.6.7 (IVA 0%)</SelectItem>
                <SelectItem value="intra_ue">Cessione Intra UE - N.3.2 (IVA 0%)</SelectItem>
                <SelectItem value="extra_ue">Cessione Extra UE - N.3.1 (IVA 0%)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </FormSection>

        {/* Section 4: Prodotti */}
        <FormSection 
          title="Prodotti e Servizi" 
          icon={Package} 
          defaultOpen={true}
          badge={selectedProducts.length > 0 ? `${selectedProducts.length}` : undefined}
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Listino di Riferimento</Label>
            <Select
              value={selectedGlobalPriceListId || 'none'}
              onValueChange={handleGlobalPriceListChange}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Nessun listino" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessun listino - Tutti i prodotti</SelectItem>
                {priceLists.map((priceList) => (
                  <SelectItem key={priceList.id} value={priceList.id}>
                    {priceList.code} - {priceList.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Seleziona Prodotto</Label>
            <div className="flex gap-2">
              <Popover open={productSearchOpen} onOpenChange={setProductSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productSearchOpen}
                    className="flex-1 justify-between font-normal h-9"
                  >
                    {currentProductId
                      ? (() => {
                          const product = products.find(p => p.id === currentProductId);
                          return product ? `${product.code} - ${product.name}` : "Seleziona";
                        })()
                      : "Seleziona prodotto"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0 z-[100]" align="start">
                  <Command>
                    <CommandInput placeholder="Cerca prodotto..." />
                    <CommandList>
                      <CommandEmpty>Nessun prodotto trovato.</CommandEmpty>
                      <CommandGroup>
                        {products.map((product) => (
                          <CommandItem
                            key={product.id}
                            value={`${product.code} ${product.name}`}
                            onSelect={() => {
                              handleProductChange(product.id);
                              setProductSearchOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                currentProductId === product.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {product.code} - {product.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addManualProduct}
                className="h-9 px-3"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {currentProductId && (
            <div className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg border">
              <div className="flex-1 text-sm">
                {(() => {
                  const product = products.find(p => p.id === currentProductId);
                  if (!product) return null;
                  return (
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{product.name}</span>
                      <span className="text-primary font-semibold">€{currentProductPrice.toFixed(2)}</span>
                    </div>
                  );
                })()}
              </div>
              <Button
                type="button"
                size="sm"
                onClick={addSelectedProduct}
                disabled={!currentProductId}
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>
          )}

          {/* Lista prodotti selezionati */}
          {selectedProducts.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {selectedProducts.length} {selectedProducts.length === 1 ? 'articolo' : 'articoli'}
                </span>
                <span className="text-sm font-semibold text-primary">
                  Totale: €{calculatedTotal.toFixed(2)}
                </span>
              </div>
              
              {selectedProducts.map((item, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2 bg-background">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      placeholder="Nome prodotto/servizio"
                      value={item.product_name}
                      onChange={(e) => updateProduct(index, 'product_name', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(index)}
                      className="h-8 w-8 shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Descrizione"
                    value={item.description}
                    onChange={(e) => updateProduct(index, 'description', e.target.value)}
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Qtà</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateProduct(index, 'quantity', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Prezzo €</Label>
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateProduct(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.01"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sconto %</Label>
                      <Input
                        type="number"
                        value={item.discount_percent}
                        onChange={(e) => updateProduct(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                        min="0"
                        max="100"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </FormSection>

        {/* Section 4: Tempistiche */}
        <FormSection title="Tempistiche" icon={Clock} defaultOpen={false}>
          <div className={cn("grid gap-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempi di Produzione</Label>
              <Input
                value={newOffer.timeline_produzione}
                onChange={(e) => setNewOffer({ ...newOffer, timeline_produzione: e.target.value })}
                placeholder="Es: 2-3 settimane"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempi di Consegna</Label>
              <Input
                value={newOffer.timeline_consegna}
                onChange={(e) => setNewOffer({ ...newOffer, timeline_consegna: e.target.value })}
                placeholder="Es: 3-5 giorni"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempi di Installazione</Label>
              <Input
                value={newOffer.timeline_installazione}
                onChange={(e) => setNewOffer({ ...newOffer, timeline_installazione: e.target.value })}
                placeholder="Es: 1 giorno"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tempi di Collaudo</Label>
              <Input
                value={newOffer.timeline_collaudo}
                onChange={(e) => setNewOffer({ ...newOffer, timeline_collaudo: e.target.value })}
                placeholder="Es: 2 ore"
                className="h-9"
              />
            </div>
          </div>
        </FormSection>

        {/* Section 5: Fornitura */}
        <FormSection title="Incluso / Escluso dalla Fornitura" icon={ListChecks} defaultOpen={false}>
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-2 block">Cosa Include</Label>
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="certificazione"
                    checked={includeCertificazione}
                    onCheckedChange={(checked) => setIncludeCertificazione(checked === true)}
                  />
                  <label htmlFor="certificazione" className="text-sm cursor-pointer">
                    Certificazione di conformità
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="garanzia"
                    checked={includeGaranzia}
                    onCheckedChange={(checked) => setIncludeGaranzia(checked === true)}
                  />
                  <label htmlFor="garanzia" className="text-sm cursor-pointer">
                    1 anno di garanzia
                  </label>
                </div>
              </div>
              <Textarea
                value={inclusoCustom}
                onChange={(e) => setInclusoCustom(e.target.value)}
                placeholder="Altre voci incluse (una per riga)"
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            <Separator />

            <div>
              <Label className="text-xs mb-2 block">Cosa Esclude</Label>
              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="escluso-carico"
                    checked={esclusoCaricoPredisposizione}
                    onCheckedChange={(checked) => handleEsclusoCaricoPredisposizione(checked === true)}
                  />
                  <label htmlFor="escluso-carico" className="text-sm cursor-pointer">
                    Predisposizione impianti
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="escluso-pulizia-canna"
                    checked={esclusoPuliziaCanna}
                    onCheckedChange={(checked) => handleEsclusoPuliziaCanna(checked === true)}
                  />
                  <label htmlFor="escluso-pulizia-canna" className="text-sm cursor-pointer">
                    Pulizia canna fumaria obbligatoria
                  </label>
                </div>
              </div>
              <Textarea
                value={newOffer.escluso_fornitura}
                onChange={(e) => setNewOffer({ ...newOffer, escluso_fornitura: e.target.value })}
                placeholder="Altre esclusioni..."
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>
        </FormSection>
      </div>
    </ScrollArea>
  );

  // Compute customer name for preview
  const previewCustomerName = useMemo(() => {
    if (selectionType === 'customer') {
      const customer = customers.find(c => c.id === newOffer.customer_id);
      return customer ? (customer.company_name || customer.name) : '';
    } else {
      const lead = leads.find(l => l.id === selectedLeadId);
      return lead ? (lead.company_name || lead.contact_name) : '';
    }
  }, [selectionType, newOffer.customer_id, selectedLeadId, customers, leads]);

  const actionButtons = (
    <div className={cn(
      "flex gap-2 pt-4 border-t",
      isMobile ? "flex-col" : "justify-between items-center"
    )}>
      <div className="flex items-center gap-4">
        {selectedProducts.length > 0 && (
          <div className="text-sm text-muted-foreground">
            Totale: <span className="font-semibold text-foreground">€{calculatedTotal.toFixed(2)}</span>
          </div>
        )}
        {!isMobile && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Nascondi Preview' : 'Mostra Preview'}
          </Button>
        )}
      </div>
      <div className={cn("flex gap-2", isMobile ? "flex-col" : "")}>
        <Button variant="outline" onClick={() => onOpenChange(false)} className={isMobile ? "w-full" : ""}>
          Annulla
        </Button>
        <Button onClick={handleCreateOffer} disabled={loading} className={isMobile ? "w-full" : ""}>
          {loading ? "Creazione..." : "Crea Offerta"}
        </Button>
      </div>
    </div>
  );

  const previewComponent = (
    <OfferLivePreview
      customerName={previewCustomerName}
      title={newOffer.title}
      description={newOffer.description}
      template={newOffer.template}
      language={newOffer.language}
      companyEntity={newOffer.company_entity}
      validUntil={newOffer.valid_until}
      products={selectedProducts}
      timelineProduzione={newOffer.timeline_produzione}
      timelineConsegna={newOffer.timeline_consegna}
      timelineInstallazione={newOffer.timeline_installazione}
      timelineCollaudo={newOffer.timeline_collaudo}
      inclusoFornitura={newOffer.incluso_fornitura}
      esclusoFornitura={newOffer.escluso_fornitura}
      paymentMethod={newOffer.payment_method}
      paymentAgreement={newOffer.payment_agreement}
      vatRegime={newOffer.vat_regime}
      includeCertificazione={includeCertificazione}
      includeGaranzia={includeGaranzia}
      inclusoCustom={inclusoCustom}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[95vh]">
          <DrawerHeader className="pb-2">
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
      <DialogContent className={cn(
        "max-h-[90vh] transition-all duration-300",
        showPreview ? "max-w-5xl" : "max-w-2xl"
      )}>
        <DialogHeader className="pb-2">
          <DialogTitle>
            {defaultStatus === 'richiesta_offerta' ? 'Nuova Richiesta di Offerta' : 'Nuova Offerta'}
          </DialogTitle>
        </DialogHeader>
        <div className={cn(
          "flex gap-4 overflow-hidden",
          showPreview ? "flex-row" : "flex-col",
          "max-h-[calc(90vh-140px)]"
        )}>
          <div className={cn(
            "flex-1 min-w-0 overflow-hidden",
            showPreview && "max-w-[55%]"
          )}>
            {formContent}
          </div>
          {showPreview && (
            <div className="w-[300px] flex-shrink-0">
              {previewComponent}
            </div>
          )}
        </div>
        {actionButtons}
      </DialogContent>
    </Dialog>
  );
}
