import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { Plus, FileText, Mail, Download, Eye, Upload, X, ExternalLink, Send, FileCheck, MessageSquare, CheckCircle2, XCircle, Clock, Archive, Trash2, ArchiveRestore, Link2, Copy, ChevronsUpDown, Check, LayoutGrid, List, Search, ClipboardList, Edit } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { CreateOrderDialog } from "@/components/dashboard/CreateOrderDialog";
import { useDocuments, DocumentItem } from "@/hooks/useDocuments";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Offer {
  id: string;
  number: string;
  customer_id?: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
  status: 'richiesta_offerta' | 'offerta_pronta' | 'offerta_inviata' | 'negoziazione' | 'accettata' | 'rifiutata';
  created_at: string;
  valid_until?: string;
  attachments?: string[];
  lead_id?: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  payment_terms?: string;
  template?: 'zapper' | 'vesuviano' | 'zapperpro';
  timeline_produzione?: string;
  timeline_consegna?: string;
  timeline_installazione?: string;
  timeline_collaudo?: string;
  incluso_fornitura?: string;
  escluso_fornitura?: string;
  metodi_pagamento?: string;
  payment_method?: string;
  payment_agreement?: string;
  archived?: boolean;
  unique_code?: string;
  vat_regime?: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue';
  approved?: boolean;
  approved_by?: string;
  approved_by_name?: string;
}

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  status: string;
  value?: number;
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  address?: string;
  tax_id?: string;
  code?: string;
  company_name?: string;
}


export default function OffersPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedGlobalPriceListId, setSelectedGlobalPriceListId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [selectedOfferItems, setSelectedOfferItems] = useState<any[]>([]);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [offerFiles, setOfferFiles] = useState<File[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const [orderPrefilledData, setOrderPrefilledData] = useState<any>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
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
  const [currentProductId, setCurrentProductId] = useState<string>('');
  const [includeCertificazione, setIncludeCertificazione] = useState(true);
  const [includeGaranzia, setIncludeGaranzia] = useState(true);
  const [inclusoCustom, setInclusoCustom] = useState('');
  const [esclusoCaricoPredisposizione, setEsclusoCaricoPredisposizione] = useState(false);
  
  const [newOffer, setNewOffer] = useState<{
    id?: string;
    customer_id: string;
    title: string;
    description: string;
    amount: number;
    valid_until: string;
    status: 'richiesta_offerta' | 'offerta_pronta' | 'offerta_inviata' | 'negoziazione' | 'offerta_accettata' | 'offerta_rifiutata';
    template: 'zapper' | 'vesuviano' | 'zapperpro';
    language?: 'it' | 'en' | 'fr';
    timeline_produzione?: string;
    timeline_consegna?: string;
    timeline_installazione?: string;
    timeline_collaudo?: string;
    incluso_fornitura?: string;
    escluso_fornitura?: string;
    metodi_pagamento?: string;
    payment_method?: string;
    payment_agreement?: string;
    vat_regime: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue';
  }>({
    id: undefined,
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: 'offerta_pronta',
    template: 'zapper',
    language: 'it',
    timeline_produzione: '',
    timeline_consegna: '',
    timeline_installazione: '',
    timeline_collaudo: '',
    incluso_fornitura: '',
    escluso_fornitura: '',
    metodi_pagamento: '',
    payment_method: '',
    payment_agreement: '',
    vat_regime: 'standard'
  });

  const [offerRequest, setOfferRequest] = useState({
    customer_name: '',
    subject: '',
    net_amount: 0,
    vat_amount: 0,
    vat_regime: 'standard' as 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue'
  });

  useEffect(() => {
    loadData();
  }, [showArchived, selectedGlobalPriceListId]);

  useEffect(() => {
    if (!loading && offers.length > 0) {
      const offerId = searchParams.get('offer');
      if (offerId) {
        const offer = offers.find(o => o.id === offerId);
        if (offer) {
          openDetails(offer);
          // Remove the parameter to prevent reopening on refresh
          setSearchParams({});
        }
      }
    }
  }, [loading, offers, searchParams]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load offers with customer and lead data
      const { data: offersData, error: offersError } = await supabase
        .from('offers')
        .select(`
          *,
          customers (name, email, address, tax_id),
          leads (id, company_name, contact_name, status, value)
        `)
        .neq('status', 'ordine_creato')
        .eq('archived', showArchived)
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;

      // Transform to offers format
      const transformedOffers = (offersData || []).map((offer: any) => ({
        ...offer,
        customer_name: offer.customers?.name || offer.customer_name,
      }));

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, address, tax_id, code, company_name')
        .eq('active', true);

      if (customersError) throw customersError;

      // Load leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, status, value')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Load products
      let productsDataToLoad = null;
      console.log('📦 Loading products with price list:', selectedGlobalPriceListId);
      
      if (selectedGlobalPriceListId && selectedGlobalPriceListId !== 'none') {
        // Se c'è un listino selezionato, carica solo i prodotti di quel listino
        console.log('🔍 Fetching products from price list:', selectedGlobalPriceListId);
        const { data: priceListProductsData, error: priceListError } = await supabase
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
          .eq('price_list_id', selectedGlobalPriceListId);
        
        console.log('📊 Price list products data:', priceListProductsData, 'Error:', priceListError);
        
        if (priceListProductsData) {
          productsDataToLoad = (priceListProductsData as any[]).map((item: any) => ({
            ...item.products,
            price_from_list: item.price
          }));
          console.log('✅ Loaded products from price list:', productsDataToLoad.length);
        }
      } else {
        // Altrimenti carica tutti i prodotti
        console.log('📋 Fetching all products');
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id, name, code, base_price, description')
          .eq('is_active', true)
          .order('name');

        if (productsError) throw productsError;
        productsDataToLoad = productsData;
        console.log('✅ Loaded all products:', productsDataToLoad?.length || 0);
      }

      // Load price lists
      const { data: priceListsData } = await supabase
        .from('price_lists')
        .select('id, name, code')
        .eq('is_active', true)
        .order('name');

      setOffers(transformedOffers);
      setCustomers(customersData || []);
      setLeads(leadsData || []);
      setProducts(productsDataToLoad || []);
      setPriceLists(priceListsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateOfferPDF = async (offer: Offer) => {
    try {
      toast({
        title: "Generazione PDF",
        description: "Sto generando il PDF...",
      });

      // Fetch offer items with product names
      const { data: offerItems } = await supabase
        .from('offer_items')
        .select(`
          *,
          products (name)
        `)
        .eq('offer_id', offer.id);

      // Fetch customer details
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('id', offer.customer_id)
        .maybeSingle();

      if (!customer) {
        throw new Error('Cliente non trovato');
      }

      // Load HTML template
      const template = (offer as any).template || 'zapper';
      const templateResponse = await fetch(`/templates/offer-template-${template}.html`);
      let htmlTemplate = await templateResponse.text();

      // Replace placeholders with actual data
      const logoUrl = window.location.origin + '/images/logo-zapper.png';
      
      // Build products table
      const productsTableRows = (offerItems || []).map((item: any) => {
        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        const total = subtotal - discount;
        
        return `
          <tr>
            <td>${item.products?.name || 'N/A'}</td>
            <td>${item.description || ''}</td>
            <td>${item.quantity}</td>
            <td>€ ${item.unit_price.toFixed(2)}</td>
            <td>${item.discount_percent || 0}%</td>
            <td>€ ${total.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
      
      const productsTable = `
        <table>
          <thead>
            <tr>
              <th>Prodotto</th>
              <th>Descrizione</th>
              <th>Quantità</th>
              <th>Prezzo Unit.</th>
              <th>Sconto</th>
              <th>Totale</th>
            </tr>
          </thead>
          <tbody>
            ${productsTableRows}
          </tbody>
        </table>
      `;

      // Build includes grid
      const inclusoArray = ((offer as any).incluso_fornitura || '').split('\n').filter((line: string) => line.trim());
      const inclusoGrid = inclusoArray.length > 0 ? inclusoArray.map((item: string) => `
        <div class="includes-item">
          <span class="includes-icon">✓</span>
          <span class="includes-text">${item.replace('✓', '').trim()}</span>
        </div>
      `).join('') : '<div class="includes-item"><span class="includes-text">Nessun elemento specificato</span></div>';

      // Calculate totals
      const totalImponibile = offer.amount || 0;
      const isReverseCharge = (offer as any).reverse_charge === true;
      const ivaRate = 0.22; // 22%
      const totalIva = isReverseCharge ? 0 : totalImponibile * ivaRate;
      const totalLordo = totalImponibile + totalIva;
      
      // Format IVA display with reverse charge note
      const ivaDisplay = isReverseCharge 
        ? '0.00</div><div style="font-size: 9px; color: #dc3545; margin-top: 3px;">N6.7 - Inversione contabile' 
        : totalIva.toFixed(2);
      
      // Format IVA percentage display
      const ivaPercentDisplay = isReverseCharge ? '0%' : '22%';

      // Replace all placeholders
      htmlTemplate = htmlTemplate
        .replace(/\{\{logo\}\}/g, logoUrl)
        .replace(/\{\{numero_offerta\}\}/g, offer.number || '')
        .replace(/\{\{data_offerta\}\}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
        .replace(/\{\{utente\}\}/g, user?.user_metadata?.full_name || user?.email || 'N/A')
        .replace(/\{\{cliente\.nome\}\}/g, customer.name || '')
        .replace(/\{\{cliente\.indirizzo\}\}/g, customer.address || '')
        .replace(/\{\{oggetto_offerta\}\}/g, offer.title || '')
        .replace(/\{\{tabella_prodotti\}\}/g, productsTable)
        .replace(/\{\{incluso_fornitura\}\}/g, inclusoGrid)
        .replace(/\{\{escluso_fornitura\}\}/g, (offer as any).escluso_fornitura || '')
        .replace(/\{\{totale_imponibile\}\}/g, totalImponibile.toFixed(2))
        .replace(/\{\{totale_iva\}\}/g, ivaDisplay)
        .replace(/\{\{iva_percent\}\}/g, ivaPercentDisplay)
        .replace(/\{\{totale_lordo\}\}/g, totalLordo.toFixed(2))
        .replace(/\{\{validità_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{tempi_consegna\}\}/g, (offer as any).timeline_consegna || '')
        .replace(/\{\{metodi_pagamento\}\}/g, [(offer as any).payment_method, (offer as any).payment_agreement].filter(Boolean).join(' - '))
        .replace(/\{\{timeline_produzione\}\}/g, (offer as any).timeline_produzione || '')
        .replace(/\{\{timeline_consegna\}\}/g, (offer as any).timeline_consegna || '')
        .replace(/\{\{timeline_installazione\}\}/g, (offer as any).timeline_installazione || '')
        .replace(/\{\{sconto\}\}/g, (offer as any).discount || '');

      // Create temporary container
      const container = document.createElement('div');
      container.innerHTML = htmlTemplate;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.width = '210mm';
      container.style.background = 'white';
      document.body.appendChild(container);

      // Import libraries dynamically
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // A4 dimensions in mm and pixels
      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const MM_TO_PX = 3.7795275591; // 1mm = 3.78px at 96 DPI
      const MARGIN_MM = 10; // 10mm margins on all sides
      const CONTENT_WIDTH_MM = A4_WIDTH_MM - (MARGIN_MM * 2);
      const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - (MARGIN_MM * 2);
      const A4_WIDTH_PX = A4_WIDTH_MM * MM_TO_PX;

      // Capture the entire container
      const canvas = await html2canvas(container, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX
      });

      // Calculate page height in pixels
      const pageHeightPx = (canvas.width / A4_WIDTH_MM) * CONTENT_HEIGHT_MM;
      const totalHeight = canvas.height;
      const totalPages = Math.ceil(totalHeight / pageHeightPx);

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Add pages with margins
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // Create a canvas for this page
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        const remainingHeight = totalHeight - (page * pageHeightPx);
        pageCanvas.height = Math.min(pageHeightPx, remainingHeight);
        
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          
          ctx.drawImage(
            canvas,
            0,
            page * pageHeightPx,
            canvas.width,
            pageCanvas.height,
            0,
            0,
            canvas.width,
            pageCanvas.height
          );

          const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
          const imgHeight = (pageCanvas.height * A4_WIDTH_MM) / canvas.width;
          
          // Add image with margins
          pdf.addImage(pageImgData, 'JPEG', MARGIN_MM, MARGIN_MM, CONTENT_WIDTH_MM, imgHeight);
        }
      }

      // Cleanup
      document.body.removeChild(container);

      // Convert to blob
      const blob = pdf.output('blob');
      return blob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  };

  const handleDownloadPDF = async (offer: Offer) => {
    try {
      if (!offer.unique_code) {
        toast({
          title: "Errore",
          description: "Genera prima il link pubblico per scaricare il PDF",
          variant: "destructive",
        });
        return;
      }

      // Open the public offer link in a new window
      const offerUrl = `https://www.erp.abbattitorizapper.it/offerta/${offer.unique_code}`;
      const printWindow = window.open(offerUrl, '_blank');
      
      if (printWindow) {
        // Wait for the page to fully load (5 seconds to ensure all content is rendered)
        setTimeout(() => {
          printWindow.print();
        }, 5000);
        
        toast({
          title: "Stampa in corso",
          description: "Attendi 5 secondi per il caricamento, poi usa 'Salva come PDF' nella finestra di stampa",
        });
      } else {
        toast({
          title: "Errore",
          description: "Non è possibile aprire la finestra di stampa. Verifica le impostazioni del popup.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error opening print dialog:', error);
      toast({
        title: "Errore",
        description: "Errore nell'apertura della finestra di stampa",
        variant: "destructive",
      });
    }
  };

  const handleSendEmail = async (offer: Offer) => {
    try {
      const customer = customers.find(c => c.id === offer.customer_id);
      if (!customer?.email) {
        toast({
          title: "Errore",
          description: "Il cliente non ha un indirizzo email",
          variant: "destructive",
        });
        return;
      }

      // Generate PDF
      const pdfBlob = await generateOfferPDF(offer);
      
      // Convert to base64
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        
        const { error } = await supabase.functions.invoke('send-offer-email', {
          body: {
            to: customer.email,
            customerName: customer.name,
            offerNumber: offer.number,
            offerTitle: offer.title,
            amount: offer.amount,
            validUntil: offer.valid_until,
            attachments: [
              {
                filename: `Offerta_${offer.number}.pdf`,
                content: base64,
                contentType: 'application/pdf'
              }
            ],
            selectedDocs: offer.attachments || []
          }
        });

        if (error) throw error;

        // Update offer status to "offerta_inviata"
        await supabase
          .from('offers')
          .update({ status: 'offerta_inviata' })
          .eq('id', offer.id);

        toast({
          title: "Email Inviata",
          description: "L'offerta è stata inviata con successo",
        });
        
        loadData();
      };
      
      reader.readAsDataURL(pdfBlob);
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Errore",
        description: "Errore nell'invio dell'email",
        variant: "destructive",
      });
    }
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

      // Build incluso_fornitura from checkboxes and custom text
      const inclusoItems = [];
      if (includeCertificazione) inclusoItems.push('✓ Certificazione di conformità');
      if (includeGaranzia) inclusoItems.push('✓ 1 anno di garanzia');
      if (inclusoCustom.trim()) {
        inclusoItems.push(...inclusoCustom.split('\n').filter(line => line.trim()));
      }
      const inclusoFornituraText = inclusoItems.join('\n');

      // Calculate total from selected products
      const calculatedTotal = selectedProducts.reduce((sum, item) => {
        return sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100));
      }, 0);

      // Se stiamo modificando una richiesta esistente
      if (newOffer.id) {
        const { data: offerData, error } = await supabase
          .from('offers')
          .update({
            customer_id: newOffer.customer_id,
            customer_name: customer.name,
            title: newOffer.title,
            description: newOffer.description,
            amount: calculatedTotal > 0 ? calculatedTotal : newOffer.amount,
            valid_until: newOffer.valid_until || null,
            status: 'offerta_pronta',
            template: newOffer.template,
            language: newOffer.language || 'it',
            timeline_produzione: newOffer.timeline_produzione || null,
            timeline_consegna: newOffer.timeline_consegna || null,
            timeline_installazione: newOffer.timeline_installazione || null,
            timeline_collaudo: newOffer.timeline_collaudo || null,
            incluso_fornitura: inclusoFornituraText || null,
            escluso_fornitura: newOffer.escluso_fornitura || null,
            metodi_pagamento: newOffer.metodi_pagamento || null,
            payment_method: newOffer.payment_method || null,
            payment_agreement: newOffer.payment_agreement || null,
            vat_regime: newOffer.vat_regime
          })
          .eq('id', newOffer.id)
          .select()
          .single();

        if (error) throw error;

        // Insert offer items if any products were selected
        if (selectedProducts.length > 0 && offerData) {
          // Delete existing items
          await supabase
            .from('offer_items')
            .delete()
            .eq('offer_id', offerData.id);

          const offerItems = selectedProducts.map(item => {
            const productName = item.product_name?.trim() || 'Prodotto';
            const productDesc = item.description?.trim() || '';
            const fullDescription = productDesc ? `${productName}\n${productDesc}` : productName;
            
            return {
              offer_id: offerData.id,
              product_id: item.product_id?.startsWith('manual-') ? null : item.product_id,
              description: fullDescription,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              notes: item.notes || null
            };
          });

          const { error: itemsError } = await supabase
            .from('offer_items')
            .insert(offerItems);

          if (itemsError) throw itemsError;
        }
      } else {
        // Crea nuova offerta
        const offerNumber = `OFF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

        const { data: offerData, error } = await supabase
          .from('offers')
          .insert([{
            number: offerNumber,
            customer_id: newOffer.customer_id,
            customer_name: customer.name,
            title: newOffer.title,
            description: newOffer.description,
            amount: calculatedTotal > 0 ? calculatedTotal : newOffer.amount,
            valid_until: newOffer.valid_until || null,
            status: newOffer.status,
            template: newOffer.template,
            language: newOffer.language || 'it',
            timeline_produzione: newOffer.timeline_produzione || null,
            timeline_consegna: newOffer.timeline_consegna || null,
            timeline_installazione: newOffer.timeline_installazione || null,
            timeline_collaudo: newOffer.timeline_collaudo || null,
            incluso_fornitura: inclusoFornituraText || null,
            escluso_fornitura: newOffer.escluso_fornitura || null,
            metodi_pagamento: newOffer.metodi_pagamento || null,
            payment_method: newOffer.payment_method || null,
            payment_agreement: newOffer.payment_agreement || null,
            vat_regime: newOffer.vat_regime
          }])
          .select()
          .single();

        if (error) throw error;

        // Insert offer items if any products were selected
        if (selectedProducts.length > 0 && offerData) {
          const offerItems = selectedProducts.map(item => {
            const productName = item.product_name?.trim() || 'Prodotto';
            const productDesc = item.description?.trim() || '';
            const fullDescription = productDesc ? `${productName}\n${productDesc}` : productName;
            
            return {
              offer_id: offerData.id,
              product_id: item.product_id?.startsWith('manual-') ? null : item.product_id,
              description: fullDescription,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount_percent: item.discount_percent || 0,
              notes: item.notes || null
            };
          });

          const { error: itemsError } = await supabase
            .from('offer_items')
            .insert(offerItems);

          if (itemsError) throw itemsError;
        }
      }

      await loadData();
      
          setNewOffer({
            id: undefined,
            customer_id: '',
            title: '',
            description: '',
            amount: 0,
            valid_until: '',
            status: 'offerta_pronta',
            template: 'zapper',
            language: 'it',
            timeline_produzione: '',
            timeline_consegna: '',
            timeline_installazione: '',
            timeline_collaudo: '',
            incluso_fornitura: '',
            escluso_fornitura: '',
            metodi_pagamento: '',
            payment_method: '',
            payment_agreement: '',
            vat_regime: 'standard'
          });
      setSelectedProducts([]);
      setIncludeCertificazione(true);
      setIncludeGaranzia(true);
      setInclusoCustom('');
      setSelectedGlobalPriceListId('');
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Successo",
        description: newOffer.id ? "Offerta preparata con successo" : "Offerta creata con successo",
      });
    } catch (error: any) {
      console.error('Error creating offer:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      toast({
        title: "Errore",
        description: error.message || "Errore nella creazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const handleCustomerCreated = async (customerId?: string) => {
    await loadData(); // Reload customers list after creation
    if (customerId) {
      setNewOffer(prev => ({ ...prev, customer_id: customerId }));
    }
  };

  const handleCreateOfferRequest = async () => {
    try {
      if (!offerRequest.customer_name.trim()) {
        toast({
          title: "Errore",
          description: "Inserisci il nome del cliente",
          variant: "destructive",
        });
        return;
      }

      if (!offerRequest.subject.trim()) {
        toast({
          title: "Errore",
          description: "Inserisci l'oggetto della richiesta",
          variant: "destructive",
        });
        return;
      }

      const offerNumber = `RIC-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      const totalAmount = offerRequest.vat_regime !== 'standard'
        ? offerRequest.net_amount 
        : offerRequest.net_amount + offerRequest.vat_amount;

      const { error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_name: offerRequest.customer_name,
          title: offerRequest.subject,
          amount: totalAmount,
          status: 'richiesta_offerta'
        }]);

      if (error) throw error;

      toast({
        title: "Richiesta Creata",
        description: "La richiesta di offerta è stata creata con successo",
      });

      setIsRequestDialogOpen(false);
      setOfferRequest({
        customer_name: '',
        subject: '',
        net_amount: 0,
        vat_amount: 0,
        vat_regime: 'standard'
      });
      loadData();
    } catch (error) {
      console.error('Error creating offer request:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione della richiesta",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100';
      case 'offerta_pronta': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'offerta_inviata': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'negoziazione': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
      case 'accettata': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      case 'rifiutata': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'Richiesta';
      case 'offerta_pronta': return 'Pronta';
      case 'offerta_inviata': return 'Inviata';
      case 'negoziazione': return 'Negoziazione';
      case 'accettata': return 'Accettata';
      case 'rifiutata': return 'Rifiutata';
      default: return status;
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-100';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-100';
      case 'medium': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-100';
      case 'low': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const getPriorityText = (priority?: string) => {
    switch (priority) {
      case 'urgent': return '🔴 Urgente';
      case 'high': return '🟠 Alta';
      case 'medium': return '🔵 Media';
      case 'low': return '⚪ Bassa';
      default: return '🔵 Media';
    }
  };

  const filteredOffers = offers.filter(offer => {
    // Filter by archived status
    if (showArchived && !offer.archived) return false;
    if (!showArchived && offer.archived) return false;
    
    // Filter by status
    if (selectedStatus !== 'all' && offer.status !== selectedStatus) return false;
    
    // Filter by search term (search in number, customer name, title)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesNumber = offer.number.toLowerCase().includes(search);
      const matchesCustomer = offer.customer_name.toLowerCase().includes(search);
      const matchesTitle = offer.title.toLowerCase().includes(search);
      
      if (!matchesNumber && !matchesCustomer && !matchesTitle) return false;
    }
    
    return true;
  });

  const statusCounts = {
    all: filteredOffers.length,
    richiesta_offerta: filteredOffers.filter(o => o.status === 'richiesta_offerta').length,
    offerta_pronta: filteredOffers.filter(o => o.status === 'offerta_pronta').length,
    offerta_inviata: filteredOffers.filter(o => o.status === 'offerta_inviata').length,
    negoziazione: filteredOffers.filter(o => o.status === 'negoziazione').length,
    accettata: filteredOffers.filter(o => o.status === 'accettata').length,
    rifiutata: filteredOffers.filter(o => o.status === 'rifiutata').length,
  };

  const handleChangeStatus = async (offerId: string, newStatus: Offer['status']) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: newStatus })
        .eq('id', offerId);

      if (error) throw error;

      // Se l'offerta viene accettata, naviga immediatamente alla pagina ordini
      if (newStatus === 'accettata') {
        toast({
          title: "Offerta Accettata",
          description: "Vai alla sezione Ordini per creare l'ordine",
        });
        
        // Naviga immediatamente alla pagina ordini
        setTimeout(() => {
          navigate('/crm/orders');
        }, 500);
      } else {
        toast({
          title: "Stato Aggiornato",
          description: "Lo stato dell'offerta è stato aggiornato",
        });
        loadData();
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento dello stato",
        variant: "destructive",
      });
    }
  };

  const handleLinkLead = async (offerId: string, leadId: string | null) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ lead_id: leadId })
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: leadId ? "Lead Collegato" : "Lead Scollegato",
        description: leadId ? "Il lead è stato collegato all'offerta" : "Il lead è stato scollegato dall'offerta",
      });

      loadData();
      if (selectedOffer) {
        const updatedOffer = offers.find(o => o.id === offerId);
        if (updatedOffer) {
          setSelectedOffer({ ...updatedOffer, lead_id: leadId || undefined });
        }
      }
    } catch (error) {
      console.error('Error linking lead:', error);
      toast({
        title: "Errore",
        description: "Errore nel collegamento del lead",
        variant: "destructive",
      });
    }
  };

  const handleUploadFiles = async (files: File[]) => {
    if (!selectedOffer) return;

    try {
      const uploadPromises = files.map(async (file) => {
        const filePath = `offers/${selectedOffer.id}/${file.name}`;
        const { error } = await supabase.storage
          .from('documents')
          .upload(filePath, file);

        if (error) throw error;
        return filePath;
      });

      const uploadedPaths = await Promise.all(uploadPromises);
      
      const currentAttachments = selectedOffer.attachments || [];
      const { error } = await supabase
        .from('offers')
        .update({ 
          attachments: [...currentAttachments, ...uploadedPaths] 
        })
        .eq('id', selectedOffer.id);

      if (error) throw error;

      toast({
        title: "File Caricati",
        description: `${files.length} file caricati con successo`,
      });

      loadData();
      setOfferFiles([]);
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei file",
        variant: "destructive",
      });
    }
  };

  const handleArchiveOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ archived: true })
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Offerta Archiviata",
        description: "L'offerta è stata archiviata con successo",
      });

      setIsDetailsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error archiving offer:', error);
      toast({
        title: "Errore",
        description: "Errore nell'archiviazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const handleUnarchiveOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ archived: false })
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Offerta Ripristinata",
        description: "L'offerta è stata ripristinata con successo",
      });

      setIsDetailsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error unarchiving offer:', error);
      toast({
        title: "Errore",
        description: "Errore nel ripristino dell'offerta",
        variant: "destructive",
      });
    }
  };

  const handleApproveOffer = async (offerId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('offers')
        .update({ 
          approved: true,
          approved_by: user.id,
          approved_by_name: user.user_metadata?.full_name || user.email || 'Utente'
        } as any)
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Offerta Approvata",
        description: "L'offerta è stata approvata con successo",
      });

      loadData();
    } catch (error) {
      console.error('Error approving offer:', error);
      toast({
        title: "Errore",
        description: "Errore nell'approvazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      const { error } = await supabase
        .from('offers')
        .delete()
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Offerta Eliminata",
        description: "L'offerta è stata eliminata definitivamente",
      });

      setIsDetailsDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error deleting offer:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const openDetails = async (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDetailsDialogOpen(true);
    
    // Load offer items
    try {
      const { data: offerItems, error } = await supabase
        .from('offer_items')
        .select(`
          *,
          products (name, code)
        `)
        .eq('offer_id', offer.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      setSelectedOfferItems(offerItems || []);
    } catch (error) {
      console.error('Error loading offer items:', error);
      setSelectedOfferItems([]);
    }
  };

  const handleCreateOrderFromOffer = async (offer: Offer) => {
    // Prepara i dati precompilati per il dialog di creazione ordine
    setOrderPrefilledData({
      customer_id: offer.customer_id,
      offer_id: offer.id,
      lead_id: offer.lead_id || undefined,
      title: offer.title,
      description: offer.description || '',
      notes: `Ordine creato da offerta ${offer.number}`,
    });
    setIsCreateOrderDialogOpen(true);
  };

  const handleOrderCreated = async () => {
    // Aggiorna lo stato dell'offerta a 'ordine_creato'
    if (orderPrefilledData?.offer_id) {
      try {
        const { error } = await supabase
          .from('offers')
          .update({ status: 'ordine_creato' })
          .eq('id', orderPrefilledData.offer_id);

        if (error) throw error;

        toast({
          title: "Ordine Creato",
          description: "L'offerta è stata aggiornata e l'ordine è stato creato con successo",
        });
        
        // Ricarica i dati
        loadData();
      } catch (error) {
        console.error('Error updating offer status:', error);
        toast({
          title: "Attenzione",
          description: "Ordine creato ma errore nell'aggiornamento dello stato dell'offerta",
          variant: "destructive",
        });
      }
    }
    
    setIsCreateOrderDialogOpen(false);
    setOrderPrefilledData(null);
  };

  if (loading) {
    return <div className="p-8">Caricamento...</div>;
  }

  return (
    <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Offerte Commerciali</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Segui il processo dalle richieste all'accettazione</p>
        </div>
        
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'kanban' ? "default" : "ghost"}
              size={isMobile ? "icon" : "sm"}
              onClick={() => setViewMode('kanban')}
              title="Vista Kanban"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? "default" : "ghost"}
              size={isMobile ? "icon" : "sm"}
              onClick={() => setViewMode('list')}
              title="Vista Lista"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
          <Button
            variant={showArchived ? "default" : "outline"}
            size={isMobile ? "sm" : "default"}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
            {!isMobile && (showArchived ? " Mostra Attive" : " Mostra Archiviate")}
          </Button>
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size={isMobile ? "sm" : "default"}>
                <Plus className="w-4 h-4 mr-2" />
                Richiesta di Offerta
              </Button>
            </DialogTrigger>
            <DialogContent className={isMobile ? "max-w-[95vw]" : "max-w-md"}>
              <DialogHeader>
                <DialogTitle className={isMobile ? "text-lg" : ""}>Richiesta di Offerta</DialogTitle>
                <DialogDescription>
                  Crea una richiesta veloce di offerta
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Cliente</label>
                  <Input
                    value={offerRequest.customer_name}
                    onChange={(e) => setOfferRequest(prev => ({ ...prev, customer_name: e.target.value }))}
                    placeholder="Nome del cliente"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Oggetto della Richiesta</label>
                  <Textarea
                    value={offerRequest.subject}
                    onChange={(e) => setOfferRequest(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="Descrizione breve della richiesta"
                    rows={3}
                  />
                </div>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium">Importo Netto (€)</label>
                    <Input
                      type="number"
                      value={offerRequest.net_amount}
                      onChange={(e) => {
                        const netAmount = parseFloat(e.target.value) || 0;
                        const vatAmount = offerRequest.vat_regime !== 'standard' ? 0 : netAmount * 0.22;
                        setOfferRequest(prev => ({ 
                          ...prev, 
                          net_amount: netAmount,
                          vat_amount: vatAmount
                        }));
                      }}
                      placeholder="0.00"
                      step="0.01"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Regime IVA</label>
                    <Select 
                      value={offerRequest.vat_regime} 
                      onValueChange={(value: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue') => {
                        const vatAmount = value !== 'standard' ? 0 : offerRequest.net_amount * 0.22;
                        setOfferRequest(prev => ({ 
                          ...prev, 
                          vat_regime: value,
                          vat_amount: vatAmount
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona regime IVA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard (IVA 22%)</SelectItem>
                        <SelectItem value="reverse_charge">Reverse Charge</SelectItem>
                        <SelectItem value="intra_ue">Intra UE</SelectItem>
                        <SelectItem value="extra_ue">Extra UE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Importo Netto:</span>
                      <span className="font-medium">€ {offerRequest.net_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>IVA (22%):</span>
                      <span className="font-medium">€ {offerRequest.vat_amount.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <span className="font-medium">Totale:</span>
                      <span className="text-xl font-bold">
                        € {(offerRequest.net_amount + offerRequest.vat_amount).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button onClick={handleCreateOfferRequest}>
                    Crea Richiesta
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size={isMobile ? "sm" : "default"}>
                <Plus className="w-4 h-4" />
                {!isMobile && <span className="ml-2">Nuova Offerta</span>}
              </Button>
            </DialogTrigger>
            <DialogContent className={isMobile ? "max-w-[95vw] max-h-[90vh] p-4" : "max-w-2xl max-h-[90vh]"}>
            <DialogHeader>
              <DialogTitle>{newOffer.id ? 'Modifica Offerta' : 'Crea Nuova Offerta'}</DialogTitle>
              <DialogDescription>
                {newOffer.id ? 'Modifica i dettagli dell\'offerta commerciale' : 'Inserisci i dettagli dell\'offerta commerciale'}
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Azienda</label>
                <div className="flex gap-2">
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="flex-1 justify-between"
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
                                  setNewOffer(prev => ({ ...prev, customer_id: customer.id }));
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
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setIsCreateCustomerDialogOpen(true)}
                    title="Aggiungi nuovo cliente"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Listino di Riferimento (opzionale)</label>
                <Select
                  value={selectedGlobalPriceListId || 'none'}
                  onValueChange={(value) => {
                    setSelectedGlobalPriceListId(value === 'none' ? '' : value);
                    setCurrentProductId('');
                  }}
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
                <label className="text-sm font-medium">Titolo Offerta</label>
                <Input
                  value={newOffer.title}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Es: Forno professionale per ristorante"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Descrizione</label>
                <Textarea
                  value={newOffer.description}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Descrizione dettagliata dell'offerta..."
                  rows={3}
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Template Offerta</label>
                <Select 
                  value={newOffer.template} 
                  onValueChange={(value: 'zapper' | 'vesuviano' | 'zapperpro') => 
                    setNewOffer(prev => ({ ...prev, template: value }))
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
                <label className="text-sm font-medium">Lingua Offerta</label>
                <Select 
                  value={newOffer.language || 'it'} 
                  onValueChange={(value: 'it' | 'en' | 'fr') => 
                    setNewOffer(prev => ({ ...prev, language: value }))
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
              
              {/* Timeline Operativa */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Tempi di Produzione</label>
                  <Input
                    value={newOffer.timeline_produzione}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_produzione: e.target.value }))}
                    placeholder="Es: 2-3 settimane (lascia vuoto per non includere)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tempi di Consegna</label>
                  <Input
                    value={newOffer.timeline_consegna}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_consegna: e.target.value }))}
                    placeholder="Es: 3-5 giorni (lascia vuoto per non includere)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tempi di Installazione</label>
                  <Input
                    value={newOffer.timeline_installazione}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_installazione: e.target.value }))}
                    placeholder="Es: 1 giorno (lascia vuoto per non includere)"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Tempi di Collaudo</label>
                  <Input
                    value={newOffer.timeline_collaudo}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_collaudo: e.target.value }))}
                    placeholder="Es: 2 ore (lascia vuoto per non includere)"
                  />
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="text-sm font-medium">Cosa Include la Fornitura</label>
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
                <label className="text-sm font-medium">Cosa Esclude la Fornitura</label>
                <div className="flex items-center gap-2 mb-2">
                  <Checkbox
                    id="escluso-carico"
                    checked={esclusoCaricoPredisposizione}
                    onCheckedChange={(checked) => {
                      setEsclusoCaricoPredisposizione(checked === true);
                      const testoEsclusione = "Si richiede al cliente di predisporre prima del ns. arrivo di punti di carico/scarico acqua e una presa elettrica. N.B. qualora in fase di installazione non vi è stata fatta predisposizione, l'allaccio elettrico ha un costo supplementare di 200,00 € e l'allaccio idrico ha un costo supplementare di 200,00 €.";
                      if (checked) {
                        setNewOffer(prev => ({ 
                          ...prev, 
                          escluso_fornitura: prev.escluso_fornitura 
                            ? `${prev.escluso_fornitura}\n${testoEsclusione}`
                            : testoEsclusione
                        }));
                      } else {
                        setNewOffer(prev => ({ 
                          ...prev, 
                          escluso_fornitura: prev.escluso_fornitura?.replace(testoEsclusione, '').replace(/\n\n+/g, '\n').trim() || ''
                        }));
                      }
                    }}
                  />
                  <label htmlFor="escluso-carico" className="text-sm cursor-pointer">
                    Carico e scarico acqua / collegamento elettrico
                  </label>
                </div>
                <Textarea
                  value={newOffer.escluso_fornitura}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, escluso_fornitura: e.target.value }))}
                  placeholder="Es: Non sono inclusi lavori di muratura, predisposizioni elettriche o idrauliche, pratiche amministrative..."
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Metodo di Pagamento</label>
                  <Select 
                    value={newOffer.payment_method} 
                    onValueChange={(value) => setNewOffer(prev => ({ ...prev, payment_method: value }))}
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
                  <label className="text-sm font-medium">Accordi di Pagamento</label>
                  <Select 
                    value={
                      newOffer.payment_agreement === '50% acconto - 50% a consegna' || 
                      newOffer.payment_agreement === 'Pagamento anticipato' ||
                      !newOffer.payment_agreement
                        ? newOffer.payment_agreement 
                        : 'altro'
                    } 
                    onValueChange={(value) => setNewOffer(prev => ({ ...prev, payment_agreement: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona accordo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50% acconto - 50% a consegna">50% acconto - 50% a consegna</SelectItem>
                      <SelectItem value="Pagamento anticipato">Pagamento anticipato</SelectItem>
                      <SelectItem value="altro">Altro (personalizzato)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              
              <div>
                <label className="text-sm font-medium">Regime IVA</label>
                <Select 
                  value={newOffer.vat_regime} 
                  onValueChange={(value: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue') => 
                    setNewOffer(prev => ({ ...prev, vat_regime: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona regime IVA" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (IVA 22%)</SelectItem>
                    <SelectItem value="reverse_charge">Reverse Charge (IVA 0% - Inversione contabile)</SelectItem>
                    <SelectItem value="intra_ue">Intra UE (IVA 0% - Art. 41 DL 331/93)</SelectItem>
                    <SelectItem value="extra_ue">Extra UE (IVA 0% - Art. 8 DPR 633/72)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {(newOffer.payment_agreement && 
                newOffer.payment_agreement !== '50% acconto - 50% a consegna' && 
                newOffer.payment_agreement !== 'Pagamento anticipato') && (
                <div>
                  <label className="text-sm font-medium">Accordo Personalizzato</label>
                  <Textarea
                    value={newOffer.payment_agreement === 'altro' ? '' : newOffer.payment_agreement}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, payment_agreement: e.target.value }))}
                    placeholder="Descrivi l'accordo di pagamento personalizzato..."
                    rows={2}
                  />
                </div>
              )}
              
              {/* Sezione Prodotti */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Prodotti e Servizi</label>
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
                          {product.code} - {product.name} - €{(product.price_from_list || product.base_price)?.toFixed(2) || '0.00'}
                          {selectedGlobalPriceListId && product.price_from_list && (
                            <span className="text-xs text-muted-foreground ml-1">(da listino)</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    onClick={() => {
                      const product = products.find(p => p.id === currentProductId);
                      if (product) {
                        const priceToUse = selectedGlobalPriceListId && product.price_from_list 
                          ? product.price_from_list 
                          : product.base_price || 0;
                        
                        const notes = selectedGlobalPriceListId 
                          ? `Listino: ${priceLists.find(pl => pl.id === selectedGlobalPriceListId)?.code}`
                          : '';
                        
                        setSelectedProducts([...selectedProducts, {
                          product_id: product.id,
                          product_name: product.name,
                          description: product.description || '',
                          quantity: 1,
                          unit_price: priceToUse,
                          discount_percent: 0,
                          vat_rate: 22,
                          notes: notes
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
                            <div className="flex-1 space-y-2">
                              {item.product_id?.startsWith('manual-') ? (
                              <Input
                                value={item.product_name}
                                onChange={(e) => {
                                  const updated = [...selectedProducts];
                                  updated[index].product_name = e.target.value;
                                  setSelectedProducts(updated);
                                }}
                                placeholder="Nome prodotto/servizio"
                                className="font-medium text-sm"
                              />
                            ) : (
                              <div className="font-medium text-sm mb-1">{item.product_name}</div>
                            )}
                            <Textarea
                              value={item.description}
                              onChange={(e) => {
                                const updated = [...selectedProducts];
                                updated[index].description = e.target.value;
                                setSelectedProducts(updated);
                              }}
                              placeholder="Descrizione articolo"
                              className="text-sm min-h-[60px]"
                              rows={2}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedProducts(selectedProducts.filter((_, i) => i !== index))}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Quantità</label>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const updated = [...selectedProducts];
                                updated[index].quantity = parseFloat(e.target.value) || 1;
                                setSelectedProducts(updated);
                              }}
                              placeholder="Qtà"
                              min="1"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Prezzo Unitario</label>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => {
                                const updated = [...selectedProducts];
                                updated[index].unit_price = parseFloat(e.target.value) || 0;
                                setSelectedProducts(updated);
                              }}
                              placeholder="Prezzo"
                              min="0"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Sconto %</label>
                            <Input
                              type="number"
                              value={item.discount_percent}
                              onChange={(e) => {
                                const updated = [...selectedProducts];
                                updated[index].discount_percent = parseFloat(e.target.value) || 0;
                                setSelectedProducts(updated);
                              }}
                              placeholder="Sconto"
                              min="0"
                              max="100"
                              step="0.01"
                              className="text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">IVA %</label>
                            <Input
                              type="number"
                              value={item.vat_rate}
                              onChange={(e) => {
                                const updated = [...selectedProducts];
                                updated[index].vat_rate = parseFloat(e.target.value) || 0;
                                setSelectedProducts(updated);
                              }}
                              placeholder="IVA"
                              min="0"
                              max="100"
                              disabled={newOffer.vat_regime !== 'standard'}
                              className="text-sm"
                            />
                          </div>
                        </div>

                        {item.unit_price > 0 && (
                          <div className="flex justify-end gap-4 text-sm pt-2 border-t">
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Netto</div>
                              <div className="font-medium">
                                €{(item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)).toFixed(2)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">IVA</div>
                              <div className="font-medium">
                                €{(newOffer.vat_regime === 'standard' ? (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (item.vat_rate / 100)) : 0).toFixed(2)}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-muted-foreground">Totale</div>
                              <div className="font-semibold">
                                €{(
                                  item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * 
                                  (1 + (newOffer.vat_regime === 'standard' ? item.vat_rate / 100 : 0))
                                ).toFixed(2)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    <div className="text-right space-y-1 pt-2 border-t">
                      <div className="text-sm">
                        Totale Netto: €{selectedProducts.reduce((sum, item) => 
                          sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)), 0
                        ).toFixed(2)}
                      </div>
                      <div className="text-sm">
                        Totale IVA: €{selectedProducts.reduce((sum, item) => 
                          sum + (newOffer.vat_regime === 'standard' ? (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (item.vat_rate / 100)) : 0), 0
                        ).toFixed(2)}
                      </div>
                      <div className="text-lg font-bold">
                        Totale Lordo: €{selectedProducts.reduce((sum, item) => 
                          sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (1 + (newOffer.vat_regime === 'standard' ? item.vat_rate / 100 : 0))), 0
                        ).toFixed(2)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium">Valida fino al</label>
                <Input
                  type="date"
                  value={newOffer.valid_until}
                  onChange={(e) => setNewOffer(prev => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                  setSelectedGlobalPriceListId('');
                }}>
                  Annulla
                </Button>
                <Button onClick={handleCreateOffer}>
                  {newOffer.id ? 'Salva Modifiche' : 'Crea Offerta'}
                </Button>
              </div>
            </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />

      {/* Sezione Richieste di Offerta - Vista Orizzontale */}
      <Card className="mb-4 sm:mb-6">
        <CardHeader className={isMobile ? "p-4" : ""}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-600" />
              <CardTitle className={isMobile ? "text-base" : ""}>Richieste di Offerta</CardTitle>
              <Badge variant="secondary">{statusCounts.richiesta_offerta}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className={isMobile ? "p-2" : ""}>
          <ScrollArea className="w-full">
            <div className="flex gap-3 sm:gap-4 pb-4">
              {offers.filter(o => o.status === 'richiesta_offerta').length === 0 ? (
                <div className="text-muted-foreground text-xs sm:text-sm w-full text-center py-6 sm:py-8">
                  Nessuna richiesta di offerta in sospeso
                </div>
              ) : (
                offers.filter(o => o.status === 'richiesta_offerta').map(offer => (
                  <Card key={offer.id} className="min-w-[260px] sm:min-w-[300px] hover:shadow-md transition-shadow">
                    <CardContent className={isMobile ? "p-3" : "p-4"}>
                      <div className="space-y-2 sm:space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className={isMobile ? "text-sm font-medium" : "font-medium"}>{offer.number}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">{offer.customer_name}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Richiesta
                          </Badge>
                        </div>
                        
                        <div className="text-xs sm:text-sm line-clamp-2">{offer.title}</div>
                        
                        <div className={isMobile ? "text-base font-bold text-primary" : "text-lg font-bold text-primary"}>
                          € {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </div>
                        
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1" 
                            onClick={() => openDetails(offer)}
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            {!isMobile && "Vedi"}
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1" 
                            onClick={() => {
                              setNewOffer({
                                id: offer.id,
                                customer_id: offer.customer_id,
                                title: offer.title,
                                description: offer.description || `Richiesta:\n${offer.title}\n\nDettagli:\n- Cliente: ${offer.customer_name}\n- Importo stimato: € ${offer.amount.toFixed(2)}`,
                                amount: offer.amount,
                                valid_until: '',
                                status: 'offerta_pronta',
                                template: 'zapper',
                                language: (offer as any).language || 'it',
                                timeline_produzione: offer.timeline_produzione || '',
                                timeline_consegna: offer.timeline_consegna || '',
                                timeline_installazione: offer.timeline_installazione || '',
                                timeline_collaudo: offer.timeline_collaudo || '',
                                incluso_fornitura: offer.incluso_fornitura || '',
                                escluso_fornitura: offer.escluso_fornitura || '',
                                metodi_pagamento: offer.metodi_pagamento || '',
                                payment_method: offer.payment_method || '',
                                payment_agreement: offer.payment_agreement || '',
                                vat_regime: (offer as any).vat_regime || 'standard'
                              });
                              setSelectedProducts([]);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <FileCheck className="w-3 h-3 mr-1" />
                            {!isMobile && "Prepara"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>


      {/* Controlli di Ricerca e Filtro */}
      <Card className="mb-4">
        <CardContent className={isMobile ? "p-3 pt-4" : "p-4 pt-6"}>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${isMobile ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground`} />
              <Input
                placeholder="Cerca per numero, cliente o titolo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`pl-10 ${isMobile ? 'h-9 text-sm' : ''}`}
              />
            </div>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className={`w-full sm:w-[200px] ${isMobile ? 'h-9 text-sm' : ''}`}>
                <SelectValue placeholder="Filtra per stato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti gli stati</SelectItem>
                <SelectItem value="offerta_pronta">Pronte</SelectItem>
                <SelectItem value="offerta_inviata">Inviate</SelectItem>
                <SelectItem value="negoziazione">Negoziazione</SelectItem>
                <SelectItem value="accettata">Accettate</SelectItem>
                <SelectItem value="rifiutata">Rifiutate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || selectedStatus !== 'all') && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Risultati: {filteredOffers.filter(o => o.status !== 'richiesta_offerta').length}</span>
              {(searchTerm || selectedStatus !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedStatus('all');
                  }}
                  className="h-6 px-2 text-xs"
                >
                  Cancella filtri
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vista Kanban o Lista - Solo Offerte Generate */}
      <div>
        <div className="mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold">Offerte Generate</h3>
          <p className="text-xs sm:text-sm text-muted-foreground">Gestisci le offerte in fase di elaborazione</p>
        </div>
        
        {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Colonna: Pronte */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <FileCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Pronte</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{statusCounts.offerta_pronta}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.status === 'offerta_pronta').map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-blue-200" : "p-3 hover:shadow-md transition-shadow border-blue-200"}>
                      <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold" : "text-sm font-semibold"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      {offer.status === 'offerta_pronta' && !offer.approved ? (
                        <>
                          <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                            <SelectTrigger className="w-full h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offerta_pronta">Pronta</SelectItem>
                              <SelectItem value="offerta_inviata">Inviata</SelectItem>
                              <SelectItem value="negoziazione">Negoziazione</SelectItem>
                              <SelectItem value="accettata">Accettata</SelectItem>
                              <SelectItem value="rifiutata">Rifiutata</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="w-full text-xs h-7"
                            onClick={() => handleApproveOffer(offer.id)}
                          >
                            Approvata
                          </Button>
                        </>
                      ) : offer.approved && offer.status === 'offerta_pronta' ? (
                        <>
                          <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                            <SelectTrigger className="w-full h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offerta_pronta">Pronta</SelectItem>
                              <SelectItem value="offerta_inviata">Inviata</SelectItem>
                              <SelectItem value="negoziazione">Negoziazione</SelectItem>
                              <SelectItem value="accettata">Accettata</SelectItem>
                              <SelectItem value="rifiutata">Rifiutata</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground text-center">
                            Approvato da {offer.approved_by_name}
                          </span>
                        </>
                      ) : (
                        <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                          <SelectTrigger className="w-full h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offerta_pronta">Pronta</SelectItem>
                            <SelectItem value="offerta_inviata">Inviata</SelectItem>
                            <SelectItem value="negoziazione">Negoziazione</SelectItem>
                            <SelectItem value="accettata">Accettata</SelectItem>
                            <SelectItem value="rifiutata">Rifiutata</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openDetails(offer)}>
                        <Eye className="w-3 h-3 mr-1" />
                        Dettagli
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: Inviate */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Inviate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{statusCounts.offerta_inviata}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.status === 'offerta_inviata').map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-purple-200" : "p-3 hover:shadow-md transition-shadow border-purple-200"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold" : "text-sm font-semibold"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(offer.created_at).toLocaleDateString('it-IT')}
                      </div>
                      <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                        <SelectTrigger className={isMobile ? "w-full h-7 text-xs" : "w-full h-8 text-xs"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offerta_pronta">Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                          <SelectItem value="accettata">Accettata</SelectItem>
                          <SelectItem value="rifiutata">Rifiutata</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openDetails(offer)}>
                        <Eye className="w-3 h-3 mr-1" />
                        Dettagli
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: In Negoziazione */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Negoziazione</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{statusCounts.negoziazione}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.status === 'negoziazione').map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-orange-200" : "p-3 hover:shadow-md transition-shadow border-orange-200"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold" : "text-sm font-semibold"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                        <SelectTrigger className={isMobile ? "w-full h-7 text-xs" : "w-full h-8 text-xs"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offerta_pronta">Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                          <SelectItem value="accettata">Accettata</SelectItem>
                          <SelectItem value="rifiutata">Rifiutata</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openDetails(offer)}>
                        <Eye className="w-3 h-3 mr-1" />
                        Dettagli
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: Accettate */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Accettate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{statusCounts.accettata}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.status === 'accettata').map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-green-200 bg-green-50/50" : "p-3 hover:shadow-md transition-shadow border-green-200 bg-green-50/50"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold text-green-700" : "text-sm font-semibold text-green-700"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                        <SelectTrigger className={isMobile ? "w-full h-7 text-xs" : "w-full h-8 text-xs"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offerta_pronta">Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                          <SelectItem value="accettata">Accettata</SelectItem>
                          <SelectItem value="rifiutata">Rifiutata</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className={isMobile ? "flex flex-col gap-1" : "flex flex-col gap-1"}>
                        <Button size="sm" variant="default" className={isMobile ? "w-full h-7 text-xs" : "w-full"} onClick={() => handleCreateOrderFromOffer(offer)}>
                          <ClipboardList className="w-3 h-3 mr-1" />
                          Crea Ordine
                        </Button>
                        <Button size="sm" variant="outline" className={isMobile ? "w-full h-7 text-xs" : "w-full"} onClick={() => openDetails(offer)}>
                          <Eye className="w-3 h-3 mr-1" />
                          Dettagli
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: Rifiutate */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Rifiutate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{statusCounts.rifiutata}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.status === 'rifiutata').map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-red-200 bg-red-50/50" : "p-3 hover:shadow-md transition-shadow border-red-200 bg-red-50/50"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold text-red-700" : "text-sm font-semibold text-red-700"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                        <SelectTrigger className={isMobile ? "w-full h-7 text-xs" : "w-full h-8 text-xs"}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offerta_pronta">Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                          <SelectItem value="accettata">Accettata</SelectItem>
                          <SelectItem value="rifiutata">Rifiutata</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => openDetails(offer)}>
                        <Eye className="w-3 h-3 mr-1" />
                        Dettagli
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {isMobile ? (
              <div className="p-2 space-y-2">
                {filteredOffers.filter(o => o.status !== 'richiesta_offerta').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-sm transition-shadow">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{offer.number}</div>
                          <div className="text-xs text-muted-foreground truncate">{offer.customer_name}</div>
                        </div>
                        <Badge className={`${getStatusColor(offer.status)} text-xs`}>
                          {getStatusText(offer.status)}
                        </Badge>
                      </div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          € {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(offer.created_at).toLocaleDateString('it-IT')}
                        </span>
                      </div>
                      <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                        <SelectTrigger className="w-full h-7 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="offerta_pronta">Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                          <SelectItem value="accettata">Accettata</SelectItem>
                          <SelectItem value="rifiutata">Rifiutata</SelectItem>
                        </SelectContent>
                      </Select>
                      {offer.status === 'offerta_pronta' && offer.approved && (
                        <span className="text-xs text-muted-foreground text-center">
                          Approvato da {offer.approved_by_name}
                        </span>
                      )}
                      <div className="flex gap-1 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetails(offer)}
                          className="h-7 text-xs flex-1"
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          Dettagli
                        </Button>
                        {offer.status === 'offerta_pronta' && !offer.approved && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveOffer(offer.id)}
                            className="h-7 text-xs flex-1"
                          >
                            Approvata
                          </Button>
                        )}
                        {offer.status === 'accettata' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCreateOrderFromOffer(offer)}
                            className="h-7 text-xs flex-1"
                          >
                            <ClipboardList className="w-3 h-3 mr-1" />
                            Ordine
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Titolo</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.filter(o => o.status !== 'richiesta_offerta').map(offer => (
                  <TableRow key={offer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{offer.number}</TableCell>
                    <TableCell>{offer.customer_name}</TableCell>
                    <TableCell className="max-w-md truncate">{offer.title}</TableCell>
                    <TableCell className="text-right font-medium">
                      € {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {offer.status === 'offerta_pronta' && !offer.approved ? (
                        <div className="flex items-center gap-2">
                          <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                            <SelectTrigger className="w-[100px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offerta_pronta">Pronta</SelectItem>
                              <SelectItem value="offerta_inviata">Inviata</SelectItem>
                              <SelectItem value="negoziazione">Negoziazione</SelectItem>
                              <SelectItem value="accettata">Accettata</SelectItem>
                              <SelectItem value="rifiutata">Rifiutata</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApproveOffer(offer.id)}
                            className="h-8 text-xs"
                          >
                            Approvata
                          </Button>
                        </div>
                      ) : offer.approved && offer.status === 'offerta_pronta' ? (
                        <div className="flex flex-col gap-1">
                          <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                            <SelectTrigger className="w-[140px] h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="offerta_pronta">Pronta</SelectItem>
                              <SelectItem value="offerta_inviata">Inviata</SelectItem>
                              <SelectItem value="negoziazione">Negoziazione</SelectItem>
                              <SelectItem value="accettata">Accettata</SelectItem>
                              <SelectItem value="rifiutata">Rifiutata</SelectItem>
                            </SelectContent>
                          </Select>
                          <span className="text-xs text-muted-foreground">
                            Approvato da {offer.approved_by_name}
                          </span>
                        </div>
                      ) : (
                        <Select value={offer.status} onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}>
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="offerta_pronta">Pronta</SelectItem>
                            <SelectItem value="offerta_inviata">Inviata</SelectItem>
                            <SelectItem value="negoziazione">Negoziazione</SelectItem>
                            <SelectItem value="accettata">Accettata</SelectItem>
                            <SelectItem value="rifiutata">Rifiutata</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(offer.created_at).toLocaleDateString('it-IT')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openDetails(offer)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        {offer.status === 'accettata' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleCreateOrderFromOffer(offer)}
                          >
                            <ClipboardList className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            )}
          </CardContent>
        </Card>
      )}
      </div>

      {/* Dialog Crea Ordine */}
      <CreateOrderDialog
        open={isCreateOrderDialogOpen}
        onOpenChange={setIsCreateOrderDialogOpen}
        onSuccess={handleOrderCreated}
        prefilledData={orderPrefilledData}
      />

      {/* Dialog Dettagli Offerta */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className={isMobile ? "max-w-[95vw] max-h-[90vh] overflow-y-auto p-4" : "max-w-3xl max-h-[90vh] overflow-y-auto"}>
          <DialogHeader>
            <DialogTitle className={isMobile ? "text-lg" : ""}>Dettagli Offerta - {selectedOffer?.number}</DialogTitle>
            <DialogDescription>
              Gestisci i file e i collegamenti dell'offerta
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className={isMobile ? "space-y-4" : "space-y-6"}>
              {/* Info Offerta */}
              <div className={isMobile ? "grid grid-cols-1 gap-3" : "grid grid-cols-2 gap-4"}>
                <div>
                  <label className={isMobile ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium text-muted-foreground"}>Cliente</label>
                  <p className={isMobile ? "text-sm" : "text-sm"}>{selectedOffer.customer_name}</p>
                </div>
                <div>
                  <label className={isMobile ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium text-muted-foreground"}>Titolo</label>
                  <p className={isMobile ? "text-sm" : "text-sm"}>{selectedOffer.title}</p>
                </div>
                <div>
                  <label className={isMobile ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium text-muted-foreground"}>Stato</label>
                  <Badge className={`ml-2 ${getStatusColor(selectedOffer.status)}`}>
                    {getStatusText(selectedOffer.status)}
                  </Badge>
                </div>
                {selectedOffer.priority && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Urgenza</label>
                    <Badge className={`ml-2 ${getPriorityColor(selectedOffer.priority)}`} variant="outline">
                      {getPriorityText(selectedOffer.priority)}
                    </Badge>
                  </div>
                )}
                {(selectedOffer as any).template && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Template</label>
                    <p className="text-sm capitalize">{(selectedOffer as any).template}</p>
                  </div>
                )}
              </div>

              {/* Collegamento Lead */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium">Lead Collegato</label>
                <div className="flex gap-2 mt-2">
                  <Select 
                    value={selectedOffer.lead_id || "none"} 
                    onValueChange={(value) => handleLinkLead(selectedOffer.id, value === "none" ? null : value)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona un lead" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun lead</SelectItem>
                      {leads.map((lead) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          {lead.company_name} - {lead.contact_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOffer.lead_id && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => navigate(`/crm/leads?lead=${selectedOffer.lead_id}`)}
                      title="Vai al Lead"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Link Pubblico Offerta */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium mb-2 block flex items-center gap-2">
                  <Link2 className="h-4 w-4" />
                  Link Pubblico dell'Offerta
                </label>
                {selectedOffer.unique_code ? (
                  <>
                    <div className="flex gap-2">
                      <Input
                        value={`https://www.erp.abbattitorizapper.it/offerta/${selectedOffer.unique_code}`}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(`https://www.erp.abbattitorizapper.it/offerta/${selectedOffer.unique_code}`);
                          toast({
                            title: "Link Copiato",
                            description: "Il link pubblico è stato copiato negli appunti",
                          });
                        }}
                        title="Copia link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => window.open(`https://www.erp.abbattitorizapper.it/offerta/${selectedOffer.unique_code}`, '_blank')}
                        title="Apri in nuova scheda"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownloadPDF(selectedOffer)}
                        title="Scarica PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Condividi questo link con il cliente per visualizzare l'offerta
                    </p>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          // Call the generate_offer_code function
                          const { data: codeData, error: codeError } = await supabase.rpc('generate_offer_code');
                          
                          if (codeError) throw codeError;
                          
                          // Update the offer with the new code
                          const { error: updateError } = await supabase
                            .from('offers')
                            .update({ unique_code: codeData })
                            .eq('id', selectedOffer.id);
                          
                          if (updateError) throw updateError;
                          
                          // Update local state
                          setSelectedOffer({ ...selectedOffer, unique_code: codeData });
                          setOffers(offers.map(o => 
                            o.id === selectedOffer.id ? { ...o, unique_code: codeData } : o
                          ));
                          
                          toast({
                            title: "Link Generato",
                            description: "Il link pubblico è stato generato con successo",
                          });
                        } catch (error) {
                          console.error('Error generating link:', error);
                          toast({
                            title: "Errore",
                            description: "Errore nella generazione del link pubblico",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      <Link2 className="w-4 h-4 mr-2" />
                      Genera Link Pubblico
                    </Button>
                    <p className="text-xs text-muted-foreground mt-2">
                      Genera un link pubblico per condividere questa offerta con il cliente
                    </p>
                  </>
                )}
              </div>

              {selectedOffer.description && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-2">Oggetto dell'Offerta</h3>
                  <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-md">{selectedOffer.description}</p>
                </div>
              )}

              {/* Prodotti e Riepilogo Importi */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold mb-3">Prodotti/Servizi Inclusi</h3>
                
                {selectedOfferItems.length > 0 ? (
                  <div className="space-y-2 mb-4">
                    {selectedOfferItems.map((item, index) => (
                      <div key={item.id} className="border rounded-lg p-3 bg-muted/30">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {item.products?.name || 'Prodotto'}
                              {item.products?.code && <span className="text-xs text-muted-foreground ml-2">({item.products.code})</span>}
                            </div>
                            {item.description && (
                              <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                {item.description}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs mt-2 pt-2 border-t">
                          <div>
                            <span className="text-muted-foreground">Quantità:</span>
                            <span className="ml-1 font-medium">{item.quantity}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Prezzo:</span>
                            <span className="ml-1 font-medium">€{item.unit_price?.toFixed(2)}</span>
                          </div>
                          {item.discount_percent > 0 && (
                            <div>
                              <span className="text-muted-foreground">Sconto:</span>
                              <span className="ml-1 font-medium">{item.discount_percent}%</span>
                            </div>
                          )}
                          <div className="text-right">
                            <span className="text-muted-foreground">Totale:</span>
                            <span className="ml-1 font-semibold">
                              €{(item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-4 italic">Nessun prodotto/servizio specificato nel dettaglio</p>
                )}
                
                {/* Riepilogo Importi */}
                <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Imponibile Netto:</span>
                    <span className="font-medium">
                      € {(selectedOffer as any).vat_regime !== 'standard'
                        ? selectedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })
                        : (selectedOffer.amount / 1.22).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      }
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {(selectedOffer as any).vat_regime !== 'standard' ? 'IVA (Regime speciale):' : 'IVA 22%:'}
                    </span>
                    <span className="font-medium">
                      {(selectedOffer as any).vat_regime !== 'standard'
                        ? '€ 0,00'
                        : `€ ${(selectedOffer.amount - (selectedOffer.amount / 1.22)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      }
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-semibold">Importo Totale:</span>
                    <span className="text-lg font-bold text-primary">
                      € {selectedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>


              {/* Metodi di Pagamento */}
              {((selectedOffer as any).payment_method || (selectedOffer as any).payment_agreement || selectedOffer.payment_terms) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Informazioni di Pagamento</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(selectedOffer as any).payment_method && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Metodo di Pagamento</label>
                        <p className="text-sm mt-1 capitalize">{(selectedOffer as any).payment_method}</p>
                      </div>
                    )}
                    {(selectedOffer as any).payment_agreement && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Accordo</label>
                        <p className="text-sm mt-1">
                          {(selectedOffer as any).payment_agreement === '50% acconto - 50% a consegna' || 
                           (selectedOffer as any).payment_agreement === 'Pagamento anticipato'
                            ? (selectedOffer as any).payment_agreement
                            : (selectedOffer as any).payment_agreement === 'altro'
                              ? 'altro'
                              : `altro - ${(selectedOffer as any).payment_agreement}`}
                        </p>
                      </div>
                    )}
                    {selectedOffer.payment_terms && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Condizioni</label>
                        <p className="text-sm mt-1">{selectedOffer.payment_terms}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Timeline */}
              {((selectedOffer as any).timeline_produzione || (selectedOffer as any).timeline_consegna || (selectedOffer as any).timeline_installazione || (selectedOffer as any).timeline_collaudo) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Tempistiche</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {(selectedOffer as any).timeline_produzione && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Produzione</label>
                        <p className="text-sm mt-1">{(selectedOffer as any).timeline_produzione}</p>
                      </div>
                    )}
                    {(selectedOffer as any).timeline_consegna && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Consegna</label>
                        <p className="text-sm mt-1">{(selectedOffer as any).timeline_consegna}</p>
                      </div>
                    )}
                    {(selectedOffer as any).timeline_installazione && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Installazione</label>
                        <p className="text-sm mt-1">{(selectedOffer as any).timeline_installazione}</p>
                      </div>
                    )}
                    {(selectedOffer as any).timeline_collaudo && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Collaudo</label>
                        <p className="text-sm mt-1">{(selectedOffer as any).timeline_collaudo}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Incluso/Escluso */}
              {((selectedOffer as any).incluso_fornitura || (selectedOffer as any).escluso_fornitura) && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-semibold mb-3">Dettagli Fornitura</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(selectedOffer as any).incluso_fornitura && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Incluso</label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{(selectedOffer as any).incluso_fornitura}</p>
                      </div>
                    )}
                    {(selectedOffer as any).escluso_fornitura && (
                      <div>
                        <label className="text-sm font-medium text-muted-foreground">Escluso</label>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{(selectedOffer as any).escluso_fornitura}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}


              {/* Actions */}
              <div className="border-t pt-4 flex justify-between items-center">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      // Pre-compila il form di modifica con i dati dell'offerta
                      setNewOffer({
                        id: selectedOffer.id,
                        customer_id: selectedOffer.customer_id || '',
                        title: selectedOffer.title,
                        description: selectedOffer.description || '',
                        amount: selectedOffer.amount,
                        valid_until: selectedOffer.valid_until || '',
                        status: selectedOffer.status as any,
                        template: (selectedOffer as any).template || 'zapper',
                        language: (selectedOffer as any).language || 'it',
                        timeline_produzione: (selectedOffer as any).timeline_produzione || '',
                        timeline_consegna: (selectedOffer as any).timeline_consegna || '',
                        timeline_installazione: (selectedOffer as any).timeline_installazione || '',
                        timeline_collaudo: (selectedOffer as any).timeline_collaudo || '',
                        incluso_fornitura: (selectedOffer as any).incluso_fornitura || '',
                        escluso_fornitura: (selectedOffer as any).escluso_fornitura || '',
                        metodi_pagamento: (selectedOffer as any).metodi_pagamento || '',
                        payment_method: (selectedOffer as any).payment_method || '',
                        payment_agreement: (selectedOffer as any).payment_agreement || '',
                        vat_regime: (selectedOffer as any).vat_regime || 'standard'
                      });
                      
                      // Carica i prodotti dell'offerta
                      if (selectedOfferItems.length > 0) {
                        setSelectedProducts(selectedOfferItems.map(item => ({
                          product_id: item.product_id,
                          product_name: item.products?.name || '',
                          description: item.description || '',
                          quantity: item.quantity,
                          unit_price: item.unit_price,
                          discount_percent: item.discount_percent || 0,
                          vat_rate: item.vat_rate || 22,
                          reverse_charge: item.reverse_charge || false,
                          notes: item.notes || ''
                        })));
                      } else {
                        setSelectedProducts([]);
                      }
                      
                      setIsDetailsDialogOpen(false);
                      setIsCreateDialogOpen(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifica
                  </Button>
                  {selectedOffer.status === 'accettata' && (
                    <Button
                      onClick={() => {
                        handleCreateOrderFromOffer(selectedOffer);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <ClipboardList className="w-4 h-4 mr-2" />
                      Crea Ordine
                    </Button>
                  )}
                  {selectedOffer.archived ? (
                    <Button
                      variant="outline"
                      onClick={() => handleUnarchiveOffer(selectedOffer.id)}
                    >
                      <ArchiveRestore className="w-4 h-4 mr-2" />
                      Ripristina
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handleArchiveOffer(selectedOffer.id)}
                    >
                      <Archive className="w-4 h-4 mr-2" />
                      Archivia
                    </Button>
                  )}
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Elimina
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Questa azione eliminerà definitivamente l'offerta. Questa operazione non può essere annullata.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteOffer(selectedOffer.id)}>
                        Elimina
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}