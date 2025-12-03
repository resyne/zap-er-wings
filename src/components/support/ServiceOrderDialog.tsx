import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ExternalLink, Wrench, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ServiceOrderDialogProps {
  orderId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  location?: string;
  equipment_needed?: string;
  notes?: string;
  article?: string;
  created_at: string;
  customers?: { name: string; code: string };
  leads?: { id: string; company_name: string };
  sales_orders?: { number: string };
  technician?: { first_name: string; last_name: string };
  production_work_order?: { number: string };
}

const statusLabels: Record<string, string> = {
  da_programmare: "Da Programmare",
  programmata: "Programmata",
  completata: "Completata",
};

const statusColors: Record<string, string> = {
  da_programmare: "bg-blue-100 text-blue-800",
  programmata: "bg-yellow-100 text-yellow-800",
  completata: "bg-green-100 text-green-800",
};

export function ServiceOrderDialog({ orderId, open, onOpenChange }: ServiceOrderDialogProps) {
  const [order, setOrder] = useState<ServiceWorkOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [leadPhotos, setLeadPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [salesOrderItems, setSalesOrderItems] = useState<Array<{
    id: string;
    product_name: string;
    description: string | null;
    quantity: number;
  }>>([]);

  useEffect(() => {
    if (open && orderId) {
      loadOrder(orderId);
    }
  }, [open, orderId]);

  const loadOrder = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_work_orders')
        .select(`
          id, number, title, description, status, priority, scheduled_date,
          estimated_hours, location, equipment_needed, notes, article, created_at,
          lead_id, sales_order_id, production_work_order_id,
          customers(name, code),
          leads(id, company_name),
          sales_orders(number),
          technician:technicians!service_work_orders_assigned_to_fkey(first_name, last_name),
          production_work_order:work_orders!service_work_orders_production_work_order_id_fkey(number)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setOrder(data as any);

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

      // Load sales order items
      if (data?.sales_order_id) {
        const { data: items } = await supabase
          .from('sales_order_items')
          .select('id, product_name, description, quantity')
          .eq('sales_order_id', data.sales_order_id);

        setSalesOrderItems(items || []);
      } else {
        setSalesOrderItems([]);
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
            <Wrench className="h-5 w-5" />
            Commessa di Lavoro
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
                <Badge className={`${statusColors[order.status]} mt-1`}>
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

            {order.description && (
              <div>
                <Label className="text-sm text-muted-foreground">Descrizione</Label>
                <p className="text-sm">{order.description}</p>
              </div>
            )}

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
                <Label className="text-sm text-muted-foreground">Data Programmata</Label>
                <p className="text-sm flex items-center gap-1">
                  {order.scheduled_date ? (
                    <>
                      <Calendar className="h-3 w-3" />
                      {new Date(order.scheduled_date).toLocaleString('it-IT')}
                    </>
                  ) : '—'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Ore Stimate</Label>
                <p className="text-sm">{order.estimated_hours ? `${order.estimated_hours}h` : '—'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-muted-foreground">Tecnico Assegnato</Label>
                <p className="text-sm">
                  {order.technician ? `${order.technician.first_name} ${order.technician.last_name}` : '—'}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Commessa Produzione</Label>
                <p className="text-sm">{order.production_work_order?.number || '—'}</p>
              </div>
            </div>

            {order.location && (
              <div>
                <Label className="text-sm text-muted-foreground">Ubicazione</Label>
                <p className="text-sm">{order.location}</p>
              </div>
            )}

            {order.equipment_needed && (
              <div>
                <Label className="text-sm text-muted-foreground">Attrezzatura Necessaria</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md mt-1">{order.equipment_needed}</p>
              </div>
            )}

            {salesOrderItems.length > 0 && (
              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Articoli</Label>
                <div className="space-y-2">
                  {salesOrderItems.map(item => (
                    <div key={item.id} className="bg-muted/50 p-2 rounded-md">
                      <div className="font-medium text-sm">{item.quantity}x {item.product_name}</div>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {order.notes && (
              <div>
                <Label className="text-sm text-muted-foreground">Note</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded-md mt-1">{order.notes}</p>
              </div>
            )}

            {leadPhotos.length > 0 && (
              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground mb-2 block">Foto Cliente</Label>
                <div className="grid grid-cols-4 gap-2">
                  {leadPhotos.map((photo, index) => (
                    <a key={index} href={photo.url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={photo.url}
                        alt={photo.name}
                        className="w-full h-20 object-cover rounded-md border hover:opacity-80 transition-opacity"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" asChild>
                <Link to={`/support/service-orders?orderId=${order.id}`}>
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
