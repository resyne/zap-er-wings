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
import { Plus, FileText, Mail, Download, Eye, Upload, X, ExternalLink, Send, FileCheck, MessageSquare, CheckCircle2, XCircle, Clock, Archive, Trash2, ArchiveRestore, ShoppingCart } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import pdfMake from 'pdfmake/build/pdfmake';
import * as pdfFonts from 'pdfmake/build/vfs_fonts';

pdfMake.vfs = pdfFonts.vfs;
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { CreateOrderDialog } from "@/components/dashboard/CreateOrderDialog";
import { useDocuments, DocumentItem } from "@/hooks/useDocuments";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [offerFiles, setOfferFiles] = useState<File[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isCreateOrderDialogOpen, setIsCreateOrderDialogOpen] = useState(false);
  const [orderPrefilledData, setOrderPrefilledData] = useState<any>(null);
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
    timeline_produzione?: string;
    timeline_consegna?: string;
    timeline_installazione?: string;
    incluso_fornitura?: string;
    escluso_fornitura?: string;
    metodi_pagamento?: string;
    payment_method?: string;
    payment_agreement?: string;
  }>({
    id: undefined,
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: 'offerta_pronta',
    template: 'zapper',
    timeline_produzione: '',
    timeline_consegna: '',
    timeline_installazione: '',
    incluso_fornitura: '',
    escluso_fornitura: '',
    metodi_pagamento: '30% acconto - 70% alla consegna',
    payment_method: 'bonifico',
    payment_agreement: '50% acconto - 50% a consegna'
  });

  const [offerRequest, setOfferRequest] = useState({
    customer_name: '',
    subject: '',
    net_amount: 0,
    vat_amount: 0,
    reverse_charge: false
  });

  useEffect(() => {
    loadData();
  }, [showArchived]);

  useEffect(() => {
    if (!loading && offers.length > 0) {
      const offerId = searchParams.get('offer');
      if (offerId) {
        const offer = offers.find(o => o.id === offerId);
        if (offer) {
          setSelectedOffer(offer);
          setIsDetailsDialogOpen(true);
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
        id: offer.id,
        number: offer.number,
        customer_id: offer.customer_id,
        customer_name: offer.customers?.name || offer.customer_name,
        title: offer.title,
        description: offer.description,
        amount: offer.amount || 0,
        status: offer.status,
        created_at: offer.created_at,
        valid_until: offer.valid_until,
        attachments: offer.attachments || [],
        lead_id: offer.lead_id
      }));

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, address, tax_id, code')
        .eq('active', true);

      if (customersError) throw customersError;

      // Load leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('id, company_name, contact_name, status, value')
        .order('created_at', { ascending: false });

      if (leadsError) throw leadsError;

      // Load products
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, code, base_price, description')
        .order('name');

      if (productsError) throw productsError;

      setOffers(transformedOffers);
      setCustomers(customersData || []);
      setLeads(leadsData || []);
      setProducts(productsData || []);
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

  const generateOfferPDF = async (offer: Offer): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
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

        // Calculate totals
        const totaleImponibile = offerItems?.reduce((sum: number, item: any) => {
          const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
          return sum + itemTotal;
        }, 0) || offer.amount;

        const totaleIva = totaleImponibile * 0.22;
        const totaleLordo = totaleImponibile + totaleIva;

        // Payment info
        const paymentAgreementText = (offer as any).payment_agreement === 'altro' 
          ? ((offer as any).metodi_pagamento || '30% acconto - 70% alla consegna')
          : ((offer as any).payment_agreement || '50% acconto - 50% a consegna');

        // Parse incluso items
        const inclusoItems = (offer as any).incluso_fornitura 
          ? (offer as any).incluso_fornitura.split('\n').filter(Boolean) 
          : ['Fornitura e installazione completa'];

        // Table rows
        const tableBody: any[] = [
          [
            { text: 'Descrizione', style: 'tableHeader' },
            { text: 'Q.tà', style: 'tableHeader', alignment: 'right' },
            { text: 'Prezzo Unit.', style: 'tableHeader', alignment: 'right' },
            { text: 'Sconto', style: 'tableHeader', alignment: 'right' },
            { text: 'Totale', style: 'tableHeader', alignment: 'right' }
          ]
        ];

        if (offerItems && offerItems.length > 0) {
          offerItems.forEach((item: any) => {
            const itemTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
            tableBody.push([
              item.description || 'N/A',
              { text: item.quantity.toString(), alignment: 'right' },
              { text: `€ ${item.unit_price.toFixed(2)}`, alignment: 'right' },
              { text: `${item.discount_percent || 0}%`, alignment: 'right' },
              { text: `€ ${itemTotal.toFixed(2)}`, alignment: 'right' }
            ]);
          });
        } else {
          tableBody.push([
            { text: offer.description || offer.title, colSpan: 5 },
            {}, {}, {}, {}
          ]);
        }

        // Define PDF document
        const docDefinition: any = {
          pageSize: 'A4',
          pageMargins: [0, 0, 0, 0],
          content: [
            // Header verde
            {
              canvas: [
                {
                  type: 'rect',
                  x: 0,
                  y: 0,
                  w: 595,
                  h: 120,
                  color: '#38AC4F'
                }
              ],
              absolutePosition: { x: 0, y: 0 }
            },
            {
              columns: [
                {
                  width: '60%',
                  stack: [
                    { text: 'WWW.ABBATTITORIZAPPER.IT', style: 'headerWebsite' },
                    { text: '📧 info@abbattitorizapper.it\n📞 081 19968436 | 📱 +39 324 8996189', style: 'headerContacts' },
                    { text: 'Marchio di proprietà della ditta CLIMATEL DI ELEFANTE Pasquale\nVia G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia\nC.F. LFNPQL67L02I483U | P.Iva 03895390650', style: 'headerTagline' }
                  ]
                },
                {
                  width: '40%',
                  stack: [
                    { text: `OFFERTA N. ${offer.number}`, style: 'headerDocNumber' },
                    { text: `Data: ${new Date(offer.created_at).toLocaleDateString('it-IT')}`, style: 'headerDocDate' },
                    { text: `Creata da: ${user?.user_metadata?.full_name || user?.email || 'N/A'}`, style: 'headerDocUser' },
                    {
                      stack: [
                        { text: 'Spett.le Cliente:', style: 'headerClientLabel' },
                        { text: customer.name, style: 'headerClientName' },
                        { text: customer.address || '', style: 'headerClientAddress' }
                      ],
                      margin: [0, 10, 0, 0]
                    }
                  ],
                  alignment: 'right'
                }
              ],
              margin: [30, 20, 30, 20]
            },
            
            // Content
            {
              stack: [
                // Oggetto
                { text: 'OGGETTO', style: 'sectionTitle', margin: [0, 20, 0, 10] },
                { text: offer.title, style: 'oggetto' },

                // Dettaglio Prodotti
                { text: 'DETTAGLIO PRODOTTI/SERVIZI', style: 'sectionTitle', margin: [0, 20, 0, 10] },
                {
                  table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto', 'auto'],
                    body: tableBody
                  },
                  layout: {
                    fillColor: (rowIndex: number) => rowIndex === 0 ? '#38AC4F' : (rowIndex % 2 === 0 ? '#f9f9f9' : null)
                  }
                },

                // Cosa Include
                { text: 'COSA INCLUDE LA FORNITURA', style: 'includesTitle', margin: [0, 20, 0, 10] },
                {
                  ul: inclusoItems.map((item: string) => ({ text: item, style: 'includesItem' })),
                  margin: [0, 0, 0, 10]
                },

                // Cosa Esclude
                ...((offer as any).escluso_fornitura ? [
                  { text: 'COSA ESCLUDE LA FORNITURA', style: 'excludesTitle', margin: [0, 20, 0, 10] },
                  { text: (offer as any).escluso_fornitura, style: 'excludesContent' }
                ] : []),

                // Totali
                {
                  columns: [
                    { width: '*', text: '' },
                    {
                      width: 250,
                      stack: [
                        {
                          columns: [
                            { width: 150, text: 'Totale Imponibile:', alignment: 'right', bold: true },
                            { width: 100, text: `€ ${totaleImponibile.toFixed(2)}`, alignment: 'right' }
                          ]
                        },
                        {
                          columns: [
                            { width: 150, text: 'IVA:', alignment: 'right', bold: true },
                            { width: 100, text: `€ ${totaleIva.toFixed(2)}`, alignment: 'right' }
                          ]
                        },
                        {
                          columns: [
                            { width: 150, text: 'Totale Offerta:', alignment: 'right', bold: true, fontSize: 14, color: '#38AC4F' },
                            { width: 100, text: `€ ${totaleLordo.toFixed(2)}`, alignment: 'right', fontSize: 14, bold: true, color: '#38AC4F' }
                          ],
                          margin: [0, 5, 0, 0]
                        }
                      ]
                    }
                  ],
                  margin: [0, 20, 0, 0]
                },

                // Metodi di Pagamento
                { text: 'METODI DI PAGAMENTO', style: 'sectionTitle', margin: [0, 20, 0, 10] },
                { text: paymentAgreementText, margin: [0, 0, 0, 10] },
                {
                  stack: [
                    { text: 'Coordinate Bancarie:', bold: true },
                    { text: 'CLIMATEL DI ELEFANTE PASQUALE', bold: true, fontSize: 12 },
                    { text: 'Banca: INTESA SANPAOLO' },
                    { text: 'IBAN: IT82 S030 6976 4511 0000 0003 441', bold: true }
                  ],
                  background: '#f9f9f9',
                  margin: [0, 5, 0, 10],
                  padding: 10
                },

                // Riepilogo
                {
                  columns: [
                    {
                      width: '*',
                      stack: [
                        { text: `Offerta n. ${offer.number}` },
                        { text: `Cliente: ${customer.name}` },
                        { text: `Oggetto: ${offer.title}` }
                      ]
                    },
                    {
                      width: 150,
                      stack: [
                        { text: 'TOTALE OFFERTA', style: 'summaryLabel' },
                        { text: `€ ${totaleLordo.toFixed(2)}`, style: 'summaryAmount' },
                        { text: 'IVA inclusa', style: 'summaryLabel' }
                      ],
                      background: '#38AC4F',
                      color: 'white',
                      alignment: 'center',
                      margin: [10, 0, 0, 0]
                    }
                  ],
                  margin: [0, 20, 0, 0]
                }
              ],
              margin: [30, 0, 30, 30]
            }
          ],
          styles: {
            headerWebsite: { fontSize: 12, color: 'white', bold: true, margin: [0, 0, 0, 5] },
            headerContacts: { fontSize: 9, color: 'white', margin: [0, 5, 0, 0] },
            headerTagline: { fontSize: 7, color: 'white', margin: [0, 8, 0, 0] },
            headerDocNumber: { fontSize: 18, color: 'white', bold: true },
            headerDocDate: { fontSize: 10, color: 'white', margin: [0, 5, 0, 0] },
            headerDocUser: { fontSize: 9, color: 'white', margin: [0, 5, 0, 0] },
            headerClientLabel: { fontSize: 8, color: 'white', margin: [0, 0, 0, 3] },
            headerClientName: { fontSize: 11, color: 'white', bold: true },
            headerClientAddress: { fontSize: 9, color: 'white', margin: [0, 2, 0, 0] },
            sectionTitle: { fontSize: 11, bold: true, color: '#38AC4F' },
            oggetto: { fontSize: 12, background: '#f9f9f9', margin: [0, 5, 0, 0] },
            tableHeader: { fontSize: 9, bold: true, color: 'white', fillColor: '#38AC4F' },
            includesTitle: { fontSize: 12, bold: true, color: '#38AC4F', alignment: 'center' },
            includesItem: { fontSize: 9 },
            excludesTitle: { fontSize: 10, bold: true, color: '#666' },
            excludesContent: { fontSize: 9, color: '#555' },
            summaryLabel: { fontSize: 8, alignment: 'center' },
            summaryAmount: { fontSize: 22, bold: true, alignment: 'center', margin: [0, 5, 0, 5] }
          }
        };

        pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
          resolve(blob);
        });
      } catch (error) {
        console.error('Error generating PDF:', error);
        reject(error);
      }
    });
  };

  const handleDownloadPDF = async (offer: Offer) => {
    try {
      const blob = await generateOfferPDF(offer);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Offerta_${offer.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "PDF Generato",
        description: "Il PDF dell'offerta è stato scaricato con successo",
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Errore",
        description: "Errore nella generazione del PDF",
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
            timeline_produzione: newOffer.timeline_produzione || null,
            timeline_consegna: newOffer.timeline_consegna || null,
            timeline_installazione: newOffer.timeline_installazione || null,
            incluso_fornitura: inclusoFornituraText || null,
            metodi_pagamento: newOffer.metodi_pagamento || null,
            payment_method: newOffer.payment_method || null,
            payment_agreement: newOffer.payment_agreement || null
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

          const offerItems = selectedProducts.map(item => ({
            offer_id: offerData.id,
            product_id: item.product_id,
            description: `${item.product_name}\n${item.description}`,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            notes: item.notes
          }));

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
            timeline_produzione: newOffer.timeline_produzione || null,
            timeline_consegna: newOffer.timeline_consegna || null,
            timeline_installazione: newOffer.timeline_installazione || null,
            incluso_fornitura: inclusoFornituraText || null,
            escluso_fornitura: newOffer.escluso_fornitura || null,
            metodi_pagamento: newOffer.metodi_pagamento || null,
            payment_method: newOffer.payment_method || null,
            payment_agreement: newOffer.payment_agreement || null
          }])
          .select()
          .single();

        if (error) throw error;

        // Insert offer items if any products were selected
        if (selectedProducts.length > 0 && offerData) {
          const offerItems = selectedProducts.map(item => ({
            offer_id: offerData.id,
            product_id: item.product_id,
            description: `${item.product_name}\n${item.description}`,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent || 0,
            notes: item.notes
          }));

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
            timeline_produzione: '',
            timeline_consegna: '',
            timeline_installazione: '',
            incluso_fornitura: '',
            escluso_fornitura: '',
            metodi_pagamento: '30% acconto - 70% alla consegna',
            payment_method: 'bonifico',
            payment_agreement: '50% acconto - 50% a consegna'
          });
      setSelectedProducts([]);
      setIncludeCertificazione(true);
      setIncludeGaranzia(true);
      setInclusoCustom('');
      setIsCreateDialogOpen(false);
      
      toast({
        title: "Successo",
        description: newOffer.id ? "Offerta preparata con successo" : "Offerta creata con successo",
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'offerta",
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
      
      const totalAmount = offerRequest.reverse_charge 
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
        reverse_charge: false
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

  const filteredOffers = offers;

  const statusCounts = {
    all: offers.length,
    richiesta_offerta: offers.filter(o => o.status === 'richiesta_offerta').length,
    offerta_pronta: offers.filter(o => o.status === 'offerta_pronta').length,
    offerta_inviata: offers.filter(o => o.status === 'offerta_inviata').length,
    negoziazione: offers.filter(o => o.status === 'negoziazione').length,
    accettata: offers.filter(o => o.status === 'accettata').length,
    rifiutata: offers.filter(o => o.status === 'rifiutata').length,
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

  const openDetails = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDetailsDialogOpen(true);
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Offerte Commerciali</h1>
          <p className="text-muted-foreground">Segui il processo dalle richieste all'accettazione</p>
        </div>
        
        <div className="flex gap-2 items-center">
          <Button
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? <ArchiveRestore className="w-4 h-4 mr-2" /> : <Archive className="w-4 h-4 mr-2" />}
            {showArchived ? "Mostra Attive" : "Mostra Archiviate"}
          </Button>
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Richiesta di Offerta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Richiesta di Offerta</DialogTitle>
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
                        const vatAmount = offerRequest.reverse_charge ? 0 : netAmount * 0.22;
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
                  
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="request-reverse-charge"
                      checked={offerRequest.reverse_charge}
                      onCheckedChange={(checked) => {
                        const isReverseCharge = checked === true;
                        const vatAmount = isReverseCharge ? 0 : offerRequest.net_amount * 0.22;
                        setOfferRequest(prev => ({ 
                          ...prev, 
                          reverse_charge: isReverseCharge,
                          vat_amount: vatAmount
                        }));
                      }}
                    />
                    <label htmlFor="request-reverse-charge" className="text-sm cursor-pointer">
                      Reverse Charge (IVA a 0)
                    </label>
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuova Offerta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Crea Nuova Offerta</DialogTitle>
              <DialogDescription>
                Inserisci i dettagli dell'offerta commerciale
              </DialogDescription>
            </DialogHeader>
            
            <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <div className="flex gap-2">
                  <Select value={newOffer.customer_id} onValueChange={(value) => 
                    setNewOffer(prev => ({ ...prev, customer_id: value }))
                  }>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              
              {/* Timeline Operativa */}
              <div className="grid grid-cols-3 gap-4">
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
                    value={newOffer.payment_agreement} 
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
              
              {newOffer.payment_agreement === 'altro' && (
                <div>
                  <label className="text-sm font-medium">Accordo Personalizzato</label>
                  <Textarea
                    value={newOffer.metodi_pagamento}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, metodi_pagamento: e.target.value }))}
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
                          <div className="flex-1 space-y-2">
                            {item.product_id.startsWith('manual-') ? (
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
                        
                        <div className="grid grid-cols-4 gap-2">
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
                              disabled={item.reverse_charge}
                              className="text-sm"
                            />
                          </div>
                          <div className="flex items-end">
                            <div className="flex items-center gap-2 h-10">
                              <Checkbox
                                id={`reverse-charge-${index}`}
                                checked={item.reverse_charge}
                                onCheckedChange={(checked) => {
                                  const updated = [...selectedProducts];
                                  updated[index].reverse_charge = checked === true;
                                  setSelectedProducts(updated);
                                }}
                              />
                              <label htmlFor={`reverse-charge-${index}`} className="text-xs cursor-pointer whitespace-nowrap">
                                Reverse Charge
                              </label>
                            </div>
                          </div>
                        </div>

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
                              €{(item.reverse_charge ? 0 : (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (item.vat_rate / 100))).toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground">Totale</div>
                            <div className="font-semibold">
                              €{(
                                item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * 
                                (1 + (item.reverse_charge ? 0 : item.vat_rate / 100))
                              ).toFixed(2)}
                            </div>
                          </div>
                        </div>
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
                          sum + (item.reverse_charge ? 0 : (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (item.vat_rate / 100))), 0
                        ).toFixed(2)}
                      </div>
                      <div className="text-lg font-bold">
                        Totale Lordo: €{selectedProducts.reduce((sum, item) => 
                          sum + (item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100) * (1 + (item.reverse_charge ? 0 : item.vat_rate / 100))), 0
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
                }}>
                  Annulla
                </Button>
                <Button onClick={handleCreateOffer}>
                  Crea Offerta
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
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-600" />
              <CardTitle>Richieste di Offerta</CardTitle>
              <Badge variant="secondary">{statusCounts.richiesta_offerta}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4">
              {offers.filter(o => o.status === 'richiesta_offerta').length === 0 ? (
                <div className="text-muted-foreground text-sm w-full text-center py-8">
                  Nessuna richiesta di offerta in sospeso
                </div>
              ) : (
                offers.filter(o => o.status === 'richiesta_offerta').map(offer => (
                  <Card key={offer.id} className="min-w-[300px] hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-medium">{offer.number}</div>
                            <div className="text-sm text-muted-foreground">{offer.customer_name}</div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            Richiesta
                          </Badge>
                        </div>
                        
                        <div className="text-sm line-clamp-2">{offer.title}</div>
                        
                        <div className="text-lg font-bold text-primary">
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
                            Vedi
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
                                template: 'zapper'
                              });
                              setSelectedProducts([]);
                              setIsCreateDialogOpen(true);
                            }}
                          >
                            <FileCheck className="w-3 h-3 mr-1" />
                            Prepara
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

      {/* Vista Kanban - Solo Offerte Generate */}
      <div>
        <div className="mb-4">
          <h3 className="text-lg font-semibold">Offerte Generate</h3>
          <p className="text-sm text-muted-foreground">Gestisci le offerte in fase di elaborazione</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Colonna: Pronte */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-blue-600" />
              <CardTitle className="text-sm">Pronte</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit">{statusCounts.offerta_pronta}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {offers.filter(o => o.status === 'offerta_pronta').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-md transition-shadow border-blue-200">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="text-sm font-semibold">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="flex gap-1 pt-2">
                        <Button size="sm" variant="outline" onClick={() => openDetails(offer)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(offer)}>
                          <Download className="w-3 h-3" />
                        </Button>
                      </div>
                      <Button 
                        size="sm" 
                        className="w-full bg-blue-600 hover:bg-blue-700" 
                        onClick={() => {
                          handleSendEmail(offer);
                        }}
                      >
                        <Send className="w-3 h-3 mr-1" />
                        Invia
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
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-purple-600" />
              <CardTitle className="text-sm">Inviate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit">{statusCounts.offerta_inviata}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {offers.filter(o => o.status === 'offerta_inviata').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-md transition-shadow border-purple-200">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="text-sm font-semibold">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(offer.created_at).toLocaleDateString('it-IT')}
                      </div>
                      <div className="flex gap-1 pt-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => openDetails(offer)}>
                          <Eye className="w-3 h-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1" 
                          onClick={() => handleChangeStatus(offer.id, 'negoziazione')}
                        >
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Negozia
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: In Negoziazione */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-orange-600" />
              <CardTitle className="text-sm">Negoziazione</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit">{statusCounts.negoziazione}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {offers.filter(o => o.status === 'negoziazione').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-md transition-shadow border-orange-200">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="text-sm font-semibold">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="flex gap-1 pt-2">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => openDetails(offer)}>
                          <Eye className="w-3 h-3 mr-1" />
                          Dettagli
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-1">
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700" 
                          onClick={() => handleChangeStatus(offer.id, 'accettata')}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Accettata
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => handleChangeStatus(offer.id, 'rifiutata')}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Rifiutata
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Colonna: Accettate */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <CardTitle className="text-sm">Accettate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit">{statusCounts.accettata}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {offers.filter(o => o.status === 'accettata').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-md transition-shadow border-green-200 bg-green-50/50">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="text-sm font-semibold text-green-700">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="flex flex-col gap-1 pt-2">
                        <Button size="sm" variant="default" className="w-full" onClick={() => handleCreateOrderFromOffer(offer)}>
                          <ShoppingCart className="w-3 h-3 mr-1" />
                          Crea Ordine
                        </Button>
                        <Button size="sm" variant="outline" className="w-full" onClick={() => openDetails(offer)}>
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
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-600" />
              <CardTitle className="text-sm">Rifiutate</CardTitle>
            </div>
            <Badge variant="secondary" className="w-fit">{statusCounts.rifiutata}</Badge>
          </CardHeader>
          <CardContent className="p-2">
            <ScrollArea className="h-[calc(100vh-320px)]">
              <div className="space-y-2 pr-2">
                {offers.filter(o => o.status === 'rifiutata').map(offer => (
                  <Card key={offer.id} className="p-3 hover:shadow-md transition-shadow border-red-200 bg-red-50/50">
                    <div className="space-y-2">
                      <div className="font-medium text-sm">{offer.number}</div>
                      <div className="text-xs text-muted-foreground">{offer.customer_name}</div>
                      <div className="text-xs line-clamp-2">{offer.title}</div>
                      <div className="text-sm font-semibold text-red-700">€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                      <div className="flex gap-1 pt-2">
                        <Button size="sm" variant="outline" className="w-full" onClick={() => openDetails(offer)}>
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
      </div>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettagli Offerta - {selectedOffer?.number}</DialogTitle>
            <DialogDescription>
              Gestisci i file e i collegamenti dell'offerta
            </DialogDescription>
          </DialogHeader>

          {selectedOffer && (
            <div className="space-y-6">
              {/* Info Offerta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cliente</label>
                  <p className="text-sm">{selectedOffer.customer_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Importo</label>
                  <p className="text-sm">€ {selectedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Titolo</label>
                  <p className="text-sm">{selectedOffer.title}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stato</label>
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
                {selectedOffer.payment_terms && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Condizioni Pagamento</label>
                    <p className="text-sm">{selectedOffer.payment_terms}</p>
                  </div>
                )}
              </div>

              {selectedOffer.description && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Descrizione</label>
                  <p className="text-sm mt-1">{selectedOffer.description}</p>
                </div>
              )}

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

              {/* Upload Files */}
              <div className="border-t pt-4">
                <label className="text-sm font-medium mb-2 block">Documenti Allegati</label>
                <FileUpload
                  value={offerFiles}
                  onChange={setOfferFiles}
                  maxFiles={10}
                  acceptedFileTypes={[
                    'application/pdf',
                    'application/msword',
                    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    'image/jpeg',
                    'image/png',
                    'image/jpg'
                  ]}
                />
                {offerFiles.length > 0 && (
                  <div className="mt-2">
                    <Button onClick={() => handleUploadFiles(offerFiles)}>
                      <Upload className="w-4 h-4 mr-2" />
                      Carica {offerFiles.length} file
                    </Button>
                  </div>
                )}

                {/* Lista file esistenti */}
                {selectedOffer.attachments && selectedOffer.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-medium">File caricati:</p>
                    {selectedOffer.attachments.map((attachment, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <span className="text-sm">{attachment.split('/').pop()}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            const { data } = supabase.storage
                              .from('documents')
                              .getPublicUrl(attachment);
                            window.open(data.publicUrl, '_blank');
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex justify-between items-center">
                <div className="flex gap-2">
                  {selectedOffer.status === 'accettata' && (
                    <Button
                      onClick={() => {
                        handleCreateOrderFromOffer(selectedOffer);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
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