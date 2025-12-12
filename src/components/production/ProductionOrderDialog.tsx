import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WorkOrderArticles } from "./WorkOrderArticles";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface ProductionOrderDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hideAmounts?: boolean;
}

// Function to hide € amounts from text
const sanitizeAmounts = (text: string | null | undefined): string => {
  if (!text) return '';
  // Hide patterns like €1.000,00 or € 1000 or 1.000€ etc.
  return text.replace(/€\s*[\d.,]+|\d+[\d.,]*\s*€/g, '€ ***');
};

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  priority?: string;
  notes?: string;
  article?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  created_at: string;
  customers?: { name: string; code: string };
  leads?: { id: string; company_name: string };
  sales_orders?: { number: string };
  offers?: { number: string };
  boms?: { name: string; version: string };
  technician?: { first_name: string; last_name: string };
  back_office?: { first_name: string; last_name: string };
}

const statusLabels: Record<string, string> = {
  da_fare: "Da Fare",
  in_lavorazione: "In Lavorazione",
  in_test: "In Test",
  pronto: "Pronto",
  completato: "Completato",
  standby: "Standby",
  bloccato: "Bloccato",
};

const statusColors: Record<string, string> = {
  da_fare: "bg-muted",
  in_lavorazione: "bg-amber-500",
  in_test: "bg-orange-500",
  pronto: "bg-blue-500",
  completato: "bg-green-500",
  standby: "bg-purple-500",
  bloccato: "bg-destructive",
};

export function ProductionOrderDialog({ orderId, open, onOpenChange, hideAmounts = false }: ProductionOrderDialogProps) {
  const [order, setOrder] = useState<WorkOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadPhotos, setLeadPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);

  useEffect(() => {
    if (open && orderId) {
      loadOrder(orderId);
    }
  }, [open, orderId]);

  const loadOrder = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          id, number, title, status, priority, notes, article,
          planned_start_date, planned_end_date, created_at, lead_id, offer_id,
          assigned_to, back_office_manager,
          customers(name, code),
          leads(id, company_name),
          sales_orders(number),
          offers(number),
          boms(name, version)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      // Load technician and back office info separately if needed
      let technicianData = null;
      let backOfficeData = null;

      if (data?.assigned_to) {
        const { data: tech } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.assigned_to)
          .single();
        technicianData = tech;
      }

      if (data?.back_office_manager) {
        const { data: bo } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', data.back_office_manager)
          .single();
        backOfficeData = bo;
      }

      setOrder({
        ...data,
        technician: technicianData,
        back_office: backOfficeData,
      } as any);

      // Load lead photos
      if (data?.lead_id) {
        const { data: leadFiles } = await supabase
          .from('lead_files')
          .select('*')
          .eq('lead_id', data.lead_id);

        if (leadFiles) {
          const mediaFiles = leadFiles.filter(file =>
            file.file_type?.startsWith('image/') ||
            file.file_type?.startsWith('video/') ||
            /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
          );

          setLeadPhotos(mediaFiles.map(file => ({
            url: supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl,
            name: file.file_name,
            type: file.file_type || ''
          })));
        }
      } else {
        setLeadPhotos([]);
      }
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Commessa di Produzione
          </DialogTitle>
          <DialogDescription>{order?.number}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : order ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm text-muted-foreground">Stato</Label>
                <Badge className={`${statusColors[order.status]} text-white mt-1`}>
                  {statusLabels[order.status] || order.status}
                </Badge>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Priorità</Label>
                <Badge
                  variant="outline"
                  className={`mt-1 ${
                    order.priority === 'urgent' ? 'border-red-500 text-red-600' :
                    order.priority === 'high' ? 'border-orange-500 text-orange-600' :
                    order.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                    'border-gray-400 text-gray-500'
                  }`}
                >
                  {order.priority === 'urgent' ? 'Urgente' :
                   order.priority === 'high' ? 'Alta' :
                   order.priority === 'medium' ? 'Media' : 'Bassa'}
                </Badge>
              </div>
            </div>

            <div>
              <Label className="text-sm text-muted-foreground">Titolo</Label>
              <p className="text-base font-medium">{order.title}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Cliente</Label>
                <p className="text-sm">
                  {order.customers ? `${order.customers.name} (${order.customers.code})` : '—'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Lead</Label>
                {order.leads ? (
                  <Link
                    to={`/crm/leads?lead=${order.leads.id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    {order.leads.company_name}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Ordine di Vendita</Label>
                <p className="text-sm">{order.sales_orders?.number || '—'}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Offerta</Label>
                <p className="text-sm">{order.offers?.number || '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Distinta Base</Label>
                <p className="text-sm">
                  {order.boms ? `${order.boms.name} (v${order.boms.version})` : '—'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Tecnico Assegnato</Label>
                <p className="text-sm">
                  {order.technician ? `${order.technician.first_name} ${order.technician.last_name}` : '—'}
                </p>
              </div>
            </div>

            {(order.planned_start_date || order.planned_end_date) && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Data Inizio</Label>
                  <p className="text-sm">
                    {order.planned_start_date ? new Date(order.planned_start_date).toLocaleDateString('it-IT') : '—'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Data Fine</Label>
                  <p className="text-sm">
                    {order.planned_end_date ? new Date(order.planned_end_date).toLocaleDateString('it-IT') : '—'}
                  </p>
                </div>
              </div>
            )}

            {/* Articles - Always show, component loads from DB */}
            <div className="border-t pt-4">
              <Label className="text-sm text-muted-foreground mb-2 block">Da assemblare</Label>
              <WorkOrderArticles workOrderId={order.id} articleText={order.article || ''} hideAmounts={hideAmounts} />
            </div>

            {order.notes && (
              <div>
                <Label className="text-sm text-muted-foreground">Note</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md mt-1">
                  {hideAmounts ? sanitizeAmounts(order.notes) : order.notes}
                </p>
              </div>
            )}

            {leadPhotos.length > 0 && (
              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Foto Cliente</Label>
                <div className="grid grid-cols-4 gap-2">
                  {leadPhotos.map((photo, index) => {
                    const isVideo = /\.(mp4|mov|avi|webm|mkv|ogg)$/i.test(photo.name);
                    return isVideo ? (
                      <button 
                        key={index} 
                        onClick={() => setPreviewMedia({ url: photo.url, name: photo.name, isVideo: true })}
                        className="relative group cursor-pointer"
                      >
                        <video
                          src={photo.url}
                          className="w-full h-20 object-cover rounded-md border group-hover:opacity-80 transition-opacity"
                          muted
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-1">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z"/>
                            </svg>
                          </div>
                        </div>
                      </button>
                    ) : (
                      <button 
                        key={index} 
                        onClick={() => setPreviewMedia({ url: photo.url, name: photo.name, isVideo: false })}
                        className="cursor-pointer"
                      >
                        <img
                          src={photo.url}
                          alt={photo.name}
                          className="w-full h-20 object-cover rounded-md border hover:opacity-80 transition-opacity"
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <MediaPreviewModal
              open={!!previewMedia}
              onOpenChange={(open) => !open && setPreviewMedia(null)}
              url={previewMedia?.url || ''}
              name={previewMedia?.name || ''}
              isVideo={previewMedia?.isVideo || false}
            />

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" asChild>
                <Link to={`/mfg/work-orders?orderId=${order.id}`}>
                  Apri nella pagina dedicata
                  <ExternalLink className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
