import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Lock, Package, Clock, CheckCircle, AlertCircle, MessageSquare, Paperclip, Send, Upload } from "lucide-react";

export default function SupplierPortalPage() {
  const { supplierId } = useParams();
  const navigate = useNavigate();
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [supplierData, setSupplierData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);

  // Check if already authenticated from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem(`supplier_token_${supplierId}`);
    if (token) {
      const [storedSupplierId, storedCode] = token.split(':');
      if (storedSupplierId === supplierId) {
        setAccessCode(storedCode);
        handleAccess(storedCode);
      }
    }
  }, [supplierId]);

  const handleAccess = async (code?: string) => {
    const codeToUse = code || accessCode;
    if (!codeToUse || !supplierId) {
      toast.error("Inserisci il codice di accesso");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-portal-access', {
        body: { supplierId, accessCode: codeToUse }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        sessionStorage.removeItem(`supplier_token_${supplierId}`);
        return;
      }

      setIsAuthenticated(true);
      setSupplierData(data.supplier);
      setOrders(data.orders || []);
      sessionStorage.setItem(`supplier_token_${supplierId}`, data.accessToken);
      toast.success(`Benvenuto, ${data.supplier.name}!`);
    } catch (error: any) {
      console.error('Access error:', error);
      toast.error("Errore durante l'accesso");
      sessionStorage.removeItem(`supplier_token_${supplierId}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { label: "In Attesa", variant: "secondary" as const, icon: Clock },
      confirmed: { label: "Confermato", variant: "default" as const, icon: CheckCircle },
      in_production: { label: "In Produzione", variant: "default" as const, icon: Package },
      shipped: { label: "Spedito", variant: "default" as const, icon: CheckCircle },
      delivered: { label: "Consegnato", variant: "default" as const, icon: CheckCircle },
      cancelled: { label: "Annullato", variant: "destructive" as const, icon: AlertCircle },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Portale Fornitori</CardTitle>
            <CardDescription>
              Inserisci il codice di accesso per visualizzare i tuoi ordini
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Codice di accesso"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === 'Enter' && handleAccess()}
                className="text-center text-lg tracking-widest"
                maxLength={8}
              />
            </div>
            <Button 
              onClick={() => handleAccess()} 
              className="w-full" 
              size="lg"
              disabled={isLoading || accessCode.length < 6}
            >
              {isLoading ? "Verifica in corso..." : "Accedi"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{supplierData?.name}</h1>
              <p className="text-muted-foreground mt-1">
                Portale di gestione ordini • {orders.length} ordini totali
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => {
                sessionStorage.removeItem(`supplier_token_${supplierId}`);
                setIsAuthenticated(false);
              }}
            >
              Esci
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full md:w-auto md:inline-grid grid-cols-2 md:grid-cols-4">
            <TabsTrigger value="active">Attivi ({orders.filter(o => !['delivered', 'cancelled'].includes(o.production_status)).length})</TabsTrigger>
            <TabsTrigger value="pending">Da Confermare ({orders.filter(o => o.production_status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="completed">Completati ({orders.filter(o => o.production_status === 'delivered').length})</TabsTrigger>
            <TabsTrigger value="all">Tutti</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {orders.filter(o => !['delivered', 'cancelled'].includes(o.production_status)).map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="pending" className="space-y-4">
            {orders.filter(o => o.production_status === 'pending').map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {orders.filter(o => o.production_status === 'delivered').map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} getStatusBadge={getStatusBadge} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function OrderCard({ order, getStatusBadge }: any) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showCommentsDialog, setShowCommentsDialog] = useState(false);
  const [showAttachmentsDialog, setShowAttachmentsDialog] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [showPickedUpDialog, setShowPickedUpDialog] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState("");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newStatus, setNewStatus] = useState(order.production_status);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState(order.purchase_order_comments || []);
  const [attachments, setAttachments] = useState(order.purchase_order_attachments || []);

  const handleConfirmOrder = async () => {
    if (!deliveryDate) {
      toast.error("Inserisci la data di consegna prevista");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-confirm-order', {
        body: { 
          orderId: order.id,
          deliveryDate,
          supplierNotes 
        }
      });

      if (error) throw error;
      
      toast.success("Ordine confermato con successo!");
      setShowConfirmDialog(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Confirm error:', error);
      toast.error("Errore durante la conferma");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Inserisci un commento");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-add-comment', {
        body: { 
          orderId: order.id,
          comment: newComment,
          supplierName: order.suppliers?.name || 'Fornitore'
        }
      });

      if (error) throw error;
      
      toast.success("Commento aggiunto con successo!");
      setNewComment("");
      setComments([...comments, data.comment]);
    } catch (error: any) {
      console.error('Comment error:', error);
      toast.error("Errore durante l'invio del commento");
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
        body: { 
          orderId: order.id,
          fileName: file.name,
          fileUrl: publicUrl
        }
      });

      if (error) throw error;
      
      toast.success("File caricato con successo!");
      setAttachments([...attachments, data.attachment]);
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error("Errore durante il caricamento del file");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-update-status', {
        body: { 
          orderId: order.id,
          status: newStatus,
          notes: supplierNotes
        }
      });

      if (error) throw error;
      
      toast.success("Stato aggiornato con successo!");
      setShowStatusDialog(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Status update error:', error);
      toast.error("Errore durante l'aggiornamento dello stato");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkAsPickedUp = async () => {
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('supplier-mark-picked-up', {
        body: { 
          orderId: order.id,
          notes: supplierNotes
        }
      });

      if (error) throw error;
      
      toast.success("Ordine segnato come ritirato!");
      setShowPickedUpDialog(false);
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error('Picked up error:', error);
      toast.error("Errore durante la segnalazione del ritiro");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle className="text-xl">{order.number}</CardTitle>
              {getStatusBadge(order.production_status)}
            </div>
            <CardDescription className="mt-2 space-y-1">
              <div>Ordinato il {new Date(order.created_at).toLocaleDateString('it-IT')}</div>
              {order.expected_delivery_date && (
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium">
                    Consegna prevista: {new Date(order.expected_delivery_date).toLocaleDateString('it-IT')}
                  </span>
                </div>
              )}
            </CardDescription>
          </div>
          {order.expected_delivery_date && (
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Scadenza</div>
              <div className="text-lg font-bold">
                {new Date(order.expected_delivery_date).toLocaleDateString('it-IT')}
              </div>
              {(() => {
                const daysUntil = Math.ceil((new Date(order.expected_delivery_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div className={`text-xs font-medium mt-1 ${
                    daysUntil < 0 ? 'text-destructive' : 
                    daysUntil < 7 ? 'text-orange-500' : 
                    'text-muted-foreground'
                  }`}>
                    {daysUntil < 0 ? `${Math.abs(daysUntil)} giorni in ritardo` : 
                     daysUntil === 0 ? 'Scade oggi' :
                     `Tra ${daysUntil} giorni`}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Items */}
        {order.purchase_order_items && order.purchase_order_items.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm text-muted-foreground">Articoli</h4>
            <div className="space-y-2">
              {order.purchase_order_items.map((item: any, idx: number) => (
                <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                  <div className="font-medium">{item.material?.name || item.description}</div>
                  <div className="text-sm text-muted-foreground">Quantità: {item.quantity}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowCommentsDialog(true)}>
            <MessageSquare className="h-4 w-4" />
            Commenti ({comments.length})
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowAttachmentsDialog(true)}>
            <Paperclip className="h-4 w-4" />
            Allegati ({attachments.length})
          </Button>
          {order.production_status === 'pending' && (
            <Button size="sm" className="gap-2" onClick={() => setShowConfirmDialog(true)}>
              <CheckCircle className="h-4 w-4" />
              Conferma Ordine
            </Button>
          )}
          {['confirmed', 'in_production', 'ready_to_ship', 'shipped'].includes(order.production_status) && (
            <div className="flex-1 space-y-2">
              {order.production_status && (
                <div className="text-xs text-muted-foreground">
                  Stato: {' '}
                  {order.production_status === 'confirmed' && '✓ Confermato'}
                  {order.production_status === 'in_production' && '⚙️ In Produzione'}
                  {order.production_status === 'ready_to_ship' && '📦 Pronto per Spedizione'}
                  {order.production_status === 'shipped' && '🚚 Spedito'}
                </div>
              )}
              <Button size="sm" variant="secondary" className="gap-2 w-full" onClick={() => setShowStatusDialog(true)}>
                <Package className="h-4 w-4" />
                Aggiorna Stato
              </Button>
            </div>
          )}
          {order.production_status === 'delivered' && (
            <Button size="sm" className="gap-2" onClick={() => setShowPickedUpDialog(true)}>
              <CheckCircle className="h-4 w-4" />
              Segna come Ritirato
            </Button>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Confirm Order Dialog */}
    <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Conferma Ordine {order.number}</DialogTitle>
          <DialogDescription>
            Conferma la ricezione dell'ordine e indica la data di consegna prevista (obbligatoria)
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-700 dark:text-amber-400">Attenzione</p>
                <p className="text-amber-600 dark:text-amber-300">
                  La data di consegna prevista è obbligatoria per confermare l'ordine. 
                  Indica quando prevedi di poter evadere l'ordine.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-date" className="text-base font-semibold">
              Data di consegna prevista *
            </Label>
            <Input
              id="delivery-date"
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="text-lg"
              required
            />
            {!deliveryDate && (
              <p className="text-xs text-destructive">Campo obbligatorio</p>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="supplier-notes">Note aggiuntive (opzionale)</Label>
            <Textarea
              id="supplier-notes"
              placeholder="Aggiungi eventuali note sulla consegna o specifiche sull'ordine..."
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setShowConfirmDialog(false);
            setDeliveryDate('');
            setSupplierNotes('');
          }}>
            Annulla
          </Button>
          <Button 
            onClick={handleConfirmOrder} 
            disabled={isSubmitting || !deliveryDate}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            {isSubmitting ? "Conferma in corso..." : "Conferma Ordine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Comments Dialog */}
    <Dialog open={showCommentsDialog} onOpenChange={setShowCommentsDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Commenti - {order.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Existing Comments */}
          {comments.length > 0 ? (
            <div className="space-y-3">
              {comments.map((comment: any) => (
                <div key={comment.id} className="p-3 bg-muted rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-sm">
                      {comment.is_supplier ? comment.supplier_name : 'Azienda'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString('it-IT')}
                    </span>
                  </div>
                  <p className="text-sm">{comment.comment}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nessun commento</p>
          )}

          {/* Add Comment */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="new-comment">Aggiungi commento</Label>
            <Textarea
              id="new-comment"
              placeholder="Scrivi un commento..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <Button onClick={handleAddComment} disabled={isSubmitting} className="gap-2">
              <Send className="h-4 w-4" />
              {isSubmitting ? "Invio..." : "Invia Commento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Attachments Dialog */}
    <Dialog open={showAttachmentsDialog} onOpenChange={setShowAttachmentsDialog}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Allegati - {order.number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Existing Attachments */}
          {attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    <span className="text-sm font-medium">{att.file_name}</span>
                  </div>
                  <Button size="sm" variant="outline" asChild>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      Scarica
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nessun allegato</p>
          )}

          {/* Upload File */}
          <div className="space-y-2 pt-4 border-t">
            <Label htmlFor="file-upload">Carica nuovo file</Label>
            <Input
              id="file-upload"
              type="file"
              onChange={handleFileUpload}
              disabled={isSubmitting}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Update Status Dialog */}
    <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aggiorna Stato Produzione</DialogTitle>
          <DialogDescription>
            Seleziona il nuovo stato dell'ordine {order.number}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {order.production_status && (
            <div className="p-3 bg-secondary/30 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground mb-1">Stato Corrente</p>
              <p className="font-semibold text-lg">
                {order.production_status === 'confirmed' && '✓ Confermato'}
                {order.production_status === 'in_production' && '⚙️ In Produzione'}
                {order.production_status === 'ready_to_ship' && '📦 Pronto per Spedizione'}
                {order.production_status === 'shipped' && '🚚 Spedito'}
                {order.production_status === 'delivered' && '✅ Consegnato'}
              </p>
            </div>
          )}
          
          <div>
            <Label className="text-base font-semibold mb-3 block">Seleziona Nuovo Stato</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNewStatus('in_production')}
                className={`p-4 text-left border-2 rounded-lg transition-all ${
                  newStatus === 'in_production' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">⚙️</span>
                  <div className="flex-1">
                    <p className="font-semibold text-base">In Produzione</p>
                    <p className="text-xs text-muted-foreground mt-1">L'ordine è in lavorazione</p>
                  </div>
                  {newStatus === 'in_production' && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setNewStatus('ready_to_ship')}
                className={`p-4 text-left border-2 rounded-lg transition-all ${
                  newStatus === 'ready_to_ship' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">📦</span>
                  <div className="flex-1">
                    <p className="font-semibold text-base">Pronto per Spedizione</p>
                    <p className="text-xs text-muted-foreground mt-1">L'ordine è completato e pronto</p>
                  </div>
                  {newStatus === 'ready_to_ship' && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setNewStatus('shipped')}
                className={`p-4 text-left border-2 rounded-lg transition-all ${
                  newStatus === 'shipped' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">🚚</span>
                  <div className="flex-1">
                    <p className="font-semibold text-base">Spedito</p>
                    <p className="text-xs text-muted-foreground mt-1">L'ordine è stato spedito</p>
                  </div>
                  {newStatus === 'shipped' && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
              
              <button
                type="button"
                onClick={() => setNewStatus('delivered')}
                className={`p-4 text-left border-2 rounded-lg transition-all ${
                  newStatus === 'delivered' 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border hover:border-primary/50 hover:bg-accent'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">✅</span>
                  <div className="flex-1">
                    <p className="font-semibold text-base">Consegnato</p>
                    <p className="text-xs text-muted-foreground mt-1">L'ordine è stato consegnato</p>
                  </div>
                  {newStatus === 'delivered' && (
                    <CheckCircle className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="status-notes">Note (opzionale)</Label>
            <Textarea
              id="status-notes"
              placeholder="Aggiungi dettagli sul cambio di stato..."
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            setShowStatusDialog(false);
            setNewStatus(order.production_status);
            setSupplierNotes('');
          }}>
            Annulla
          </Button>
          <Button 
            onClick={handleUpdateStatus} 
            disabled={!newStatus || newStatus === order.production_status || isSubmitting}
          >
            {isSubmitting ? "Aggiornamento..." : "Conferma Aggiornamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Picked Up Dialog */}
    <Dialog open={showPickedUpDialog} onOpenChange={setShowPickedUpDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segna come Ritirato - {order.number}</DialogTitle>
          <DialogDescription>
            Conferma che l'ordine è stato ritirato dall'azienda
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="pickup-notes">Note (opzionale)</Label>
            <Textarea
              id="pickup-notes"
              placeholder="Aggiungi eventuali note sul ritiro..."
              value={supplierNotes}
              onChange={(e) => setSupplierNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setShowPickedUpDialog(false)}>
            Annulla
          </Button>
          <Button onClick={handleMarkAsPickedUp} disabled={isSubmitting}>
            {isSubmitting ? "Segnalazione in corso..." : "Conferma Ritiro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}