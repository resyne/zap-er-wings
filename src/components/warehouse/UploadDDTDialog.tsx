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
import { Loader2, Upload, ArrowDownToLine, ArrowUpFromLine, FileText, X, Plus, Trash2, Sparkles, Check } from "lucide-react";
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

interface Customer {
  id: string;
  name: string;
  company_name: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

interface DDTItem {
  id: string;
  description: string;
  quantity: number;
  unit: string;
}

interface ExtractedData {
  counterpart_name?: string;
  counterpart_address?: string;
  counterpart_vat?: string;
  ddt_number?: string;
  ddt_date?: string;
  items?: Array<{ description: string; quantity: number; unit?: string }>;
  notes?: string;
}

export function UploadDDTDialog({ open, onOpenChange, onSuccess }: UploadDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [formData, setFormData] = useState({
    direction: "" as "IN" | "OUT" | "",
    attachmentUrl: "",
    attachmentName: "",
    documentDate: format(new Date(), "yyyy-MM-dd"),
    notes: "",
    workOrderId: "",
    counterpartType: "" as "customer" | "supplier" | "",
    customerId: "",
    supplierId: "",
    officialDdtNumber: "",
    officialDocumentDate: "",
  });

  const [items, setItems] = useState<DDTItem[]>([]);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);

  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  // Auto-set counterpart type based on direction
  useEffect(() => {
    if (formData.direction === "IN") {
      setFormData(prev => ({ ...prev, counterpartType: "supplier", customerId: "" }));
    } else if (formData.direction === "OUT") {
      setFormData(prev => ({ ...prev, counterpartType: "customer", supplierId: "" }));
    }
  }, [formData.direction]);

  const resetForm = () => {
    setFormData({
      direction: "",
      attachmentUrl: "",
      attachmentName: "",
      documentDate: format(new Date(), "yyyy-MM-dd"),
      notes: "",
      workOrderId: "",
      counterpartType: "",
      customerId: "",
      supplierId: "",
      officialDdtNumber: "",
      officialDocumentDate: "",
    });
    setItems([]);
    setExtractedData(null);
  };

  const loadData = async () => {
    try {
      const [woRes, custRes, suppRes] = await Promise.all([
        supabase.from("work_orders").select("id, number, title").order("created_at", { ascending: false }).limit(50),
        supabase.from("customers").select("id, name, company_name").order("name").limit(100),
        supabase.from("suppliers").select("id, name").order("name").limit(100),
      ]);
      
      setWorkOrders(woRes.data || []);
      setCustomers(custRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "Tipo file non supportato",
        description: "Carica un'immagine (JPG, PNG, WebP) o un PDF",
        variant: "destructive",
      });
      return;
    }

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
        description: "Ora puoi analizzarlo con l'AI",
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

  const analyzeWithAI = async () => {
    if (!formData.attachmentUrl || !formData.direction) {
      toast({
        title: "Dati mancanti",
        description: "Carica un documento e seleziona la direzione prima di analizzare",
        variant: "destructive",
      });
      return;
    }

    try {
      setAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke('analyze-ddt', {
        body: { 
          imageUrl: formData.attachmentUrl,
          direction: formData.direction 
        }
      });

      if (error) throw error;

      if (!data.success) {
        throw new Error(data.error || 'Analisi fallita');
      }

      const extracted = data.data as ExtractedData;
      setExtractedData(extracted);

      // Auto-fill form fields
      if (extracted.ddt_number) {
        setFormData(prev => ({ ...prev, officialDdtNumber: extracted.ddt_number || "" }));
      }
      if (extracted.ddt_date) {
        setFormData(prev => ({ ...prev, officialDocumentDate: extracted.ddt_date || "" }));
      }
      if (extracted.notes) {
        setFormData(prev => ({ ...prev, notes: extracted.notes || "" }));
      }

      // Auto-fill items
      if (extracted.items && extracted.items.length > 0) {
        setItems(extracted.items.map((item, idx) => ({
          id: `ai-${idx}`,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "pz",
        })));
      }

      toast({
        title: "Analisi completata",
        description: `Trovati ${extracted.items?.length || 0} articoli. Verifica i dati e conferma.`,
      });
    } catch (error) {
      console.error("Error analyzing DDT:", error);
      toast({
        title: "Errore analisi",
        description: error instanceof Error ? error.message : "Impossibile analizzare il documento",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const removeAttachment = () => {
    setFormData(prev => ({
      ...prev,
      attachmentUrl: "",
      attachmentName: "",
    }));
    setExtractedData(null);
    setItems([]);
  };

  const addItem = () => {
    setItems(prev => [...prev, {
      id: `item-${Date.now()}`,
      description: "",
      quantity: 1,
      unit: "pz",
    }]);
  };

  const updateItem = (id: string, field: keyof DDTItem, value: string | number) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const generateDDTNumber = async () => {
    const year = new Date().getFullYear();
    const { data, error } = await supabase
      .from("ddts")
      .select("ddt_number")
      .like("ddt_number", `${year}/%`)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) {
      return `${year}/1`;
    }

    const lastNumber = parseInt(data[0].ddt_number.split("/")[1]);
    return `${year}/${lastNumber + 1}`;
  };

  const handleSubmit = async () => {
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

      const insertData = {
        ddt_number: ddtNumber,
        direction: formData.direction,
        attachment_url: formData.attachmentUrl,
        document_date: formData.documentDate,
        notes: formData.notes || null,
        work_order_id: formData.workOrderId || null,
        counterpart_type: formData.counterpartType || null,
        customer_id: formData.customerId || null,
        supplier_id: formData.supplierId || null,
        official_document_date: formData.officialDocumentDate || null,
        uploaded_by: user.data.user?.id,
        uploaded_at: new Date().toISOString(),
        status: "da_verificare",
        admin_status: "da_fatturare",
        ddt_data: JSON.parse(JSON.stringify({
          scansionato: true,
          original_filename: formData.attachmentName,
          ai_extracted: extractedData || null,
          official_ddt_number: formData.officialDdtNumber || null,
        })),
      };

      const { data: ddtData, error: ddtError } = await supabase
        .from("ddts")
        .insert([insertData])
        .select()
        .single();

      if (ddtError) throw ddtError;

      // Insert items if any
      if (items.length > 0 && ddtData) {
        const itemsToInsert = items
          .filter(item => item.description.trim())
          .map(item => ({
            ddt_id: ddtData.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase.from("ddt_items").insert(itemsToInsert);
          if (itemsError) {
            console.error("Error inserting DDT items:", itemsError);
          }
        }
      }

      toast({
        title: "DDT caricato",
        description: `DDT ${ddtNumber} registrato con ${items.length} articoli`,
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Carica DDT</DialogTitle>
          <DialogDescription>
            Carica un DDT e usa l'AI per estrarre automaticamente i dati
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
                  <span className="text-xs text-muted-foreground">Merce ricevuta (da fornitore)</span>
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
                  <span className="text-xs text-muted-foreground">Merce consegnata (a cliente)</span>
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
              <div className="space-y-3">
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
                
                {/* AI Analysis button */}
                {formData.direction && (
                  <Button 
                    onClick={analyzeWithAI} 
                    disabled={analyzing}
                    variant="outline"
                    className="w-full"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Analisi in corso...
                      </>
                    ) : extractedData ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Rianalizza con AI
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analizza con AI
                      </>
                    )}
                  </Button>
                )}

                {extractedData?.counterpart_name && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <p className="text-sm text-green-800 dark:text-green-200">
                      <strong>Controparte rilevata:</strong> {extractedData.counterpart_name}
                      {extractedData.counterpart_vat && ` (P.IVA: ${extractedData.counterpart_vat})`}
                    </p>
                  </div>
                )}
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

          {/* Controparte */}
          {formData.direction && (
            <div className="space-y-2">
              <Label>
                {formData.direction === "IN" ? "Fornitore" : "Cliente"} (opzionale)
              </Label>
              {formData.direction === "IN" ? (
                <Select
                  value={formData.supplierId || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fornitore..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun fornitore</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={formData.customerId || "none"}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, customerId: value === "none" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun cliente</SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name || c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Numero DDT ufficiale e data */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="officialDdtNumber">Numero DDT (dal documento)</Label>
              <Input
                id="officialDdtNumber"
                value={formData.officialDdtNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, officialDdtNumber: e.target.value }))}
                placeholder="Es. 123/2026"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="officialDocumentDate">Data documento</Label>
              <Input
                id="officialDocumentDate"
                type="date"
                value={formData.officialDocumentDate}
                onChange={(e) => setFormData(prev => ({ ...prev, officialDocumentDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Data ritiro/consegna */}
          <div className="space-y-2">
            <Label htmlFor="documentDate">Data ritiro/consegna</Label>
            <Input
              id="documentDate"
              type="date"
              value={formData.documentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, documentDate: e.target.value }))}
            />
          </div>

          {/* Articoli */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Articoli / Materiali</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Aggiungi
              </Button>
            </div>
            
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border rounded-lg border-dashed">
                Nessun articolo. Usa l'AI per estrarre automaticamente o aggiungi manualmente.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, index) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        placeholder="Descrizione articolo"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      />
                    </div>
                    <div className="w-20">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="Qtà"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="w-20">
                      <Select
                        value={item.unit}
                        onValueChange={(value) => updateItem(item.id, "unit", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pz">pz</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="m">m</SelectItem>
                          <SelectItem value="mq">mq</SelectItem>
                          <SelectItem value="lt">lt</SelectItem>
                          <SelectItem value="conf">conf</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Collegamento commessa (opzionale) */}
          <div className="space-y-2">
            <Label htmlFor="workOrder">Collega a commessa (opzionale)</Label>
            <Select
              value={formData.workOrderId || "none"}
              onValueChange={(value) => setFormData(prev => ({ ...prev, workOrderId: value === "none" ? "" : value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleziona commessa..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nessuna commessa</SelectItem>
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
            <Label htmlFor="notes">Note / Causale (opzionale)</Label>
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
