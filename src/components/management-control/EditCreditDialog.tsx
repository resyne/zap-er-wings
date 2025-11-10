import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Check, ChevronsUpDown, Plus, Mail, MessageSquare, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminderType, setNewReminderType] = useState<'email' | 'whatsapp'>('email');
  const [newReminderNotes, setNewReminderNotes] = useState('');
  const { user } = useAuth();
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
      loadReminders();
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

  const loadReminders = async () => {
    if (!invoiceId) return;
    
    try {
      const { data, error } = await supabase
        .from("invoice_reminders")
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name,
            email
          )
        `)
        .eq("customer_invoice_id", invoiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReminders(data || []);
    } catch (error: any) {
      console.error("Error loading reminders:", error);
    }
  };

  const handleAddReminder = async () => {
    if (!invoiceId || !user) {
      toast.error("Impossibile aggiungere il sollecito");
      return;
    }

    try {
      const { error } = await supabase
        .from("invoice_reminders")
        .insert({
          customer_invoice_id: invoiceId,
          reminder_type: newReminderType,
          user_id: user.id,
          notes: newReminderNotes || null,
        });

      if (error) throw error;

      toast.success("Sollecito registrato con successo");
      setNewReminderNotes("");
      loadReminders();
    } catch (error: any) {
      console.error("Error adding reminder:", error);
      toast.error("Errore durante la registrazione del sollecito");
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

          {/* Sezione Solleciti */}
          <div className="space-y-4 border-t pt-4">
            <h3 className="text-lg font-medium">Solleciti</h3>
            
            {/* Aggiungi nuovo sollecito */}
            <div className="space-y-2 bg-muted/50 p-4 rounded-lg">
              <Label>Registra nuovo sollecito</Label>
              <div className="flex gap-2">
                <Select
                  value={newReminderType}
                  onValueChange={(value: 'email' | 'whatsapp') => setNewReminderType(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>Email</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        <span>WhatsApp</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                <Input
                  placeholder="Note (opzionale)"
                  value={newReminderNotes}
                  onChange={(e) => setNewReminderNotes(e.target.value)}
                />
                
                <Button type="button" onClick={handleAddReminder}>
                  Registra
                </Button>
              </div>
            </div>

            {/* Lista solleciti esistenti */}
            {reminders.length > 0 && (
              <div className="space-y-2">
                <Label>Storico solleciti ({reminders.length})</Label>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {reminders.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="flex items-start justify-between p-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          {reminder.reminder_type === 'email' ? (
                            <Mail className="h-4 w-4 text-blue-500" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-green-500" />
                          )}
                          <Badge variant="outline">
                            {reminder.reminder_type === 'email' ? 'Email' : 'WhatsApp'}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            da {reminder.profiles?.first_name} {reminder.profiles?.last_name}
                          </span>
                        </div>
                        {reminder.notes && (
                          <p className="text-sm text-muted-foreground ml-6">
                            {reminder.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(reminder.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

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
