import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, CheckSquare } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadMyTasks();
  }, [currentWeek]);

  const loadMyTasks = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          status,
          priority,
          category
        `)
        .eq('assigned_to', user.id)
        .gte('due_date', weekStart.toISOString())
        .lte('due_date', weekEnd.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (error) throw error;

      setTasks(data || []);
    } catch (error) {
      console.error('Error loading my tasks:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle tue task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTasksForDay = (day: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      const taskDate = parseISO(task.due_date);
      return isSameDay(taskDate, day);
    });
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
          const dayTasks = getTasksForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={index} className={`min-h-[250px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-2">
                <CardTitle className={`text-xs ${isToday ? 'text-primary' : ''}`}>
                  {format(day, "EEE", { locale: it })}
                </CardTitle>
                <CardDescription className={`text-base font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {format(day, "d MMM", { locale: it })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {dayTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    Nessuna task
                  </p>
                ) : (
                  dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="p-2 border rounded cursor-pointer hover:bg-muted/50 transition-colors border-l-2 border-l-primary"
                      onClick={() => {
                        setSelectedTask(task);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <div className="space-y-1">
                        <div className="font-medium text-xs leading-tight line-clamp-2">
                          {task.title}
                        </div>
                        <Badge className={priorityColors[task.priority as keyof typeof priorityColors] + " text-[10px] h-4"}>
                          {priorityLabels[task.priority as keyof typeof priorityLabels]}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-primary" />
              {selectedTask?.title}
            </DialogTitle>
            <DialogDescription>Dettagli Task</DialogDescription>
          </DialogHeader>
          
          {selectedTask && (
            <div className="space-y-4">
              {selectedTask.description && (
                <div>
                  <h4 className="font-medium mb-1">Descrizione</h4>
                  <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-1">Categoria</h4>
                <p className="text-sm text-muted-foreground capitalize">{selectedTask.category}</p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Priorità</h4>
                <Badge className={priorityColors[selectedTask.priority as keyof typeof priorityColors]}>
                  {priorityLabels[selectedTask.priority as keyof typeof priorityLabels]}
                </Badge>
              </div>
              
              <div>
                <h4 className="font-medium mb-1">Stato</h4>
                <Badge className={statusColors[selectedTask.status as keyof typeof statusColors]}>
                  {statusLabels[selectedTask.status as keyof typeof statusLabels]}
                </Badge>
              </div>
              
              {selectedTask.due_date && (
                <div>
                  <h4 className="font-medium mb-1">Scadenza</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(selectedTask.due_date), "PPP 'alle' HH:mm", { locale: it })}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
