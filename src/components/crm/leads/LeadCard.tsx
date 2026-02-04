import { memo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Phone, Mail, Calendar, MoreVertical, Edit, Trash2, Archive, ArchiveRestore, Plus, MapPin, User, Flame, Settings2, CalendarPlus, Globe, Bot, UserPlus } from "lucide-react";
import { format, isAfter, isBefore, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { Draggable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { Lead } from "@/hooks/useLeads";

interface LeadCardProps {
  lead: Lead;
  index: number;
  hideAmounts?: boolean;
  onOpenDetails: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (leadId: string, archive: boolean) => void;
  onDelete: (leadId: string) => void;
  onCreateOffer: (lead: Lead) => void;
  formatAmount: (value: number) => string;
  linkedOffers?: { id: string; number: string; status: string }[];
}

const priorityConfig = {
  low: { color: "bg-blue-100 text-blue-800", label: "LOW" },
  mid: { color: "bg-orange-100 text-orange-800", label: "MID" },
  hot: { color: "bg-red-100 text-red-800", label: "HOT" },
};

function LeadCardComponent({
  lead,
  index,
  hideAmounts = false,
  onOpenDetails,
  onEdit,
  onArchive,
  onDelete,
  onCreateOffer,
  formatAmount,
  linkedOffers = [],
}: LeadCardProps) {
  const handleClick = useCallback(() => {
    onOpenDetails(lead);
  }, [lead, onOpenDetails]);

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit(lead);
  }, [lead, onEdit]);

  const handleArchive = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive(lead.id, !lead.archived);
  }, [lead, onArchive]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Sei sicuro di voler eliminare questo lead?")) {
      onDelete(lead.id);
    }
  }, [lead.id, onDelete]);

  const handleCreateOffer = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onCreateOffer(lead);
  }, [lead, onCreateOffer]);

  const priority = priorityConfig[lead.priority as keyof typeof priorityConfig] || priorityConfig.mid;

  // Check if next activity is overdue or upcoming
  const activityStatus = lead.next_activity_date
    ? isBefore(new Date(lead.next_activity_date), new Date())
      ? "overdue"
      : isBefore(new Date(lead.next_activity_date), addDays(new Date(), 3))
      ? "upcoming"
      : "future"
    : null;

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "mb-2",
            snapshot.isDragging && "opacity-70"
          )}
        >
          <Card 
            className={cn(
              "cursor-pointer hover:shadow-md transition-shadow border-l-4",
              lead.priority === "hot" && "border-l-red-500",
              lead.priority === "mid" && "border-l-orange-500",
              lead.priority === "low" && "border-l-blue-500",
              lead.archived && "opacity-60"
            )}
            onClick={handleClick}
          >
            <CardContent className="p-3 space-y-2">
              {/* Header: Title + Priority + Menu */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-medium text-sm truncate">{lead.company_name}</h4>
                    {lead.configurator_opened && (
                      <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200 px-1.5 py-0">
                        <Settings2 className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                  {lead.contact_name && (
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {lead.contact_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Badge variant="outline" className={cn("text-xs", priority.color)}>
                    {priority.label}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={handleEdit}>
                        <Edit className="h-3 w-3 mr-2" />
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleArchive}>
                        {lead.archived ? (
                          <>
                            <ArchiveRestore className="h-3 w-3 mr-2" />
                            Ripristina
                          </>
                        ) : (
                          <>
                            <Archive className="h-3 w-3 mr-2" />
                            Archivia
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                        <Trash2 className="h-3 w-3 mr-2" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Created date and source */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarPlus className="h-3 w-3" />
                  {format(new Date(lead.created_at), "dd/MM/yy", { locale: it })}
                </span>
                {lead.source && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {lead.source === 'facebook' || lead.source === 'website' || lead.source === 'social' ? (
                      <Globe className="h-3 w-3" />
                    ) : lead.source === 'zapier' || lead.source === 'automation' || lead.source === 'call' ? (
                      <Bot className="h-3 w-3" />
                    ) : (
                      <UserPlus className="h-3 w-3" />
                    )}
                    {lead.source}
                  </span>
                )}
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone.length > 15 ? lead.phone.slice(0, 15) + "..." : lead.phone}
                  </span>
                )}
                {lead.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {lead.city}
                  </span>
                )}
              </div>

              {/* Next activity */}
              {lead.next_activity_date && (
                <div className={cn(
                  "flex items-center gap-1 text-xs p-1.5 rounded",
                  activityStatus === "overdue" && "bg-red-50 text-red-700",
                  activityStatus === "upcoming" && "bg-orange-50 text-orange-700",
                  activityStatus === "future" && "bg-muted text-muted-foreground"
                )}>
                  <Calendar className="h-3 w-3" />
                  <span>{format(new Date(lead.next_activity_date), "dd/MM", { locale: it })}</span>
                  {activityStatus === "overdue" && <Flame className="h-3 w-3 text-red-500" />}
                </div>
              )}

              {/* Value */}
              {lead.value && !hideAmounts && (
                <div className="text-sm font-medium text-primary">
                  € {formatAmount(lead.value)}
                </div>
              )}

              {/* Linked offers */}
              {linkedOffers.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {linkedOffers.slice(0, 2).map(offer => (
                    <Badge key={offer.id} variant="secondary" className="text-xs">
                      {offer.number}
                    </Badge>
                  ))}
                  {linkedOffers.length > 2 && (
                    <Badge variant="secondary" className="text-xs">
                      +{linkedOffers.length - 2}
                    </Badge>
                  )}
                </div>
              )}

              {/* Quick action */}
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleCreateOffer}
              >
                <Plus className="h-3 w-3 mr-1" />
                Crea Offerta
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </Draggable>
  );
}

export const LeadCard = memo(LeadCardComponent);
