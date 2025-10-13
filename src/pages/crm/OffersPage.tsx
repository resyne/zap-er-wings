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
import { Plus, FileText, Mail, Download, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from 'jspdf';
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { useDocuments, DocumentItem } from "@/hooks/useDocuments";

interface Offer {
  id: string;
  number: string;
  customer_id?: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
  status: 'richiesta_offerta' | 'offerta_pronta' | 'offerta_inviata' | 'negoziazione';
  created_at: string;
  valid_until?: string;
  attachments?: string[];
  lead_id?: string;
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
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isCreateCustomerDialogOpen, setIsCreateCustomerDialogOpen] = useState(false);
  
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
      case 'richiesta_offerta': return 'default';
      case 'offerta_pronta': return 'secondary';
      case 'offerta_inviata': return 'outline';
      case 'negoziazione': return 'destructive';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'Richiesta di Offerta';
      case 'offerta_pronta': return 'Offerta Pronta';
      case 'offerta_inviata': return 'Offerta Inviata';
      case 'negoziazione': return 'Negoziazione';
      default: return status;
    }
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

      <Card>
        <CardHeader>
          <CardTitle>Lista Offerte</CardTitle>
          <CardDescription>
            Tutte le offerte commerciali create
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => {
                const relatedLead = leads.find(l => l.id === offer.lead_id);
                
                return (
                  <TableRow key={offer.id}>
                    <TableCell className="font-medium">{offer.number}</TableCell>
                    <TableCell>{offer.customer_name}</TableCell>
                    <TableCell>
                      {relatedLead ? (
                        <div className="text-sm">
                          <div className="font-medium">{relatedLead.company_name}</div>
                          <div className="text-muted-foreground text-xs">{relatedLead.contact_name}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{offer.title}</TableCell>
                    <TableCell>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <Select 
                        value={offer.status} 
                        onValueChange={(value) => handleChangeStatus(offer.id, value as Offer['status'])}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="richiesta_offerta">Richiesta di Offerta</SelectItem>
                          <SelectItem value="offerta_pronta">Offerta Pronta</SelectItem>
                          <SelectItem value="offerta_inviata">Offerta Inviata</SelectItem>
                          <SelectItem value="negoziazione">Negoziazione</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{new Date(offer.created_at).toLocaleDateString('it-IT')}</TableCell>
                    <TableCell>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDownloadPDF(offer)}
                          title="Scarica PDF"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendEmail(offer)}
                          disabled={offer.status === 'offerta_inviata'}
                          title="Invia Email"
                        >
                          <Mail className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}