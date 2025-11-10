import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";

interface EditCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  invoiceId: string;
}

export function EditCreditDialog({ open, onOpenChange, onSuccess, invoiceId }: EditCreditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customersOpen, setCustomersOpen] = useState(false);
  const [showCreateCustomerDialog, setShowCreateCustomerDialog] = useState(false);
  const [formData, setFormData] = useState({
    invoice_number: "",
    customer_id: "",
    customer_name: "",
    invoice_date: "",
    due_date: "",
    amount: "",
    tax_amount: "",
    vat_rate: "22" as string,
    status: "pending" as string,
  });

  useEffect(() => {
    if (open && invoiceId) {
      loadInvoiceData();
      loadCustomers();
    }
  }, [open, invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const { data, error } = await supabase
        .from('customer_invoices')
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
          customer_id: data.customer_id || "",
          customer_name: data.customer_name || "",
          invoice_date: data.invoice_date || "",
          due_date: data.due_date || "",
          amount: data.amount?.toString() || "",
          tax_amount: data.tax_amount?.toString() || "",
          vat_rate: vatRate,
          status: data.status || "pending",
        });
      }
    } catch (error: any) {
      console.error('Error loading invoice:', error);
      toast.error('Errore nel caricamento del credito');
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, company_name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error('Error loading customers:', error);
      toast.error('Errore nel caricamento dei clienti');
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData(prev => ({
        ...prev,
        customer_id: customerId,
        customer_name: customer.company_name || customer.name
      }));
    }
    setCustomersOpen(false);
  };

  const handleCustomerCreated = (customerId?: string) => {
    loadCustomers();
    if (customerId) {
      setTimeout(() => {
        handleCustomerSelect(customerId);
      }, 500);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.invoice_number || !formData.customer_id || !formData.invoice_date || !formData.due_date || !formData.amount) {
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
        .from('customer_invoices')
        .update({
          invoice_number: formData.invoice_number,
          customer_id: formData.customer_id,
          customer_name: formData.customer_name,
          invoice_date: formData.invoice_date,
          due_date: formData.due_date,
          amount: amount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          status: agingDays > 0 ? 'overdue' : formData.status,
          aging_days: agingDays > 0 ? agingDays : null,
        })
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success("Credito aggiornato con successo");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating credit:', error);
      toast.error("Errore nell'aggiornamento del credito");
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
          <DialogTitle>Modifica Credito Cliente</DialogTitle>
          <DialogDescription>
            Aggiorna i dati della fattura cliente
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
                placeholder="es. FT/2025/001"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <div className="flex gap-2">
                <Popover open={customersOpen} onOpenChange={setCustomersOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customersOpen}
                      className="flex-1 justify-between"
                    >
                      {formData.customer_id
                        ? customers.find((customer) => customer.id === formData.customer_id)?.name ||
                          customers.find((customer) => customer.id === formData.customer_id)?.company_name
                        : "Seleziona cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Cerca cliente..." />
                      <CommandEmpty>Nessun cliente trovato.</CommandEmpty>
                      <CommandGroup>
                        {customers.map((customer) => (
                          <CommandItem
                            key={customer.id}
                            value={`${customer.name} ${customer.company_name || ''} ${customer.code}`}
                            onSelect={() => handleCustomerSelect(customer.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.customer_id === customer.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="font-medium">{customer.company_name || customer.name}</div>
                              {customer.company_name && (
                                <div className="text-sm text-muted-foreground">{customer.name}</div>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowCreateCustomerDialog(true)}
                  title="Crea nuovo cliente"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoice_date">Data Emissione *</Label>
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
                <SelectItem value="pending">In attesa</SelectItem>
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

      <CreateCustomerDialog
        open={showCreateCustomerDialog}
        onOpenChange={setShowCreateCustomerDialog}
        onCustomerCreated={handleCustomerCreated}
      />
    </Dialog>
  );
}
