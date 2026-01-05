import { useState } from "react";
import { Search, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MobileWorkOrderCard } from "./MobileWorkOrderCard";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  created_at: string;
  planned_start_date?: string;
  planned_end_date?: string;
  priority?: string;
  archived?: boolean;
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

interface StatusConfig {
  key: string;
  label: string;
  color: string;
}

const statusOptions: StatusConfig[] = [
  { key: 'active', label: 'Attivi', color: 'bg-primary' },
  { key: 'da_fare', label: 'Da Fare', color: 'bg-muted' },
  { key: 'in_lavorazione', label: 'In Lav.', color: 'bg-amber-500' },
  { key: 'in_test', label: 'Test', color: 'bg-orange-500' },
  { key: 'pronto', label: 'Pronto', color: 'bg-blue-500' },
  { key: 'completato', label: 'Fatto', color: 'bg-green-500' },
  { key: 'standby', label: 'Standby', color: 'bg-purple-500' },
  { key: 'bloccato', label: 'Bloccato', color: 'bg-destructive' },
];

interface MobileWorkOrderListProps {
  workOrders: WorkOrder[];
  onViewDetails: (workOrder: WorkOrder) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  statusCounts: Record<string, number>;
}

export function MobileWorkOrderList({
  workOrders,
  onViewDetails,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  statusCounts,
}: MobileWorkOrderListProps) {
  const [showSearch, setShowSearch] = useState(false);

  // Group by status for quick overview
  const groupedByStatus = statusOptions.reduce((acc, status) => {
    acc[status.key] = workOrders.filter(wo => {
      if (status.key === 'active') return !wo.archived;
      return wo.status === status.key && !wo.archived;
    });
    return acc;
  }, {} as Record<string, WorkOrder[]>);

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with search and filters */}
      <div className="sticky top-0 z-10 bg-background border-b pb-3 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca ordine, cliente..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Horizontal scrollable status pills */}
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 pb-1">
            {statusOptions.map((status) => {
              const count = statusCounts[status.key] || 0;
              const isActive = statusFilter === status.key;
              
              return (
                <Button
                  key={status.key}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`shrink-0 h-8 px-3 gap-1.5 ${isActive ? '' : 'bg-background'}`}
                  onClick={() => onStatusFilterChange(status.key)}
                >
                  <span className={`w-2 h-2 rounded-full ${status.color}`} />
                  <span>{status.label}</span>
                  <Badge 
                    variant="secondary" 
                    className={`ml-1 px-1.5 py-0 text-[10px] ${isActive ? 'bg-background/20 text-primary-foreground' : ''}`}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Work orders list */}
      <div className="flex-1 overflow-auto py-3">
        <div className="space-y-2">
          {workOrders.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nessuna commessa trovata</p>
            </div>
          ) : (
            workOrders.map((workOrder) => (
              <MobileWorkOrderCard
                key={workOrder.id}
                workOrder={workOrder}
                onPress={() => onViewDetails(workOrder)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
