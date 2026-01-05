import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, ChevronRight, MapPin } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  customer_id?: string;
  contact_id?: string;
  assigned_to?: string;
  priority?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  location?: string;
  equipment_needed?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  article?: string;
  archived?: boolean;
  customers?: {
    name: string;
    code: string;
  };
  crm_contacts?: {
    first_name: string;
    last_name: string;
    company_name?: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

interface MobileServiceOrderCardProps {
  workOrder: ServiceWorkOrder;
  onPress: () => void;
}

const statusColors = {
  da_programmare: "bg-blue-100 text-blue-800",
  programmata: "bg-yellow-100 text-yellow-800",
  completata: "bg-green-100 text-green-800"
};

const statusLabels = {
  da_programmare: "Da Prog.",
  programmata: "Progr.",
  completata: "Compl."
};

export function MobileServiceOrderCard({ workOrder, onPress }: MobileServiceOrderCardProps) {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-muted';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return '-';
    }
  };

  return (
    <Card 
      className="cursor-pointer hover:shadow-md transition-shadow active:scale-[0.99]"
      onClick={onPress}
      style={{ borderLeftWidth: '4px', borderLeftColor: getPriorityColor(workOrder.priority).replace('bg-', 'var(--') !== getPriorityColor(workOrder.priority) ? undefined : workOrder.priority === 'urgent' ? '#ef4444' : workOrder.priority === 'high' ? '#f97316' : workOrder.priority === 'medium' ? '#eab308' : workOrder.priority === 'low' ? '#22c55e' : '#9ca3af' }}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Header: Number + Status */}
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-primary">{workOrder.number}</span>
              <Badge className={`${statusColors[workOrder.status as keyof typeof statusColors] || 'bg-muted'} text-[10px] px-1.5 py-0`}>
                {statusLabels[workOrder.status as keyof typeof statusLabels] || workOrder.status}
              </Badge>
            </div>
            
            {/* Title */}
            <p className="font-medium text-sm line-clamp-1 mb-1.5">{workOrder.title}</p>
            
            {/* Customer */}
            {workOrder.customers && (
              <p className="text-xs text-muted-foreground truncate mb-1.5">
                {workOrder.customers.name}
              </p>
            )}
            
            {/* Meta info row */}
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
              {workOrder.scheduled_date && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(workOrder.scheduled_date), "dd/MM", { locale: it })}</span>
                </div>
              )}
              {workOrder.technician && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>{workOrder.technician.first_name} {workOrder.technician.last_name.charAt(0)}.</span>
                </div>
              )}
              {workOrder.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{workOrder.location}</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Right side: Priority + Chevron */}
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {getPriorityLabel(workOrder.priority)}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
