import { useState } from "react";
import { 
  ArrowLeft, 
  MoreVertical, 
  Edit, 
  Archive, 
  Trash2, 
  Calendar, 
  User, 
  MapPin,
  Clock,
  Building2,
  FileText,
  ExternalLink,
  CalendarCheck,
  UserPlus,
  Image as ImageIcon,
  Factory
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Link } from "react-router-dom";

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
  production_work_order_id?: string;
  sales_order_id?: string;
  lead_id?: string;
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
  production_work_order?: {
    id: string;
    number: string;
    status: string;
  };
  sales_orders?: {
    number: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
}

interface MobileServiceOrderDetailsProps {
  workOrder: ServiceWorkOrder;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onStatusChange: (newStatus: string) => void;
  onSchedule: () => void;
  onGenerateReport: () => void;
  onTakeOwnership: () => void;
  leadPhotos: Array<{ url: string; name: string; type: string }>;
  loadingPhotos: boolean;
  salesOrderItems: Array<{
    id: string;
    product_name: string;
    description: string | null;
    quantity: number;
    unit_price: number;
  }>;
}

const statusColors = {
  da_programmare: "bg-blue-100 text-blue-800",
  programmata: "bg-yellow-100 text-yellow-800",
  completata: "bg-green-100 text-green-800"
};

const statusLabels = {
  da_programmare: "Da Programmare",
  programmata: "Programmata",
  completata: "Completata"
};

export function MobileServiceOrderDetails({
  workOrder,
  onClose,
  onEdit,
  onArchive,
  onDelete,
  onStatusChange,
  onSchedule,
  onGenerateReport,
  onTakeOwnership,
  leadPhotos,
  loadingPhotos,
  salesOrderItems,
}: MobileServiceOrderDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'articles' | 'photos'>('info');

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-muted';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'urgent': return 'Urgente';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Bassa';
      default: return '-';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return format(new Date(dateString), "dd/MM/yyyy HH:mm", { locale: it });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">{workOrder.number}</h1>
              <Badge className={statusColors[workOrder.status as keyof typeof statusColors]}>
                {statusLabels[workOrder.status as keyof typeof statusLabels]}
              </Badge>
            </div>
            <Badge className={`${getPriorityColor(workOrder.priority)} text-xs`}>
              {getPriorityLabel(workOrder.priority)}
            </Badge>
          </div>
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Modifica
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onArchive}>
              <Archive className="h-4 w-4 mr-2" />
              {workOrder.archived ? "Ripristina" : "Archivia"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-4 w-4 mr-2" />
              Elimina
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Title */}
      <div className="p-4 border-b">
        <h2 className="font-medium text-base">{workOrder.title}</h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => setActiveTab('info')}
        >
          Info
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'articles' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => setActiveTab('articles')}
        >
          Articoli
        </button>
        <button
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'photos' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
          onClick={() => setActiveTab('photos')}
        >
          Foto ({leadPhotos.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            {/* Customer Info */}
            {workOrder.customers && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="font-medium">{workOrder.customers.name}</p>
                  <p className="text-sm text-muted-foreground">({workOrder.customers.code})</p>
                </CardContent>
              </Card>
            )}

            {/* Contact Info */}
            {workOrder.crm_contacts && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Contatto
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="font-medium">
                    {workOrder.crm_contacts.first_name} {workOrder.crm_contacts.last_name}
                  </p>
                  {workOrder.crm_contacts.company_name && (
                    <p className="text-sm text-muted-foreground">{workOrder.crm_contacts.company_name}</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Details */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm">Dettagli</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0 space-y-3">
                {/* Technician */}
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Tecnico</Label>
                    {workOrder.technician ? (
                      <p className="text-sm font-medium">
                        {workOrder.technician.first_name} {workOrder.technician.last_name}
                      </p>
                    ) : (
                      <Button size="sm" variant="outline" onClick={onTakeOwnership} className="mt-1 gap-1">
                        <UserPlus className="h-3 w-3" />
                        Prendi in carico
                      </Button>
                    )}
                  </div>
                </div>

                {/* Scheduled Date */}
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Data Programmata</Label>
                    {workOrder.scheduled_date ? (
                      <p className="text-sm font-medium">{formatDate(workOrder.scheduled_date)}</p>
                    ) : (
                      <Button size="sm" variant="default" onClick={onSchedule} className="mt-1 gap-1">
                        <CalendarCheck className="h-3 w-3" />
                        Programma
                      </Button>
                    )}
                  </div>
                </div>

                {/* Location */}
                {workOrder.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Ubicazione</Label>
                      <p className="text-sm">{workOrder.location}</p>
                    </div>
                  </div>
                )}

                {/* Estimated Hours */}
                {workOrder.estimated_hours && (
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <Label className="text-xs text-muted-foreground">Ore Stimate</Label>
                      <p className="text-sm">{workOrder.estimated_hours}h</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Description */}
            {workOrder.description && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Descrizione</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-sm whitespace-pre-wrap">{workOrder.description}</p>
                </CardContent>
              </Card>
            )}

            {/* Equipment Needed */}
            {workOrder.equipment_needed && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Attrezzatura Necessaria</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-sm whitespace-pre-wrap">{workOrder.equipment_needed}</p>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {workOrder.notes && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Note</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-sm whitespace-pre-wrap">{workOrder.notes}</p>
                </CardContent>
              </Card>
            )}

            {/* Links */}
            {(workOrder.production_work_order || workOrder.sales_orders || workOrder.leads) && (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Collegamenti</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                  {workOrder.production_work_order && (
                    <Link 
                      to={`/production/orders?orderId=${workOrder.production_work_order.id}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Factory className="h-4 w-4" />
                      Commessa Produzione: {workOrder.production_work_order.number}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  {workOrder.sales_orders && (
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      Ordine Vendita: {workOrder.sales_orders.number}
                    </div>
                  )}
                  {workOrder.leads && (
                    <Link 
                      to={`/crm/leads?leadId=${workOrder.leads.id}`}
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Building2 className="h-4 w-4" />
                      Lead: {workOrder.leads.company_name}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Dates */}
            <Card>
              <CardContent className="px-4 py-3">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <Label className="text-muted-foreground">Creata il</Label>
                    <p>{format(new Date(workOrder.created_at), "dd/MM/yyyy", { locale: it })}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Aggiornata il</Label>
                    <p>{format(new Date(workOrder.updated_at), "dd/MM/yyyy", { locale: it })}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === 'articles' && (
          <div className="p-4 space-y-4">
            {salesOrderItems.length > 0 ? (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Articoli dall'Ordine</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-3">
                  {salesOrderItems.map((item) => (
                    <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{item.product_name}</p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                          )}
                        </div>
                        <Badge variant="secondary" className="shrink-0">
                          x{item.quantity}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : workOrder.article ? (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Articoli</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                  <p className="text-sm whitespace-pre-wrap">{workOrder.article}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nessun articolo associato</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="p-4">
            {loadingPhotos ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Caricamento foto...</p>
              </div>
            ) : leadPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {leadPhotos.map((photo, index) => (
                  <div key={index} className="relative aspect-square">
                    {photo.type.startsWith('video/') ? (
                      <video 
                        src={photo.url}
                        className="w-full h-full object-cover rounded-lg"
                        controls
                      />
                    ) : (
                      <a href={photo.url} target="_blank" rel="noopener noreferrer">
                        <img 
                          src={photo.url} 
                          alt={photo.name}
                          className="w-full h-full object-cover rounded-lg hover:opacity-80 transition-opacity"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Nessuna foto disponibile</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="p-4 border-t bg-background sticky bottom-0">
        {workOrder.scheduled_date && workOrder.status !== 'completata' ? (
          <Button className="w-full gap-2" onClick={onGenerateReport}>
            <FileText className="h-4 w-4" />
            Genera Rapporto Intervento
          </Button>
        ) : !workOrder.scheduled_date ? (
          <Button className="w-full gap-2" onClick={onSchedule}>
            <CalendarCheck className="h-4 w-4" />
            Programma Installazione
          </Button>
        ) : (
          <Button className="w-full" variant="outline" onClick={onClose}>
            Chiudi
          </Button>
        )}
      </div>
    </div>
  );
}
