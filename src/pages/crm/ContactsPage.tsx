
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Mail, Phone, Building2, FileText } from "lucide-react";

interface Contact {
  id: string;
  bigin_id?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  lead_source?: string;
  company_id?: string;
  company_name?: string;
  piva?: string;
  address?: string;
  sdi_code?: string;
  pec?: string;
  company?: {
    name: string;
  };
  created_at: string;
  synced_at?: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newContact, setNewContact] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    job_title: "",
    lead_source: "",
    company_id: "",
    company_name: "",
    piva: "",
    address: "",
    sdi_code: "",
    pec: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select(`
          *,
          company:crm_companies(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i contatti: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendToFattura24 = async (contactData: any) => {
    try {
      console.log('Sending contact to Fattura24:', contactData);
      
      const { data, error } = await supabase.functions.invoke('fattura24-sync', {
        body: {
          action: 'createCustomer',
          data: contactData
        }
      });

      if (error) {
        console.error('Error sending to Fattura24:', error);
        throw error;
      }

      console.log('Fattura24 response:', data);
      return data;
    } catch (error) {
      console.error('Failed to send to Fattura24:', error);
      // Non blocchiamo la creazione del contatto se Fattura24 fallisce
      return null;
    }
  };

  const createQuoteInFattura24 = async (contact: Contact) => {
    try {
      const quoteData = {
        customerId: contact.piva || contact.email, // Usa P.IVA o email come identificativo
        description: `Preventivo per ${contact.first_name} ${contact.last_name}`,
        items: [
          {
            description: "Servizio di consulenza",
            quantity: 1,
            unitPrice: 100.00
          }
        ],
        notes: `Cliente: ${contact.company_name || (contact.first_name + ' ' + contact.last_name)}`
      };

      const { data, error } = await supabase.functions.invoke('fattura24-sync', {
        body: {
          action: 'createQuote',
          data: quoteData
        }
      });

      if (error) throw error;

      toast({
        title: "Preventivo creato",
        description: data.message,
      });

      console.log('Quote created:', data);
    } catch (error: any) {
      console.error('Error creating quote:', error);
      toast({
        title: "Errore",
        description: "Impossibile creare il preventivo in Fattura24",
        variant: "destructive",
      });
    }
  };

  const handleCreateContact = async () => {
    setCreating(true);
    try {
      // Prima crea il contatto nel database
      const { data: contactData, error } = await supabase
        .from("crm_contacts")
        .insert([newContact])
        .select()
        .single();

      if (error) throw error;

      // Poi invia a Fattura24
      const fattura24Result = await sendToFattura24(newContact);
      
      let successMessage = "Il contatto è stato creato con successo";
      if (fattura24Result?.success) {
        successMessage += " e sincronizzato con Fattura24";
      }

      toast({
        title: "Contatto creato",
        description: successMessage,
      });

      setIsDialogOpen(false);
      setNewContact({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        mobile: "",
        job_title: "",
        lead_source: "",
        company_id: "",
        company_name: "",
        piva: "",
        address: "",
        sdi_code: "",
        pec: "",
      });
      await loadContacts();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il contatto: " + error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    `${contact.first_name} ${contact.last_name} ${contact.email} ${contact.company?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento contatti...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contatti</h1>
          <p className="text-muted-foreground">Gestisci i tuoi contatti CRM</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Contatto
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Contatto</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                {/* Dati Personali */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Dati Personali</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">Nome</Label>
                      <Input
                        id="first_name"
                        value={newContact.first_name}
                        onChange={(e) => setNewContact({...newContact, first_name: e.target.value})}
                        placeholder="Nome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Cognome</Label>
                      <Input
                        id="last_name"
                        value={newContact.last_name}
                        onChange={(e) => setNewContact({...newContact, last_name: e.target.value})}
                        placeholder="Cognome"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                        placeholder="email@esempio.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefono</Label>
                      <Input
                        id="phone"
                        value={newContact.phone}
                        onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                        placeholder="+39 123 456 7890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="mobile">Cellulare</Label>
                      <Input
                        id="mobile"
                        value={newContact.mobile}
                        onChange={(e) => setNewContact({...newContact, mobile: e.target.value})}
                        placeholder="+39 123 456 7890"
                      />
                    </div>
                    <div>
                      <Label htmlFor="job_title">Ruolo</Label>
                      <Input
                        id="job_title"
                        value={newContact.job_title}
                        onChange={(e) => setNewContact({...newContact, job_title: e.target.value})}
                        placeholder="Manager, Direttore..."
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="lead_source">Fonte Lead</Label>
                      <Select value={newContact.lead_source} onValueChange={(value) => setNewContact({...newContact, lead_source: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona fonte" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="website">Sito Web</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="social_media">Social Media</SelectItem>
                          <SelectItem value="cold_call">Cold Call</SelectItem>
                          <SelectItem value="trade_show">Fiera</SelectItem>
                          <SelectItem value="other">Altro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Anagrafica Azienda */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Anagrafica Azienda</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="company_name">Nome Azienda</Label>
                      <Input
                        id="company_name"
                        value={newContact.company_name}
                        onChange={(e) => setNewContact({...newContact, company_name: e.target.value})}
                        placeholder="Nome dell'azienda"
                      />
                    </div>
                    <div>
                      <Label htmlFor="piva">P.IVA</Label>
                      <Input
                        id="piva"
                        value={newContact.piva}
                        onChange={(e) => setNewContact({...newContact, piva: e.target.value})}
                        placeholder="12345678901"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sdi_code">Codice SDI</Label>
                      <Input
                        id="sdi_code"
                        value={newContact.sdi_code}
                        onChange={(e) => setNewContact({...newContact, sdi_code: e.target.value})}
                        placeholder="ABCDEFG"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="address">Indirizzo</Label>
                      <Input
                        id="address"
                        value={newContact.address}
                        onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                        placeholder="Via Roma 123, Milano (MI)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pec">PEC</Label>
                      <Input
                        id="pec"
                        type="email"
                        value={newContact.pec}
                        onChange={(e) => setNewContact({...newContact, pec: e.target.value})}
                        placeholder="azienda@pec.it"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateContact} disabled={creating}>
                  {creating ? "Creando..." : "Crea Contatto"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Contatti ({filteredContacts.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca contatti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Azienda</TableHead>
                <TableHead>Contatto</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>P.IVA</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.email && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Mail className="w-3 h-3 mr-1" />
                          {contact.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(contact.company?.name || contact.company_name) && (
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-1 text-muted-foreground" />
                        {contact.company?.name || contact.company_name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {contact.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 mr-1" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.mobile && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 mr-1" />
                          {contact.mobile}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {contact.job_title && (
                      <Badge variant="secondary">{contact.job_title}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.piva && (
                      <span className="text-sm font-mono">{contact.piva}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.lead_source && (
                      <Badge variant="outline">{contact.lead_source}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => createQuoteInFattura24(contact)}
                      className="flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Crea Preventivo
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun contatto trovato" : "Nessun contatto presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
