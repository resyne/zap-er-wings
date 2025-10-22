import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Plus, FileText, Mail, Download, Eye, Upload, X, ExternalLink } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { useDocuments, DocumentItem } from "@/hooks/useDocuments";
import { useNavigate } from "react-router-dom";

interface Offer {
  id: string;
  number: string;
  customer_id?: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
  status: 'richiesta_offerta' | 'offerta_pronta' | 'offerta_inviata' | 'negoziazione' | 'confermata' | 'rifiutata';
  created_at: string;
  valid_until?: string;
  attachments?: string[];
  lead_id?: string;
  assigned_to?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  payment_terms?: string;
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
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [offerFiles, setOfferFiles] = useState<File[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [newOffer, setNewOffer] = useState({
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    status: 'richiesta_offerta' as const
  });

  useEffect(() => {
    loadData();
  }, []);

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


      setOffers(transformedOffers);
      setCustomers(customersData || []);
      setLeads(leadsData || []);
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
    const customer = customers.find(c => c.id === offer.customer_id);
    
    const pdf = new jsPDF();
    
    // Header azienda
    pdf.setFontSize(20);
    pdf.text('ZAPPER S.R.L.', 20, 30);
    pdf.setFontSize(12);
    pdf.text('Via Esempio 123, 12345 Città', 20, 40);
    pdf.text('P.IVA: 12345678901', 20, 50);
    pdf.text('Tel: +39 123 456 789', 20, 60);
    
    // Intestazione cliente
    pdf.setFontSize(14);
    pdf.text('OFFERTA COMMERCIALE', 20, 80);
    
    pdf.setFontSize(12);
    pdf.text(`Numero Offerta: ${offer.number}`, 20, 100);
    pdf.text(`Data: ${new Date(offer.created_at).toLocaleDateString('it-IT')}`, 20, 110);
    
    if (customer) {
      pdf.text('Cliente:', 20, 130);
      pdf.text(customer.name, 20, 140);
      if (customer.address) pdf.text(customer.address, 20, 150);
      if (customer.tax_id) pdf.text(`P.IVA: ${customer.tax_id}`, 20, 160);
    }
    
    // Contenuto offerta
    pdf.text('Oggetto:', 20, 180);
    pdf.text(offer.title, 20, 190);
    
    if (offer.description) {
      pdf.text('Descrizione:', 20, 210);
      const lines = pdf.splitTextToSize(offer.description, 170);
      pdf.text(lines, 20, 220);
    }
    
    // Importo
    pdf.setFontSize(14);
    pdf.text(`Importo: € ${offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 20, 250);
    
    if (offer.valid_until) {
      pdf.setFontSize(12);
      pdf.text(`Valida fino al: ${new Date(offer.valid_until).toLocaleDateString('it-IT')}`, 20, 270);
    }
    
    return pdf;
  };

  const handleDownloadPDF = async (offer: Offer) => {
    try {
      const pdf = await generateOfferPDF(offer);
      pdf.save(`Offerta_${offer.number}.pdf`);
      
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
      const pdf = await generateOfferPDF(offer);
      const pdfBlob = pdf.output('blob');
      
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

      const offerNumber = `OFF-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      // Crea l'offerta - il trigger creerà automaticamente il lead
      const { error } = await supabase
        .from('offers')
        .insert([{
          number: offerNumber,
          customer_id: newOffer.customer_id,
          customer_name: customer.name,
          title: newOffer.title,
          description: newOffer.description,
          amount: newOffer.amount,
          valid_until: newOffer.valid_until || null,
          status: newOffer.status
        }]);

      if (error) throw error;

      toast({
        title: "Offerta Creata",
        description: "L'offerta e il lead collegato sono stati creati con successo",
      });

      setIsCreateDialogOpen(false);
      setNewOffer({
        customer_id: '',
        title: '',
        description: '',
        amount: 0,
        valid_until: '',
        status: 'richiesta_offerta'
      });
      loadData();
    } catch (error) {
      console.error('Error creating offer:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'offerta",
        variant: "destructive",
      });
    }
  };

  const handleCustomerCreated = () => {
    loadData(); // Reload customers list after creation
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100';
      case 'offerta_pronta': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'offerta_inviata': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'negoziazione': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100';
      case 'confermata': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
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
      case 'confermata': return 'Confermata';
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

  const filteredOffers = statusFilter === 'all'
    ? offers 
    : offers.filter(offer => offer.status === statusFilter);

  const statusCounts = {
    all: offers.length,
    richiesta_offerta: offers.filter(o => o.status === 'richiesta_offerta').length,
    offerta_pronta: offers.filter(o => o.status === 'offerta_pronta').length,
    offerta_inviata: offers.filter(o => o.status === 'offerta_inviata').length,
    negoziazione: offers.filter(o => o.status === 'negoziazione').length,
    confermata: offers.filter(o => o.status === 'confermata').length,
    rifiutata: offers.filter(o => o.status === 'rifiutata').length,
  };

  const handleChangeStatus = async (offerId: string, newStatus: Offer['status']) => {
    try {
      const { error } = await supabase
        .from('offers')
        .update({ status: newStatus })
        .eq('id', offerId);

      if (error) throw error;

      toast({
        title: "Stato Aggiornato",
        description: "Lo stato dell'offerta è stato aggiornato",
      });

      loadData();
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

  const openDetails = (offer: Offer) => {
    setSelectedOffer(offer);
    setIsDetailsDialogOpen(true);
  };

  if (loading) {
    return <div className="p-8">Caricamento...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Offerte Commerciali</h1>
          <p className="text-muted-foreground">Gestisci le offerte e invia preventivi ai clienti</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuova Richiesta di Offerta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuova Richiesta di Offerta</DialogTitle>
              <DialogDescription>
                Compila i dettagli della richiesta di offerta
              </DialogDescription>
            </DialogHeader>
            
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
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Importo (€)</label>
                  <Input
                    type="number"
                    value={newOffer.amount}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                    placeholder="0.00"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium">Valida fino al</label>
                  <Input
                    type="date"
                    value={newOffer.valid_until}
                    onChange={(e) => setNewOffer(prev => ({ ...prev, valid_until: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => {
                  setIsCreateDialogOpen(false);
                }}>
                  Annulla
                </Button>
                <Button onClick={handleCreateOffer}>
                  Crea Richiesta di Offerta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <CreateCustomerDialog
        open={isCreateCustomerDialogOpen}
        onOpenChange={setIsCreateCustomerDialogOpen}
        onCustomerCreated={handleCustomerCreated}
      />

      {/* Filtri per stato */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('all')}
          size="sm"
        >
          Tutte ({statusCounts.all})
        </Button>
        <Button
          variant={statusFilter === 'richiesta_offerta' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('richiesta_offerta')}
          size="sm"
        >
          Richieste ({statusCounts.richiesta_offerta})
        </Button>
        <Button
          variant={statusFilter === 'offerta_pronta' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('offerta_pronta')}
          size="sm"
        >
          Pronte ({statusCounts.offerta_pronta})
        </Button>
        <Button
          variant={statusFilter === 'offerta_inviata' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('offerta_inviata')}
          size="sm"
        >
          Inviate ({statusCounts.offerta_inviata})
        </Button>
        <Button
          variant={statusFilter === 'negoziazione' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('negoziazione')}
          size="sm"
        >
          In Negoziazione ({statusCounts.negoziazione})
        </Button>
        <Button
          variant={statusFilter === 'confermata' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('confermata')}
          size="sm"
        >
          Confermate ({statusCounts.confermata})
        </Button>
        <Button
          variant={statusFilter === 'rifiutata' ? 'default' : 'outline'}
          onClick={() => setStatusFilter('rifiutata')}
          size="sm"
        >
          Rifiutate ({statusCounts.rifiutata})
        </Button>
      </div>

      {/* Grid di Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOffers.map((offer) => {
          const relatedLead = leads.find(l => l.id === offer.lead_id);
          
          return (
            <Card key={offer.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{offer.number}</CardTitle>
                    <CardDescription className="text-xs">{offer.customer_name}</CardDescription>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge className={getStatusColor(offer.status)}>
                      {getStatusText(offer.status)}
                    </Badge>
                    {offer.priority && (
                      <Badge variant="outline" className={getPriorityColor(offer.priority)}>
                        {getPriorityText(offer.priority)}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium text-sm mb-1">{offer.title}</h4>
                  {offer.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {offer.description}
                    </p>
                  )}
                </div>

                {relatedLead && (
                  <div className="text-xs bg-muted p-2 rounded">
                    <div className="font-medium">{relatedLead.company_name}</div>
                    <div className="text-muted-foreground">{relatedLead.contact_name}</div>
                  </div>
                )}

                {offer.payment_terms && (
                  <div className="text-xs bg-blue-50 p-2 rounded border border-blue-200">
                    <span className="font-medium">Pagamento:</span> {offer.payment_terms}
                  </div>
                )}

                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="text-lg font-bold text-primary">
                    € {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(offer.created_at).toLocaleDateString('it-IT')}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openDetails(offer)}
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    Dettagli
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownloadPDF(offer)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleSendEmail(offer)}
                  >
                    <Mail className="w-3 h-3" />
                  </Button>
                </div>

                {/* Azioni rapide cambio stato */}
                <div className="grid grid-cols-2 gap-2">
                  {offer.status !== 'confermata' && offer.status !== 'rifiutata' && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleChangeStatus(offer.id, 'confermata')}
                      >
                        ✓ Conferma
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleChangeStatus(offer.id, 'rifiutata')}
                      >
                        ✗ Rifiuta
                      </Button>
                    </>
                  )}
                  {offer.status === 'richiesta_offerta' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="col-span-2"
                      onClick={() => handleChangeStatus(offer.id, 'offerta_pronta')}
                    >
                      Segna come Pronta
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredOffers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nessuna offerta {statusFilter !== 'all' ? 'con questo stato' : 'trovata'}</p>
          </CardContent>
        </Card>
      )}

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
                      onClick={() => navigate('/crm/leads')}
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
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}