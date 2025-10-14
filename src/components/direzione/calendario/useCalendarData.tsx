import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CalendarItem } from "./types";

export const useCalendarData = (startDate: Date, endDate: Date) => {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadAllItems();
  }, [startDate, endDate]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: CalendarItem[] = [];

      // Carica tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, priority, category, assigned_to')
        .gte('due_date', startDate.toISOString())
        .lte('due_date', endDate.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) console.error('Error loading tasks:', tasksError);
      if (tasksData) {
        allItems.push(...tasksData.map((task: any) => ({
          ...task,
          item_type: 'task' as const
        })));
      }

      // Carica ordini di produzione
      const { data: workOrders, error: woError } = await supabase
        .from('work_orders')
        .select('id, number, title, status, scheduled_date, actual_start_date, actual_end_date')
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString())
        .not('scheduled_date', 'is', null);

      if (woError) console.error('Error loading work orders:', woError);
      if (workOrders) {
        allItems.push(...workOrders.map((wo: any) => ({
          ...wo,
          item_type: 'work_order' as const,
          type: 'production'
        })));
      }

      // Carica ordini di assistenza
      const { data: serviceOrders, error: soError } = await supabase
        .from('service_work_orders')
        .select('id, number, title, status, scheduled_date, completed_date')
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString())
        .not('scheduled_date', 'is', null);

      if (soError) console.error('Error loading service orders:', soError);
      if (serviceOrders) {
        allItems.push(...serviceOrders.map((so: any) => ({
          ...so,
          item_type: 'service_order' as const
        })));
      }

      // Carica ordini di spedizione
      const { data: shippingOrders, error: shipError } = await supabase
        .from('shipping_orders')
        .select('id, number, status, order_date, preparation_date, ready_date, shipped_date')
        .gte('order_date', startDate.toISOString())
        .lte('order_date', endDate.toISOString())
        .not('order_date', 'is', null);

      if (shipError) console.error('Error loading shipping orders:', shipError);
      if (shippingOrders) {
        allItems.push(...shippingOrders.map((ship: any) => ({
          ...ship,
          item_type: 'shipping_order' as const
        })));
      }

      // Carica eventi calendario
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', startDate.toISOString())
        .lte('event_date', endDate.toISOString());

      if (eventsError) console.error('Error loading events:', eventsError);
      if (events) {
        allItems.push(...events.map((event: any) => ({
          ...event,
          item_type: 'event' as const
        })));
      }

      // Carica lead activities con i profili assegnati
      const { data: leadActivities, error: leadError } = await supabase
        .from('lead_activities')
        .select(`
          *,
          leads (company_name, contact_name),
          profiles!lead_activities_assigned_to_fkey (first_name, last_name)
        `)
        .gte('activity_date', startDate.toISOString())
        .lte('activity_date', endDate.toISOString())
        .order('activity_date', { ascending: true });

      if (leadError) console.error('Error loading lead activities:', leadError);
      if (leadActivities) {
        allItems.push(...leadActivities.map((activity: any) => ({
          ...activity,
          item_type: 'lead_activity' as const
        })));
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
