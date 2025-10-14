import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Clock, Trash2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { startOfWeek, endOfWeek, format } from "date-fns";
import { it } from "date-fns/locale";

type TaskCategory = 'amministrazione' | 'back_office' | 'ricerca_sviluppo' | 'tecnico';

interface WeeklyRecurringTasksProps {
  category: TaskCategory;
}

interface RecurringTask {
  id: string;
  title: string;
  description?: string;
  category: TaskCategory;
  day: number;
  estimated_hours?: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  is_active: boolean;
  completed?: boolean;
  completion_id?: string;
}

const weekDays = [
  { value: 1, label: 'Lunedì', short: 'Lun' },
  { value: 2, label: 'Martedì', short: 'Mar' },
  { value: 3, label: 'Mercoledì', short: 'Mer' },
  { value: 4, label: 'Giovedì', short: 'Gio' },
  { value: 5, label: 'Venerdì', short: 'Ven' }
];

export function WeeklyRecurringTasks({ category }: WeeklyRecurringTasksProps) {
  const [tasks, setTasks] = useState<RecurringTask[]>([]);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Calculate current week
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    day: 0, // Single day
    estimated_hours: '',
    priority: 'medium' as const
  });

  useEffect(() => {
    fetchRecurringTasks();
  }, [category]);

  const fetchRecurringTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch recurring tasks with their template tasks and completions for current week
      const { data, error } = await supabase
        .from('recurring_tasks')
        .select(`
          *,
          tasks!recurring_tasks_task_template_id_fkey (
            id,
            title,
            description,
            category,
            estimated_hours,
            priority
          )
        `)
        .eq('recurrence_type', 'weekly')
        .eq('is_active', true);

      if (error) throw error;

      // Fetch completions for this week
      const { data: completions, error: completionsError } = await supabase
        .from('recurring_task_completions')
        .select('*')
        .gte('week_start', format(weekStart, 'yyyy-MM-dd'))
        .lte('week_end', format(weekEnd, 'yyyy-MM-dd'));

      if (completionsError) throw completionsError;

      // Create a map of completions by recurring_task_id
      const completionsMap = new Map(
        completions?.map(c => [c.recurring_task_id, c]) || []
      );

      // Filter by category and map the data with completion status
      const recurringTasks = data?.filter(item => item.tasks?.category === category)
        .map(item => {
          const completion = completionsMap.get(item.id);
          return {
            id: item.id,
            title: item.tasks?.title || '',
            description: item.tasks?.description || '',
            category: item.tasks?.category as TaskCategory,
            day: item.recurrence_days?.[0] || 1,
            estimated_hours: item.tasks?.estimated_hours,
            priority: item.tasks?.priority || 'medium',
            is_active: item.is_active,
            completed: completion?.completed || false,
            completion_id: completion?.id
          };
        }) || [];

      setTasks(recurringTasks);
    } catch (error) {
      console.error('Error fetching recurring tasks:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le task ricorrenti",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const selectDay = (day: number) => {
    setNewTask(prev => ({
      ...prev,
      day: day
    }));
  };

  const handleSubmit = async () => {
    if (!newTask.title.trim() || newTask.day === 0) {
      toast({
        title: "Errore",
        description: "Inserisci un titolo e seleziona un giorno",
        variant: "destructive"
      });
      return;
    }

    try {
      // First create the template task
      const { data: templateTask, error: taskError } = await supabase
        .from('tasks')
        .insert({
          title: newTask.title,
          description: newTask.description || null,
          category,
          estimated_hours: newTask.estimated_hours ? parseFloat(newTask.estimated_hours) : null,
          priority: newTask.priority,
          status: 'todo'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      // Then create the recurring task configuration
      const { error: recurringError } = await supabase
        .from('recurring_tasks')
        .insert({
          task_template_id: templateTask.id,
          recurrence_type: 'weekly',
          recurrence_interval: 1,
          recurrence_days: [newTask.day], // Single day in array
          is_active: true
        });

      if (recurringError) throw recurringError;

      toast({
        title: "Successo",
        description: "Task ricorrente creata con successo"
      });

      // Reset form
      setNewTask({
        title: '',
        description: '',
        day: 0,
        estimated_hours: '',
        priority: 'medium'
      });
      setIsAddingTask(false);
      
      // Refresh the list
      fetchRecurringTasks();
    } catch (error) {
      console.error('Error creating recurring task:', error);
      toast({
        title: "Errore",
        description: "Impossibile creare la task ricorrente",
        variant: "destructive"
      });
    }
  };

  const toggleCompletion = async (task: RecurringTask) => {
    if (!user) return;

    try {
      if (task.completed && task.completion_id) {
        // Mark as incomplete
        const { error } = await supabase
          .from('recurring_task_completions')
          .update({ 
            completed: false,
            completed_at: null,
            completed_by: null
          })
          .eq('id', task.completion_id);

        if (error) throw error;
      } else if (task.completion_id) {
        // Mark existing record as complete
        const { error } = await supabase
          .from('recurring_task_completions')
          .update({ 
            completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id
          })
          .eq('id', task.completion_id);

        if (error) throw error;
      } else {
        // Create new completion record
        const { error } = await supabase
          .from('recurring_task_completions')
          .insert({
            recurring_task_id: task.id,
            week_start: format(weekStart, 'yyyy-MM-dd'),
            week_end: format(weekEnd, 'yyyy-MM-dd'),
            completed: true,
            completed_at: new Date().toISOString(),
            completed_by: user.id
          });

        if (error) throw error;
      }

      toast({
        title: "Successo",
        description: task.completed ? "Task segnata come non completata" : "Task completata!"
      });

      fetchRecurringTasks();
    } catch (error) {
      console.error('Error toggling completion:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive"
      });
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('recurring_tasks')
        .update({ is_active: false })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Task ricorrente disattivata"
      });

      fetchRecurringTasks();
    } catch (error) {
      console.error('Error deleting recurring task:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare la task ricorrente",
        variant: "destructive"
      });
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Task Ricorrenti Settimanali
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Task Ricorrenti Settimanali
          </CardTitle>
          <Button 
            size="sm" 
            onClick={() => setIsAddingTask(true)}
            disabled={isAddingTask}
          >
            <Plus className="w-4 h-4 mr-2" />
            Aggiungi Task
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAddingTask && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
            <div className="space-y-2">
              <Input
                placeholder="Titolo della task..."
                value={newTask.title}
                onChange={(e) => setNewTask(prev => ({ ...prev, title: e.target.value }))}
              />
              <Textarea
                placeholder="Descrizione (opzionale)..."
                value={newTask.description}
                onChange={(e) => setNewTask(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Giorno della settimana:</label>
              <div className="flex gap-2">
                {weekDays.map(day => (
                  <Button
                    key={day.value}
                    variant={newTask.day === day.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectDay(day.value)}
                    className="flex-1"
                  >
                    {day.short}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Ore stimate:</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={newTask.estimated_hours}
                  onChange={(e) => setNewTask(prev => ({ ...prev, estimated_hours: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priorità:</label>
                <Select 
                  value={newTask.priority} 
                  onValueChange={(value: any) => setNewTask(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmit} size="sm">
                Salva
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsAddingTask(false)} 
                size="sm"
              >
                Annulla
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground mb-3">
            Settimana: {format(weekStart, 'dd MMM', { locale: it })} - {format(weekEnd, 'dd MMM yyyy', { locale: it })}
          </div>
          {tasks.map(task => (
            <div 
              key={task.id} 
              className={`flex items-center gap-3 p-3 border rounded-lg transition-all ${
                task.completed ? 'bg-green-50 border-green-200' : 'hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={task.completed}
                onCheckedChange={() => toggleCompletion(task)}
                className="h-5 w-5"
              />
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className={`font-medium ${task.completed ? 'line-through text-muted-foreground' : ''}`}>
                    {task.title}
                  </h4>
                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                  {task.completed && <Check className="w-4 h-4 text-green-600" />}
                </div>
                {task.description && (
                  <p className="text-sm text-muted-foreground">{task.description}</p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {weekDays.find(d => d.value === task.day)?.label}
                  </Badge>
                  {task.estimated_hours && (
                    <Badge variant="outline" className="text-xs">
                      {task.estimated_hours}h
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteTask(task.id)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          {tasks.length === 0 && !isAddingTask && (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Nessuna task ricorrente configurata</p>
              <p className="text-sm">Aggiungi una task che si ripete ogni settimana</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}