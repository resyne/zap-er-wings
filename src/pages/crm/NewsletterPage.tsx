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
  targetAudience: 'customers' | 'crm_contacts' | 'custom_list' | 'partners';
  customListId?: string;
  systemFilters?: {
    partner_type?: string;
    acquisition_status?: string;
    excludedCountries?: string[];
    region?: string;
    active_only?: boolean;
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
  customers: number;
  crm_contacts: number;
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

interface SystemFiltersManagerProps {
  onFilterSelect: (type: 'customers' | 'crm_contacts' | 'partners', filters?: any, count?: number) => void;
  selectedType?: string;
  selectedFilters?: any;
}

function SystemFiltersManager({ onFilterSelect, selectedType, selectedFilters }: SystemFiltersManagerProps) {
  const [filterCounts, setFilterCounts] = useState({
    customers: 0,
    crm_contacts: 0,
    partners: 0
  });
  const [currentFilters, setCurrentFilters] = useState(selectedFilters || {});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchFilterCounts();
  }, [currentFilters]);

  const fetchFilterCounts = async () => {
    setLoading(true);
    try {
      // Count customers
      let customerQuery = supabase
        .from('customers')
        .select('id', { count: 'exact' });
      
      if (currentFilters.active_only) {
        customerQuery = customerQuery.eq('active', true);
      }

      const { count: customerCount } = await customerQuery;

      // Count CRM contacts
      const { count: crmCount } = await supabase
        .from('crm_contacts')
        .select('id', { count: 'exact' });

      // Count partners with filters
      let partnerQuery = supabase
        .from('partners')
        .select('id', { count: 'exact' });

      if (currentFilters.partner_type) {
        partnerQuery = partnerQuery.eq('partner_type', currentFilters.partner_type);
      }
      if (currentFilters.acquisition_status) {
        partnerQuery = partnerQuery.eq('acquisition_status', currentFilters.acquisition_status);
      }
      if (currentFilters.excludedCountries && currentFilters.excludedCountries.length > 0) {
        currentFilters.excludedCountries.forEach(country => {
          partnerQuery = partnerQuery.neq('country', country);
        });
      }
      if (currentFilters.region) {
        partnerQuery = partnerQuery.ilike('region', `%${currentFilters.region}%`);
      }

      const { count: partnerCount } = await partnerQuery;

      setFilterCounts({
        customers: customerCount || 0,
        crm_contacts: crmCount || 0,
        partners: partnerCount || 0
      });
    } catch (error) {
      console.error('Error fetching filter counts:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i conteggi",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addExcludedCountry = (country: string) => {
    if (country && !currentFilters.excludedCountries?.includes(country)) {
      const updated = {
        ...currentFilters,
        excludedCountries: [...(currentFilters.excludedCountries || []), country]
      };
      setCurrentFilters(updated);
    }
  };

  const removeExcludedCountry = (country: string) => {
    const updated = {
      ...currentFilters,
      excludedCountries: currentFilters.excludedCountries?.filter(c => c !== country) || []
    };
    setCurrentFilters(updated);
  };

  return (
    <div className="space-y-3">
      {/* System Lists - Compact */}
      <div className="space-y-2">
        {/* Customers */}
        <div 
          className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50 ${
            selectedType === 'customers' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => onFilterSelect('customers', currentFilters, filterCounts.customers)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span className="text-sm font-medium">Clienti</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {filterCounts.customers}
            </Badge>
          </div>
        </div>

        {/* CRM Contacts */}
        <div 
          className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-accent/50 ${
            selectedType === 'crm_contacts' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
          onClick={() => onFilterSelect('crm_contacts', {}, filterCounts.crm_contacts)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-sm font-medium">Contatti CRM</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {filterCounts.crm_contacts}
            </Badge>
          </div>
        </div>

        {/* Partners */}
        <div 
          className={`rounded-lg border transition-all ${
            selectedType === 'partners' ? 'ring-2 ring-primary bg-primary/5' : ''
          }`}
        >
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-sm font-medium">Partner</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {filterCounts.partners}
              </Badge>
            </div>

            {/* Partner Filters - Compact */}
            <div className="space-y-2 text-xs">
              <div className="grid grid-cols-1 gap-2">
                <Select
                  value={currentFilters.partner_type || 'all'}
                  onValueChange={(value) => setCurrentFilters(prev => ({ ...prev, partner_type: value === 'all' ? undefined : value }))}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Tipo Partner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i tipi</SelectItem>
                    <SelectItem value="installer">Installatori</SelectItem>
                    <SelectItem value="importer">Importatori</SelectItem>
                    <SelectItem value="reseller">Rivenditori</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={currentFilters.acquisition_status || 'all'}
                  onValueChange={(value) => setCurrentFilters(prev => ({ ...prev, acquisition_status: value === 'all' ? undefined : value }))}
                >
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue placeholder="Stato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="acquired">Acquisiti</SelectItem>
                    <SelectItem value="in_progress">In Corso</SelectItem>
                    <SelectItem value="not_acquired">Non Acquisiti</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                placeholder="Regione..."
                value={currentFilters.region || ''}
                onChange={(e) => setCurrentFilters(prev => ({ ...prev, region: e.target.value || undefined }))}
                className="h-7 text-xs"
              />

              {currentFilters.excludedCountries && currentFilters.excludedCountries.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {currentFilters.excludedCountries.map((country: string) => (
                    <Badge key={country} variant="outline" className="text-xs px-1 py-0">
                      {country}
                      <button
                        onClick={() => removeExcludedCountry(country)}
                        className="ml-1 hover:text-destructive"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              <Input
                placeholder="Escludi paese..."
                className="h-7 text-xs"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const input = e.currentTarget;
                    addExcludedCountry(input.value);
                    input.value = '';
                  }
                }}
              />

              <Button 
                size="sm" 
                className="w-full h-7 text-xs"
                onClick={() => onFilterSelect('partners', currentFilters, filterCounts.partners)}
                disabled={loading}
                variant={selectedType === 'partners' ? 'default' : 'outline'}
              >
                {loading ? <Loader className="h-3 w-3 animate-spin" /> : 'Seleziona'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewsletterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingSentEmails, setLoadingSentEmails] = useState(false);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [emailCounts, setEmailCounts] = useState<EmailCounts>({
    customers: 0,
    crm_contacts: 0,
    custom_list: 0,
    partners: 0
  });
  const [emailLists, setEmailLists] = useState<Array<{id: string, name: string, description: string, contact_count: number}>>([]);
  const [selectedCustomList, setSelectedCustomList] = useState<string>('');
  const [selectedCustomListCount, setSelectedCustomListCount] = useState<number>(0);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<any>(null);
  const [campaign, setCampaign] = useState<EmailCampaign>({
    subject: '',
    message: '',
    targetAudience: 'customers',
    template: {
      headerText: '',
      footerText: '',
      signature: '',
      attachments: []
    }
  });

  useEffect(() => {
    fetchEmailLists();
    fetchSentEmails();
  }, []);

  const fetchEmailLists = async () => {
    try {
      const { data: lists, error } = await supabase
        .from('email_lists')
        .select(`
          id,
          name,
          description,
          email_list_contacts(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedLists = lists?.map(list => ({
        ...list,
        contact_count: list.email_list_contacts?.[0]?.count || 0
      })) || [];

      setEmailLists(formattedLists);
    } catch (error) {
      console.error('Error fetching email lists:', error);
    }
  };

  const fetchSentEmails = async () => {
    setLoadingSentEmails(true);
    try {
      const { data, error } = await supabase
        .from('email_campaigns')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setSentEmails(data || []);
    } catch (error) {
      console.error('Error fetching sent emails:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare la cronologia delle email",
        variant: "destructive",
      });
    } finally {
      setLoadingSentEmails(false);
    }
  };

  const getCurrentEmailCount = () => {
    if (campaign.targetAudience === 'custom_list') {
      return selectedCustomListCount;
    }
    return emailCounts[campaign.targetAudience] || 0;
  };

  const handleSystemFilterSelect = (type: 'customers' | 'crm_contacts' | 'partners', filters?: any, count?: number) => {
    setCampaign(prev => ({
      ...prev,
      targetAudience: type,
      systemFilters: filters || {},
      customListId: undefined
    }));
    
    setEmailCounts(prev => ({
      ...prev,
      [type]: count || 0
    }));
  };

  const handleCustomListSelect = (listId: string, contactCount: number) => {
    setCampaign(prev => ({
      ...prev,
      targetAudience: 'custom_list',
      customListId: listId,
      systemFilters: undefined
    }));
    setSelectedCustomList(listId);
    setSelectedCustomListCount(contactCount);
  };

  const sendNewsletter = async () => {
    if (!campaign.subject || !campaign.message) {
      toast({
        title: "Errore",
        description: "Inserisci oggetto e messaggio",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSenderEmail) {
      toast({
        title: "Errore", 
        description: "Seleziona un'email mittente verificata",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      let requestData: any = {
        subject: campaign.subject,
        message: campaign.message,
        sender_email: selectedSenderEmail.email,
        sender_name: selectedSenderEmail.name,
        template: campaign.template
      };

      if (campaign.targetAudience === 'custom_list' && campaign.customListId) {
        requestData.custom_list_id = campaign.customListId;
        requestData.use_crm_contacts = false;
      } else if (campaign.targetAudience === 'crm_contacts') {
        requestData.use_crm_contacts = true;
      } else if (campaign.targetAudience === 'customers') {
        requestData.active_only = campaign.systemFilters?.active_only || false;
      } else if (campaign.targetAudience === 'partners') {
        requestData = {
          ...requestData,
          use_partners: true,
          partner_type: campaign.systemFilters?.partner_type,
          acquisition_status: campaign.systemFilters?.acquisition_status,
          region: campaign.systemFilters?.region,
          excluded_countries: campaign.systemFilters?.excludedCountries || []
        };
      }

      console.log('Sending newsletter with data:', requestData);

      const { data, error } = await supabase.functions.invoke('queue-newsletter-emails', {
        body: requestData
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Newsletter accodata con successo! ID campagna: ${data.campaignId}`,
      });

      // Reset form
      setCampaign({
        subject: '',
        message: '',
        targetAudience: 'customers',
        template: {
          headerText: '',
          footerText: '',
          signature: '',
          attachments: []
        }
      });

      fetchSentEmails();
    } catch (error: any) {
      console.error('Error sending newsletter:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile inviare la newsletter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: { subject: string; message: string }) => {
    setCampaign(prev => ({
      ...prev,
      subject: template.subject,
      message: template.message
    }));
  };

  const handleTemplateChange = (templateConfig: any) => {
    setCampaign(prev => ({
      ...prev,
      template: templateConfig
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const getStatusIcon = (successCount: number, failureCount: number, recipientsCount: number) => {
    if (failureCount > 0) {
      return <XCircle className="h-4 w-4 text-destructive" />;
    } else if (successCount === recipientsCount) {
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    } else {
      return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Gestisci e invia newsletter ai tuoi contatti
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="compose" className="space-y-6">
        <div className="border-b">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Componi</span>
            </TabsTrigger>
            <TabsTrigger value="lists" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Liste</span>
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Template</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Cronologia</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Impostazioni</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Compose Tab - Redesigned */}
        <TabsContent value="compose" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-4">
            {/* Main Compose Area */}
            <div className="xl:col-span-3">
              <Card className="h-fit">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">Nuova Newsletter</CardTitle>
                      <CardDescription>
                        Componi il contenuto della tua newsletter
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="bg-background">
                      {getCurrentEmailCount()} destinatari
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sender Email Selection */}
                  {selectedSenderEmail && (
                    <div className="p-3 bg-muted/50 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <div className="text-sm">
                          <span className="text-muted-foreground">Mittente: </span>
                          <span className="font-medium">{selectedSenderEmail.name}</span>
                          <span className="text-muted-foreground"> &lt;{selectedSenderEmail.email}&gt;</span>
                        </div>
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          Verificato
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Subject */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Oggetto *</label>
                    <Input
                      placeholder="Inserisci l'oggetto della newsletter..."
                      value={campaign.subject}
                      onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                      className="text-base"
                    />
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Messaggio *</label>
                    <Textarea
                      placeholder="Scrivi il contenuto della newsletter qui..."
                      value={campaign.message}
                      onChange={(e) => setCampaign(prev => ({ ...prev, message: e.target.value }))}
                      rows={12}
                      className="text-base resize-none"
                    />
                  </div>

                  {/* Send Button */}
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      {!selectedSenderEmail && (
                        <span className="text-amber-600">⚠️ Seleziona un mittente nelle impostazioni</span>
                      )}
                    </div>
                    <Button 
                      onClick={sendNewsletter} 
                      disabled={loading || getCurrentEmailCount() === 0 || !selectedSenderEmail || !campaign.subject || !campaign.message}
                      size="lg"
                      className="min-w-[140px]"
                    >
                      {loading ? (
                        <>
                          <Loader className="h-4 w-4 animate-spin mr-2" />
                          Invio...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Invia Newsletter
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar - Recipients */}
            <div className="xl:col-span-1">
              <div className="space-y-4 sticky top-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Destinatari</CardTitle>
                    <CardDescription className="text-xs">
                      Seleziona chi riceverà la newsletter
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <SystemFiltersManager 
                      onFilterSelect={handleSystemFilterSelect}
                      selectedType={campaign.targetAudience}
                      selectedFilters={campaign.systemFilters}
                    />
                    
                    <div className="pt-4 border-t">
                      <h4 className="text-sm font-medium mb-3">Liste Personalizzate</h4>
                      <EmailListManager 
                        onListSelect={handleCustomListSelect}
                        selectedListId={campaign.targetAudience === 'custom_list' ? selectedCustomList : undefined}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Other Tabs - Simplified */}
        <TabsContent value="lists">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Gestione Liste Email
              </CardTitle>
              <CardDescription>
                Crea, modifica e gestisci le tue liste di contatti personalizzate
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailListManager 
                onListSelect={() => {}}
                selectedListId=""
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Template Newsletter
              </CardTitle>
              <CardDescription>
                Crea e gestisci template riutilizzabili per le tue newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewsletterTemplateEditor 
                onTemplateChange={handleTemplateChange} 
                onTemplateSelect={handleTemplateSelect} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Cronologia Invii
              </CardTitle>
              <CardDescription>
                Visualizza lo storico di tutte le newsletter inviate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSentEmails ? (
                <div className="flex justify-center py-12">
                  <div className="text-center">
                    <Loader className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Caricamento cronologia...</p>
                  </div>
                </div>
              ) : sentEmails.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nessuna newsletter inviata</h3>
                  <p className="text-muted-foreground">Le newsletter inviate appariranno qui</p>
                </div>
              ) : (
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">Stato</TableHead>
                        <TableHead>Oggetto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-center">Destinatari</TableHead>
                        <TableHead className="text-center">Successo</TableHead>
                        <TableHead className="text-center">Errori</TableHead>
                        <TableHead>Data Invio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell>
                            {getStatusIcon(email.success_count, email.failure_count, email.recipients_count)}
                          </TableCell>
                          <TableCell className="font-medium">{email.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{email.campaign_type}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{email.recipients_count}</TableCell>
                          <TableCell className="text-center text-green-600 font-medium">{email.success_count}</TableCell>
                          <TableCell className="text-center text-red-600 font-medium">{email.failure_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {email.sent_at ? formatDate(email.sent_at) : formatDate(email.created_at)}
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

        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Mittenti
                </CardTitle>
                <CardDescription>
                  Gestisci e verifica gli indirizzi email mittenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SenderEmailManager 
                  onEmailSelect={setSelectedSenderEmail}
                  selectedEmailId={selectedSenderEmail?.id}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gestione Contatti
                </CardTitle>
                <CardDescription>
                  Importa e organizza i tuoi contatti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ContactManager />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}