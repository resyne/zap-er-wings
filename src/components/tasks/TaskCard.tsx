import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { MoreHorizontal, Edit, Trash, CalendarDays, Clock } from "lucide-react";
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
  low: 'bg-green-100 text-green-800 border-green-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  high: 'bg-red-100 text-red-800 border-red-200',
  urgent: 'bg-red-200 text-red-900 border-red-300'
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
        className="cursor-pointer hover:shadow-md transition-shadow bg-card border"
        onClick={() => setIsDetailsDialogOpen(true)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <h4 className="font-medium text-sm leading-tight line-clamp-2">
              {task.title}
            </h4>
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
          </div>
          
          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {task.description}
            </p>
          )}
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3">
          <div className="flex items-center justify-between">
            <Badge 
              variant="outline" 
              className={`text-xs ${priorityColors[task.priority]}`}
            >
              {priorityLabels[task.priority]}
            </Badge>
            
            {task.estimated_hours && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {task.estimated_hours}h
              </div>
            )}
          </div>

          {task.due_date && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.due_date), 'dd MMM', { locale: it })}
            </div>
          )}

          {task.tags && task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {task.tags.slice(0, 2).map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                  {tag}
                </Badge>
              ))}
              {task.tags.length > 2 && (
                <Badge variant="secondary" className="text-xs px-1 py-0">
                  +{task.tags.length - 2}
                </Badge>
              )}
            </div>
          )}

          {assignedUser && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={`https://avatar.vercel.sh/${assignedUser.email}`} />
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {assignedUser.first_name} {assignedUser.last_name}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

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
  );
}