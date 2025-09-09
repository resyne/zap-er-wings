import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, Clock, User, Tag, FileText } from "lucide-react";
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

interface TaskDetailsDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig = {
  todo: { title: 'Da fare', color: 'bg-gray-100 text-gray-800', border: 'border-gray-200' },
  in_progress: { title: 'In corso', color: 'bg-blue-100 text-blue-800', border: 'border-blue-200' },
  completed: { title: 'Completato', color: 'bg-green-100 text-green-800', border: 'border-green-200' },
  review: { title: 'In revisione', color: 'bg-purple-100 text-purple-800', border: 'border-purple-200' },
  cancelled: { title: 'Annullato', color: 'bg-red-100 text-red-800', border: 'border-red-200' },
};

const priorityConfig = {
  low: { title: 'Bassa', color: 'bg-green-100 text-green-800' },
  medium: { title: 'Media', color: 'bg-yellow-100 text-yellow-800' },
  high: { title: 'Alta', color: 'bg-red-100 text-red-800' },
  urgent: { title: 'Urgente', color: 'bg-red-200 text-red-900' },
};

const categoryConfig: Record<string, { title: string; color: string }> = {
  amministrazione: { title: 'Amministrazione', color: 'bg-purple-100 text-purple-800' },
  back_office: { title: 'Back Office', color: 'bg-blue-100 text-blue-800' },
  ricerca_sviluppo: { title: 'Ricerca e Sviluppo', color: 'bg-orange-100 text-orange-800' },
};

export function TaskDetailsDialog({ task, open, onOpenChange }: TaskDetailsDialogProps) {
  if (!task) return null;

  const assignedUser = task.profiles;
  const statusInfo = statusConfig[task.status];
  const priorityInfo = priorityConfig[task.priority];
  const categoryInfo = categoryConfig[task.category] || { title: task.category, color: 'bg-gray-100 text-gray-800' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{task.title}</DialogTitle>
          <DialogDescription>
            Dettagli del task
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Status, Priority, Category */}
          <div className="flex flex-wrap gap-2">
            <Badge className={statusInfo.color}>
              {statusInfo.title}
            </Badge>
            <Badge className={priorityInfo.color}>
              Priorità: {priorityInfo.title}
            </Badge>
            <Badge className={categoryInfo.color}>
              {categoryInfo.title}
            </Badge>
          </div>

          {/* Description */}
          {task.description && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <FileText className="h-4 w-4" />
                Descrizione
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {/* Assigned User */}
          {assignedUser && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <User className="h-4 w-4" />
                Assegnato a
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={`https://avatar.vercel.sh/${assignedUser.email}`} />
                  <AvatarFallback className="text-xs">
                    {assignedUser.first_name?.[0]}{assignedUser.last_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm">
                  {assignedUser.first_name} {assignedUser.last_name}
                </span>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {task.start_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Data inizio
                </div>
                <p className="text-sm">
                  {format(new Date(task.start_date), 'dd MMMM yyyy', { locale: it })}
                </p>
              </div>
            )}
            
            {task.due_date && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  Scadenza
                </div>
                <p className={`text-sm ${
                  new Date(task.due_date) < new Date() && task.status !== 'completed'
                    ? 'text-red-600 font-medium'
                    : ''
                }`}>
                  {format(new Date(task.due_date), 'dd MMMM yyyy', { locale: it })}
                </p>
              </div>
            )}
          </div>

          {/* Hours */}
          {(task.estimated_hours || task.actual_hours) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock className="h-4 w-4" />
                Ore
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {task.estimated_hours && (
                  <div>
                    <p className="text-xs text-muted-foreground">Stimate</p>
                    <p className="text-sm">{task.estimated_hours}h</p>
                  </div>
                )}
                {task.actual_hours && (
                  <div>
                    <p className="text-xs text-muted-foreground">Effettive</p>
                    <p className="text-sm">{task.actual_hours}h</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Tag className="h-4 w-4" />
                Tag
              </div>
              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Completion Date */}
          {task.completed_at && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Completato il
              </div>
              <p className="text-sm">
                {format(new Date(task.completed_at), 'dd MMMM yyyy HH:mm', { locale: it })}
              </p>
            </div>
          )}

          {/* Timestamps */}
          <div className="pt-4 border-t space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium">Creato il</p>
                <p>{format(new Date(task.created_at), 'dd/MM/yyyy HH:mm', { locale: it })}</p>
              </div>
              <div>
                <p className="font-medium">Modificato il</p>
                <p>{format(new Date(task.updated_at), 'dd/MM/yyyy HH:mm', { locale: it })}</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}