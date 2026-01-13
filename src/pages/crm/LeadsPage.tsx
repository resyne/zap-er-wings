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
import { Plus, Search, TrendingUp, Mail, Phone, Users, Building2, Zap, GripVertical, Trash2, Edit, Calendar, Clock, User, ExternalLink, FileText, Link, Archive, CheckCircle2, XCircle, Upload, X, ChevronDown, MapPin, Flame, Activity, MessageSquare, Download } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import LeadActivities from "@/components/crm/LeadActivities";
import LeadFileUpload from "@/components/crm/LeadFileUpload";
import LeadComments from "@/components/crm/LeadComments";
import LeadCallHistory from "@/components/crm/LeadCallHistory";
import { GenerateConfiguratorLink } from "@/components/crm/GenerateConfiguratorLink";
import { ConfiguratorStatus } from "@/components/crm/ConfiguratorStatus";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreateOfferDialog } from "@/components/dashboard/CreateOfferDialog";
import { cn } from "@/lib/utils";
import { LeadMap } from "@/components/crm/LeadMap";
import { MapIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";


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
  city?: string;
  archived?: boolean;
  notes?: string;
  assigned_to?: string;
  priority?: string;
  pre_qualificato?: boolean;
  next_activity_type?: string;
  next_activity_date?: string;
  next_activity_notes?: string;
  next_activity_assigned_to?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  customer_id?: string;
  external_configurator_link?: string | null;
  configurator_session_id?: string | null;
  configurator_link?: string | null;
  configurator_opened?: boolean;
  configurator_opened_at?: string | null;
  configurator_last_updated?: string | null;
  configurator_status?: string | null;
  configurator_model?: string | null;
  configurator_has_quote?: boolean;
  configurator_quote_price?: number | null;
  configurator_history?: any[] | null;
  custom_fields?: {
    // ZAPPER fields
    tipologia_cliente?: string;
    diametro_canna_fumaria?: string;
    montaggio?: string;
    ingresso_fumi?: string;
    // VESUVIANO fields
    dimensioni_forno?: string;
    alimentazione?: string;
    pronta_consegna?: boolean;
  };
}

const leadPriorities = [
  { id: "low", title: "LOW", color: "bg-blue-100 text-blue-800" },
  { id: "mid", title: "MID", color: "bg-orange-100 text-orange-800" },
  { id: "hot", title: "HOT", color: "bg-red-100 text-red-800" },
];

interface Offer {
  id: string;
  number: string;
  title: string;
  amount: number;
  status: string;
  customer_name: string;
  lead_id?: string;
  unique_code?: string;
}

const leadSources = ["website", "referral", "social_media", "cold_call", "trade_show", "zapier", "other"];
const pipelines = ["Zapper", "Vesuviano", "Zapper Pro", "Resyne"];
const countries = ["Italia", "Francia", "Germania"];
// Tutte le colonne per la Kanban
const kanbanStatuses = [
  { id: "new", title: "Nuovo", color: "bg-blue-100 text-blue-800" },
  { id: "pre_qualified", title: "Pre-Qualificato", color: "bg-purple-100 text-purple-800" },
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
  const [sortBy, setSortBy] = useState<string>("priority");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [activeView, setActiveView] = useState<"kanban" | "map">("kanban");
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isOfferDialogOpen, setIsOfferDialogOpen] = useState(false);
  const [leadForOffer, setLeadForOffer] = useState<Lead | null>(null);
  const [newLead, setNewLead] = useState({
    // Titolo lead
    lead_title: "",
    // Dati cliente/fatturazione
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    tax_id: "",
    pec: "",
    sdi_code: "",
    address: "",
    city: "",
    province: "",
    postal_code: "",
    shipping_address: "",
    // Lead specifici
    value: "",
    source: "",
    status: "new",
    pipeline: "Zapper",
    country: "Italia",
    priority: "mid",
    notes: "",
    next_activity_type: "",
    next_activity_date: "",
    next_activity_notes: "",
    next_activity_assigned_to: null as string | null,
    // Custom fields ZAPPER
    tipologia_cliente: "",
    tipologia_cliente_altro: "",
    diametro_canna_fumaria: "",
    diametro_canna_fumaria_altro: "",
    montaggio: "",
    ingresso_fumi: "",
    // Custom fields VESUVIANO
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

  // Realtime subscription per nuovi lead, aggiornamenti ed eliminazioni
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
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead aggiornato:', payload.new);
          setLeads((prevLeads) => 
            prevLeads.map(lead => 
              lead.id === (payload.new as Lead).id ? payload.new as Lead : lead
            )
          );
          toast({
            title: "Lead aggiornato",
            description: `Lead "${(payload.new as Lead).company_name}" è stato aggiornato`,
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          console.log('Lead eliminato:', payload.old);
          setLeads((prevLeads) => 
            prevLeads.filter(lead => lead.id !== (payload.old as Lead).id)
          );
          toast({
            title: "Lead eliminato",
            description: "Un lead è stato eliminato",
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
        .select('id, number, title, amount, status, customer_name, lead_id, unique_code')
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

      // Prima crea il cliente
      const customerData = {
        code: "", // Auto-generated by database trigger
        name: newLead.contact_name || newLead.company_name,
        company_name: newLead.company_name,
        email: newLead.email || null,
        phone: newLead.phone || null,
        tax_id: newLead.tax_id || null,
        pec: newLead.pec || null,
        sdi_code: newLead.sdi_code || null,
        address: newLead.address || null,
        city: newLead.city || null,
        province: newLead.province || null,
        postal_code: newLead.postal_code || null,
        country: newLead.country || "Italia",
        shipping_address: newLead.shipping_address || null,
        active: true,
      };

      const { data: newCustomer, error: customerError } = await supabase
        .from("customers")
        .insert([customerData])
        .select()
        .single();

      if (customerError) throw customerError;

      // Prepare custom fields based on pipeline
      const custom_fields: any = {};
      if (newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") {
        custom_fields.tipologia_cliente = newLead.tipologia_cliente === "altro" 
          ? newLead.tipologia_cliente_altro 
          : newLead.tipologia_cliente;
        custom_fields.diametro_canna_fumaria = newLead.diametro_canna_fumaria === "altro"
          ? newLead.diametro_canna_fumaria_altro
          : newLead.diametro_canna_fumaria;
        custom_fields.montaggio = newLead.montaggio;
        custom_fields.ingresso_fumi = newLead.ingresso_fumi;
      } else if (newLead.pipeline === "Vesuviano") {
        custom_fields.dimensioni_forno = newLead.dimensioni_forno;
        custom_fields.alimentazione = newLead.alimentazione;
        custom_fields.pronta_consegna = newLead.pronta_consegna;
      }

      const leadData = {
        company_name: newLead.lead_title || newLead.company_name, // Titolo lead
        contact_name: newLead.contact_name,
        email: newLead.email,
        phone: newLead.phone,
        value: newLead.value ? parseFloat(newLead.value) : null,
        source: newLead.source,
        status: newLead.status,
        pipeline: newLead.pipeline || selectedPipeline,
        country: newLead.country,
        city: newLead.city,
        priority: newLead.priority,
        notes: newLead.notes,
        next_activity_type: newLead.next_activity_type,
        next_activity_date: newLead.next_activity_date ? new Date(newLead.next_activity_date).toISOString() : null,
        next_activity_notes: newLead.next_activity_notes,
        next_activity_assigned_to: newLead.next_activity_assigned_to || null,
        custom_fields,
        customer_id: newCustomer.id, // Collega al cliente appena creato
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

      // Sync with external Vesuviano site if pipeline is Vesuviano
      if (newLeadData && (newLead.pipeline === "Vesuviano" || selectedPipeline === "Vesuviano")) {
        try {
          console.log('Syncing Vesuviano lead with external site...');
          const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-vesuviano-lead', {
            body: { leadId: newLeadData.id }
          });

          if (syncError) {
            console.error('Error syncing Vesuviano lead:', syncError);
          } else if (syncResult?.configurator_link) {
            console.log('Vesuviano lead synced successfully:', syncResult.configurator_link);
            toast({
              title: "Lead Vesuviano sincronizzato",
              description: "Il lead è stato sincronizzato con il sito Vesuviano",
            });
          }
        } catch (syncError: any) {
          console.error('Failed to sync Vesuviano lead:', syncError);
          // Don't block the lead creation if sync fails
        }
      }

      toast({
        title: "Lead e Cliente creati",
        description: `Lead e cliente creati con successo${pendingFiles.length > 0 ? ` con ${pendingFiles.length} file` : ''}`,
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
      lead_title: lead.company_name, // Use company_name as lead_title for backwards compatibility
      company_name: lead.company_name,
      contact_name: lead.contact_name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      tax_id: "",
      pec: "",
      sdi_code: "",
      address: "",
      city: lead.city || "",
      province: "",
      postal_code: "",
      shipping_address: "",
      value: lead.value ? lead.value.toString() : "",
      source: lead.source || "",
      status: lead.status,
      pipeline: lead.pipeline || "",
      country: lead.country || "Italia",
      priority: lead.priority || "mid",
      notes: lead.notes || "",
      next_activity_type: lead.next_activity_type || "",
      next_activity_date: lead.next_activity_date ? new Date(lead.next_activity_date).toISOString().slice(0, 16) : "",
      next_activity_notes: lead.next_activity_notes || "",
      next_activity_assigned_to: lead.next_activity_assigned_to || null,
      // Custom fields ZAPPER
      tipologia_cliente: lead.custom_fields?.tipologia_cliente || "",
      tipologia_cliente_altro: "",
      diametro_canna_fumaria: lead.custom_fields?.diametro_canna_fumaria || "",
      diametro_canna_fumaria_altro: "",
      montaggio: lead.custom_fields?.montaggio || "",
      ingresso_fumi: lead.custom_fields?.ingresso_fumi || "",
      // Custom fields VESUVIANO
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
        custom_fields.tipologia_cliente = newLead.tipologia_cliente === "altro" 
          ? newLead.tipologia_cliente_altro 
          : newLead.tipologia_cliente;
        custom_fields.diametro_canna_fumaria = newLead.diametro_canna_fumaria === "altro"
          ? newLead.diametro_canna_fumaria_altro
          : newLead.diametro_canna_fumaria;
        custom_fields.montaggio = newLead.montaggio;
        custom_fields.ingresso_fumi = newLead.ingresso_fumi;
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
        city: newLead.city,
        priority: newLead.priority,
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

  // Inline update for ZAPPER custom fields
  const handleUpdateZapperField = async (leadId: string, fieldName: string, value: string) => {
    try {
      // Get the current lead data
      const currentLead = leads.find(l => l.id === leadId);
      if (!currentLead) return;

      const updatedCustomFields = {
        ...currentLead.custom_fields,
        [fieldName]: value
      };

      const { error } = await supabase
        .from("leads")
        .update({ custom_fields: updatedCustomFields })
        .eq("id", leadId);

      if (error) throw error;

      // Update local state
      setLeads(prev => prev.map(l => 
        l.id === leadId 
          ? { ...l, custom_fields: updatedCustomFields }
          : l
      ));

      // Update selectedLead if it's the same lead
      if (selectedLead?.id === leadId) {
        setSelectedLead(prev => prev ? { ...prev, custom_fields: updatedCustomFields } : null);
      }

      toast({
        title: "Campo aggiornato",
        description: "La configurazione è stata aggiornata",
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il campo: " + error.message,
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
      lead_title: "",
      company_name: "",
      contact_name: "",
      email: "",
      phone: "",
      tax_id: "",
      pec: "",
      sdi_code: "",
      address: "",
      city: "",
      province: "",
      postal_code: "",
      shipping_address: "",
      value: "",
      source: "",
      status: "new",
      pipeline: selectedPipeline,
      country: "Italia",
      priority: "mid",
      notes: "",
      next_activity_type: "",
      next_activity_date: "",
      next_activity_notes: "",
      next_activity_assigned_to: null,
      // Custom fields ZAPPER
      tipologia_cliente: "",
      tipologia_cliente_altro: "",
      diametro_canna_fumaria: "",
      diametro_canna_fumaria_altro: "",
      montaggio: "",
      ingresso_fumi: "",
      // Custom fields VESUVIANO
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
      // Determina il nuovo status e se aggiornare pre_qualificato/archived
      let updateData: { status: string; pre_qualificato?: boolean; archived?: boolean } = { status: destination.droppableId };
      
      // Se si sposta VERSO archivio, imposta archived = true
      if (destination.droppableId === "archived") {
        updateData.archived = true;
        updateData.status = lead.status; // mantieni lo status precedente
      } else {
        // Se si sposta DA archivio, ripristina
        if (source.droppableId === "archived") {
          updateData.archived = false;
        }
        
        // Se si sposta DA pre_qualified verso un'altra colonna, imposta pre_qualificato = false
        if (source.droppableId === "pre_qualified" && destination.droppableId !== "pre_qualified") {
          updateData.pre_qualificato = false;
          updateData.status = destination.droppableId;
        }
        
        // Se si sposta VERSO pre_qualified, imposta pre_qualificato = true e status = new
        if (destination.droppableId === "pre_qualified") {
          updateData.pre_qualificato = true;
          updateData.status = "new";
        }
      }

      const { error } = await supabase
        .from("leads")
        .update(updateData)
        .eq("id", draggableId);

      if (error) throw error;

      // Update local state
      setLeads(prev => prev.map(l => 
        l.id === draggableId 
          ? { ...l, ...updateData }
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

  const priorityOrder: Record<string, number> = { hot: 0, mid: 1, low: 2 };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = `${lead.company_name} ${lead.contact_name} ${lead.email}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesPipeline = !selectedPipeline || lead.pipeline?.toLowerCase() === selectedPipeline.toLowerCase();
    const matchesCountry = selectedCountry === "all" || lead.country === selectedCountry;
    // showArchived: true = mostra SOLO archiviati, false = mostra SOLO non archiviati
    const isArchived = lead.archived === true;
    const matchesArchived = showArchived ? isArchived : !isArchived;
    return matchesSearch && matchesPipeline && matchesCountry && matchesArchived;
  }).sort((a, b) => {
    switch (sortBy) {
      case "priority":
        const priorityA = priorityOrder[a.priority || ''] ?? 99;
        const priorityB = priorityOrder[b.priority || ''] ?? 99;
        return priorityA - priorityB;
      case "created_desc":
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      case "created_asc":
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      case "company_asc":
        return (a.company_name || '').localeCompare(b.company_name || '');
      case "company_desc":
        return (b.company_name || '').localeCompare(a.company_name || '');
      case "value_desc":
        return (b.value || 0) - (a.value || 0);
      case "value_asc":
        return (a.value || 0) - (b.value || 0);
      case "next_activity":
        const dateA = a.next_activity_date ? new Date(a.next_activity_date).getTime() : Infinity;
        const dateB = b.next_activity_date ? new Date(b.next_activity_date).getTime() : Infinity;
        return dateA - dateB;
      default:
        return 0;
    }
  });

  // Group leads by status (solo per le fasi kanban)
  // I lead pre_qualificato vanno nella colonna "pre_qualified"
  const leadsByStatus = kanbanStatuses.reduce((acc, status) => {
    if (status.id === "pre_qualified") {
      // Nella colonna Pre-Qualificato vanno i lead con pre_qualificato = true e status = new
      acc[status.id] = filteredLeads.filter(lead => lead.pre_qualificato === true && lead.status === "new");
    } else if (status.id === "new") {
      // Nella colonna Nuovo vanno i lead con status = new ma non pre_qualificato
      acc[status.id] = filteredLeads.filter(lead => lead.status === status.id && !lead.pre_qualificato);
    } else {
      acc[status.id] = filteredLeads.filter(lead => lead.status === status.id);
    }
    return acc;
  }, {} as Record<string, Lead[]>);

  // Filtra solo i lead nelle fasi kanban
  const activeLeads = filteredLeads.filter(lead => 
    kanbanStatuses.some(status => status.id === lead.status) || lead.pre_qualificato
  );

  const totalLeads = filteredLeads.length;
  const recentLeads = filteredLeads.filter(lead => {
    const createdDate = new Date(lead.created_at);
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);
    return createdDate > last24Hours;
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
                {/* Titolo Lead */}
                <div className="col-span-2">
                  <Label htmlFor="lead_title">Titolo Lead *</Label>
                  <Input
                    id="lead_title"
                    value={newLead.lead_title}
                    onChange={(e) => setNewLead({...newLead, lead_title: e.target.value})}
                    placeholder="Es. Ristorante Da Mario - Milano"
                  />
                </div>

                {/* Sezione Dati Cliente/Fatturazione */}
                <div className="col-span-2 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-medium mb-3 text-sm">Dati Cliente / Fatturazione</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label htmlFor="company_name">Intestazione Azienda *</Label>
                      <Input
                        id="company_name"
                        value={newLead.company_name}
                        onChange={(e) => setNewLead({...newLead, company_name: e.target.value})}
                        placeholder="ABC S.r.l."
                      />
                    </div>
                    <div>
                      <Label htmlFor="contact_name">Nome Referente</Label>
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
                      <Label htmlFor="tax_id">P.IVA / Codice Fiscale</Label>
                      <Input
                        id="tax_id"
                        value={newLead.tax_id}
                        onChange={(e) => setNewLead({...newLead, tax_id: e.target.value})}
                        placeholder="IT12345678901"
                      />
                    </div>
                    <div>
                      <Label htmlFor="pec">PEC</Label>
                      <Input
                        id="pec"
                        type="email"
                        value={newLead.pec}
                        onChange={(e) => setNewLead({...newLead, pec: e.target.value})}
                        placeholder="azienda@pec.it"
                      />
                    </div>
                    <div>
                      <Label htmlFor="sdi_code">Codice SDI</Label>
                      <Input
                        id="sdi_code"
                        value={newLead.sdi_code}
                        onChange={(e) => setNewLead({...newLead, sdi_code: e.target.value})}
                        placeholder="XXXXXXX"
                        maxLength={7}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="address">Indirizzo</Label>
                      <Input
                        id="address"
                        value={newLead.address}
                        onChange={(e) => setNewLead({...newLead, address: e.target.value})}
                        placeholder="Via Roma 123"
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">Città</Label>
                      <Input
                        id="city"
                        value={newLead.city}
                        onChange={(e) => setNewLead({...newLead, city: e.target.value})}
                        placeholder="Milano"
                      />
                    </div>
                    <div>
                      <Label htmlFor="province">Provincia</Label>
                      <Input
                        id="province"
                        value={newLead.province}
                        onChange={(e) => setNewLead({...newLead, province: e.target.value})}
                        placeholder="MI"
                        maxLength={2}
                      />
                    </div>
                    <div>
                      <Label htmlFor="postal_code">CAP</Label>
                      <Input
                        id="postal_code"
                        value={newLead.postal_code}
                        onChange={(e) => setNewLead({...newLead, postal_code: e.target.value})}
                        placeholder="20100"
                        maxLength={5}
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">Paese</Label>
                      <Input
                        id="country"
                        list="countries-list"
                        value={newLead.country}
                        onChange={(e) => setNewLead({...newLead, country: e.target.value})}
                        placeholder="Italia"
                      />
                      <datalist id="countries-list">
                        {countries.map(country => (
                          <option key={country} value={country} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <Label htmlFor="city_create">Città</Label>
                      <Input
                        id="city_create"
                        value={newLead.city}
                        onChange={(e) => setNewLead({...newLead, city: e.target.value})}
                        placeholder="es. Milano"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label htmlFor="shipping_address">Indirizzo di Spedizione (se diverso)</Label>
                      <Input
                        id="shipping_address"
                        value={newLead.shipping_address}
                        onChange={(e) => setNewLead({...newLead, shipping_address: e.target.value})}
                        placeholder="Via Spedizioni 456, 20100 Milano MI"
                      />
                    </div>
                  </div>
                </div>

                {/* Sezione Lead */}
                <div className="col-span-2 border-t pt-4">
                  <h4 className="font-medium mb-3 text-sm">Informazioni Lead</h4>
                  <div className="grid grid-cols-2 gap-4">
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
                      <Label htmlFor="priority">Priorità</Label>
                      <Select value={newLead.priority} onValueChange={(value) => setNewLead({...newLead, priority: value})}>
                        <SelectTrigger>
                          <SelectValue placeholder="Seleziona priorità" />
                        </SelectTrigger>
                        <SelectContent>
                          {leadPriorities.map(priority => (
                            <SelectItem key={priority.id} value={priority.id}>
                              {priority.title}
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
                </div>

                {/* Custom fields based on pipeline */}
                {(newLead.pipeline === "Zapper" || newLead.pipeline === "Zapper Pro") && (
                  <div className="col-span-2 border rounded-lg p-4 bg-primary/5">
                    <h4 className="font-semibold mb-4 text-primary flex items-center gap-2">
                      <span className="h-2 w-2 bg-primary rounded-full"></span>
                      Configurazione ZAPPER
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Tipologia Cliente */}
                      <div className="col-span-2 md:col-span-1">
                        <Label htmlFor="tipologia_cliente" className="text-sm font-medium">Tipologia Cliente</Label>
                        <Select 
                          value={newLead.tipologia_cliente} 
                          onValueChange={(value) => setNewLead({...newLead, tipologia_cliente: value, tipologia_cliente_altro: value === "altro" ? newLead.tipologia_cliente_altro : ""})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Seleziona tipologia" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pizzeria">🍕 Pizzeria</SelectItem>
                            <SelectItem value="cucina_professionale">👨‍🍳 Cucina professionale</SelectItem>
                            <SelectItem value="panificio">🥖 Panificio</SelectItem>
                            <SelectItem value="braceria">🥩 Braceria</SelectItem>
                            <SelectItem value="girarrosto">🍗 Girarrosto</SelectItem>
                            <SelectItem value="industriale">🏭 Industriale</SelectItem>
                            <SelectItem value="domestico">🏠 Domestico</SelectItem>
                            <SelectItem value="altro">✏️ Altro...</SelectItem>
                          </SelectContent>
                        </Select>
                        {newLead.tipologia_cliente === "altro" && (
                          <Input
                            className="mt-2"
                            value={newLead.tipologia_cliente_altro}
                            onChange={(e) => setNewLead({...newLead, tipologia_cliente_altro: e.target.value})}
                            placeholder="Specifica tipologia..."
                          />
                        )}
                      </div>

                      {/* Diametro Canna Fumaria */}
                      <div className="col-span-2 md:col-span-1">
                        <Label htmlFor="diametro_canna_fumaria" className="text-sm font-medium">Diametro Canna Fumaria</Label>
                        <Select 
                          value={newLead.diametro_canna_fumaria} 
                          onValueChange={(value) => setNewLead({...newLead, diametro_canna_fumaria: value, diametro_canna_fumaria_altro: value === "altro" ? newLead.diametro_canna_fumaria_altro : ""})}
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Seleziona diametro" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="100">⌀ 100 mm</SelectItem>
                            <SelectItem value="150">⌀ 150 mm</SelectItem>
                            <SelectItem value="200">⌀ 200 mm</SelectItem>
                            <SelectItem value="250">⌀ 250 mm</SelectItem>
                            <SelectItem value="300">⌀ 300 mm</SelectItem>
                            <SelectItem value="350">⌀ 350 mm</SelectItem>
                            <SelectItem value="400">⌀ 400 mm</SelectItem>
                            <SelectItem value="450">⌀ 450 mm</SelectItem>
                            <SelectItem value="altro">✏️ Altro...</SelectItem>
                          </SelectContent>
                        </Select>
                        {newLead.diametro_canna_fumaria === "altro" && (
                          <Input
                            className="mt-2"
                            value={newLead.diametro_canna_fumaria_altro}
                            onChange={(e) => setNewLead({...newLead, diametro_canna_fumaria_altro: e.target.value})}
                            placeholder="Specifica diametro (es. 500mm)..."
                          />
                        )}
                      </div>

                      {/* Montaggio */}
                      <div>
                        <Label className="text-sm font-medium">Montaggio</Label>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant={newLead.montaggio === "interno" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setNewLead({...newLead, montaggio: "interno"})}
                          >
                            🏠 Interno
                          </Button>
                          <Button
                            type="button"
                            variant={newLead.montaggio === "esterno" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setNewLead({...newLead, montaggio: "esterno"})}
                          >
                            🌤️ Esterno
                          </Button>
                        </div>
                      </div>

                      {/* Ingresso Fumi */}
                      <div>
                        <Label className="text-sm font-medium">Ingresso Fumi</Label>
                        <div className="flex gap-2 mt-2">
                          <Button
                            type="button"
                            variant={newLead.ingresso_fumi === "dx" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setNewLead({...newLead, ingresso_fumi: "dx"})}
                          >
                            ➡️ DX
                          </Button>
                          <Button
                            type="button"
                            variant={newLead.ingresso_fumi === "sx" ? "default" : "outline"}
                            size="sm"
                            className="flex-1"
                            onClick={() => setNewLead({...newLead, ingresso_fumi: "sx"})}
                          >
                            ⬅️ SX
                          </Button>
                        </div>
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
            <CardTitle className="text-sm font-medium">Ultimi 24 ore</CardTitle>
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

      {/* View Switcher, Pipeline, Country Filters and Search */}
      <div className="flex items-center justify-between flex-wrap gap-4">
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
          <div className="flex items-center space-x-2">
            <Label htmlFor="sort-filter">Ordina:</Label>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Ordina per..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="priority">Priorità</SelectItem>
                <SelectItem value="created_desc">Data creazione (recenti)</SelectItem>
                <SelectItem value="created_asc">Data creazione (meno recenti)</SelectItem>
                <SelectItem value="company_asc">Azienda (A-Z)</SelectItem>
                <SelectItem value="company_desc">Azienda (Z-A)</SelectItem>
                <SelectItem value="value_desc">Valore (alto-basso)</SelectItem>
                <SelectItem value="value_asc">Valore (basso-alto)</SelectItem>
                <SelectItem value="next_activity">Prossima attività</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant={showArchived ? "default" : "outline"}
            onClick={(e) => {
              e.preventDefault();
              setShowArchived((prev) => !prev);
            }}
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
        
        {/* View Toggle Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === "kanban" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("kanban")}
          >
            Kanban
          </Button>
          <Button
            variant={activeView === "map" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveView("map")}
          >
            <MapIcon className="h-4 w-4 mr-2" />
            Mappa
          </Button>
        </div>
      </div>

      {/* Content - Kanban or Map View */}
      {activeView === "kanban" ? (
        /* Kanban Board */
        <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanStatuses.map(status => (
            <div key={status.id} className="bg-muted/30 rounded-lg p-4 min-w-[280px] max-w-[280px] flex-shrink-0">
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
                      className={`space-y-2 ${
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
                             <CardContent className="p-3 space-y-2">
                                 {/* Header con titolo e priorità */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className="text-sm font-semibold truncate max-w-[140px]">{lead.company_name}</h4>
                                      {lead.status === "new" && !lead.pre_qualificato && (
                                        <Badge className="bg-yellow-500 text-yellow-950 text-[9px] px-1 py-0 h-4 animate-pulse">
                                          NUOVO
                                        </Badge>
                                      )}
                                      <Select
                                        value={lead.priority || ''}
                                        onValueChange={(value) => {
                                          setLeads(prev => prev.map(l => 
                                            l.id === lead.id ? { ...l, priority: value } : l
                                          ));
                                          supabase
                                            .from('leads')
                                            .update({ priority: value })
                                            .eq('id', lead.id)
                                            .then();
                                        }}
                                      >
                                        <SelectTrigger 
                                          className="h-auto border-0 p-0 focus:ring-0 bg-transparent shadow-none text-[9px]"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Badge 
                                            className={cn(
                                              leadPriorities.find(p => p.id === lead.priority)?.color || "bg-gray-100 text-gray-800",
                                              "text-[9px] px-1.5 py-0 h-4"
                                            )}
                                          >
                                            {leadPriorities.find(p => p.id === lead.priority)?.title || '-'}
                                          </Badge>
                                        </SelectTrigger>
                                        <SelectContent onClick={(e) => e.stopPropagation()}>
                                          {leadPriorities.map(priority => (
                                            <SelectItem key={priority.id} value={priority.id}>
                                              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", priority.color)}>
                                                {priority.title}
                                              </span>
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    {lead.contact_name && (
                                      <p className="text-[10px] text-muted-foreground truncate">{lead.contact_name}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5 flex-shrink-0">
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
                                    <div 
                                      {...provided.dragHandleProps}
                                      className="cursor-grab hover:cursor-grabbing p-1 rounded hover:bg-muted"
                                    >
                                      <GripVertical className="h-3 w-3 text-muted-foreground" />
                                    </div>
                                  </div>
                                </div>

                                 {/* Info compatte: telefono + valore */}
                                 <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                                   <div className="flex items-center gap-1">
                                     {lead.phone && (
                                       <>
                                         <Phone className="h-2.5 w-2.5" />
                                         <span className="truncate max-w-[80px]">{lead.phone}</span>
                                       </>
                                     )}
                                   </div>
                                   {lead.value && (
                                     <span className="text-xs font-semibold text-green-600">
                                       {formatAmount(lead.value, hideAmounts)}
                                     </span>
                                   )}
                                 </div>
                                 
                                  {/* Prossima attività - compatto */}
                                  {lead.next_activity_date && (() => {
                                    const isOverdue = new Date(lead.next_activity_date) < new Date();
                                    return (
                                      <div className={`flex items-center gap-1.5 text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-blue-600'}`}>
                                        <Calendar className="h-2.5 w-2.5" />
                                        <span>
                                          {new Date(lead.next_activity_date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                        {isOverdue && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-3">!</Badge>}
                                      </div>
                                    );
                                  })()}

                                  {/* Offerte - solo se esistono, altrimenti bottone crea */}
                                  {offers.filter(o => o.lead_id === lead.id).length > 0 ? (
                                    <div className="flex items-center gap-1.5 text-[10px]">
                                      <FileText className="h-2.5 w-2.5 text-purple-600" />
                                      <span className="text-purple-600 font-medium">
                                        {offers.filter(o => o.lead_id === lead.id).length} offerta/e
                                      </span>
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full h-6 text-[10px]"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreateOfferForLead(lead);
                                      }}
                                    >
                                      <Plus className="h-2.5 w-2.5 mr-1" />
                                      Crea Offerta
                                    </Button>
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
      ) : (
        /* Map View */
        <LeadMap leads={filteredLeads} />
      )}

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
            <div className="space-y-3">
              {/* Quick Status Badges */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={allStatuses.find(s => s.id === selectedLead.status)?.color || ''}>
                  {allStatuses.find(s => s.id === selectedLead.status)?.title || selectedLead.status}
                </Badge>
                <Badge variant="outline">{selectedLead.pipeline || 'N/A'}</Badge>
                {selectedLead.priority && (
                  <Badge className={leadPriorities.find(p => p.id === selectedLead.priority)?.color || ''}>
                    {leadPriorities.find(p => p.id === selectedLead.priority)?.title || selectedLead.priority}
                  </Badge>
                )}
                {selectedLead.value && (
                  <Badge variant="secondary" className="text-green-600">
                    {formatAmount(selectedLead.value, hideAmounts)}
                  </Badge>
                )}
              </div>

              {/* Customer Details - Collapsible Card */}
              <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Dettagli Cliente</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={cn("grid gap-3 px-3 pb-3 border-t pt-3", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">{selectedLead.contact_name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      {selectedLead.phone ? (
                        <a href={`tel:${selectedLead.phone}`} className="text-sm hover:underline">{selectedLead.phone}</a>
                      ) : <span className="text-sm text-muted-foreground">-</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      {selectedLead.email ? (
                        <a href={`mailto:${selectedLead.email}`} className="text-sm hover:underline truncate">{selectedLead.email}</a>
                      ) : <span className="text-sm text-muted-foreground">-</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm">
                        {selectedLead.city ? `${selectedLead.city}, ` : ''}{selectedLead.country || '-'}
                      </span>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Description */}
              {selectedLead.notes && (
                <div className="border rounded-lg bg-card px-3 py-2">
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Descrizione</span>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{selectedLead.notes}</p>
                </div>
              )}

              {/* Custom Fields - ZAPPER */}
              {(selectedLead.pipeline === "Zapper" || selectedLead.pipeline === "Zapper Pro") && (
                <div className="border rounded-lg bg-card px-3 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Configurazione ZAPPER</span>
                  </div>
                  <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    {/* Tipologia Cliente */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Tipologia Cliente</label>
                      <Select
                        value={selectedLead.custom_fields?.tipologia_cliente || ""}
                        onValueChange={(value) => handleUpdateZapperField(selectedLead.id, 'tipologia_cliente', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Seleziona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pizzeria">🍕 Pizzeria</SelectItem>
                          <SelectItem value="cucina_professionale">👨‍🍳 Cucina professionale</SelectItem>
                          <SelectItem value="panificio">🥖 Panificio</SelectItem>
                          <SelectItem value="braceria">🥩 Braceria</SelectItem>
                          <SelectItem value="girarrosto">🍗 Girarrosto</SelectItem>
                          <SelectItem value="industriale">🏭 Industriale</SelectItem>
                          <SelectItem value="domestico">🏠 Domestico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Diametro Canna Fumaria */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Diametro Canna Fumaria</label>
                      <Select
                        value={selectedLead.custom_fields?.diametro_canna_fumaria || ""}
                        onValueChange={(value) => handleUpdateZapperField(selectedLead.id, 'diametro_canna_fumaria', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Seleziona" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="100">⌀ 100 mm</SelectItem>
                          <SelectItem value="150">⌀ 150 mm</SelectItem>
                          <SelectItem value="200">⌀ 200 mm</SelectItem>
                          <SelectItem value="250">⌀ 250 mm</SelectItem>
                          <SelectItem value="300">⌀ 300 mm</SelectItem>
                          <SelectItem value="350">⌀ 350 mm</SelectItem>
                          <SelectItem value="400">⌀ 400 mm</SelectItem>
                          <SelectItem value="450">⌀ 450 mm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Montaggio */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Montaggio</label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedLead.custom_fields?.montaggio === "interno" ? "default" : "outline"}
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleUpdateZapperField(selectedLead.id, 'montaggio', 'interno')}
                        >
                          🏠 Interno
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedLead.custom_fields?.montaggio === "esterno" ? "default" : "outline"}
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleUpdateZapperField(selectedLead.id, 'montaggio', 'esterno')}
                        >
                          🌤️ Esterno
                        </Button>
                      </div>
                    </div>
                    
                    {/* Ingresso Fumi */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Ingresso Fumi</label>
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedLead.custom_fields?.ingresso_fumi === "dx" ? "default" : "outline"}
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleUpdateZapperField(selectedLead.id, 'ingresso_fumi', 'dx')}
                        >
                          ➡️ DX
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={selectedLead.custom_fields?.ingresso_fumi === "sx" ? "default" : "outline"}
                          className="flex-1 h-8 text-xs"
                          onClick={() => handleUpdateZapperField(selectedLead.id, 'ingresso_fumi', 'sx')}
                        >
                          ⬅️ SX
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Custom Fields - VESUVIANO */}
              {selectedLead.pipeline === "Vesuviano" && (
                selectedLead.custom_fields?.dimensioni_forno || 
                selectedLead.custom_fields?.alimentazione || 
                selectedLead.custom_fields?.pronta_consegna
              ) && (
                <div className="border rounded-lg bg-card px-3 py-2">
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Configurazione Vesuviano</span>
                  </div>
                  <div className={cn("grid gap-2", isMobile ? "grid-cols-1" : "grid-cols-3")}>
                    {selectedLead.custom_fields?.dimensioni_forno && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Dimensioni: </span>
                        <span>{selectedLead.custom_fields.dimensioni_forno}</span>
                      </div>
                    )}
                    {selectedLead.custom_fields?.alimentazione && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Alimentazione: </span>
                        <span className="capitalize">{selectedLead.custom_fields.alimentazione}</span>
                      </div>
                    )}
                    {selectedLead.custom_fields?.pronta_consegna && (
                      <div className="text-sm">
                        <span className="text-muted-foreground">Pronta consegna: </span>
                        <span>✓ Sì</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Linked Offers */}
              <div className="border rounded-lg bg-card px-3 py-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Offerte ({offers.filter(o => o.lead_id === selectedLead.id).length})</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => {
                      setIsDetailsDialogOpen(false);
                      handleCreateOfferForLead(selectedLead);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Nuova
                  </Button>
                </div>
                {offers.filter(o => o.lead_id === selectedLead.id).length > 0 ? (
                  <div className="space-y-2">
                    {offers.filter(o => o.lead_id === selectedLead.id).map(linkedOffer => (
                      <div key={linkedOffer.id} className="p-2 bg-muted/50 rounded-md">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{linkedOffer.number}</span>
                              <span className="text-xs text-muted-foreground truncate">{linkedOffer.title}</span>
                            </div>
                            <div className="text-sm text-green-600 font-medium">
                              €{linkedOffer.amount.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Select
                              value={linkedOffer.status}
                              onValueChange={(value) => handleUpdateOfferStatus(linkedOffer.id, value)}
                            >
                              <SelectTrigger className="h-7 w-[100px] text-xs">
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
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Apri offerta"
                              onClick={() => {
                                setIsDetailsDialogOpen(false);
                                navigate(`/crm/offers?offer=${linkedOffer.id}`);
                              }}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Scarica PDF"
                              onClick={async (e) => {
                                e.stopPropagation();
                                let code = linkedOffer.unique_code;
                                if (!code) {
                                  const { data: codeData } = await supabase.rpc('generate_offer_code');
                                  if (codeData) {
                                    await supabase
                                      .from('offers')
                                      .update({ unique_code: codeData })
                                      .eq('id', linkedOffer.id);
                                    code = codeData;
                                    loadOffers();
                                  }
                                }
                                if (code) {
                                  window.open(`https://www.erp.abbattitorizapper.it/offerta/${code}?print=true`, '_blank');
                                }
                              }}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Nessuna offerta collegata</p>
                )}
              </div>

              {/* Configurator Status for Vesuviano */}
              {selectedLead.pipeline === "Vesuviano" && (
                <div className="border rounded-lg bg-card px-3 py-2">
                  <ConfiguratorStatus lead={selectedLead} />
                </div>
              )}

              {/* Lead Activities - Collapsible */}
              <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Attività</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 border-t pt-3">
                    <LeadActivities leadId={selectedLead.id} onActivityCompleted={loadLeads} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Call History - Collapsible */}
              <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Storico Chiamate</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 border-t pt-3">
                    <LeadCallHistory leadId={selectedLead.id} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Files & Documents - Collapsible */}
              <Collapsible defaultOpen={false} className="border rounded-lg bg-card">
                <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-2">
                    <Upload className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">File & Documenti</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 [&[data-state=open]]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-3 pb-3 border-t pt-3">
                    <LeadFileUpload leadId={selectedLead.id} />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Comments - Always Open */}
              <LeadComments leadId={selectedLead.id} />

              {/* Actions */}
              <div className={cn(
                "flex gap-2 pt-2",
                isMobile && "flex-col"
              )}>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleEditLead(selectedLead);
                  }}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Modifica
                </Button>
                {selectedLead.status === "negotiation" && (
                  <>
                    <Button
                      size="sm"
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => {
                        handleWinLead(selectedLead);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Vinto
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        handleLoseLead(selectedLead);
                        setIsDetailsDialogOpen(false);
                      }}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
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
              <Label htmlFor="edit_priority">Priorità</Label>
              <Select value={newLead.priority} onValueChange={(value) => setNewLead({...newLead, priority: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona priorità" />
                </SelectTrigger>
                <SelectContent>
                  {leadPriorities.map(priority => (
                    <SelectItem key={priority.id} value={priority.id}>
                      {priority.title}
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
            <div>
              <Label htmlFor="edit_city">Città</Label>
              <Input
                id="edit_city"
                value={newLead.city}
                onChange={(e) => setNewLead({...newLead, city: e.target.value})}
                placeholder="es. Milano"
              />
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
              <div className="col-span-2 border rounded-lg p-4 bg-primary/5">
                <h4 className="font-semibold mb-4 text-primary flex items-center gap-2">
                  <span className="h-2 w-2 bg-primary rounded-full"></span>
                  Configurazione ZAPPER
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  {/* Tipologia Cliente */}
                  <div className="col-span-2 md:col-span-1">
                    <Label htmlFor="edit_tipologia_cliente" className="text-sm font-medium">Tipologia Cliente</Label>
                    <Select 
                      value={newLead.tipologia_cliente} 
                      onValueChange={(value) => setNewLead({...newLead, tipologia_cliente: value, tipologia_cliente_altro: value === "altro" ? newLead.tipologia_cliente_altro : ""})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleziona tipologia" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pizzeria">🍕 Pizzeria</SelectItem>
                        <SelectItem value="cucina_professionale">👨‍🍳 Cucina professionale</SelectItem>
                        <SelectItem value="panificio">🥖 Panificio</SelectItem>
                        <SelectItem value="braceria">🥩 Braceria</SelectItem>
                        <SelectItem value="girarrosto">🍗 Girarrosto</SelectItem>
                        <SelectItem value="industriale">🏭 Industriale</SelectItem>
                        <SelectItem value="domestico">🏠 Domestico</SelectItem>
                        <SelectItem value="altro">✏️ Altro...</SelectItem>
                      </SelectContent>
                    </Select>
                    {newLead.tipologia_cliente === "altro" && (
                      <Input
                        className="mt-2"
                        value={newLead.tipologia_cliente_altro}
                        onChange={(e) => setNewLead({...newLead, tipologia_cliente_altro: e.target.value})}
                        placeholder="Specifica tipologia..."
                      />
                    )}
                  </div>

                  {/* Diametro Canna Fumaria */}
                  <div className="col-span-2 md:col-span-1">
                    <Label htmlFor="edit_diametro_canna_fumaria" className="text-sm font-medium">Diametro Canna Fumaria</Label>
                    <Select 
                      value={newLead.diametro_canna_fumaria} 
                      onValueChange={(value) => setNewLead({...newLead, diametro_canna_fumaria: value, diametro_canna_fumaria_altro: value === "altro" ? newLead.diametro_canna_fumaria_altro : ""})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Seleziona diametro" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">⌀ 100 mm</SelectItem>
                        <SelectItem value="150">⌀ 150 mm</SelectItem>
                        <SelectItem value="200">⌀ 200 mm</SelectItem>
                        <SelectItem value="250">⌀ 250 mm</SelectItem>
                        <SelectItem value="300">⌀ 300 mm</SelectItem>
                        <SelectItem value="350">⌀ 350 mm</SelectItem>
                        <SelectItem value="400">⌀ 400 mm</SelectItem>
                        <SelectItem value="450">⌀ 450 mm</SelectItem>
                        <SelectItem value="altro">✏️ Altro...</SelectItem>
                      </SelectContent>
                    </Select>
                    {newLead.diametro_canna_fumaria === "altro" && (
                      <Input
                        className="mt-2"
                        value={newLead.diametro_canna_fumaria_altro}
                        onChange={(e) => setNewLead({...newLead, diametro_canna_fumaria_altro: e.target.value})}
                        placeholder="Specifica diametro (es. 500mm)..."
                      />
                    )}
                  </div>

                  {/* Montaggio */}
                  <div>
                    <Label className="text-sm font-medium">Montaggio</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant={newLead.montaggio === "interno" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewLead({...newLead, montaggio: "interno"})}
                      >
                        🏠 Interno
                      </Button>
                      <Button
                        type="button"
                        variant={newLead.montaggio === "esterno" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewLead({...newLead, montaggio: "esterno"})}
                      >
                        🌤️ Esterno
                      </Button>
                    </div>
                  </div>

                  {/* Ingresso Fumi */}
                  <div>
                    <Label className="text-sm font-medium">Ingresso Fumi</Label>
                    <div className="flex gap-2 mt-2">
                      <Button
                        type="button"
                        variant={newLead.ingresso_fumi === "dx" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewLead({...newLead, ingresso_fumi: "dx"})}
                      >
                        ➡️ DX
                      </Button>
                      <Button
                        type="button"
                        variant={newLead.ingresso_fumi === "sx" ? "default" : "outline"}
                        size="sm"
                        className="flex-1"
                        onClick={() => setNewLead({...newLead, ingresso_fumi: "sx"})}
                      >
                        ⬅️ SX
                      </Button>
                    </div>
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