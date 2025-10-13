import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, History as HistoryIcon, CheckCircle2, XCircle, Clock, List, Settings as SettingsIcon, Rocket } from "lucide-react";
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

      if (data.targetAudience === 'custom_list' && data.customListId) {
        requestData.custom_list_id = data.customListId;
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

      console.log('Sending newsletter with data:', requestData);

      const { data: result, error } = await supabase.functions.invoke('queue-newsletter-emails', {
        body: requestData
      });

      if (error) {
        console.error('Function invocation error:', error);
        throw error;
      }

      console.log('Newsletter queued:', result);

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
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Componi</span>
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Automation</span>
            </TabsTrigger>
            <TabsTrigger value="lists" className="flex items-center gap-2">
              <List className="h-4 w-4" />
              <span className="hidden sm:inline">Contatti</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <HistoryIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Cronologia</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Impostazioni</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Compose Tab */}
        <TabsContent value="compose" className="space-y-6">
          {!showWizard ? (
            <Card>
              <CardHeader>
                <CardTitle>Crea una nuova Newsletter</CardTitle>
                <CardDescription>
                  Avvia il processo guidato per creare e inviare una newsletter professionale
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowWizard(true)} size="lg" className="w-full sm:w-auto">
                  <Rocket className="h-5 w-5 mr-2" />
                  Inizia Processo Guidato
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="mb-4">
                <Button variant="outline" onClick={() => setShowWizard(false)}>
                  ← Annulla
                </Button>
              </div>
              <NewsletterWizard
                key={templateRefreshKey}
                onSend={handleWizardSend}
                emailLists={emailLists}
              />
            </div>
          )}
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation">
          <Card>
            <CardHeader>
              <CardTitle>Email Automation</CardTitle>
              <CardDescription>
                Gestisci le tue automation di follow-up e monitora gli invii programmati
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AutomationManager />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Lists Tab */}
        <TabsContent value="lists" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Gestione Liste Contatti</CardTitle>
              <CardDescription>
                Crea e gestisci le tue liste personalizzate di contatti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailListManager onListSelect={() => {}} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HistoryIcon className="h-5 w-5" />
                Cronologia Invii
              </CardTitle>
              <CardDescription>
                Visualizza lo storico delle newsletter inviate
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSentEmails ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : sentEmails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nessuna email inviata ancora
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Stato</TableHead>
                        <TableHead>Oggetto</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Destinatari</TableHead>
                        <TableHead>Inviate</TableHead>
                        <TableHead>Fallite</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sentEmails.map((email) => (
                        <TableRow key={email.id}>
                          <TableCell>
                            {getStatusIcon(
                              email.success_count,
                              email.failure_count,
                              email.recipients_count
                            )}
                          </TableCell>
                          <TableCell className="font-medium max-w-xs truncate">
                            {email.subject}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{email.campaign_type}</Badge>
                          </TableCell>
                          <TableCell>{email.recipients_count}</TableCell>
                          <TableCell>
                            <span className="text-green-600">{email.success_count}</span>
                          </TableCell>
                          <TableCell>
                            <span className="text-destructive">{email.failure_count}</span>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
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

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Newsletter</CardTitle>
              <CardDescription>
                Crea e gestisci i template per le tue newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NewsletterTemplateManager 
                onTemplateChange={() => setTemplateRefreshKey(prev => prev + 1)} 
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email Mittente</CardTitle>
              <CardDescription>
                Gestisci le email mittente verificate
              </CardDescription>
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
