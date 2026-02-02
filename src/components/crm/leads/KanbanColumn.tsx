import { memo, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";
import { Lead } from "@/hooks/useLeads";
import { LeadCard } from "./LeadCard";

interface KanbanColumnProps {
  status: {
    id: string;
    title: string;
    color: string;
  };
  leads: Lead[];
  offers: { id: string; number: string; status: string; lead_id?: string }[];
  hideAmounts?: boolean;
  onOpenDetails: (lead: Lead) => void;
  onEdit: (lead: Lead) => void;
  onArchive: (leadId: string, archive: boolean) => void;
  onDelete: (leadId: string) => void;
  onCreateOffer: (lead: Lead) => void;
  formatAmount: (value: number) => string;
  isMobile?: boolean;
}

function KanbanColumnComponent({
  status,
  leads,
  offers,
  hideAmounts = false,
  onOpenDetails,
  onEdit,
  onArchive,
  onDelete,
  onCreateOffer,
  formatAmount,
  isMobile = false,
}: KanbanColumnProps) {
  // Memoize the offers lookup for this column's leads
  const offersByLeadId = useMemo(() => {
    const map = new Map<string, { id: string; number: string; status: string }[]>();
    for (const offer of offers) {
      if (offer.lead_id) {
        const existing = map.get(offer.lead_id) || [];
        existing.push({ id: offer.id, number: offer.number, status: offer.status });
        map.set(offer.lead_id, existing);
      }
    }
    return map;
  }, [offers]);

  // Calculate total value for column
  const totalValue = useMemo(() => {
    return leads.reduce((sum, lead) => sum + (lead.value || 0), 0);
  }, [leads]);

  return (
    <Card className={cn(
      "flex-shrink-0 flex flex-col",
      isMobile ? "w-[280px]" : "w-[300px]",
      "max-h-[calc(100vh-280px)]"
    )}>
      <CardHeader className="py-3 px-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-medium">{status.title}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {leads.length}
            </Badge>
          </div>
          {totalValue > 0 && !hideAmounts && (
            <span className="text-xs text-muted-foreground font-medium">
              € {formatAmount(totalValue)}
            </span>
          )}
        </div>
      </CardHeader>

      <Droppable droppableId={status.id}>
        {(provided, snapshot) => (
          <CardContent
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex-1 p-2 overflow-y-auto min-h-[200px]",
              snapshot.isDraggingOver && "bg-primary/5"
            )}
          >
            {leads.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
                Nessun lead
              </div>
            ) : (
              leads.map((lead, index) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  index={index}
                  hideAmounts={hideAmounts}
                  onOpenDetails={onOpenDetails}
                  onEdit={onEdit}
                  onArchive={onArchive}
                  onDelete={onDelete}
                  onCreateOffer={onCreateOffer}
                  formatAmount={formatAmount}
                  linkedOffers={offersByLeadId.get(lead.id)}
                />
              ))
            )}
            {provided.placeholder}
          </CardContent>
        )}
      </Droppable>
    </Card>
  );
}

export const KanbanColumn = memo(KanbanColumnComponent);
