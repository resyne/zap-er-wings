import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: "default" | "success" | "warning" | "error" | "info";
  className?: string;
}

const statusColors = {
  // Quote statuses
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info text-info-foreground",
  accepted: "bg-success text-success-foreground", 
  rejected: "bg-destructive text-destructive-foreground",
  expired: "bg-warning text-warning-foreground",
  
  // Order statuses
  confirmed: "bg-success text-success-foreground",
  in_production: "bg-info text-info-foreground",
  shipped: "bg-warning text-warning-foreground", 
  delivered: "bg-success text-success-foreground",
  
  // Work Order statuses  
  planned: "bg-muted text-muted-foreground",
  new: "bg-info text-info-foreground",
  scheduled: "bg-warning text-warning-foreground",
  in_progress: "bg-primary text-primary-foreground",
  testing: "bg-warning text-warning-foreground",
  completed: "bg-success text-success-foreground",
  closed: "bg-muted text-muted-foreground",
  billable: "bg-warning text-warning-foreground",
  
  // Lead statuses
  contacted: "bg-info text-info-foreground",
  qualified: "bg-warning text-warning-foreground",
  proposal: "bg-primary text-primary-foreground",
  negotiation: "bg-warning text-warning-foreground",
  won: "bg-success text-success-foreground",
  lost: "bg-destructive text-destructive-foreground",
  
  // General statuses
  active: "bg-success text-success-foreground",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-warning text-warning-foreground",
  
  // Priority levels
  low: "bg-muted text-muted-foreground", 
  medium: "bg-warning text-warning-foreground",
  high: "bg-destructive text-destructive-foreground",
  urgent: "bg-destructive text-destructive-foreground animate-pulse",
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  const colorClass = statusColors[normalizedStatus as keyof typeof statusColors] || statusColors.pending;
  
  return (
    <Badge 
      className={cn(
        colorClass,
        "text-xs font-medium",
        className
      )}
    >
      {status.replace(/_/g, ' ').toUpperCase()}
    </Badge>
  );
}