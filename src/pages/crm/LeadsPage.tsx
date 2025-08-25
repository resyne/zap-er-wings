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
import { Plus, Search, TrendingUp, Mail, Phone, Users, Building2 } from "lucide-react";

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

const leadSources = ["website", "referral", "social_media", "cold_call", "trade_show", "other"];

export default function LeadsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
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

  const handleCreateContact = async () => {
    try {
      const contactData = {
        ...newContact,
        company_id: newContact.company_id || null
      };
      
      const { error } = await supabase
        .from("crm_contacts")
        .insert([contactData]);

      if (error) throw error;

      toast({
        title: "Contatto creato",
        description: "Il contatto è stato creato con successo",
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
    }
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setNewContact({
      first_name: contact.first_name || "",
      last_name: contact.last_name || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      job_title: contact.job_title || "",
      lead_source: contact.lead_source || "",
      company_id: contact.company_id || "",
      company_name: contact.company_name || "",
      piva: contact.piva || "",
      address: contact.address || "",
      sdi_code: contact.sdi_code || "",
      pec: contact.pec || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!selectedContact) return;
    
    try {
      const contactData = {
        ...newContact,
        company_id: newContact.company_id || null
      };
      
      const { error } = await supabase
        .from("crm_contacts")
        .update(contactData)
        .eq("id", selectedContact.id);

      if (error) throw error;

      toast({
        title: "Contatto aggiornato",
        description: "Il contatto è stato aggiornato con successo",
      });

      setIsEditDialogOpen(false);
      setSelectedContact(null);
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
        description: "Impossibile aggiornare il contatto: " + error.message,
        variant: "destructive",
      });
    }
  };

  const filteredContacts = contacts.filter(contact =>
    `${contact.first_name} ${contact.last_name} ${contact.email} ${contact.company?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalContacts = filteredContacts.length;
  const recentContacts = filteredContacts.filter(contact => {
    const createdDate = new Date(contact.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate > weekAgo;
  }).length;

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
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Gestisci tutti i tuoi contatti come leads</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Contatto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Contatto</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="first_name">Nome</Label>
                <Input
                  id="first_name"
                  value={newContact.first_name}
                  onChange={(e) => setNewContact({...newContact, first_name: e.target.value})}
                  placeholder="Mario"
                />
              </div>
              <div>
                <Label htmlFor="last_name">Cognome</Label>
                <Input
                  id="last_name"
                  value={newContact.last_name}
                  onChange={(e) => setNewContact({...newContact, last_name: e.target.value})}
                  placeholder="Rossi"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                  placeholder="mario.rossi@esempio.com"
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
                    {leadSources.map(source => (
                      <SelectItem key={source} value={source}>
                        {source === "website" ? "Sito Web" :
                         source === "referral" ? "Referral" :
                         source === "social_media" ? "Social Media" :
                         source === "cold_call" ? "Cold Call" :
                         source === "trade_show" ? "Fiera" :
                         "Altro"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Company Demographics Section */}
              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-medium mb-3">Anagrafica Azienda</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="company_name">Nome Azienda</Label>
                    <Input
                      id="company_name"
                      value={newContact.company_name}
                      onChange={(e) => setNewContact({...newContact, company_name: e.target.value})}
                      placeholder="ABC S.r.l."
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
                  <div className="col-span-2">
                    <Label htmlFor="address">Indirizzo</Label>
                    <Input
                      id="address"
                      value={newContact.address}
                      onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                      placeholder="Via Roma 123, 00100 Roma"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sdi_code">Codice SDI</Label>
                    <Input
                      id="sdi_code"
                      value={newContact.sdi_code}
                      onChange={(e) => setNewContact({...newContact, sdi_code: e.target.value})}
                      placeholder="ABCDEF1"
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
              <Button onClick={handleCreateContact}>
                Crea Contatto
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Contact Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifica Contatto</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_first_name">Nome</Label>
                <Input
                  id="edit_first_name"
                  value={newContact.first_name}
                  onChange={(e) => setNewContact({...newContact, first_name: e.target.value})}
                  placeholder="Mario"
                />
              </div>
              <div>
                <Label htmlFor="edit_last_name">Cognome</Label>
                <Input
                  id="edit_last_name"
                  value={newContact.last_name}
                  onChange={(e) => setNewContact({...newContact, last_name: e.target.value})}
                  placeholder="Rossi"
                />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input
                  id="edit_email"
                  type="email"
                  value={newContact.email}
                  onChange={(e) => setNewContact({...newContact, email: e.target.value})}
                  placeholder="mario.rossi@esempio.com"
                />
              </div>
              <div>
                <Label htmlFor="edit_phone">Telefono</Label>
                <Input
                  id="edit_phone"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({...newContact, phone: e.target.value})}
                  placeholder="+39 123 456 7890"
                />
              </div>
              <div>
                <Label htmlFor="edit_mobile">Cellulare</Label>
                <Input
                  id="edit_mobile"
                  value={newContact.mobile}
                  onChange={(e) => setNewContact({...newContact, mobile: e.target.value})}
                  placeholder="+39 123 456 7890"
                />
              </div>
              <div>
                <Label htmlFor="edit_job_title">Ruolo</Label>
                <Input
                  id="edit_job_title"
                  value={newContact.job_title}
                  onChange={(e) => setNewContact({...newContact, job_title: e.target.value})}
                  placeholder="Manager, Direttore..."
                />
              </div>
              <div className="col-span-2">
                <Label htmlFor="edit_lead_source">Fonte Lead</Label>
                <Select value={newContact.lead_source} onValueChange={(value) => setNewContact({...newContact, lead_source: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map(source => (
                      <SelectItem key={source} value={source}>
                        {source === "website" ? "Sito Web" :
                         source === "referral" ? "Referral" :
                         source === "social_media" ? "Social Media" :
                         source === "cold_call" ? "Cold Call" :
                         source === "trade_show" ? "Fiera" :
                         "Altro"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Company Demographics Section */}
              <div className="col-span-2 mt-4">
                <h3 className="text-lg font-medium mb-3">Anagrafica Azienda</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_company_name">Nome Azienda</Label>
                    <Input
                      id="edit_company_name"
                      value={newContact.company_name}
                      onChange={(e) => setNewContact({...newContact, company_name: e.target.value})}
                      placeholder="ABC S.r.l."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_piva">P.IVA</Label>
                    <Input
                      id="edit_piva"
                      value={newContact.piva}
                      onChange={(e) => setNewContact({...newContact, piva: e.target.value})}
                      placeholder="12345678901"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="edit_address">Indirizzo</Label>
                    <Input
                      id="edit_address"
                      value={newContact.address}
                      onChange={(e) => setNewContact({...newContact, address: e.target.value})}
                      placeholder="Via Roma 123, 00100 Roma"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_sdi_code">Codice SDI</Label>
                    <Input
                      id="edit_sdi_code"
                      value={newContact.sdi_code}
                      onChange={(e) => setNewContact({...newContact, sdi_code: e.target.value})}
                      placeholder="ABCDEF1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_pec">PEC</Label>
                    <Input
                      id="edit_pec"
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
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleUpdateContact}>
                Aggiorna Contatto
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Contatti</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacts}</div>
            <p className="text-xs text-muted-foreground">
              Contatti nel sistema
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuovi questa settimana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentContacts}</div>
            <p className="text-xs text-muted-foreground">
              Aggiunti negli ultimi 7 giorni
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Email</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredContacts.filter(c => c.email).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Contatti con email valida
            </p>
          </CardContent>
        </Card>
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
                <TableHead>Fonte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.map((contact) => (
                <TableRow 
                  key={contact.id} 
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleEditContact(contact)}
                >
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
                    {contact.company?.name && (
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-1 text-muted-foreground" />
                        {contact.company.name}
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
                    {contact.lead_source && (
                      <Badge variant="outline">{contact.lead_source}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredContacts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
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