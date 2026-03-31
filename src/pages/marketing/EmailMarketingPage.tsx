import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, History as HistoryIcon, CheckCircle2, XCircle, Clock, Users, Settings as SettingsIcon, Send, Plus, BarChart3, FileText, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EmailListManager } from "@/components/crm/EmailListManager";
import { SenderEmailManager } from "@/components/crm/SenderEmailManager";
import { NewsletterTemplateManager } from "@/components/crm/NewsletterTemplateManager";
import { NewsletterWizard } from "@/components/crm/NewsletterWizard";
import { AutomationManager } from "@/components/crm/AutomationManager";
import { Button } from "@/components/ui/button";

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

interface EmailList {
  id: string;
  name: string;
  description: string;
  contact_count: number;
}

export default function NewsletterPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingSentEmails, setLoadingSentEmails] = useState(false);
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [emailLists, setEmailLists] = useState<EmailList[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  const [templateRefreshKey, setTemplateRefreshKey] = useState(0);

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
        id: list.id,
        name: list.name,
        description: list.description || '',
        contact_count: (list.email_list_contacts as any)?.[0]?.count || 0
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

  const handleWizardSend = async (data: any) => {
    try {
      setLoading(true);

      let requestData: any = {
        subject: data.subject,
        message: data.message,
        sender_email: data.senderEmail.email,
        sender_name: data.senderName,
        logo: data.template.logo,
        headerText: data.template.headerText,
        footerText: data.template.footerText,
        signature: data.template.signature,
      };

      if (data.targetAudience === 'custom_list' && data.customListIds && data.customListIds.length > 0) {
        requestData.custom_list_ids = data.customListIds;
        requestData.use_crm_contacts = false;
        requestData.use_partners = false;
      } else if (data.targetAudience === 'crm_contacts') {
        requestData.use_crm_contacts = true;
        requestData.use_partners = false;
      } else if (data.targetAudience === 'partners') {
        requestData.use_partners = true;
        requestData.use_crm_contacts = false;
      } else {
        requestData.active_only = true;
        requestData.use_crm_contacts = false;
        requestData.use_partners = false;
      }

      const { data: result, error } = await supabase.functions.invoke('queue-newsletter-emails', {
        body: requestData
      });

      if (error) throw error;

      toast({
        title: "Newsletter in coda",
        description: `${result.emailsQueued} email in coda per l'invio`,
      });

      await fetchSentEmails();
      setShowWizard(false);
    } catch (error: any) {
      console.error('Error sending newsletter:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore durante l'invio della newsletter",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT');
  };

  const getStatusBadge = (successCount: number, failureCount: number, recipientsCount: number) => {
    if (failureCount > 0) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Errori</Badge>;
    } else if (successCount === recipientsCount && recipientsCount > 0) {
      return <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20"><CheckCircle2 className="h-3 w-3" /> Completato</Badge>;
    } else {
      return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> In corso</Badge>;
    }
  };

  // Stats
  const totalSent = sentEmails.reduce((acc, e) => acc + e.success_count, 0);
  const totalFailed = sentEmails.reduce((acc, e) => acc + e.failure_count, 0);
  const totalCampaigns = sentEmails.length;
  const totalContacts = emailLists.reduce((acc, l) => acc + l.contact_count, 0);

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Newsletter</h1>
            <p className="text-sm text-muted-foreground">
              Crea mailing list e invia newsletter con i tuoi template
            </p>
          </div>
        </div>
        <Button 
          onClick={() => setShowWizard(true)} 
          size="lg"
          className="gap-2 shadow-md"
        >
          <Plus className="h-4 w-4" />
          Nuova Newsletter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Campagne</p>
                <p className="text-xl font-bold text-foreground">{totalCampaigns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Email Inviate</p>
                <p className="text-xl font-bold text-foreground">{totalSent.toLocaleString('it-IT')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Users className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Contatti Totali</p>
                <p className="text-xl font-bold text-foreground">{totalContacts.toLocaleString('it-IT')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Errori</p>
                <p className="text-xl font-bold text-foreground">{totalFailed.toLocaleString('it-IT')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Wizard Overlay */}
      {showWizard && (
        <Card className="border-primary/20 shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Send className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-lg">Crea Newsletter</CardTitle>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowWizard(false)}>
                ✕
              </Button>
            </div>
            <CardDescription>Segui il processo guidato per comporre e inviare la tua newsletter</CardDescription>
          </CardHeader>
          <CardContent>
            <NewsletterWizard
              key={templateRefreshKey}
              onSend={handleWizardSend}
              emailLists={emailLists}
            />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 h-auto flex-wrap">
          <TabsTrigger value="history" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <HistoryIcon className="h-4 w-4" />
            Cronologia
          </TabsTrigger>
          <TabsTrigger value="lists" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" />
            Mailing List
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FileText className="h-4 w-4" />
            Template
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Zap className="h-4 w-4" />
            Automation
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <SettingsIcon className="h-4 w-4" />
            Impostazioni
          </TabsTrigger>
        </TabsList>

        {/* History Tab */}
        <TabsContent value="history">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Invii Recenti</CardTitle>
                  <CardDescription>Le ultime newsletter inviate</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">{sentEmails.length} campagne</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSentEmails ? (
                <div className="flex items-center justify-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                </div>
              ) : sentEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-muted/50 rounded-full mb-4">
                    <Mail className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground font-medium">Nessuna newsletter inviata</p>
                  <p className="text-sm text-muted-foreground mt-1">Crea la tua prima newsletter cliccando il pulsante in alto</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Stato</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Oggetto</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Tipo</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-center">Destinatari</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-center">Inviate</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-center">Fallite</TableHead>
                        <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentEmails.map((email) => (
                        <TableRow key={email.id} className="group">
                          <TableCell>
                            {getStatusBadge(email.success_count, email.failure_count, email.recipients_count)}
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate">{email.subject}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs font-normal">{email.campaign_type}</Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">{email.recipients_count}</TableCell>
                          <TableCell className="text-center">
                            <span className="text-emerald-600 font-medium">{email.success_count}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-destructive font-medium">{email.failure_count}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                            {formatDate(email.sent_at || email.created_at)}
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

        {/* Mailing Lists Tab */}
        <TabsContent value="lists">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Mailing List</CardTitle>
                  <CardDescription>Gestisci le tue liste di distribuzione per le newsletter</CardDescription>
                </div>
                <Badge variant="outline" className="text-xs">{emailLists.length} liste · {totalContacts} contatti</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <EmailListManager onListSelect={() => {}} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Template Newsletter</CardTitle>
              <CardDescription>Crea e personalizza i template per le tue newsletter</CardDescription>
            </CardHeader>
            <CardContent>
              <NewsletterTemplateManager 
                onTemplateChange={() => setTemplateRefreshKey(prev => prev + 1)} 
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Email Automation</CardTitle>
              <CardDescription>Configura invii automatici e follow-up programmati</CardDescription>
            </CardHeader>
            <CardContent>
              <AutomationManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Email Mittente</CardTitle>
              <CardDescription>Gestisci gli indirizzi email verificati per l'invio</CardDescription>
            </CardHeader>
            <CardContent>
              <SenderEmailManager onEmailSelect={() => {}} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
