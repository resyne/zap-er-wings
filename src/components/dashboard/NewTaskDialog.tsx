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
import { useAuth } from "@/hooks/useAuth";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function NewTaskDialog({ open, onOpenChange, onSuccess }: NewTaskDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "",
    priority: "medium",
    due_date: "",
    status: "to_do",
  });

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description,
          category: (formData.category || "amministrazione") as any,
          priority: formData.priority as any,
          due_date: formData.due_date || null,
          status: formData.status as any,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Task creata con successo",
      });

      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      console.error("Error creating task:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare la task",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setFormData({
      title: "",
      description: "",
      category: "",
      priority: "medium",
      due_date: "",
      status: "to_do",
    });
  };

  const canProceed = () => {
    if (step === 1) return formData.title.trim() !== "";
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nuova Task - Step {step}/3</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titolo Task *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Es: Preparare documentazione progetto"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrizione</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Dettagli della task..."
                  rows={4}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="category">Categoria</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Es: Amministrazione, Vendite, ecc."
                />
              </div>
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
                <Label htmlFor="due_date">Data Scadenza</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
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
                {formData.category && (
                  <div>
                    <span className="font-medium">Categoria:</span> {formData.category}
                  </div>
                )}
                <div>
                  <span className="font-medium">Priorità:</span> {formData.priority}
                </div>
                {formData.due_date && (
                  <div>
                    <span className="font-medium">Scadenza:</span> {formData.due_date}
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
              {loading ? "Creazione..." : "Crea Task"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
