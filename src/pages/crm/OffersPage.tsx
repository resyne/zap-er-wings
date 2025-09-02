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

interface Offer {
  id: string;
  number: string;
  customer_id?: string;
  customer_name: string;
  title: string;
  description?: string;
  amount: number;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  created_at: string;
  valid_until?: string;
  attachments?: string[];
}

interface Customer {
  id: string;
  name: string;
  email?: string;
  address?: string;
  tax_id?: string;
  code?: string;
}

interface TechnicalDoc {
  id: string;
  name: string;
  url: string;
  category: string;
}

export default function OffersPage() {
  const { toast } = useToast();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [technicalDocs, setTechnicalDocs] = useState<TechnicalDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  
  const [newOffer, setNewOffer] = useState({
    customer_id: '',
    title: '',
    description: '',
    amount: 0,
    valid_until: '',
    attachments: [] as string[]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load offers (using quotes as table doesn't exist yet)
      const { data: offersData, error: offersError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false });

      if (offersError) throw offersError;

      // Transform quotes to offers format
      const transformedOffers = (offersData || []).map(quote => ({
        id: quote.id,
        number: quote.number,
        customer_id: quote.customer_id,
        customer_name: 'Cliente', // You may want to join with customers table
        title: 'Offerta ' + quote.number,
        description: quote.notes,
        amount: quote.total_amount || 0,
        status: quote.status as 'draft' | 'sent' | 'approved' | 'rejected',
        created_at: quote.created_at,
        valid_until: quote.valid_until,
        attachments: []
      }));

      // Load customers
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, address, tax_id, code')
        .eq('active', true);

      if (customersError) throw customersError;

      // Mock technical documents (in real scenario, these would come from storage/database)
      const mockTechnicalDocs = [
        { id: '1', name: 'Scheda Tecnica Forni Professional', url: '/docs/forni-professional.pdf', category: 'Forni' },
        { id: '2', name: 'Scheda Tecnica Abbattitori Blast', url: '/docs/abbattitori-blast.pdf', category: 'Abbattitori' },
        { id: '3', name: 'Listino Prezzi 2024', url: '/docs/listino-2024.pdf', category: 'Listini' },
        { id: '4', name: 'Manuale Installazione', url: '/docs/manuale-installazione.pdf', category: 'Manuali' }
      ];

      setOffers(transformedOffers);
      setCustomers(customersData || []);
      setTechnicalDocs(mockTechnicalDocs);
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

        // Update offer status (using quotes table for now)
        await supabase
          .from('quotes')
          .update({ status: 'sent' })
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

      const { error } = await supabase
        .from('quotes')
        .insert([{
          number: offerNumber,
          customer_id: newOffer.customer_id,
          date: new Date().toISOString().split('T')[0],
          total_amount: newOffer.amount,
          valid_until: newOffer.valid_until || null,
          notes: `${newOffer.title}\n\n${newOffer.description || ''}`,
          status: 'draft'
        }]);

      if (error) throw error;

      toast({
        title: "Offerta Creata",
        description: "L'offerta è stata creata con successo",
      });

      setIsCreateDialogOpen(false);
      setNewOffer({
        customer_id: '',
        title: '',
        description: '',
        amount: 0,
        valid_until: '',
        attachments: []
      });
      setSelectedDocs([]);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'default';
      case 'sent': return 'secondary';
      case 'approved': return 'secondary';
      case 'rejected': return 'destructive';
      default: return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Bozza';
      case 'sent': return 'Inviata';
      case 'approved': return 'Approvata';
      case 'rejected': return 'Rifiutata';
      default: return status;
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
              Nuova Offerta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuova Offerta</DialogTitle>
              <DialogDescription>
                Compila i dettagli dell'offerta e seleziona la documentazione da allegare
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Cliente</label>
                <Select value={newOffer.customer_id} onValueChange={(value) => 
                  setNewOffer(prev => ({ ...prev, customer_id: value }))
                }>
                  <SelectTrigger>
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
              
              <div>
                <label className="text-sm font-medium mb-2 block">Documentazione Tecnica da Allegare</label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
                  {technicalDocs.map((doc) => (
                    <label key={doc.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocs.includes(doc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDocs(prev => [...prev, doc.id]);
                          } else {
                            setSelectedDocs(prev => prev.filter(id => id !== doc.id));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{doc.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateOffer}>
                  Crea Offerta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
                <TableHead>Titolo</TableHead>
                <TableHead>Importo</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Creazione</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">{offer.number}</TableCell>
                  <TableCell>{offer.customer_name}</TableCell>
                  <TableCell>{offer.title}</TableCell>
                  <TableCell>€ {offer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(offer.status)}>
                      {getStatusText(offer.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(offer.created_at).toLocaleDateString('it-IT')}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(offer)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSendEmail(offer)}
                        disabled={offer.status === 'sent'}
                      >
                        <Mail className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}