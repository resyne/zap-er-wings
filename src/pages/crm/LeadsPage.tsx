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
import { Plus, Search, TrendingUp, Mail, Phone, Users, Building2, Zap, GripVertical, Trash2, Edit, Calendar, Clock, User, ExternalLink, FileText, Link, Archive, CheckCircle2, XCircle } from "lucide-react";
import LeadActivities from "@/components/crm/LeadActivities";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useNavigate } from "react-router-dom";


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
  country?: string;
  archived?: boolean;
  notes?: string;
  assigned_to?: string;
  next_activity_type?: string;
  next_activity_date?: string;
  next_activity_notes?: string;
  next_activity_assigned_to?: string;
  created_at: string;
  updated_at: string;
}

interface Offer {
  id: string;
  number: string;
  title: string;
  amount: number;
  status: string;
  customer_name: string;
  lead_id?: string;
}

const leadSources = ["website", "referral", "social_media", "cold_call", "trade_show", "zapier", "other"];
const pipelines = ["ZAPPER", "Vesuviano", "ZAPPER Pro"];
const countries = ["Italia", "Francia", "Germania"];
// Solo le fasi principali per la Kanban
const kanbanStatuses = [
  { id: "new", title: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { id: "qualified", title: "Qualificato", color: "bg-green-100 text-green-800" },
  { id: "negotiation", title: "Trattativa", color: "bg-orange-100 text-orange-800" }
];

// Tutti gli stati per i form
const allStatuses = [
  ...kanbanStatuses,
  { id: "won", title: "Vinto", color: "bg-emerald-100 text-emerald-800" },
  { id: "lost", title: "Perso", color: "bg-red-100 text-red-800" }
];

export default function LeadsPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Array<{id: string, first_name: string, last_name: string, email: string}>>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("ZAPPER");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [currentLeadForOffer, setCurrentLeadForOffer] = useState<Lead | null>(null);
  const [newOffer, setNewOffer] = useState({
    title: "",
    customer_name: "",
    amount: "",
    status: "richiesta_offerta",
    description: "",
  });
  const [newLead, setNewLead] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    value: "",
    source: "",
    status: "new",
    pipeline: "ZAPPER",
    country: "Italia",
    notes: "",
    next_activity_type: "",
    next_activity_date: "",
    next_activity_notes: "",
    next_activity_assigned_to: null,
  });
  const { toast } = useToast();

  useEffect(() => {
    loadLeads();
    loadUsers();
    loadOffers();
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

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("user_type", "erp")
        .order("first_name", { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error.message);
    }
  };

  const loadOffers = async () => {
    try {
      const { data, error } = await supabase
        .from('offers')
        .select('id, number, title, amount, status, customer_name, lead_id')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOffers(data || []);
    } catch (error: any) {
      console.error('Error loading offers:', error.message);
    }
  };

  const handleCreateLead = async () => {
    try {
      const leadData = {
        ...newLead,
        value: newLead.value ? parseFloat(newLead.value) : null,
        pipeline: newLead.pipeline || selectedPipeline,
        next_activity_date: newLead.next_activity_date ? new Date(newLead.next_activity_date).toISOString() : null,
        next_activity_assigned_to: newLead.next_activity_assigned_to || null
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
      country: lead.country || "Italia",
      notes: lead.notes || "",
      next_activity_type: lead.next_activity_type || "",
      next_activity_date: lead.next_activity_date ? new Date(lead.next_activity_date).toISOString().slice(0, 16) : "",
      next_activity_notes: lead.next_activity_notes || "",
      next_activity_assigned_to: lead.next_activity_assigned_to || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    
    try {
      const leadData = {
        ...newLead,
        value: newLead.value ? parseFloat(newLead.value) : null,
        next_activity_date: newLead.next_activity_date ? new Date(newLead.next_activity_date).toISOString() : null
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

  const handleDeleteLead = async (leadId: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead eliminato",
        description: "Il lead è stato eliminato con successo",
      });

      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il lead: " + error.message,
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
      pipeline: selectedPipeline,
      country: "Italia",
      notes: "",
      next_activity_type: "",
      next_activity_date: "",
      next_activity_notes: "",
      next_activity_assigned_to: null,
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
        description: `Lead spostato in ${kanbanStatuses.find(s => s.id === destination.droppableId)?.title}`,
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del lead",
        variant: "destructive",
      });
    }
  };

  const handleWinLead = async (lead: Lead) => {
    try {
      // 1. Aggiorna il lead come vinto
      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "won" })
        .eq("id", lead.id);

      if (leadError) throw leadError;

      // 2. Crea un cliente con badge "vinto"
      const { data: customer, error: customerError } = await supabase
        .from("crm_contacts")
        .insert([{
          first_name: lead.contact_name?.split(' ')[0] || "",
          last_name: lead.contact_name?.split(' ').slice(1).join(' ') || "",
          company_name: lead.company_name,
          email: lead.email,
          phone: lead.phone,
          lead_source: "won_lead"
        }])
        .select()
        .single();

      if (customerError) throw customerError;

      // 3. Crea un ordine di vendita
      const { error: salesOrderError } = await supabase
        .from("sales_orders")
        .insert([{
          customer_id: customer.id,
          status: "draft",
          notes: `Ordine creato da lead vinto: ${lead.company_name}`,
          order_type: "lead_conversion",
          number: `SO-${Date.now()}`
        }]);

      if (salesOrderError) throw salesOrderError;

      toast({
        title: "Lead vinto!",
        description: "Cliente creato e ordine di vendita generato",
      });

      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile processare il lead vinto: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleLoseLead = async (lead: Lead) => {
    try {
      // 1. Aggiorna il lead come perso
      const { error: leadError } = await supabase
        .from("leads")
        .update({ status: "lost" })
        .eq("id", lead.id);

      if (leadError) throw leadError;

      // 2. Crea un cliente con badge "perso"
      const { error: customerError } = await supabase
        .from("crm_contacts")
        .insert([{
          first_name: lead.contact_name?.split(' ')[0] || "",
          last_name: lead.contact_name?.split(' ').slice(1).join(' ') || "",
          company_name: lead.company_name,
          email: lead.email,
          phone: lead.phone,
          lead_source: "lost_lead"
        }]);

      if (customerError) throw customerError;

      toast({
        title: "Lead perso",
        description: "Cliente creato con badge perso",
      });

      await loadLeads();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile processare il lead perso: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateOfferForLead = async (lead: Lead) => {
    setCurrentLeadForOffer(lead);
    setNewOffer({
      title: `Offerta per ${lead.company_name}`,
      customer_name: lead.company_name,
      amount: lead.value?.toString() || "",
      status: "richiesta_offerta",
      description: "",
    });
    setIsOfferDialogOpen(true);
  };

  const handleSubmitOffer = async () => {
    if (!currentLeadForOffer) return;

    try {
      // Generate a temporary offer number
      const timestamp = Date.now();
      const offerNumber = `OFF-${timestamp}`;

      const offerData = {
        number: offerNumber,
        title: newOffer.title,
        customer_name: newOffer.customer_name,
        amount: newOffer.amount ? parseFloat(newOffer.amount) : 0,
        status: newOffer.status,
        description: newOffer.description,
        lead_id: currentLeadForOffer.id,
      };

      const { error } = await supabase
        .from("offers")
        .insert([offerData]);

      if (error) throw error;

      toast({
        title: "Offerta creata",
        description: "L'offerta è stata creata con successo e collegata al lead",
      });

      setIsOfferDialogOpen(false);
      setCurrentLeadForOffer(null);
      setNewOffer({
        title: "",
        customer_name: "",
        amount: "",
        status: "richiesta_offerta",
        description: "",
      });
      await loadOffers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'offerta: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleLinkOfferToLead = async (leadId: string, offerId: string) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update({ lead_id: leadId })
        .eq("id", offerId);

      if (error) throw error;

      toast({
        title: "Offerta collegata",
        description: "L'offerta è stata collegata al lead con successo",
      });

      await loadOffers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile collegare l'offerta: " + error.message,
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

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.company_name} ${lead.contact_name} ${lead.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPipeline = !selectedPipeline || lead.pipeline === selectedPipeline;
    const matchesCountry = selectedCountry === "all" || lead.country === selectedCountry;
    const matchesArchived = showArchived ? lead.archived : !lead.archived;
    return matchesSearch && matchesPipeline && matchesCountry && matchesArchived;
  });

  // Group leads by status (solo per le fasi kanban)
  const leadsByStatus = kanbanStatuses.reduce((acc, status) => {
    acc[status.id] = filteredLeads.filter(lead => lead.status === status.id);
    return acc;
  }, {} as Record<string, Lead[]>);

  // Filtra solo i lead nelle fasi kanban
  const activeLeads = filteredLeads.filter(lead => 
    kanbanStatuses.some(status => status.id === lead.status)
  );

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

  const handleOpenBigin = () => {
    window.open('https://bigin.zoho.eu/', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lead Management</h1>
          <p className="text-muted-foreground">Gestisci i tuoi lead con il kanban board</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleOpenBigin} variant="outline">
            <ExternalLink className="w-4 h-4 mr-2" />
            Apri Bigin CRM
          </Button>
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
                      {allStatuses.map(status => (
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
                <div>
                  <Label htmlFor="country">Paese</Label>
                  <Select value={newLead.country} onValueChange={(value) => setNewLead({...newLead, country: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona paese" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map(country => (
                        <SelectItem key={country} value={country}>
                          {country}
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
                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3">Prossima Attività</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="next_activity_type">Tipo Attività</Label>
                      <Select value={newLead.next_activity_type} onValueChange={(value) => setNewLead({...newLead, next_activity_type: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="call">Chiamata</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="meeting">Incontro</SelectItem>
                          <SelectItem value="demo">Demo</SelectItem>
                          <SelectItem value="follow_up">Follow-up</SelectItem>
                          <SelectItem value="quote">Preventivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="next_activity_date">Data e Ora</Label>
                      <div className="flex gap-2 mb-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 1);
                            setNewLead({...newLead, next_activity_date: date.toISOString().slice(0, 16)});
                          }}
                        >
                          +1 giorno
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 3);
                            setNewLead({...newLead, next_activity_date: date.toISOString().slice(0, 16)});
                          }}
                        >
                          +3 giorni
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const date = new Date();
                            date.setDate(date.getDate() + 7);
                            setNewLead({...newLead, next_activity_date: date.toISOString().slice(0, 16)});
                          }}
                        >
                          +7 giorni
                        </Button>
                      </div>
                      <Input
                        id="next_activity_date"
                        type="datetime-local"
                        value={newLead.next_activity_date}
                        onChange={(e) => setNewLead({...newLead, next_activity_date: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label htmlFor="next_activity_assigned_to">Assegna a</Label>
                      <Select value={newLead.next_activity_assigned_to} onValueChange={(value) => setNewLead({...newLead, next_activity_assigned_to: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona utente" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map(user => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.first_name} {user.last_name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="next_activity_notes">Note Attività</Label>
                      <Textarea
                        id="next_activity_notes"
                        value={newLead.next_activity_notes}
                        onChange={(e) => setNewLead({...newLead, next_activity_notes: e.target.value})}
                        placeholder="Note per la prossima attività..."
                        rows={2}
                      />
                    </div>
                  </div>
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
              {totalLeads > 0 ? Math.round((filteredLeads.filter(l => l.status === "won").length) / totalLeads * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline, Country Filters and Search */}
      <div className="flex items-center space-x-4 flex-wrap">
        <div className="flex items-center space-x-2">
          <Label htmlFor="pipeline-filter">Pipeline:</Label>
          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
            <SelectTrigger className="w-48">
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
        <div className="flex items-center space-x-2">
          <Label htmlFor="country-filter">Paese:</Label>
          <Select value={selectedCountry} onValueChange={setSelectedCountry}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Seleziona paese" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i paesi</SelectItem>
              {countries.map(country => (
                <SelectItem key={country} value={country}>
                  {country}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant={showArchived ? "default" : "outline"}
          onClick={() => setShowArchived(!showArchived)}
          size="sm"
        >
          <Archive className="h-4 w-4 mr-2" />
          {showArchived ? "Nascondi archiviati" : "Mostra archiviati"}
        </Button>
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Cerca lead..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kanbanStatuses.map(status => (
            <div key={status.id} className="bg-muted/30 rounded-lg p-4 min-w-[300px]">
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
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                             <CardContent className="p-4 space-y-3">
                               {/* Header con titolo e azioni */}
                               <div className="flex items-start justify-between">
                                 <div className="flex-1 min-w-0">
                                   <div className="flex items-center gap-2 mb-1">
                                     <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                                     <h4 className="font-semibold text-sm truncate">{lead.company_name}</h4>
                                   </div>
                                   {lead.contact_name && (
                                     <p className="text-xs text-muted-foreground truncate ml-6">{lead.contact_name}</p>
                                   )}
                                 </div>
                                 <div className="flex items-center gap-1 flex-shrink-0">
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       handleEditLead(lead);
                                     }}
                                     className="h-6 w-6 p-0 hover:bg-muted"
                                   >
                                     <Edit className="h-3 w-3" />
                                   </Button>
                                   <AlertDialog>
                                     <AlertDialogTrigger asChild>
                                       <Button
                                         variant="ghost"
                                         size="sm"
                                         onClick={(e) => e.stopPropagation()}
                                         className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                       >
                                         <Trash2 className="h-3 w-3" />
                                       </Button>
                                     </AlertDialogTrigger>
                                     <AlertDialogContent>
                                       <AlertDialogHeader>
                                         <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
                                         <AlertDialogDescription>
                                           Questa azione non può essere annullata. Il lead verrà eliminato definitivamente dal sistema.
                                         </AlertDialogDescription>
                                       </AlertDialogHeader>
                                       <AlertDialogFooter>
                                         <AlertDialogCancel>Annulla</AlertDialogCancel>
                                         <AlertDialogAction
                                           onClick={() => handleDeleteLead(lead.id)}
                                           className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                         >
                                           Elimina
                                         </AlertDialogAction>
                                       </AlertDialogFooter>
                                     </AlertDialogContent>
                                   </AlertDialog>
                                 </div>
                               </div>

                               {/* Informazioni di contatto */}
                               <div className="space-y-2 border-t pt-2">
                                 {lead.email && (
                                   <div className="flex items-center gap-2">
                                     <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                     <span className="text-xs text-muted-foreground truncate">{lead.email}</span>
                                   </div>
                                 )}
                                 
                                 {lead.phone && (
                                   <div className="flex items-center gap-2">
                                     <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                     <span className="text-xs text-muted-foreground">{lead.phone}</span>
                                   </div>
                                 )}
                               </div>
                                
                                {/* Prossima attività */}
                                {(lead.next_activity_type || lead.next_activity_date) && (
                                  <div className="border-t pt-2">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Calendar className="h-3 w-3 text-blue-600 flex-shrink-0" />
                                      <span className="text-xs font-medium text-blue-600">Prossima attività</span>
                                    </div>
                                    <div className="ml-5 space-y-1">
                                      {lead.next_activity_type && (
                                        <div className="text-xs text-muted-foreground">
                                          <span className="font-medium">
                                            {lead.next_activity_type === "call" ? "Chiamata" :
                                             lead.next_activity_type === "email" ? "Email" :
                                             lead.next_activity_type === "meeting" ? "Incontro" :
                                             lead.next_activity_type === "demo" ? "Demo" :
                                             lead.next_activity_type === "follow_up" ? "Follow-up" :
                                             lead.next_activity_type === "quote" ? "Preventivo" :
                                             lead.next_activity_type}
                                          </span>
                                        </div>
                                      )}
                                      {lead.next_activity_date && (
                                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                          <Clock className="h-3 w-3" />
                                          <span>
                                            {new Date(lead.next_activity_date).toLocaleDateString('it-IT', {
                                              day: '2-digit',
                                              month: '2-digit',
                                              year: 'numeric',
                                              hour: '2-digit',
                                              minute: '2-digit'
                                            })}
                                          </span>
                                        </div>
                                      )}
                                       {lead.next_activity_notes && (
                                         <div className="text-xs text-muted-foreground italic truncate">
                                           {lead.next_activity_notes}
                                         </div>
                                       )}
                                       {lead.next_activity_assigned_to && (
                                         <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                           <User className="h-3 w-3" />
                                           <span>
                                             {users.find(u => u.id === lead.next_activity_assigned_to)?.first_name} {users.find(u => u.id === lead.next_activity_assigned_to)?.last_name}
                                           </span>
                                         </div>
                                       )}
                                     </div>
                                  </div>
                                 )}

                                  {/* Offerta collegata o pulsante per collegarla */}
                                  <div className="border-t pt-2">
                                    {offers.find(o => o.lead_id === lead.id) ? (
                                      <>
                                        <div className="flex items-center gap-2 mb-1">
                                          <FileText className="h-3 w-3 text-purple-600 flex-shrink-0" />
                                          <span className="text-xs font-medium text-purple-600">Offerta Collegata</span>
                                        </div>
                                        {(() => {
                                          const linkedOffer = offers.find(o => o.lead_id === lead.id);
                                          return linkedOffer && (
                                            <div className="ml-5 space-y-1">
                                              <div className="text-xs">
                                                <span className="font-medium">{linkedOffer.number}</span>
                                                {" - "}
                                                <span className="text-muted-foreground">{linkedOffer.title}</span>
                                              </div>
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-green-600 font-medium">
                                                  €{linkedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                </span>
                                                <Button
                                                   size="sm"
                                                   variant="ghost"
                                                   className="h-6 px-2"
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     navigate('/crm/offers');
                                                   }}
                                                 >
                                                   <ExternalLink className="h-3 w-3" />
                                                 </Button>
                                              </div>
                                            </div>
                                          );
                                        })()}
                                      </>
                                    ) : (
                                      <div className="space-y-2">
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="w-full h-8 text-xs"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleCreateOfferForLead(lead);
                                          }}
                                        >
                                          <Plus className="h-3 w-3 mr-1" />
                                          Crea Offerta
                                        </Button>
                                        <Dialog>
                                          <DialogTrigger asChild>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="w-full h-8 text-xs"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Link className="h-3 w-3 mr-1" />
                                              Collega Offerta
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent onClick={(e) => e.stopPropagation()}>
                                            <DialogHeader>
                                              <DialogTitle>Collega un'offerta esistente</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4">
                                              <div>
                                                <Label>Seleziona Offerta</Label>
                                                <Select onValueChange={(value) => handleLinkOfferToLead(lead.id, value)}>
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Seleziona un'offerta" />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {offers.filter(o => !o.lead_id).map(offer => (
                                                      <SelectItem key={offer.id} value={offer.id}>
                                                        {offer.number} - {offer.title} (€{offer.amount.toLocaleString()})
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                          </DialogContent>
                                        </Dialog>
                                      </div>
                                    )}
                                  </div>


                                {/* Footer con valore e fonte */}
                                <div className="flex items-center justify-between border-t pt-2">
                                  <div className="flex items-center gap-2">
                                    {lead.value && (
                                      <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                                        €{lead.value.toLocaleString()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {lead.source && (
                                      <Badge variant="outline" className="text-xs">
                                        {lead.source === "zapier" ? (
                                          <div className="flex items-center gap-1">
                                            <Zap className="h-3 w-3" />
                                            <span>Zapier</span>
                                          </div>
                                        ) : (
                                          lead.source === "social_media" ? "Social" :
                                          lead.source === "website" ? "Web" :
                                          lead.source === "referral" ? "Referral" :
                                          lead.source === "cold_call" ? "Cold Call" :
                                          lead.source === "trade_show" ? "Fiera" :
                                          "Altro"
                                        )}
                                      </Badge>
                                    )}
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted"
                                    >
                                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                   </div>
                                 </div>

                                {/* Bottoni Vinto/Perso/Archivia */}
                                {!lead.archived && (
                                  <div className="space-y-2 pt-2 border-t">
                                    {lead.status === "negotiation" && (
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleWinLead(lead);
                                          }}
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                        >
                                          <CheckCircle2 className="h-3 w-3 mr-1" />
                                          Vinto
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleLoseLead(lead);
                                          }}
                                          className="flex-1"
                                        >
                                          <XCircle className="h-3 w-3 mr-1" />
                                          Perso
                                        </Button>
                                      </div>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const { error } = await supabase
                                          .from('leads')
                                          .update({ archived: true })
                                          .eq('id', lead.id);
                                        
                                        if (!error) {
                                          toast({
                                            title: "Lead archiviato",
                                            description: "Il lead è stato archiviato con successo."
                                          });
                                          loadLeads();
                                        }
                                      }}
                                      className="w-full"
                                    >
                                      <Archive className="h-3 w-3 mr-1" />
                                      Archivia
                                    </Button>
                                  </div>
                                )}
                                {lead.archived && (
                                  <div className="pt-2 border-t">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        const { error } = await supabase
                                          .from('leads')
                                          .update({ archived: false })
                                          .eq('id', lead.id);
                                        
                                        if (!error) {
                                          toast({
                                            title: "Lead ripristinato",
                                            description: "Il lead è stato ripristinato con successo."
                                          });
                                          loadLeads();
                                        }
                                      }}
                                      className="w-full"
                                    >
                                      <Archive className="h-3 w-3 mr-1" />
                                      Ripristina
                                    </Button>
                                  </div>
                                )}
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

      {/* Lead Details Dialog */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {selectedLead?.company_name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Contatto</label>
                  <p className="text-sm">{selectedLead.contact_name || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Pipeline</label>
                  <p className="text-sm">{selectedLead.pipeline || '-'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm flex items-center gap-2">
                    {selectedLead.email ? (
                      <>
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        {selectedLead.email}
                      </>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefono</label>
                  <p className="text-sm flex items-center gap-2">
                    {selectedLead.phone ? (
                      <>
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {selectedLead.phone}
                      </>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valore Stimato</label>
                  <p className="text-sm font-semibold text-green-600">
                    {selectedLead.value ? `€${selectedLead.value.toLocaleString('it-IT')}` : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fonte</label>
                  <p className="text-sm">
                    {selectedLead.source === "zapier" ? "Zapier" :
                     selectedLead.source === "social_media" ? "Social Media" :
                     selectedLead.source === "website" ? "Sito Web" :
                     selectedLead.source === "referral" ? "Referral" :
                     selectedLead.source === "cold_call" ? "Cold Call" :
                     selectedLead.source === "trade_show" ? "Fiera" :
                     selectedLead.source || '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Stato</label>
                  <Badge className={allStatuses.find(s => s.id === selectedLead.status)?.color || ''}>
                    {allStatuses.find(s => s.id === selectedLead.status)?.title || selectedLead.status}
                  </Badge>
                </div>
              </div>

              {/* Notes */}
              {selectedLead.notes && (
                <div className="border-t pt-4">
                  <label className="text-sm font-medium text-muted-foreground">Note</label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedLead.notes}</p>
                </div>
              )}

              {/* Next Activity */}
              {(selectedLead.next_activity_type || selectedLead.next_activity_date) && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-blue-600" />
                    <label className="text-sm font-medium text-blue-600">Prossima Attività</label>
                  </div>
                  <div className="ml-6 space-y-2">
                    {selectedLead.next_activity_type && (
                      <div>
                        <span className="text-sm font-medium">Tipo: </span>
                        <span className="text-sm text-muted-foreground">
                          {selectedLead.next_activity_type === "call" ? "Chiamata" :
                           selectedLead.next_activity_type === "email" ? "Email" :
                           selectedLead.next_activity_type === "meeting" ? "Incontro" :
                           selectedLead.next_activity_type === "demo" ? "Demo" :
                           selectedLead.next_activity_type === "follow_up" ? "Follow-up" :
                           selectedLead.next_activity_type === "quote" ? "Preventivo" :
                           selectedLead.next_activity_type}
                        </span>
                      </div>
                    )}
                    {selectedLead.next_activity_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {new Date(selectedLead.next_activity_date).toLocaleDateString('it-IT', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                    {selectedLead.next_activity_notes && (
                      <p className="text-sm text-muted-foreground italic">{selectedLead.next_activity_notes}</p>
                    )}
                    {selectedLead.next_activity_assigned_to && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">
                          {users.find(u => u.id === selectedLead.next_activity_assigned_to)?.first_name} {users.find(u => u.id === selectedLead.next_activity_assigned_to)?.last_name}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Offer */}
              {offers.find(o => o.lead_id === selectedLead.id) && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <label className="text-sm font-medium text-purple-600">Offerta Collegata</label>
                  </div>
                  {(() => {
                    const linkedOffer = offers.find(o => o.lead_id === selectedLead.id);
                    return linkedOffer && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <span className="text-sm font-medium">{linkedOffer.number}</span>
                          <span className="text-sm text-muted-foreground"> - {linkedOffer.title}</span>
                        </div>
                        <div className="text-sm text-green-600 font-medium">
                          €{linkedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setIsDetailsDialogOpen(false);
                            navigate('/crm/offers');
                          }}
                        >
                          Vai all'offerta
                          <ExternalLink className="h-3 w-3 ml-2" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Lead Activities Component */}
              <div className="border-t pt-4">
                <LeadActivities leadId={selectedLead.id} />
              </div>

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleEditLead(selectedLead);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifica
                </Button>
                {!offers.find(o => o.lead_id === selectedLead.id) && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      handleCreateOfferForLead(selectedLead);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Offerta
                  </Button>
                )}
                {selectedLead.status === "negotiation" && (
                  <>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => {
                        handleWinLead(selectedLead);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      Vinto
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => {
                        handleLoseLead(selectedLead);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      Perso
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
                  {allStatuses.map(status => (
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
            <div className="col-span-2 border-t pt-4">
              <h4 className="font-medium mb-3">Prossima Attività</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_next_activity_type">Tipo Attività</Label>
                  <Select value={newLead.next_activity_type} onValueChange={(value) => setNewLead({...newLead, next_activity_type: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Chiamata</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="meeting">Incontro</SelectItem>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="quote">Preventivo</SelectItem>
                    </SelectContent>
                  </Select>
                  </div>
                  <div>
                    <Label htmlFor="edit_next_activity_date">Data e Ora</Label>
                    <Input
                      id="edit_next_activity_date"
                      type="datetime-local"
                      value={newLead.next_activity_date}
                      onChange={(e) => setNewLead({...newLead, next_activity_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_next_activity_assigned_to">Assegna a</Label>
                    <Select value={newLead.next_activity_assigned_to} onValueChange={(value) => setNewLead({...newLead, next_activity_assigned_to: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona utente" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map(user => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.first_name} {user.last_name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                  <Label htmlFor="edit_next_activity_notes">Note Attività</Label>
                  <Textarea
                    id="edit_next_activity_notes"
                    value={newLead.next_activity_notes}
                    onChange={(e) => setNewLead({...newLead, next_activity_notes: e.target.value})}
                    placeholder="Note per la prossima attività..."
                    rows={2}
                  />
                </div>
              </div>
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

      {/* Dialog per creare una nuova offerta */}
      <Dialog open={isOfferDialogOpen} onOpenChange={setIsOfferDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crea Nuova Offerta per {currentLeadForOffer?.company_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="offer_title">Titolo Offerta *</Label>
              <Input
                id="offer_title"
                value={newOffer.title}
                onChange={(e) => setNewOffer({...newOffer, title: e.target.value})}
                placeholder="Offerta per..."
              />
            </div>
            <div>
              <Label htmlFor="offer_customer">Cliente</Label>
              <Input
                id="offer_customer"
                value={newOffer.customer_name}
                onChange={(e) => setNewOffer({...newOffer, customer_name: e.target.value})}
                placeholder="Nome cliente"
              />
            </div>
            <div>
              <Label htmlFor="offer_amount">Importo (€)</Label>
              <Input
                id="offer_amount"
                type="number"
                value={newOffer.amount}
                onChange={(e) => setNewOffer({...newOffer, amount: e.target.value})}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label htmlFor="offer_status">Stato</Label>
              <Select value={newOffer.status} onValueChange={(value) => setNewOffer({...newOffer, status: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="richiesta_offerta">Richiesta Offerta</SelectItem>
                  <SelectItem value="offerta_pronta">Offerta Pronta</SelectItem>
                  <SelectItem value="offerta_inviata">Offerta Inviata</SelectItem>
                  <SelectItem value="negoziazione">Negoziazione</SelectItem>
                  <SelectItem value="accettata">Accettata</SelectItem>
                  <SelectItem value="rifiutata">Rifiutata</SelectItem>
                  <SelectItem value="scaduta">Scaduta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="offer_description">Descrizione</Label>
              <Textarea
                id="offer_description"
                value={newOffer.description}
                onChange={(e) => setNewOffer({...newOffer, description: e.target.value})}
                placeholder="Descrizione dell'offerta..."
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsOfferDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmitOffer}>
              Crea Offerta
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}