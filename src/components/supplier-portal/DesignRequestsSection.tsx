import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Plus, Upload, FileText, Image, X, Clock, CheckCircle,
  Pencil, Eye, ChevronLeft, ChevronRight, Loader2,
  Euro, Timer, MessageSquare, Paperclip
} from "lucide-react";

const COEM_SUPPLIER_ID = "f68ad624-666e-466b-8910-7b1b53e8d7f0";

const statusConfig: Record<string, { label: string; color: string; emoji: string }> = {
  nuovo: { label: "Nuovo", color: "bg-blue-500", emoji: "🆕" },
  stima_richiesta: { label: "Stima Richiesta", color: "bg-yellow-500", emoji: "⏳" },
  accettata: { label: "Accettata", color: "bg-green-500", emoji: "✅" },
  in_lavorazione: { label: "In Lavorazione", color: "bg-purple-500", emoji: "⚙️" },
  revisione: { label: "In Revisione", color: "bg-orange-500", emoji: "🔍" },
  completata: { label: "Completata", color: "bg-emerald-600", emoji: "🎉" },
};

const statusFlow = ["nuovo", "stima_richiesta", "accettata", "in_lavorazione", "revisione", "completata"];

interface DesignRequest {
  id: string;
  supplier_id: string;
  title: string;
  description: string | null;
  status: string;
  estimated_hours: number | null;
  estimated_cost: number | null;
  estimate_notes: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DesignFile {
  id: string;
  design_request_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string | null;
  created_at: string;
}

interface DesignComment {
  id: string;
  design_request_id: string;
  author_name: string;
  content: string;
  is_supplier: boolean;
  created_at: string;
}

interface DesignRequestsSectionProps {
  supplierId: string;
  isSupplierView?: boolean; // true = Francesco's view in the portal, false = admin internal
}

export function DesignRequestsSection({ supplierId, isSupplierView = false }: DesignRequestsSectionProps) {
  const [requests, setRequests] = useState<DesignRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<DesignRequest | null>(null);

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from("design_requests")
      .select("*")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false });
    
    if (error) {
      console.error("Error loading design requests:", error);
      return;
    }
    setRequests((data as any[]) || []);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  if (supplierId !== COEM_SUPPLIER_ID) return null;

  // Export the supplier ID for reuse


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-base flex items-center gap-2">
          <Pencil className="h-5 w-5 text-primary" />
          Richieste di Progettazione
          <Badge variant="secondary" className="text-xs">{requests.length}</Badge>
        </h3>
        {!isSupplierView && (
          <Button size="sm" onClick={() => setShowCreateDialog(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nuova Richiesta
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm border rounded-lg border-dashed">
          Nessuna richiesta di progettazione
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(req => (
            <DesignRequestCard
              key={req.id}
              request={req}
              onClick={() => setSelectedRequest(req)}
            />
          ))}
        </div>
      )}

      {showCreateDialog && (
        <CreateDesignRequestDialog
          supplierId={supplierId}
          onClose={() => setShowCreateDialog(false)}
          onCreated={() => { setShowCreateDialog(false); loadRequests(); }}
        />
      )}

      {selectedRequest && (
        <DesignRequestDetailDialog
          request={selectedRequest}
          isSupplierView={isSupplierView}
          onClose={() => setSelectedRequest(null)}
          onUpdate={() => { setSelectedRequest(null); loadRequests(); }}
        />
      )}
    </div>
  );
}

// --- Card ---
function DesignRequestCard({ request, onClick }: { request: DesignRequest; onClick: () => void }) {
  const status = statusConfig[request.status] || statusConfig.nuovo;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-all active:scale-[0.99]" onClick={onClick}>
      <div className={cn("h-1 w-full", status.color)} />
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm">{status.emoji}</span>
              <span className="font-semibold text-sm truncate">{request.title}</span>
            </div>
            {request.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{request.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
              <span>{new Date(request.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
              {request.estimated_cost != null && (
                <span className="flex items-center gap-0.5">
                  <Euro className="h-3 w-3" />
                  {request.estimated_cost.toFixed(0)}€
                </span>
              )}
              {request.estimated_hours != null && (
                <span className="flex items-center gap-0.5">
                  <Timer className="h-3 w-3" />
                  {request.estimated_hours}h
                </span>
              )}
            </div>
          </div>
          <Badge className={cn("text-[10px] px-2 py-0.5 text-white flex-shrink-0", status.color)}>
            {status.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Create Dialog ---
function CreateDesignRequestDialog({ supplierId, onClose, onCreated }: {
  supplierId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = Array.from(e.dataTransfer.files);
    setFiles(prev => [...prev, ...dropped]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (idx: number) => {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Inserisci un titolo");
      return;
    }

    setUploading(true);
    try {
      // Create the request
      const { data: reqData, error: reqError } = await supabase
        .from("design_requests")
        .insert({ supplier_id: supplierId, title: title.trim(), description: description.trim() || null } as any)
        .select()
        .single();

      if (reqError) throw reqError;
      const requestId = (reqData as any).id;

      // Upload files
      for (const file of files) {
        const ext = file.name.split('.').pop();
        const path = `${requestId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("design-requests")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from("design-requests")
          .getPublicUrl(path);

        await supabase.from("design_request_files").insert({
          design_request_id: requestId,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
        } as any);
      }

      toast.success("Richiesta creata!");
      onCreated();
    } catch (error: any) {
      console.error("Error creating request:", error);
      toast.error("Errore nella creazione");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova Richiesta di Progettazione</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Titolo *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Es: Disegno tecnico flangia XY" className="mt-1" />
          </div>
          <div>
            <Label>Descrizione</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrivi la richiesta in dettaglio..." rows={3} className="mt-1" />
          </div>

          {/* Drag & Drop Area */}
          <div>
            <Label>File / Foto</Label>
            <div
              className={cn(
                "mt-1 border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
                isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
              )}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('design-file-input')?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Trascina file qui o <span className="text-primary font-medium">sfoglia</span>
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">Foto, PDF, DWG, documenti</p>
              <input
                id="design-file-input"
                type="file"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                accept="image/*,.pdf,.dwg,.dxf,.doc,.docx,.xlsx,.zip"
              />
            </div>
          </div>

          {/* File List */}
          {files.length > 0 && (
            <div className="space-y-1.5">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-sm">
                  {file.type.startsWith('image/') ? <Image className="h-4 w-4 text-blue-500 flex-shrink-0" /> : <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />}
                  <span className="truncate flex-1">{file.name}</span>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{(file.size / 1024).toFixed(0)}KB</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); removeFile(idx); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={uploading}>
            {uploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Creazione...</> : "Crea Richiesta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Detail Dialog ---
function DesignRequestDetailDialog({ request, isSupplierView, onClose, onUpdate }: {
  request: DesignRequest;
  isSupplierView: boolean;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [files, setFiles] = useState<DesignFile[]>([]);
  const [comments, setComments] = useState<DesignComment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentAuthor, setCommentAuthor] = useState(isSupplierView ? "Francesco D'Auria" : "");
  const [showEstimateForm, setShowEstimateForm] = useState(false);
  const [estHours, setEstHours] = useState(request.estimated_hours?.toString() || "");
  const [estCost, setEstCost] = useState(request.estimated_cost?.toString() || "");
  const [estNotes, setEstNotes] = useState(request.estimate_notes || "");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const status = statusConfig[request.status] || statusConfig.nuovo;

  useEffect(() => {
    loadData();
  }, [request.id]);

  const loadData = async () => {
    const [filesRes, commentsRes] = await Promise.all([
      supabase.from("design_request_files").select("*").eq("design_request_id", request.id).order("created_at"),
      supabase.from("design_request_comments").select("*").eq("design_request_id", request.id).order("created_at"),
    ]);
    setFiles((filesRes.data as any[]) || []);
    setComments((commentsRes.data as any[]) || []);
  };

  const handleStatusUpdate = async (newStatus: string) => {
    setIsSubmitting(true);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'accettata') updateData.accepted_at = new Date().toISOString();
      if (newStatus === 'completata') updateData.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("design_requests")
        .update(updateData)
        .eq("id", request.id);

      if (error) throw error;
      toast.success(`Stato aggiornato a "${statusConfig[newStatus]?.label}"`);
      onUpdate();
    } catch (error) {
      toast.error("Errore nell'aggiornamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEstimate = async () => {
    if (!estHours && !estCost) {
      toast.error("Inserisci almeno una stima");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("design_requests")
        .update({
          estimated_hours: estHours ? parseFloat(estHours) : null,
          estimated_cost: estCost ? parseFloat(estCost) : null,
          estimate_notes: estNotes || null,
          status: 'stima_richiesta',
        } as any)
        .eq("id", request.id);

      if (error) throw error;
      toast.success("Stima inviata!");
      setShowEstimateForm(false);
      onUpdate();
    } catch {
      toast.error("Errore nell'invio della stima");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !commentAuthor.trim()) {
      toast.error("Compila tutti i campi");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("design_request_comments").insert({
        design_request_id: request.id,
        author_name: commentAuthor,
        content: newComment,
        is_supplier: isSupplierView,
      } as any);

      if (error) throw error;
      setNewComment("");
      loadData();
      toast.success("Commento aggiunto");
    } catch {
      toast.error("Errore");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUploadFiles = async () => {
    if (newFiles.length === 0) return;
    setIsSubmitting(true);
    try {
      for (const file of newFiles) {
        const ext = file.name.split('.').pop();
        const path = `${request.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        
        const { error: uploadError } = await supabase.storage
          .from("design-requests")
          .upload(path, file);

        if (uploadError) { console.error(uploadError); continue; }

        const { data: { publicUrl } } = supabase.storage.from("design-requests").getPublicUrl(path);

        await supabase.from("design_request_files").insert({
          design_request_id: request.id,
          file_name: file.name,
          file_url: publicUrl,
          file_size: file.size,
          file_type: file.type,
        } as any);
      }
      setNewFiles([]);
      loadData();
      toast.success("File caricati!");
    } catch {
      toast.error("Errore nel caricamento");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setNewFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
  };

  // Determine available actions
  const getNextStatuses = (): { status: string; label: string; variant: "default" | "outline" }[] => {
    const actions: { status: string; label: string; variant: "default" | "outline" }[] = [];
    
    if (!isSupplierView) {
      // Admin actions
      if (request.status === 'stima_richiesta') {
        actions.push({ status: 'accettata', label: '✅ Accetta Stima', variant: 'default' });
      }
      if (request.status === 'revisione') {
        actions.push({ status: 'completata', label: '🎉 Segna Completata', variant: 'default' });
        actions.push({ status: 'in_lavorazione', label: '🔄 Richiedi Modifiche', variant: 'outline' });
      }
    } else {
      // Supplier/Francesco actions
      if (request.status === 'nuovo') {
        // Show estimate form
      }
      if (request.status === 'accettata') {
        actions.push({ status: 'in_lavorazione', label: '⚙️ Inizia Lavorazione', variant: 'default' });
      }
      if (request.status === 'in_lavorazione') {
        actions.push({ status: 'revisione', label: '🔍 Invia in Revisione', variant: 'default' });
      }
    }
    return actions;
  };

  const nextActions = getNextStatuses();

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg h-[85vh] max-h-[85vh] p-0 flex flex-col gap-0 [&>button]:hidden top-[55%]">
        {/* Header */}
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
              <h2 className="text-lg font-bold flex-1">{request.title}</h2>
              <Badge className={cn("text-[11px] px-2 py-0.5 text-white", status.color)}>
                {status.emoji} {status.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Creata il {new Date(request.created_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Description */}
            {request.description && (
              <div className="p-3 bg-accent/50 border rounded-lg">
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
              </div>
            )}

            {/* Estimate Info */}
            {(request.estimated_cost != null || request.estimated_hours != null) && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  Stima di Francesco
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {request.estimated_hours != null && (
                    <div>
                      <div className="text-xs text-muted-foreground">Ore stimate</div>
                      <div className="text-lg font-bold">{request.estimated_hours}h</div>
                    </div>
                  )}
                  {request.estimated_cost != null && (
                    <div>
                      <div className="text-xs text-muted-foreground">Costo stimato</div>
                      <div className="text-lg font-bold">{request.estimated_cost.toFixed(2)}€</div>
                    </div>
                  )}
                </div>
                {request.estimate_notes && (
                  <p className="text-sm text-muted-foreground mt-2">{request.estimate_notes}</p>
                )}
              </div>
            )}

            {/* Estimate Form (for supplier on 'nuovo' status) */}
            {isSupplierView && request.status === 'nuovo' && (
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  Inserisci la tua stima
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Ore stimate</Label>
                    <Input type="number" value={estHours} onChange={e => setEstHours(e.target.value)} placeholder="0" className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">Costo (€)</Label>
                    <Input type="number" value={estCost} onChange={e => setEstCost(e.target.value)} placeholder="0.00" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Note</Label>
                  <Textarea value={estNotes} onChange={e => setEstNotes(e.target.value)} placeholder="Dettagli sulla stima..." rows={2} className="mt-1" />
                </div>
                <Button onClick={handleSubmitEstimate} disabled={isSubmitting} className="w-full">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Invia Stima
                </Button>
              </div>
            )}

            {/* Files */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                File ({files.length})
              </h4>
              {files.map(file => (
                <a
                  key={file.id}
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  {file.file_type?.startsWith('image/') ? (
                    <Image className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium truncate flex-1">{file.file_name}</span>
                  {file.file_size && <span className="text-xs text-muted-foreground">{(file.file_size / 1024).toFixed(0)}KB</span>}
                  <Eye className="h-4 w-4 text-muted-foreground" />
                </a>
              ))}

              {/* Upload new files */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer",
                  isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/20 hover:border-primary/50"
                )}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDropFiles}
                onClick={() => document.getElementById('design-detail-file-input')?.click()}
              >
                <Upload className="h-6 w-6 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Trascina file qui o <span className="text-primary font-medium">sfoglia</span>
                </p>
                <input
                  id="design-detail-file-input"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => e.target.files && setNewFiles(prev => [...prev, ...Array.from(e.target.files!)])}
                  accept="image/*,.pdf,.dwg,.dxf,.doc,.docx,.xlsx,.zip"
                />
              </div>

              {newFiles.length > 0 && (
                <div className="space-y-1">
                  {newFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 p-2 bg-primary/5 rounded text-sm">
                      <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNewFiles(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button size="sm" onClick={handleUploadFiles} disabled={isSubmitting} className="w-full mt-1">
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                    Carica {newFiles.length} file
                  </Button>
                </div>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Messaggi ({comments.length})
              </h4>
              {comments.map(c => (
                <div key={c.id} className={cn("p-3 rounded-lg text-sm", c.is_supplier ? "bg-blue-50 dark:bg-blue-950/30 ml-4" : "bg-muted/50 mr-4")}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-xs">{c.author_name}</span>
                    <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}

              {/* Add comment */}
              <div className="space-y-2 pt-2 border-t">
                {!isSupplierView && (
                  <Input
                    value={commentAuthor}
                    onChange={e => setCommentAuthor(e.target.value)}
                    placeholder="Il tuo nome"
                    className="text-sm"
                  />
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Scrivi un messaggio..."
                    rows={2}
                    className="flex-1 text-sm"
                  />
                  <Button size="icon" className="flex-shrink-0 self-end" onClick={handleAddComment} disabled={isSubmitting}>
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            {nextActions.length > 0 && (
              <div className="space-y-2 pt-4 border-t">
                {nextActions.map(action => (
                  <Button
                    key={action.status}
                    variant={action.variant}
                    className="w-full py-5 text-base"
                    onClick={() => handleStatusUpdate(action.status)}
                    disabled={isSubmitting}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
