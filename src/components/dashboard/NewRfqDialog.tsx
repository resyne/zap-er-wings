import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronRight, ChevronLeft } from "lucide-react";

interface NewRfqDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewRfqDialog({ open, onOpenChange, onSuccess }: NewRfqDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    supplier_id: "",
    title: "",
    description: "",
    required_by: "",
    priority: "medium",
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Placeholder: La tabella purchase_rfq non esiste ancora
      // Per ora creiamo una task come placeholder
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description,
          category: "amministrazione" as any,
          priority: formData.priority as any,
          status: "to_do" as any,
          due_date: formData.required_by || null,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Richiesta di offerta creata con successo",
      });

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating RFQ:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare la richiesta di offerta",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      supplier_id: "",
      title: "",
      description: "",
      required_by: "",
      priority: "medium",
    });
  };

  const canProceed = () => {
    if (step === 1) return formData.title.trim() !== "";
    if (step === 2) return true;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova Richiesta di Offerta - Step {step}/3</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titolo Richiesta *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Es: Richiesta materiali per produzione"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Dettagli della richiesta..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="priority">Priorità</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="required_by">Data Richiesta</Label>
                <Input
                  id="required_by"
                  type="date"
                  value={formData.required_by}
                  onChange={(e) => setFormData({ ...formData, required_by: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-semibold">Riepilogo</h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Titolo:</span> {formData.title}
                </div>
                {formData.description && (
                  <div>
                    <span className="font-medium">Descrizione:</span> {formData.description}
                  </div>
                )}
                <div>
                  <span className="font-medium">Priorità:</span> {formData.priority}
                </div>
                {formData.required_by && (
                  <div>
                    <span className="font-medium">Data richiesta:</span> {formData.required_by}
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
              {loading ? "Creazione..." : "Crea RFQ"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
