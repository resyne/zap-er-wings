import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarItem } from "./types";

export const useCalendarData = (startDate: Date, endDate: Date, options?: { excludeLeadActivities?: boolean }) => {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Memoizza le stringhe ISO per evitare loop infiniti
  const startISO = useMemo(() => startDate.toISOString(), [startDate.getTime()]);
  const endISO = useMemo(() => endDate.toISOString(), [endDate.getTime()]);

  useEffect(() => {
    loadAllItems();
  }, [startISO, endISO]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: CalendarItem[] = [];

      // Carica tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, priority, category, assigned_to')
        .gte('due_date', startISO)
        .lte('due_date', endISO)
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) console.error('Error loading tasks:', tasksError);
      if (tasksData) {
        allItems.push(...tasksData.map((task: any) => ({
          ...task,
          item_type: 'task' as const
        })));
      }

      // Carica fasi commesse calendarizzate
      const { data: phases, error: phasesError } = await supabase
        .from('commessa_phases')
        .select(`
          id, phase_type, phase_order, status, scheduled_date, started_date, completed_date,
          commesse(id, number, title, type, customer_id, customers(name))
        `)
        .gte('scheduled_date', startISO)
        .lte('scheduled_date', endISO)
        .not('scheduled_date', 'is', null);

      if (phasesError) console.error('Error loading commessa phases:', phasesError);
      if (phases) {
        phases.forEach((phase: any) => {
          const commessa = phase.commesse;
          if (!commessa) return;
          const phaseLabels: Record<string, string> = {
            produzione: "Produzione", spedizione: "Spedizione", installazione: "Installazione",
            manutenzione: "Manutenzione", riparazione: "Riparazione"
          };
          if (phase.phase_type === "produzione" || phase.phase_type === "manutenzione" || phase.phase_type === "riparazione" || phase.phase_type === "installazione") {
            allItems.push({
              id: phase.id,
              number: commessa.number,
              title: `${phaseLabels[phase.phase_type] || phase.phase_type} - ${commessa.title}`,
              status: phase.status,
              type: phase.phase_type === "produzione" ? "production" : "service",
              scheduled_date: phase.scheduled_date,
              actual_start_date: phase.started_date,
              actual_end_date: phase.completed_date,
              item_type: phase.phase_type === "produzione" ? 'work_order' as const : 'service_order' as const,
            });
          } else if (phase.phase_type === "spedizione") {
            allItems.push({
              id: phase.id,
              number: commessa.number,
              status: phase.status,
              order_date: phase.scheduled_date,
              item_type: 'shipping_order' as const,
            });
          }
        });
      }

      // Carica eventi calendario
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', startISO)
        .lte('event_date', endISO);

      if (eventsError) console.error('Error loading events:', eventsError);
      if (events) {
        allItems.push(...events.map((event: any) => ({
          ...event,
          item_type: 'event' as const
        })));
      }

      // Carica lead activities (solo se non escluse)
      if (!options?.excludeLeadActivities) {
        const { data: leadActivities, error: leadError } = await supabase
          .from('lead_activities')
          .select(`
            *,
            leads (company_name, contact_name)
          `)
          .gte('activity_date', startISO)
          .lte('activity_date', endISO)
          .order('activity_date', { ascending: true });

        if (leadError) console.error('Error loading lead activities:', leadError);
        if (leadActivities) {
          allItems.push(...leadActivities.map((activity: any) => ({
            ...activity,
            item_type: 'lead_activity' as const
          })));
        }
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error loading calendar items:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle attività",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return { items, loading, refetch: loadAllItems };
};
