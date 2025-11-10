import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface CreateDebtDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateDebtDialog({ open, onOpenChange, onSuccess }: CreateDebtDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: "",
    supplier_id: "",
    supplier_name: "",
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: "",
    amount: "",
    tax_amount: "",
    category: "",
    status: "pending" as string,
  });

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

      // Calcola aging days
      const dueDate = new Date(formData.due_date);
      const today = new Date();
      const agingDays = Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      const { error } = await supabase
        .from('supplier_invoices')
        .insert({
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
        });

      if (error) throw error;

      toast.success("Debito creato con successo");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error creating debt:', error);
      toast.error("Errore nella creazione del debito");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      invoice_number: "",
      supplier_id: "",
      supplier_name: "",
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: "",
      amount: "",
      tax_amount: "",
      category: "",
      status: "pending",
    });
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Nuovo Debito Fornitore</DialogTitle>
          <DialogDescription>
            Inserisci i dati della fattura fornitore
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
            <Select value={formData.category} onValueChange={(value) => handleChange("category", value)}>
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
              <Label htmlFor="amount">Importo (€) *</Label>
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
              <Label htmlFor="tax_amount">IVA (€)</Label>
              <Input
                id="tax_amount"
                type="number"
                step="0.01"
                value={formData.tax_amount}
                onChange={(e) => handleChange("tax_amount", e.target.value)}
                placeholder="0.00"
              />
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

          {formData.amount && formData.tax_amount && (
            <div className="pt-4 border-t">
              <div className="flex justify-between text-sm">
                <span>Imponibile:</span>
                <span>€ {parseFloat(formData.amount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>IVA:</span>
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
              Crea Debito
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
