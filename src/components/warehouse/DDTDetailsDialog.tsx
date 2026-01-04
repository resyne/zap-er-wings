import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AttachmentPreview } from "@/components/warehouse/AttachmentPreview";
import { 
  Loader2, Calendar, Building2, User, ArrowDownToLine, ArrowUpFromLine, 
  FileText, Edit3, Save, X, ExternalLink, CheckCircle2, Clock, Receipt, Package
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface DDTDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ddt: {
    id: string;
    ddt_number: string;
    direction?: string | null;
    attachment_url?: string | null;
    document_date?: string | null;
    notes?: string | null;
    status?: string | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    work_order_id?: string | null;
    shipping_order_id?: string | null;
    ddt_data?: Record<string, unknown> | null;
    created_at?: string;
    customers?: { name: string; code: string } | null;
    suppliers?: { name: string; code: string } | null;
    work_orders?: { number: string; title: string } | null;
    shipping_orders?: { number: string } | null;
  } | null;
  onSuccess?: () => void;
}

interface DDTItem {
  id: string;
  description: string;
  quantity: number;
  unit?: string;
  notes?: string;
}

export function DDTDetailsDialog({ open, onOpenChange, ddt, onSuccess }: DDTDetailsDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DDTItem[]>([]);
  
  // Form state
  const [formData, setFormData] = useState({
    ddt_number: "",
    direction: "",
    document_date: "",
    notes: "",
    status: "",
  });
  
  const { toast } = useToast();

  useEffect(() => {
    if (ddt) {
      setFormData({
        ddt_number: ddt.ddt_number || "",
        direction: ddt.direction || "OUT",
        document_date: ddt.document_date || "",
        notes: ddt.notes || "",
        status: ddt.status || "da_verificare",
      });
      loadItems();
    }
    setIsEditing(false);
  }, [ddt]);

  const loadItems = async () => {
    if (!ddt) return;
    try {
      const { data, error } = await supabase
        .from("ddt_items")
        .select("*")
        .eq("ddt_id", ddt.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading DDT items:", error);
    }
  };

  const handleSave = async () => {
    if (!ddt) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("ddts")
        .update({
          ddt_number: formData.ddt_number,
          direction: formData.direction,
          document_date: formData.document_date || null,
          notes: formData.notes || null,
          status: formData.status,
        })
        .eq("id", ddt.id);

      if (error) throw error;

      toast({
        title: "DDT aggiornato",
        description: "Le modifiche sono state salvate con successo",
      });
      
      setIsEditing(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error updating DDT:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAttachmentUrl = (): string | null => {
    if (!ddt) return null;
    if (ddt.attachment_url) return ddt.attachment_url;
    if (ddt.ddt_data && typeof ddt.ddt_data === 'object') {
      const allegatoUrl = (ddt.ddt_data as Record<string, unknown>).allegato_url;
      if (typeof allegatoUrl === 'string') return allegatoUrl;
    }
    return null;
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: it });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "da_verificare":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" />Da verificare</Badge>;
      case "verificato":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300"><CheckCircle2 className="h-3 w-3 mr-1" />Verificato</Badge>;
      case "fatturato":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300"><Receipt className="h-3 w-3 mr-1" />Fatturato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDirectionBadge = (direction: string | null) => {
    if (direction === "IN") {
      return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><ArrowDownToLine className="h-3 w-3 mr-1" />Entrata</Badge>;
    }
    if (direction === "OUT") {
      return <Badge variant="secondary" className="bg-green-100 text-green-700"><ArrowUpFromLine className="h-3 w-3 mr-1" />Uscita</Badge>;
    }
    return null;
  };

  if (!ddt) return null;

  const attachmentUrl = getAttachmentUrl();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            DDT: {ddt.ddt_number}
            {!isEditing && (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)} className="ml-2">
                <Edit3 className="h-4 w-4 mr-1" />
                Modifica
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? "Modifica i dettagli del documento di trasporto" : "Dettagli del documento di trasporto"}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
          {/* Colonna sinistra: Preview */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documento allegato
              </h3>
              {attachmentUrl && (
                <Button variant="ghost" size="sm" asChild>
                  <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Apri
                  </a>
                </Button>
              )}
            </div>
            
            <div className="border rounded-lg overflow-hidden bg-muted/30 h-[calc(95vh-320px)] min-h-[300px]">
              {attachmentUrl ? (
                <AttachmentPreview url={attachmentUrl} alt="DDT allegato" className="h-full" />
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Nessun allegato disponibile
                </div>
              )}
            </div>
          </div>

          {/* Colonna destra: Dettagli/Form */}
          <ScrollArea className="h-[calc(95vh-320px)] min-h-[300px] pr-4">
            <div className="space-y-6">
              {/* Informazioni principali */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Informazioni DDT
                </h3>
                
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Numero DDT</Label>
                      <Input
                        value={formData.ddt_number}
                        onChange={(e) => setFormData({ ...formData, ddt_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Documento</Label>
                      <Input
                        type="date"
                        value={formData.document_date}
                        onChange={(e) => setFormData({ ...formData, document_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Direzione</Label>
                      <Select
                        value={formData.direction}
                        onValueChange={(value) => setFormData({ ...formData, direction: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="IN">Entrata (da fornitore)</SelectItem>
                          <SelectItem value="OUT">Uscita (a cliente)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Stato</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="da_verificare">Da verificare</SelectItem>
                          <SelectItem value="verificato">Verificato</SelectItem>
                          <SelectItem value="fatturato">Fatturato</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2 space-y-2">
                      <Label>Note</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                    <div>
                      <div className="text-xs text-muted-foreground">Numero DDT</div>
                      <div className="font-medium">{ddt.ddt_number}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Data Documento</div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(ddt.document_date)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Direzione</div>
                      <div className="mt-1">{getDirectionBadge(ddt.direction)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Stato</div>
                      <div className="mt-1">{getStatusBadge(ddt.status)}</div>
                    </div>
                    {ddt.notes && (
                      <div className="col-span-2">
                        <div className="text-xs text-muted-foreground">Note</div>
                        <div className="text-sm mt-1">{ddt.notes}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Controparte */}
              <div className="space-y-4">
                <h3 className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Controparte
                </h3>
                <div className="p-4 bg-muted/50 rounded-lg">
                  {ddt.customers?.name ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{ddt.customers.name}</div>
                        <div className="text-xs text-muted-foreground">Cliente - {ddt.customers.code}</div>
                      </div>
                    </div>
                  ) : ddt.suppliers?.name ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{ddt.suppliers.name}</div>
                        <div className="text-xs text-muted-foreground">Fornitore - {ddt.suppliers.code}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">Nessuna controparte assegnata</div>
                  )}
                </div>
              </div>

              {/* Collegamento Commessa */}
              {ddt.work_orders?.number && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-medium">Collegamento Commessa</h3>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="font-medium">{ddt.work_orders.number}</div>
                      {ddt.work_orders.title && (
                        <div className="text-sm text-muted-foreground">{ddt.work_orders.title}</div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Articoli */}
              {items.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Articoli ({items.length})
                    </h3>
                    <div className="space-y-2">
                      {items.map((item, index) => (
                        <div key={item.id} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-sm">{item.description}</div>
                              {item.notes && (
                                <div className="text-xs text-muted-foreground mt-1">{item.notes}</div>
                              )}
                            </div>
                            <Badge variant="secondary">
                              {item.quantity} {item.unit || "pz"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Metadati */}
              <Separator />
              <div className="text-xs text-muted-foreground space-y-1">
                {ddt.created_at && (
                  <div>Caricato: {format(new Date(ddt.created_at), "dd/MM/yyyy HH:mm", { locale: it })}</div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-2">
          <div className="flex justify-end items-center w-full gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
                  <X className="h-4 w-4 mr-1" />
                  Annulla
                </Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-1" />
                  Salva modifiche
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Chiudi
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
