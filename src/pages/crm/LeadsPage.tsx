import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, TrendingUp, Mail, Phone, Users, Building2, Zap, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";


interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  value?: number;
  source?: string;
  status: string;
  pipeline?: string;
  notes?: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

const leadSources = ["website", "referral", "social_media", "cold_call", "trade_show", "zapier", "other"];
const pipelines = ["ZAPPER", "Vesuviano", "ZAPPER Pro"];
const leadStatuses = [
  { id: "new", title: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { id: "contacted", title: "Contattato", color: "bg-yellow-100 text-yellow-800" },
  { id: "qualified", title: "Qualificato", color: "bg-green-100 text-green-800" },
  { id: "proposal", title: "Proposta", color: "bg-purple-100 text-purple-800" },
  { id: "negotiation", title: "Trattativa", color: "bg-orange-100 text-orange-800" },
  { id: "won", title: "Vinto", color: "bg-emerald-100 text-emerald-800" },
  { id: "lost", title: "Perso", color: "bg-red-100 text-red-800" }
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    value: "",
    source: "",
    status: "new",
    pipeline: "",
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
        description: "Impossibile caricare i lead: " + error.message,
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
        value: newLead.value ? parseFloat(newLead.value) : null
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
      resetForm();
      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il lead: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditLead = (lead: Lead) => {
    setSelectedLead(lead);
    setNewLead({
      company_name: lead.company_name,
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      value: lead.value ? lead.value.toString() : "",
      source: lead.source || "",
      status: lead.status,
      pipeline: lead.pipeline || "",
      notes: lead.notes || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    
    try {
      const leadData = {
        ...newLead,
        value: newLead.value ? parseFloat(newLead.value) : null
      };
      
      const { error } = await supabase
        .from("leads")
        .update(leadData)
        .eq("id", selectedLead.id);

      if (error) throw error;

      toast({
        title: "Lead aggiornato",
        description: "Il lead è stato aggiornato con successo",
      });

      setIsEditDialogOpen(false);
      setSelectedLead(null);
      resetForm();
      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il lead: " + error.message,
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setNewLead({
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      value: "",
      source: "",
      status: "new",
      pipeline: "",
      notes: "",
    });
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    try {
      const { error } = await supabase
        .from("leads")
        .update({ status: destination.droppableId })
        .eq("id", draggableId);

      if (error) throw error;

      // Update local state
      setLeads(prev => prev.map(l => 
        l.id === draggableId 
          ? { ...l, status: destination.droppableId }
          : l
      ));

      toast({
        title: "Lead aggiornato",
        description: `Lead spostato in ${leadStatuses.find(s => s.id === destination.droppableId)?.title}`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del lead",
        variant: "destructive",
      });
    }
  };

  const handleWebhookReceived = useCallback(() => {
    loadLeads();
    toast({
      title: "Nuovo lead ricevuto",
      description: "Un nuovo lead è stato aggiunto tramite Zapier",
    });
  }, []);

  const filteredLeads = leads.filter(lead =>
    `${lead.company_name} ${lead.contact_name} ${lead.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Group leads by status
  const leadsByStatus = leadStatuses.reduce((acc, status) => {
    acc[status.id] = filteredLeads.filter(lead => lead.status === status.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  const totalLeads = filteredLeads.length;
  const recentLeads = filteredLeads.filter(lead => {
    const createdDate = new Date(lead.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return createdDate > weekAgo;
  }).length;

  const totalValue = filteredLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento lead...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground">Gestisci i tuoi lead con il kanban board</p>
        </div>
        <div className="flex gap-2">
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
                    placeholder="ABC S.r.l."
                  />
                </div>
                <div>
                  <Label htmlFor="contact_name">Nome Contatto</Label>
                  <Input
                    id="contact_name"
                    value={newLead.contact_name}
                    onChange={(e) => setNewLead({...newLead, contact_name: e.target.value})}
                    placeholder="Mario Rossi"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                    placeholder="mario.rossi@esempio.com"
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
                  <Label htmlFor="value">Valore Stimato (€)</Label>
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
                          {source === "website" ? "Sito Web" :
                           source === "referral" ? "Referral" :
                           source === "social_media" ? "Social Media" :
                           source === "cold_call" ? "Cold Call" :
                           source === "trade_show" ? "Fiera" :
                           source === "zapier" ? "Zapier" :
                           "Altro"}
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
                        <SelectItem key={status.id} value={status.id}>
                          {status.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="pipeline">Pipeline</Label>
                  <Select value={newLead.pipeline} onValueChange={(value) => setNewLead({...newLead, pipeline: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(pipeline => (
                        <SelectItem key={pipeline} value={pipeline}>
                          {pipeline}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="notes">Note</Label>
                  <Textarea
                    id="notes"
                    value={newLead.notes}
                    onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                    placeholder="Note aggiuntive sul lead..."
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateLead}>
                  Crea Lead
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
            <CardTitle className="text-sm font-medium">Totale Lead</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuovi questa settimana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentLeads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso Conversione</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalLeads > 0 ? Math.round((leadsByStatus.won?.length || 0) / totalLeads * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca lead..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {leadStatuses.map(status => (
            <div key={status.id} className="bg-muted/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm">{status.title}</h3>
                <Badge variant="secondary" className={status.color}>
                  {leadsByStatus[status.id]?.length || 0}
                </Badge>
              </div>
              
              <Droppable droppableId={status.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-h-[200px] space-y-3 ${
                      snapshot.isDraggingOver ? 'bg-muted/50' : ''
                    }`}
                  >
                    {leadsByStatus[status.id]?.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`cursor-pointer transition-shadow hover:shadow-md ${
                              snapshot.isDragging ? 'shadow-lg' : ''
                            }`}
                            onClick={() => handleEditLead(lead)}
                          >
                            <CardContent className="p-3">
                              <div
                                {...provided.dragHandleProps}
                                className="flex items-start justify-between mb-2"
                              >
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm truncate">{lead.company_name}</h4>
                                  {lead.contact_name && (
                                    <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>
                                  )}
                                </div>
                                <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              </div>
                              
                              {lead.email && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground truncate">{lead.email}</span>
                                </div>
                              )}
                              
                              {lead.phone && (
                                <div className="flex items-center gap-1 mb-2">
                                  <Phone className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-xs text-muted-foreground">{lead.phone}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center justify-between">
                                {lead.value && (
                                  <span className="text-xs font-medium text-green-600">
                                    €{lead.value.toLocaleString()}
                                  </span>
                                )}
                                {lead.source && (
                                  <Badge variant="outline" className="text-xs">
                                    {lead.source === "zapier" ? <Zap className="h-3 w-3" /> : lead.source}
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Edit Lead Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Modifica Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="edit_company_name">Nome Azienda *</Label>
              <Input
                id="edit_company_name"
                value={newLead.company_name}
                onChange={(e) => setNewLead({...newLead, company_name: e.target.value})}
                placeholder="ABC S.r.l."
              />
            </div>
            <div>
              <Label htmlFor="edit_contact_name">Nome Contatto</Label>
              <Input
                id="edit_contact_name"
                value={newLead.contact_name}
                onChange={(e) => setNewLead({...newLead, contact_name: e.target.value})}
                placeholder="Mario Rossi"
              />
            </div>
            <div>
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                type="email"
                value={newLead.email}
                onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                placeholder="mario.rossi@esempio.com"
              />
            </div>
            <div>
              <Label htmlFor="edit_phone">Telefono</Label>
              <Input
                id="edit_phone"
                value={newLead.phone}
                onChange={(e) => setNewLead({...newLead, phone: e.target.value})}
                placeholder="+39 123 456 7890"
              />
            </div>
            <div>
              <Label htmlFor="edit_value">Valore Stimato (€)</Label>
              <Input
                id="edit_value"
                type="number"
                value={newLead.value}
                onChange={(e) => setNewLead({...newLead, value: e.target.value})}
                placeholder="10000"
              />
            </div>
            <div>
              <Label htmlFor="edit_source">Fonte</Label>
              <Select value={newLead.source} onValueChange={(value) => setNewLead({...newLead, source: value})}>
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
                       source === "zapier" ? "Zapier" :
                       "Altro"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_status">Stato</Label>
              <Select value={newLead.status} onValueChange={(value) => setNewLead({...newLead, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  {leadStatuses.map(status => (
                    <SelectItem key={status.id} value={status.id}>
                      {status.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit_pipeline">Pipeline</Label>
              <Select value={newLead.pipeline} onValueChange={(value) => setNewLead({...newLead, pipeline: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona pipeline" />
                </SelectTrigger>
                <SelectContent>
                  {pipelines.map(pipeline => (
                    <SelectItem key={pipeline} value={pipeline}>
                      {pipeline}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="edit_notes">Note</Label>
              <Textarea
                id="edit_notes"
                value={newLead.notes}
                onChange={(e) => setNewLead({...newLead, notes: e.target.value})}
                placeholder="Note aggiuntive sul lead..."
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleUpdateLead}>
              Salva Modifiche
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}