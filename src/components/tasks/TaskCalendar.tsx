import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths } from "date-fns";
import { it } from "date-fns/locale";
import { TaskCard } from "./TaskCard";
import { CreateTaskDialog } from "./CreateTaskDialog";

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  assigned_to?: string;
  created_by?: string;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  estimated_hours?: number;
  actual_hours?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface TaskCalendarProps {
  category: string;
}

export function TaskCalendar({ category }: TaskCalendarProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, [category, currentMonth]);

  const fetchTasks = async () => {
    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('category', category as any)
        .or(`due_date.gte.${startDate.toISOString()},due_date.lte.${endDate.toISOString()}`)
        .order('due_date', { ascending: true });

      if (error) {
        throw error;
      }

      setTasks((data || []) as Task[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskAdded = () => {
    fetchTasks();
    setIsCreateDialogOpen(false);
  };

  const handleTaskUpdated = () => {
    fetchTasks();
  };

  const getTasksForDate = (date: Date) => {
    return tasks.filter(task => {
      if (!task.due_date) return false;
      return isSameDay(new Date(task.due_date), date);
    });
  };

  const getTasksForSelectedDate = () => {
    return getTasksForDate(selectedDate);
  };

  const hasTasksOnDate = (date: Date) => {
    return getTasksForDate(date).length > 0;
  };

  const modifiers = {
    hasTasks: (date: Date) => hasTasksOnDate(date)
  };

  const modifiersStyles = {
    hasTasks: {
      fontWeight: 'bold',
      backgroundColor: 'hsl(var(--primary))',
      color: 'hsl(var(--primary-foreground))',
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-96">
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-64 bg-muted rounded animate-pulse" />
            </CardContent>
          </Card>
        </div>
        <div>
          <Card>
            <CardHeader>
              <div className="h-6 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {format(currentMonth, 'MMMM yyyy', { locale: it })}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const today = new Date();
                      setCurrentMonth(today);
                      setSelectedDate(today);
                    }}
                  >
                    Oggi
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                month={currentMonth}
                onMonthChange={setCurrentMonth}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                locale={it}
                className="rounded-md border"
              />
            </CardContent>
          </Card>
        </div>

        {/* Tasks for selected date */}
        <div>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(selectedDate, 'dd MMMM yyyy', { locale: it })}
                </CardTitle>
                <Button
                  size="sm"
                  onClick={() => setIsCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {getTasksForSelectedDate().length} task
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {getTasksForSelectedDate().length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nessun task per questa data
                </p>
              ) : (
                getTasksForSelectedDate().map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={handleTaskUpdated}
                  />
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultCategory={category as any}
        defaultDueDate={selectedDate}
        onTaskAdded={handleTaskAdded}
      />
    </div>
  );
}