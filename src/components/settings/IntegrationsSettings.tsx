import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, ExternalLink, Webhook, Zap, Users, ShoppingCart, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import ZapierIntegration from "@/components/leads/ZapierIntegration";

export function IntegrationsSettings() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const baseUrl = "https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1";
  
  // External website lead endpoints
  const externalLeadEndpoints = [
    {
      name: "Lead Vesuviano",
      pipeline: "Vesuviano",
      endpoint: `${baseUrl}/external-lead-webhook?pipeline=Vesuviano`,
      description: "Endpoint per ricevere lead dal sito Vesuviano Forni",
      color: "bg-orange-500"
    },
    {
      name: "Lead ZAPPER",
      pipeline: "ZAPPER",
      endpoint: `${baseUrl}/external-lead-webhook?pipeline=ZAPPER`,
      description: "Endpoint per ricevere lead dal sito ZAPPER",
      color: "bg-blue-500"
    }
  ];

  const webhookEndpoints = [
    {
      name: "Webhook Generico",
      endpoint: `${baseUrl}/zapier-webhook`,
      description: "Endpoint universale per tutti i tipi di dati da Zapier",
      icon: <Webhook className="h-5 w-5" />,
      types: ["lead", "customer", "contact", "general"],
      example: `${baseUrl}/zapier-webhook?type=lead`
    },
    {
      name: "Lead Specifico", 
      endpoint: `${baseUrl}/zapier-lead-webhook`,
      description: "Endpoint dedicato per la creazione di lead",
      icon: <Users className="h-5 w-5" />,
      types: ["lead"],
      example: `${baseUrl}/zapier-lead-webhook`
    }
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedEndpoint(label);
      setTimeout(() => setCopiedEndpoint(null), 2000);
      toast({
        title: "Copiato!",
        description: `${label} copiato negli appunti`,
      });
    } catch (err) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="external-leads" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="external-leads">Endpoint Lead</TabsTrigger>
          <TabsTrigger value="zapier">Zapier</TabsTrigger>
          <TabsTrigger value="webhooks">Webhook Endpoints</TabsTrigger>
          <TabsTrigger value="other">Altre Integrazioni</TabsTrigger>
        </TabsList>

        <TabsContent value="external-leads" className="space-y-4">
          <div className="mb-4">
            <h3 className="text-lg font-semibold mb-2">Endpoint per Lead da Siti Esterni</h3>
            <p className="text-muted-foreground text-sm">
              Usa questi endpoint per ricevere lead direttamente dai tuoi siti web esterni. I lead verranno automaticamente importati nel CRM.
            </p>
          </div>

          <div className="grid gap-4">
            {externalLeadEndpoints.map((endpoint, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className={`p-2 rounded-lg ${endpoint.color}`}>
                      <Globe className="h-5 w-5 text-white" />
                    </div>
                    {endpoint.name}
                    <Badge variant="secondary">{endpoint.pipeline}</Badge>
                  </CardTitle>
                  <CardDescription>{endpoint.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL Endpoint (POST):</Label>
                    <div className="flex gap-2">
                      <Input
                        value={endpoint.endpoint}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(endpoint.endpoint, endpoint.name)}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedEndpoint === endpoint.name ? "Copiato!" : "Copia"}
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Esempio di utilizzo (JavaScript/Fetch):</h4>
                    <pre className="text-xs overflow-x-auto bg-background p-3 rounded border">
{`fetch("${endpoint.endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    company_name: "Nome Azienda",
    contact_name: "Nome Contatto",
    email: "email@esempio.it",
    phone: "+39 333 1234567",
    notes: "Messaggio dal form",
    source: "sito-${endpoint.pipeline.toLowerCase()}"
  })
})`}
                    </pre>
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Campi accettati:</h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li><code className="bg-background px-1 rounded">company_name</code> - Nome azienda</li>
                      <li><code className="bg-background px-1 rounded">contact_name</code> - Nome contatto</li>
                      <li><code className="bg-background px-1 rounded">email</code> - Email</li>
                      <li><code className="bg-background px-1 rounded">phone</code> - Telefono (auto-detect paese dal prefisso)</li>
                      <li><code className="bg-background px-1 rounded">value</code> - Valore stimato</li>
                      <li><code className="bg-background px-1 rounded">notes</code> - Note/Messaggio</li>
                      <li><code className="bg-background px-1 rounded">source</code> - Fonte del lead</li>
                      <li><code className="bg-background px-1 rounded">luogo</code> - Località</li>
                    </ul>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label>Documentazione API:</Label>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => window.open(endpoint.endpoint, '_blank')}
                      className="p-0 h-auto"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Visualizza (GET)
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        <TabsContent value="zapier" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" />
                Integrazione Zapier
              </CardTitle>
              <CardDescription>
                Configura Zapier per automatizzare la creazione di lead
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ZapierIntegration />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks" className="space-y-4">
          <div className="grid gap-4">
            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Endpoint Webhook per Zapier</h3>
              <p className="text-muted-foreground text-sm">
                Usa questi endpoint nelle tue automazioni Zapier per inviare dati direttamente al sistema.
              </p>
            </div>

            {webhookEndpoints.map((webhook, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {webhook.icon}
                    {webhook.name}
                  </CardTitle>
                  <CardDescription>{webhook.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL Endpoint:</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhook.endpoint}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(webhook.endpoint, webhook.name)}
                      >
                        <Copy className="h-4 w-4" />
                        {copiedEndpoint === webhook.name ? "Copiato!" : "Copia"}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipi supportati:</Label>
                    <div className="flex gap-2 flex-wrap">
                      {webhook.types.map((type) => (
                        <Badge key={type} variant="secondary">
                          {type}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Esempio di utilizzo:</Label>
                    <div className="flex gap-2">
                      <Input
                        value={webhook.example}
                        readOnly
                        className="font-mono text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(webhook.example, `Esempio ${webhook.name}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label>Documentazione API:</Label>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => window.open(webhook.endpoint, '_blank')}
                        className="p-0 h-auto"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Visualizza
                      </Button>
                    </div>
                  </div>

                  {webhook.name === "Webhook Generico" && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <h4 className="font-medium mb-2">Come configurare in Zapier:</h4>
                      <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                        <li>Crea un nuovo Zap in Zapier</li>
                        <li>Configura il trigger (es. nuovo form, email, ecc.)</li>
                        <li>Aggiungi azione "Webhooks by Zapier"</li>
                        <li>Scegli "POST" come metodo</li>
                        <li>Incolla l'URL dell'endpoint sopra</li>
                        <li>Aggiungi "?type=lead" (o customer/contact) all'URL</li>
                        <li>Configura i dati da inviare nel body</li>
                        <li>Testa e attiva il Zap</li>
                      </ol>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="other" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
                Altre Integrazioni
              </CardTitle>
              <CardDescription>
                Integrazioni aggiuntive e servizi esterni
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>Nessuna integrazione aggiuntiva configurata.</p>
                <p className="text-sm mt-2">
                  Le integrazioni future appariranno qui.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}