import { useState, useEffect, useCallback, useMemo, DragEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, GripVertical } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO, setHours, setMinutes } from "date-fns";
import { it } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  priority: string;
  category: string;
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
}

interface Ticket {
  id: string;
  number: string;
  title: string;
  description?: string | null;
  scheduled_date: string;
  status: string;
  priority: string;
  customer_name: string;
}

interface LeadActivity {
  id: string;
  activity_type: string;
  activity_date: string;
  status: string | null;
  notes: string | null;
  lead_id: string;
  lead_name?: string;
}

interface RecurringTask {
  id: string;
  task_template_id: string;
  title: string;
  description?: string;
  day: number;
  priority: string;
  category: string;
  is_active: boolean;
  completed?: boolean;
  completion_id?: string;
}

interface WeeklyCalendarProps {
  recurringTasks?: RecurringTask[];
  onRecurringTaskToggle?: (task: RecurringTask) => void;
  onExternalDrop?: () => void;
}

type CalendarItem = (Task & { item_type: 'task' }) | (CalendarEvent & { item_type: 'event' }) | (Ticket & { item_type: 'ticket' }) | (RecurringTask & { item_type: 'recurring' }) | (LeadActivity & { item_type: 'lead_activity' });

interface DragData {
  itemType: CalendarItem['item_type'];
  itemId: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  high: "bg-destructive/10 text-destructive"
};

const priorityLabels: Record<string, string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta"
};

const HOURS = Array.from({ length: 10 }, (_, i) => i + 9);

const COLOR_MAP: Record<string, string> = {
  recurring: 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800',
  task: 'bg-primary/10 text-primary border-primary/20',
  ticket: 'bg-orange-50 text-orange-900 border-orange-200 dark:bg-orange-900/20 dark:text-orange-200 dark:border-orange-800',
  event: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800',
  lead_activity: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-200 dark:border-green-800',
};

function getItemHour(item: CalendarItem): number | null {
  if (item.item_type === 'recurring') return null;
  if (item.item_type === 'event') {
    if ((item as CalendarEvent).all_day) return null;
    try { return parseISO((item as CalendarEvent).event_date).getHours(); } catch { return null; }
  }
  if (item.item_type === 'ticket') {
    try { return parseISO((item as Ticket).scheduled_date).getHours(); } catch { return null; }
  }
  if (item.item_type === 'task') {
    if (!(item as Task).due_date) return null;
    try { return parseISO((item as Task).due_date!).getHours(); } catch { return null; }
  }
  if (item.item_type === 'lead_activity') {
    try { return parseISO((item as LeadActivity).activity_date).getHours(); } catch { return null; }
  }
  return null;
}

function getItemDate(item: CalendarItem): string | null {
  if (item.item_type === 'recurring') return null;
  if (item.item_type === 'event') return (item as CalendarEvent).event_date;
  if (item.item_type === 'ticket') return (item as Ticket).scheduled_date;
  if (item.item_type === 'task') return (item as Task).due_date || null;
  if (item.item_type === 'lead_activity') return (item as LeadActivity).activity_date;
  return null;
}

function getItemTitle(item: CalendarItem): string {
  if (item.item_type === 'lead_activity') {
    const la = item as LeadActivity & { item_type: 'lead_activity' };
    return la.lead_name || la.activity_type;
  }
  return (item as any).title || '';
}

function getItemDescription(item: CalendarItem): string | undefined {
  if (item.item_type === 'lead_activity') return (item as LeadActivity).notes || undefined;
  return (item as any).description;
}
export function WeeklyCalendar({ recurringTasks = [], onRecurringTaskToggle, onExternalDrop }: WeeklyCalendarProps) {

  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "", description: "", event_type: "personal", color: "blue",
    all_day: false, start_time: "09:00", end_time: "10:00"
  });
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => { loadData(); }, [currentWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      const [tasksRes, eventsRes, ticketsRes, activitiesRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('assigned_to', user.id)
          .gte('due_date', weekStart.toISOString()).lte('due_date', weekEnd.toISOString())
          .not('due_date', 'is', null).eq('is_template', false),
        supabase.from('calendar_events').select('*').eq('user_id', user.id)
          .gte('event_date', weekStart.toISOString()).lte('event_date', weekEnd.toISOString()),
        supabase.from('tickets').select('*').eq('assigned_to', user.id)
          .not('scheduled_date', 'is', null)
          .gte('scheduled_date', weekStart.toISOString()).lte('scheduled_date', weekEnd.toISOString()),
        supabase.from('lead_activities').select('*, leads(company_name, contact_name)')
          .eq('assigned_to', user.id)
          .gte('activity_date', weekStart.toISOString()).lte('activity_date', weekEnd.toISOString()),
      ]);
      if (tasksRes.error) throw tasksRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;
      if (activitiesRes.error) throw activitiesRes.error;
      setTasks(tasksRes.data || []);
      setEvents(eventsRes.data || []);
      setTickets(ticketsRes.data || []);
      setLeadActivities((activitiesRes.data || []).map((a: any) => ({
        ...a,
        lead_name: a.leads?.company_name || a.leads?.contact_name || a.activity_type,
      })));
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Errore", description: "Errore nel caricamento dei dati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Memoize items per day
  const itemsByDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    weekDays.forEach(day => {
      const key = format(day, 'yyyy-MM-dd');
      const dayTasks = tasks
        .filter(t => t.due_date && isSameDay(parseISO(t.due_date), day))
        .map(t => ({ ...t, item_type: 'task' as const }));
      const dayEvents = events
        .filter(e => isSameDay(parseISO(e.event_date), day))
        .map(e => ({ ...e, item_type: 'event' as const }));
      const dayTickets = tickets
        .filter(t => isSameDay(parseISO(t.scheduled_date), day))
        .map(t => ({ ...t, item_type: 'ticket' as const }));
      const dayLeadActivities = leadActivities
        .filter(a => isSameDay(parseISO(a.activity_date), day))
        .map(a => ({ ...a, item_type: 'lead_activity' as const }));
      const jsDay = day.getDay();
      const weekDay = jsDay === 0 ? 7 : jsDay;
      const dayRecurring = recurringTasks
        .filter(rt => rt.day === weekDay)
        .map(rt => ({ ...rt, item_type: 'recurring' as const }));
      map.set(key, [...dayRecurring, ...dayTasks, ...dayEvents, ...dayTickets, ...dayLeadActivities]);
    });
    return map;
  }, [weekDays, tasks, events, tickets, leadActivities, recurringTasks]);

  const getItemsForDay = useCallback((day: Date) => {
    return itemsByDay.get(format(day, 'yyyy-MM-dd')) || [];
  }, [itemsByDay]);

  // --- Drag & Drop ---
  const handleDragStart = (e: DragEvent, item: CalendarItem) => {
    if (item.item_type === 'recurring') {
      e.preventDefault();
      return;
    }
    const data: DragData = { itemType: item.item_type, itemId: item.id };
    e.dataTransfer.setData('application/json', JSON.stringify(data));
    e.dataTransfer.effectAllowed = 'move';
    // Add a subtle drag image opacity
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
      setTimeout(() => { (e.currentTarget as HTMLElement).style.opacity = '1'; }, 0);
    }
  };

  const handleDragOver = (e: DragEvent, slotKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSlot(slotKey);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = async (e: DragEvent, targetDay: Date, targetHour: number | null) => {
    e.preventDefault();
    setDragOverSlot(null);

    let data: DragData;
    try {
      data = JSON.parse(e.dataTransfer.getData('application/json'));
    } catch { return; }

    const newDate = new Date(targetDay);
    if (targetHour !== null) {
      newDate.setHours(targetHour, 0, 0, 0);
    } else {
      newDate.setHours(0, 0, 0, 0);
    }
    const newIso = newDate.toISOString();

    try {
      if (data.itemType === 'task') {
        const { error } = await supabase.from('tasks').update({ due_date: newIso }).eq('id', data.itemId);
        if (error) throw error;
      } else if (data.itemType === 'event') {
        const updateData: Record<string, unknown> = { event_date: newIso };
        if (targetHour === null) {
          updateData.all_day = true;
        } else {
          updateData.all_day = false;
        }
        const { error } = await supabase.from('calendar_events').update(updateData).eq('id', data.itemId);
        if (error) throw error;
      } else if (data.itemType === 'ticket') {
        const { error } = await supabase.from('tickets').update({ scheduled_date: newIso }).eq('id', data.itemId);
        if (error) throw error;
      } else if (data.itemType === 'lead_activity') {
        const { error } = await supabase.from('lead_activities').update({ activity_date: newIso }).eq('id', data.itemId);
        if (error) throw error;
      }
      toast({ title: "Spostato", description: "Elemento spostato nel calendario" });
      loadData();
      onExternalDrop?.();
    } catch (error) {
      console.error('Drop error:', error);
      toast({ title: "Errore", description: "Impossibile spostare l'elemento", variant: "destructive" });
    }
  };

  // --- Event Creation ---
  const handleCreateEvent = async () => {
    if (!selectedDate || !newEvent.title) {
      toast({ title: "Errore", description: "Inserisci almeno un titolo", variant: "destructive" });
      return;
    }
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");
      const eventDate = new Date(selectedDate);
      if (!newEvent.all_day) {
        const [h, m] = newEvent.start_time.split(':');
        eventDate.setHours(parseInt(h), parseInt(m));
      }
      let endDate = null;
      if (!newEvent.all_day && newEvent.end_time) {
        endDate = new Date(selectedDate);
        const [eh, em] = newEvent.end_time.split(':');
        endDate.setHours(parseInt(eh), parseInt(em));
      }
      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id, title: newEvent.title, description: newEvent.description || null,
        event_date: eventDate.toISOString(), end_date: endDate?.toISOString() || null,
        event_type: newEvent.event_type, color: newEvent.color, all_day: newEvent.all_day
      });
      if (error) throw error;
      toast({ title: "Successo", description: "Evento creato" });
      setShowCreateDialog(false);
      setNewEvent({ title: "", description: "", event_type: "personal", color: "blue", all_day: false, start_time: "09:00", end_time: "10:00" });
      loadData();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({ title: "Errore", description: "Errore nella creazione dell'evento", variant: "destructive" });
    }
  };

  const openCreateForSlot = (day: Date, hour?: number) => {
    setSelectedDate(day);
    if (hour !== undefined) {
      setNewEvent(prev => ({
        ...prev, all_day: false,
        start_time: `${String(hour).padStart(2, '0')}:00`,
        end_time: `${String(hour + 1).padStart(2, '0')}:00`,
      }));
    } else {
      setNewEvent(prev => ({ ...prev, all_day: true }));
    }
    setShowCreateDialog(true);
  };

  const handleItemClick = (item: CalendarItem) => {
    if (item.item_type === 'recurring' && onRecurringTaskToggle) {
      onRecurringTaskToggle(item as RecurringTask);
    } else {
      setSelectedItem(item);
      setShowDetailsDialog(true);
    }
  };

  // --- Render pill ---
  const renderItemPill = (item: CalendarItem) => {
    const isRecurring = item.item_type === 'recurring';
    const isTicket = item.item_type === 'ticket';
    const recurringItem = isRecurring ? item as RecurringTask & { item_type: 'recurring' } : null;
    const isDraggable = !isRecurring;

    return (
      <div
        key={`${item.item_type}-${item.id}`}
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => handleDragStart(e, item) : undefined}
        className={`
          group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium border 
          cursor-pointer overflow-hidden transition-all hover:shadow-sm max-w-full
          ${COLOR_MAP[item.item_type] || COLOR_MAP.event} 
          ${recurringItem?.completed ? 'opacity-40 line-through' : ''}
          ${isDraggable ? 'hover:ring-1 hover:ring-primary/30 active:scale-95' : ''}
        `}
        onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
        title={`${item.title}${isDraggable ? ' — Trascina per spostare' : ''}`}
      >
        {isDraggable && (
          <GripVertical className="w-2.5 h-2.5 opacity-0 group-hover:opacity-50 shrink-0 transition-opacity" />
        )}
        {isRecurring && <span className="shrink-0">{recurringItem?.completed ? '✓' : '○'}</span>}
        {isTicket && <span className="shrink-0 font-mono">{(item as Ticket).number}</span>}
        <span className="truncate">{item.title}</span>
      </div>
    );
  };

  // --- Slot key for drag highlight ---
  const slotKey = (dayIdx: number, hour: number | null) => `${dayIdx}-${hour ?? 'all'}`;

  return (
    <Card className="shadow-sm border-border/50 overflow-hidden">
      <CardContent className="p-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            Calendario
          </h3>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-medium min-w-[120px] text-center text-foreground whitespace-nowrap">
              {format(weekStart, "d", { locale: it })} – {format(weekEnd, "d MMM yy", { locale: it })}
            </span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-6 text-[10px] ml-0.5 px-2" onClick={() => setCurrentWeek(new Date())}>
              Oggi
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mb-2 text-[9px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-primary/30" /> Task</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-blue-300" /> Eventi</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-orange-300" /> Ticket</span>
          <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-sm bg-amber-300" /> Ricorrenti</span>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto rounded-md border border-border">
          <div className="min-w-[600px]">
            {/* Day headers */}
            <div className="grid grid-cols-[36px_repeat(7,1fr)] bg-muted/30">
              <div className="border-b border-r border-border" />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={i} className={`text-center py-1.5 border-b border-r border-border last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                    <div className={`text-[9px] uppercase tracking-wider ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, "EEEEE", { locale: it })}
                    </div>
                    <div className={`text-xs font-semibold leading-none mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All-day row */}
            <div className="grid grid-cols-[36px_repeat(7,1fr)] bg-muted/10">
              <div className="text-[8px] text-muted-foreground px-0.5 py-1 flex items-start justify-end pr-1 border-r border-b border-border font-medium">
                Giorn.
              </div>
              {weekDays.map((day, i) => {
                const items = getItemsForDay(day);
                const allDayItems = items.filter(item => getItemHour(item) === null);
                const isToday = isSameDay(day, new Date());
                const sk = slotKey(i, null);
                const isOver = dragOverSlot === sk;
                return (
                  <div
                    key={i}
                    className={`border-r border-b border-border last:border-r-0 min-h-[32px] px-0.5 py-0.5 space-y-0.5 cursor-pointer transition-colors overflow-hidden
                      ${isToday ? 'bg-primary/5' : ''} 
                      ${isOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/30'}
                    `}
                    onClick={() => openCreateForSlot(day)}
                    onDragOver={(e) => handleDragOver(e, sk)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, day, null)}
                  >
                    {allDayItems.map(item => renderItemPill(item))}
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[36px_repeat(7,1fr)]">
                <div className="text-[9px] text-muted-foreground px-0.5 py-0.5 flex items-start justify-end pr-1 tabular-nums border-r border-b border-border font-medium">
                  {String(hour).padStart(2, '0')}
                </div>
                {weekDays.map((day, i) => {
                  const items = getItemsForDay(day);
                  const hourItems = items.filter(item => {
                    const h = getItemHour(item);
                    return h !== null && h === hour;
                  });
                  const isToday = isSameDay(day, new Date());
                  const isNowHour = isToday && new Date().getHours() === hour;
                  const sk = slotKey(i, hour);
                  const isOver = dragOverSlot === sk;
                  return (
                    <div
                      key={i}
                      className={`border-r border-b border-border last:border-r-0 min-h-[32px] px-0.5 py-0.5 space-y-0.5 cursor-pointer transition-colors relative overflow-hidden
                        ${isToday ? 'bg-primary/[0.02]' : ''} 
                        ${isNowHour ? 'bg-primary/5' : ''} 
                        ${isOver ? 'bg-primary/10 ring-1 ring-inset ring-primary/30' : 'hover:bg-muted/20'}
                      `}
                      onClick={() => openCreateForSlot(day, hour)}
                      onDragOver={(e) => handleDragOver(e, sk)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, day, hour)}
                    >
                      {isNowHour && (
                        <div
                          className="absolute left-0 right-0 border-t-2 border-destructive z-10 pointer-events-none"
                          style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }}
                        >
                          <div className="absolute -left-1 -top-[4px] w-2 h-2 rounded-full bg-destructive" />
                        </div>
                      )}
                      {hourItems.map(item => renderItemPill(item))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Create Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Evento</DialogTitle>
            <DialogDescription>
              {selectedDate && format(selectedDate, "PPP", { locale: it })}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="cal-title">Titolo *</Label>
              <Input id="cal-title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Titolo evento" />
            </div>
            <div>
              <Label htmlFor="cal-desc">Descrizione</Label>
              <Textarea id="cal-desc" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Descrizione" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={newEvent.event_type} onValueChange={(v) => setNewEvent({ ...newEvent, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Personale</SelectItem>
                    <SelectItem value="work">Lavoro</SelectItem>
                    <SelectItem value="meeting">Riunione</SelectItem>
                    <SelectItem value="other">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Colore</Label>
                <Select value={newEvent.color} onValueChange={(v) => setNewEvent({ ...newEvent, color: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="blue">Blu</SelectItem>
                    <SelectItem value="green">Verde</SelectItem>
                    <SelectItem value="red">Rosso</SelectItem>
                    <SelectItem value="yellow">Giallo</SelectItem>
                    <SelectItem value="purple">Viola</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="cal-allday" checked={newEvent.all_day} onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })} className="rounded border-input" />
              <Label htmlFor="cal-allday">Tutto il giorno</Label>
            </div>
            {!newEvent.all_day && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ora inizio</Label>
                  <Input type="time" value={newEvent.start_time} onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })} />
                </div>
                <div>
                  <Label>Ora fine</Label>
                  <Input type="time" value={newEvent.end_time} onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Annulla</Button>
            <Button onClick={handleCreateEvent}>Crea Evento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              {selectedItem?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.item_type === 'task' ? 'Task' : selectedItem?.item_type === 'ticket' ? 'Ticket' : selectedItem?.item_type === 'recurring' ? 'Task Ricorrente' : 'Evento'}
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              {selectedItem.description && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-1">Descrizione</h4>
                  <p className="text-sm">{selectedItem.description}</p>
                </div>
              )}
              {selectedItem.item_type === 'task' && (
                <>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Categoria</h4><p className="text-sm capitalize">{(selectedItem as Task).category}</p></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Priorità</h4><Badge className={priorityColors[(selectedItem as Task).priority]}>{priorityLabels[(selectedItem as Task).priority]}</Badge></div>
                  {(selectedItem as Task).due_date && (
                    <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Scadenza</h4><p className="text-sm">{format(parseISO((selectedItem as Task).due_date!), "PPP 'alle' HH:mm", { locale: it })}</p></div>
                  )}
                </>
              )}
              {selectedItem.item_type === 'ticket' && (
                <>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Numero</h4><p className="text-sm font-mono">{(selectedItem as Ticket).number}</p></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Cliente</h4><p className="text-sm">{(selectedItem as Ticket).customer_name}</p></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Priorità</h4><Badge className={priorityColors[(selectedItem as Ticket).priority]}>{priorityLabels[(selectedItem as Ticket).priority] || (selectedItem as Ticket).priority}</Badge></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Data</h4><p className="text-sm">{format(parseISO((selectedItem as Ticket).scheduled_date), "PPP 'alle' HH:mm", { locale: it })}</p></div>
                </>
              )}
              {selectedItem.item_type === 'event' && (
                <>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Tipo</h4><p className="text-sm capitalize">{(selectedItem as CalendarEvent).event_type}</p></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Data e Ora</h4><p className="text-sm">
                    {(selectedItem as CalendarEvent).all_day
                      ? format(parseISO((selectedItem as CalendarEvent).event_date), "PPP", { locale: it })
                      : format(parseISO((selectedItem as CalendarEvent).event_date), "PPP 'alle' HH:mm", { locale: it })}
                    {(selectedItem as CalendarEvent).end_date && !(selectedItem as CalendarEvent).all_day && (<> – {format(parseISO((selectedItem as CalendarEvent).end_date!), "HH:mm")}</>)}
                  </p></div>
                </>
              )}
              {selectedItem.item_type === 'recurring' && (
                <>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Categoria</h4><p className="text-sm capitalize">{(selectedItem as RecurringTask).category}</p></div>
                  <div><h4 className="text-xs font-medium text-muted-foreground mb-1">Stato</h4><Badge variant={(selectedItem as RecurringTask).completed ? "default" : "outline"}>{(selectedItem as RecurringTask).completed ? 'Completata' : 'Da fare'}</Badge></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
