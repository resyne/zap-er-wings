import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Loader2, Upload, ArrowDownToLine, ArrowUpFromLine, FileText, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface UploadDDTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface WorkOrder {
  id: string;
  number: string;
  title: string;
}

export function UploadDDTDialog({ open, onOpenChange, onSuccess }: UploadDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  
  const [formData, setFormData] = useState({
    direction: "" as "IN" | "OUT" | "",
    attachmentUrl: "",
    attachmentName: "",
    documentDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    workOrderId: "",
  });

  useEffect(() => {
    if (open) {
      loadWorkOrders();
      // Reset form
      setFormData({
        direction: "",
        attachmentUrl: "",
        attachmentName: "",
        documentDate: format(new Date(), "yyyy-MM-dd"),
        notes: "",
        workOrderId: "",
      });
    }
  }, [open]);

  const loadWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id, number, title")
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setWorkOrders(data || []);
    } catch (error) {
      console.error("Error loading work orders:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo file non supportato",
        description: "Carica un'immagine (JPG, PNG, WebP) o un PDF",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File troppo grande",
        description: "Il file non può superare i 10MB",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `ddt_${Date.now()}.${fileExt}`;
      const filePath = `ddts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath);

      setFormData(prev => ({
        ...prev,
        attachmentUrl: publicUrl,
        attachmentName: file.name,
      }));

      toast({
        title: "File caricato",
        description: "Il documento è stato caricato con successo",
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        title: "Errore caricamento",
        description: "Impossibile caricare il file",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setFormData(prev => ({
      ...prev,
      attachmentUrl: "",
      attachmentName: "",
    }));
  };

  const generateDDTNumber = async () => {
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from("ddts")
      .select("ddt_number")
      .like("ddt_number", `${year}/%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error fetching last DDT number:", error);
      return `${year}/1`;
    }

    if (!data || data.length === 0) {
      return `${year}/1`;
    }

    const lastNumber = parseInt(data[0].ddt_number.split("/")[1]);
    return `${year}/${lastNumber + 1}`;
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.direction) {
      toast({
        title: "Direzione obbligatoria",
        description: "Seleziona se è merce ricevuta o consegnata",
        variant: "destructive",
      });
      return;
    }

    if (!formData.attachmentUrl) {
      toast({
        title: "Documento obbligatorio",
        description: "Carica la foto o il PDF del DDT",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const user = await supabase.auth.getUser();
      const ddtNumber = await generateDDTNumber();

      const { error } = await supabase.from("ddts").insert({
        ddt_number: ddtNumber,
        direction: formData.direction,
        attachment_url: formData.attachmentUrl,
        document_date: formData.documentDate,
        notes: formData.notes || null,
        work_order_id: formData.workOrderId || null,
        uploaded_by: user.data.user?.id,
        uploaded_at: new Date().toISOString(),
        status: "da_verificare",
        admin_status: "da_fatturare",
        ddt_data: {
          scansionato: true,
          original_filename: formData.attachmentName,
        },
      });

      if (error) throw error;

      toast({
        title: "DDT caricato",
        description: `DDT ${ddtNumber} registrato con successo`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error creating DDT:", error);
      toast({
        title: "Errore",
        description: "Impossibile salvare il DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const isValid = formData.direction && formData.attachmentUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Carica DDT</DialogTitle>
          <DialogDescription>
            Registra un documento di trasporto con foto o PDF
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Direzione - OBBLIGATORIO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Direzione movimento <span className="text-destructive">*</span>
            </Label>
            <RadioGroup
              value={formData.direction}
              onValueChange={(value) => setFormData(prev => ({ ...prev, direction: value as "IN" | "OUT" }))}
              className="grid grid-cols-2 gap-4"
            >
              <div className="relative">
                <RadioGroupItem value="IN" id="direction-in" className="peer sr-only" />
                <Label
                  htmlFor="direction-in"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                >
                  <ArrowDownToLine className="h-6 w-6 mb-2 text-blue-600" />
                  <span className="font-medium">Ritiro</span>
                  <span className="text-xs text-muted-foreground">Merce ricevuta</span>
                </Label>
              </div>
              <div className="relative">
                <RadioGroupItem value="OUT" id="direction-out" className="peer sr-only" />
                <Label
                  htmlFor="direction-out"
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                >
                  <ArrowUpFromLine className="h-6 w-6 mb-2 text-green-600" />
                  <span className="font-medium">Consegna</span>
                  <span className="text-xs text-muted-foreground">Merce consegnata</span>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Allegato DDT - OBBLIGATORIO */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Documento DDT <span className="text-destructive">*</span>
            </Label>
            {formData.attachmentUrl ? (
              <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{formData.attachmentName}</p>
                  <p className="text-xs text-muted-foreground">Documento caricato</p>
                </div>
                <Button variant="ghost" size="icon" onClick={removeAttachment}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={uploading}
                />
                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 hover:border-primary transition-colors">
                  {uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">
                        Clicca o trascina per caricare
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        JPG, PNG, PDF (max 10MB)
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Data documento */}
          <div className="space-y-2">
            <Label htmlFor="documentDate">Data ritiro/consegna</Label>
            <Input
              id="documentDate"
              type="date"
              value={formData.documentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, documentDate: e.target.value }))}
            />
          </div>

          {/* Collegamento commessa (opzionale) */}
          <div className="space-y-2">
            <Label htmlFor="workOrder">Collega a commessa (opzionale)</Label>
            <Select
              value={formData.workOrderId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, workOrderId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona commessa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nessuna commessa</SelectItem>
                {workOrders.map((wo) => (
                  <SelectItem key={wo.id} value={wo.id}>
                    {wo.number} - {wo.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Note (opzionale) */}
          <div className="space-y-2">
            <Label htmlFor="notes">Note (opzionale)</Label>
            <Textarea
              id="notes"
              placeholder="Es. Consegnato impianto, Ritiro materiale urgente..."
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Carica DDT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
