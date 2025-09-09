import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, Users, Target, Calendar, Settings, Loader } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface EmailCampaign {
  subject: string;
  message: string;
  targetAudience: 'customers_won' | 'customers_lost' | 'installers' | 'importers' | 'resellers' | 'all_partners' | 'all_crm_contacts';
  pipelineStage?: string;
}

interface EmailCounts {
  customers_won: number;
  customers_lost: number;
  installers: number;
  importers: number;
  resellers: number;
  all_partners: number;
  all_crm_contacts: number;
}

export default function NewsletterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [emailCounts, setEmailCounts] = useState<EmailCounts>({
    customers_won: 0,
    customers_lost: 0,
    installers: 0,
    importers: 0,
    resellers: 0,
    all_partners: 0,
    all_crm_contacts: 0
  });
  const [campaign, setCampaign] = useState<EmailCampaign>({
    subject: '',
    message: '',
    targetAudience: 'all_partners'
  });

  const audienceOptions = [
    { value: 'all_crm_contacts', label: 'Tutti i Contatti CRM', icon: '📧', description: 'Tutti i contatti nel sistema CRM' },
    { value: 'customers_won', label: 'Clienti Vinti', icon: '🎯', description: 'Opportunità chiuse con successo' },
    { value: 'customers_lost', label: 'Clienti Persi', icon: '💔', description: 'Opportunità perse o chiuse negativamente' },
    { value: 'installers', label: 'Installatori', icon: '🔧', description: 'Partner che si occupano di installazione' },
    { value: 'importers', label: 'Importatori', icon: '📦', description: 'Partner che importano i prodotti' },
    { value: 'resellers', label: 'Rivenditori', icon: '🏪', description: 'Partner rivenditori' },
    { value: 'all_partners', label: 'Tutti i Partner', icon: '🌟', description: 'Tutti i partner attivi' }
  ];

  // Fetch email counts from database
  const fetchEmailCounts = async () => {
    setLoadingCounts(true);
    try {
      // Get all CRM contacts with email
      const { count: crmCount } = await supabase
        .from('crm_contacts')
        .select('id', { count: 'exact' })
        .not('email', 'is', null);

      // Get partners by type with email
      const { data: partnersData } = await supabase
        .from('partners')
        .select('partner_type, acquisition_status, email')
        .not('email', 'is', null);

      const counts: EmailCounts = {
        all_crm_contacts: crmCount || 0,
        customers_won: 0,
        customers_lost: 0,
        installers: 0,
        importers: 0,
        resellers: 0,
        all_partners: partnersData?.length || 0
      };

      if (partnersData) {
        partnersData.forEach(partner => {
          if (partner.partner_type === 'installatore') counts.installers++;
          if (partner.partner_type === 'importatore') counts.importers++;
          if (partner.partner_type === 'rivenditore') counts.resellers++;
          if (partner.acquisition_status === 'cliente') counts.customers_won++;
          if (partner.acquisition_status === 'perso') counts.customers_lost++;
        });
      }

      setEmailCounts(counts);
    } catch (error) {
      console.error('Error fetching email counts:', error);
      toast({
        title: "Errore",
        description: "Errore nel recupero dei conteggi email",
        variant: "destructive",
      });
    } finally {
      setLoadingCounts(false);
    }
  };

  useEffect(() => {
    fetchEmailCounts();
  }, []);

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

      // Set audience filters based on target
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
      } else if (campaign.targetAudience === 'all_crm_contacts') {
        emailData.use_crm_contacts = true;
      }

      let functionName = 'send-partner-emails';
      if (campaign.targetAudience === 'all_crm_contacts') {
        functionName = 'send-customer-emails'; // Use different function for CRM contacts
      }

      const { data, error } = await supabase.functions.invoke(functionName, {
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

      // Refresh counts
      fetchEmailCounts();

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

  const getCurrentEmailCount = () => {
    return emailCounts[campaign.targetAudience] || 0;
  };

  const getPreviewMessage = () => {
    return campaign.message
      .replace(/\{partner_name\}/g, '[Nome Partner]')
      .replace(/\{company_name\}/g, '[Nome Azienda]');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter CRM</h1>
          <p className="text-muted-foreground">
            Gestisci e invia newsletter personalizzate ai tuoi clienti e partner
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={fetchEmailCounts}
          disabled={loadingCounts}
          className="flex items-center gap-2"
        >
          {loadingCounts ? <Loader className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          Aggiorna Conteggi
        </Button>
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
                    <Badge variant="secondary" className="flex items-center gap-1">
                      {getAudienceInfo().icon} {getAudienceInfo().label}
                    </Badge>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {getCurrentEmailCount()} email disponibili
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getAudienceInfo().description}
                  </p>
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
                  disabled={loading || !campaign.subject || !campaign.message || getCurrentEmailCount() === 0}
                  className="w-full"
                >
                  {loading ? "Invio..." : `Invia Newsletter (${getCurrentEmailCount()})`}
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
              <CardTitle>Destinatari Disponibili</CardTitle>
              <CardDescription>
                Seleziona il pubblico di destinazione per la tua newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {loadingCounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader className="h-6 w-6 animate-spin" />
                    <span className="ml-2">Caricamento conteggi...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {audienceOptions.map((option) => (
                      <Card 
                        key={option.value} 
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          campaign.targetAudience === option.value ? 'ring-2 ring-primary' : ''
                        }`}
                        onClick={() => setCampaign(prev => ({ ...prev, targetAudience: option.value as EmailCampaign['targetAudience'] }))}
                      >
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base flex items-center gap-2">
                            <span className="text-lg">{option.icon}</span>
                            {option.label}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <div className="text-2xl font-bold text-primary">
                              {emailCounts[option.value as keyof EmailCounts]}
                            </div>
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {option.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

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