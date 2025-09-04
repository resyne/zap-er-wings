import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Zap, Send, Settings, Loader2 } from "lucide-react";

interface ZapierIntegrationProps {
  contactData?: any;
  onWebhookSent?: () => void;
}

const triggerTypes = [
  { value: "new_lead", label: "Nuovo Lead", description: "Trigger quando viene aggiunto un nuovo lead" },
  { value: "lead_updated", label: "Lead Aggiornato", description: "Trigger quando un lead viene modificato" },
  { value: "qualified_lead", label: "Lead Qualificato", description: "Trigger quando un lead viene qualificato" },
  { value: "deal_created", label: "Deal Creato", description: "Trigger quando un lead diventa un deal" },
  { value: "custom", label: "Personalizzato", description: "Trigger personalizzato con dati specifici" }
];

export default function ZapierIntegration({ contactData, onWebhookSent }: ZapierIntegrationProps) {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [triggerType, setTriggerType] = useState("new_lead");
  const [customData, setCustomData] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleTriggerWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!webhookUrl) {
      toast({
        title: "Errore",
        description: "Inserisci l'URL del webhook Zapier",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log("Triggering Zapier webhook:", webhookUrl);

    try {
      // Prepare the data to send based on trigger type
      let webhookData: any = {
        timestamp: new Date().toISOString(),
        triggered_from: window.location.origin,
        trigger_type: triggerType,
      };

      // Add contact data if available
      if (contactData) {
        webhookData.lead_data = {
          id: contactData.id,
          name: `${contactData.first_name || ''} ${contactData.last_name || ''}`.trim(),
          email: contactData.email,
          phone: contactData.phone || contactData.mobile,
          company: contactData.company_name,
          job_title: contactData.job_title,
          lead_source: contactData.lead_source,
          created_at: contactData.created_at,
        };
      }

      // Add custom data if provided
      if (customData && triggerType === "custom") {
        try {
          webhookData.custom_data = JSON.parse(customData);
        } catch {
          webhookData.custom_data = { message: customData };
        }
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors", // Add this to handle CORS
        body: JSON.stringify(webhookData),
      });

      // Since we're using no-cors, we won't get a proper response status
      // Instead, we'll show a more informative message
      toast({
        title: "Richiesta Inviata",
        description: "La richiesta è stata inviata a Zapier. Controlla la cronologia del tuo Zap per verificare che sia stato attivato.",
      });

      onWebhookSent?.();
    } catch (error) {
      console.error("Error triggering webhook:", error);
      toast({
        title: "Errore",
        description: "Impossibile attivare il webhook Zapier. Controlla l'URL e riprova.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast({
        title: "Errore",
        description: "Inserisci l'URL del webhook prima di testare",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const testData = {
        test: true,
        timestamp: new Date().toISOString(),
        message: "Test webhook da CRM - Sezione Lead",
        trigger_type: "test",
      };

      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify(testData),
      });

      toast({
        title: "Test Inviato",
        description: "Webhook di test inviato a Zapier. Controlla se il tuo Zap è stato attivato.",
      });
    } catch (error) {
      toast({
        title: "Errore Test",
        description: "Impossibile inviare il test webhook",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500" />
          Integrazione Zapier
        </CardTitle>
        <CardDescription>
          Automatizza i tuoi processi collegando i lead a oltre 5.000 app con Zapier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleTriggerWebhook} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL Webhook Zapier</Label>
            <Input
              id="webhookUrl"
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              Copia l'URL webhook dal tuo Zap in Zapier (trigger: Webhook)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="triggerType">Tipo di Trigger</Label>
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {triggerTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs text-muted-foreground">{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {triggerType === "custom" && (
            <div className="space-y-2">
              <Label htmlFor="customData">Dati Personalizzati (JSON)</Label>
              <Textarea
                id="customData"
                placeholder='{"campo1": "valore1", "campo2": "valore2"}'
                value={customData}
                onChange={(e) => setCustomData(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Inserisci i dati personalizzati in formato JSON
              </p>
            </div>
          )}

          {contactData && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="text-sm font-medium mb-2">Dati Lead da Inviare:</h4>
              <div className="text-xs space-y-1">
                <div><strong>Nome:</strong> {contactData.first_name} {contactData.last_name}</div>
                <div><strong>Email:</strong> {contactData.email}</div>
                <div><strong>Azienda:</strong> {contactData.company_name}</div>
                <div><strong>Fonte:</strong> {contactData.lead_source}</div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !webhookUrl}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Invio...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Attiva Zap
                </>
              )}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleTestWebhook}
              disabled={isLoading || !webhookUrl}
            >
              <Settings className="h-4 w-4 mr-2" />
              Test
            </Button>
          </div>
        </form>

        <div className="pt-4 border-t">
          <h4 className="text-sm font-medium mb-2">📝 Come ottenere il link webhook da Zapier:</h4>
          <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside ml-2">
            <li>Vai su <strong>zapier.com</strong> e accedi al tuo account</li>
            <li>Clicca su <strong>"Create Zap"</strong> (Crea Zap)</li>
            <li>Come <strong>Trigger</strong>, cerca e seleziona <strong>"Webhooks by Zapier"</strong></li>
            <li>Scegli <strong>"Catch Hook"</strong> come evento</li>
            <li>Zapier ti darà un <strong>URL webhook</strong> - <span className="text-primary font-medium">copialo e incollalo nel campo sopra</span></li>
            <li>Configura l'azione che vuoi eseguire quando ricevi i dati</li>
            <li>Attiva il Zap</li>
          </ol>
          
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 <strong>Suggerimento:</strong> L'URL webhook sarà simile a: 
              <code className="bg-blue-100 px-1 rounded">https://hooks.zapier.com/hooks/catch/123456/abcdef/</code>
            </p>
          </div>

          <h4 className="text-sm font-medium mb-2 mt-6">🔄 Configurazione alternativa - Invia lead dal tuo CRM a Zapier:</h4>
          <p className="text-xs text-muted-foreground mb-2">
            Se invece vuoi inviare lead dal nostro sistema verso Zapier, usa questo endpoint:
          </p>
          
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs font-mono break-all">
            {window.location.origin.replace(/:\d+/, '')}/functions/v1/zapier-lead-webhook
          </div>
          
          <div className="mt-3">
            <h5 className="text-xs font-medium mb-1">Struttura dati per nuovi lead:</h5>
            <div className="bg-gray-50 p-2 rounded text-xs">
              <pre>{JSON.stringify({
                company_name: "Nome Azienda (obbligatorio)",
                contact_name: "Nome Contatto",
                email: "email@esempio.com",
                phone: "+39 123 456 7890",
                value: 15000,
                notes: "Note aggiuntive"
              }, null, 2)}</pre>
            </div>
          </div>
          
          <p className="text-xs text-muted-foreground mt-2">
            Configura il tuo Zap per inviare i dati in questo formato all'endpoint sopra per creare automaticamente nuovi lead.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}