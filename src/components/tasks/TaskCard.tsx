import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Trash, CalendarDays, Clock, RotateCcw, Archive } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { EditTaskDialog } from "./EditTaskDialog";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Database } from "@/integrations/supabase/types";

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskStatus = Database['public']['Enums']['task_status'];
type TaskPriority = Database['public']['Enums']['task_priority'];

interface Task extends TaskRow {
  is_recurring?: boolean;
  recurring_day?: number;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface TaskCardProps {
  task: Task;
  onUpdate: () => void;
}

const priorityStyles = {
  low: 'bg-green-100 text-green-800 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  urgent: 'bg-red-100 text-red-800 border-red-300'
};

const priorityLabels = {
  low: 'Bassa',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente'
};

export function TaskCard({ task, onUpdate }: TaskCardProps) {
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const handleArchive = async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ archived: !task.archived })
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: task.archived ? "Task ripristinata" : "Task archiviata",
        description: task.archived 
          ? "La task è stata ripristinata dall'archivio" 
          : "La task è stata archiviata con successo",
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error archiving task:', error);
      toast({
        title: "Errore",
        description: "Impossibile archiviare/ripristinare il task",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', task.id);

      if (error) throw error;

      toast({
        title: "Task eliminato",
        description: "Il task è stato eliminato con successo",
      });
      
      onUpdate();
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare il task",
        variant: "destructive",
      });
    }
  };

  const assignedUser = task.profiles;
  const userInitials = assignedUser 
    ? `${assignedUser.first_name?.[0] || ''}${assignedUser.last_name?.[0] || ''}`.toUpperCase()
    : 'U';

  return (
    <>
      <Card 
        className={`cursor-pointer hover:shadow-md transition-all bg-white border ${
          task.is_recurring ? 'border-l-4 border-l-blue-600' : 'border-gray-200'
        }`}
        onClick={() => !task.is_recurring && setIsDetailsDialogOpen(true)}
      >
        <CardHeader className="p-2 pb-1">
          <div className="flex items-start justify-between gap-1">
            <div className="flex items-start gap-1 flex-1 min-w-0">
              {task.is_recurring && (
                <RotateCcw className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
              )}
              <h4 className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">
                {task.title}
              </h4>
            </div>
            {!task.is_recurring && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-3 w-3 text-gray-600" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Modifica
                  </DropdownMenuItem>
                  {task.status === 'completed' && !task.archived && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive();
                      }}
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Archivia
                    </DropdownMenuItem>
                  )}
                  {task.archived && (
                    <DropdownMenuItem 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleArchive();
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Ripristina
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem 
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleteDialogOpen(true);
                    }}
                    className="text-red-600"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {task.description && (
            <p className="text-xs text-gray-600 line-clamp-1 mt-1">
              {task.description}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="px-2 pb-2 pt-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={`text-xs font-medium border ${priorityStyles[task.priority]} py-0`}
            >
              {priorityLabels[task.priority]}
            </Badge>
            
            {task.estimated_hours && (
              <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
                <Clock className="h-3 w-3" />
                <span>{task.estimated_hours}h</span>
              </div>
            )}
          </div>

          {task.is_recurring && (
            <div className="flex items-center gap-1 text-xs font-medium text-blue-600">
              <RotateCcw className="h-3 w-3" />
              <span>Ricorrente</span>
            </div>
          )}

          {!task.is_recurring && task.due_date && (
            <div className="flex items-center gap-1 text-xs text-gray-700 font-medium">
              <CalendarDays className="h-3 w-3" />
              <span>{format(new Date(task.due_date), 'dd MMM', { locale: it })}</span>
            </div>
          )}

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs px-1.5 py-0 font-medium bg-gray-200 text-gray-800">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0 font-medium bg-gray-200 text-gray-800">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {assignedUser && (
            <div className="flex items-center gap-1">
              <Avatar className="h-5 w-5">
                <AvatarImage src={`https://avatar.vercel.sh/${assignedUser.email}`} />
                <AvatarFallback className="text-xs font-medium bg-gray-300 text-gray-800">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-gray-900 truncate">
                {assignedUser.first_name} {assignedUser.last_name}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {!task.is_recurring && (
        <>
          <TaskDetailsDialog
            task={task}
            open={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            onTaskUpdated={onUpdate}
          />

          <EditTaskDialog
            task={task}
            open={isEditDialogOpen}
            onOpenChange={setIsEditDialogOpen}
            onTaskUpdated={onUpdate}
          />

          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                <AlertDialogDescription>
                  Sei sicuro di voler eliminare questo task? Questa azione non può essere annullata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 text-white hover:bg-red-700">
                  Elimina
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </>
  );
}
