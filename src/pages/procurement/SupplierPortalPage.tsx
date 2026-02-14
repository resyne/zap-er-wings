import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

import { toast } from "sonner";
import { 
  Package, Clock, CheckCircle, AlertCircle, MessageSquare, 
  Paperclip, Send, ChevronRight, Calendar, LayoutGrid, 
  List, Filter, X, History, Upload, Eye
} from "lucide-react";
import { cn } from "@/lib/utils";

type ViewMode = 'kanban' | 'list';
type FilterStatus = 'all' | 'pending' | 'active' | 'completed';

const statusConfig = {
  pending: { label: "Da Confermare", color: "bg-yellow-500", textColor: "text-yellow-600", bgLight: "bg-yellow-50 dark:bg-yellow-950/30" },
  confirmed: { label: "Confermato", color: "bg-blue-500", textColor: "text-blue-600", bgLight: "bg-blue-50 dark:bg-blue-950/30" },
  in_production: { label: "In Produzione", color: "bg-purple-500", textColor: "text-purple-600", bgLight: "bg-purple-50 dark:bg-purple-950/30" },
  ready_to_ship: { label: "Pronto", color: "bg-orange-500", textColor: "text-orange-600", bgLight: "bg-orange-50 dark:bg-orange-950/30" },
  shipped: { label: "Spedito", color: "bg-emerald-500", textColor: "text-emerald-600", bgLight: "bg-emerald-50 dark:bg-emerald-950/30" },
  delivered: { label: "Consegnato", color: "bg-green-600", textColor: "text-green-600", bgLight: "bg-green-50 dark:bg-green-950/30" },
  cancelled: { label: "Annullato", color: "bg-red-500", textColor: "text-red-600", bgLight: "bg-red-50 dark:bg-red-950/30" },
};

const priorityConfig = {
  urgente: { label: "Urgente", color: "bg-red-500 text-white", emoji: "🔴" },
  alta: { label: "Alta", color: "bg-orange-500 text-white", emoji: "🟠" },
  media: { label: "Media", color: "bg-yellow-500 text-black", emoji: "🟡" },
  bassa: { label: "Bassa", color: "bg-blue-500 text-white", emoji: "🔵" },
};

const kanbanColumns = [
  { key: 'pending', label: 'Da Confermare', color: 'border-t-yellow-500' },
  { key: 'in_production', label: 'In Lavorazione', color: 'border-t-purple-500' },
  { key: 'ready_to_ship', label: 'Pronti', color: 'border-t-orange-500' },
  { key: 'delivered', label: 'Completati', color: 'border-t-green-500' },
];

export default function SupplierPortalPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [supplierData, setSupplierData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  useEffect(() => {
    if (!supplierId) {
      navigate('/');
      return;
    }

    const loadSupplierData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('supplier-portal-access', {
          body: { supplierId }
        });

        if (error) throw error;

        if (data.error) {
          toast.error(data.error);
          return;
        }

        setSupplierData(data.supplier);
        setOrders(data.orders || []);
      } catch (error: any) {
        console.error('Access error:', error);
        toast.error("Errore durante il caricamento dei dati");
      } finally {
        setIsLoading(false);
      }
    };

    loadSupplierData();
  }, [supplierId, navigate]);

  const getFilteredOrders = () => {
    switch (filterStatus) {
      case 'pending':
        return orders.filter(o => o.production_status === 'pending');
      case 'active':
        return orders.filter(o => !['delivered', 'cancelled', 'pending'].includes(o.production_status));
      case 'completed':
        return orders.filter(o => o.production_status === 'delivered');
      default:
        return orders;
    }
  };

  const getOrdersByStatus = (status: string) => {
    if (status === 'in_production') {
      return orders.filter(o => ['confirmed', 'in_production'].includes(o.production_status));
    }
    return orders.filter(o => o.production_status === status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4 p-6">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground text-sm">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!supplierData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm text-center p-6">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold">Portale non disponibile</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Il link potrebbe essere scaduto o non valido.
          </p>
        </Card>
      </div>
    );
  }

  const filteredOrders = getFilteredOrders();
  const pendingCount = orders.filter(o => o.production_status === 'pending').length;

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-first Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold truncate">{supplierData?.name}</h1>
              <p className="text-xs text-muted-foreground">
                {orders.length} ordini • {pendingCount > 0 && (
                  <span className="text-yellow-600 font-medium">{pendingCount} da confermare</span>
                )}
              </p>
            </div>
            
            {/* View Toggle */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('kanban')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filter Pills - Mobile Scrollable */}
          {viewMode === 'list' && (
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
              {[
                { key: 'all', label: 'Tutti', count: orders.length },
                { key: 'pending', label: 'Da Confermare', count: orders.filter(o => o.production_status === 'pending').length },
                { key: 'active', label: 'In Corso', count: orders.filter(o => !['delivered', 'cancelled', 'pending'].includes(o.production_status)).length },
                { key: 'completed', label: 'Completati', count: orders.filter(o => o.production_status === 'delivered').length },
              ].map(filter => (
                <Button
                  key={filter.key}
                  variant={filterStatus === filter.key ? 'default' : 'outline'}
                  size="sm"
                  className="flex-shrink-0 h-8 text-xs gap-1.5"
                  onClick={() => setFilterStatus(filter.key as FilterStatus)}
                >
                  {filter.label}
                  <Badge variant="secondary" className="h-5 min-w-5 px-1.5 text-[10px]">
                    {filter.count}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        {viewMode === 'kanban' ? (
          <KanbanView 
            orders={orders} 
            getOrdersByStatus={getOrdersByStatus}
            onSelectOrder={setSelectedOrder}
            onUpdate={() => window.location.reload()}
          />
        ) : (
          <ListView 
            orders={filteredOrders} 
            onSelectOrder={setSelectedOrder}
            onUpdate={() => window.location.reload()}
          />
        )}
      </div>

      {/* Order Detail Sheet */}
      {selectedOrder && (
        <OrderDetailSheet 
          order={selectedOrder} 
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => {
            // Reload data
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// Kanban View Component
function KanbanView({ orders, getOrdersByStatus, onSelectOrder, onUpdate }: {
  orders: any[];
  getOrdersByStatus: (status: string) => any[];
  onSelectOrder: (order: any) => void;
  onUpdate: () => void;
}) {
  return (
    <div className="space-y-6">
      {kanbanColumns.map(column => {
        const columnOrders = getOrdersByStatus(column.key);
        if (columnOrders.length === 0 && column.key === 'delivered') return null;
        
        return (
          <div key={column.key} className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <div className={cn("w-3 h-3 rounded-full", column.color.replace('border-t-', 'bg-'))} />
                {column.label}
              </h3>
              <Badge variant="secondary" className="text-xs">
                {columnOrders.length}
              </Badge>
            </div>
            
            <div className="space-y-2">
              {columnOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm bg-muted/30 rounded-lg">
                  Nessun ordine
                </div>
              ) : (
                columnOrders.map(order => (
                  <MobileOrderCard 
                    key={order.id} 
                    order={order} 
                    onClick={() => onSelectOrder(order)}
                    onUpdate={onUpdate}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List View Component
function ListView({ orders, onSelectOrder, onUpdate }: {
  orders: any[];
  onSelectOrder: (order: any) => void;
  onUpdate: () => void;
}) {
  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p>Nessun ordine trovato</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {orders.map(order => (
        <MobileOrderCard 
          key={order.id} 
          order={order} 
          onClick={() => onSelectOrder(order)}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}

// Mobile Order Card with Inline Actions
function MobileOrderCard({ order, onClick, onUpdate }: { order: any; onClick: () => void; onUpdate: () => void }) {
  const status = statusConfig[order.production_status as keyof typeof statusConfig] || statusConfig.pending;
  const priority = order.priority ? priorityConfig[order.priority as keyof typeof priorityConfig] : null;
  
  const daysUntilDeadline = order.expected_delivery_date 
    ? Math.ceil((new Date(order.expected_delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const commentsCount = order.purchase_order_comments?.length || 0;
  const attachmentsCount = order.purchase_order_attachments?.length || 0;
  const itemsCount = order.purchase_order_items?.length || 0;

  const isPending = order.production_status === 'pending';

  return (
    <Card 
      className={cn(
        "border-l-4 overflow-hidden cursor-pointer transition-colors hover:bg-muted/30 active:bg-muted/50",
        status.color.replace('bg-', 'border-l-'),
        isPending && "ring-1 ring-yellow-300 dark:ring-yellow-700"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Row 1: Number + Priority + Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm">{order.number}</span>
              {priority && <span className="text-xs">{priority.emoji}</span>}
              <Badge className={cn("text-[10px] px-1.5 py-0", status.color, "text-white")}>
                {status.label}
              </Badge>
            </div>

            {/* Row 2: Items summary (compact) */}
            {itemsCount > 0 && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {order.purchase_order_items.slice(0, 2).map((item: any) => 
                  `${item.quantity}x ${item.material?.name || item.description}`
                ).join(', ')}
                {itemsCount > 2 && ` +${itemsCount - 2}`}
              </p>
            )}

            {/* Row 3: Meta info */}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
              {order.expected_delivery_date && (
                <div className={cn(
                  "flex items-center gap-1",
                  daysUntilDeadline !== null && daysUntilDeadline < 0 && "text-destructive font-medium",
                  daysUntilDeadline !== null && daysUntilDeadline >= 0 && daysUntilDeadline <= 3 && "text-orange-600 font-medium"
                )}>
                  <Calendar className="h-3 w-3" />
                  {new Date(order.expected_delivery_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                </div>
              )}
              {commentsCount > 0 && (
                <div className="flex items-center gap-1">
                  <MessageSquare className="h-3 w-3" />
                  {commentsCount}
                </div>
              )}
              {attachmentsCount > 0 && (
                <div className="flex items-center gap-1">
                  <Paperclip className="h-3 w-3" />
                  {attachmentsCount}
                </div>
              )}
            </div>
          </div>

          {/* Right: action hint */}
          <div className="flex-shrink-0">
            {isPending ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 border-yellow-400 text-yellow-600 dark:text-yellow-400 whitespace-nowrap">
                Da confermare
              </Badge>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Order Detail Sheet (Full-screen on mobile)
function OrderDetailSheet({ order, onClose, onUpdate }: { 
  order: any; 
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'details' | 'actions' | 'activity'>('details');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  const [commentAuthorName, setCommentAuthorName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState(order.purchase_order_comments || []);
  const [attachments, setAttachments] = useState(order.purchase_order_attachments || []);

  const status = statusConfig[order.production_status as keyof typeof statusConfig] || statusConfig.pending;
  const priority = order.priority ? priorityConfig[order.priority as keyof typeof priorityConfig] : null;

  const handleConfirmOrder = async () => {
    if (!deliveryDate) {
      toast.error("Inserisci la data di consegna");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('supplier-confirm-order', {
        body: { orderId: order.id, deliveryDate, supplierNotes }
      });
      if (error) throw error;
      toast.success("Ordine confermato!");
      setShowConfirmDialog(false);
      onUpdate();
    } catch (error) {
      toast.error("Errore durante la conferma");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('supplier-update-status', {
        body: { orderId: order.id, status: newStatus, notes: '' }
      });
      if (error) throw error;
      toast.success("Stato aggiornato!");
      onUpdate();
    } catch (error) {
      toast.error("Errore durante l'aggiornamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !commentAuthorName.trim()) {
      toast.error("Compila tutti i campi");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-add-comment', {
        body: { orderId: order.id, comment: newComment, supplierName: commentAuthorName }
      });
      if (error) throw error;
      toast.success("Commento aggiunto!");
      setNewComment("");
      setComments([...comments, data.comment]);
      setShowCommentDialog(false);
    } catch (error) {
      toast.error("Errore durante l'invio");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsSubmitting(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${order.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('purchase_orders')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('purchase_orders')
        .getPublicUrl(fileName);

      const { data, error } = await supabase.functions.invoke('supplier-add-attachment', {
        body: { orderId: order.id, fileName: file.name, fileUrl: publicUrl }
      });

      if (error) throw error;
      toast.success("File caricato!");
      setAttachments([...attachments, data.attachment]);
      setShowUploadDialog(false);
    } catch (error) {
      toast.error("Errore durante il caricamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg h-[90vh] max-h-[90vh] p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="p-4 border-b flex-shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold">{order.number}</h2>
                {priority && <span className="text-lg">{priority.emoji}</span>}
              </div>
              <Badge className={cn("mt-2", status.color, "text-white")}>
                {status.label}
              </Badge>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b flex-shrink-0">
          {[
            { key: 'details', label: 'Dettagli', icon: Eye },
            { key: 'actions', label: 'Azioni', icon: Package },
            { key: 'activity', label: 'Attività', icon: History },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={cn(
                "flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2",
                activeTab === tab.key 
                  ? "border-primary text-primary" 
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {activeTab === 'details' && (
              <div className="space-y-4">
                {/* Delivery Date */}
                {order.expected_delivery_date && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="text-xs text-muted-foreground mb-1">Consegna prevista</div>
                    <div className="text-lg font-bold flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      {new Date(order.expected_delivery_date).toLocaleDateString('it-IT', { 
                        weekday: 'long', 
                        day: 'numeric', 
                        month: 'long' 
                      })}
                    </div>
                  </div>
                )}

                {/* Order Date */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Data ordine</div>
                  <div className="font-medium">
                    {new Date(order.created_at).toLocaleDateString('it-IT')}
                  </div>
                </div>

                {/* Items */}
                {order.purchase_order_items?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Articoli ordinati</h4>
                    {order.purchase_order_items.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 bg-card border rounded-lg">
                        <div className="font-medium">{item.material?.name || item.description}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Quantità: <span className="font-semibold text-foreground">{item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notes */}
                {order.notes && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Note ordine</h4>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                      <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                    </div>
                  </div>
                )}

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Allegati ({attachments.length})</h4>
                    <div className="space-y-2">
                      {attachments.map((att: any) => (
                        <a
                          key={att.id}
                          href={att.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium truncate flex-1">{att.file_name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'actions' && (
              <div className="space-y-4">
                {/* Primary Action for Pending */}
                {order.production_status === 'pending' && (
                  <Button 
                    className="w-full h-14 text-base gap-2" 
                    onClick={() => setShowConfirmDialog(true)}
                  >
                    <CheckCircle className="h-5 w-5" />
                    Conferma Ordine
                  </Button>
                )}

                {/* Status Update Buttons */}
                {order.production_status !== 'pending' && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm mb-3">Aggiorna stato</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant={order.production_status === 'in_production' ? 'default' : 'outline'}
                        className="h-12 gap-2"
                        disabled={isSubmitting || order.production_status === 'in_production'}
                        onClick={() => handleUpdateStatus('in_production')}
                      >
                        ⚙️ In Produzione
                      </Button>
                      <Button
                        variant={order.production_status === 'ready_to_ship' ? 'default' : 'outline'}
                        className="h-12 gap-2"
                        disabled={isSubmitting || order.production_status === 'ready_to_ship'}
                        onClick={() => handleUpdateStatus('ready_to_ship')}
                      >
                        📦 Pronto
                      </Button>
                      <Button
                        variant={order.production_status === 'shipped' ? 'default' : 'outline'}
                        className="h-12 gap-2"
                        disabled={isSubmitting || order.production_status === 'shipped'}
                        onClick={() => handleUpdateStatus('shipped')}
                      >
                        🚚 Spedito
                      </Button>
                      <Button
                        variant={order.production_status === 'delivered' ? 'default' : 'outline'}
                        className="h-12 gap-2"
                        disabled={isSubmitting || order.production_status === 'delivered'}
                        onClick={() => handleUpdateStatus('delivered')}
                      >
                        ✅ Consegnato
                      </Button>
                    </div>
                  </div>
                )}

                {/* Secondary Actions */}
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">Comunicazioni</h4>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 justify-start gap-3"
                    onClick={() => setShowCommentDialog(true)}
                  >
                    <MessageSquare className="h-5 w-5" />
                    Invia messaggio
                    {comments.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{comments.length}</Badge>
                    )}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full h-12 justify-start gap-3"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="h-5 w-5" />
                    Carica documento
                    {attachments.length > 0 && (
                      <Badge variant="secondary" className="ml-auto">{attachments.length}</Badge>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-3">
                {(() => {
                  const activities = [
                    ...comments.map((c: any) => ({
                      type: 'comment',
                      date: new Date(c.created_at),
                      data: c
                    })),
                    ...attachments.map((a: any) => ({
                      type: 'attachment',
                      date: new Date(a.created_at),
                      data: a
                    })),
                    ...(order.purchase_order_status_updates || []).map((s: any) => ({
                      type: 'status',
                      date: new Date(s.created_at),
                      data: s
                    })),
                    {
                      type: 'created',
                      date: new Date(order.created_at),
                      data: { note: 'Ordine ricevuto' }
                    }
                  ].sort((a, b) => b.date.getTime() - a.date.getTime());

                  if (activities.length === 0) {
                    return <p className="text-center text-muted-foreground py-8">Nessuna attività</p>;
                  }

                  return activities.map((activity, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'comment' && <MessageSquare className="h-5 w-5 text-blue-500" />}
                        {activity.type === 'attachment' && <Paperclip className="h-5 w-5 text-green-500" />}
                        {activity.type === 'status' && <Package className="h-5 w-5 text-orange-500" />}
                        {activity.type === 'created' && <CheckCircle className="h-5 w-5 text-purple-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm">
                            {activity.type === 'comment' && 'Messaggio'}
                            {activity.type === 'attachment' && 'Allegato'}
                            {activity.type === 'status' && 'Stato aggiornato'}
                            {activity.type === 'created' && 'Ordine creato'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {activity.date.toLocaleDateString('it-IT')}
                          </span>
                        </div>
                        {activity.type === 'comment' && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {activity.data.comment}
                          </p>
                        )}
                        {activity.type === 'status' && (
                          <p className="text-sm text-muted-foreground mt-1">
                            → {statusConfig[activity.data.status as keyof typeof statusConfig]?.label || activity.data.status}
                          </p>
                        )}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Confirm Order Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Conferma Ordine</DialogTitle>
              <DialogDescription>
                Indica quando prevedi di completare l'ordine
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="font-semibold">Data consegna prevista *</Label>
                <Input
                  type="date"
                  value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="text-base h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Note (opzionale)</Label>
                <Textarea
                  placeholder="Note aggiuntive..."
                  value={supplierNotes}
                  onChange={(e) => setSupplierNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button 
                className="w-full h-12" 
                onClick={handleConfirmOrder}
                disabled={!deliveryDate || isSubmitting}
              >
                {isSubmitting ? "Conferma in corso..." : "Conferma Ordine"}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setShowConfirmDialog(false)}
              >
                Annulla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Comment Dialog */}
        <Dialog open={showCommentDialog} onOpenChange={setShowCommentDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Invia Messaggio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Il tuo nome *</Label>
                <Input
                  placeholder="Es. Mario Rossi"
                  value={commentAuthorName}
                  onChange={(e) => setCommentAuthorName(e.target.value)}
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label>Messaggio *</Label>
                <Textarea
                  placeholder="Scrivi il tuo messaggio..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button 
                className="w-full h-12 gap-2" 
                onClick={handleAddComment}
                disabled={!newComment.trim() || !commentAuthorName.trim() || isSubmitting}
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Invio..." : "Invia"}
              </Button>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setShowCommentDialog(false)}
              >
                Annulla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Carica Documento</DialogTitle>
              <DialogDescription>
                Carica un file da allegare all'ordine
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="file-upload-modal" className="block">
                <div className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Tocca per selezionare un file</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, immagini, documenti</p>
                </div>
                <Input
                  id="file-upload-modal"
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={isSubmitting}
                />
              </Label>
            </div>
            <DialogFooter>
              <Button 
                variant="ghost" 
                className="w-full"
                onClick={() => setShowUploadDialog(false)}
              >
                Annulla
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
