import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface Lead {
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
    tipologia_cliente?: string;
    diametro_canna_fumaria?: string;
    montaggio?: string;
    ingresso_fumi?: string;
    dimensioni_forno?: string;
    alimentazione?: string;
    pronta_consegna?: boolean;
  };
}

export interface UseLeadsOptions {
  pipeline?: string;
  showArchived?: boolean;
  searchTerm?: string;
  sortBy?: string;
  country?: string;
  pageSize?: number;
}

export interface UseLeadsReturn {
  leads: Lead[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  loadMore: () => void;
  refetch: () => Promise<void>;
  updateLead: (id: string, data: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  filteredLeads: Lead[];
}

const PRIORITY_ORDER = { hot: 0, mid: 1, low: 2 };

export function useLeads(options: UseLeadsOptions = {}): UseLeadsReturn {
  const {
    pipeline = "all",
    showArchived = false,
    searchTerm = "",
    sortBy = "priority",
    country = "all",
    pageSize = 100,
  } = options;

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const { toast } = useToast();

  // Fetch leads with pagination
  const fetchLeads = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentPage = reset ? 0 : page;
      const from = currentPage * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from("leads")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(from, to);

      // Filter by pipeline
      if (pipeline !== "all") {
        query = query.eq("pipeline", pipeline);
      }

      // Filter archived
      if (!showArchived) {
        query = query.or("archived.is.null,archived.eq.false");
      }

      const { data, error: queryError, count } = await query;

      if (queryError) throw queryError;

      // Cast data to Lead[] to handle Json type compatibility
      const leadsData = (data || []) as unknown as Lead[];

      if (reset) {
        setLeads(leadsData);
        setPage(0);
      } else {
        setLeads(prev => currentPage === 0 ? leadsData : [...prev, ...leadsData]);
      }
      
      setTotalCount(count || 0);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: "Errore",
        description: "Impossibile caricare i lead: " + err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [pipeline, showArchived, page, pageSize, toast]);

  // Initial load and refetch on filter change
  useEffect(() => {
    setPage(0);
    fetchLeads(true);
  }, [pipeline, showArchived]);

  // Realtime subscription - optimized to not show toasts for every update
  useEffect(() => {
    const channel = supabase
      .channel('leads-changes-optimized')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leads'
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newLead = payload.new as unknown as Lead;
            // Only add if it matches current filters
            if (pipeline === "all" || newLead.pipeline === pipeline) {
              setLeads(prev => [newLead, ...prev]);
              setTotalCount(prev => prev + 1);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedLead = payload.new as unknown as Lead;
            setLeads(prev => 
              prev.map(lead => 
                lead.id === updatedLead.id ? updatedLead : lead
              )
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedLead = payload.old as unknown as Lead;
            setLeads(prev => prev.filter(lead => lead.id !== deletedLead.id));
            setTotalCount(prev => prev - 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [pipeline]);

  // Memoized filtered and sorted leads
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(lead =>
        lead.company_name?.toLowerCase().includes(term) ||
        lead.contact_name?.toLowerCase().includes(term) ||
        lead.email?.toLowerCase().includes(term) ||
        lead.phone?.includes(term) ||
        lead.city?.toLowerCase().includes(term)
      );
    }

    // Country filter
    if (country !== "all") {
      result = result.filter(lead => lead.country === country);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "priority":
          const priorityA = PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 2;
          const priorityB = PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 2;
          return priorityA - priorityB;
        case "value":
          return (b.value || 0) - (a.value || 0);
        case "date":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "name":
          return (a.company_name || "").localeCompare(b.company_name || "");
        default:
          return 0;
      }
    });

    return result;
  }, [leads, searchTerm, country, sortBy]);

  const loadMore = useCallback(() => {
    if (!loading && leads.length < totalCount) {
      setPage(prev => prev + 1);
      fetchLeads();
    }
  }, [loading, leads.length, totalCount, fetchLeads]);

  const updateLead = useCallback(async (id: string, data: Partial<Lead>) => {
    const { error } = await supabase
      .from("leads")
      .update(data)
      .eq("id", id);

    if (error) throw error;
  }, []);

  const deleteLead = useCallback(async (id: string) => {
    // First unlink call records
    await supabase
      .from("call_records")
      .update({ lead_id: null })
      .eq("lead_id", id);

    const { error } = await supabase
      .from("leads")
      .delete()
      .eq("id", id);

    if (error) throw error;
  }, []);

  return {
    leads,
    loading,
    error,
    totalCount,
    hasMore: leads.length < totalCount,
    loadMore,
    refetch: () => fetchLeads(true),
    updateLead,
    deleteLead,
    filteredLeads,
  };
}
