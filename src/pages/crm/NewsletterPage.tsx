import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Users, Target, Calendar, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailCampaign {
  subject: string;
  message: string;
  targetAudience: 'customers_won' | 'customers_lost' | 'installers' | 'importers' | 'resellers' | 'all_partners';
  pipelineStage?: string;
}

export default function NewsletterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState<EmailCampaign>({
    subject: '',
    message: '',
    targetAudience: 'all_partners'
  });

  const audienceOptions = [
    { value: 'customers_won', label: 'Clienti Vinti', icon: '🎯' },
    { value: 'customers_lost', label: 'Clienti Persi', icon: '💔' },
    { value: 'installers', label: 'Installatori', icon: '🔧' },
    { value: 'importers', label: 'Importatori', icon: '📦' },
    { value: 'resellers', label: 'Rivenditori', icon: '🏪' },
    { value: 'all_partners', label: 'Tutti i Partner', icon: '🌟' }
  ];

  const pipelineStages = [
    'lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  ];

  const handleSendCampaign = async () => {
    if (!campaign.subject || !campaign.message) {
      toast({
        title: "Errore",
        description: "Inserisci oggetto e messaggio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let emailData: any = {
        subject: campaign.subject,
        message: campaign.message,
        is_newsletter: true
      };

      // Set audience filters
      if (campaign.targetAudience === 'installers') {
        emailData.partner_type = 'installatore';
      } else if (campaign.targetAudience === 'importers') {
        emailData.partner_type = 'importatore';
      } else if (campaign.targetAudience === 'resellers') {
        emailData.partner_type = 'rivenditore';
      } else if (campaign.targetAudience === 'customers_won') {
        emailData.acquisition_status = 'cliente';
      } else if (campaign.targetAudience === 'customers_lost') {
        emailData.acquisition_status = 'perso';
      }

      const { data, error } = await supabase.functions.invoke('send-partner-emails', {
        body: emailData
      });

      if (error) throw error;

      toast({
        title: "Newsletter Inviata",
        description: `Campaign inviata con successo a ${data.emailsSent || 0} destinatari`,
      });

      // Reset form
      setCampaign({
        subject: '',
        message: '',
        targetAudience: 'all_partners'
      });

    } catch (error: any) {
      console.error('Errore invio newsletter:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'invio della newsletter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getAudienceInfo = () => {
    const option = audienceOptions.find(opt => opt.value === campaign.targetAudience);
    return option || audienceOptions[0];
  };

  const getPreviewMessage = () => {
    return campaign.message
      .replace(/\{partner_name\}/g, '[Nome Partner]')
      .replace(/\{company_name\}/g, '[Nome Azienda]');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Newsletter CRM</h1>
        <p className="text-muted-foreground">
          Gestisci e invia newsletter personalizzate ai tuoi clienti e partner
        </p>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Componi Newsletter
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Template
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Compose Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Componi Newsletter
                </CardTitle>
                <CardDescription>
                  Crea e invia una newsletter personalizzata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Oggetto</label>
                  <Input
                    placeholder="Oggetto della newsletter..."
                    value={campaign.subject}
                    onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Destinatari
                  </label>
                  <Select
                    value={campaign.targetAudience}
                    onValueChange={(value: any) => setCampaign(prev => ({ ...prev, targetAudience: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {audienceOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center gap-2">
                            <span>{option.icon}</span>
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary">
                      {getAudienceInfo().icon} {getAudienceInfo().label}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Messaggio</label>
                  <Textarea
                    placeholder="Scrivi il tuo messaggio qui... 
                    
Puoi usare questi placeholder:
- {partner_name} per il nome del partner
- {company_name} per il nome dell'azienda"
                    value={campaign.message}
                    onChange={(e) => setCampaign(prev => ({ ...prev, message: e.target.value }))}
                    rows={12}
                  />
                  <p className="text-xs text-muted-foreground">
                    Usa {'{partner_name}'} e {'{company_name}'} per personalizzare il messaggio
                  </p>
                </div>

                <Button 
                  onClick={handleSendCampaign} 
                  disabled={loading || !campaign.subject || !campaign.message}
                  className="w-full"
                >
                  {loading ? "Invio..." : "Invia Newsletter"}
                </Button>
              </CardContent>
            </Card>

            {/* Preview Panel */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Anteprima
                </CardTitle>
                <CardDescription>
                  Visualizza come apparirà la tua newsletter
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Da:</p>
                      <p className="font-medium">Sistema CRM &lt;noreply@company.com&gt;</p>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">A:</p>
                      <p className="font-medium">{getAudienceInfo().label}</p>
                    </div>

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Oggetto:</p>
                      <p className="font-medium">{campaign.subject || "Inserisci un oggetto..."}</p>
                    </div>

                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-muted-foreground mb-2">Messaggio:</p>
                      <div className="whitespace-pre-wrap text-sm">
                        {getPreviewMessage() || "Inserisci il messaggio per vedere l'anteprima..."}
                      </div>
                    </div>

                    <div className="border-t pt-4 text-xs text-muted-foreground">
                      <p>--</p>
                      <p>Questa email è stata inviata dal sistema CRM</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Predefiniti</CardTitle>
              <CardDescription>
                Seleziona un template per iniziare rapidamente
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  {
                    title: "Newsletter Mensile",
                    description: "Template per aggiornamenti mensili",
                    template: {
                      subject: "Newsletter Mensile - Aggiornamenti Partnership",
                      message: `Caro {partner_name},

Ecco gli aggiornamenti più importanti di questo mese per la nostra partnership con {company_name}:

📈 **Novità del Prodotto:**
- Nuove funzionalità rilasciate
- Miglioramenti nell'interfaccia
- Nuove opzioni disponibili

🎯 **Opportunità di Business:**
- Nuovi mercati disponibili
- Programmi di incentivi
- Eventi in programma

Grazie per essere un partner prezioso!`
                    }
                  },
                  {
                    title: "Follow-up Prospect",
                    description: "Template per ricontattare i prospect",
                    template: {
                      subject: "Follow-up Partnership - Opportunità di Collaborazione",
                      message: `Caro {partner_name},

Abbiamo notato il tuo interesse verso una possibile partnership con {company_name}.

🤝 **Vogliamo aiutarti a crescere:**
- Supporto dedicato per l'avvio
- Materiali di training personalizzati
- Condizioni commerciali competitive

📞 **Prossimi Passi:**
Siamo pronti a programmare una chiamata per discutere le tue esigenze.

Contattaci per fissare un appuntamento.`
                    }
                  }
                ].map((template, index) => (
                  <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{template.title}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setCampaign(prev => ({ 
                          ...prev, 
                          ...template.template 
                        }))}
                      >
                        Usa Template
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}