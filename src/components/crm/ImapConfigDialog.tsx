import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ImapConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  pbxId?: string | null;
  pbxName?: string;
  existingConfig?: {
    id: string;
    name: string;
    host: string;
    port: number;
    username: string;
    folder: string;
    search_criteria: string;
  } | null;
}

export function ImapConfigDialog({ open, onOpenChange, onSuccess, pbxId, pbxName, existingConfig }: ImapConfigDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    host: "",
    port: "993",
    username: "",
    password: "",
    folder: "INBOX",
    search_criteria: "UNSEEN"
  });

  useEffect(() => {
    if (existingConfig) {
      setFormData({
        name: existingConfig.name,
        host: existingConfig.host,
        port: String(existingConfig.port),
        username: existingConfig.username,
        password: "",
        folder: existingConfig.folder,
        search_criteria: existingConfig.search_criteria
      });
    } else {
      setFormData({
        name: pbxName ? `IMAP - ${pbxName}` : "Configurazione Chiamate",
        host: "",
        port: "993",
        username: "",
        password: "",
        folder: "INBOX",
        search_criteria: "UNSEEN"
      });
    }
  }, [existingConfig, pbxName, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      if (existingConfig) {
        // Update existing config
        const updatePayload: Record<string, unknown> = {
          name: formData.name,
          host: formData.host,
          port: parseInt(formData.port),
          username: formData.username,
          folder: formData.folder,
          search_criteria: formData.search_criteria,
          pbx_id: pbxId || null
        };
        // Only update password if provided
        if (formData.password) {
          updatePayload.password_encrypted = formData.password;
        }
        const { error } = await supabase
          .from('imap_config')
          .update(updatePayload)
          .eq('id', existingConfig.id);
        if (error) throw error;
        toast.success("Configurazione IMAP aggiornata con successo");
      } else {
        // Insert new config
        const { error } = await supabase
          .from('imap_config')
          .insert({
            name: formData.name,
            host: formData.host,
            port: parseInt(formData.port),
            username: formData.username,
            password_encrypted: formData.password,
            folder: formData.folder,
            search_criteria: formData.search_criteria,
            is_active: true,
            pbx_id: pbxId || null
          });
        if (error) throw error;
        toast.success("Configurazione IMAP salvata con successo");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving IMAP config:', error);
      toast.error("Errore nel salvare la configurazione");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {existingConfig ? 'Modifica' : 'Nuova'} Configurazione IMAP
              {pbxName && <span className="text-muted-foreground font-normal"> - {pbxName}</span>}
            </DialogTitle>
            <DialogDescription>
              Inserisci le credenziali del tuo account email per sincronizzare automaticamente le registrazioni delle chiamate
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome Configurazione</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="host">Server IMAP</Label>
                <Input
                  id="host"
                  placeholder="imap.gmail.com"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="port">Porta</Label>
                <Select
                  value={formData.port}
                  onValueChange={(value) => setFormData({ ...formData, port: value })}
                >
                  <SelectTrigger id="port">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="993">993 (SSL/TLS)</SelectItem>
                    <SelectItem value="143">143 (STARTTLS)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="username">Email / Username</Label>
              <Input
                id="username"
                type="email"
                placeholder="user@example.com"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">
                Password
                {existingConfig && <span className="text-muted-foreground font-normal"> (lascia vuoto per non modificare)</span>}
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!existingConfig}
              />
              <p className="text-xs text-muted-foreground">
                Per Gmail, usa una "App Password" invece della password principale
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="folder">Cartella Email</Label>
              <Input
                id="folder"
                placeholder="INBOX"
                value={formData.folder}
                onChange={(e) => setFormData({ ...formData, folder: e.target.value })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="search">Criteri Ricerca</Label>
              <Select
                value={formData.search_criteria}
                onValueChange={(value) => setFormData({ ...formData, search_criteria: value })}
              >
                <SelectTrigger id="search">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNSEEN">Solo email non lette</SelectItem>
                  <SelectItem value="ALL">Tutte le email</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {existingConfig ? 'Aggiorna' : 'Salva'} Configurazione
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
