import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, Calendar, Clock, User, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
  is_recurring?: boolean;
  recurring_day?: number;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface TaskKanbanProps {
  category: string;
}

const statusConfig = {
  todo: {
    title: 'Da fare',
    color: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-200'
  },
  in_progress: {
    title: 'In corso',
    color: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-200'
  },
  review: {
    title: 'In revisione',
    color: 'bg-yellow-100',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-200'
  },
  completed: {
    title: 'Completato',
    color: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-200'
  },
  cancelled: {
    title: 'Annullato',
    color: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-200'
  }
};

export function TaskKanban({ category }: TaskKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recurringTasks, setRecurringTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDialogStatus, setCreateDialogStatus] = useState<'todo' | 'in_progress' | 'review' | 'completed' | 'cancelled'>('todo');
  const { toast } = useToast();

  useEffect(() => {
    console.log('Category changed to:', category);
    setTasks([]); // Clear existing tasks first
    setLoading(true);
    fetchTasks();
  }, [category]);

  const fetchTasks = async () => {
    try {
      console.log('Fetching tasks for category:', category);
      
      // Fetch regular tasks
      const { data: regularTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('category', category as any)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;

      // Fetch recurring tasks
      const { data: recurringData, error: recurringError } = await supabase
        .from('recurring_tasks')
        .select(`
          *,
          tasks!recurring_tasks_task_template_id_fkey (
            id,
            title,
            description,
            category,
            estimated_hours,
            priority,
            tags
          )
        `)
        .eq('recurrence_type', 'weekly')
        .eq('is_active', true);

      if (recurringError) throw recurringError;

      // Transform recurring tasks for display
      const weekDays = [
        { value: 1, label: 'Lunedì', short: 'Lun' },
        { value: 2, label: 'Martedì', short: 'Mar' },
        { value: 3, label: 'Mercoledì', short: 'Mer' },
        { value: 4, label: 'Giovedì', short: 'Gio' },
        { value: 5, label: 'Venerdì', short: 'Ven' }
      ];

      // Filter by category and transform recurring tasks
      const transformedRecurring = recurringData?.filter(item => item.tasks?.category === category)
        .map(item => {
          const day = item.recurrence_days?.[0] || 1;
          const dayInfo = weekDays.find(d => d.value === day);
          
          return {
            id: `recurring-${item.id}`,
            title: `🔄 ${item.tasks?.title || ''} (${dayInfo?.short})`,
            description: item.tasks?.description || '',
            status: 'todo' as const,
            priority: item.tasks?.priority || 'medium',
            category: item.tasks?.category,
            estimated_hours: item.tasks?.estimated_hours,
            tags: item.tasks?.tags || [],
            created_at: item.created_at,
            updated_at: item.updated_at,
            is_recurring: true,
            recurring_day: day
          };
        }) || [];

      console.log('Fetched tasks:', regularTasks);
      console.log('Fetched recurring tasks:', transformedRecurring);
      
      setTasks((regularTasks || []) as Task[]);
      setRecurringTasks(transformedRecurring as Task[]);
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

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as Task['status'];
    
    try {
      const updateData: any = { 
        status: newStatus,
        updated_at: new Date().toISOString()
      };

      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', draggableId);

      if (error) throw error;

      // Update local state
      setTasks(prev => prev.map(task => 
        task.id === draggableId 
          ? { ...task, status: newStatus, ...(newStatus === 'completed' ? { completed_at: new Date().toISOString() } : {}) }
          : task
      ));

      toast({
        title: "Task aggiornato",
        description: `Task spostato in "${statusConfig[newStatus].title}"`,
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il task",
        variant: "destructive",
      });
    }
  };

  const handleTaskAdded = () => {
    fetchTasks();
    setIsCreateDialogOpen(false);
  };

  const handleTaskUpdated = () => {
    fetchTasks();
  };

  const getTasksByStatus = (status: Task['status']) => {
    const regularTasks = tasks.filter(task => task.status === status);
    const recurring = status === 'todo' ? recurringTasks : [];
    return [...regularTasks, ...recurring];
  };

  if (loading) {
    return (
      <div className="grid grid-cols-5 gap-4">
        {Object.keys(statusConfig).map((status) => (
          <Card key={status} className="min-h-[400px]">
            <CardHeader>
              <div className="h-4 bg-muted rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-muted rounded animate-pulse" />
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-5 gap-4">
          {Object.entries(statusConfig).map(([status, config]) => {
            const statusTasks = getTasksByStatus(status as Task['status']);
            
            return (
              <Card key={status} className={`${config.borderColor}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-sm">
                    <span className={config.textColor}>{config.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {statusTasks.length}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          setCreateDialogStatus(status as Task['status']);
                          setIsCreateDialogOpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <Droppable droppableId={status}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-3 min-h-[300px] rounded-lg p-2 transition-colors ${
                          snapshot.isDraggingOver ? config.color : ''
                        }`}
                      >
                        {statusTasks.map((task, index) => (
                          <div key={task.id} className="space-y-3">
                            {task.is_recurring ? (
                              // Recurring tasks are not draggable
                              <div className="opacity-75">
                                <TaskCard task={task} onUpdate={handleTaskUpdated} />
                              </div>
                            ) : (
                              <Draggable draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`${snapshot.isDragging ? 'rotate-2' : ''}`}
                                  >
                                    <TaskCard task={task} onUpdate={handleTaskUpdated} />
                                  </div>
                                )}
                              </Draggable>
                            )}
                          </div>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DragDropContext>

      <CreateTaskDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        defaultCategory={category as any}
        defaultStatus={createDialogStatus}
        onTaskAdded={handleTaskAdded}
      />
    </div>
  );
}