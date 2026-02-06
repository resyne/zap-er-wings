import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Bot, Loader2, Sparkles } from "lucide-react";

interface WhatsAppAISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: {
    id: string;
    verified_name?: string | null;
    display_phone_number?: string;
    ai_chat_enabled?: boolean;
    ai_system_prompt?: string;
    ai_auto_mode?: boolean;
    ai_min_delay_minutes?: number;
    ai_max_delay_minutes?: number;
  } | null;
  onSaved: () => void;
}

const defaultSystemPrompt = `Sei un assistente di vendita per forni professionali. 
Il tuo obiettivo è:
1. Rispondere in modo cordiale e professionale
2. Capire le esigenze del cliente
3. Proporre i prodotti adatti
4. Portare il cliente verso una decisione d'acquisto
5. Rispondere nella stessa lingua del cliente

Mantieni le risposte brevi e conversazionali, come in una chat WhatsApp.`;

export function WhatsAppAISettingsDialog({
  open,
  onOpenChange,
  account,
  onSaved,
}: WhatsAppAISettingsDialogProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [minDelay, setMinDelay] = useState(2);
  const [maxDelay, setMaxDelay] = useState(10);

  useEffect(() => {
    if (account) {
      setAiEnabled(account.ai_chat_enabled ?? false);
      setAutoMode(account.ai_auto_mode ?? false);
      setSystemPrompt(account.ai_system_prompt || defaultSystemPrompt);
      setMinDelay(account.ai_min_delay_minutes ?? 2);
      setMaxDelay(account.ai_max_delay_minutes ?? 10);
    }
  }, [account]);

  const handleSave = async () => {
    if (!account) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_accounts")
        .update({
          ai_chat_enabled: aiEnabled,
          ai_system_prompt: systemPrompt || null,
          ai_auto_mode: autoMode,
          ai_min_delay_minutes: minDelay,
          ai_max_delay_minutes: maxDelay,
        })
        .eq("id", account.id);

      if (error) throw error;

      toast.success("Impostazioni AI salvate");
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error saving AI settings:", error);
      toast.error(`Errore: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPrompt = () => {
    setSystemPrompt(defaultSystemPrompt);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Impostazioni AI Chat
          </DialogTitle>
          <DialogDescription>
            Configura l'assistente AI per {account?.verified_name || account?.display_phone_number || "questo account"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Enable AI Chat */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="space-y-1">
              <Label className="text-base font-medium flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Abilita AI Chat
              </Label>
              <p className="text-sm text-muted-foreground">
                Attiva l'assistente AI per suggerire risposte automatiche
              </p>
            </div>
            <Switch
              checked={aiEnabled}
              onCheckedChange={setAiEnabled}
            />
          </div>

          {aiEnabled && (
            <>
              {/* Auto Mode */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <Label className="text-base font-medium">Modalità Automatica</Label>
                  <p className="text-sm text-muted-foreground">
                    Invia automaticamente i messaggi AI dopo il delay configurato (senza conferma)
                  </p>
                </div>
                <Switch
                  checked={autoMode}
                  onCheckedChange={setAutoMode}
                />
              </div>

              {/* Delay Settings */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Delay Minimo (minuti)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={minDelay}
                    onChange={(e) => setMinDelay(parseInt(e.target.value) || 1)}
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI non risponderà prima di questo tempo
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Delay Massimo (minuti)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(parseInt(e.target.value) || 10)}
                  />
                  <p className="text-xs text-muted-foreground">
                    L'AI non aspetterà più di questo tempo
                  </p>
                </div>
              </div>

              {/* System Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">System Prompt</Label>
                  <Button variant="ghost" size="sm" onClick={handleResetPrompt}>
                    Reset Default
                  </Button>
                </div>
                <Textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  placeholder="Istruzioni per l'AI..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Questo prompt definisce il comportamento e lo stile dell'AI nelle conversazioni
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-lg">
                <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">
                  Come funziona l'AI Chat
                </h4>
                <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
                  <li>• L'AI analizza la cronologia della conversazione</li>
                  <li>• Considera le informazioni del lead (se disponibili)</li>
                  <li>• Suggerisce una risposta appropriata</li>
                  <li>• Calcola un delay intelligente basato sul contesto</li>
                  {autoMode ? (
                    <li className="font-medium">• In modalità automatica, invia senza conferma</li>
                  ) : (
                    <li>• Mostra l'anteprima per conferma prima dell'invio</li>
                  )}
                </ul>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salva Impostazioni
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
