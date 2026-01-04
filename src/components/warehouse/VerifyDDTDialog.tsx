import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Building2, User, ArrowDownToLine, ArrowUpFromLine, ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

export function VerifyDDTDialog({ open, onOpenChange, ddt, onSuccess }: VerifyDDTDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  
  const [formData, setFormData] = useState({
    counterpartType: "" as "customer" | "supplier" | "",
    customerId: "",
    supplierId: "",
    officialDdtNumber: "",
    officialDocumentDate: "",
  });

  useEffect(() => {
    if (open && ddt) {
      loadCounterparts();
      
      // Pre-fill form with existing data
      setFormData({
        counterpartType: (ddt.counterpart_type as "customer" | "supplier") || 
                        (ddt.direction === "OUT" ? "customer" : ddt.direction === "IN" ? "supplier" : ""),
        customerId: ddt.customer_id || "",
        supplierId: ddt.supplier_id || "",
        officialDdtNumber: "",
        officialDocumentDate: ddt.official_document_date || "",
      });
    }
  }, [open, ddt]);

  const loadCounterparts = async () => {
    try {
      const [customersRes, suppliersRes] = await Promise.all([
        supabase.from("customers").select("id, name, code").order("name").limit(100),
        supabase.from("suppliers").select("id, name, code").order("name").limit(100),
      ]);
      
      setCustomers(customersRes.data || []);
      setSuppliers(suppliersRes.data || []);
    } catch (error) {
      console.error("Error loading counterparts:", error);
    }
  };

  const handleSubmit = async () => {
    if (!ddt) return;

    // Validation
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
        counterpart_type: formData.counterpartType,
        status: "verificato",
      };

      if (formData.counterpartType === "customer") {
        updateData.customer_id = formData.customerId;
        updateData.supplier_id = null;
      } else {
        updateData.supplier_id = formData.supplierId;
        updateData.customer_id = null;
      }

      if (formData.officialDocumentDate) {
        updateData.official_document_date = formData.officialDocumentDate;
      }

      // If a new official DDT number is provided, update it
      if (formData.officialDdtNumber) {
        updateData.ddt_number = formData.officialDdtNumber;
      }

      const { error } = await supabase
        .from("ddts")
        .update(updateData)
        .eq("id", ddt.id);

      if (error) throw error;

      toast({
        title: "DDT verificato",
        description: `DDT ${ddt.ddt_number} verificato con successo`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error verifying DDT:", error);
      toast({
        title: "Errore",
        description: "Impossibile verificare il DDT",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!ddt) return null;

  const isValid = formData.counterpartType && 
    ((formData.counterpartType === "customer" && formData.customerId) || 
     (formData.counterpartType === "supplier" && formData.supplierId));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Verifica DDT: {ddt.ddt_number}</DialogTitle>
          <DialogDescription>
            Completa i dati amministrativi del documento
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Preview allegato */}
          {ddt.attachment_url && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Documento allegato</Label>
              <div className="border rounded-lg p-3 bg-muted/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ddt.direction === "IN" ? (
                      <ArrowDownToLine className="h-5 w-5 text-blue-600" />
                    ) : (
                      <ArrowUpFromLine className="h-5 w-5 text-green-600" />
                    )}
                    <span className="text-sm">
                      {ddt.direction === "IN" ? "Merce ricevuta" : "Merce consegnata"}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <a href={ddt.attachment_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Apri
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Tipo controparte */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Tipo controparte <span className="text-destructive">*</span>
            </Label>
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
          </div>

          {/* Selezione controparte */}
          {formData.counterpartType === "supplier" && (
            <div className="space-y-2">
              <Label htmlFor="supplier">
                Fornitore <span className="text-destructive">*</span>
              </Label>
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
            </div>
          )}

          {formData.counterpartType === "customer" && (
            <div className="space-y-2">
              <Label htmlFor="customer">
                Cliente <span className="text-destructive">*</span>
              </Label>
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
            </div>
          )}

          {/* Numero DDT ufficiale */}
          <div className="space-y-2">
            <Label htmlFor="officialNumber">Numero DDT (se diverso)</Label>
            <Input
              id="officialNumber"
              placeholder="Es. 2026/123"
              value={formData.officialDdtNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, officialDdtNumber: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Compila solo se il numero sul documento è diverso
            </p>
          </div>

          {/* Data documento ufficiale */}
          <div className="space-y-2">
            <Label htmlFor="officialDate">Data documento DDT</Label>
            <Input
              id="officialDate"
              type="date"
              value={formData.officialDocumentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, officialDocumentDate: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verifica DDT
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
