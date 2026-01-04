import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Building2, User, ArrowDownToLine, ArrowUpFromLine, 
  ExternalLink, Sparkles, Plus, Trash2, Package, FileText,
  Calendar, MapPin, Link2, ClipboardList
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface VerifyDDTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ddt: {
    id: string;
    ddt_number: string;
    direction?: string | null;
    attachment_url?: string | null;
    document_date?: string | null;
    customer_id?: string | null;
    supplier_id?: string | null;
    official_document_date?: string | null;
    counterpart_type?: string | null;
    notes?: string | null;
    status?: string | null;
    work_order_id?: string | null;
    created_at?: string | null;
    uploaded_by?: string | null;
  } | null;
  onSuccess?: () => void;
}

interface Customer {
  id: string;
  name: string;
  code: string;
}

interface Supplier {
  id: string;
  name: string;
  code: string;
}

interface WorkOrder {
  id: string;
  number: string;
  title?: string | null;
}

interface DDTItem {
  id?: string;
  description: string;
  quantity: number;
  unit: string;
  notes?: string;
}

export function VerifyDDTDialog({ open, onOpenChange, ddt, onSuccess }: VerifyDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [items, setItems] = useState<DDTItem[]>([]);
  const [existingItems, setExistingItems] = useState<DDTItem[]>([]);
  
  const [formData, setFormData] = useState({
    // Identificazione
    direction: "" as "IN" | "OUT" | "",
    ddtNumber: "",
    ddtDate: "",
    // Controparte
    counterpartType: "" as "customer" | "supplier" | "",
    customerId: "",
    supplierId: "",
    // Magazzino
    warehouse: "sede-principale",
    warehouseStatus: "da_verificare" as "da_verificare" | "confermato",
    // Collegamenti
    workOrderId: "",
    serviceReportId: "",
    projectId: "",
    // Stato
    status: "da_verificare" as "da_verificare" | "verificato" | "da_fatturare" | "fatturato" | "annullato",
    // Note
    notes: "",
  });

  useEffect(() => {
    if (open && ddt) {
      loadData();
      loadExistingItems();
      
      // Pre-fill form with existing data
      setFormData({
        direction: (ddt.direction as "IN" | "OUT") || "",
        ddtNumber: ddt.ddt_number || "",
        ddtDate: ddt.official_document_date || ddt.document_date || "",
        counterpartType: (ddt.counterpart_type as "customer" | "supplier") || 
                        (ddt.direction === "OUT" ? "customer" : ddt.direction === "IN" ? "supplier" : ""),
        customerId: ddt.customer_id || "",
        supplierId: ddt.supplier_id || "",
        warehouse: "sede-principale",
        warehouseStatus: "da_verificare",
        workOrderId: ddt.work_order_id || "",
        serviceReportId: "",
        projectId: "",
        status: (ddt.status as typeof formData.status) || "da_verificare",
        notes: ddt.notes || "",
      });
    }
  }, [open, ddt]);

  const loadData = async () => {
    try {
      const [customersRes, suppliersRes, workOrdersRes] = await Promise.all([
        supabase.from("customers").select("id, name, code").order("name").limit(100),
        supabase.from("suppliers").select("id, name, code").order("name").limit(100),
        supabase.from("work_orders").select("id, number, title").order("created_at", { ascending: false }).limit(50),
      ]);
      
      setCustomers(customersRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setWorkOrders(workOrdersRes.data || []);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadExistingItems = async () => {
    if (!ddt?.id) return;
    try {
      const { data } = await supabase
        .from("ddt_items")
        .select("*")
        .eq("ddt_id", ddt.id);
      
      if (data && data.length > 0) {
        setExistingItems(data.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "pz",
          notes: item.notes || "",
        })));
        setItems(data.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "pz",
          notes: item.notes || "",
        })));
      } else {
        setItems([]);
        setExistingItems([]);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const analyzeWithAI = async () => {
    if (!ddt?.attachment_url) {
      toast({
        title: "Nessun allegato",
        description: "Non è presente un documento da analizzare",
        variant: "destructive",
      });
      return;
    }

    try {
      setAnalyzing(true);
      
      const { data, error } = await supabase.functions.invoke("analyze-ddt", {
        body: { 
          imageUrl: ddt.attachment_url,
          direction: formData.direction || ddt.direction || "IN"
        }
      });

      if (error) throw error;

      if (data) {
        // Auto-fill form fields
        if (data.ddt_number) {
          setFormData(prev => ({ ...prev, ddtNumber: data.ddt_number }));
        }
        if (data.ddt_date) {
          setFormData(prev => ({ ...prev, ddtDate: data.ddt_date }));
        }
        if (data.notes) {
          setFormData(prev => ({ ...prev, notes: data.notes }));
        }

        // Auto-fill items
        if (data.items && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items.map((item: { description?: string; quantity?: number; unit?: string }) => ({
            description: item.description || "",
            quantity: item.quantity || 1,
            unit: item.unit || "pz",
          })));
        }

        toast({
          title: "Analisi completata",
          description: "I dati sono stati estratti dal documento",
        });
      }
    } catch (error) {
      console.error("Error analyzing DDT:", error);
      toast({
        title: "Errore analisi",
        description: "Impossibile analizzare il documento",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, unit: "pz" }]);
  };

  const updateItem = (index: number, field: keyof DDTItem, value: string | number) => {
    setItems(items.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!ddt) return;

    // Validation
    if (!formData.direction) {
      toast({
        title: "Direzione obbligatoria",
        description: "Seleziona se è un DDT in entrata o in uscita",
        variant: "destructive",
      });
      return;
    }

    if (!formData.counterpartType) {
      toast({
        title: "Controparte obbligatoria",
        description: "Seleziona se è un cliente o un fornitore",
        variant: "destructive",
      });
      return;
    }

    if (formData.counterpartType === "customer" && !formData.customerId) {
      toast({
        title: "Cliente obbligatorio",
        description: "Seleziona il cliente",
        variant: "destructive",
      });
      return;
    }

    if (formData.counterpartType === "supplier" && !formData.supplierId) {
      toast({
        title: "Fornitore obbligatorio",
        description: "Seleziona il fornitore",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      const updateData: Record<string, unknown> = {
        direction: formData.direction,
        ddt_number: formData.ddtNumber,
        official_document_date: formData.ddtDate || null,
        counterpart_type: formData.counterpartType,
        status: formData.status,
        notes: formData.notes,
        work_order_id: formData.workOrderId || null,
      };

      if (formData.counterpartType === "customer") {
        updateData.customer_id = formData.customerId;
        updateData.supplier_id = null;
      } else {
        updateData.supplier_id = formData.supplierId;
        updateData.customer_id = null;
      }

      const { error: ddtError } = await supabase
        .from("ddts")
        .update(updateData)
        .eq("id", ddt.id);

      if (ddtError) throw ddtError;

      // Delete existing items and insert new ones
      await supabase.from("ddt_items").delete().eq("ddt_id", ddt.id);

      if (items.length > 0) {
        const itemsToInsert = items
          .filter(item => item.description.trim())
          .map(item => ({
            ddt_id: ddt.id,
            description: item.description,
            quantity: item.quantity,
            unit: item.unit,
            notes: item.notes || null,
          }));

        if (itemsToInsert.length > 0) {
          const { error: itemsError } = await supabase
            .from("ddt_items")
            .insert(itemsToInsert);

          if (itemsError) throw itemsError;
        }
      }

      toast({
        title: "DDT completato",
        description: `DDT ${formData.ddtNumber} salvato con successo`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error completing DDT:", error);
      toast({
        title: "Errore",
        description: "Impossibile completare il DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!ddt) return null;

  const isValid = formData.direction && formData.counterpartType && formData.ddtNumber &&
    ((formData.counterpartType === "customer" && formData.customerId) || 
     (formData.counterpartType === "supplier" && formData.supplierId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Completa DDT: {ddt.ddt_number}
          </DialogTitle>
          <DialogDescription>
            Compila tutti i dati amministrativi del documento di trasporto
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Allegato e AI */}
            {ddt.attachment_url && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Documento allegato
                  </Label>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={analyzeWithAI}
                      disabled={analyzing}
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2 text-amber-500" />
                      )}
                      Analizza con AI
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={ddt.attachment_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Apri
                      </a>
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden bg-muted/30 h-40">
                  {ddt.attachment_url.toLowerCase().endsWith('.pdf') ? (
                    <iframe 
                      src={ddt.attachment_url} 
                      className="w-full h-full"
                      title="DDT Preview"
                    />
                  ) : (
                    <img 
                      src={ddt.attachment_url} 
                      alt="DDT" 
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              </div>
            )}

            <Separator />

            {/* SEZIONE: Identificazione */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <ClipboardList className="h-4 w-4" />
                Identificazione
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Direzione */}
                <div className="space-y-2">
                  <Label>Direzione movimento <span className="text-destructive">*</span></Label>
                  <RadioGroup
                    value={formData.direction}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      direction: value as "IN" | "OUT",
                      counterpartType: value === "IN" ? "supplier" : "customer",
                      customerId: "",
                      supplierId: "",
                    }))}
                    className="grid grid-cols-2 gap-2"
                  >
                    <div className="relative">
                      <RadioGroupItem value="IN" id="dir-in" className="peer sr-only" />
                      <Label
                        htmlFor="dir-in"
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                        <span>IN (Entrata)</span>
                      </Label>
                    </div>
                    <div className="relative">
                      <RadioGroupItem value="OUT" id="dir-out" className="peer sr-only" />
                      <Label
                        htmlFor="dir-out"
                        className="flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <ArrowUpFromLine className="h-4 w-4 text-green-600" />
                        <span>OUT (Uscita)</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Stato DDT */}
                <div className="space-y-2">
                  <Label>Stato DDT</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as typeof formData.status }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_verificare">Da verificare</SelectItem>
                      <SelectItem value="verificato">Verificato</SelectItem>
                      <SelectItem value="da_fatturare">Da fatturare</SelectItem>
                      <SelectItem value="fatturato">Fatturato</SelectItem>
                      <SelectItem value="annullato">Annullato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Numero DDT */}
                <div className="space-y-2">
                  <Label>Numero DDT <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Es. 2026/001"
                    value={formData.ddtNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, ddtNumber: e.target.value }))}
                  />
                </div>

                {/* Data DDT */}
                <div className="space-y-2">
                  <Label>Data DDT</Label>
                  <Input
                    type="date"
                    value={formData.ddtDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, ddtDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* SEZIONE: Controparte */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4" />
                Controparte
              </h3>

              <div className="space-y-3">
                <RadioGroup
                  value={formData.counterpartType}
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    counterpartType: value as "customer" | "supplier",
                    customerId: "",
                    supplierId: "",
                  }))}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="relative">
                    <RadioGroupItem value="supplier" id="type-supplier" className="peer sr-only" />
                    <Label
                      htmlFor="type-supplier"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <Building2 className="h-6 w-6 mb-2 text-orange-600" />
                      <span className="font-medium">Fornitore</span>
                      <span className="text-xs text-muted-foreground">DDT acquisto</span>
                    </Label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem value="customer" id="type-customer" className="peer sr-only" />
                    <Label
                      htmlFor="type-customer"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                    >
                      <User className="h-6 w-6 mb-2 text-blue-600" />
                      <span className="font-medium">Cliente</span>
                      <span className="text-xs text-muted-foreground">DDT vendita</span>
                    </Label>
                  </div>
                </RadioGroup>

                {formData.counterpartType === "supplier" && (
                  <Select
                    value={formData.supplierId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, supplierId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona fornitore..." />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {formData.counterpartType === "customer" && (
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, customerId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.code} - {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <Separator />

            {/* SEZIONE: Merce */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4" />
                  Merce
                </h3>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi riga
                </Button>
              </div>

              {items.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nessun articolo inserito</p>
                  <Button variant="link" size="sm" onClick={addItem}>
                    Aggiungi il primo articolo
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-start p-3 border rounded-lg bg-muted/30">
                      <div className="col-span-6 space-y-1">
                        <Label className="text-xs">Descrizione</Label>
                        <Input
                          placeholder="Descrizione merce..."
                          value={item.description}
                          onChange={(e) => updateItem(index, "description", e.target.value)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Quantità</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Unità</Label>
                        <Select
                          value={item.unit}
                          onValueChange={(value) => updateItem(index, "unit", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pz">pz</SelectItem>
                            <SelectItem value="kg">kg</SelectItem>
                            <SelectItem value="lt">lt</SelectItem>
                            <SelectItem value="mt">mt</SelectItem>
                            <SelectItem value="mq">mq</SelectItem>
                            <SelectItem value="mc">mc</SelectItem>
                            <SelectItem value="conf">conf</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2 flex items-end justify-end h-full pb-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* SEZIONE: Magazzino */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Magazzino
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Deposito / Sede</Label>
                  <Select
                    value={formData.warehouse}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, warehouse: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sede-principale">Sede principale</SelectItem>
                      <SelectItem value="magazzino-esterno">Magazzino esterno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Stato movimento magazzino</Label>
                  <Select
                    value={formData.warehouseStatus}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, warehouseStatus: value as typeof formData.warehouseStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_verificare">Da verificare</SelectItem>
                      <SelectItem value="confermato">Confermato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* SEZIONE: Collegamenti */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2 text-sm">
                <Link2 className="h-4 w-4" />
                Collegamenti
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ordine / Commessa</Label>
                  <Select
                    value={formData.workOrderId || "__none__"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, workOrderId: value === "__none__" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona commessa..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Nessuna</SelectItem>
                      {workOrders.map((wo) => (
                        <SelectItem key={wo.id} value={wo.id}>
                          {wo.number} - {wo.title?.substring(0, 30)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Rapporto intervento</Label>
                  <Input
                    placeholder="ID rapporto..."
                    value={formData.serviceReportId}
                    onChange={(e) => setFormData(prev => ({ ...prev, serviceReportId: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Note */}
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                placeholder="Note aggiuntive..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Audit info */}
            {(ddt.created_at || ddt.uploaded_by) && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4" />
                    Audit
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                    {ddt.created_at && (
                      <div>
                        <span className="font-medium">Data caricamento:</span>{" "}
                        {new Date(ddt.created_at).toLocaleString("it-IT")}
                      </div>
                    )}
                    {ddt.uploaded_by && (
                      <div>
                        <span className="font-medium">Utente:</span> {ddt.uploaded_by}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>

        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          <div className="text-xs text-muted-foreground">
            {items.length > 0 && (
              <Badge variant="secondary">{items.length} articol{items.length === 1 ? 'o' : 'i'}</Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button onClick={handleSubmit} disabled={!isValid || loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Completa DDT
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
