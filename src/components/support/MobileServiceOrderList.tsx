import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { MobileServiceOrderCard } from "./MobileServiceOrderCard";

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

interface StatusConfig {
  key: string;
  label: string;
  color: string;
}

const statusOptions: StatusConfig[] = [
  { key: 'all', label: 'Tutte', color: 'bg-primary' },
  { key: 'da_fare', label: 'Da Fare', color: 'bg-blue-500' },
  { key: 'stand_by', label: 'Stand By', color: 'bg-yellow-500' },
  { key: 'completata', label: 'Compl.', color: 'bg-green-500' },
];

interface MobileServiceOrderListProps {
  workOrders: ServiceWorkOrder[];
  onViewDetails: (workOrder: ServiceWorkOrder) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  searchTerm: string;
  onSearchChange: (search: string) => void;
  statusCounts: Record<string, number>;
}

export function MobileServiceOrderList({
  workOrders,
  onViewDetails,
  statusFilter,
  onStatusFilterChange,
  searchTerm,
  onSearchChange,
  statusCounts,
}: MobileServiceOrderListProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Sticky header with search and filters */}
      <div className="sticky top-0 z-10 bg-background border-b pb-3 space-y-3">
        {/* Search bar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca commessa..."
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
              const count = status.key === 'all' ? statusCounts.all || workOrders.length : (statusCounts[status.key] || 0);
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
              <MobileServiceOrderCard
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
