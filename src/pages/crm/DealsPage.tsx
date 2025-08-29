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
import { Plus, Search, RefreshCw, TrendingUp, Calendar, DollarSign } from "lucide-react";

interface Deal {
  id: string;
  name: string;
  amount?: number;
  stage?: string;
  probability?: number;
  expected_close_date?: string;
  contact?: {
    first_name?: string;
    last_name?: string;
  };
  company?: {
    name: string;
  };
  created_at: string;
}

const dealStages = [
  "Qualification",
  "Needs Analysis", 
  "Proposal",
  "Negotiation",
  "Closed Won",
  "Closed Lost"
];

export default function DealsPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [newDeal, setNewDeal] = useState({
    name: "",
    amount: "",
    stage: "",
    probability: "",
    expected_close_date: "",
    contact_id: "",
    company_id: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadDeals();
    loadContactsAndCompanies();
  }, []);

  const loadDeals = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_deals")
        .select(`
          *,
          contact:crm_contacts(first_name, last_name),
          company:crm_companies(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDeals(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i deal: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadContactsAndCompanies = async () => {
    try {
      const [contactsResponse, companiesResponse] = await Promise.all([
        supabase.from("crm_contacts").select("id, first_name, last_name"),
        supabase.from("crm_companies").select("id, name")
      ]);

      if (contactsResponse.error) throw contactsResponse.error;
      if (companiesResponse.error) throw companiesResponse.error;

      setContacts(contactsResponse.data || []);
      setCompanies(companiesResponse.data || []);
    } catch (error: any) {
      console.error("Error loading contacts/companies:", error);
    }
  };


  const handleCreateDeal = async () => {
    try {
      const dealData = {
        ...newDeal,
        amount: newDeal.amount ? parseFloat(newDeal.amount) : null,
        probability: newDeal.probability ? parseFloat(newDeal.probability) : null,
        contact_id: newDeal.contact_id || null,
        company_id: newDeal.company_id || null,
        expected_close_date: newDeal.expected_close_date || null,
      };

      const { error } = await supabase
        .from("crm_deals")
        .insert([dealData]);

      if (error) throw error;

      toast({
        title: "Deal creato",
        description: "Il deal è stato creato con successo",
      });

      setIsDialogOpen(false);
      setNewDeal({
        name: "",
        amount: "",
        stage: "",
        probability: "",
        expected_close_date: "",
        contact_id: "",
        company_id: "",
      });
      await loadDeals();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il deal: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStageColor = (stage?: string) => {
    switch (stage) {
      case "Closed Won":
        return "default";
      case "Closed Lost":
        return "destructive";
      case "Negotiation":
        return "secondary";
      default:
        return "outline";
    }
  };

  const filteredDeals = deals.filter(deal =>
    `${deal.name} ${deal.contact?.first_name || ""} ${deal.contact?.last_name || ""} ${deal.company?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);
  const wonDeals = filteredDeals.filter(deal => deal.stage === "Closed Won");
  const wonValue = wonDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento deal...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deal</h1>
          <p className="text-muted-foreground">Gestisci le tue opportunità di vendita</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuovo Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Crea Nuovo Deal</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome Deal *</Label>
                  <Input
                    id="name"
                    value={newDeal.name}
                    onChange={(e) => setNewDeal({...newDeal, name: e.target.value})}
                    placeholder="Nome del deal"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Valore (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newDeal.amount}
                    onChange={(e) => setNewDeal({...newDeal, amount: e.target.value})}
                    placeholder="10000"
                  />
                </div>
                <div>
                  <Label htmlFor="probability">Probabilità (%)</Label>
                  <Input
                    id="probability"
                    type="number"
                    min="0"
                    max="100"
                    value={newDeal.probability}
                    onChange={(e) => setNewDeal({...newDeal, probability: e.target.value})}
                    placeholder="75"
                  />
                </div>
                <div>
                  <Label htmlFor="stage">Fase</Label>
                  <Select value={newDeal.stage} onValueChange={(value) => setNewDeal({...newDeal, stage: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {dealStages.map(stage => (
                        <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expected_close_date">Data Chiusura Prevista</Label>
                  <Input
                    id="expected_close_date"
                    type="date"
                    value={newDeal.expected_close_date}
                    onChange={(e) => setNewDeal({...newDeal, expected_close_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_id">Contatto</Label>
                  <Select value={newDeal.contact_id} onValueChange={(value) => setNewDeal({...newDeal, contact_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona contatto" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map(contact => (
                        <SelectItem key={contact.id} value={contact.id}>
                          {contact.first_name} {contact.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="company_id">Azienda</Label>
                  <Select value={newDeal.company_id} onValueChange={(value) => setNewDeal({...newDeal, company_id: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona azienda" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateDeal} disabled={!newDeal.name}>
                  Crea Deal
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredDeals.length} deal attivi
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deal Vinti</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{wonValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {wonDeals.length} deal chiusi con successo
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Conversione</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredDeals.length > 0 ? Math.round((wonDeals.length / filteredDeals.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Deal vinti vs totali
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Deal ({filteredDeals.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca deal..."
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
                <TableHead>Nome Deal</TableHead>
                <TableHead>Contatto/Azienda</TableHead>
                <TableHead>Valore</TableHead>
                <TableHead>Fase</TableHead>
                <TableHead>Probabilità</TableHead>
                <TableHead>Chiusura Prevista</TableHead>
                
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell>
                    <span className="font-medium">{deal.name}</span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {deal.contact && (
                        <div className="text-sm">
                          {deal.contact.first_name} {deal.contact.last_name}
                        </div>
                      )}
                      {deal.company && (
                        <div className="text-sm text-muted-foreground">
                          {deal.company.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {deal.amount && (
                      <span className="font-medium">€{deal.amount.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {deal.stage && (
                      <Badge variant={getStageColor(deal.stage)}>
                        {deal.stage}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {deal.probability && (
                      <span className="text-sm">{deal.probability}%</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {deal.expected_close_date && (
                      <span className="text-sm">
                        {new Date(deal.expected_close_date).toLocaleDateString('it-IT')}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredDeals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun deal trovato" : "Nessun deal presente"}
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