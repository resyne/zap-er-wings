import { useEffect, useState } from "react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { TaskCard } from "./TaskCard";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Database } from "@/integrations/supabase/types";

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Database['public']['Enums']['task_status'];
type TaskCategory = Database['public']['Enums']['task_category'];

interface Task extends TaskRow {
  is_recurring?: boolean;
  recurring_day?: number;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface TaskKanbanProps {
  category: TaskCategory;
  archived?: boolean;
}

const statusConfig = {
  todo: { 
    title: 'Da fare', 
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-900'
  },
  in_progress: { 
    title: 'In corso', 
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-900'
  },
  review: { 
    title: 'In revisione', 
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    textColor: 'text-orange-900'
  },
  completed: { 
    title: 'Completato', 
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-900'
  },
  cancelled: { 
    title: 'Annullato', 
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-900'
  }
};

export function TaskKanban({ category, archived = false }: TaskKanbanProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, [category, archived]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      
      // Fetch regular tasks
      const { data: regularTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .eq('category', category)
        .eq('archived', archived)
        .eq('is_template', false)
        .is('parent_task_id', null)
        .order('created_at', { ascending: false });

      if (tasksError) throw tasksError;
      
      // Get unique user IDs from tasks
      const userIds = [...new Set(regularTasks?.filter(t => t.assigned_to).map(t => t.assigned_to))] as string[];
      
      // Fetch profiles for assigned users
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .in('id', userIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {} as Record<string, any>);
        }
      }
      
      // Merge profiles with tasks
      const tasksWithProfiles = regularTasks?.map(task => ({
        ...task,
        profiles: task.assigned_to ? profilesMap[task.assigned_to] : undefined
      }));

      setTasks(tasksWithProfiles || []);
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

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId as TaskStatus;
    
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', draggableId);

      if (error) throw error;

      setTasks(prevTasks =>
        prevTasks.map(task =>
          task.id === draggableId
            ? { 
                ...task, 
                status: newStatus,
                completed_at: newStatus === 'completed' ? new Date().toISOString() : null
              }
            : task
        )
      );

      toast({
        title: "Task aggiornato",
        description: "Lo stato del task è stato modificato",
      });
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato del task",
        variant: "destructive",
      });
    }
  };

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter(task => task.status === status);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {Object.keys(statusConfig).map((status) => (
          <div key={status} className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((status) => {
            const config = statusConfig[status];
            const statusTasks = getTasksByStatus(status);

            return (
              <div key={status} className="flex flex-col">
                <div className={`p-4 rounded-t-lg border-2 ${config.borderColor} ${config.bgColor}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-bold text-xl ${config.textColor}`}>
                      {config.title}
                    </h3>
                    <span className={`text-lg font-bold ${config.textColor} bg-white px-3 py-1 rounded-full`}>
                      {statusTasks.length}
                    </span>
                  </div>
                  {status === 'todo' && !archived && category && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-full ${config.textColor} hover:bg-white/50 font-bold`}
                      onClick={() => setIsCreateDialogOpen(true)}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Nuova Task
                    </Button>
                  )}
                </div>

                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 p-4 border-2 border-t-0 rounded-b-lg ${config.borderColor} ${config.bgColor} min-h-[600px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-opacity-80' : ''
                      }`}
                    >
                      <div className="space-y-4">
                        {statusTasks.map((task, index) => (
                          <Draggable
                            key={task.id}
                            draggableId={task.id}
                            index={index}
                            isDragDisabled={task.is_recurring || archived}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={snapshot.isDragging ? 'opacity-80' : ''}
                              >
                                <TaskCard task={task} onUpdate={fetchTasks} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {category && (
        <CreateTaskDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onTaskAdded={fetchTasks}
          defaultCategory={category}
        />
      )}
    </>
  );
}
