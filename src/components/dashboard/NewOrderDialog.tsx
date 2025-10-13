import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface NewOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewOrderDialog({ open, onOpenChange, onSuccess }: NewOrderDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    customer_id: "",
    order_date: new Date().toISOString().split('T')[0],
    delivery_date: "",
    notes: "",
    status: "draft",
  });

  useEffect(() => {
    if (open) {
      loadCustomers();
    }
  }, [open]);

  const loadCustomers = async () => {
    const { data } = await supabase
      .from("customers")
      .select("id, code, name, company_name")
      .eq("active", true)
      .order("name");
    setCustomers(data || []);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("sales_orders")
        .insert({
          number: `ORD-${Date.now()}`, // Temporary number, will be replaced by auto-generation
          customer_id: formData.customer_id || null,
          order_date: formData.order_date,
          delivery_date: formData.delivery_date || null,
          notes: formData.notes,
          status: formData.status,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ordine creato con successo",
      });

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating order:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare l'ordine",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      customer_id: "",
      order_date: new Date().toISOString().split('T')[0],
      delivery_date: "",
      notes: "",
      status: "draft",
    });
  };

  const canProceed = () => {
    if (step === 1) return formData.customer_id !== "";
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuovo Ordine - Step {step}/3</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="customer">Cliente *</Label>
                <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.code} - {customer.company_name || customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="order_date">Data Ordine</Label>
                <Input
                  id="order_date"
                  type="date"
                  value={formData.order_date}
                  onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="delivery_date">Data Consegna</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Note sull'ordine..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Riepilogo</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Cliente:</span>{" "}
                  {customers.find(c => c.id === formData.customer_id)?.name || "N/A"}
                </div>
                <div>
                  <span className="font-medium">Data Ordine:</span> {formData.order_date}
                </div>
                {formData.delivery_date && (
                  <div>
                    <span className="font-medium">Data Consegna:</span> {formData.delivery_date}
                  </div>
                )}
                {formData.notes && (
                  <div>
                    <span className="font-medium">Note:</span> {formData.notes}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep(Math.max(1, step - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Indietro
          </Button>
          
          {step < 3 ? (
            <Button
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Avanti
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Creazione..." : "Crea Ordine"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
