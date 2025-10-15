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
  expired: "bg-muted text-muted-foreground",
  
  // Order statuses
  confirmed: "bg-success text-success-foreground",
  in_production: "bg-info text-info-foreground",
  shipped: "bg-success text-success-foreground", 
  delivered: "bg-success text-success-foreground",
  
  // Work Order statuses - Italian states
  to_do: "bg-muted text-muted-foreground",
  in_lavorazione: "bg-primary text-primary-foreground",
  test: "bg-info text-info-foreground",
  pronti: "bg-success text-success-foreground",
  spediti_consegnati: "bg-success text-success-foreground",
  
  // Work Order statuses - English  
  planned: "bg-muted text-muted-foreground",
  new: "bg-info text-info-foreground",
  scheduled: "bg-info text-info-foreground",
  in_progress: "bg-primary text-primary-foreground",
  testing: "bg-info text-info-foreground",
  completed: "bg-success text-success-foreground",
  closed: "bg-success text-success-foreground",
  billable: "bg-primary text-primary-foreground",
  
  // Lead statuses
  contacted: "bg-info text-info-foreground",
  qualified: "bg-primary text-primary-foreground",
  proposal: "bg-primary text-primary-foreground",
  negotiation: "bg-info text-info-foreground",
  won: "bg-success text-success-foreground",
  lost: "bg-destructive text-destructive-foreground",
  
  // General statuses
  active: "bg-success text-success-foreground",
  inactive: "bg-muted text-muted-foreground",
  pending: "bg-info text-info-foreground",
  
  // Priority levels
  low: "bg-muted text-muted-foreground", 
  medium: "bg-primary text-primary-foreground",
  high: "bg-destructive text-destructive-foreground",
  urgent: "bg-destructive text-destructive-foreground animate-pulse",
};

export function StatusBadge({ status, variant, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase().replace(/\s+/g, '_');
  const colorClass = statusColors[normalizedStatus as keyof typeof statusColors] || statusColors.pending;
  
  // Mappa stati italiani a etichette leggibili
  const statusLabels: Record<string, string> = {
    to_do: "Da Fare",
    in_lavorazione: "In Lavorazione",
    test: "Testing",
    pronti: "Pronti",
    spediti_consegnati: "Spediti/Consegnati",
    planned: "Pianificato",
    in_progress: "In Corso",
    testing: "Testing",
    completed: "Completato",
    closed: "Chiuso",
  };
  
  const displayLabel = statusLabels[normalizedStatus] || status.replace(/_/g, ' ');
  
  return (
    <Badge 
      className={cn(
        colorClass,
        "text-xs font-medium",
        className
      )}
    >
      {displayLabel.toUpperCase()}
    </Badge>
  );
}