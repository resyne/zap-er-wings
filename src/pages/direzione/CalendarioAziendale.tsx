import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, Wrench, Truck, Package, FileEdit, Plus, Phone } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, isSameMonth, addDays, startOfDay } from "date-fns";
import { it } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  priority: string;
  category: string;
  assigned_to?: string;
  assignee?: {
    first_name: string;
    last_name: string;
  };
}

interface WorkOrder {
  id: string;
  number: string;
  title?: string;
  status: string;
  type: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
}

interface ShippingOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
  scheduled_date?: string;
  delivery_date?: string;
}

interface ContentTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  scheduled_date?: string;
  content_type?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  end_date?: string;
  event_type: string;
  color: string;
  all_day: boolean;
  created_by?: string;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  activity_date: string;
  status: string;
  notes?: string;
  assigned_to?: string;
  leads?: {
    company_name: string;
    contact_name?: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

type CalendarItem = 
  | (Task & { item_type: 'task' })
  | (WorkOrder & { item_type: 'work_order' })
  | (ShippingOrder & { item_type: 'shipping_order' })
  | (ContentTask & { item_type: 'content_task' })
  | (CalendarEvent & { item_type: 'event' })
  | (LeadActivity & { item_type: 'lead_activity' });

const statusColors = {
  todo: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

const statusLabels = {
  todo: "Da fare",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato"
};

const priorityColors = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800"
};

const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta"
};

export default function CalendarioAziendale() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "work",
    color: "blue",
    all_day: false,
    start_time: "09:00",
    end_time: "10:00"
  });
  const { toast } = useToast();

  // Calculate date ranges based on view mode
  const getDateRange = () => {
    if (viewMode === 'day') {
      const dayStart = startOfDay(currentDate);
      const dayEnd = addDays(dayStart, 1);
      return { start: dayStart, end: dayEnd, days: [dayStart] };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      return { start: weekStart, end: weekEnd, days: weekDays };
    } else if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
      return { start: monthStart, end: monthEnd, days: monthDays };
    } else {
      // Year view
      const yearStart = new Date(currentDate.getFullYear(), 0, 1);
      const yearEnd = new Date(currentDate.getFullYear(), 11, 31, 23, 59, 59);
      return { start: yearStart, end: yearEnd, days: [] };
    }
  };

  const dateRange = getDateRange();

  useEffect(() => {
    loadAllItems();
  }, [currentDate, viewMode]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: CalendarItem[] = [];
      const { start, end } = dateRange;

      // Load tasks - TUTTE le task senza filtri utente
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title, description, due_date, status, priority, category, assigned_to')
        .gte('due_date', start.toISOString())
        .lte('due_date', end.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) {
        console.error('Error loading tasks:', tasksError);
      }

      if (tasksData) {
        const formattedTasks = tasksData.map((task: any) => ({
          ...task,
          item_type: 'task' as const
        }));
        allItems.push(...formattedTasks);
      }

      // Load production work orders - TUTTI gli ordini
      const { data: productionWO, error: productionWOError } = await supabase
        .from('work_orders')
        .select('id, number, title, status, scheduled_start, scheduled_end, actual_start, actual_end')
        .gte('scheduled_start', start.toISOString())
        .lte('scheduled_start', end.toISOString())
        .not('scheduled_start', 'is', null);

      if (productionWOError) {
        console.error('Error loading production work orders:', productionWOError);
      }

      if (productionWO) {
        const formattedProductionWO = productionWO.map((wo: any) => ({
          ...wo,
          item_type: 'work_order' as const,
          type: 'production'
        }));
        allItems.push(...formattedProductionWO);
      }

      // Load service work orders - TUTTI gli ordini
      const { data: serviceWO, error: serviceWOError } = await supabase
        .from('service_work_orders')
        .select('id, number, title, status, scheduled_start, scheduled_end, actual_start, actual_end')
        .gte('scheduled_start', start.toISOString())
        .lte('scheduled_start', end.toISOString())
        .not('scheduled_start', 'is', null);

      if (serviceWOError) {
        console.error('Error loading service work orders:', serviceWOError);
      }

      if (serviceWO) {
        const formattedServiceWO = serviceWO.map((wo: any) => ({
          ...wo,
          item_type: 'work_order' as const,
          type: 'service'
        }));
        allItems.push(...formattedServiceWO);
      }

      // Load shipping orders - TUTTI gli ordini
      const { data: shippingOrders, error: shippingError } = await supabase
        .from('shipping_orders')
        .select('id, number, customer_name, status, scheduled_date, delivery_date')
        .gte('scheduled_date', start.toISOString())
        .lte('scheduled_date', end.toISOString())
        .not('scheduled_date', 'is', null);

      if (shippingError) {
        console.error('Error loading shipping orders:', shippingError);
      }

      if (shippingOrders) {
        const formattedShipping = shippingOrders.map((order: any) => ({
          ...order,
          order_number: order.number,
          item_type: 'shipping_order' as const
        }));
        allItems.push(...formattedShipping);
      }

      // Load calendar events - TUTTI gli eventi
      const { data: eventsData, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', start.toISOString())
        .lte('event_date', end.toISOString());

      if (eventsError) {
        console.error('Error loading calendar events:', eventsError);
      }

      if (eventsData) {
        const formattedEvents = eventsData.map((event: any) => ({
          ...event,
          item_type: 'event' as const
        }));
        allItems.push(...formattedEvents);
      }

      // Load lead activities - TUTTE le attività lead
      const { data: leadActivitiesData, error: leadActivitiesError } = await supabase
        .from('lead_activities')
        .select('*, leads(company_name, contact_name)')
        .gte('activity_date', start.toISOString())
        .lte('activity_date', end.toISOString())
        .order('activity_date', { ascending: true });

      if (leadActivitiesError) {
        console.error('Error loading lead activities:', leadActivitiesError);
      }
      
      if (leadActivitiesData && leadActivitiesData.length > 0) {
        // Get unique assigned_to user IDs
        const userIds = [...new Set(leadActivitiesData.map((a: any) => a.assigned_to).filter(Boolean))];
        
        // Fetch profiles for assigned users
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        
        const formattedLeadActivities = leadActivitiesData.map((activity: any) => ({
          ...activity,
          profiles: activity.assigned_to ? profilesMap.get(activity.assigned_to) : null,
          item_type: 'lead_activity' as const
        }));
        allItems.push(...formattedLeadActivities);
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

  const getItemsForDay = (day: Date) => {
    return items.filter(item => {
      let itemDate: Date | null = null;
      
      if (item.item_type === 'task' && item.due_date) {
        itemDate = parseISO(item.due_date);
      } else if (item.item_type === 'work_order' && item.scheduled_start) {
        itemDate = parseISO(item.scheduled_start);
      } else if (item.item_type === 'shipping_order' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      } else if (item.item_type === 'content_task' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      } else if (item.item_type === 'event' && item.event_date) {
        itemDate = parseISO(item.event_date);
      } else if (item.item_type === 'lead_activity' && item.activity_date) {
        itemDate = parseISO(item.activity_date);
      }
      
      return itemDate && isSameDay(itemDate, day);
    });
  };

  const handleCreateEvent = async () => {
    if (!selectedDate || !newEvent.title) {
      toast({
        title: "Errore",
        description: "Inserisci almeno un titolo per l'evento",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const eventDate = new Date(selectedDate);
      if (!newEvent.all_day) {
        const [hours, minutes] = newEvent.start_time.split(':');
        eventDate.setHours(parseInt(hours), parseInt(minutes));
      }

      let endDate = null;
      if (!newEvent.all_day && newEvent.end_time) {
        endDate = new Date(selectedDate);
        const [endHours, endMinutes] = newEvent.end_time.split(':');
        endDate.setHours(parseInt(endHours), parseInt(endMinutes));
      }

      const { error } = await supabase
        .from('calendar_events')
        .insert({
          user_id: user.id,
          title: newEvent.title,
          description: newEvent.description || null,
          event_date: eventDate.toISOString(),
          end_date: endDate?.toISOString() || null,
          event_type: newEvent.event_type,
          color: newEvent.color,
          all_day: newEvent.all_day
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Evento creato con successo",
      });

      setShowCreateDialog(false);
      setNewEvent({
        title: "",
        description: "",
        event_type: "work",
        color: "blue",
        all_day: false,
        start_time: "09:00",
        end_time: "10:00"
      });
      loadAllItems();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'evento",
        variant: "destructive",
      });
    }
  };

  const goToPrevious = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, -1));
    } else if (viewMode === 'week') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), currentDate.getDate()));
    }
  };

  const goToNext = () => {
    if (viewMode === 'day') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'week') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (viewMode === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), currentDate.getDate()));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getHeaderText = () => {
    if (viewMode === 'day') {
      return format(currentDate, "EEEE d MMMM yyyy", { locale: it });
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(weekStart, "d MMM", { locale: it })} - ${format(weekEnd, "d MMM yyyy", { locale: it })}`;
    } else if (viewMode === 'month') {
      return format(currentDate, "MMMM yyyy", { locale: it });
    } else {
      return format(currentDate, "yyyy", { locale: it });
    }
  };

  const getItemsForMonth = (month: number, year: number) => {
    return items.filter(item => {
      let itemDate: Date | null = null;
      
      if (item.item_type === 'task' && item.due_date) {
        itemDate = parseISO(item.due_date);
      } else if (item.item_type === 'work_order' && item.scheduled_start) {
        itemDate = parseISO(item.scheduled_start);
      } else if (item.item_type === 'shipping_order' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      } else if (item.item_type === 'content_task' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      } else if (item.item_type === 'event' && item.event_date) {
        itemDate = parseISO(item.event_date);
      } else if (item.item_type === 'lead_activity' && item.activity_date) {
        itemDate = parseISO(item.activity_date);
      }
      
      return itemDate && itemDate.getMonth() === month && itemDate.getFullYear() === year;
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Calendario Aziendale</h1>
        <p className="text-muted-foreground">
          Visualizza tutte le attività aziendali pianificate: task, commesse di lavoro, spedizioni e contenuti
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[300px] text-center">
            {getHeaderText()}
          </div>
          <Button variant="outline" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border rounded-lg p-1">
            <Button 
              variant={viewMode === 'day' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Giorno
            </Button>
            <Button 
              variant={viewMode === 'week' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Settimana
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Mese
            </Button>
            <Button 
              variant={viewMode === 'year' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('year')}
            >
              Anno
            </Button>
          </div>
          <Button onClick={goToToday}>
            <Calendar className="w-4 h-4 mr-2" />
            Oggi
          </Button>
          <Button onClick={() => {
            setSelectedDate(new Date());
            setShowCreateDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Evento
          </Button>
        </div>
      </div>

      {viewMode === 'year' ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 12 }, (_, i) => {
            const monthDate = new Date(currentDate.getFullYear(), i, 1);
            const monthItems = getItemsForMonth(i, currentDate.getFullYear());
            const isCurrentMonth = i === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
            
            return (
              <Card key={i} className={`${isCurrentMonth ? 'ring-2 ring-primary' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className={`text-base ${isCurrentMonth ? 'text-primary' : ''}`}>
                      {format(monthDate, "MMMM", { locale: it })}
                    </CardTitle>
                    <Badge variant="secondary">{monthItems.length}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 max-h-[200px] overflow-y-auto">
                  {monthItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nessuna attività
                    </p>
                  ) : (
                    monthItems.slice(0, 10).map((item) => {
                      let icon = <CheckSquare className="w-3 h-3" />;
                      let title = '';
                      
                      if (item.item_type === 'task') {
                        icon = <CheckSquare className="w-3 h-3" />;
                        title = item.title;
                      } else if (item.item_type === 'work_order') {
                        icon = <Wrench className="w-3 h-3" />;
                        title = item.number;
                      } else if (item.item_type === 'shipping_order') {
                        icon = <Truck className="w-3 h-3" />;
                        title = item.order_number;
                      } else if (item.item_type === 'content_task') {
                        icon = <FileEdit className="w-3 h-3" />;
                        title = item.title;
                      } else if (item.item_type === 'event') {
                        icon = <Calendar className="w-3 h-3" />;
                        title = item.title;
                      } else if (item.item_type === 'lead_activity') {
                        icon = <CheckSquare className="w-3 h-3" />;
                        title = `Lead: ${item.leads?.company_name || 'N/A'} - ${item.activity_type}`;
                      }
                      
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/50 cursor-pointer text-xs"
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDetailsDialog(true);
                          }}
                        >
                          {icon}
                          <span className="truncate flex-1">{title}</span>
                        </div>
                      );
                    })
                  )}
                  {monthItems.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{monthItems.length - 10} altri
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className={viewMode === 'month' ? 'grid grid-cols-7 gap-2' : viewMode === 'week' ? 'grid grid-cols-7 gap-4' : 'grid grid-cols-1 gap-4'}>
          {viewMode === 'month' && ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((day) => (
            <div key={day} className="text-center font-semibold text-sm py-2">
              {day}
            </div>
          ))}
          {dateRange.days.map((day, index) => {
          const dayItems = getItemsForDay(day);
          const isToday = isSameDay(day, new Date());
          const isCurrentMonth = viewMode === 'month' ? isSameMonth(day, currentDate) : true;
          
          return (
            <Card key={index} className={`min-h-[${viewMode === 'month' ? '120' : '300'}px] ${isToday ? 'ring-2 ring-primary' : ''} ${!isCurrentMonth ? 'opacity-50' : ''}`}>
              <CardHeader className={viewMode === 'month' ? 'p-2' : 'pb-3'}>
                <div className="flex items-center justify-between">
                  <div>
                    {viewMode !== 'month' && (
                      <CardTitle className={`text-sm ${isToday ? 'text-primary' : ''}`}>
                        {format(day, "EEEE", { locale: it })}
                      </CardTitle>
                    )}
                    <CardDescription className={`${viewMode === 'month' ? 'text-sm' : 'text-lg'} font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, viewMode === 'month' ? "d" : "d MMM", { locale: it })}
                    </CardDescription>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-5 w-5"
                    onClick={() => {
                      setSelectedDate(day);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nessuna attività pianificata
                  </p>
                ) : (
                  dayItems.map((item) => {
                    let icon = <CheckSquare className="w-3 h-3" />;
                    let borderColor = 'border-l-blue-400';
                    let title = '';
                    let subtitle = '';
                    
                    if (item.item_type === 'task') {
                      icon = <CheckSquare className="w-3 h-3" />;
                      borderColor = 'border-l-blue-400';
                      title = item.title;
                    } else if (item.item_type === 'work_order') {
                      icon = <Wrench className="w-3 h-3" />;
                      borderColor = 'border-l-orange-400';
                      title = `${item.number}${item.title ? ` - ${item.title}` : ''}`;
                    } else if (item.item_type === 'shipping_order') {
                      icon = <Truck className="w-3 h-3" />;
                      borderColor = 'border-l-green-400';
                      title = `${item.order_number}${item.customer_name ? ` - ${item.customer_name}` : ''}`;
                     } else if (item.item_type === 'content_task') {
                      icon = <FileEdit className="w-3 h-3" />;
                      borderColor = 'border-l-purple-400';
                      title = item.title;
                    } else if (item.item_type === 'event') {
                      icon = <Calendar className="w-3 h-3" />;
                      borderColor = 'border-l-indigo-400';
                      title = item.title;
                    } else if (item.item_type === 'lead_activity') {
                      icon = <Package className="w-3 h-3" />;
                      borderColor = 'border-l-pink-400';
                      const activityTypeMap: Record<string, string> = {
                        call: 'Chiamata',
                        email: 'Email',
                        meeting: 'Riunione',
                        follow_up: 'Follow-up',
                        demo: 'Demo',
                        other: 'Altro'
                      };
                      title = `${activityTypeMap[item.activity_type] || item.activity_type}`;
                      subtitle = item.leads?.company_name || 'Lead';
                    }
                    
                    return (
                      <div
                        key={item.id}
                        className={`${viewMode === 'month' ? 'p-1' : 'p-3'} border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${borderColor}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <div className={viewMode === 'month' ? 'space-y-1' : 'space-y-2'}>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">{icon}</div>
                            <div className="flex-1">
                              <div className={`font-medium ${viewMode === 'month' ? 'text-xs' : 'text-sm'} leading-tight`}>
                                {title}
                              </div>
                              {subtitle && viewMode !== 'month' && (
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          {viewMode !== 'month' && (
                            <div className="flex gap-1 ml-5 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {item.item_type === 'task' ? 'Task' : 
                                 item.item_type === 'work_order' ? 'Ordine Lavoro' :
                                 item.item_type === 'shipping_order' ? 'Spedizione' : 
                                 item.item_type === 'event' ? 'Evento' :
                                 item.item_type === 'lead_activity' ? 'Attività CRM' : 'Contenuto'}
                              </Badge>
                              {item.item_type === 'task' && (
                                <Badge className={priorityColors[item.priority as keyof typeof priorityColors] + " text-xs"}>
                                  {priorityLabels[item.priority as keyof typeof priorityLabels]}
                                </Badge>
                              )}
                              {item.item_type === 'lead_activity' && (
                                <>
                                  <Badge className={item.status === 'completed' ? 'bg-green-100 text-green-800 text-xs' : 'bg-yellow-100 text-yellow-800 text-xs'}>
                                    {item.status === 'completed' ? 'Completata' : 'Pianificata'}
                                  </Badge>
                                  {item.profiles && (
                                    <Badge variant="secondary" className="text-xs">
                                      {item.profiles.first_name} {item.profiles.last_name}
                                    </Badge>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Evento Aziendale</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "PPP", { locale: it })}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Titolo evento"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Descrizione evento"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="event_type">Tipo</Label>
              <Select value={newEvent.event_type} onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="work">Lavoro</SelectItem>
                  <SelectItem value="meeting">Riunione</SelectItem>
                  <SelectItem value="deadline">Scadenza</SelectItem>
                  <SelectItem value="other">Altro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="color">Colore</Label>
              <Select value={newEvent.color} onValueChange={(value) => setNewEvent({ ...newEvent, color: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">Blu</SelectItem>
                  <SelectItem value="green">Verde</SelectItem>
                  <SelectItem value="red">Rosso</SelectItem>
                  <SelectItem value="yellow">Giallo</SelectItem>
                  <SelectItem value="purple">Viola</SelectItem>
                  <SelectItem value="indigo">Indaco</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="all_day"
                checked={newEvent.all_day}
                onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="all_day">Tutto il giorno</Label>
            </div>

            {!newEvent.all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Ora inizio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={newEvent.start_time}
                    onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="end_time">Ora fine</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={newEvent.end_time}
                    onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateEvent}>
              Crea Evento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.item_type === 'task' && <CheckSquare className="w-5 h-5 text-blue-600" />}
              {selectedItem?.item_type === 'work_order' && <Wrench className="w-5 h-5 text-orange-600" />}
              {selectedItem?.item_type === 'shipping_order' && <Truck className="w-5 h-5 text-green-600" />}
              {selectedItem?.item_type === 'content_task' && <FileEdit className="w-5 h-5 text-purple-600" />}
              {selectedItem?.item_type === 'event' && <Calendar className="w-5 h-5 text-indigo-600" />}
              {selectedItem?.item_type === 'lead_activity' && <Package className="w-5 h-5 text-pink-600" />}
              {selectedItem?.item_type === 'task' && selectedItem.title}
              {selectedItem?.item_type === 'work_order' && `${selectedItem.number}${selectedItem.title ? ` - ${selectedItem.title}` : ''}`}
              {selectedItem?.item_type === 'shipping_order' && `${selectedItem.order_number}${selectedItem.customer_name ? ` - ${selectedItem.customer_name}` : ''}`}
              {selectedItem?.item_type === 'content_task' && selectedItem.title}
              {selectedItem?.item_type === 'event' && selectedItem.title}
              {selectedItem?.item_type === 'lead_activity' && (
                <>
                  {selectedItem.activity_type === 'call' ? 'Chiamata' :
                   selectedItem.activity_type === 'email' ? 'Email' :
                   selectedItem.activity_type === 'meeting' ? 'Riunione' :
                   selectedItem.activity_type === 'follow_up' ? 'Follow-up' :
                   selectedItem.activity_type === 'demo' ? 'Demo' :
                   'Attività'}
                  {' con '}{selectedItem.leads?.company_name || 'Lead'}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.item_type === 'task' ? 'Task Aziendale' : 
               selectedItem?.item_type === 'work_order' ? 'Commessa di Lavoro' :
               selectedItem?.item_type === 'shipping_order' ? 'Commessa di Spedizione' : 
               selectedItem?.item_type === 'event' ? 'Evento Aziendale' :
               selectedItem?.item_type === 'lead_activity' ? 'Attività CRM' : 'Attività Contenuto'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.item_type === 'task' && (
                <>
                  {selectedItem.description && (
                    <div>
                      <h4 className="font-medium mb-1">Descrizione</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-1">Categoria</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.category}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Priorità</h4>
                    <Badge className={priorityColors[selectedItem.priority as keyof typeof priorityColors]}>
                      {priorityLabels[selectedItem.priority as keyof typeof priorityLabels]}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge className={statusColors[selectedItem.status as keyof typeof statusColors]}>
                      {statusLabels[selectedItem.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                  
                  {selectedItem.due_date && (
                    <div>
                      <h4 className="font-medium mb-1">Scadenza</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.due_date), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'work_order' && (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Tipo</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.type}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.scheduled_start && (
                    <div>
                      <h4 className="font-medium mb-1">Inizio Pianificato</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_start), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                  
                  {selectedItem.scheduled_end && (
                    <div>
                      <h4 className="font-medium mb-1">Fine Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_end), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'shipping_order' && (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Cliente</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.customer_name || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.scheduled_date && (
                    <div>
                      <h4 className="font-medium mb-1">Data Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_date), "PPP", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'content_task' && (
                <>
                  {selectedItem.description && (
                    <div>
                      <h4 className="font-medium mb-1">Descrizione</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.content_type && (
                    <div>
                      <h4 className="font-medium mb-1">Tipo Contenuto</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.content_type}</p>
                    </div>
                  )}
                  
                  {selectedItem.scheduled_date && (
                    <div>
                      <h4 className="font-medium mb-1">Data Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_date), "PPP", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem?.item_type === 'event' && (
                <>
                  {selectedItem.description && (
                    <div>
                      <h4 className="font-medium mb-1">Descrizione</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-1">Tipo</h4>
                    <p className="text-sm text-muted-foreground capitalize">{selectedItem.event_type}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Data e Ora</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedItem.all_day 
                        ? format(parseISO(selectedItem.event_date), "PPP", { locale: it })
                        : format(parseISO(selectedItem.event_date), "PPP 'alle' HH:mm", { locale: it })
                      }
                      {selectedItem.end_date && !selectedItem.all_day && (
                        <> - {format(parseISO(selectedItem.end_date), "HH:mm")}</>
                      )}
                    </p>
                  </div>
                </>
              )}

              {selectedItem?.item_type === 'lead_activity' && (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Lead</h4>
                    <p className="text-sm font-semibold">{selectedItem.leads?.company_name || 'N/A'}</p>
                    {selectedItem.leads?.contact_name && (
                      <p className="text-sm text-muted-foreground">Contatto: {selectedItem.leads.contact_name}</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Assegnato a</h4>
                    {selectedItem.profiles ? (
                      <p className="text-sm text-muted-foreground">
                        {selectedItem.profiles.first_name} {selectedItem.profiles.last_name}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Non assegnato</p>
                    )}
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Tipo di Attività</h4>
                    <Badge variant="outline">
                      {selectedItem.activity_type === 'call' ? 'Chiamata' :
                       selectedItem.activity_type === 'email' ? 'Email' :
                       selectedItem.activity_type === 'meeting' ? 'Riunione' :
                       selectedItem.activity_type === 'follow_up' ? 'Follow-up' :
                       selectedItem.activity_type === 'demo' ? 'Demo' :
                       selectedItem.activity_type || 'Altro'}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge className={selectedItem.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                      {selectedItem.status === 'completed' ? 'Completata' : 'Pianificata'}
                    </Badge>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Data e Ora</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO(selectedItem.activity_date), "PPP 'alle' HH:mm", { locale: it })}
                    </p>
                  </div>

                  {selectedItem.notes && (
                    <div>
                      <h4 className="font-medium mb-1">Note</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selectedItem.notes}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
