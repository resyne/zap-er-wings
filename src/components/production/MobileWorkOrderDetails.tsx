import { useState } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { 
  ArrowLeft, 
  Calendar, 
  User, 
  Building2, 
  FileText, 
  Package, 
  MessageSquare,
  MoreVertical,
  Download,
  Edit,
  Trash2,
  Archive,
  UserPlus,
  ChevronDown,
  Phone,
  MapPin,
  ExternalLink
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { WorkOrderArticles } from "./WorkOrderArticles";
import { WorkOrderComments } from "./WorkOrderComments";
import { WorkOrderActivityLog } from "./WorkOrderActivityLog";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { Skeleton } from "@/components/ui/skeleton";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  created_at: string;
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  priority?: string;
  notes?: string;
  lead_id?: string;
  customers?: {
    name: string;
    code: string;
    company_name?: string;
    address?: string;
    city?: string;
    phone?: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  sales_orders?: {
    number: string;
    order_date?: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
  offers?: {
    number: string;
  };
  work_order_article_items?: Array<{
    id: string;
    description: string;
    is_completed: boolean;
    position: number;
  }>;
}

interface MobileWorkOrderDetailsProps {
  workOrder: WorkOrder;
  onClose: () => void;
  onStatusChange: (workOrderId: string, newStatus: string) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  onTakeOwnership: () => void;
  onDownloadReport: () => void;
  leadPhotos?: Array<{ url: string; name: string; type: string }>;
  loadingPhotos?: boolean;
}

export function MobileWorkOrderDetails({
  workOrder,
  onClose,
  onStatusChange,
  onEdit,
  onDelete,
  onArchive,
  onTakeOwnership,
  onDownloadReport,
  leadPhotos = [],
  loadingPhotos = false,
}: MobileWorkOrderDetailsProps) {
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);
  const [showActions, setShowActions] = useState(false);
  const [activeTab, setActiveTab] = useState("info");

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

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy, HH:mm', { locale: it });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center justify-between p-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="font-semibold text-sm">{workOrder.number}</h1>
          </div>
          <Sheet open={showActions} onOpenChange={setShowActions}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto">
              <SheetHeader>
                <SheetTitle>Azioni</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-2 gap-2 py-4">
                <Button variant="outline" className="justify-start gap-2" onClick={() => { onEdit(); setShowActions(false); }}>
                  <Edit className="h-4 w-4" />
                  Modifica
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={() => { onDownloadReport(); setShowActions(false); }}>
                  <Download className="h-4 w-4" />
                  Scarica PDF
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={() => { onTakeOwnership(); setShowActions(false); }}>
                  <UserPlus className="h-4 w-4" />
                  Assegna a me
                </Button>
                <Button variant="outline" className="justify-start gap-2" onClick={() => { onArchive(); setShowActions(false); }}>
                  <Archive className="h-4 w-4" />
                  Archivia
                </Button>
                <Button variant="outline" className="justify-start gap-2 text-destructive" onClick={() => { onDelete(); setShowActions(false); }}>
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Status & Priority quick info */}
        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-2">
            <StatusBadge status={workOrder.status} />
            <Badge className={getPriorityColor(workOrder.priority)}>
              {getPriorityLabel(workOrder.priority)}
            </Badge>
          </div>
          <Select 
            value={workOrder.status} 
            onValueChange={(value) => onStatusChange(workOrder.id, value)}
          >
            <SelectTrigger className="w-auto h-8 text-xs">
              <SelectValue placeholder="Cambia stato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="da_fare">Da Fare</SelectItem>
              <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
              <SelectItem value="in_test">In Test</SelectItem>
              <SelectItem value="pronto">Pronto</SelectItem>
              <SelectItem value="completato">Completato</SelectItem>
              <SelectItem value="standby">Standby</SelectItem>
              <SelectItem value="bloccato">Bloccato</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-3 pb-2">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="articles" className="text-xs">Articoli</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs">Note</TabsTrigger>
            <TabsTrigger value="history" className="text-xs">Storico</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          {activeTab === "info" && (
            <div className="space-y-3">
              {/* Customer info card */}
              {workOrder.customers && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Cliente
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="font-medium">
                      {workOrder.customers.company_name || workOrder.customers.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {workOrder.customers.code}
                    </p>
                    {workOrder.customers.phone && (
                      <a 
                        href={`tel:${workOrder.customers.phone}`}
                        className="flex items-center gap-2 text-sm text-primary"
                      >
                        <Phone className="h-3 w-3" />
                        {workOrder.customers.phone}
                      </a>
                    )}
                    {(workOrder.customers.address || workOrder.customers.city) && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {[workOrder.customers.address, workOrder.customers.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Dates */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Inizio pianificato</p>
                      <p className="font-medium">{formatDate(workOrder.planned_start_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Fine pianificata</p>
                      <p className="font-medium">{formatDate(workOrder.planned_end_date)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Assignment */}
              {workOrder.technician && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Assegnato a
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">
                      {workOrder.technician.first_name} {workOrder.technician.last_name}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Links */}
              {(workOrder.sales_orders || workOrder.leads || workOrder.offers) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Collegamenti
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {workOrder.sales_orders && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Ordine vendita</span>
                        <Badge variant="outline">{workOrder.sales_orders.number}</Badge>
                      </div>
                    )}
                    {workOrder.leads && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Lead</span>
                        <Link to={`/crm/leads?id=${workOrder.leads.id}`}>
                          <Badge variant="outline" className="cursor-pointer hover:bg-accent">
                            {workOrder.leads.company_name}
                          </Badge>
                        </Link>
                      </div>
                    )}
                    {workOrder.offers && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Offerta</span>
                        <Badge variant="outline">{workOrder.offers.number}</Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Notes */}
              {workOrder.notes && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{workOrder.notes}</p>
                  </CardContent>
                </Card>
              )}

              {/* Lead Photos */}
              {(leadPhotos.length > 0 || loadingPhotos) && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Foto cliente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {loadingPhotos ? (
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3].map((i) => (
                          <Skeleton key={i} className="aspect-square rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {leadPhotos.map((photo, index) => {
                          const isVideo = photo.type?.startsWith('video/') || 
                            /\.(mp4|mov|avi|webm|mkv)$/i.test(photo.name);
                          return (
                            <div
                              key={index}
                              className="aspect-square rounded-lg overflow-hidden cursor-pointer relative"
                              onClick={() => setSelectedMedia({ url: photo.url, name: photo.name, isVideo })}
                            >
                              {isVideo ? (
                                <video
                                  src={photo.url}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <img
                                  src={photo.url}
                                  alt={photo.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "articles" && (
            <WorkOrderArticles workOrderId={workOrder.id} articleText="" />
          )}

          {activeTab === "comments" && (
            <WorkOrderComments workOrderId={workOrder.id} />
          )}

          {activeTab === "history" && (
            <WorkOrderActivityLog workOrderId={workOrder.id} />
          )}
        </div>
      </ScrollArea>

      {/* Media Preview Modal */}
      {selectedMedia && (
        <MediaPreviewModal
          open={!!selectedMedia}
          onOpenChange={(open) => !open && setSelectedMedia(null)}
          url={selectedMedia.url}
          name={selectedMedia.name}
          isVideo={selectedMedia.isVideo}
        />
      )}
    </div>
  );
}
