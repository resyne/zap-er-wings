import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, startOfWeek, endOfWeek } from "date-fns";
import { it } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  start_date?: string;
  status: string;
  priority: string;
  category: string;
  parent_task_id?: string;
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

type CalendarItem = (Task & { item_type: 'task' }) | (CalendarEvent & { item_type: 'event' });

const priorityColors = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800"
};

export default function CalendarioPersonale() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Load regular tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .gte('due_date', monthStart.toISOString())
        .lte('due_date', monthEnd.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) throw tasksError;

      // Load recurring tasks that fall in the current month
      const { data: recurringTasksData, error: recurringError } = await supabase
        .from('tasks')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('is_template', false)
        .not('parent_task_id', 'is', null)
        .gte('start_date', monthStart.toISOString())
        .lte('start_date', monthEnd.toISOString());

      if (recurringError) throw recurringError;

      // Combine regular and recurring tasks
      const allTasks = [...(tasksData || []), ...(recurringTasksData || [])];

      // Load calendar events
      const { data: eventsData, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('user_id', user.id)
        .gte('event_date', monthStart.toISOString())
        .lte('event_date', monthEnd.toISOString());

      if (eventsError) throw eventsError;

      setTasks(allTasks);
      setEvents(eventsData || []);
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
        // Check if task has due_date or start_date
        const taskDate = task.due_date ? parseISO(task.due_date) : (task.start_date ? parseISO(task.start_date) : null);
        if (!taskDate) return false;
        return isSameDay(taskDate, day);
      })
      .map(task => ({ ...task, item_type: 'task' as const }));

    const dayEvents = events
      .filter(event => {
        const eventDate = parseISO(event.event_date);
        return isSameDay(eventDate, day);
      })
      .map(event => ({ ...event, item_type: 'event' as const }));

    return [...dayTasks, ...dayEvents];
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

  const handleDeleteEvent = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from('calendar_events')
        .delete()
        .eq('id', eventId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Evento eliminato con successo",
      });

      setShowDetailsDialog(false);
      setSelectedItem(null);
      loadData();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione dell'evento",
        variant: "destructive",
      });
    }
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Calendario Personale</h1>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[200px] text-center">
            {format(currentMonth, "MMMM yyyy", { locale: it })}
          </div>
          <Button variant="outline" size="sm" onClick={goToNextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={goToToday}>
            Oggi
          </Button>
          <Button size="sm" onClick={() => {
            setSelectedDate(new Date());
            setShowCreateDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Evento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {/* Header giorni settimana */}
            {weekDays.map((day) => (
              <div key={day} className="text-center font-semibold text-sm py-2">
                {day}
              </div>
            ))}

            {/* Giorni del mese */}
            {calendarDays.map((day, index) => {
              const dayItems = getItemsForDay(day);
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              
              return (
                <Card 
                  key={index} 
                  className={`min-h-[120px] ${isToday ? 'ring-2 ring-primary' : ''} ${!isCurrentMonth ? 'opacity-50' : ''}`}
                >
                  <CardHeader className="p-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className={`text-sm ${isToday ? 'text-primary font-bold' : ''}`}>
                        {format(day, "d")}
                      </CardTitle>
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
                  <CardContent className="p-2 space-y-1">
                    {dayItems.slice(0, 3).map((item) => {
                      const isTask = item.item_type === 'task';
                      
                      return (
                        <div
                          key={item.id}
                          className={`text-xs p-1 rounded cursor-pointer hover:bg-muted/50 transition-colors truncate ${
                            isTask ? 'bg-primary/10 text-primary' : `bg-${item.color}-100 text-${item.color}-800`
                          }`}
                          onClick={() => {
                            setSelectedItem(item);
                            setShowDetailsDialog(true);
                          }}
                        >
                          {item.title}
                        </div>
                      );
                    })}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayItems.length - 3} altri
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedItem?.title}</DialogTitle>
            <DialogDescription>
              {selectedItem?.item_type === 'task' ? 'Task' : 'Evento'}
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
              
              {selectedItem.item_type === 'event' && (
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
                      {(selectedItem as CalendarEvent).end_date && !(selectedItem as CalendarEvent).all_day && (
                        <> - {format(parseISO((selectedItem as CalendarEvent).end_date), "HH:mm")}</>
                      )}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {selectedItem?.item_type === 'event' && (
            <DialogFooter>
              <Button 
                variant="destructive" 
                onClick={() => handleDeleteEvent(selectedItem.id)}
              >
                Elimina Evento
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
