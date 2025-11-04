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

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'completed' | 'review' | 'cancelled';
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
  archived?: boolean;
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

const priorityColors = {
  low: 'bg-success/20 text-success border-success/30',
  medium: 'bg-warning/20 text-warning border-warning/30',
  high: 'bg-destructive/20 text-destructive border-destructive/30',
  urgent: 'bg-destructive/30 text-destructive border-destructive/40'
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
        className={`cursor-pointer hover:shadow-md transition-shadow bg-card border ${
          task.is_recurring ? 'border-l-4 border-l-blue-500' : ''
        }`}
        onClick={() => !task.is_recurring && setIsDetailsDialogOpen(true)}
      >
        <CardHeader className="p-4 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {task.is_recurring && (
                <RotateCcw className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              )}
              <h4 className="font-semibold text-base leading-tight line-clamp-2 text-card-foreground">
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
                    <MoreHorizontal className="h-3 w-3" />
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
                    className="text-destructive"
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    Elimina
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          
          {task.description && (
            <p className="text-sm line-clamp-2 mt-2 text-card-foreground/80">
              {task.description}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="px-4 pb-4 pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={`text-sm font-medium ${priorityColors[task.priority]}`}
            >
              {priorityLabels[task.priority]}
            </Badge>
            
            {task.estimated_hours && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{task.estimated_hours}h</span>
              </div>
            )}
          </div>

          {task.is_recurring && (
            <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
              <RotateCcw className="h-4 w-4" />
              <span>Task ricorrente settimanale</span>
            </div>
          )}

          {!task.is_recurring && task.due_date && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{format(new Date(task.due_date), 'dd MMM', { locale: it })}</span>
            </div>
          )}

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {task.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-sm px-2 py-0.5">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="secondary" className="text-sm px-2 py-0.5">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {assignedUser && (
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={`https://avatar.vercel.sh/${assignedUser.email}`} />
                <AvatarFallback className="text-sm">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-card-foreground truncate">
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
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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