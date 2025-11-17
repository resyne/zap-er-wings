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
import { Plus, Search, TrendingUp, Mail, Phone, Users, Building2, Zap, GripVertical, Trash2, Edit, Calendar, Clock, User, ExternalLink, FileText, Link, Archive, CheckCircle2, XCircle, Upload, X } from "lucide-react";
import LeadActivities from "@/components/crm/LeadActivities";
import LeadFileUpload from "@/components/crm/LeadFileUpload";
import LeadComments from "@/components/crm/LeadComments";
import { GenerateConfiguratorLink } from "@/components/crm/GenerateConfiguratorLink";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateOfferDialog } from "@/components/dashboard/CreateOfferDialog";
import { cn } from "@/lib/utils";


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
  created_by?: string;
  external_configurator_link?: string | null;
  custom_fields?: {
    // ZAPPER fields
    tipo_attivita?: string;
    diametro_canna_fumaria?: string;
    luogo?: string;
    installazione?: boolean;
    // VESUVIANO fields
    dimensioni_forno?: string;
    alimentazione?: string;
    pronta_consegna?: boolean;
  };
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
const pipelines = ["Zapper", "Vesuviano", "Zapper Pro", "Resyne"];
const countries = ["Italia", "Francia", "Germania"];
// Tutte le colonne per la Kanban
const kanbanStatuses = [
  { id: "new", title: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { id: "qualified", title: "Qualificato", color: "bg-green-100 text-green-800" },
  { id: "negotiation", title: "Trattativa", color: "bg-orange-100 text-orange-800" },
  { id: "won", title: "Vinto", color: "bg-emerald-100 text-emerald-800" },
  { id: "lost", title: "Perso", color: "bg-red-100 text-red-800" }
];

// Tutti gli stati per i form (stessi del kanban)
const allStatuses = kanbanStatuses;

export default function LeadsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hideAmounts } = useHideAmounts();
  const isMobile = useIsMobile();
  const [users, setUsers] = useState<Array<{id: string, first_name: string, last_name: string, email: string}>>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPipeline, setSelectedPipeline] = useState<string>("Zapper");
  const [selectedCountry, setSelectedCountry] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [leadForOffer, setLeadForOffer] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    value: "",
    source: "",
    status: "new",
    pipeline: "Zapper",
    country: "Italia",
    notes: "",
    next_activity_type: "",
    next_activity_date: "",
    next_activity_notes: "",
    next_activity_assigned_to: null,
    // Custom fields
    tipo_attivita: "",
    diametro_canna_fumaria: "",
    luogo: "",
    installazione: false,
    dimensioni_forno: "",
    alimentazione: "",
    pronta_consegna: false,
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadLeads();
    loadUsers();
    loadOffers();
  }, []);

  // Realtime subscription per nuovi lead
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Nuovo lead ricevuto:', payload.new);
          setLeads((prevLeads) => [payload.new as Lead, ...prevLeads]);
          toast({
            title: "Nuovo lead",
            description: `Nuovo lead aggiunto: ${(payload.new as Lead).company_name}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // Gestione parametro URL per aprire un lead specifico
  useEffect(() => {
    const leadId = searchParams.get('lead');
    if (leadId && leads.length > 0) {
      const lead = leads.find(l => l.id === leadId);
      if (lead) {
        // Imposta la pipeline corretta
        setSelectedPipeline(lead.pipeline || "Zapper");
        // Apri il dialog del lead
        setSelectedLead(lead);
        setIsDetailsDialogOpen(true);
        // Rimuovi il parametro dall'URL
        setSearchParams({});
      }
    }
  }, [searchParams, leads]);

  const loadLeads = async () => {
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*, created_by")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLeads((data || []) as Lead[]);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Prepare custom fields based on pipeline
      const custom_fields: any = {};
      if (newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") {
        custom_fields.tipo_attivita = newLead.tipo_attivita;
        custom_fields.diametro_canna_fumaria = newLead.diametro_canna_fumaria;
        custom_fields.luogo = newLead.luogo;
        custom_fields.installazione = newLead.installazione;
      } else if (newLead.pipeline === "Vesuviano") {
        custom_fields.dimensioni_forno = newLead.dimensioni_forno;
        custom_fields.alimentazione = newLead.alimentazione;
        custom_fields.pronta_consegna = newLead.pronta_consegna;
      }

      const leadData = {
        company_name: newLead.company_name,
        contact_name: newLead.contact_name,
        email: newLead.email,
        phone: newLead.phone,
        value: newLead.value ? parseFloat(newLead.value) : null,
        source: newLead.source,
        status: newLead.status,
        pipeline: newLead.pipeline || selectedPipeline,
        country: newLead.country,
        notes: newLead.notes,
        next_activity_type: newLead.next_activity_type,
        next_activity_date: newLead.next_activity_date ? new Date(newLead.next_activity_date).toISOString() : null,
        next_activity_notes: newLead.next_activity_notes,
        next_activity_assigned_to: newLead.next_activity_assigned_to || null,
        custom_fields
      };
      
      const { data: newLeadData, error } = await supabase
        .from("leads")
        .insert([leadData])
        .select()
        .single();

      if (error) throw error;

      // Upload pending files if any
      if (pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${newLeadData.id}/${Date.now()}_${file.name}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
              .from("lead-files")
              .upload(filePath, file);

            if (uploadError) throw uploadError;

            await supabase
              .from("lead_files")
              .insert([{
                lead_id: newLeadData.id,
                file_name: file.name,
                file_path: filePath,
                file_type: file.type,
                file_size: file.size,
                uploaded_by: user.id
              }]);
          } catch (fileError: any) {
            console.error(`Error uploading file ${file.name}:`, fileError);
          }
        }
      }

      // Se c'è una prossima attività, creala anche nella tabella lead_activities
      if (newLead.next_activity_type && newLead.next_activity_date && newLeadData) {
        await supabase.from("lead_activities").insert([{
          lead_id: newLeadData.id,
          activity_type: newLead.next_activity_type,
          activity_date: new Date(newLead.next_activity_date).toISOString(),
          assigned_to: newLead.next_activity_assigned_to || null,
          notes: newLead.next_activity_notes || null,
          status: "scheduled",
          created_by: user.id
        }]);

        // Aggiungi al calendario se assegnata
        if (newLead.next_activity_assigned_to) {
          await supabase.from("calendar_events").insert([{
            user_id: newLead.next_activity_assigned_to,
            title: `Lead Activity: ${newLead.next_activity_type}`,
            description: newLead.next_activity_notes || "",
            event_date: new Date(newLead.next_activity_date).toISOString(),
            event_type: "lead_activity",
            color: "blue"
          }]);
        }
      }

      toast({
        title: "Lead creato",
        description: `Lead creato con successo${pendingFiles.length > 0 ? ` con ${pendingFiles.length} file` : ''}`,
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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files);
      const validFiles = newFiles.filter(file => {
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File troppo grande",
            description: `${file.name} supera il limite di 20MB`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });
      setPendingFiles(prev => [...prev, ...validFiles]);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(file => {
        if (file.size > 20 * 1024 * 1024) {
          toast({
            title: "File troppo grande",
            description: `${file.name} supera il limite di 20MB`,
            variant: "destructive",
          });
          return false;
        }
        return true;
      });
      setPendingFiles(prev => [...prev, ...validFiles]);
    }
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
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
      // Custom fields
      tipo_attivita: lead.custom_fields?.tipo_attivita || "",
      diametro_canna_fumaria: lead.custom_fields?.diametro_canna_fumaria || "",
      luogo: lead.custom_fields?.luogo || "",
      installazione: lead.custom_fields?.installazione || false,
      dimensioni_forno: lead.custom_fields?.dimensioni_forno || "",
      alimentazione: lead.custom_fields?.alimentazione || "",
      pronta_consegna: lead.custom_fields?.pronta_consegna || false,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLead = async () => {
    if (!selectedLead) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Prepare custom fields based on pipeline
      const custom_fields: any = {};
      if (newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") {
        custom_fields.tipo_attivita = newLead.tipo_attivita;
        custom_fields.diametro_canna_fumaria = newLead.diametro_canna_fumaria;
        custom_fields.luogo = newLead.luogo;
        custom_fields.installazione = newLead.installazione;
      } else if (newLead.pipeline === "Vesuviano") {
        custom_fields.dimensioni_forno = newLead.dimensioni_forno;
        custom_fields.alimentazione = newLead.alimentazione;
        custom_fields.pronta_consegna = newLead.pronta_consegna;
      }

      const leadData = {
        company_name: newLead.company_name,
        contact_name: newLead.contact_name,
        email: newLead.email,
        phone: newLead.phone,
        value: newLead.value ? parseFloat(newLead.value) : null,
        source: newLead.source,
        status: newLead.status,
        pipeline: newLead.pipeline,
        country: newLead.country,
        notes: newLead.notes,
        next_activity_type: newLead.next_activity_type,
        next_activity_date: newLead.next_activity_date ? new Date(newLead.next_activity_date).toISOString() : null,
        next_activity_notes: newLead.next_activity_notes,
        next_activity_assigned_to: newLead.next_activity_assigned_to || null,
        custom_fields
      };
      
      const { error } = await supabase
        .from("leads")
        .update(leadData)
        .eq("id", selectedLead.id);

      if (error) throw error;

      // Se c'è una nuova prossima attività o è stata modificata, aggiornala anche in lead_activities
      if (newLead.next_activity_type && newLead.next_activity_date) {
        // Controlla se esiste già un'attività per questo lead
        const { data: existingActivity } = await supabase
          .from("lead_activities")
          .select("id")
          .eq("lead_id", selectedLead.id)
          .eq("activity_type", newLead.next_activity_type)
          .eq("status", "scheduled")
          .maybeSingle();

        if (existingActivity) {
          // Aggiorna l'attività esistente
          await supabase
            .from("lead_activities")
            .update({
              activity_date: new Date(newLead.next_activity_date).toISOString(),
              assigned_to: newLead.next_activity_assigned_to || null,
              notes: newLead.next_activity_notes || null
            })
            .eq("id", existingActivity.id);
        } else {
          // Crea una nuova attività
          await supabase.from("lead_activities").insert([{
            lead_id: selectedLead.id,
            activity_type: newLead.next_activity_type,
            activity_date: new Date(newLead.next_activity_date).toISOString(),
            assigned_to: newLead.next_activity_assigned_to || null,
            notes: newLead.next_activity_notes || null,
            status: "scheduled",
            created_by: user.id
          }]);
        }

        // Aggiungi/aggiorna nel calendario se assegnata
        if (newLead.next_activity_assigned_to) {
          await supabase.from("calendar_events").insert([{
            user_id: newLead.next_activity_assigned_to,
            title: `Lead Activity: ${newLead.next_activity_type}`,
            description: newLead.next_activity_notes || "",
            event_date: new Date(newLead.next_activity_date).toISOString(),
            event_type: "lead_activity",
            color: "blue"
          }]);
        }
      }

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
      // Custom fields
      tipo_attivita: "",
      diametro_canna_fumaria: "",
      luogo: "",
      installazione: false,
      dimensioni_forno: "",
      alimentazione: "",
      pronta_consegna: false,
    });
    setPendingFiles([]);
  };

  const handleOpenCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const lead = leads.find(l => l.id === draggableId);
    if (!lead) return;

    // Se il lead viene spostato in "won", mostra il dialogo per creare l'ordine
    if (destination.droppableId === "won") {
      await handleWinLead(lead);
      return;
    }

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

      toast({
        title: "Lead vinto!",
        description: "Reindirizzamento alla pagina ordini...",
      });

      // 2. Redirect alla pagina direzione ordini con il leadId
      navigate('/direzione/orders', { 
        state: { 
          openCreateDialog: true,
          leadId: lead.id,
          leadData: {
            company_name: lead.company_name,
            contact_name: lead.contact_name,
            email: lead.email,
            phone: lead.phone,
            notes: lead.notes
          }
        } 
      });
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
    setLeadForOffer(lead);
    setIsOfferDialogOpen(true);
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

  const handleUpdateOfferStatus = async (offerId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("offers")
        .update({ status: newStatus })
        .eq("id", offerId);

      if (error) throw error;

      toast({
        title: "Stato Aggiornato",
        description: "Lo stato dell'offerta è stato aggiornato",
      });

      await loadOffers();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato: " + error.message,
        variant: "destructive",
      });
    }
  };

  const getOfferStatusColor = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'bg-slate-100 text-slate-800';
      case 'offerta_pronta': return 'bg-blue-100 text-blue-800';
      case 'offerta_inviata': return 'bg-purple-100 text-purple-800';
      case 'negoziazione': return 'bg-orange-100 text-orange-800';
      case 'accettata': return 'bg-green-100 text-green-800';
      case 'rifiutata': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOfferStatusText = (status: string) => {
    switch (status) {
      case 'richiesta_offerta': return 'Richiesta';
      case 'offerta_pronta': return 'Pronta';
      case 'offerta_inviata': return 'Inviata';
      case 'negoziazione': return 'Negoziazione';
      case 'accettata': return 'Accettata';
      case 'rifiutata': return 'Rifiutata';
      default: return status;
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
    <div className={`container mx-auto ${isMobile ? 'p-3' : 'p-6'} space-y-6`}>
      <div className={`flex ${isMobile ? 'flex-col gap-3' : 'items-center justify-between'}`}>
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold`}>Lead Management</h1>
          <p className={`text-muted-foreground ${isMobile ? 'text-sm' : ''}`}>Gestisci i tuoi lead con il kanban board</p>
        </div>
        <div className={`flex ${isMobile ? 'flex-col w-full' : 'gap-2'}`}>
          <Button onClick={handleOpenBigin} variant="outline" size={isMobile ? "sm" : "default"} className={isMobile ? 'mb-2' : ''}>
            <ExternalLink className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
            {isMobile ? 'Bigin CRM' : 'Apri Bigin CRM'}
          </Button>
          <Button onClick={handleOpenCreateDialog} size={isMobile ? "sm" : "default"}>
            <Plus className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} mr-2`} />
            Nuovo Lead
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className={`${isMobile ? 'max-w-[95vw] p-4' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
              <DialogHeader>
                <DialogTitle>Crea Nuovo Lead</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4 pb-4">
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
                  <Input
                    id="country"
                    list="countries-list"
                    value={newLead.country}
                    onChange={(e) => setNewLead({...newLead, country: e.target.value})}
                    placeholder="Seleziona o digita un paese"
                  />
                  <datalist id="countries-list">
                    {countries.map(country => (
                      <option key={country} value={country} />
                    ))}
                  </datalist>
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

                {/* Custom fields based on pipeline */}
                {(newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") && (
                  <div className="col-span-2 border-t pt-4">
                    <h4 className="font-medium mb-3">Informazioni ZAPPER</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="tipo_attivita">Tipo di attività</Label>
                        <Input
                          id="tipo_attivita"
                          value={newLead.tipo_attivita}
                          onChange={(e) => setNewLead({...newLead, tipo_attivita: e.target.value})}
                          placeholder="Es. Ristorante, Pizzeria..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="diametro_canna_fumaria">Diametro canna fumaria</Label>
                        <Input
                          id="diametro_canna_fumaria"
                          value={newLead.diametro_canna_fumaria}
                          onChange={(e) => setNewLead({...newLead, diametro_canna_fumaria: e.target.value})}
                          placeholder="Es. 250mm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="luogo">Luogo</Label>
                        <Input
                          id="luogo"
                          value={newLead.luogo}
                          onChange={(e) => setNewLead({...newLead, luogo: e.target.value})}
                          placeholder="Indirizzo di installazione"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="installazione"
                          checked={newLead.installazione}
                          onChange={(e) => setNewLead({...newLead, installazione: e.target.checked})}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="installazione" className="cursor-pointer">
                          Richiede installazione
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

                {newLead.pipeline === "Vesuviano" && (
                  <div className="col-span-2 border-t pt-4">
                    <h4 className="font-medium mb-3">Informazioni Vesuviano</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="dimensioni_forno">Dimensioni forno richiesto</Label>
                        <Input
                          id="dimensioni_forno"
                          value={newLead.dimensioni_forno}
                          onChange={(e) => setNewLead({...newLead, dimensioni_forno: e.target.value})}
                          placeholder="Es. 80cm, 100cm, 120cm..."
                        />
                      </div>
                      <div>
                        <Label htmlFor="alimentazione">Alimentazione</Label>
                        <Select value={newLead.alimentazione} onValueChange={(value) => setNewLead({...newLead, alimentazione: value})}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona alimentazione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gas">Gas</SelectItem>
                            <SelectItem value="legna">Legna</SelectItem>
                            <SelectItem value="elettrico">Elettrico</SelectItem>
                            <SelectItem value="misto">Misto</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2 col-span-2">
                        <input
                          type="checkbox"
                          id="pronta_consegna"
                          checked={newLead.pronta_consegna}
                          onChange={(e) => setNewLead({...newLead, pronta_consegna: e.target.checked})}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="pronta_consegna" className="cursor-pointer">
                          Pronta consegna
                        </Label>
                      </div>
                    </div>
                  </div>
                )}

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

                {/* Drag & Drop Area for Files */}
                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3">Foto e Documenti</h4>
                  <div
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                      dragActive
                        ? "border-primary bg-primary/5"
                        : "border-muted-foreground/25 hover:border-primary/50"
                    }`}
                  >
                    <Upload className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Trascina le foto qui o clicca per selezionare
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Foto, documenti (max 20MB per file)
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                      id="lead-file-upload"
                      accept="image/*,video/*,.pdf,.doc,.docx"
                    />
                    <label htmlFor="lead-file-upload">
                      <Button variant="outline" size="sm" asChild type="button">
                        <span>Seleziona File</span>
                      </Button>
                    </label>
                  </div>

                  {/* Pending Files List */}
                  {pendingFiles.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">File da caricare ({pendingFiles.length})</p>
                      <div className="space-y-1">
                        {pendingFiles.map((file, index) => (
                          <div key={index} className="flex items-center justify-between p-2 border rounded-lg bg-muted/30">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => removePendingFile(index)}
                              type="button"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            <div className="text-2xl font-bold">{formatAmount(totalValue, hideAmounts)}</div>
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
                    className={`${isMobile ? 'min-h-[200px] space-y-2' : 'min-h-[200px] space-y-3'} ${
                      snapshot.isDraggingOver ? 'bg-muted/50' : ''
                    }`}
                  >
                    {leadsByStatus[status.id]?.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(provided, snapshot) => (
                          <Card
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={cn(
                              "cursor-pointer transition-all",
                              snapshot.isDragging && "shadow-lg scale-105",
                              isMobile && "touch-manipulation"
                            )}
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsDetailsDialogOpen(true);
                            }}
                          >
                             <CardContent className={cn(
                               "space-y-2",
                               isMobile ? "p-3" : "p-4"
                             )}>
                                 {/* Header con titolo e azioni */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className={cn("flex items-center gap-2", isMobile ? "mb-0.5" : "mb-1")}>
                                      <Building2 className={cn(
                                        "text-primary flex-shrink-0",
                                        isMobile ? "h-3 w-3" : "h-4 w-4"
                                      )} />
                                      <h4 className={cn(
                                        "font-semibold truncate",
                                        isMobile ? "text-xs" : "text-sm"
                                      )}>{lead.company_name}</h4>
                                      {lead.status === "new" && (
                                        <Badge 
                                          className={cn(
                                            "bg-yellow-500 text-yellow-950 border-yellow-600 animate-pulse font-semibold",
                                            isMobile ? "text-[9px] px-1.5 py-0 h-4" : "text-[10px] px-2 py-0.5 h-5"
                                          )}
                                        >
                                          NUOVO
                                        </Badge>
                                      )}
                                    </div>
                                    {lead.contact_name && (
                                      <p className={cn(
                                        "text-muted-foreground truncate",
                                        isMobile ? "text-[10px] ml-5" : "text-xs ml-6"
                                      )}>{lead.contact_name}</p>
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
                                      className={cn(
                                        "p-0 hover:bg-muted",
                                        isMobile ? "h-6 w-6" : "h-7 w-7"
                                      )}
                                    >
                                      <Edit className={cn(isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => e.stopPropagation()}
                                          className={cn(
                                            "p-0 text-destructive hover:text-destructive hover:bg-destructive/10",
                                            isMobile ? "h-6 w-6" : "h-7 w-7"
                                          )}
                                        >
                                          <Trash2 className={cn(isMobile ? "h-3 w-3" : "h-3.5 w-3.5")} />
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
                                 <div className={`${isMobile ? 'space-y-1 border-t pt-1.5' : 'space-y-2 border-t pt-2'}`}>
                                   {lead.email && (
                                     <div className="flex items-center gap-2">
                                       <Mail className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-muted-foreground flex-shrink-0`} />
                                       <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate`}>{lead.email}</span>
                                     </div>
                                   )}
                                   
                                   {lead.phone && (
                                     <div className="flex items-center gap-2">
                                       <Phone className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-muted-foreground flex-shrink-0`} />
                                       <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>{lead.phone}</span>
                                     </div>
                                   )}
                                   
                                   {/* Data e utente creazione */}
                                   <div className="flex items-center gap-2">
                                     <Clock className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-muted-foreground flex-shrink-0`} />
                                     <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground`}>
                                       {new Date(lead.created_at).toLocaleString('it-IT', {
                                         day: '2-digit',
                                         month: '2-digit',
                                         year: 'numeric',
                                         hour: '2-digit',
                                         minute: '2-digit'
                                       })}
                                     </span>
                                   </div>
                                   
                                   <div className="flex items-center gap-2">
                                     <User className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-muted-foreground flex-shrink-0`} />
                                     <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} text-muted-foreground truncate`}>
                                       {lead.created_by ? 
                                         (() => {
                                           const creator = users.find(u => u.id === lead.created_by);
                                           return creator ? `${creator.first_name} ${creator.last_name}` : 'Utente sconosciuto';
                                         })()
                                         : (lead.source === 'zapier' ? 'Zapier automation' : 'Sistema')
                                       }
                                     </span>
                                   </div>
                                 </div>
                                 
                                  {/* Prossima attività */}
                                  {(lead.next_activity_type || lead.next_activity_date) && (() => {
                                    const isOverdue = lead.next_activity_date && new Date(lead.next_activity_date) < new Date();
                                    return (
                                    <div className={`${isMobile ? 'border-t pt-1.5' : 'border-t pt-2'} ${isOverdue ? 'bg-destructive/10 -mx-3 px-3 py-2 rounded-b-lg border-l-4 border-l-destructive' : ''}`}>
                                      <div className={`flex items-center gap-2 ${isMobile ? 'mb-0.5' : 'mb-1'}`}>
                                        <Calendar className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} flex-shrink-0 ${isOverdue ? 'text-destructive' : 'text-blue-600'}`} />
                                        <span className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-medium ${isOverdue ? 'text-destructive' : 'text-blue-600'}`}>
                                          Prossima attività
                                        </span>
                                        {isOverdue && (
                                          <Badge variant="destructive" className={`${isMobile ? 'text-[9px] px-1 py-0 h-3.5' : 'text-[10px] px-1.5 py-0 h-4'} animate-pulse`}>
                                            Scaduta!
                                          </Badge>
                                        )}
                                      </div>
                                      <div className={`${isMobile ? 'ml-4 space-y-0.5' : 'ml-5 space-y-1'}`}>
                                        {lead.next_activity_type && (
                                          <div className={`${isMobile ? 'text-[10px]' : 'text-xs'} ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
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
                                          <div className={`flex items-center gap-1 ${isMobile ? 'text-[10px]' : 'text-xs'} ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                                            <Clock className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
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
                                           <div className={`${isMobile ? 'text-[9px]' : 'text-xs'} italic truncate ${isOverdue ? 'text-destructive/80' : 'text-muted-foreground'}`}>
                                             {lead.next_activity_notes}
                                           </div>
                                         )}
                                         {lead.next_activity_assigned_to && (
                                           <div className={`flex items-center gap-1 ${isMobile ? 'text-[10px]' : 'text-xs'} ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                                             <User className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'}`} />
                                             <span>
                                               {users.find(u => u.id === lead.next_activity_assigned_to)?.first_name} {users.find(u => u.id === lead.next_activity_assigned_to)?.last_name}
                                             </span>
                                           </div>
                                         )}
                                       </div>
                                    </div>
                                    );
                                  })()}

                                  {/* Offerta collegata o pulsante per collegarla */}
                                  <div className="border-t pt-2">
                                    {offers.filter(o => o.lead_id === lead.id).length > 0 ? (
                                      <>
                                        <div className="flex items-center gap-2 mb-1">
                                          <FileText className="h-3 w-3 text-purple-600 flex-shrink-0" />
                                          <span className="text-xs font-medium text-purple-600">
                                            Offerte Collegate ({offers.filter(o => o.lead_id === lead.id).length})
                                          </span>
                                        </div>
                                        <div className="ml-5 space-y-2">
                                          {offers.filter(o => o.lead_id === lead.id).map(linkedOffer => (
                                            <div key={linkedOffer.id} className="space-y-1 pb-2 border-b last:border-b-0">
                                              <div className="text-xs">
                                                <span className="font-medium">{linkedOffer.number}</span>
                                                {" - "}
                                                <span className="text-muted-foreground">{linkedOffer.title}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="text-xs text-green-600 font-medium">
                                                  €{linkedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                                </span>
                                                <Button
                                                   size="sm"
                                                   variant="ghost"
                                                   className="h-6 px-2"
                                                   onClick={(e) => {
                                                     e.stopPropagation();
                                                     navigate(`/crm/offers?offer=${linkedOffer.id}`);
                                                   }}
                                                 >
                                                   <ExternalLink className="h-3 w-3" />
                                                 </Button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
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

                                  {/* Link Configuratore per Vesuviano */}
                                  {lead.pipeline === "Vesuviano" && (
                                    <div className="border-t pt-2" onClick={(e) => e.stopPropagation()}>
                                      <GenerateConfiguratorLink
                                        leadId={lead.id}
                                        leadName={lead.company_name}
                                        pipeline={lead.pipeline}
                                        existingLink={lead.external_configurator_link}
                                      />
                                    </div>
                                  )}

                                {/* Footer con valore e fonte */}
                                <div className="flex items-center justify-between border-t pt-2">
                                  <div className="flex items-center gap-2">
                                    {lead.value && (
                                      <span className="text-sm font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">
                                        {formatAmount(lead.value, hideAmounts)}
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
        <DialogContent className={cn(
          "max-h-[90vh] overflow-y-auto",
          isMobile ? "max-w-[95vw] p-4" : "max-w-4xl"
        )}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-5 w-5 text-primary flex-shrink-0" />
              <span className="truncate">{selectedLead?.company_name}</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedLead && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
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
                        <Mail className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{selectedLead.email}</span>
                      </>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefono</label>
                  <p className="text-sm flex items-center gap-2">
                    {selectedLead.phone ? (
                      <>
                        <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{selectedLead.phone}</span>
                      </>
                    ) : '-'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Valore Stimato</label>
                  <p className="text-sm font-semibold text-green-600">
                    {selectedLead.value ? formatAmount(selectedLead.value, hideAmounts) : '-'}
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
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-blue-600" />
                      <label className="text-sm font-medium text-blue-600">Prossima Attività</label>
                      {selectedLead.next_activity_date && new Date(selectedLead.next_activity_date) < new Date() && (
                        <Badge variant="destructive" className="animate-pulse">Scaduta</Badge>
                      )}
                    </div>
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

              {/* Linked Offers */}
              {offers.filter(o => o.lead_id === selectedLead.id).length > 0 && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-4 w-4 text-purple-600" />
                    <label className="text-sm font-medium text-purple-600">
                      Offerte Collegate ({offers.filter(o => o.lead_id === selectedLead.id).length})
                    </label>
                  </div>
                  <div className="space-y-4">
                    {offers.filter(o => o.lead_id === selectedLead.id).map(linkedOffer => (
                      <div key={linkedOffer.id} className="ml-6 p-3 bg-muted/50 rounded-lg space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1 flex-1">
                            <div>
                              <span className="text-sm font-medium">{linkedOffer.number}</span>
                              <span className="text-sm text-muted-foreground"> - {linkedOffer.title}</span>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
                              €{linkedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setIsDetailsDialogOpen(false);
                              navigate(`/crm/offers?offer=${linkedOffer.id}`);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Stato Offerta</Label>
                          <Select
                            value={linkedOffer.status}
                            onValueChange={(value) => handleUpdateOfferStatus(linkedOffer.id, value)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="richiesta_offerta">Richiesta</SelectItem>
                              <SelectItem value="offerta_pronta">Pronta</SelectItem>
                              <SelectItem value="offerta_inviata">Inviata</SelectItem>
                              <SelectItem value="negoziazione">Negoziazione</SelectItem>
                              <SelectItem value="accettata">Accettata</SelectItem>
                              <SelectItem value="rifiutata">Rifiutata</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lead Activities Component */}
              <div className="border-t pt-4 space-y-4">
                <LeadActivities leadId={selectedLead.id} onActivityCompleted={loadLeads} />
                <LeadComments leadId={selectedLead.id} />
                <LeadFileUpload leadId={selectedLead.id} />
              </div>

              {/* Actions */}
              <div className={cn(
                "border-t pt-4 flex gap-2",
                isMobile && "flex-col"
              )}>
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
                {selectedLead.status === "negotiation" && (
                  <>
                    <Button
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        handleWinLead(selectedLead);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
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
                      <XCircle className="h-4 w-4 mr-2" />
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
        <DialogContent className={`${isMobile ? 'max-w-[95vw] p-4' : 'max-w-2xl'} max-h-[90vh] overflow-y-auto`}>
          <DialogHeader>
            <DialogTitle>Modifica Lead</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 pb-4">
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
            <div>
              <Label htmlFor="edit_country">Paese</Label>
              <Input
                id="edit_country"
                list="countries-list-edit"
                value={newLead.country}
                onChange={(e) => setNewLead({...newLead, country: e.target.value})}
                placeholder="Seleziona o digita un paese"
              />
              <datalist id="countries-list-edit">
                {countries.map(country => (
                  <option key={country} value={country} />
                ))}
              </datalist>
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

            {/* Custom fields based on pipeline - EDIT MODE */}
            {(newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") && (
              <div className="col-span-2 border-t pt-4">
                <h4 className="font-medium mb-3">Informazioni ZAPPER</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_tipo_attivita">Tipo di attività</Label>
                    <Input
                      id="edit_tipo_attivita"
                      value={newLead.tipo_attivita}
                      onChange={(e) => setNewLead({...newLead, tipo_attivita: e.target.value})}
                      placeholder="Es. Ristorante, Pizzeria..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_diametro_canna_fumaria">Diametro canna fumaria</Label>
                    <Input
                      id="edit_diametro_canna_fumaria"
                      value={newLead.diametro_canna_fumaria}
                      onChange={(e) => setNewLead({...newLead, diametro_canna_fumaria: e.target.value})}
                      placeholder="Es. 250mm"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_luogo">Luogo</Label>
                    <Input
                      id="edit_luogo"
                      value={newLead.luogo}
                      onChange={(e) => setNewLead({...newLead, luogo: e.target.value})}
                      placeholder="Indirizzo di installazione"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="edit_installazione"
                      checked={newLead.installazione}
                      onChange={(e) => setNewLead({...newLead, installazione: e.target.checked})}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="edit_installazione" className="cursor-pointer">
                      Richiede installazione
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {newLead.pipeline === "Vesuviano" && (
              <div className="col-span-2 border-t pt-4">
                <h4 className="font-medium mb-3">Informazioni Vesuviano</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="edit_dimensioni_forno">Dimensioni forno richiesto</Label>
                    <Input
                      id="edit_dimensioni_forno"
                      value={newLead.dimensioni_forno}
                      onChange={(e) => setNewLead({...newLead, dimensioni_forno: e.target.value})}
                      placeholder="Es. 80cm, 100cm, 120cm..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_alimentazione">Alimentazione</Label>
                    <Select value={newLead.alimentazione} onValueChange={(value) => setNewLead({...newLead, alimentazione: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona alimentazione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gas">Gas</SelectItem>
                        <SelectItem value="legna">Legna</SelectItem>
                        <SelectItem value="elettrico">Elettrico</SelectItem>
                        <SelectItem value="misto">Misto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center space-x-2 col-span-2">
                    <input
                      type="checkbox"
                      id="edit_pronta_consegna"
                      checked={newLead.pronta_consegna}
                      onChange={(e) => setNewLead({...newLead, pronta_consegna: e.target.checked})}
                      className="h-4 w-4"
                    />
                    <Label htmlFor="edit_pronta_consegna" className="cursor-pointer">
                      Pronta consegna
                    </Label>
                  </div>
                </div>
              </div>
            )}

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
      <CreateOfferDialog
        open={isOfferDialogOpen}
        onOpenChange={setIsOfferDialogOpen}
        onSuccess={() => {
          loadOffers();
          setIsOfferDialogOpen(false);
        }}
        defaultStatus="richiesta_offerta"
        leadData={leadForOffer ? {
          leadId: leadForOffer.id,
          customerName: leadForOffer.company_name,
          amount: leadForOffer.value
        } : undefined}
      />


    </div>
  );
}