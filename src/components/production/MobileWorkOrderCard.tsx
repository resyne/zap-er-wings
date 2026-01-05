import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Calendar, User, Package, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  created_at: string;
  planned_start_date?: string;
  planned_end_date?: string;
  priority?: string;
  customers?: {
    name: string;
    code: string;
    company_name?: string;
  };
  technician?: {
    first_name: string;
    last_name: string;
  };
  sales_orders?: {
    number: string;
    order_date?: string;
  };
  work_order_article_items?: Array<{
    id: string;
    description: string;
    is_completed: boolean;
  }>;
}

interface MobileWorkOrderCardProps {
  workOrder: WorkOrder;
  onPress: () => void;
}

export function MobileWorkOrderCard({ workOrder, onPress }: MobileWorkOrderCardProps) {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-destructive text-destructive-foreground';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return 'Media';
    }
  };

  const displayDate = workOrder.sales_orders?.order_date 
    ? format(new Date(workOrder.sales_orders.order_date), 'dd MMM', { locale: it })
    : workOrder.created_at 
      ? format(new Date(workOrder.created_at), 'dd MMM', { locale: it })
      : null;

  const completedItems = workOrder.work_order_article_items?.filter(i => i.is_completed).length || 0;
  const totalItems = workOrder.work_order_article_items?.length || 0;

  return (
    <Card 
      className="active:scale-[0.98] transition-transform cursor-pointer border-l-4"
      style={{ 
        borderLeftColor: workOrder.priority === 'urgent' ? 'hsl(var(--destructive))' : 
                         workOrder.priority === 'high' ? '#f97316' : 
                         workOrder.priority === 'medium' ? '#f59e0b' : 
                         'hsl(var(--muted))' 
      }}
      onClick={onPress}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header: Order number & Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {workOrder.sales_orders?.number || workOrder.number}
              </span>
              <StatusBadge status={workOrder.status} />
            </div>

            {/* Customer name */}
            {workOrder.customers && (
              <p className="text-sm font-medium truncate">
                {workOrder.customers.company_name || workOrder.customers.name}
              </p>
            )}

            {/* Meta info row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {displayDate && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>{displayDate}</span>
                </div>
              )}
              {workOrder.technician && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span className="truncate max-w-[80px]">
                    {workOrder.technician.first_name}
                  </span>
                </div>
              )}
              {totalItems > 0 && (
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  <span>{completedItems}/{totalItems}</span>
                </div>
              )}
            </div>

            {/* Articles preview */}
            {workOrder.work_order_article_items && workOrder.work_order_article_items.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {workOrder.work_order_article_items.slice(0, 2).map((item) => (
                  <Badge 
                    key={item.id} 
                    variant={item.is_completed ? "default" : "outline"} 
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.description.length > 20 ? item.description.slice(0, 20) + '...' : item.description}
                  </Badge>
                ))}
                {workOrder.work_order_article_items.length > 2 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    +{workOrder.work_order_article_items.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Right side: Priority badge & arrow */}
          <div className="flex flex-col items-end gap-2">
            <Badge className={`${getPriorityColor(workOrder.priority)} text-[10px] px-1.5`}>
              {getPriorityLabel(workOrder.priority)}
            </Badge>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
