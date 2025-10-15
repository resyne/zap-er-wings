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

type CalendarItem = (Task & { item_type: 'task' }) | (CalendarEvent & { item_type: 'event' }) | (Ticket & { item_type: 'ticket' });

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

export function WeeklyCalendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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

      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .gte('due_date', weekStart.toISOString())
        .lte('due_date', weekEnd.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) throw tasksError;

      // Load calendar events
      const { data: eventsData, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', weekStart.toISOString())
        .lte('event_date', weekEnd.toISOString());

      if (eventsError) throw eventsError;

      // Load tickets with scheduled date
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('tickets')
        .select('*')
        .eq('assigned_to', user.id)
        .not('scheduled_date', 'is', null)
        .gte('scheduled_date', weekStart.toISOString())
        .lte('scheduled_date', weekEnd.toISOString());

      if (ticketsError) throw ticketsError;

      setTasks(tasksData || []);
      setEvents(eventsData || []);
      setTickets(ticketsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getItemsForDay = (day: Date): CalendarItem[] => {
    const dayTasks = tasks
      .filter(task => {
        if (!task.due_date) return false;
        const taskDate = parseISO(task.due_date);
        return isSameDay(taskDate, day);
      })
      .map(task => ({ ...task, item_type: 'task' as const }));

    const dayEvents = events
      .filter(event => {
        const eventDate = parseISO(event.event_date);
        return isSameDay(eventDate, day);
      })
      .map(event => ({ ...event, item_type: 'event' as const }));

    const dayTickets = tickets
      .filter(ticket => {
        const ticketDate = parseISO(ticket.scheduled_date);
        return isSameDay(ticketDate, day);
      })
      .map(ticket => ({ ...ticket, item_type: 'ticket' as const }));

    return [...dayTasks, ...dayEvents, ...dayTickets];
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
        event_type: "personal",
        color: "blue",
        all_day: false,
        start_time: "09:00",
        end_time: "10:00"
      });
      loadData();
    } catch (error) {
      console.error('Error creating event:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'evento",
        variant: "destructive",
      });
    }
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Calendario Settimanale</h2>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold">
            {format(weekStart, "d MMM", { locale: it })} - {format(weekEnd, "d MMM yyyy", { locale: it })}
          </div>
          <Button variant="outline" size="sm" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={goToToday}>
            <Calendar className="w-4 h-4 mr-2" />
            Oggi
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {weekDays.map((day, index) => {
          const dayItems = getItemsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={index} className={`min-h-[250px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className={`text-xs ${isToday ? 'text-primary' : ''}`}>
                      {format(day, "EEE", { locale: it })}
                    </CardTitle>
                    <CardDescription className={`text-base font-semibold ${isToday ? 'text-primary' : ''}`}>
                      {format(day, "d MMM", { locale: it })}
                    </CardDescription>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6"
                    onClick={() => {
                      setSelectedDate(day);
                      setShowCreateDialog(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {dayItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nessuna attività
                  </p>
                ) : (
                  dayItems.map((item) => {
                    const isTask = item.item_type === 'task';
                    const isTicket = item.item_type === 'ticket';
                    const borderColor = isTask ? 'border-l-primary' : isTicket ? 'border-l-orange-400' : `border-l-${item.color}-400`;
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-2 border rounded cursor-pointer hover:bg-muted/50 transition-colors border-l-2 ${borderColor}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <div className="space-y-1">
                          <div className="font-medium text-xs leading-tight line-clamp-2">
                            {item.title}
                          </div>
                          {isTask ? (
                            <Badge className={priorityColors[(item as Task).priority as keyof typeof priorityColors] + " text-[10px] h-4"}>
                              {priorityLabels[(item as Task).priority as keyof typeof priorityLabels]}
                            </Badge>
                          ) : isTicket ? (
                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Badge variant="outline" className="text-[10px] h-4">Ticket</Badge>
                              {format(parseISO((item as Ticket).scheduled_date), "HH:mm")}
                            </div>
                          ) : (
                            <div className="text-[10px] text-muted-foreground">
                              {!(item as CalendarEvent).all_day && format(parseISO((item as CalendarEvent).event_date), "HH:mm")}
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
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
              <CheckSquare className="w-5 h-5 text-primary" />
              {selectedItem?.title}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.item_type === 'task' ? 'Task' : selectedItem?.item_type === 'ticket' ? 'Ticket' : 'Evento'}
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
              
              {selectedItem.item_type === 'task' ? (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Categoria</h4>
                    <p className="text-sm text-muted-foreground capitalize">{(selectedItem as Task).category}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Priorità</h4>
                    <Badge className={priorityColors[(selectedItem as Task).priority as keyof typeof priorityColors]}>
                      {priorityLabels[(selectedItem as Task).priority as keyof typeof priorityLabels]}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge className={statusColors[(selectedItem as Task).status as keyof typeof statusColors]}>
                      {statusLabels[(selectedItem as Task).status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                  
                  {(selectedItem as Task).due_date && (
                    <div>
                      <h4 className="font-medium mb-1">Scadenza</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO((selectedItem as Task).due_date), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              ) : selectedItem.item_type === 'ticket' ? (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Numero</h4>
                    <p className="text-sm text-muted-foreground">{(selectedItem as Ticket).number}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Cliente</h4>
                    <p className="text-sm text-muted-foreground">{(selectedItem as Ticket).customer_name}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge className="text-sm">
                      {(selectedItem as Ticket).status === 'open' ? 'Aperto' :
                       (selectedItem as Ticket).status === 'in_progress' ? 'In Lavorazione' :
                       (selectedItem as Ticket).status === 'resolved' ? 'Risolto' : 'Chiuso'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Priorità</h4>
                    <Badge className="text-sm">
                      {(selectedItem as Ticket).priority === 'low' ? 'Bassa' :
                       (selectedItem as Ticket).priority === 'medium' ? 'Media' : 'Alta'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Data di Gestione</h4>
                    <p className="text-sm text-muted-foreground">
                      {format(parseISO((selectedItem as Ticket).scheduled_date), "PPP 'alle' HH:mm", { locale: it })}
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Tipo</h4>
                    <p className="text-sm text-muted-foreground capitalize">{(selectedItem as CalendarEvent).event_type}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Data e Ora</h4>
                    <p className="text-sm text-muted-foreground">
                      {(selectedItem as CalendarEvent).all_day 
                        ? format(parseISO((selectedItem as CalendarEvent).event_date), "PPP", { locale: it })
                        : format(parseISO((selectedItem as CalendarEvent).event_date), "PPP 'alle' HH:mm", { locale: it })
                      }
                      {(selectedItem as CalendarEvent).end_date && !( selectedItem as CalendarEvent).all_day && (
                        <> - {format(parseISO((selectedItem as CalendarEvent).end_date), "HH:mm")}</>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
