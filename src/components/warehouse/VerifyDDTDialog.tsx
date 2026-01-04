import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { pdfFirstPageToPngBlob } from "@/lib/pdfFirstPageToPng";
import { 
  Loader2, Building2, User, ArrowDownToLine, ArrowUpFromLine, 
  ExternalLink, Sparkles, Plus, Trash2, Package, FileText,
  Calendar, MapPin, Link2, ClipboardList, UserPlus, Check
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AttachmentPreview } from "@/components/warehouse/AttachmentPreview";

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
    ddt_data?: Record<string, unknown> | null;
  } | null;
  onSuccess?: () => void;
}

// Helper to get attachment URL from ddt (checks both attachment_url and ddt_data.allegato_url)
const getAttachmentUrl = (ddt: VerifyDDTDialogProps['ddt']): string | null => {
  if (!ddt) return null;
  if (ddt.attachment_url) return ddt.attachment_url;
  if (ddt.ddt_data && typeof ddt.ddt_data === 'object') {
    const allegatoUrl = (ddt.ddt_data as Record<string, unknown>).allegato_url;
    if (typeof allegatoUrl === 'string') return allegatoUrl;
  }
  return null;
};

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

interface ExtractedCounterpart {
  name: string;
  address?: string;
  vat?: string;
  matched?: boolean;
  matchedId?: string;
}

export function VerifyDDTDialog({ open, onOpenChange, ddt, onSuccess }: VerifyDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [items, setItems] = useState<DDTItem[]>([]);
  const [extractedCounterpart, setExtractedCounterpart] = useState<ExtractedCounterpart | null>(null);
  const [creatingCounterpart, setCreatingCounterpart] = useState(false);
  
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
      setExtractedCounterpart(null);
      
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
        setItems(data.map(item => ({
          id: item.id,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit || "pz",
          notes: item.notes || "",
        })));
      } else {
        setItems([]);
      }
    } catch (error) {
      console.error("Error loading items:", error);
    }
  };

  const findOrCreateCounterpart = async (name: string, address?: string, vat?: string): Promise<{ id: string; isNew: boolean } | null> => {
    const isSupplier = formData.counterpartType === "supplier";
    const table = isSupplier ? "suppliers" : "customers";
    
    // Search by name (case insensitive)
    const searchName = name.trim().toLowerCase();
    
    try {
      // Try to find existing
      const { data: existing } = await supabase
        .from(table)
        .select("id, name")
        .ilike("name", `%${searchName}%`)
        .limit(1);
      
      if (existing && existing.length > 0) {
        return { id: existing[0].id, isNew: false };
      }

      // If VAT provided, try to find by VAT
      if (vat) {
        const { data: existingByVat } = await supabase
          .from(table)
          .select("id, name")
          .eq("tax_id", vat.trim())
          .limit(1);
        
        if (existingByVat && existingByVat.length > 0) {
          return { id: existingByVat[0].id, isNew: false };
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding counterpart:", error);
      return null;
    }
  };

  const createCounterpart = async () => {
    if (!extractedCounterpart?.name) return;

    setCreatingCounterpart(true);
    const isSupplier = formData.counterpartType === "supplier";
    const table = isSupplier ? "suppliers" : "customers";

    try {
      // Generate code
      const prefix = isSupplier ? "F" : "C";
      const { count } = await supabase
        .from(table)
        .select("*", { count: "exact", head: true });
      
      const code = `${prefix}${String((count || 0) + 1).padStart(5, "0")}`;

      const insertData: Record<string, unknown> = {
        code,
        name: extractedCounterpart.name,
        address: extractedCounterpart.address || null,
        tax_id: extractedCounterpart.vat || null,
        incomplete_registry: true,
      };

      let data: { id: string } | null = null;
      let error: Error | null = null;
      
      if (isSupplier) {
        const result = await supabase
          .from("suppliers")
          .insert({ 
            code, 
            name: extractedCounterpart.name, 
            address: extractedCounterpart.address || null,
            tax_id: extractedCounterpart.vat || null,
            access_code: crypto.randomUUID().substring(0, 8)
          })
          .select("id")
          .single();
        data = result.data;
        error = result.error;
      } else {
        const result = await supabase
          .from("customers")
          .insert({ 
            code, 
            name: extractedCounterpart.name, 
            address: extractedCounterpart.address || null,
            tax_id: extractedCounterpart.vat || null,
            incomplete_registry: true 
          })
          .select("id")
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) throw error;
      if (!data) throw new Error("No data returned");

      // Update form and lists
      if (isSupplier) {
        setSuppliers(prev => [...prev, { id: data.id, name: extractedCounterpart.name, code }]);
        setFormData(prev => ({ ...prev, supplierId: data.id }));
      } else {
        setCustomers(prev => [...prev, { id: data.id, name: extractedCounterpart.name, code }]);
        setFormData(prev => ({ ...prev, customerId: data.id }));
      }

      setExtractedCounterpart(prev => prev ? { ...prev, matched: true, matchedId: data.id } : null);

      toast({
        title: isSupplier ? "Fornitore creato" : "Cliente creato",
        description: `${extractedCounterpart.name} è stato aggiunto all'anagrafica`,
      });
    } catch (error) {
      console.error("Error creating counterpart:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare l'anagrafica",
        variant: "destructive",
      });
    } finally {
      setCreatingCounterpart(false);
    }
  };

  const analyzeWithAI = async () => {
    const attachmentUrl = getAttachmentUrl(ddt);
    if (!attachmentUrl) {
      toast({
        title: "Nessun allegato",
        description: "Non è presente un documento da analizzare",
        variant: "destructive",
      });
      return;
    }

    try {
      setAnalyzing(true);

      // Se è un PDF, generiamo una preview PNG (prima pagina) e la usiamo per l'AI
      let urlForAI = attachmentUrl;
      const isPdf = (() => {
        try {
          return new URL(attachmentUrl).pathname.toLowerCase().endsWith(".pdf");
        } catch {
          return attachmentUrl.toLowerCase().includes(".pdf");
        }
      })();

      if (isPdf) {
        const res = await fetch(attachmentUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`Impossibile scaricare il PDF (HTTP ${res.status})`);

        const pdfBlob = await res.blob();
        const pdfFile = new File([pdfBlob], `ddt-${ddt?.id ?? Date.now()}.pdf`, {
          type: pdfBlob.type || "application/pdf",
        });

        const pngBlob = await pdfFirstPageToPngBlob(pdfFile, { maxWidth: 1600, maxScale: 2 });

        // Evitiamo upload su Storage (può fallire per policy): passiamo l'immagine in base64 direttamente alla function.
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error ?? new Error("Impossibile convertire la preview in base64"));
          reader.readAsDataURL(pngBlob);
        });

        urlForAI = dataUrl;
      }

      const { data, error } = await supabase.functions.invoke("analyze-ddt", {
        body: {
          imageUrl: urlForAI,
          direction: formData.direction || ddt?.direction || "IN",
        },
      });

      if (error) throw error;
      if (data?.success === false) {
        throw new Error(data.error || "AI analysis failed");
      }

      const extractedData = data?.data ?? data;

      if (extractedData) {
        // Auto-fill form fields
        if (extractedData.ddt_number) {
          setFormData((prev) => ({ ...prev, ddtNumber: extractedData.ddt_number }));
        }
        if (extractedData.ddt_date) {
          setFormData((prev) => ({ ...prev, ddtDate: extractedData.ddt_date }));
        }
        if (extractedData.notes) {
          setFormData((prev) => ({ ...prev, notes: extractedData.notes }));
        }

        // Auto-fill items
        if (extractedData.items && Array.isArray(extractedData.items) && extractedData.items.length > 0) {
          setItems(
            extractedData.items.map((item: { description?: string; quantity?: number; unit?: string }) => ({
              description: item.description || "",
              quantity: item.quantity || 1,
              unit: item.unit || "pz",
            }))
          );
        }

        // Logica per determinare fornitore/cliente:
        // Se il DESTINATARIO contiene "climatel" → è un DDT fornitore (noi riceviamo), usare INTESTAZIONE come fornitore
        // Se il DESTINATARIO NON contiene "climatel" → è un DDT cliente (noi spediamo), usare DESTINATARIO come cliente
        const destinatarioName = extractedData.destinatario_name?.toLowerCase() || "";
        const isClimatelDestinatario = destinatarioName.includes("climatel");

        let counterpartInfo: ExtractedCounterpart | null = null;
        let detectedCounterpartType: "supplier" | "customer" = "supplier";

        if (isClimatelDestinatario) {
          // DDT Fornitore: noi siamo il destinatario, usare INTESTAZIONE come fornitore
          detectedCounterpartType = "supplier";
          if (extractedData.intestazione_name) {
            counterpartInfo = {
              name: extractedData.intestazione_name,
              address: extractedData.intestazione_address,
              vat: extractedData.intestazione_vat,
            };
          }
          setFormData((prev) => ({ ...prev, direction: "IN", counterpartType: "supplier" }));
        } else {
          // DDT Cliente: noi spediamo, usare DESTINATARIO come cliente
          detectedCounterpartType = "customer";
          if (extractedData.destinatario_name) {
            counterpartInfo = {
              name: extractedData.destinatario_name,
              address: extractedData.destinatario_address || extractedData.destinazione_address,
              vat: extractedData.destinatario_vat,
            };
          }
          setFormData((prev) => ({ ...prev, direction: "OUT", counterpartType: "customer" }));
        }

        // Handle counterpart - fallback to old format if new fields not present
        if (!counterpartInfo && extractedData.counterpart_name) {
          counterpartInfo = {
            name: extractedData.counterpart_name,
            address: extractedData.counterpart_address,
            vat: extractedData.counterpart_vat,
          };
        }

        if (counterpartInfo) {
          // Try to find existing counterpart
          const found = await findOrCreateCounterpart(counterpartInfo.name, counterpartInfo.address, counterpartInfo.vat);

          if (found) {
            counterpartInfo.matched = true;
            counterpartInfo.matchedId = found.id;

            // Auto-select the counterpart
            if (detectedCounterpartType === "supplier") {
              setFormData((prev) => ({ ...prev, supplierId: found.id }));
            } else {
              setFormData((prev) => ({ ...prev, customerId: found.id }));
            }

            toast({
              title: "Controparte trovata",
              description: `${counterpartInfo.name} è già presente in anagrafica`,
            });
          } else {
            counterpartInfo.matched = false;
          }

          setExtractedCounterpart(counterpartInfo);
        }

        toast({
          title: "Analisi completata",
          description: "I dati sono stati estratti dal documento",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const name = typeof error === "object" && error && "name" in error ? String((error as any).name) : "";
      const isFetchBlocked = name === "FunctionsFetchError" || message.toLowerCase().includes("failed to fetch");

      console.error("Error analyzing DDT:", error);

      toast({
        title: "Errore analisi",
        description: isFetchBlocked
          ? "La richiesta all'AI è stata bloccata dal browser/estensioni. Disattiva AdBlock/uBlock/Brave Shields o metti in whitelist *.supabase.co."
          : "Impossibile analizzare il documento",
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
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Completa DDT: {ddt.ddt_number}
          </DialogTitle>
          <DialogDescription>
            Compila tutti i dati amministrativi del documento di trasporto
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 overflow-hidden">
          {/* Colonna sinistra: Preview scansione */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4" />
                Documento scansionato
              </Label>
              {(() => {
                const attachmentUrl = getAttachmentUrl(ddt);
                return (
                  <div className="flex gap-2">
                    <Button 
                      variant="default" 
                      size="sm" 
                      onClick={analyzeWithAI}
                      disabled={analyzing || !attachmentUrl}
                    >
                      {analyzing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Analizza con AI
                    </Button>
                    {attachmentUrl && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={attachmentUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })()}
            </div>
            
            {(() => {
              const attachmentUrl = getAttachmentUrl(ddt);
              if (!attachmentUrl) {
                return (
                  <div className="border rounded-lg border-dashed flex items-center justify-center h-[400px] text-muted-foreground">
                    <div className="text-center">
                      <FileText className="h-12 w-12 mx-auto mb-2 opacity-30" />
                      <p>Nessun documento allegato</p>
                    </div>
                  </div>
                );
              }

              // Mostra sempre l'anteprima come immagine (PDF → prima pagina)
              return (
                <div className="border rounded-lg overflow-hidden bg-muted/30 h-[calc(100vh-280px)] min-h-[400px]">
                  <AttachmentPreview
                    url={attachmentUrl}
                    alt={`Scansione DDT ${ddt.ddt_number}`}
                  />
                </div>
              );
            })()}

            {/* Alert per controparte estratta */}
            {extractedCounterpart && !extractedCounterpart.matched && (
              <Alert className="bg-amber-50 border-amber-200">
                <UserPlus className="h-4 w-4 text-amber-600" />
                <AlertDescription className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-amber-800">
                      {formData.counterpartType === "supplier" ? "Fornitore" : "Cliente"} non trovato
                    </p>
                    <p className="text-sm text-amber-700">
                      "{extractedCounterpart.name}" non è in anagrafica
                    </p>
                  </div>
                  <Button 
                    size="sm" 
                    onClick={createCounterpart}
                    disabled={creatingCounterpart}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    {creatingCounterpart ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-1" />
                        Crea
                      </>
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {extractedCounterpart?.matched && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <p className="font-medium text-green-800">
                    {formData.counterpartType === "supplier" ? "Fornitore" : "Cliente"} collegato
                  </p>
                  <p className="text-sm text-green-700">
                    "{extractedCounterpart.name}" trovato in anagrafica
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Colonna destra: Form */}
          <ScrollArea className="h-[calc(95vh-320px)] min-h-[300px] pr-4">
            <div className="space-y-6">
              {/* SEZIONE: Identificazione */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <ClipboardList className="h-4 w-4" />
                  Identificazione
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Direzione */}
                  <div className="space-y-2">
                    <Label>Direzione <span className="text-destructive">*</span></Label>
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
                          className="flex items-center justify-center gap-1 rounded-lg border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-sm"
                        >
                          <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                          IN
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="OUT" id="dir-out" className="peer sr-only" />
                        <Label
                          htmlFor="dir-out"
                          className="flex items-center justify-center gap-1 rounded-lg border-2 border-muted bg-popover p-2 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer text-sm"
                        >
                          <ArrowUpFromLine className="h-4 w-4 text-green-600" />
                          OUT
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
                    className="grid grid-cols-2 gap-3"
                  >
                    <div className="relative">
                      <RadioGroupItem value="supplier" id="type-supplier" className="peer sr-only" />
                      <Label
                        htmlFor="type-supplier"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <Building2 className="h-5 w-5 mb-1 text-orange-600" />
                        <span className="font-medium text-sm">Fornitore</span>
                      </Label>
                    </div>
                    <div className="relative">
                      <RadioGroupItem value="customer" id="type-customer" className="peer sr-only" />
                      <Label
                        htmlFor="type-customer"
                        className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
                      >
                        <User className="h-5 w-5 mb-1 text-blue-600" />
                        <span className="font-medium text-sm">Cliente</span>
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
                    Aggiungi
                  </Button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground border rounded-lg border-dashed">
                    <Package className="h-6 w-6 mx-auto mb-1 opacity-50" />
                    <p className="text-sm">Nessun articolo</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-end p-2 border rounded-lg bg-muted/30">
                        <div className="col-span-6">
                          <Input
                            placeholder="Descrizione..."
                            value={item.description}
                            onChange={(e) => updateItem(index, "description", e.target.value)}
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-2">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                            className="text-sm"
                          />
                        </div>
                        <div className="col-span-3">
                          <Select
                            value={item.unit}
                            onValueChange={(value) => updateItem(index, "unit", value)}
                          >
                            <SelectTrigger className="text-sm">
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
                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(index)}
                            className="text-destructive hover:text-destructive h-9 w-9"
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

              {/* SEZIONE: Collegamenti */}
              <div className="space-y-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <Link2 className="h-4 w-4" />
                  Collegamenti
                </h3>

                <div className="space-y-3">
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
                  rows={2}
                />
              </div>

              {/* Audit info */}
              {(ddt.created_at || ddt.uploaded_by) && (
                <div className="space-y-2 text-xs text-muted-foreground border-t pt-4">
                  <div className="flex gap-4">
                    {ddt.created_at && (
                      <span>Caricato: {new Date(ddt.created_at).toLocaleString("it-IT")}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t mt-2">
          <div className="flex justify-between items-center w-full">
            <div className="text-xs text-muted-foreground">
              {items.length > 0 && (
                <Badge variant="secondary">{items.length} articol{items.length === 1 ? 'o' : 'i'}</Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button onClick={handleSubmit} disabled={!isValid || loading} size="lg" className="px-6">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salva DDT
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
