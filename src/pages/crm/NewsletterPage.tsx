import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, Send, Users, Target, Calendar, Settings, Loader, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmailListManager } from "@/components/crm/EmailListManager";
import { NewsletterTemplateEditor } from "@/components/crm/NewsletterTemplateEditor";
import { SenderEmailManager } from "@/components/crm/SenderEmailManager";
import { ContactManager } from "@/components/crm/ContactManager";

interface EmailCampaign {
  subject: string;
  message: string;
  targetAudience: 'customers_won' | 'customers_lost' | 'installers' | 'importers' | 'resellers' | 'all_partners' | 'all_crm_contacts' | 'custom_list' | 'partners' | string;
  pipelineStage?: string;
  customListId?: string;
  partnerFilters?: {
    partner_type?: string;
    acquisition_status?: string;
    excludedCountries?: string[];
    region?: string;
  };
  template?: {
    logo?: string;
    headerText: string;
    footerText: string;
    signature: string;
    attachments: Array<{
      id: string;
      name: string;
      url: string;
      type: string;
    }>;
  };
  senderEmail?: {
    id: string;
    email: string;
    name: string;
    is_verified: boolean;
  };
}

interface EmailCounts {
  customers_won: number;
  customers_lost: number;
  installers: number;
  importers: number;
  resellers: number;
  all_partners: number;
  all_crm_contacts: number;
  custom_list: number;
  partners: number;
}

interface SentEmail {
  id: string;
  subject: string;
  campaign_type: string;
  recipients_count: number;
  success_count: number;
  failure_count: number;
  sent_at: string | null;
  created_at: string;
  partner_type?: string;
  region?: string;
}

export default function NewsletterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingCounts, setLoadingCounts] = useState(true);
  const [loadingSentEmails, setLoadingSentEmails] = useState(false);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [emailCounts, setEmailCounts] = useState<EmailCounts>({
    customers_won: 0,
    customers_lost: 0,
    installers: 0,
    importers: 0,
    resellers: 0,
    all_partners: 0,
    all_crm_contacts: 0,
    custom_list: 0,
    partners: 0
  });
  const [emailLists, setEmailLists] = useState<Array<{id: string, name: string, description: string, contact_count: number}>>([]);
  const [selectedCustomList, setSelectedCustomList] = useState<string>('');
  const [selectedCustomListCount, setSelectedCustomListCount] = useState<number>(0);
  const [partnerFilterCount, setPartnerFilterCount] = useState<number>(0);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<any>(null);
  const [campaign, setCampaign] = useState<EmailCampaign>({
    subject: '',
    message: '',
    targetAudience: 'all_partners',
    template: {
      headerText: "Newsletter Aziendale",
      footerText: "© 2024 La Tua Azienda. Tutti i diritti riservati.",
      signature: "Cordiali saluti,\nIl Team Marketing",
      attachments: []
    }
  });

  const audienceOptions = [
    { value: 'all_crm_contacts', label: 'Tutti i Contatti CRM', icon: '📧', description: 'Tutti i contatti nel sistema CRM' },
    { value: 'customers_won', label: 'Clienti Vinti', icon: '🎯', description: 'Opportunità chiuse con successo' },
    { value: 'customers_lost', label: 'Clienti Persi', icon: '💔', description: 'Opportunità perse o chiuse negativamente' },
    { value: 'installers', label: 'Installatori', icon: '🔧', description: 'Partner che si occupano di installazione' },
    { value: 'importers', label: 'Importatori', icon: '📦', description: 'Partner che importano i prodotti' },
    { value: 'resellers', label: 'Rivenditori', icon: '🏪', description: 'Partner rivenditori' },
    { value: 'all_partners', label: 'Tutti i Partner', icon: '🌟', description: 'Tutti i partner attivi' },
    { value: 'partners', label: 'Partner Personalizzati', icon: '🎯', description: 'Seleziona partner con filtri specifici' }
  ];

  // Fetch email counts and lists from database
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

      // Get email lists (simplified without contact count for now)
      const { data: listsData } = await supabase
        .from('email_lists')
        .select('id, name, description')
        .order('name');

      // For now, set contact count to 0 - will be updated when list is selected
      const emailListsFormatted = (listsData || []).map(list => ({
        id: list.id,
        name: list.name,
        description: list.description || '',
        contact_count: 0
      }));

      // Get contact counts for each list
      if (listsData && listsData.length > 0) {
        for (const list of listsData) {
          try {
            const { count } = await supabase
              .from('email_list_contacts')
              .select('id', { count: 'exact' })
              .eq('email_list_id', list.id);
            
            const listIndex = emailListsFormatted.findIndex(l => l.id === list.id);
            if (listIndex !== -1) {
              emailListsFormatted[listIndex].contact_count = count || 0;
            }
          } catch (error) {
            console.error('Error fetching count for list', list.id, error);
          }
        }
      }

      const counts: EmailCounts = {
        all_crm_contacts: crmCount || 0,
        customers_won: 0,
        customers_lost: 0,
        installers: 0,
        importers: 0,
        resellers: 0,
        all_partners: partnersData?.length || 0,
        custom_list: 0,
        partners: partnersData?.length || 0
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
      setEmailLists(emailListsFormatted);
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

  // Fetch sent campaigns from email_campaigns
  const fetchSentEmails = async () => {
    setLoadingSentEmails(true);
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('id, subject, campaign_type, recipients_count, success_count, failure_count, sent_at, created_at, partner_type, region')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSentEmails((data || []) as SentEmail[]);
    } catch (error) {
      console.error('Error fetching sent campaigns:', error);
      toast({
        title: "Errore",
        description: "Errore nel recupero delle campagne email inviate",
        variant: "destructive",
      });
    } finally {
      setLoadingSentEmails(false);
    }
  };

  useEffect(() => {
    fetchEmailCounts();
    fetchSentEmails();
  }, []);

  // Effect to update partner filter count when filters change
  useEffect(() => {
    if (campaign.targetAudience === 'partners') {
      fetchPartnerFilterCount();
    }
  }, [campaign.targetAudience, campaign.partnerFilters]);

  const fetchPartnerFilterCount = async () => {
    try {
      console.log('Fetching partner filter count with filters:', campaign.partnerFilters);
      
      let query = supabase
        .from('partners')
        .select('id', { count: 'exact' })
        .not('email', 'is', null);

      // Apply filters
      if (campaign.partnerFilters?.partner_type) {
        query = query.eq('partner_type', campaign.partnerFilters.partner_type);
        console.log('Applied partner_type filter:', campaign.partnerFilters.partner_type);
      }
      if (campaign.partnerFilters?.acquisition_status) {
        query = query.eq('acquisition_status', campaign.partnerFilters.acquisition_status);
        console.log('Applied acquisition_status filter:', campaign.partnerFilters.acquisition_status);
      }
      if (campaign.partnerFilters?.excludedCountries && campaign.partnerFilters.excludedCountries.length > 0) {
        // Exclude specific countries
        campaign.partnerFilters.excludedCountries.forEach(country => {
          query = query.neq('country', country);
          console.log('Excluding country:', country);
        });
      }
      if (campaign.partnerFilters?.region) {
        query = query.ilike('region', `%${campaign.partnerFilters.region}%`);
        console.log('Applied region filter:', campaign.partnerFilters.region);
      }

      const { count, error } = await query;
      console.log('Partner filter query result - count:', count, 'error:', error);

      if (error) throw error;
      setPartnerFilterCount(count || 0);
    } catch (error) {
      console.error('Error fetching partner filter count:', error);
      setPartnerFilterCount(0);
    }
  };


  const pipelineStages = [
    'lead', 'qualified', 'proposal', 'negotiation', 'closed_won', 'closed_lost'
  ];

  const handleSendCampaign = async () => {
    if (!campaign.subject || !campaign.message || !selectedSenderEmail) {
      toast({
        title: "Errore",
        description: "Inserisci oggetto, messaggio e seleziona email mittente",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSenderEmail.is_verified) {
      toast({
        title: "Errore",
        description: "L'email mittente deve essere verificata per poter inviare newsletter",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let emailData: any = {
        subject: campaign.subject,
        message: getPreviewMessage(),
        is_newsletter: true,
        template: campaign.template,
        senderEmail: selectedSenderEmail
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
      } else if (campaign.targetAudience === 'custom_list' && selectedCustomList) {
        emailData.custom_list_id = selectedCustomList;
      } else if (campaign.targetAudience === 'partners' && campaign.partnerFilters) {
        // Apply custom partner filters
        if (campaign.partnerFilters.partner_type) {
          emailData.partner_type = campaign.partnerFilters.partner_type;
        }
        if (campaign.partnerFilters.acquisition_status) {
          emailData.acquisition_status = campaign.partnerFilters.acquisition_status;
        }
        if (campaign.partnerFilters.excludedCountries && campaign.partnerFilters.excludedCountries.length > 0) {
          emailData.excludedCountries = campaign.partnerFilters.excludedCountries;
        }
        if (campaign.partnerFilters.region) {
          emailData.region = campaign.partnerFilters.region;
        }
      } else {
        // Check if it's a specific email list ID
        const list = emailLists.find(list => list.id === campaign.targetAudience);
        if (list) {
          emailData.custom_list_id = list.id;
        }
      }

      let functionName = 'send-partner-emails';
      if (campaign.targetAudience === 'all_crm_contacts') {
        functionName = 'send-customer-emails'; // Use different function for CRM contacts
      } else if (campaign.targetAudience === 'custom_list' || emailLists.find(list => list.id === campaign.targetAudience)) {
        functionName = 'send-customer-emails'; // Use customer emails function for custom lists
      }

      const { data, error } = await supabase.functions.invoke('queue-newsletter-emails', {
        body: emailData
      });

      if (error) throw error;

      toast({
        title: "Newsletter Accodata",
        description: `Email accodata con successo per ${data.emailsQueued || 0} destinatari`,
      });

      // Reset form
      setCampaign({
        subject: '',
        message: '',
        targetAudience: 'all_partners',
        template: {
          headerText: "Newsletter Aziendale",
          footerText: "© 2024 La Tua Azienda. Tutti i diritti riservati.",
          signature: "Cordiali saluti,\nIl Team Marketing",
          attachments: []
        }
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
    // Check if it's a custom list first
    const list = emailLists.find(list => list.id === campaign.targetAudience);
    if (list) {
      return {
        value: list.id,
        label: list.name,
        icon: '📋',
        description: `Lista email personalizzata`
      };
    }
    
    const option = audienceOptions.find(opt => opt.value === campaign.targetAudience);
    return option || audienceOptions[0];
  };

  const getCurrentEmailCount = () => {
    if (campaign.targetAudience === 'custom_list') {
      return selectedCustomListCount;
    }
    
    // Check if it's partners with custom filters
    if (campaign.targetAudience === 'partners') {
      return partnerFilterCount;
    }
    
    // Check if it's a custom list ID - use the count from state
    const list = emailLists.find(list => list.id === campaign.targetAudience);
    if (list) {
      return list.contact_count;
    }
    
    return emailCounts[campaign.targetAudience] || 0;
  };

  const handleCustomListSelect = (listId: string, contactCount: number) => {
    setSelectedCustomList(listId);
    setSelectedCustomListCount(contactCount);
    setCampaign(prev => ({ ...prev, targetAudience: 'custom_list' }));
  };

  const handleTemplateChange = (template: any) => {
    console.log("Template changed:", template);
    setCampaign(prev => ({ ...prev, template }));
  };

  const handleTemplateSelect = (templateData: { subject: string; message: string }) => {
    console.log("Template selected:", templateData);
    setCampaign(prev => ({ 
      ...prev, 
      subject: templateData.subject,
      message: templateData.message
    }));
  };

  const handleSenderEmailSelect = (email: any) => {
    setSelectedSenderEmail(email);
  };

  const getPreviewMessage = () => {
    let message = campaign.message
      .replace(/\{partner_name\}/g, '[Nome Partner]')
      .replace(/\{customer_name\}/g, '[Nome Partner]')
      .replace(/\{company_name\}/g, '[Nome Azienda]');
    
    const template = campaign.template;
    if (!template) return message;

    // Remove template-generated content from the message to avoid duplication
    // Remove the logo placeholder text
    message = message.replace(/\[LOGO AZIENDALE\]\s*\n\n/g, '');
    message = message.replace(/🖼️ \[LOGO AZIENDALE\]\s*\n\n/g, '');
    
    // Remove header text if it appears in the message
    if (template.headerText) {
      message = message.replace(new RegExp(`^${template.headerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n`, 'gm'), '');
    }
    
    // Remove separator lines
    message = message.replace(/━━━━━━━━━━━━━━━━━━━━━━━━\s*\n/g, '');
    
    // Remove signature if it appears in the message
    if (template.signature) {
      const escapedSignature = template.signature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      message = message.replace(new RegExp(`\\n\\n${escapedSignature}\\s*\\n`, 'gm'), '');
    }
    
    // Remove footer if it appears in the message  
    if (template.footerText) {
      const escapedFooter = template.footerText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      message = message.replace(new RegExp(`\\n\\n${escapedFooter}\\s*$`, 'gm'), '');
    }

    // Clean up extra newlines
    message = message.replace(/\n{3,}/g, '\n\n').trim();

    // Now generate the proper formatted preview
    let preview = "";
    
    // Logo removed as requested - no placeholder needed
    
    // Header text removed as requested
    
    preview += `${message}\n\n`;
    
    if (template.attachments && template.attachments.length > 0) {
      preview += `📎 Allegati:\n`;
      template.attachments.forEach(att => {
        preview += `• ${att.name}\n`;
      });
      preview += `\n`;
    }
    
    if (template.signature) {
      preview += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      preview += `${template.signature}\n\n`;
    }
    
    if (template.footerText) {
      preview += `${template.footerText}`;
    }

    return preview.trim();
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
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Cronologia Email
          </TabsTrigger>
          <TabsTrigger value="emails" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Mittente
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatti
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Liste Email
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
                  <label className="text-sm font-medium">Email Mittente</label>
                  {selectedSenderEmail ? (
                    <div className="flex items-center gap-2 p-2 border rounded">
                      <Mail className="h-4 w-4" />
                      <span className="font-medium">{selectedSenderEmail.name}</span>
                      <span className="text-muted-foreground">({selectedSenderEmail.email})</span>
                      {selectedSenderEmail.is_verified ? (
                        <Badge variant="default" className="text-xs">Verificata</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Non verificata</Badge>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground p-2 border rounded border-dashed">
                      Vai alla tab "Email Mittente" per configurare un indirizzo
                    </div>
                  )}
                </div>

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
                      {emailLists.length > 0 && (
                        <>
                          <div className="px-2 py-1 text-xs font-medium text-muted-foreground border-t">
                            Liste Email Personalizzate
                          </div>
                          {emailLists.map((list) => (
                            <SelectItem key={list.id} value={list.id}>
                              <span className="flex items-center gap-2">
                                <span>📋</span>
                                {list.name} ({list.contact_count})
                              </span>
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>

                  {/* Partner Filters */}
                  {campaign.targetAudience === 'partners' && (
                    <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <h4 className="font-medium text-sm">Filtri Partner</h4>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-xs font-medium">Tipo Partner</label>
                          <Select
                            value={campaign.partnerFilters?.partner_type || 'all'}
                            onValueChange={(value) => setCampaign(prev => ({
                              ...prev,
                              partnerFilters: { ...prev.partnerFilters, partner_type: value === 'all' ? undefined : value }
                            }))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Tutti" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutti i tipi</SelectItem>
                              <SelectItem value="installatore">🔧 Installatori</SelectItem>
                              <SelectItem value="importatore">📦 Importatori</SelectItem>
                              <SelectItem value="rivenditore">🏪 Rivenditori</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-medium">Fase Acquisizione</label>
                          <Select
                            value={campaign.partnerFilters?.acquisition_status || 'all'}
                            onValueChange={(value) => setCampaign(prev => ({
                              ...prev,
                              partnerFilters: { ...prev.partnerFilters, acquisition_status: value === 'all' ? undefined : value }
                            }))}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Tutte" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tutte le fasi</SelectItem>
                              <SelectItem value="prospect">🎯 Prospect</SelectItem>
                              <SelectItem value="contatto">📞 Contatto</SelectItem>
                              <SelectItem value="negoziazione">💬 Negoziazione</SelectItem>
                              <SelectItem value="contratto">📋 Contratto</SelectItem>
                              <SelectItem value="attivo">✅ Attivo</SelectItem>
                              <SelectItem value="inattivo">❌ Inattivo</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Escludi Paesi</label>
                        <div className="space-y-2">
                          {/* Excluded countries display */}
                          {campaign.partnerFilters?.excludedCountries && campaign.partnerFilters.excludedCountries.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {campaign.partnerFilters.excludedCountries.map((country) => (
                                <Badge 
                                  key={country} 
                                  variant="secondary" 
                                  className="text-xs flex items-center gap-1"
                                >
                                  {country}
                                  <button
                                    onClick={() => {
                                      setCampaign(prev => ({
                                        ...prev,
                                        partnerFilters: {
                                          ...prev.partnerFilters,
                                          excludedCountries: prev.partnerFilters?.excludedCountries?.filter(c => c !== country) || []
                                        }
                                      }));
                                    }}
                                    className="ml-1 hover:bg-destructive/20 rounded-full"
                                  >
                                    ×
                                  </button>
                                </Badge>
                              ))}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCampaign(prev => ({
                                    ...prev,
                                    partnerFilters: {
                                      ...prev.partnerFilters,
                                      excludedCountries: []
                                    }
                                  }));
                                }}
                                className="text-xs h-6 px-2"
                              >
                                Rimuovi tutti
                              </Button>
                            </div>
                          )}
                          
                          {/* Country selection dropdown */}
                          <Select
                            onValueChange={(value) => {
                              if (value && value !== "all") {
                                setCampaign(prev => {
                                  const currentExcluded = prev.partnerFilters?.excludedCountries || [];
                                  if (!currentExcluded.includes(value)) {
                                    return {
                                      ...prev,
                                      partnerFilters: { 
                                        ...prev.partnerFilters, 
                                        excludedCountries: [...currentExcluded, value]
                                      }
                                    };
                                  }
                                  return prev;
                                });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Escludi paese" />
                            </SelectTrigger>
                            <SelectContent>
                            <SelectItem value="all">🌍 Seleziona paese da escludere</SelectItem>
                            <SelectItem value="Italia">🇮🇹 Italia</SelectItem>
                            <SelectItem value="Francia">🇫🇷 Francia</SelectItem>
                            <SelectItem value="Germania">🇩🇪 Germania</SelectItem>
                            <SelectItem value="Spagna">🇪🇸 Spagna</SelectItem>
                            <SelectItem value="Portogallo">🇵🇹 Portogallo</SelectItem>
                            <SelectItem value="Regno Unito">🇬🇧 Regno Unito</SelectItem>
                            <SelectItem value="Irlanda">🇮🇪 Irlanda</SelectItem>
                            <SelectItem value="Paesi Bassi">🇳🇱 Paesi Bassi</SelectItem>
                            <SelectItem value="Belgio">🇧🇪 Belgio</SelectItem>
                            <SelectItem value="Lussemburgo">🇱🇺 Lussemburgo</SelectItem>
                            <SelectItem value="Svizzera">🇨🇭 Svizzera</SelectItem>
                            <SelectItem value="Austria">🇦🇹 Austria</SelectItem>
                            <SelectItem value="Polonia">🇵🇱 Polonia</SelectItem>
                            <SelectItem value="Repubblica Ceca">🇨🇿 Repubblica Ceca</SelectItem>
                            <SelectItem value="Slovacchia">🇸🇰 Slovacchia</SelectItem>
                            <SelectItem value="Ungheria">🇭🇺 Ungheria</SelectItem>
                            <SelectItem value="Slovenia">🇸🇮 Slovenia</SelectItem>
                            <SelectItem value="Croazia">🇭🇷 Croazia</SelectItem>
                            <SelectItem value="Serbia">🇷🇸 Serbia</SelectItem>
                            <SelectItem value="Bosnia ed Erzegovina">🇧🇦 Bosnia ed Erzegovina</SelectItem>
                            <SelectItem value="Montenegro">🇲🇪 Montenegro</SelectItem>
                            <SelectItem value="Macedonia del Nord">🇲🇰 Macedonia del Nord</SelectItem>
                            <SelectItem value="Albania">🇦🇱 Albania</SelectItem>
                            <SelectItem value="Grecia">🇬🇷 Grecia</SelectItem>
                            <SelectItem value="Bulgaria">🇧🇬 Bulgaria</SelectItem>
                            <SelectItem value="Romania">🇷🇴 Romania</SelectItem>
                            <SelectItem value="Moldova">🇲🇩 Moldova</SelectItem>
                            <SelectItem value="Ucraina">🇺🇦 Ucraina</SelectItem>
                            <SelectItem value="Bielorussia">🇧🇾 Bielorussia</SelectItem>
                            <SelectItem value="Lituania">🇱🇹 Lituania</SelectItem>
                            <SelectItem value="Lettonia">🇱🇻 Lettonia</SelectItem>
                            <SelectItem value="Estonia">🇪🇪 Estonia</SelectItem>
                            <SelectItem value="Finlandia">🇫🇮 Finlandia</SelectItem>
                            <SelectItem value="Svezia">🇸🇪 Svezia</SelectItem>
                            <SelectItem value="Norvegia">🇳🇴 Norvegia</SelectItem>
                            <SelectItem value="Danimarca">🇩🇰 Danimarca</SelectItem>
                            <SelectItem value="Islanda">🇮🇸 Islanda</SelectItem>
                            <SelectItem value="Russia">🇷🇺 Russia</SelectItem>
                            <SelectItem value="Turchia">🇹🇷 Turchia</SelectItem>
                            <SelectItem value="Cipro">🇨🇾 Cipro</SelectItem>
                            <SelectItem value="Malta">🇲🇹 Malta</SelectItem>
                            <SelectItem value="Stati Uniti">🇺🇸 Stati Uniti</SelectItem>
                            <SelectItem value="Canada">🇨🇦 Canada</SelectItem>
                            <SelectItem value="Messico">🇲🇽 Messico</SelectItem>
                            <SelectItem value="Brasile">🇧🇷 Brasile</SelectItem>
                            <SelectItem value="Argentina">🇦🇷 Argentina</SelectItem>
                            <SelectItem value="Cile">🇨🇱 Cile</SelectItem>
                            <SelectItem value="Colombia">🇨🇴 Colombia</SelectItem>
                            <SelectItem value="Peru">🇵🇪 Peru</SelectItem>
                            <SelectItem value="Ecuador">🇪🇨 Ecuador</SelectItem>
                            <SelectItem value="Uruguay">🇺🇾 Uruguay</SelectItem>
                            <SelectItem value="Paraguay">🇵🇾 Paraguay</SelectItem>
                            <SelectItem value="Bolivia">🇧🇴 Bolivia</SelectItem>
                            <SelectItem value="Venezuela">🇻🇪 Venezuela</SelectItem>
                            <SelectItem value="Guyana">🇬🇾 Guyana</SelectItem>
                            <SelectItem value="Suriname">🇸🇷 Suriname</SelectItem>
                            <SelectItem value="Giappone">🇯🇵 Giappone</SelectItem>
                            <SelectItem value="Corea del Sud">🇰🇷 Corea del Sud</SelectItem>
                            <SelectItem value="Cina">🇨🇳 Cina</SelectItem>
                            <SelectItem value="Taiwan">🇹🇼 Taiwan</SelectItem>
                            <SelectItem value="Hong Kong">🇭🇰 Hong Kong</SelectItem>
                            <SelectItem value="Singapore">🇸🇬 Singapore</SelectItem>
                            <SelectItem value="Malesia">🇲🇾 Malesia</SelectItem>
                            <SelectItem value="Thailandia">🇹🇭 Thailandia</SelectItem>
                            <SelectItem value="Vietnam">🇻🇳 Vietnam</SelectItem>
                            <SelectItem value="Filippine">🇵🇭 Filippine</SelectItem>
                            <SelectItem value="Indonesia">🇮🇩 Indonesia</SelectItem>
                            <SelectItem value="India">🇮🇳 India</SelectItem>
                            <SelectItem value="Australia">🇦🇺 Australia</SelectItem>
                            <SelectItem value="Nuova Zelanda">🇳🇿 Nuova Zelanda</SelectItem>
                            <SelectItem value="Sud Africa">🇿🇦 Sud Africa</SelectItem>
                            <SelectItem value="Egitto">🇪🇬 Egitto</SelectItem>
                            <SelectItem value="Marocco">🇲🇦 Marocco</SelectItem>
                            <SelectItem value="Tunisia">🇹🇳 Tunisia</SelectItem>
                            <SelectItem value="Algeria">🇩🇿 Algeria</SelectItem>
                            <SelectItem value="Libia">🇱🇾 Libia</SelectItem>
                            <SelectItem value="Nigeria">🇳🇬 Nigeria</SelectItem>
                            <SelectItem value="Kenya">🇰🇪 Kenya</SelectItem>
                            <SelectItem value="Ghana">🇬🇭 Ghana</SelectItem>
                            <SelectItem value="Emirati Arabi Uniti">🇦🇪 Emirati Arabi Uniti</SelectItem>
                            <SelectItem value="Arabia Saudita">🇸🇦 Arabia Saudita</SelectItem>
                            <SelectItem value="Qatar">🇶🇦 Qatar</SelectItem>
                            <SelectItem value="Kuwait">🇰🇼 Kuwait</SelectItem>
                            <SelectItem value="Bahrain">🇧🇭 Bahrain</SelectItem>
                            <SelectItem value="Oman">🇴🇲 Oman</SelectItem>
                            <SelectItem value="Israele">🇮🇱 Israele</SelectItem>
                            <SelectItem value="Libano">🇱🇧 Libano</SelectItem>
                            <SelectItem value="Giordania">🇯🇴 Giordania</SelectItem>
                          </SelectContent>
                         </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-medium">Regione (Opzionale)</label>
                        <Input
                          placeholder="es. Lombardia, Toscana..."
                          value={campaign.partnerFilters?.region || ''}
                          onChange={(e) => setCampaign(prev => ({
                            ...prev,
                            partnerFilters: { ...prev.partnerFilters, region: e.target.value || undefined }
                          }))}
                          className="h-8"
                        />
                      </div>
                    </div>
                  )}
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
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Messaggio</label>
                    {campaign.template && (
                      <Badge variant="secondary" className="text-xs">
                        📝 Template attivo
                      </Badge>
                    )}
                  </div>
                  <Textarea
                    placeholder="Scrivi il tuo messaggio qui... 
                    
Puoi usare questi placeholder:
- {partner_name} per il nome del partner
- {company_name} per il nome dell'azienda

💡 Il messaggio verrà automaticamente formattato secondo il template selezionato"
                    value={campaign.message}
                    onChange={(e) => setCampaign(prev => ({ ...prev, message: e.target.value }))}
                    rows={12}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Usa {'{partner_name}'} e {'{company_name}'} per personalizzare il messaggio
                    </p>
                    {campaign.template && (
                      <p className="text-xs text-green-600">
                        ✅ Template: {campaign.template.headerText}
                      </p>
                    )}
                  </div>
                </div>

                <Button 
                  onClick={handleSendCampaign} 
                  disabled={loading || !campaign.subject || !campaign.message || !selectedSenderEmail || !selectedSenderEmail.is_verified || getCurrentEmailCount() === 0}
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
                      <p className="font-medium">
                        {selectedSenderEmail ? 
                          `${selectedSenderEmail.name} <${selectedSenderEmail.email}>` : 
                          'Seleziona email mittente'
                        }
                      </p>
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
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Anteprima Messaggio:</p>
                        {campaign.template && (
                          <Badge variant="outline" className="text-xs">
                            🎨 Con Template
                          </Badge>
                        )}
                      </div>
                      <div className="whitespace-pre-wrap text-sm p-4 bg-muted/50 rounded border">
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

        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Cronologia Campagne Email
              </CardTitle>
              <CardDescription>
                Visualizza le campagne email inviate con riepilogo destinatari
              </CardDescription>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={fetchSentEmails}
                  disabled={loadingSentEmails}
                  className="flex items-center gap-2"
                >
                  {loadingSentEmails ? <Loader className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                  Aggiorna
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSentEmails ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="h-6 w-6 animate-spin" />
                  <span className="ml-2">Caricamento campagne...</span>
                </div>
              ) : sentEmails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessuna campagna email trovata</p>
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Oggetto</TableHead>
                        <TableHead>Tipo Campagna</TableHead>
                        <TableHead>Destinatari</TableHead>
                        <TableHead>Risultati</TableHead>
                        <TableHead>Data Invio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentEmails.map((campaign) => (
                        <TableRow key={campaign.id}>
                          <TableCell>
                            <div className="font-medium">{campaign.subject}</div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {campaign.campaign_type || 'Newsletter'}
                              </Badge>
                              {campaign.partner_type && (
                                <Badge variant="secondary" className="text-xs">
                                  {campaign.partner_type}
                                </Badge>
                              )}
                              {campaign.region && (
                                <Badge variant="secondary" className="text-xs">
                                  {campaign.region}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{campaign.recipients_count || 0}</span>
                              <span className="text-sm text-muted-foreground">destinatari</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-sm">{campaign.success_count || 0} inviate</span>
                              </div>
                              {(campaign.failure_count || 0) > 0 && (
                                <div className="flex items-center gap-2">
                                  <XCircle className="h-4 w-4 text-red-500" />
                                  <span className="text-sm">{campaign.failure_count} fallite</span>
                                </div>
                              )}
                              <div className="text-xs text-muted-foreground">
                                Tasso successo: {campaign.recipients_count ? Math.round((campaign.success_count || 0) / campaign.recipients_count * 100) : 0}%
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {campaign.sent_at ? (
                              <div className="text-sm">
                                <div>{new Date(campaign.sent_at).toLocaleDateString('it-IT')}</div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(campaign.sent_at).toLocaleTimeString('it-IT')}
                                </div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div>{new Date(campaign.created_at).toLocaleDateString('it-IT')}</div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(campaign.created_at).toLocaleTimeString('it-IT')}
                                </div>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6">
          <ContactManager />
        </TabsContent>

        <TabsContent value="emails" className="space-y-6">
          <SenderEmailManager 
            onEmailSelect={handleSenderEmailSelect}
            selectedEmailId={selectedSenderEmail?.id}
          />
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <NewsletterTemplateEditor 
            onTemplateChange={handleTemplateChange}
            onTemplateSelect={handleTemplateSelect}
          />
        </TabsContent>

        <TabsContent value="lists" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestione Liste Email</CardTitle>
              <CardDescription>
                Crea e gestisci liste email personalizzate per le tue campagne
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailListManager 
                onListSelect={handleCustomListSelect}
                selectedListId={selectedCustomList}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}