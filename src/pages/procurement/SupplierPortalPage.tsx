import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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
  Paperclip, Send, ChevronRight, ChevronLeft, Calendar,
  X, History, Upload, Eye, Archive, GripVertical
} from "lucide-react";
import { cn } from "@/lib/utils";



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
  { key: 'pending', label: 'Da Confermare', color: 'border-t-yellow-500', emoji: '⏳' },
  { key: 'in_production', label: 'In Lavorazione', color: 'border-t-purple-500', emoji: '⚙️' },
  { key: 'ready_to_ship', label: 'Pronti', color: 'border-t-orange-500', emoji: '📦' },
  { key: 'delivered', label: 'Completati', color: 'border-t-green-500', emoji: '✅' },
];

// Map kanban column keys to actual production_status values for the API
const columnToStatusMap: Record<string, string> = {
  pending: 'pending',
  in_production: 'in_production',
  ready_to_ship: 'ready_to_ship',
  delivered: 'delivered',
};

export default function SupplierPortalPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [supplierData, setSupplierData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [archivedOrderIds, setArchivedOrderIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(`supplier-archived-${supplierId}`);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });

  const toggleArchive = useCallback((orderId: string) => {
    setArchivedOrderIds(prev => {
      const next = new Set(prev);
      if (next.has(orderId)) next.delete(orderId);
      else next.add(orderId);
      localStorage.setItem(`supplier-archived-${supplierId}`, JSON.stringify([...next]));
      return next;
    });
  }, [supplierId]);

  const handleDragEnd = useCallback(async (result: DropResult) => {
    const { draggableId, destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const targetStatus = columnToStatusMap[destination.droppableId];
    if (!targetStatus) return;

    // If dragging from pending to another status, we need confirmation flow
    const order = orders.find(o => o.id === draggableId);
    if (!order) return;

    if (order.production_status === 'pending' && targetStatus !== 'pending') {
      // Open the detail sheet for confirmation
      setSelectedOrder(order);
      toast.info("Conferma l'ordine dal pannello dettagli");
      return;
    }

    // Optimistic update
    setOrders(prev => prev.map(o => 
      o.id === draggableId ? { ...o, production_status: targetStatus } : o
    ));

    try {
      const { error } = await supabase.functions.invoke('supplier-update-status', {
        body: { orderId: draggableId, status: targetStatus, notes: '' }
      });
      if (error) throw error;
      toast.success("Stato aggiornato!");
    } catch {
      // Revert on error
      setOrders(prev => prev.map(o => 
        o.id === draggableId ? { ...o, production_status: order.production_status } : o
      ));
      toast.error("Errore nell'aggiornamento");
    }
  }, [orders]);

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
            
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4">
        <KanbanView 
          orders={orders} 
          getOrdersByStatus={getOrdersByStatus}
          onSelectOrder={setSelectedOrder}
          onUpdate={() => window.location.reload()}
          onDragEnd={handleDragEnd}
          archivedOrderIds={archivedOrderIds}
          showArchived={showArchived}
          onToggleShowArchived={() => setShowArchived(prev => !prev)}
          onToggleArchive={toggleArchive}
        />
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
function KanbanView({ orders, getOrdersByStatus, onSelectOrder, onUpdate, onDragEnd, archivedOrderIds, showArchived, onToggleShowArchived, onToggleArchive }: {
  orders: any[];
  getOrdersByStatus: (status: string) => any[];
  onSelectOrder: (order: any) => void;
  onUpdate: () => void;
  onDragEnd: (result: DropResult) => void;
  archivedOrderIds: Set<string>;
  showArchived: boolean;
  onToggleShowArchived: () => void;
  onToggleArchive: (orderId: string) => void;
}) {
  const archivedOrders = orders.filter(o => archivedOrderIds.has(o.id));

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="space-y-6">
        {kanbanColumns.map(column => {
          const allColumnOrders = getOrdersByStatus(column.key);
          const columnOrders = allColumnOrders.filter(o => !archivedOrderIds.has(o.id));
          
          return (
            <Droppable key={column.key} droppableId={column.key}>
              {(provided, snapshot) => (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <span>{column.emoji}</span>
                      {column.label}
                    </h3>
                    <Badge variant="secondary" className="text-xs">
                      {columnOrders.length}
                    </Badge>
                  </div>
                  
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "space-y-2 min-h-[48px] rounded-lg transition-colors p-1",
                      snapshot.isDraggingOver && "bg-primary/5 ring-2 ring-primary/20"
                    )}
                  >
                    {columnOrders.length === 0 && !snapshot.isDraggingOver ? (
                      <div className="text-center py-6 text-muted-foreground text-xs bg-muted/20 rounded-lg border border-dashed">
                        Trascina qui un ordine
                      </div>
                    ) : (
                      columnOrders.map((order, index) => (
                        <Draggable key={order.id} draggableId={order.id} index={index}>
                          {(dragProvided, dragSnapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={cn(dragSnapshot.isDragging && "opacity-90 rotate-1")}
                            >
                              <MobileOrderCard 
                                order={order} 
                                onClick={() => onSelectOrder(order)}
                                onUpdate={onUpdate}
                                dragHandleProps={dragProvided.dragHandleProps}
                                onArchive={() => onToggleArchive(order.id)}
                              />
                            </div>
                          )}
                        </Draggable>
                      ))
                    )}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          );
        })}

        {/* Archived Section */}
        {archivedOrders.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <button 
              onClick={onToggleShowArchived}
              className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span className="flex items-center gap-2 font-medium">
                <Archive className="h-4 w-4" />
                Archiviati ({archivedOrders.length})
              </span>
              <ChevronRight className={cn("h-4 w-4 transition-transform", showArchived && "rotate-90")} />
            </button>
            {showArchived && (
              <div className="space-y-2">
                {archivedOrders.map(order => (
                  <MobileOrderCard 
                    key={order.id} 
                    order={order} 
                    onClick={() => onSelectOrder(order)}
                    onUpdate={onUpdate}
                    onArchive={() => onToggleArchive(order.id)}
                    isArchived
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </DragDropContext>
  );
}


// Mobile Order Card with Inline Actions
function MobileOrderCard({ order, onClick, onUpdate, dragHandleProps, onArchive, isArchived }: { 
  order: any; 
  onClick: () => void; 
  onUpdate: () => void;
  dragHandleProps?: any;
  onArchive?: () => void;
  isArchived?: boolean;
}) {
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
        "overflow-hidden cursor-pointer transition-all hover:shadow-md active:scale-[0.99]",
        isPending && "ring-1 ring-yellow-300 dark:ring-yellow-700",
        isArchived && "opacity-60"
      )}
      onClick={onClick}
    >
      <div className={cn("h-1 w-full", status.color)} />
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          {/* Drag Handle */}
          {dragHandleProps && (
            <div {...dragHandleProps} className="flex-shrink-0 touch-none cursor-grab active:cursor-grabbing p-0.5" onClick={(e) => e.stopPropagation()}>
              <GripVertical className="h-4 w-4 text-muted-foreground/40" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            {/* Row 1: Number + Priority */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{order.number}</span>
              {priority && <span className="text-xs">{priority.emoji}</span>}
            </div>

            {/* Row 2: Items summary */}
            {itemsCount > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
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

          {/* Right side */}
          <div className="flex-shrink-0 flex items-center gap-1">
            {onArchive && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => { e.stopPropagation(); onArchive(); }}
                title={isArchived ? "Ripristina" : "Archivia"}
              >
                <Archive className={cn("h-3.5 w-3.5", isArchived ? "text-primary" : "text-muted-foreground")} />
              </Button>
            )}
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
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
  const isPending = order.production_status === 'pending';
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [acceptRequestedDate, setAcceptRequestedDate] = useState(true);
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
    const finalDate = acceptRequestedDate ? order.expected_delivery_date : deliveryDate;
    if (!finalDate) {
      toast.error("Inserisci la data di consegna");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('supplier-confirm-order', {
        body: { orderId: order.id, deliveryDate: finalDate, supplierNotes }
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

  const isPendingOrder = order.production_status === 'pending';

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 [&>button]:hidden top-[55%]">
        {/* Sticky Back Header */}
        <div className="flex-shrink-0">
          <button
            onClick={onClose}
            className="flex items-center gap-2 w-full px-4 py-5 text-base font-semibold text-primary hover:bg-muted/50 active:bg-muted transition-colors border-b bg-muted/30"
          >
            <ChevronLeft className="h-6 w-6" />
            Torna alla lista
          </button>
          <div className="px-4 py-3 border-b bg-card">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold">{order.number}</h2>
              {priority && <span className="text-base">{priority.emoji}</span>}
              <Badge className={cn("text-[11px] px-2 py-0.5", status.color, "text-white")}>
                {status.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* For PENDING orders: unified view (details + confirm form, no tabs) */}
        {isPendingOrder ? (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Delivery Date Requested */}
              {order.expected_delivery_date && (
                <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">📅 Richiesta consegna entro il</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-yellow-600" />
                    {new Date(order.expected_delivery_date).toLocaleDateString('it-IT', { 
                      weekday: 'long', day: 'numeric', month: 'long' 
                    })}
                  </div>
                </div>
              )}

              {/* Items */}
              {order.purchase_order_items?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Articoli ordinati ({order.purchase_order_items.length})
                  </h4>
                  {order.purchase_order_items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                      <div className="text-base font-bold text-foreground">{item.material?.name || item.description}</div>
                      {item.material?.code && (
                        <div className="text-xs text-muted-foreground mt-0.5">Cod. {item.material.code}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          Qtà: {item.quantity} {item.material?.unit || 'pz'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Note ordine</h4>
                  <div className="p-3 bg-accent/50 border rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                  </div>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Allegati ({attachments.length})</h4>
                  {attachments.map((att: any) => (
                    <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate flex-1">{att.file_name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}

              {/* Confirmation Form - inline */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  Conferma Ordine
                </h4>
                <div className="space-y-3">
                  {/* Option: Accept requested date */}
                  {order.expected_delivery_date && (
                    <div 
                      className={cn(
                        "p-4 rounded-lg border-2 cursor-pointer transition-all",
                        acceptRequestedDate 
                          ? "border-green-500 bg-green-50 dark:bg-green-950/30" 
                          : "border-muted hover:border-muted-foreground/30"
                      )}
                      onClick={() => setAcceptRequestedDate(true)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                          acceptRequestedDate ? "border-green-500 bg-green-500" : "border-muted-foreground/40"
                        )}>
                          {acceptRequestedDate && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                        </div>
                        <div>
                          <div className="font-semibold text-sm">✅ Confermo la data richiesta</div>
                          <div className="text-sm text-muted-foreground">
                            Consegna entro il {new Date(order.expected_delivery_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Option: Propose different date */}
                  <div 
                    className={cn(
                      "p-4 rounded-lg border-2 cursor-pointer transition-all",
                      !acceptRequestedDate 
                        ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30" 
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                    onClick={() => setAcceptRequestedDate(false)}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                        !acceptRequestedDate ? "border-orange-500 bg-orange-500" : "border-muted-foreground/40"
                      )}>
                        {!acceptRequestedDate && <CheckCircle className="h-3.5 w-3.5 text-white" />}
                      </div>
                      <div className="font-semibold text-sm">📅 Propongo una data diversa</div>
                    </div>
                  </div>

                  {/* Date input - only shown when proposing different date */}
                  {!acceptRequestedDate && (
                    <div className="space-y-1.5 pl-8">
                      <Label className="font-medium">Data di consegna prevista *</Label>
                      <Input
                        type="date"
                        value={deliveryDate}
                        onChange={(e) => setDeliveryDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="text-base h-12"
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label>Note (opzionale)</Label>
                    <Textarea
                      placeholder="Eventuali note su prezzi, disponibilità, tempi..."
                      value={supplierNotes}
                      onChange={(e) => setSupplierNotes(e.target.value)}
                      rows={3}
                      className="text-base"
                    />
                  </div>
                  <Button 
                    className="w-full h-12 text-base gap-2" 
                    onClick={handleConfirmOrder}
                    disabled={(!acceptRequestedDate && !deliveryDate) || isSubmitting}
                  >
                    <CheckCircle className="h-5 w-5" />
                    {isSubmitting ? "Conferma in corso..." : "Conferma Ordine"}
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Delivery Date */}
              {order.expected_delivery_date && (
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="text-xs text-muted-foreground mb-1">Richiesta consegna entro il</div>
                  <div className="text-lg font-bold flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {new Date(order.expected_delivery_date).toLocaleDateString('it-IT', { 
                      weekday: 'long', day: 'numeric', month: 'long' 
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground">Data ordine</div>
                <div className="font-medium">
                  {new Date(order.created_at).toLocaleDateString('it-IT')}
                </div>
              </div>

              {/* Items */}
              {order.purchase_order_items?.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-bold text-base flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    Articoli ordinati ({order.purchase_order_items.length})
                  </h4>
                  {order.purchase_order_items.map((item: any, idx: number) => (
                    <div key={idx} className="p-4 bg-primary/5 border-2 border-primary/20 rounded-lg">
                      <div className="text-base font-bold text-foreground">{item.material?.name || item.description}</div>
                      {item.material?.code && (
                        <div className="text-xs text-muted-foreground mt-0.5">Cod. {item.material.code}</div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex items-center px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                          Qtà: {item.quantity} {item.material?.unit || 'pz'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Note ordine</h4>
                  <div className="p-3 bg-accent/50 border rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{order.notes}</p>
                  </div>
                </div>
              )}

              {/* Attachments */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Allegati ({attachments.length})</h4>
                  {attachments.map((att: any) => (
                    <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium truncate flex-1">{att.file_name}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              )}

              {/* Status Update */}
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Aggiorna stato</h4>
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

              {/* Communications */}
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Comunicazioni</h4>
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

              {/* Activity Timeline */}
              <div className="space-y-2 border-t pt-4">
                <h4 className="font-semibold text-sm">Attività recente</h4>
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
                    return <p className="text-center text-muted-foreground py-4 text-sm">Nessuna attività</p>;
                  }

                  return activities.map((activity, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
                      <div className="flex-shrink-0">
                        {activity.type === 'comment' && <MessageSquare className="h-4 w-4 text-blue-500" />}
                        {activity.type === 'attachment' && <Paperclip className="h-4 w-4 text-green-500" />}
                        {activity.type === 'status' && <Package className="h-4 w-4 text-orange-500" />}
                        {activity.type === 'created' && <CheckCircle className="h-4 w-4 text-purple-500" />}
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
            </div>
          </ScrollArea>
        )}

        {/* Confirm Order Dialog - available for both flows */}
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
                  className="text-base"
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
                  className="h-12 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label>Messaggio *</Label>
                <Textarea
                  placeholder="Scrivi il tuo messaggio..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                  className="text-base"
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
