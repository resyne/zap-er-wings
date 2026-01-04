import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface EditDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoiceId: string;
}

export function EditDebtDialog({ open, onOpenChange, onSuccess, invoiceId }: EditDebtDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: "",
    supplier_id: "",
    supplier_name: "",
    invoice_date: "",
    due_date: "",
    amount: "",
    tax_amount: "",
    vat_rate: "22" as string,
    category: "",
    status: "pending" as string,
  });

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
    }
  }, [open, invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      if (data) {
        const vatRate = data.tax_amount && data.amount 
          ? ((data.tax_amount / data.amount) * 100).toFixed(0)
          : "22";

        setFormData({
          invoice_number: data.invoice_number || "",
          supplier_id: data.supplier_id || "",
          supplier_name: data.supplier_name || "",
          invoice_date: data.invoice_date || "",
          due_date: data.due_date || "",
          amount: data.amount?.toString() || "",
          tax_amount: data.tax_amount?.toString() || "",
          vat_rate: vatRate,
          category: data.category || "",
          status: data.status || "pending",
        });
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      toast.error('Errore nel caricamento del debito');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.invoice_number || !formData.supplier_name || !formData.invoice_date || !formData.due_date || !formData.amount) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    setLoading(true);
    try {
      const amount = parseFloat(formData.amount);
      const taxAmount = formData.tax_amount ? parseFloat(formData.tax_amount) : 0;
      const totalAmount = amount + taxAmount;

      const dueDate = new Date(formData.due_date);
      const today = new Date();
      const agingDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const { error } = await supabase
        .from('supplier_invoices')
        .update({
          invoice_number: formData.invoice_number,
          supplier_name: formData.supplier_name,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          amount: amount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          category: formData.category || null,
          status: agingDays > 0 ? 'overdue' : formData.status,
          aging_days: agingDays > 0 ? agingDays : null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success("Debito aggiornato con successo");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating debt:', error);
      toast.error("Errore nell'aggiornamento del debito");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      
      if (field === 'amount' || field === 'vat_rate') {
        const amount = parseFloat(field === 'amount' ? value : updated.amount);
        const vatRate = parseFloat(field === 'vat_rate' ? value : updated.vat_rate);
        
        if (!isNaN(amount) && !isNaN(vatRate)) {
          updated.tax_amount = ((amount * vatRate) / 100).toFixed(2);
        }
      }
      
      return updated;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Modifica Debito Fornitore</DialogTitle>
          <DialogDescription>
            Aggiorna i dati della fattura fornitore
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Numero Fattura *</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => handleChange("invoice_number", e.target.value)}
                placeholder="es. F-2025/001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_name">Fornitore *</Label>
              <Input
                id="supplier_name"
                value={formData.supplier_name}
                onChange={(e) => handleChange("supplier_name", e.target.value)}
                placeholder="Nome fornitore"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select value={formData.category || undefined} onValueChange={(value) => handleChange("category", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="materie_prime">Materie Prime</SelectItem>
                <SelectItem value="servizi">Servizi</SelectItem>
                <SelectItem value="consulenze">Consulenze</SelectItem>
                <SelectItem value="utilities">Utilities</SelectItem>
                <SelectItem value="manutenzione">Manutenzione</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Data Ricezione *</Label>
              <Input
                id="invoice_date"
                type="date"
                value={formData.invoice_date}
                onChange={(e) => handleChange("invoice_date", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">Data Scadenza *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => handleChange("due_date", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Imponibile (€) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vat_rate">Aliquota IVA *</Label>
              <Select value={formData.vat_rate} onValueChange={(value) => handleChange("vat_rate", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="22">IVA 22%</SelectItem>
                  <SelectItem value="0">IVA 0% (Reverse Charge)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Stato</Label>
            <Select value={formData.status} onValueChange={(value) => handleChange("status", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Da pagare</SelectItem>
                <SelectItem value="partial">Parziale</SelectItem>
                <SelectItem value="paid">Pagato</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.amount && (
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Imponibile:</span>
                <span>€ {parseFloat(formData.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA ({formData.vat_rate}%):</span>
                <span>€ {parseFloat(formData.tax_amount || "0").toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg mt-2">
                <span>Totale:</span>
                <span>€ {(parseFloat(formData.amount) + parseFloat(formData.tax_amount || "0")).toFixed(2)}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva Modifiche
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
