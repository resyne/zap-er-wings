import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, TrendingUp, Calendar, DollarSign, MoreHorizontal } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";

interface Opportunity {
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

const opportunityStages = [
  { id: "qualificazione", name: "Qualificazione", color: "bg-blue-500" },
  { id: "da_esaminare", name: "Da esaminare", color: "bg-yellow-500" },
  { id: "proposta_preventivo", name: "Proposta preventivo", color: "bg-orange-500" },
  { id: "negoziazione", name: "Negoziazione", color: "bg-purple-500" },
  { id: "chiusa", name: "Chiusa", color: "bg-green-500" },
  { id: "presa", name: "Presa", color: "bg-gray-500" },
];

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [newOpportunity, setNewOpportunity] = useState({
    name: "",
    amount: "",
    stage: "qualificazione",
    probability: "",
    expected_close_date: "",
    contact_id: "",
    company_id: "",
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadOpportunities();
    loadContactsAndCompanies();
  }, []);

  const loadOpportunities = async () => {
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
      setOpportunities(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le opportunità: " + error.message,
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

  const handleCreateOpportunity = async () => {
    try {
      const opportunityData = {
        ...newOpportunity,
        amount: newOpportunity.amount ? parseFloat(newOpportunity.amount) : null,
        probability: newOpportunity.probability ? parseFloat(newOpportunity.probability) : null,
        contact_id: newOpportunity.contact_id || null,
        company_id: newOpportunity.company_id || null,
        expected_close_date: newOpportunity.expected_close_date || null,
      };

      const { error } = await supabase
        .from("crm_deals")
        .insert([opportunityData]);

      if (error) throw error;

      toast({
        title: "Opportunità creata",
        description: "L'opportunità è stata creata con successo",
      });

      setIsDialogOpen(false);
      setNewOpportunity({
        name: "",
        amount: "",
        stage: "qualificazione",
        probability: "",
        expected_close_date: "",
        contact_id: "",
        company_id: "",
      });
      await loadOpportunities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'opportunità: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStage = destination.droppableId;
    
    try {
      const { error } = await supabase
        .from("crm_deals")
        .update({ stage: newStage })
        .eq("id", draggableId);

      if (error) throw error;

      // Update local state
      setOpportunities(prev => 
        prev.map(opp => 
          opp.id === draggableId 
            ? { ...opp, stage: newStage }
            : opp
        )
      );

      toast({
        title: "Opportunità aggiornata",
        description: "La fase dell'opportunità è stata aggiornata",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'opportunità: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter(opp => opp.stage === stageId);
  };

  const filteredOpportunities = opportunities.filter(opp =>
    `${opp.name} ${opp.contact?.first_name || ""} ${opp.contact?.last_name || ""} ${opp.company?.name || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalValue = filteredOpportunities.reduce((sum, opp) => sum + (opp.amount || 0), 0);
  const wonOpportunities = filteredOpportunities.filter(opp => opp.stage === "chiusa");
  const wonValue = wonOpportunities.reduce((sum, opp) => sum + (opp.amount || 0), 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento opportunità...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Opportunità</h1>
          <p className="text-muted-foreground">Gestisci le tue opportunità di vendita con il kanban</p>
        </div>
        <div className="flex gap-2">
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Cerca opportunità..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuova Opportunità
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crea Nuova Opportunità</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome Opportunità *</Label>
                  <Input
                    id="name"
                    value={newOpportunity.name}
                    onChange={(e) => setNewOpportunity({...newOpportunity, name: e.target.value})}
                    placeholder="Nome dell'opportunità"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Valore (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newOpportunity.amount}
                    onChange={(e) => setNewOpportunity({...newOpportunity, amount: e.target.value})}
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
                    value={newOpportunity.probability}
                    onChange={(e) => setNewOpportunity({...newOpportunity, probability: e.target.value})}
                    placeholder="75"
                  />
                </div>
                <div>
                  <Label htmlFor="stage">Fase</Label>
                  <Select value={newOpportunity.stage} onValueChange={(value) => setNewOpportunity({...newOpportunity, stage: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona fase" />
                    </SelectTrigger>
                    <SelectContent>
                      {opportunityStages.map(stage => (
                        <SelectItem key={stage.id} value={stage.id}>{stage.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="expected_close_date">Data Chiusura Prevista</Label>
                  <Input
                    id="expected_close_date"
                    type="date"
                    value={newOpportunity.expected_close_date}
                    onChange={(e) => setNewOpportunity({...newOpportunity, expected_close_date: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_id">Contatto</Label>
                  <Select value={newOpportunity.contact_id} onValueChange={(value) => setNewOpportunity({...newOpportunity, contact_id: value})}>
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
                  <Select value={newOpportunity.company_id} onValueChange={(value) => setNewOpportunity({...newOpportunity, company_id: value})}>
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
                <Button onClick={handleCreateOpportunity} disabled={!newOpportunity.name}>
                  Crea Opportunità
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {filteredOpportunities.length} opportunità attive
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vinte</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{wonValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {wonOpportunities.length} opportunità chiuse
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso Conversione</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredOpportunities.length > 0 ? Math.round((wonOpportunities.length / filteredOpportunities.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Opportunità vinte vs totali
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Negoziazione</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {getOpportunitiesByStage("negoziazione").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Opportunità in fase di negoziazione
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 min-h-[600px]">
          {opportunityStages.map((stage) => {
            const stageOpportunities = getOpportunitiesByStage(stage.id).filter(opp =>
              searchTerm === "" || `${opp.name} ${opp.contact?.first_name || ""} ${opp.contact?.last_name || ""} ${opp.company?.name || ""}`
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
            );

            return (
              <Card key={stage.id} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${stage.color}`}></div>
                      {stage.name}
                    </CardTitle>
                    <Badge variant="secondary">{stageOpportunities.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 min-h-[400px] p-2 rounded-lg transition-colors ${
                          snapshot.isDraggingOver ? 'bg-muted/50' : ''
                        }`}
                      >
                        {stageOpportunities.map((opportunity, index) => (
                          <Draggable key={opportunity.id} draggableId={opportunity.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 rounded-lg border bg-card text-card-foreground shadow-sm transition-transform cursor-pointer ${
                                  snapshot.isDragging ? 'rotate-3 shadow-lg' : 'hover:shadow-md'
                                }`}
                                onClick={(e) => {
                                  if (!snapshot.isDragging) {
                                    e.stopPropagation();
                                    navigate(`/crm/opportunities/${opportunity.id}`);
                                  }
                                }}
                              >
                                <div className="space-y-2">
                                  <h4 className="font-medium text-sm line-clamp-2">{opportunity.name}</h4>
                                  
                                  {opportunity.amount && (
                                    <div className="text-sm font-semibold text-green-600">
                                      €{opportunity.amount.toLocaleString()}
                                    </div>
                                  )}
                                  
                                  {(opportunity.contact || opportunity.company) && (
                                    <div className="text-xs text-muted-foreground space-y-1">
                                      {opportunity.contact && (
                                        <div>{opportunity.contact.first_name} {opportunity.contact.last_name}</div>
                                      )}
                                      {opportunity.company && (
                                        <div>{opportunity.company.name}</div>
                                      )}
                                    </div>
                                  )}
                                  
                                  {opportunity.expected_close_date && (
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {new Date(opportunity.expected_close_date).toLocaleDateString('it-IT')}
                                    </div>
                                  )}
                                  
                                  {opportunity.probability && (
                                    <div className="text-xs">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-muted-foreground">Probabilità</span>
                                        <span>{opportunity.probability}%</span>
                                      </div>
                                      <div className="w-full bg-muted rounded-full h-1">
                                        <div 
                                          className="bg-primary h-1 rounded-full transition-all" 
                                          style={{ width: `${opportunity.probability}%` }}
                                        ></div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}