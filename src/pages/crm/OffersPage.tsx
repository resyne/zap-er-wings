import { useState, useEffect, useMemo } from "react";
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
import { Plus, FileText, Mail, Download, Eye, EyeOff, Upload, X, ExternalLink, Send, FileCheck, MessageSquare, CheckCircle2, XCircle, Clock, Archive, Trash2, ArchiveRestore, Link2, Copy, ChevronsUpDown, Check, LayoutGrid, List, Search, ClipboardList, Edit, User, Package, CreditCard, ChevronDown, ChevronRight, Building2, ListChecks } from "lucide-react";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OfferLivePreview } from "@/components/dashboard/OfferLivePreview";

interface Offer {
  id: string;
  number: string;
  customer_id?: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
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
  vat_regime?: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue' | 'forfetario';
  approved?: boolean;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
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
  phone?: string;
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
  const [selectedTemplate, setSelectedTemplate] = useState<string>('all');
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const [orderPrefilledData, setOrderPrefilledData] = useState<any>(null);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [leadSearchOpen, setLeadSearchOpen] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState('');
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
  const [esclusoPuliziaCanna, setEsclusoPuliziaCanna] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [newOffer, setNewOffer] = useState<{
    id?: string;
    customer_id: string;
    title: string;
    description: string;
    amount: number;
    valid_until: string;
    status: 'offerta_pronta' | 'offerta_inviata' | 'negoziazione' | 'offerta_accettata' | 'offerta_rifiutata';
    template: 'zapper' | 'vesuviano' | 'zapperpro';
    language?: 'it' | 'en' | 'fr' | 'es';
    timeline_produzione?: string;
    timeline_consegna?: string;
    timeline_installazione?: string;
    timeline_collaudo?: string;
    incluso_fornitura?: string;
    escluso_fornitura?: string;
    metodi_pagamento?: string;
    payment_method?: string;
    payment_agreement?: string;
    vat_regime: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue' | 'forfetario';
    company_entity?: 'climatel' | 'unita1';
    lead_id?: string;
    customer_name_fallback?: string;
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
    vat_regime: 'standard',
    company_entity: 'climatel',
  });

  const [offerRequest, setOfferRequest] = useState({
    customer_name: '',
    subject: '',
    net_amount: 0,
    vat_amount: 0,
    vat_regime: 'standard' as 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue' | 'forfetario'
  });

  useEffect(() => {
    loadData();
  }, [showArchived, selectedGlobalPriceListId]);

  useEffect(() => {
    const offerId = searchParams.get('offer');
    if (offerId && !loading) {
      // First, try to find in current offers
      let offer = offers.find(o => o.id === offerId);
      
      // If not found in current list, load it directly from database
      if (!offer) {
        supabase
          .from('offers')
          .select(`
            *,
            customers (name, email, address, tax_id),
            leads (id, company_name, contact_name, status, value)
          `)
          .eq('id', offerId)
          .single()
          .then(({ data, error }) => {
            if (data && !error) {
              const transformedOffer = {
                ...data,
                customer_name: data.customers?.name || data.customer_name,
              };
              openDetails(transformedOffer as Offer);
              setSearchParams({});
            }
          });
      } else {
        openDetails(offer);
        setSearchParams({});
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
        .select('id, name, email, phone, address, tax_id, code, company_name')
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
        // Supporta sia il formato nuovo (product_name + description separati)
        // sia il legacy (description = "Titolo\nDescrizione").
        let displayName = (item.product_name || item.products?.name || 'N/A') as string;
        let displayDesc = (item.description || '') as string;

        // Legacy (vecchio salvataggio in OffersPage): description = "Titolo\nDescrizione" oppure solo "Titolo"
        if (!item.product_name && typeof item.description === 'string') {
          if (item.description.includes('\n')) {
            const [first, ...rest] = item.description.split('\n');
            displayName = first?.trim() || displayName;
            displayDesc = rest.join('\n');
          } else if (!item.product_id) {
            // Manual legacy title-only
            displayName = item.description.trim() || displayName;
            displayDesc = '';
          } else if (item.product_id) {
            // Catalog legacy title-only
            displayName = item.description.trim() || displayName;
            displayDesc = '';
          }
        }

        const subtotal = item.quantity * item.unit_price;
        const discount = item.discount_percent ? (subtotal * item.discount_percent) / 100 : 0;
        const total = subtotal - discount;
        
        return `
          <tr>
            <td>${displayName}</td>
            <td>${displayDesc || ''}</td>
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

      // Build timeline section dynamically (only include items with values)
      const timelineItems: string[] = [];
      const timelineProduzione = (offer as any).timeline_produzione;
      const timelineConsegna = (offer as any).timeline_consegna;
      const timelineInstallazione = (offer as any).timeline_installazione;
      const timelineCollaudo = (offer as any).timeline_collaudo;

      if (timelineProduzione) {
        timelineItems.push(`
          <div class="info-item">
            <div class="info-label">Tempi di Produzione</div>
            <div>${timelineProduzione}</div>
          </div>
        `);
      }
      if (timelineConsegna) {
        timelineItems.push(`
          <div class="info-item">
            <div class="info-label">Tempi di Consegna</div>
            <div>${timelineConsegna}</div>
          </div>
        `);
      }
      if (timelineInstallazione) {
        timelineItems.push(`
          <div class="info-item">
            <div class="info-label">Tempi di Installazione</div>
            <div>${timelineInstallazione}</div>
          </div>
        `);
      }
      if (timelineCollaudo) {
        timelineItems.push(`
          <div class="info-item">
            <div class="info-label">Tempi di Collaudo</div>
            <div>${timelineCollaudo}</div>
          </div>
        `);
      }

      const timelineSection = timelineItems.join('');

      // Replace all placeholders
      htmlTemplate = htmlTemplate
        .replace(/\{\{logo\}\}/g, logoUrl)
        .replace(/\{\{numero_offerta\}\}/g, offer.number || '')
        .replace(/\{\{data_offerta\}\}/g, new Date(offer.created_at).toLocaleDateString('it-IT'))
        .replace(/\{\{utente\}\}/g, user?.user_metadata?.full_name || user?.email || 'N/A')
        .replace(/\{\{cliente\.nome\}\}/g, customer.name || '')
        .replace(/\{\{cliente\.indirizzo\}\}/g, customer.address || '')
        .replace(/\{\{cliente\.piva\}\}/g, customer.tax_id || '')
        .replace(/\{\{oggetto_offerta\}\}/g, offer.title || '')
        .replace(/\{\{tabella_prodotti\}\}/g, productsTable)
        .replace(/\{\{incluso_fornitura\}\}/g, inclusoGrid)
        .replace(/\{\{escluso_fornitura\}\}/g, ((offer as any).escluso_fornitura || '').replace(/\n/g, '<br>'))
        .replace(/\{\{totale_imponibile\}\}/g, totalImponibile.toFixed(2))
        .replace(/\{\{totale_iva\}\}/g, ivaDisplay)
        .replace(/\{\{iva_percent\}\}/g, ivaPercentDisplay)
        .replace(/\{\{totale_lordo\}\}/g, totalLordo.toFixed(2))
        .replace(/\{\{validità_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{validita_offerta\}\}/g, offer.valid_until ? new Date(offer.valid_until).toLocaleDateString('it-IT') : '30 giorni')
        .replace(/\{\{timeline_section\}\}/g, timelineSection)
        .replace(/\{\{tempi_consegna\}\}/g, timelineConsegna || '')
        .replace(/\{\{metodi_pagamento\}\}/g, [(offer as any).payment_method, (offer as any).payment_agreement].filter(Boolean).join(' - '))
        .replace(/\{\{timeline_produzione\}\}/g, timelineProduzione || '')
        .replace(/\{\{timeline_consegna\}\}/g, timelineConsegna || '')
        .replace(/\{\{timeline_installazione\}\}/g, timelineInstallazione || '')
        .replace(/\{\{timeline_collaudo\}\}/g, timelineCollaudo || '')
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

      // Open the public offer link with print parameter - the page will auto-print
      const offerUrl = `https://www.erp.abbattitorizapper.it/offerta/${offer.unique_code}?print=true`;
      window.open(offerUrl, '_blank');
      
      toast({
        title: "Stampa in corso",
        description: "La finestra di stampa si aprirà automaticamente",
      });
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

  const handleSendWhatsApp = async (offer: Offer) => {
    try {
      const customer = customers.find(c => c.id === offer.customer_id);
      if (!customer?.phone) {
        toast({
          title: "Errore",
          description: "Il cliente non ha un numero di telefono",
          variant: "destructive",
        });
        return;
      }

      // Get first active wasender account
      const { data: wasenderAccount, error: accountError } = await supabase
        .from('wasender_accounts')
        .select('id, phone_number')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (accountError || !wasenderAccount) {
        toast({
          title: "Errore",
          description: "Nessun account WhatsApp attivo configurato",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Generazione PDF",
        description: "Sto generando il PDF dell'offerta...",
      });

      // Generate PDF blob
      const pdfBlob = await generateOfferPDF(offer);
      
      // Upload PDF to Supabase Storage
      const fileName = `offerta-${offer.number}-${Date.now()}.pdf`;
      const filePath = `offers/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('wasender-media')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) {
        console.error('Error uploading PDF:', uploadError);
        throw new Error('Errore nel caricamento del PDF');
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('wasender-media')
        .getPublicUrl(filePath);

      const pdfUrl = urlData.publicUrl;

      // Normalize phone number
      let phoneNumber = customer.phone.replace(/\s+/g, '').replace(/^00/, '+');
      if (!phoneNumber.startsWith('+')) {
        phoneNumber = '+39' + phoneNumber.replace(/^0/, '');
      }

      // Check if conversation exists, or create one
      let conversationId: string;
      const { data: existingConv } = await supabase
        .from('wasender_conversations')
        .select('id')
        .eq('account_id', wasenderAccount.id)
        .ilike('customer_phone', `%${phoneNumber.slice(-10)}%`)
        .limit(1)
        .maybeSingle();

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convError } = await supabase
          .from('wasender_conversations')
          .insert({
            account_id: wasenderAccount.id,
            customer_phone: phoneNumber,
            customer_name: customer.name,
          })
          .select()
          .single();

        if (convError || !newConv) {
          throw new Error('Errore nella creazione della conversazione');
        }
        conversationId = newConv.id;
      }

      // Send message with document
      const messageText = `📄 *Offerta ${offer.number}*\n\n${offer.title}\n\nImporto: €${offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;
      
      const { error: sendError } = await supabase.functions.invoke('wasender-send', {
        body: {
          to: phoneNumber,
          text: messageText,
          documentUrl: pdfUrl,
          fileName: `Offerta_${offer.number}.pdf`,
          messageType: 'document',
          accountId: wasenderAccount.id,
          conversationId: conversationId,
        }
      });

      if (sendError) {
        throw sendError;
      }

      // Update offer status
      await supabase
        .from('offers')
        .update({ status: 'offerta_inviata' })
        .eq('id', offer.id);

      toast({
        title: "Offerta Inviata",
        description: `PDF inviato via WhatsApp a ${customer.name}`,
      });
      
      loadData();
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
      toast({
        title: "Errore",
        description: error instanceof Error ? error.message : "Errore nell'invio WhatsApp",
        variant: "destructive",
      });
    }
  };

  const handleCreateOffer = async () => {
    try {
      const customer = customers.find(c => c.id === newOffer.customer_id);
      // Allow saving if we have a customer OR a lead reference (for lead-based offers like Vesuviano)
      if (!customer && !newOffer.lead_id && !newOffer.customer_name_fallback) {
        toast({
          title: "Errore",
          description: "Seleziona un cliente valido",
          variant: "destructive",
        });
        return;
      }
      const customerName = customer?.name || newOffer.customer_name_fallback || '';

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
            customer_id: newOffer.customer_id || null,
            customer_name: customerName,
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
            vat_regime: newOffer.vat_regime,
            company_entity: newOffer.company_entity || 'climatel',
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
            return {
              offer_id: offerData.id,
              product_id: item.product_id?.startsWith('manual-') ? null : item.product_id,
              product_name: productName,
              description: productDesc,
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
        // Generate offer number with customer name abbreviation
        const customerAbbr = customer.name
          .split(' ')
          .map(word => word.charAt(0).toUpperCase())
          .join('')
          .slice(0, 4) || 'CLI';
        const offerNumber = `OFF-${customerAbbr}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

        const { data: offerData, error } = await supabase
          .from('offers')
          .insert([{
            number: offerNumber,
            customer_id: newOffer.customer_id || null,
            customer_name: customerName,
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
            vat_regime: newOffer.vat_regime,
            company_entity: newOffer.company_entity || 'climatel',
          }])
          .select()
          .single();

        if (error) throw error;

        // Insert offer items if any products were selected
        if (selectedProducts.length > 0 && offerData) {
          const offerItems = selectedProducts.map(item => {
            const productName = item.product_name?.trim() || 'Prodotto';
            const productDesc = item.description?.trim() || '';
            return {
              offer_id: offerData.id,
              product_id: item.product_id?.startsWith('manual-') ? null : item.product_id,
              product_name: productName,
              description: productDesc,
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

      // Generate offer number with customer name abbreviation
      const customerAbbr = offerRequest.customer_name
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .slice(0, 4) || 'CLI';
      const offerNumber = `RIC-${customerAbbr}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
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

  const handleDuplicateOffer = async (offer: Offer) => {
    try {
      // Generate new offer number
      // Generate offer number with customer name abbreviation
      const customerAbbr = (offer.customer_name || '')
        .split(' ')
        .map(word => word.charAt(0).toUpperCase())
        .join('')
        .slice(0, 4) || 'CLI';
      const offerNumber = `OFF-${customerAbbr}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
      
      // Fetch offer items
      const { data: offerItems } = await supabase
        .from('offer_items')
        .select('*')
        .eq('offer_id', offer.id);
      
      // Create duplicated offer
      const { data: newOfferData, error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: offer.customer_id,
          customer_name: offer.customer_name,
          title: `${offer.title} (Copia)`,
          description: offer.description,
          amount: offer.amount,
          status: 'offerta_pronta',
          valid_until: offer.valid_until,
          lead_id: offer.lead_id,
          priority: offer.priority,
          template: offer.template,
          timeline_produzione: (offer as any).timeline_produzione,
          timeline_consegna: (offer as any).timeline_consegna,
          timeline_installazione: (offer as any).timeline_installazione,
          timeline_collaudo: (offer as any).timeline_collaudo,
          incluso_fornitura: (offer as any).incluso_fornitura,
          escluso_fornitura: (offer as any).escluso_fornitura,
          metodi_pagamento: (offer as any).metodi_pagamento,
          payment_method: offer.payment_method,
          payment_agreement: offer.payment_agreement,
          vat_regime: offer.vat_regime,
          archived: false
        }])
        .select()
        .maybeSingle();

      if (error) throw error;

      // Duplicate offer items if any
      if (offerItems && offerItems.length > 0 && newOfferData) {
        const duplicatedItems = offerItems.map(item => ({
          offer_id: newOfferData.id,
          product_id: item.product_id,
          product_name: item.product_name,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent,
          notes: item.notes
        }));

        await supabase.from('offer_items').insert(duplicatedItems);
      }

      await loadData();
      
      toast({
        title: "Offerta Duplicata",
        description: `Offerta ${offerNumber} creata con successo`,
      });
    } catch (error: any) {
      console.error('Error duplicating offer:', error);
      toast({
        title: "Errore",
        description: "Errore nella duplicazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const filteredOffers = offers.filter(offer => {
    // Filter by archived status
    if (showArchived && !offer.archived) return false;
    if (!showArchived && offer.archived) return false;
    
    // Filter by template
    if (selectedTemplate !== 'all' && offer.template !== selectedTemplate) return false;
    
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

  const approvalCounts = {
    all: filteredOffers.length,
    nonApprovate: filteredOffers.filter(o => !o.approved).length,
    approvate: filteredOffers.filter(o => o.approved).length,
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
          approved_by_name: user.user_metadata?.full_name || user.email || 'Utente',
          approved_at: new Date().toISOString()
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
                        <SelectItem value="forfetario">Regime Forfetario</SelectItem>
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
            <DialogContent className={cn(
              "max-h-[90vh] overflow-y-auto transition-all duration-300",
              isMobile ? "max-w-[95vw] p-4" : showPreview ? "max-w-6xl p-6" : "max-w-2xl p-6"
            )}>
            <DialogHeader className="pb-4">
              <DialogTitle className="text-xl">{newOffer.id ? 'Modifica Offerta' : 'Crea Nuova Offerta'}</DialogTitle>
            </DialogHeader>
            
            <div className={cn("flex gap-6", showPreview && !isMobile ? "flex-row" : "flex-col")}>
              {/* Form Section */}
              <div className={cn("flex-1 min-w-0", showPreview && !isMobile && "max-w-[60%]")}>
                <ScrollArea className={isMobile ? "h-[calc(100vh-200px)]" : "h-[calc(80vh-160px)]"}>
                  <div className="space-y-5 pr-4">
                    {/* Sezione Cliente */}
                    <Collapsible defaultOpen={true}>
                        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                          <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-3">
                              <User className="h-5 w-5 text-primary" />
                              <span className="font-medium">Cliente</span>
                            </div>
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <Separator />
                            <div className="p-5 space-y-4">
                            <div className="flex gap-2">
                              <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" role="combobox" className="flex-1 justify-between h-9 text-sm">
                                    {newOffer.customer_id
                                      ? (() => {
                                          const customer = customers.find((c) => c.id === newOffer.customer_id);
                                          return customer ? `${customer.code} - ${customer.company_name || customer.name}` : (newOffer.customer_name_fallback || "Seleziona azienda");
                                        })()
                                      : (newOffer.customer_name_fallback ? `${newOffer.customer_name_fallback} (da lead)` : "Seleziona azienda")}
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
                                            <Check className={cn("mr-2 h-4 w-4", newOffer.customer_id === customer.id ? "opacity-100" : "opacity-0")} />
                                            {customer.code} - {customer.company_name || customer.name}
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateCustomerDialogOpen(true)} className="h-9 w-9">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Sezione Dettagli Offerta */}
                    <Collapsible defaultOpen={true}>
                      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-primary" />
                            <span className="font-medium">Dettagli Offerta</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <div className="p-5 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Titolo Offerta *</label>
                              <Input value={newOffer.title} onChange={(e) => setNewOffer(prev => ({ ...prev, title: e.target.value }))} placeholder="Es: Forno professionale per ristorante" className="h-10" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Descrizione</label>
                              <Textarea value={newOffer.description} onChange={(e) => setNewOffer(prev => ({ ...prev, description: e.target.value }))} placeholder="Descrizione dettagliata..." rows={3} className="resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Template</label>
                                <Select value={newOffer.template} onValueChange={(value: 'zapper' | 'vesuviano' | 'zapperpro') => setNewOffer(prev => ({ ...prev, template: value }))}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="zapper">ZAPPER</SelectItem>
                                    <SelectItem value="vesuviano">Vesuviano</SelectItem>
                                    <SelectItem value="zapperpro">ZAPPER PRO</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <label className="text-sm font-medium">Lingua</label>
                                <Select value={newOffer.language || 'it'} onValueChange={(value: 'it' | 'en' | 'fr' | 'es') => setNewOffer(prev => ({ ...prev, language: value }))}>
                                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                                    <SelectItem value="en">🇬🇧 Inglese</SelectItem>
                                    <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                                    <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Intestazione e Coordinate Bancarie</label>
                              <Select value={newOffer.company_entity || 'climatel'} onValueChange={(value: 'climatel' | 'unita1') => setNewOffer(prev => ({ ...prev, company_entity: value }))}>
                              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                              <SelectContent className="z-[100] bg-background">
                                <SelectItem value="climatel">CLIMATEL di Elefante Pasquale</SelectItem>
                                <SelectItem value="unita1">UNITA 1 di Stanislao Elefante</SelectItem>
                              </SelectContent>
                            </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Valida Fino al</label>
                              <Input type="date" value={newOffer.valid_until} onChange={(e) => setNewOffer(prev => ({ ...prev, valid_until: e.target.value }))} className="h-10" />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Sezione Prodotti */}
                    <Collapsible defaultOpen={true}>
                      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-primary" />
                            <span className="font-medium">Prodotti e Servizi</span>
                            {selectedProducts.length > 0 && <Badge variant="secondary">{selectedProducts.length}</Badge>}
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <div className="p-5 space-y-4">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Listino di Riferimento</label>
                              <Select value={selectedGlobalPriceListId || 'none'} onValueChange={(value) => { setSelectedGlobalPriceListId(value === 'none' ? '' : value); setCurrentProductId(''); }}>
                                <SelectTrigger className="h-10"><SelectValue placeholder="Nessun listino" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Nessun listino - Tutti i prodotti</SelectItem>
                                  {priceLists.map((priceList) => (<SelectItem key={priceList.id} value={priceList.id}>{priceList.code} - {priceList.name}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex gap-2">
                              <Select value={currentProductId} onValueChange={setCurrentProductId}>
                                <SelectTrigger className="flex-1 h-10"><SelectValue placeholder="Seleziona prodotto" /></SelectTrigger>
                                <SelectContent>
                                  {products.map((product) => (
                                    <SelectItem key={product.id} value={product.id}>
                                      {product.code} - {product.name} - €{(product.price_from_list || product.base_price)?.toFixed(2) || '0.00'}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button type="button" onClick={() => {
                                const product = products.find(p => p.id === currentProductId);
                                if (product) {
                                  const priceToUse = selectedGlobalPriceListId && product.price_from_list ? product.price_from_list : product.base_price || 0;
                                  setSelectedProducts([...selectedProducts, { product_id: product.id, product_name: product.name, description: product.description || '', quantity: 1, unit_price: priceToUse, discount_percent: 0, vat_rate: 22, notes: selectedGlobalPriceListId ? `Listino: ${priceLists.find(pl => pl.id === selectedGlobalPriceListId)?.code}` : '' }]);
                                  setCurrentProductId('');
                                }
                              }} disabled={!currentProductId} className="h-10">
                                <Plus className="h-4 w-4 mr-1" />Aggiungi
                              </Button>
                              <Button type="button" variant="outline" onClick={() => setSelectedProducts([...selectedProducts, { product_id: `manual-${Date.now()}`, product_name: '', description: '', quantity: 1, unit_price: 0, discount_percent: 0, vat_rate: 22, notes: '' }])} className="h-10">
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            {selectedProducts.length > 0 && (
                              <div className="space-y-2 pt-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{selectedProducts.length} articoli</span>
                                  <span className="font-semibold text-primary">
                                    Totale: €{selectedProducts.reduce((sum, item) => sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)), 0).toFixed(2)}
                                  </span>
                                </div>
                                {selectedProducts.map((item, index) => (
                                  <div key={index} className="border rounded-lg p-3 space-y-2 bg-background">
                                    <div className="flex items-start justify-between gap-2">
                                      <Input placeholder="Nome prodotto/servizio" value={item.product_name} onChange={(e) => { const updated = [...selectedProducts]; updated[index].product_name = e.target.value; setSelectedProducts(updated); }} className="flex-1 h-8 text-sm" />
                                      <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedProducts(selectedProducts.filter((_, i) => i !== index))} className="h-8 w-8"><X className="h-4 w-4" /></Button>
                                    </div>
                                    <Textarea placeholder="Descrizione" value={item.description} onChange={(e) => { const updated = [...selectedProducts]; updated[index].description = e.target.value; setSelectedProducts(updated); }} rows={2} className="resize-none text-sm" />
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Qtà</label>
                                        <Input type="number" value={item.quantity} onChange={(e) => { const updated = [...selectedProducts]; updated[index].quantity = parseFloat(e.target.value) || 1; setSelectedProducts(updated); }} min="1" className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Prezzo €</label>
                                        <Input type="number" value={item.unit_price} onChange={(e) => { const updated = [...selectedProducts]; updated[index].unit_price = parseFloat(e.target.value) || 0; setSelectedProducts(updated); }} min="0" step="0.01" className="h-8 text-sm" />
                                      </div>
                                      <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Sconto %</label>
                                        <Input type="number" value={item.discount_percent} onChange={(e) => { const updated = [...selectedProducts]; updated[index].discount_percent = parseFloat(e.target.value) || 0; setSelectedProducts(updated); }} min="0" max="100" className="h-8 text-sm" />
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Sezione Tempistiche */}
                    <Collapsible defaultOpen={false}>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Tempistiche</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <div className="p-4">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Tempi di Produzione</label>
                                <Input value={newOffer.timeline_produzione} onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_produzione: e.target.value }))} placeholder="Es: 2-3 settimane" className="h-9" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Tempi di Consegna</label>
                                <Input value={newOffer.timeline_consegna} onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_consegna: e.target.value }))} placeholder="Es: 3-5 giorni" className="h-9" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Tempi di Installazione</label>
                                <Input value={newOffer.timeline_installazione} onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_installazione: e.target.value }))} placeholder="Es: 1 giorno" className="h-9" />
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Tempi di Collaudo</label>
                                <Input value={newOffer.timeline_collaudo} onChange={(e) => setNewOffer(prev => ({ ...prev, timeline_collaudo: e.target.value }))} placeholder="Es: 2 ore" className="h-9" />
                              </div>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Sezione Fornitura */}
                    <Collapsible defaultOpen={false}>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <ListChecks className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Incluso / Escluso dalla Fornitura</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <div className="p-4 space-y-4">
                            <div>
                              <label className="text-xs font-medium mb-2 block">Cosa Include</label>
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox id="cert" checked={includeCertificazione} onCheckedChange={(checked) => setIncludeCertificazione(checked === true)} />
                                  <label htmlFor="cert" className="text-sm cursor-pointer">Certificazione di conformità</label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox id="gar" checked={includeGaranzia} onCheckedChange={(checked) => setIncludeGaranzia(checked === true)} />
                                  <label htmlFor="gar" className="text-sm cursor-pointer">1 anno di garanzia</label>
                                </div>
                              </div>
                              <Textarea value={inclusoCustom} onChange={(e) => setInclusoCustom(e.target.value)} placeholder="Altre voci incluse (una per riga)" rows={2} className="resize-none text-sm" />
                            </div>
                            <Separator />
                            <div>
                              <label className="text-xs font-medium mb-2 block">Cosa Esclude</label>
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center gap-2">
                                  <Checkbox id="esc-carico" checked={esclusoCaricoPredisposizione} onCheckedChange={(checked) => {
                                    setEsclusoCaricoPredisposizione(checked === true);
                                    const testoEsclusione = "Si richiede al cliente di predisporre prima del ns. arrivo di punti di carico/scarico acqua e una presa elettrica. N.B. qualora in fase di installazione non vi è stata fatta predisposizione, l'allaccio elettrico ha un costo supplementare di 200,00 € e l'allaccio idrico ha un costo supplementare di 200,00 €.";
                                    if (checked) { setNewOffer(prev => ({ ...prev, escluso_fornitura: prev.escluso_fornitura ? `${prev.escluso_fornitura}\n${testoEsclusione}` : testoEsclusione })); }
                                    else { setNewOffer(prev => ({ ...prev, escluso_fornitura: prev.escluso_fornitura?.replace(testoEsclusione, '').replace(/\n\n+/g, '\n').trim() || '' })); }
                                  }} />
                                  <label htmlFor="esc-carico" className="text-sm cursor-pointer">Predisposizione impianti</label>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Checkbox id="esc-pulizia" checked={esclusoPuliziaCanna} onCheckedChange={(checked) => {
                                    setEsclusoPuliziaCanna(checked === true);
                                    const testoPulizia = "È obbligatoria la pulizia della canna fumaria prima del nostro intervento, a meno che non sia già pulita da massimo 45 giorni.";
                                    if (checked) { setNewOffer(prev => ({ ...prev, escluso_fornitura: prev.escluso_fornitura ? `${prev.escluso_fornitura}\n${testoPulizia}` : testoPulizia })); }
                                    else { setNewOffer(prev => ({ ...prev, escluso_fornitura: prev.escluso_fornitura?.replace(testoPulizia, '').replace(/\n\n+/g, '\n').trim() || '' })); }
                                  }} />
                                  <label htmlFor="esc-pulizia" className="text-sm cursor-pointer">Pulizia canna fumaria obbligatoria</label>
                                </div>
                              </div>
                              <Textarea value={newOffer.escluso_fornitura} onChange={(e) => setNewOffer(prev => ({ ...prev, escluso_fornitura: e.target.value }))} placeholder="Altre esclusioni..." rows={2} className="resize-none text-sm" />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>

                    {/* Sezione Pagamento */}
                    <Collapsible defaultOpen={false}>
                      <div className="rounded-lg border bg-card overflow-hidden">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">Pagamento e IVA</span>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <Separator />
                          <div className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Metodo di Pagamento</label>
                                <Select value={newOffer.payment_method} onValueChange={(value) => setNewOffer(prev => ({ ...prev, payment_method: value }))}>
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona metodo" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bonifico">Bonifico bancario</SelectItem>
                                    <SelectItem value="contrassegno">Contrassegno</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-xs font-medium">Accordi di Pagamento</label>
                                <Select value={newOffer.payment_agreement === '50% acconto - 50% a consegna' || newOffer.payment_agreement === 'Pagamento anticipato' || !newOffer.payment_agreement ? newOffer.payment_agreement : 'altro'} onValueChange={(value) => setNewOffer(prev => ({ ...prev, payment_agreement: value }))}>
                                  <SelectTrigger className="h-9"><SelectValue placeholder="Seleziona accordo" /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="50% acconto - 50% a consegna">50% acconto - 50% a consegna</SelectItem>
                                    <SelectItem value="Pagamento anticipato">Pagamento anticipato</SelectItem>
                                    <SelectItem value="altro">Altro (personalizzato)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-xs font-medium">Regime IVA</label>
                              <Select value={newOffer.vat_regime} onValueChange={(value: 'standard' | 'reverse_charge' | 'intra_ue' | 'extra_ue' | 'forfetario') => setNewOffer(prev => ({ ...prev, vat_regime: value }))}>
                                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="standard">Standard (IVA 22%)</SelectItem>
                                  <SelectItem value="reverse_charge">Reverse Charge (N.6.7)</SelectItem>
                                  <SelectItem value="intra_ue">Cessione Intra UE (N.3.2)</SelectItem>
                                  <SelectItem value="extra_ue">Cessione Extra UE (N.3.1)</SelectItem>
                                  <SelectItem value="forfetario">Regime Forfetario (L. 190/2014)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </div>
                </ScrollArea>
              </div>

              {/* Preview Section */}
              {showPreview && !isMobile && (
                <div className="w-[320px] flex-shrink-0">
                  <OfferLivePreview
                    customerName={(() => { const customer = customers.find(c => c.id === newOffer.customer_id); return customer ? (customer.company_name || customer.name) : ''; })()}
                    title={newOffer.title}
                    description={newOffer.description}
                    template={newOffer.template}
                    language={newOffer.language || 'it'}
                    companyEntity={newOffer.company_entity || 'climatel'}
                    validUntil={newOffer.valid_until}
                    products={selectedProducts}
                    timelineProduzione={newOffer.timeline_produzione || ''}
                    timelineConsegna={newOffer.timeline_consegna || ''}
                    timelineInstallazione={newOffer.timeline_installazione || ''}
                    timelineCollaudo={newOffer.timeline_collaudo || ''}
                    inclusoFornitura={newOffer.incluso_fornitura || ''}
                    esclusoFornitura={newOffer.escluso_fornitura || ''}
                    paymentMethod={newOffer.payment_method || ''}
                    paymentAgreement={newOffer.payment_agreement || ''}
                    vatRegime={newOffer.vat_regime}
                    includeCertificazione={includeCertificazione}
                    includeGaranzia={includeGaranzia}
                    inclusoCustom={inclusoCustom}
                  />
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex gap-2 pt-4 border-t justify-between items-center">
              <div className="flex items-center gap-4">
                {selectedProducts.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Totale: <span className="font-semibold text-foreground">€{selectedProducts.reduce((sum, item) => sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100)), 0).toFixed(2)}</span>
                  </div>
                )}
                {!isMobile && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-2">
                    {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    {showPreview ? 'Nascondi Preview' : 'Mostra Preview'}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setIsCreateDialogOpen(false); setSelectedGlobalPriceListId(''); }}>Annulla</Button>
                <Button onClick={handleCreateOffer}>{newOffer.id ? 'Salva Modifiche' : 'Crea Offerta'}</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />



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
            <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
              <SelectTrigger className={`w-full sm:w-[180px] ${isMobile ? 'h-9 text-sm' : ''}`}>
                <SelectValue placeholder="Filtra per template" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti i template</SelectItem>
                <SelectItem value="zapper">Zapper</SelectItem>
                <SelectItem value="vesuviano">Vesuviano</SelectItem>
                <SelectItem value="zapperpro">ZapperPro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(searchTerm || selectedTemplate !== 'all') && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Risultati: {filteredOffers.length}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedTemplate('all');
                }}
                className="h-6 px-2 text-xs"
              >
                Cancella filtri
              </Button>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {/* Colonna: Da Approvare */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Da Approvare</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{approvalCounts.nonApprovate}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => !o.approved).map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-orange-200" : "p-3 hover:shadow-md transition-shadow border-orange-200"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold" : "text-sm font-semibold"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      {offer.template && (
                        <Badge variant="outline" className={`text-xs ${offer.template === 'vesuviano' ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-blue-500 text-blue-700 bg-blue-50'}`}>
                          {offer.template === 'vesuviano' ? 'Vesuviano' : offer.template === 'zapperpro' ? 'ZapperPro' : 'Zapper'}
                        </Badge>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {new Date(offer.created_at).toLocaleDateString('it-IT')}
                      </div>
                      <Button 
                        size="sm" 
                        variant="default" 
                        className="w-full text-xs h-7"
                        onClick={() => handleApproveOffer(offer.id)}
                      >
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Approva
                      </Button>
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

        {/* Colonna: Approvate */}
        <Card className="lg:col-span-1">
          <CardHeader className={isMobile ? "pb-2 px-3 pt-3" : "pb-3"}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              <CardTitle className={isMobile ? "text-xs" : "text-sm"}>Approvate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit text-xs">{approvalCounts.approvate}</Badge>
          </CardHeader>
          <CardContent className={isMobile ? "p-1.5" : "p-2"}>
            <ScrollArea className={isMobile ? "h-[calc(100vh-380px)]" : "h-[calc(100vh-320px)]"}>
              <div className={isMobile ? "space-y-1.5 pr-1" : "space-y-2 pr-2"}>
                {filteredOffers.filter(o => o.approved).map(offer => (
                  <Card key={offer.id} className={isMobile ? "p-2 hover:shadow-md transition-shadow border-green-200 bg-green-50/50" : "p-3 hover:shadow-md transition-shadow border-green-200 bg-green-50/50"}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className={isMobile ? "font-medium text-xs" : "font-medium text-sm"}>{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className={isMobile ? "text-xs font-semibold text-green-700" : "text-sm font-semibold text-green-700"}>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      {offer.template && (
                        <Badge variant="outline" className={`text-xs ${offer.template === 'vesuviano' ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-blue-500 text-blue-700 bg-blue-50'}`}>
                          {offer.template === 'vesuviano' ? 'Vesuviano' : offer.template === 'zapperpro' ? 'ZapperPro' : 'Zapper'}
                        </Badge>
                      )}
                      <div className="text-xs text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Approvata da {offer.approved_by_name}
                        {offer.approved_at && (
                          <span className="text-muted-foreground ml-1">
                            il {new Date(offer.approved_at).toLocaleDateString('it-IT')} alle {new Date(offer.approved_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
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
                {filteredOffers.map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-sm transition-shadow">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{offer.number}</div>
                          <div className="text-xs text-muted-foreground truncate">{offer.customer_name}</div>
                        </div>
                        <div className="flex flex-col gap-1 items-end">
                          {offer.approved ? (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              Approvata
                            </Badge>
                          ) : (
                            <Badge className="bg-orange-100 text-orange-800 text-xs">
                              Da Approvare
                            </Badge>
                          )}
                          {offer.template && (
                            <Badge variant="outline" className={`text-xs ${offer.template === 'vesuviano' ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-blue-500 text-blue-700 bg-blue-50'}`}>
                              {offer.template === 'vesuviano' ? 'Vesuviano' : offer.template === 'zapperpro' ? 'ZapperPro' : 'Zapper'}
                            </Badge>
                          )}
                        </div>
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
                      {offer.approved && (
                        <div className="text-xs text-green-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Approvata da {offer.approved_by_name}
                          {offer.approved_at && (
                            <span className="text-muted-foreground ml-1">
                              il {new Date(offer.approved_at).toLocaleDateString('it-IT')} alle {new Date(offer.approved_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateOffer(offer)}
                          className="h-7 text-xs"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                        {!offer.approved && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleApproveOffer(offer.id)}
                            className="h-7 text-xs flex-1"
                          >
                            Approva
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
                  <TableHead>Template</TableHead>
                  <TableHead>Approvazione</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.map(offer => (
                  <TableRow key={offer.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{offer.number}</TableCell>
                    <TableCell>{offer.customer_name}</TableCell>
                    <TableCell className="max-w-md truncate">{offer.title}</TableCell>
                    <TableCell className="text-right font-medium">
                      € {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {offer.template && (
                        <Badge variant="outline" className={`text-xs ${offer.template === 'vesuviano' ? 'border-orange-500 text-orange-700 bg-orange-50' : 'border-blue-500 text-blue-700 bg-blue-50'}`}>
                          {offer.template === 'vesuviano' ? 'Vesuviano' : offer.template === 'zapperpro' ? 'ZapperPro' : 'Zapper'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {offer.approved ? (
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-green-100 text-green-800 text-xs w-fit">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Approvata
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {offer.approved_by_name}
                            {offer.approved_at && (
                              <> - {new Date(offer.approved_at).toLocaleDateString('it-IT')} {new Date(offer.approved_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</>
                            )}
                          </span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleApproveOffer(offer.id)}
                          className="h-8 text-xs"
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Approva
                        </Button>
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
                          title="Dettagli"
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDuplicateOffer(offer)}
                          title="Duplica"
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
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
                  <label className={isMobile ? "text-xs font-medium text-muted-foreground" : "text-sm font-medium text-muted-foreground"}>Approvazione</label>
                  {selectedOffer.approved ? (
                    <Badge className="ml-2 bg-green-100 text-green-800">
                      Approvata da {selectedOffer.approved_by_name}
                      {selectedOffer.approved_at && ` il ${new Date(selectedOffer.approved_at).toLocaleDateString('it-IT')} alle ${new Date(selectedOffer.approved_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                    </Badge>
                  ) : (
                    <Badge className="ml-2 bg-orange-100 text-orange-800">Da Approvare</Badge>
                  )}
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
                  <Popover open={leadSearchOpen} onOpenChange={setLeadSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={leadSearchOpen}
                        className="flex-1 justify-between"
                      >
                        {selectedOffer.lead_id
                          ? (() => {
                              const lead = leads.find((l) => l.id === selectedOffer.lead_id);
                              return lead ? `${lead.company_name} - ${lead.contact_name}` : "Seleziona un lead";
                            })()
                          : "Nessun lead"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Cerca lead..." 
                          value={leadSearchTerm}
                          onValueChange={setLeadSearchTerm}
                        />
                        <CommandList>
                          <CommandEmpty>Nessun lead trovato.</CommandEmpty>
                          <CommandGroup>
                            <CommandItem
                              value="none"
                              onSelect={() => {
                                handleLinkLead(selectedOffer.id, null);
                                setLeadSearchOpen(false);
                                setLeadSearchTerm('');
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  !selectedOffer.lead_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              Nessun lead
                            </CommandItem>
                            {leads.map((lead) => (
                              <CommandItem
                                key={lead.id}
                                value={`${lead.company_name || ''} ${lead.contact_name || ''}`.trim()}
                                onSelect={() => {
                                  handleLinkLead(selectedOffer.id, lead.id);
                                  setLeadSearchOpen(false);
                                  setLeadSearchTerm('');
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedOffer.lead_id === lead.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {lead.company_name} - {lead.contact_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
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
                      <Button
                        variant="default"
                        size="icon"
                        onClick={() => handleSendWhatsApp(selectedOffer)}
                        title="Invia PDF su WhatsApp"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Condividi questo link con il cliente o invia il PDF via WhatsApp
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
                            {(() => {
                              // Supporta sia formato nuovo sia legacy
                              let name = (item.product_name || item.products?.name || 'Prodotto') as string;
                              let desc = (item.description || '') as string;

                              if (!item.product_name && typeof item.description === 'string') {
                                if (item.description.includes('\n')) {
                                  const [first, ...rest] = item.description.split('\n');
                                  name = first?.trim() || name;
                                  desc = rest.join('\n');
                                } else if (!item.product_id) {
                                  // Manual legacy title-only
                                  name = item.description.trim() || name;
                                  desc = '';
                                } else if (item.product_id) {
                                  // Catalog legacy title-only
                                  name = item.description.trim() || name;
                                  desc = '';
                                }
                              }

                              return (
                                <>
                                  <div className="font-medium text-sm">
                                    {name}
                              {item.products?.code && <span className="text-xs text-muted-foreground ml-2">({item.products.code})</span>}
                                  </div>
                                  {desc && (
                                    <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
                                      {desc}
                                    </div>
                                  )}
                                </>
                              );
                            })()}
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
                        status: 'offerta_pronta' as any,
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
                        vat_regime: (selectedOffer as any).vat_regime || 'standard',
                        company_entity: (selectedOffer as any).company_entity || 'climatel',
                        lead_id: (selectedOffer as any).lead_id || undefined,
                        customer_name_fallback: selectedOffer.customer_name || '',
                      });
                      
                      // Carica i prodotti dell'offerta
                      if (selectedOfferItems.length > 0) {
                        setSelectedProducts(selectedOfferItems.map(item => {
                          // Formato nuovo: product_name + description separati.
                          // Legacy: description = "Titolo\nDescrizione".
                          const isManual = !item.product_id;

                          let productName = (item.product_name || '').toString().trim();
                          let description = (item.description || '').toString();

                          if (!productName) {
                            if (isManual) {
                              // Manual legacy: description contiene solo il titolo oppure "Titolo\nDescrizione"
                              if (description.includes('\n')) {
                                const [first, ...rest] = description.split('\n');
                                productName = (first || '').trim() || 'Prodotto';
                                description = rest.join('\n');
                              } else {
                                productName = description.trim() || 'Prodotto';
                                description = '';
                              }
                            } else {
                              // Catalog legacy (vecchio salvataggio in OffersPage):
                              // description = "Titolo\nDescrizione" oppure solo "Titolo"
                              if (description.includes('\n')) {
                                const [first, ...rest] = description.split('\n');
                                productName = (first || '').trim() || (item.products?.name || 'Prodotto');
                                description = rest.join('\n');
                              } else {
                                productName = description.trim() || (item.products?.name || 'Prodotto');
                                description = '';
                              }
                            }
                          }

                          return {
                            product_id: item.product_id || `manual-${item.id}`,
                            product_name: productName || 'Prodotto',
                            description: description || '',
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                            discount_percent: item.discount_percent || 0,
                            vat_rate: item.vat_rate || 22,
                            reverse_charge: item.reverse_charge || false,
                            notes: item.notes || ''
                          };
                        }));
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
                  <Button
                    variant="outline"
                    onClick={() => {
                      handleDuplicateOffer(selectedOffer);
                      setIsDetailsDialogOpen(false);
                    }}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Duplica
                  </Button>
                  {!selectedOffer.approved && (
                    <Button
                      variant="default"
                      onClick={() => {
                        handleApproveOffer(selectedOffer.id);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Approva
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