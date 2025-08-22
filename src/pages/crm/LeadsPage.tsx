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
import { Plus, Search, User, Mail, Phone, Building2 } from "lucide-react";

interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: string;
  value?: number;
  assigned_to?: string;
  notes?: string;
  created_at: string;
}

const leadStatuses = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];
const leadSources = ["website", "referral", "social_media", "cold_call", "trade_show", "advertisement", "other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newLead, setNewLead] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    source: "",
    status: "new",
    value: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i leads: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLead = async () => {
    try {
      const leadData = {
        ...newLead,
        value: newLead.value ? parseFloat(newLead.value) : null,
      };

      const { error } = await supabase
        .from("leads")
        .insert([leadData]);

      if (error) throw error;

      toast({
        title: "Lead creato",
        description: "Il lead è stato creato con successo",
      });

      setIsDialogOpen(false);
      setNewLead({
        company_name: "",
        contact_name: "",
        email: "",
        phone: "",
        source: "",
        status: "new",
        value: "",
        notes: "",
      });
      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il lead: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "won":
        return "default";
      case "lost":
        return "destructive";
      case "qualified":
        return "secondary";
      case "proposal":
        return "outline";
      default:
        return "outline";
    }
  };

  const filteredLeads = leads.filter(lead =>
    `${lead.company_name} ${lead.contact_name || ""} ${lead.email || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  const qualifiedLeads = filteredLeads.filter(lead => ["qualified", "proposal", "negotiation"].includes(lead.status || ""));

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento leads...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads</h1>
          <p className="text-muted-foreground">Gestisci i tuoi potenziali clienti e opportunità</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Crea Nuovo Lead</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="company_name">Nome Azienda *</Label>
                <Input
                  id="company_name"
                  value={newLead.company_name}
                  onChange={(e) => setNewLead({...newLead, company_name: e.target.value})}
                  placeholder="Nome azienda"
                  required
                />
              </div>
              <div>
                <Label htmlFor="contact_name">Nome Contatto</Label>
                <Input
                  id="contact_name"
                  value={newLead.contact_name}
                  onChange={(e) => setNewLead({...newLead, contact_name: e.target.value})}
                  placeholder="Nome e cognome"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newLead.email}
                  onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                  placeholder="email@esempio.com"
                />
              </div>
              <div>
                <Label htmlFor="phone">Telefono</Label>
                <Input
                  id="phone"
                  value={newLead.phone}
                  onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                  placeholder="+39 123 456 7890"
                />
              </div>
              <div>
                <Label htmlFor="value">Valore Potenziale (€)</Label>
                <Input
                  id="value"
                  type="number"
                  value={newLead.value}
                  onChange={(e) => setNewLead({...newLead, value: e.target.value})}
                  placeholder="10000"
                />
              </div>
              <div>
                <Label htmlFor="source">Fonte</Label>
                <Select value={newLead.source} onValueChange={(value) => setNewLead({...newLead, source: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fonte" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadSources.map(source => (
                      <SelectItem key={source} value={source}>
                        {source.replace('_', ' ').toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="status">Stato</Label>
                <Select value={newLead.status} onValueChange={(value) => setNewLead({...newLead, status: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona stato" />
                  </SelectTrigger>
                  <SelectContent>
                    {leadStatuses.map(status => (
                      <SelectItem key={status} value={status}>
                        {status.toUpperCase()}
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
              <Button onClick={handleCreateLead} disabled={!newLead.company_name}>
                Crea Lead
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Totali</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredLeads.length}</div>
            <p className="text-xs text-muted-foreground">
              Potenziali clienti
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Qualificati</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{qualifiedLeads.length}</div>
            <p className="text-xs text-muted-foreground">
              In fase avanzata
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Pipeline</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Valore totale potenziale
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Leads ({filteredLeads.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca leads..."
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
                <TableHead>Azienda</TableHead>
                <TableHead>Contatto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Telefono</TableHead>
                <TableHead>Valore</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Stato</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                      <span className="font-medium">{lead.company_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.contact_name && (
                      <div className="flex items-center">
                        <User className="w-4 h-4 mr-2 text-muted-foreground" />
                        {lead.contact_name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.email && (
                      <div className="flex items-center">
                        <Mail className="w-3 h-3 mr-1" />
                        {lead.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.phone && (
                      <div className="flex items-center">
                        <Phone className="w-3 h-3 mr-1" />
                        {lead.phone}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.value && (
                      <span className="font-medium">€{lead.value.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.source && (
                      <Badge variant="outline">
                        {lead.source.replace('_', ' ').toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.status && (
                      <Badge variant={getStatusColor(lead.status)}>
                        {lead.status.toUpperCase()}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessun lead trovato" : "Nessun lead presente"}
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