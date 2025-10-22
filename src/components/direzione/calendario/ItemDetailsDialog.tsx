import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CheckSquare, Wrench, Truck, Package, FileEdit, Phone, Mail, Users, StickyNote } from "lucide-react";
import { CalendarItem, statusColors, priorityColors, statusLabels, priorityLabels, activityTypeLabels } from "./types";

interface ItemDetailsDialogProps {
  item: CalendarItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ItemDetailsDialog = ({ item, open, onOpenChange }: ItemDetailsDialogProps) => {
  if (!item) return null;

  const getItemIcon = () => {
    switch (item.item_type) {
      case 'task': return <CheckSquare className="w-5 h-5" />;
      case 'work_order': return <Wrench className="w-5 h-5" />;
      case 'service_order': return <Wrench className="w-5 h-5" />;
      case 'shipping_order': return <Truck className="w-5 h-5" />;
      case 'event': return <FileEdit className="w-5 h-5" />;
      case 'lead_activity': {
        const actType = item.activity_type?.toLowerCase();
        if (actType === 'call') return <Phone className="w-5 h-5" />;
        if (actType === 'email') return <Mail className="w-5 h-5" />;
        if (actType === 'meeting') return <Users className="w-5 h-5" />;
        return <StickyNote className="w-5 h-5" />;
      }
      default: return <Package className="w-5 h-5" />;
    }
  };

  const getItemTitle = () => {
    switch (item.item_type) {
      case 'lead_activity': {
        const actType = activityTypeLabels[item.activity_type] || item.activity_type;
        const companyName = item.leads?.company_name || 'Lead sconosciuto';
        return `${actType} con ${companyName}`;
      }
      case 'task':
      case 'work_order':
      case 'service_order':
      case 'event':
        return item.title || `${item.item_type} - ${item.id.substring(0, 8)}`;
      case 'shipping_order':
        return `Commessa di spedizione ${item.number}`;
      default:
        return 'Elemento';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "PPP 'alle' HH:mm", { locale: it });
    } catch {
      return dateString;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {getItemIcon()}
            <DialogTitle>{getItemTitle()}</DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Task details */}
          {item.item_type === 'task' && (
            <>
              {item.description && (
                <div>
                  <h4 className="font-semibold mb-1">Descrizione</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Stato</h4>
                  <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                    {statusLabels[item.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Priorità</h4>
                  <Badge className={priorityColors[item.priority as keyof typeof priorityColors]}>
                    {priorityLabels[item.priority as keyof typeof priorityLabels]}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Categoria</h4>
                  <p className="text-sm">{item.category}</p>
                </div>
                {item.due_date && (
                  <div>
                    <h4 className="font-semibold mb-1">Scadenza</h4>
                    <p className="text-sm">{formatDate(item.due_date)}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Work Order details */}
          {item.item_type === 'work_order' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-1">Numero Ordine</h4>
                <p className="text-sm">{item.number}</p>
              </div>
              {item.title && (
                <div>
                  <h4 className="font-semibold mb-1">Titolo</h4>
                  <p className="text-sm">{item.title}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Stato</h4>
                  <Badge className={statusColors[item.status as keyof typeof statusColors]}>
                    {statusLabels[item.status as keyof typeof statusLabels] || item.status}
                  </Badge>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Tipo</h4>
                  <p className="text-sm">{item.type === 'production' ? 'Produzione' : 'Altro'}</p>
                </div>
                {item.scheduled_date && (
                  <div>
                    <h4 className="font-semibold mb-1">Data Pianificata</h4>
                    <p className="text-sm">{formatDate(item.scheduled_date)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Service Order details */}
          {item.item_type === 'service_order' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-1">Numero Ordine</h4>
                <p className="text-sm">{item.number}</p>
              </div>
              {item.title && (
                <div>
                  <h4 className="font-semibold mb-1">Titolo</h4>
                  <p className="text-sm">{item.title}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Stato</h4>
                  <Badge>{item.status}</Badge>
                </div>
                {item.scheduled_date && (
                  <div>
                    <h4 className="font-semibold mb-1">Data Pianificata</h4>
                    <p className="text-sm">{formatDate(item.scheduled_date)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Shipping Order details */}
          {item.item_type === 'shipping_order' && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold mb-1">Numero Ordine</h4>
                <p className="text-sm">{item.number}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Stato</h4>
                  <Badge>{item.status}</Badge>
                </div>
                {item.order_date && (
                  <div>
                    <h4 className="font-semibold mb-1">Data Ordine</h4>
                    <p className="text-sm">{formatDate(item.order_date)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Calendar Event details */}
          {item.item_type === 'event' && (
            <>
              {item.description && (
                <div>
                  <h4 className="font-semibold mb-1">Descrizione</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Tipo</h4>
                  <p className="text-sm">{item.event_type}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Data</h4>
                  <p className="text-sm">{formatDate(item.event_date)}</p>
                </div>
              </div>
            </>
          )}

          {/* Lead Activity details */}
          {item.item_type === 'lead_activity' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-1">Lead</h4>
                  <p className="text-sm font-medium">{item.leads?.company_name || 'N/A'}</p>
                  {item.leads?.contact_name && (
                    <p className="text-sm text-muted-foreground">{item.leads.contact_name}</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Assegnato a</h4>
                  {item.profiles ? (
                    <p className="text-sm">{`${item.profiles.first_name} ${item.profiles.last_name}`}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Non assegnato</p>
                  )}
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Tipo Attività</h4>
                  <p className="text-sm">{activityTypeLabels[item.activity_type] || item.activity_type}</p>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Stato</h4>
                  <Badge>{item.status || 'pending'}</Badge>
                </div>
                <div className="col-span-2">
                  <h4 className="font-semibold mb-1">Data e Ora</h4>
                  <p className="text-sm">{formatDate(item.activity_date)}</p>
                </div>
              </div>
              {item.notes && (
                <div>
                  <h4 className="font-semibold mb-1">Note</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
