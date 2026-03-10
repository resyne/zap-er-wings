import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
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
}

type CalendarItem = (Task & { item_type: 'task' }) | (CalendarEvent & { item_type: 'event' }) | (Ticket & { item_type: 'ticket' }) | (RecurringTask & { item_type: 'recurring' });

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

const HOURS = Array.from({ length: 10 }, (_, i) => i + 9); // 9..18

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
  return null;
}

export function WeeklyCalendar({ recurringTasks = [], onRecurringTaskToggle }: WeeklyCalendarProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    event_type: "personal",
    color: "blue",
    all_day: false,
    start_time: "09:00",
    end_time: "10:00"
  });
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const [tasksRes, eventsRes, ticketsRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('assigned_to', user.id)
          .gte('due_date', weekStart.toISOString()).lte('due_date', weekEnd.toISOString())
          .not('due_date', 'is', null).eq('is_template', false),
        supabase.from('calendar_events').select('*').eq('user_id', user.id)
          .gte('event_date', weekStart.toISOString()).lte('event_date', weekEnd.toISOString()),
        supabase.from('tickets').select('*').eq('assigned_to', user.id)
          .not('scheduled_date', 'is', null)
          .gte('scheduled_date', weekStart.toISOString()).lte('scheduled_date', weekEnd.toISOString()),
      ]);

      if (tasksRes.error) throw tasksRes.error;
      if (eventsRes.error) throw eventsRes.error;
      if (ticketsRes.error) throw ticketsRes.error;

      setTasks(tasksRes.data || []);
      setEvents(eventsRes.data || []);
      setTickets(ticketsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: "Errore", description: "Errore nel caricamento dei dati", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getItemsForDay = (day: Date): CalendarItem[] => {
    const dayTasks = tasks
      .filter(task => task.due_date && isSameDay(parseISO(task.due_date), day))
      .map(task => ({ ...task, item_type: 'task' as const }));

    const dayEvents = events
      .filter(event => isSameDay(parseISO(event.event_date), day))
      .map(event => ({ ...event, item_type: 'event' as const }));

    const dayTickets = tickets
      .filter(ticket => isSameDay(parseISO(ticket.scheduled_date), day))
      .map(ticket => ({ ...ticket, item_type: 'ticket' as const }));

    const jsDay = day.getDay();
    const weekDay = jsDay === 0 ? 7 : jsDay;
    const dayRecurring = recurringTasks
      .filter(rt => rt.day === weekDay)
      .map(rt => ({ ...rt, item_type: 'recurring' as const }));

    return [...dayRecurring, ...dayTasks, ...dayEvents, ...dayTickets];
  };

  const handleCreateEvent = async () => {
    if (!selectedDate || !newEvent.title) {
      toast({ title: "Errore", description: "Inserisci almeno un titolo per l'evento", variant: "destructive" });
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

      const { error } = await supabase.from('calendar_events').insert({
        user_id: user.id, title: newEvent.title, description: newEvent.description || null,
        event_date: eventDate.toISOString(), end_date: endDate?.toISOString() || null,
        event_type: newEvent.event_type, color: newEvent.color, all_day: newEvent.all_day
      });
      if (error) throw error;

      toast({ title: "Successo", description: "Evento creato con successo" });
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
    setSelectedHour(hour ?? null);
    if (hour !== undefined) {
      setNewEvent(prev => ({
        ...prev,
        all_day: false,
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

  // Render a compact item pill
  const renderItemPill = (item: CalendarItem) => {
    const isRecurring = item.item_type === 'recurring';
    const isTask = item.item_type === 'task';
    const isTicket = item.item_type === 'ticket';
    const recurringItem = isRecurring ? item as RecurringTask & { item_type: 'recurring' } : null;

    const colorMap: Record<string, string> = {
      recurring: 'bg-amber-100 text-amber-900 border-amber-300',
      task: 'bg-primary/10 text-primary border-primary/30',
      ticket: 'bg-orange-100 text-orange-900 border-orange-300',
      event: 'bg-blue-100 text-blue-900 border-blue-300',
    };

    return (
      <div
        key={`${item.item_type}-${item.id}`}
        className={`px-1.5 py-0.5 rounded text-[10px] leading-tight font-medium border cursor-pointer truncate transition-opacity hover:opacity-80 ${colorMap[item.item_type] || colorMap.event} ${recurringItem?.completed ? 'opacity-40 line-through' : ''}`}
        onClick={(e) => { e.stopPropagation(); handleItemClick(item); }}
        title={item.title}
      >
        {isRecurring && (recurringItem?.completed ? '✓ ' : '○ ')}
        {isTicket && `${(item as Ticket).number} `}
        {item.title}
      </div>
    );
  };

  return (
    <Card className="shadow-sm">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Calendario Settimanale
          </h3>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-medium min-w-[140px] text-center">
              {format(weekStart, "d MMM", { locale: it })} – {format(weekEnd, "d MMM yyyy", { locale: it })}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setCurrentWeek(new Date())}>
              Oggi
            </Button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b">
              <div />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div key={i} className={`text-center py-2 border-l ${isToday ? 'bg-primary/5' : ''}`}>
                    <div className={`text-[10px] uppercase tracking-wider ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                      {format(day, "EEE", { locale: it })}
                    </div>
                    <div className={`text-sm font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All-day row */}
            <div className="grid grid-cols-[50px_repeat(7,1fr)] border-b bg-muted/20">
              <div className="text-[9px] text-muted-foreground px-1 py-1 flex items-start justify-end pr-2">
                Giornata
              </div>
              {weekDays.map((day, i) => {
                const items = getItemsForDay(day);
                const allDayItems = items.filter(item => getItemHour(item) === null);
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={i}
                    className={`border-l min-h-[28px] px-0.5 py-0.5 space-y-0.5 cursor-pointer hover:bg-muted/40 transition-colors ${isToday ? 'bg-primary/5' : ''}`}
                    onClick={() => openCreateForSlot(day)}
                  >
                    {allDayItems.map(item => renderItemPill(item))}
                  </div>
                );
              })}
            </div>

            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[50px_repeat(7,1fr)] border-b last:border-b-0">
                <div className="text-[10px] text-muted-foreground px-1 py-1 flex items-start justify-end pr-2 tabular-nums">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {weekDays.map((day, i) => {
                  const items = getItemsForDay(day);
                  const hourItems = items.filter(item => {
                    const h = getItemHour(item);
                    return h !== null && h === hour;
                  });
                  const isToday = isSameDay(day, new Date());
                  const isNowHour = isToday && new Date().getHours() === hour;
                  return (
                    <div
                      key={i}
                      className={`border-l min-h-[36px] px-0.5 py-0.5 space-y-0.5 cursor-pointer hover:bg-muted/30 transition-colors relative ${isToday ? 'bg-primary/[0.02]' : ''} ${isNowHour ? 'bg-primary/5' : ''}`}
                      onClick={() => openCreateForSlot(day, hour)}
                    >
                      {isNowHour && (
                        <div className="absolute left-0 right-0 border-t-2 border-primary z-10" style={{ top: `${(new Date().getMinutes() / 60) * 100}%` }} />
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
              <Label htmlFor="title">Titolo *</Label>
              <Input id="title" value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} placeholder="Titolo evento" />
            </div>
            <div>
              <Label htmlFor="description">Descrizione</Label>
              <Textarea id="description" value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} placeholder="Descrizione evento" rows={3} />
            </div>
            <div>
              <Label htmlFor="event_type">Tipo</Label>
              <Select value={newEvent.event_type} onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value })}>
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
              <Label htmlFor="color">Colore</Label>
              <Select value={newEvent.color} onValueChange={(value) => setNewEvent({ ...newEvent, color: value })}>
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
            <div className="flex items-center space-x-2">
              <input type="checkbox" id="all_day" checked={newEvent.all_day} onChange={(e) => setNewEvent({ ...newEvent, all_day: e.target.checked })} className="rounded" />
              <Label htmlFor="all_day">Tutto il giorno</Label>
            </div>
            {!newEvent.all_day && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Ora inizio</Label>
                  <Input id="start_time" type="time" value={newEvent.start_time} onChange={(e) => setNewEvent({ ...newEvent, start_time: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="end_time">Ora fine</Label>
                  <Input id="end_time" type="time" value={newEvent.end_time} onChange={(e) => setNewEvent({ ...newEvent, end_time: e.target.value })} />
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
            <div className="space-y-4">
              {selectedItem.description && (
                <div>
                  <h4 className="font-medium mb-1">Descrizione</h4>
                  <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                </div>
              )}
              {selectedItem.item_type === 'task' && (
                <>
                  <div><h4 className="font-medium mb-1">Categoria</h4><p className="text-sm text-muted-foreground capitalize">{(selectedItem as Task).category}</p></div>
                  <div><h4 className="font-medium mb-1">Priorità</h4><Badge className={priorityColors[(selectedItem as Task).priority as keyof typeof priorityColors]}>{priorityLabels[(selectedItem as Task).priority as keyof typeof priorityLabels]}</Badge></div>
                  {(selectedItem as Task).due_date && (
                    <div><h4 className="font-medium mb-1">Scadenza</h4><p className="text-sm text-muted-foreground">{format(parseISO((selectedItem as Task).due_date!), "PPP 'alle' HH:mm", { locale: it })}</p></div>
                  )}
                </>
              )}
              {selectedItem.item_type === 'ticket' && (
                <>
                  <div><h4 className="font-medium mb-1">Numero</h4><p className="text-sm text-muted-foreground">{(selectedItem as Ticket).number}</p></div>
                  <div><h4 className="font-medium mb-1">Cliente</h4><p className="text-sm text-muted-foreground">{(selectedItem as Ticket).customer_name}</p></div>
                  <div><h4 className="font-medium mb-1">Priorità</h4><Badge className="text-sm">{(selectedItem as Ticket).priority === 'low' ? 'Bassa' : (selectedItem as Ticket).priority === 'medium' ? 'Media' : 'Alta'}</Badge></div>
                  <div><h4 className="font-medium mb-1">Data di Gestione</h4><p className="text-sm text-muted-foreground">{format(parseISO((selectedItem as Ticket).scheduled_date), "PPP 'alle' HH:mm", { locale: it })}</p></div>
                </>
              )}
              {selectedItem.item_type === 'event' && (
                <>
                  <div><h4 className="font-medium mb-1">Tipo</h4><p className="text-sm text-muted-foreground capitalize">{(selectedItem as CalendarEvent).event_type}</p></div>
                  <div><h4 className="font-medium mb-1">Data e Ora</h4><p className="text-sm text-muted-foreground">
                    {(selectedItem as CalendarEvent).all_day ? format(parseISO((selectedItem as CalendarEvent).event_date), "PPP", { locale: it }) : format(parseISO((selectedItem as CalendarEvent).event_date), "PPP 'alle' HH:mm", { locale: it })}
                    {(selectedItem as CalendarEvent).end_date && !(selectedItem as CalendarEvent).all_day && (<> - {format(parseISO((selectedItem as CalendarEvent).end_date!), "HH:mm")}</>)}
                  </p></div>
                </>
              )}
              {selectedItem.item_type === 'recurring' && (
                <>
                  <div><h4 className="font-medium mb-1">Categoria</h4><p className="text-sm text-muted-foreground capitalize">{(selectedItem as RecurringTask).category}</p></div>
                  <div><h4 className="font-medium mb-1">Stato</h4><Badge variant={(selectedItem as RecurringTask).completed ? "default" : "outline"}>{(selectedItem as RecurringTask).completed ? 'Completata' : 'Da fare'}</Badge></div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
