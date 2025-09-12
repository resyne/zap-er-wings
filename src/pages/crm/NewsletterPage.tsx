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
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Seleziona Destinatari</h3>
        
        {/* System Lists */}
        <div className="grid gap-4">
          <Card 
            className={`cursor-pointer transition-colors ${
              selectedType === 'customers' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onFilterSelect('customers', currentFilters, filterCounts.customers)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Clienti</h4>
                  <p className="text-sm text-muted-foreground">Tutti i clienti nel sistema</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{filterCounts.customers} email</Badge>
                  <Users className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${
              selectedType === 'crm_contacts' ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => onFilterSelect('crm_contacts', {}, filterCounts.crm_contacts)}
          >
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">Contatti CRM</h4>
                  <p className="text-sm text-muted-foreground">Tutti i contatti dal CRM</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{filterCounts.crm_contacts} email</Badge>
                  <Users className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card 
            className={`cursor-pointer transition-colors ${
              selectedType === 'partners' ? 'ring-2 ring-primary' : ''
            }`}
          >
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium">Partner</h4>
                    <p className="text-sm text-muted-foreground">Partner con filtri personalizzabili</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{filterCounts.partners} email</Badge>
                    <Users className="h-4 w-4" />
                  </div>
                </div>

                {/* Partner Filters */}
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium">Tipo Partner</label>
                      <Select
                        value={currentFilters.partner_type || ''}
                        onValueChange={(value) => setCurrentFilters(prev => ({ ...prev, partner_type: value || undefined }))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Tutti" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tutti</SelectItem>
                          <SelectItem value="installer">Installatori</SelectItem>
                          <SelectItem value="importer">Importatori</SelectItem>
                          <SelectItem value="reseller">Rivenditori</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs font-medium">Stato Acquisizione</label>
                      <Select
                        value={currentFilters.acquisition_status || ''}
                        onValueChange={(value) => setCurrentFilters(prev => ({ ...prev, acquisition_status: value || undefined }))}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Tutti" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tutti</SelectItem>
                          <SelectItem value="acquired">Acquisiti</SelectItem>
                          <SelectItem value="in_progress">In Corso</SelectItem>
                          <SelectItem value="not_acquired">Non Acquisiti</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium">Regione</label>
                    <Input
                      placeholder="Cerca per regione..."
                      value={currentFilters.region || ''}
                      onChange={(e) => setCurrentFilters(prev => ({ ...prev, region: e.target.value || undefined }))}
                      className="h-8"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium">Escludi Paesi</label>
                    <div className="flex gap-2 mb-2 flex-wrap">
                      {currentFilters.excludedCountries?.map((country: string) => (
                        <Badge key={country} variant="secondary" className="text-xs">
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
                    <div className="flex gap-2">
                      <Input
                        placeholder="Aggiungi paese da escludere..."
                        className="h-8"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const input = e.currentTarget;
                            addExcludedCountry(input.value);
                            input.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>

                  <Button 
                    size="sm" 
                    className="w-full"
                    onClick={() => onFilterSelect('partners', currentFilters, filterCounts.partners)}
                    disabled={loading}
                  >
                    {loading ? <Loader className="h-4 w-4 animate-spin" /> : 'Seleziona Partner'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
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
        sender_name: selectedSenderEmail.name
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

  const handleTemplateSelect = (template: any) => {
    setCampaign(prev => ({
      ...prev,
      template: template
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
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter & Email Marketing</h1>
          <p className="text-muted-foreground">
            Gestisci liste email e invia newsletter ai tuoi contatti
          </p>
        </div>
      </div>

      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Componi Newsletter
          </TabsTrigger>
          <TabsTrigger value="lists" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Gestione Liste
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Template
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Cronologia
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Impostazioni
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compose" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Componi Newsletter
                  </CardTitle>
                  <CardDescription>
                    Crea e invia una newsletter ai tuoi contatti selezionati
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Oggetto</label>
                    <Input
                      placeholder="Oggetto della newsletter..."
                      value={campaign.subject}
                      onChange={(e) => setCampaign(prev => ({ ...prev, subject: e.target.value }))}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium">Messaggio</label>
                    <Textarea
                      placeholder="Contenuto della newsletter..."
                      value={campaign.message}
                      onChange={(e) => setCampaign(prev => ({ ...prev, message: e.target.value }))}
                      rows={8}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="text-sm text-muted-foreground">
                      Email selezionate: <span className="font-medium">{getCurrentEmailCount()}</span>
                    </div>
                    <Button 
                      onClick={sendNewsletter} 
                      disabled={loading || getCurrentEmailCount() === 0}
                      className="flex items-center gap-2"
                    >
                      {loading ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Invia Newsletter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <SystemFiltersManager 
                onFilterSelect={handleSystemFilterSelect}
                selectedType={campaign.targetAudience}
                selectedFilters={campaign.systemFilters}
              />
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Liste Personalizzate</CardTitle>
                </CardHeader>
                <CardContent>
                  <EmailListManager 
                    onListSelect={handleCustomListSelect}
                    selectedListId={campaign.targetAudience === 'custom_list' ? selectedCustomList : undefined}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lists">
          <Card>
            <CardHeader>
              <CardTitle>Gestione Liste Email</CardTitle>
              <CardDescription>
                Gestisci le tue liste email personalizzate e importa contatti
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
              <CardTitle>Template Newsletter</CardTitle>
              <CardDescription>
                Crea e gestisci template per le tue newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewsletterTemplateEditor 
                onTemplateChange={() => {}} 
                onTemplateSelect={handleTemplateSelect} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Cronologia Newsletter</CardTitle>
              <CardDescription>
                Visualizza tutte le newsletter inviate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSentEmails ? (
                <div className="flex justify-center py-8">
                  <Loader className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Stato</TableHead>
                      <TableHead>Oggetto</TableHead>
                      <TableHead>Tipo Campagna</TableHead>
                      <TableHead>Destinatari</TableHead>
                      <TableHead>Successo</TableHead>
                      <TableHead>Errori</TableHead>
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
                        <TableCell>{email.recipients_count}</TableCell>
                        <TableCell className="text-green-600">{email.success_count}</TableCell>
                        <TableCell className="text-red-600">{email.failure_count}</TableCell>
                        <TableCell>
                          {email.sent_at ? formatDate(email.sent_at) : formatDate(email.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Email Mittenti</CardTitle>
                <CardDescription>
                  Gestisci gli indirizzi email mittenti verificati
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
                <CardTitle>Gestione Contatti</CardTitle>
                <CardDescription>
                  Importa e gestisci i tuoi contatti
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