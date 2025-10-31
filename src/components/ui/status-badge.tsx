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
  
  // Work Order statuses - New Italian states
  da_fare: "bg-muted text-muted-foreground", // Grigio
  in_lavorazione: "bg-amber-500 text-white", // Giallo
  in_test: "bg-orange-500 text-white", // Arancione
  pronto: "bg-blue-500 text-white", // Blu
  completato: "bg-success text-success-foreground", // Verde
  standby: "bg-purple-500 text-white", // Viola
  bloccato: "bg-destructive text-destructive-foreground", // Rosso
  
  // Legacy statuses (keep for backwards compatibility)
  to_do: "bg-muted text-muted-foreground",
  test: "bg-orange-500 text-white",
  pronti: "bg-blue-500 text-white",
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
  qualified: "bg-primary text-primary-foreground",
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
    da_fare: "Da Fare",
    in_lavorazione: "In Lavorazione",
    in_test: "In Test",
    pronto: "Pronto",
    completato: "Completato",
    standby: "Standby",
    bloccato: "Bloccato",
    // Legacy labels
    to_do: "Da Fare",
    test: "In Test",
    pronti: "Pronto",
    spediti_consegnati: "Completato",
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