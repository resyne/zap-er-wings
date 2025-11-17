import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";

const MODELS = ["Sebastian", "Realbosco", "Anastasia", "Ottavio"];
const SIZES = [80, 100, 120, 130];

const getPowerTypes = (model: string) => {
  if (model === "Ottavio") return ["Gas", "Legna"];
  if (model === "Realbosco") return ["Elettrico", "Gas", "Legna", "Rotante"];
  return ["Elettrico", "Gas", "Legna"];
};

interface GenerateConfiguratorLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GenerateConfiguratorLinkDialog({ open, onOpenChange }: GenerateConfiguratorLinkDialogProps) {
  const queryClient = useQueryClient();
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    preselected_model: "",
    preselected_power: "",
    preselected_size: "",
    expires_days: "",
  });

  const generateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Generate unique code
      const code = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      const expiresAt = data.expires_days 
        ? new Date(Date.now() + parseInt(data.expires_days) * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: link, error } = await supabase
        .from("configurator_links")
        .insert([{
          code,
          name: data.name,
          description: data.description || null,
          preselected_model: data.preselected_model || null,
          preselected_power: data.preselected_power || null,
          preselected_size: data.preselected_size ? parseInt(data.preselected_size) : null,
          expires_at: expiresAt,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return link;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["configurator-links"] });
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/configurator/${data.code}`;
      setGeneratedLink(link);
      toast.success("Link generato con successo!");
    },
    onError: (error: any) => {
      toast.error("Errore nella generazione del link: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    generateMutation.mutate(formData);
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast.success("Link copiato negli appunti!");
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      description: "",
      preselected_model: "",
      preselected_power: "",
      preselected_size: "",
      expires_days: "",
    });
    setGeneratedLink(null);
  };

  const handleClose = () => {
    handleReset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Genera Link Configuratore</DialogTitle>
          <DialogDescription>
            Crea un link univoco per permettere ai clienti di configurare il loro forno
          </DialogDescription>
        </DialogHeader>

        {!generatedLink ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome Link *</Label>
              <Input
                id="name"
                placeholder="es. Cliente XYZ - Preventivo Forno"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrizione</Label>
              <Textarea
                id="description"
                placeholder="Note o descrizione interna..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Modello Preselezionato (opzionale)</Label>
              <Select
                value={formData.preselected_model}
                onValueChange={(value) => setFormData({ ...formData, preselected_model: value, preselected_power: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Nessuna preselezione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nessuna preselezione</SelectItem>
                  {MODELS.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.preselected_model && (
              <>
                <div className="space-y-2">
                  <Label>Alimentazione Preselezionata (opzionale)</Label>
                  <Select
                    value={formData.preselected_power}
                    onValueChange={(value) => setFormData({ ...formData, preselected_power: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessuna preselezione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nessuna preselezione</SelectItem>
                      {getPowerTypes(formData.preselected_model).map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Dimensione Preselezionata (opzionale)</Label>
                  <Select
                    value={formData.preselected_size}
                    onValueChange={(value) => setFormData({ ...formData, preselected_size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Nessuna preselezione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nessuna preselezione</SelectItem>
                      {SIZES.map((size) => (
                        <SelectItem key={size} value={size.toString()}>
                          {size}cm
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="expires_days">Scadenza Link (giorni)</Label>
              <Input
                id="expires_days"
                type="number"
                min="1"
                placeholder="es. 30 (lascia vuoto per nessuna scadenza)"
                value={formData.expires_days}
                onChange={(e) => setFormData({ ...formData, expires_days: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Annulla
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                Genera Link
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-secondary rounded-lg">
              <Label className="text-sm font-medium mb-2 block">Link Generato</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={generatedLink}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(generatedLink, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>✓ Il link è stato generato con successo</p>
              <p>✓ Puoi condividerlo con il cliente</p>
              <p>✓ Il cliente potrà configurare il forno e inviare la richiesta</p>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={handleReset}>
                Genera Altro Link
              </Button>
              <Button type="button" onClick={handleClose}>
                Chiudi
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
