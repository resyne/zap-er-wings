import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Mail, 
  Send, 
  Inbox, 
  Settings, 
  Plus, 
  Search,
  Trash2,
  Reply,
  Forward,
  Star,
  Paperclip
} from "lucide-react";

interface EmailConfig {
  email: string;
  password: string;
  imap_server: string;
  imap_port: number;
  smtp_server: string;
  smtp_port: number;
}

interface Email {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  hasAttachments?: boolean;
}

const EmailPage = () => {
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    email: "",
    password: "",
    imap_server: "mail.abbattitorizapper.it",
    imap_port: 143, // IMAP standard port
    smtp_server: "mail.abbattitorizapper.it",
    smtp_port: 587 // SMTP standard port
  });
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [composeEmail, setComposeEmail] = useState({
    to: "",
    subject: "",
    body: ""
  });
  const [isConfigured, setIsConfigured] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Carica configurazione salvata
    const savedConfig = localStorage.getItem('emailConfig');
    if (savedConfig) {
      setEmailConfig(JSON.parse(savedConfig));
      setIsConfigured(true);
    }
  }, []);

  const saveEmailConfig = async () => {
    try {
      setLoading(true);
      localStorage.setItem('emailConfig', JSON.stringify(emailConfig));
      setIsConfigured(true);
      toast({
        title: "Configurazione salvata",
        description: "Le credenziali email sono state salvate con successo."
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare la configurazione.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendEmail = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('send-email', {
        body: {
          from: emailConfig.email,
          to: composeEmail.to,
          subject: composeEmail.subject,
          body: composeEmail.body,
          smtp_config: {
            host: emailConfig.smtp_server,
            port: emailConfig.smtp_port,
            user: emailConfig.email,
            pass: emailConfig.password
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Email inviata",
        description: `Email inviata con successo a ${composeEmail.to}`
      });
      
      setComposeEmail({ to: "", subject: "", body: "" });
    } catch (error: any) {
      toast({
        title: "Errore nell'invio",
        description: error.message || "Impossibile inviare l'email",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);

      // Verifica che le credenziali siano configurate
      if (!emailConfig.email || !emailConfig.password || emailConfig.email === '') {
        toast({
          title: "Configurazione mancante",
          description: "Inserisci email e password per connettersi al server IMAP.",
          variant: "destructive"
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('fetch-emails', {
        body: {
          imap_config: {
            host: emailConfig.imap_server,
            port: emailConfig.imap_port,
            user: emailConfig.email,
            pass: emailConfig.password
          }
        }
      });

      if (error) throw error;

      if (data && data.emails) {
        setEmails(data.emails);
      }

      toast({
        title: "Email caricate",
        description: `Caricate ${data?.emails?.length || 0} email`
      });
    } catch (error: any) {
      toast({
        title: "Errore nel caricamento",
        description: error.message || "Impossibile caricare le email",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const performEmailAction = async (action: string, emailId: string) => {
    try {
      setLoading(true);

      // Verifica che le credenziali siano configurate
      if (!emailConfig.email || !emailConfig.password || emailConfig.email === '') {
        toast({
          title: "Configurazione mancante",
          description: "Inserisci email e password per eseguire azioni IMAP.",
          variant: "destructive"
        });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('email-action', {
        body: {
          action,
          email_id: emailId,
          imap_config: {
            host: emailConfig.imap_server,
            port: emailConfig.imap_port,
            user: emailConfig.email,
            pass: emailConfig.password
          }
        }
      });

      if (error) throw error;

      // Aggiorna stato locale
      setEmails(prevEmails => 
        prevEmails.map(email => {
          if (email.id === emailId) {
            switch (action) {
              case 'mark_read':
                return { ...email, read: true };
              case 'mark_unread':
                return { ...email, read: false };
              case 'star':
                return { ...email, starred: !email.starred };
              default:
                return email;
            }
          }
          return email;
        })
      );

      if (action === 'delete') {
        setEmails(prevEmails => prevEmails.filter(email => email.id !== emailId));
        if (selectedEmail?.id === emailId) {
          setSelectedEmail(null);
        }
      }

      toast({
        title: "Azione completata",
        description: `Azione "${action}" eseguita con successo`
      });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile eseguire l'azione",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-2xl">
        <div className="text-center space-y-4">
          <h1 className="text-2xl md:text-3xl font-bold">Configurazione Email</h1>
          <p className="text-muted-foreground">Configura le tue credenziali email per iniziare</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Credenziali Email</CardTitle>
            <CardDescription>
              Inserisci le credenziali per accedere al sistema email aziendale.
              Il sistema si collegherà direttamente al server mail per sincronizzare le email reali.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="utente@abbattitorizapper.it"
                  value={emailConfig.email}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password email"
                  value={emailConfig.password}
                  onChange={(e) => setEmailConfig(prev => ({ ...prev, password: e.target.value }))}
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                ℹ️ <strong>Connessione Reale:</strong> Il sistema tenterà di connettersi al server IMAP/SMTP reale. 
                Se la connessione fallisce, verranno mostrati dati di esempio per testing.
              </p>
            </div>

            <Button onClick={saveEmailConfig} disabled={loading} className="w-full">
              <Settings className="h-4 w-4 mr-2" />
              Salva e Continua
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-3 md:p-6 space-y-4 md:space-y-6 max-w-7xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Sistema Email</h1>
          <p className="text-muted-foreground text-sm md:text-base">
            Gestisci le tue email con connessione diretta al server webmail Zapper
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs text-green-600">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            Connesso a {emailConfig.imap_server}
          </div>
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="inbox" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-3 text-xs md:text-sm">
            <Inbox className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Posta in arrivo</span>
            <span className="sm:hidden">Inbox</span>
            <span className="text-xs">({emails.length})</span>
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-3 text-xs md:text-sm">
            <Plus className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Componi</span>
            <span className="sm:hidden">New</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex flex-col md:flex-row items-center gap-1 md:gap-2 py-2 md:py-3 text-xs md:text-sm">
            <Settings className="h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">Config</span>
            <span className="sm:hidden">Set</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-3 md:space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input 
                  placeholder="Cerca nelle email..." 
                  className="pl-9 h-9 md:h-10"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={fetchEmails} disabled={!isConfigured || loading} className="flex-1 sm:w-auto">
                  <Mail className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Sincronizza</span>
                  <span className="sm:hidden">Sync</span>
                </Button>
                <Button 
                  onClick={() => {
                    // Auto-sync every 30 seconds when enabled
                    if (!loading) {
                      const interval = setInterval(() => {
                        if (!loading) fetchEmails();
                      }, 30000);
                      setTimeout(() => clearInterval(interval), 300000); // Stop after 5 minutes
                    }
                  }} 
                  variant="outline" 
                  size="sm" 
                  className="hidden md:flex"
                  disabled={loading}
                >
                  Auto-sync
                </Button>
              </div>
            </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6">
            {/* Lista Email */}
            <Card className="h-[500px] md:h-[600px]">
              <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
                <CardTitle className="text-base md:text-lg">Email</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[420px] md:h-[520px]">
                  <div className="space-y-1 p-3 md:p-4">
                    {emails.map((email) => (
                      <div
                        key={email.id}
                        className={`p-3 md:p-4 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedEmail?.id === email.id ? 'bg-muted border-primary' : ''
                        } ${!email.read ? 'bg-blue-50/50 border-blue-200' : ''}`}
                        onClick={() => setSelectedEmail(email)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1 md:gap-2 mb-2">
                              {email.starred && <Star className="h-3 w-3 md:h-4 md:w-4 text-yellow-500 fill-current" />}
                              {email.hasAttachments && <Paperclip className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />}
                              <span className="text-xs md:text-sm font-medium truncate">{email.from}</span>
                              {!email.read && <Badge variant="secondary" className="text-xs">Nuovo</Badge>}
                            </div>
                            <h3 className="text-xs md:text-sm font-medium truncate mb-1">{email.subject}</h3>
                            <p className="text-xs text-muted-foreground truncate line-clamp-2 md:line-clamp-1">{email.body}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(email.date).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {!email.read && <div className="w-2 h-2 bg-blue-500 rounded-full" />}
                          </div>
                        </div>
                      </div>
                    ))}
                    {emails.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna email trovata</p>
                        <Button variant="outline" onClick={fetchEmails} className="mt-2">
                          Ricarica
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Visualizzazione Email */}
            <Card className="h-[500px] md:h-[600px]">
              <CardContent className="p-0 h-full">
                {selectedEmail ? (
                  <div className="flex flex-col h-full">
                    <div className="p-3 md:p-6 border-b">
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 lg:gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-lg md:text-xl font-semibold mb-2 line-clamp-2">{selectedEmail.subject}</h2>
                          <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-4 text-xs md:text-sm text-muted-foreground">
                            <span className="truncate">Da: {selectedEmail.from}</span>
                            <span className="truncate">A: {selectedEmail.to}</span>
                            <span className="hidden md:inline">{new Date(selectedEmail.date).toLocaleString()}</span>
                            <span className="md:hidden text-xs">{new Date(selectedEmail.date).toLocaleDateString()}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => performEmailAction('star', selectedEmail.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Star className={`h-3 w-3 md:h-4 md:w-4 ${selectedEmail.starred ? 'text-yellow-500 fill-current' : ''}`} />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setComposeEmail({
                                to: selectedEmail.from,
                                subject: `Re: ${selectedEmail.subject}`,
                                body: `\n\n--- Messaggio originale ---\nDa: ${selectedEmail.from}\nData: ${selectedEmail.date}\nOggetto: ${selectedEmail.subject}\n\n${selectedEmail.body}`
                              });
                            }}
                            className="h-8 w-8 p-0"
                          >
                            <Reply className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => performEmailAction('delete', selectedEmail.id)}
                            className="h-8 w-8 p-0"
                          >
                            <Trash2 className="h-3 w-3 md:h-4 md:w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <ScrollArea className="flex-1 p-3 md:p-6">
                      <div className="prose max-w-none text-sm md:text-base">
                        <div dangerouslySetInnerHTML={{ __html: selectedEmail.body.replace(/\n/g, '<br>') }} />
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <Mail className="h-12 w-12 md:h-16 md:w-16 mx-auto mb-4 opacity-50" />
                      <p className="text-base md:text-lg font-medium">Seleziona un'email per visualizzarla</p>
                      <p className="text-sm">Scegli un messaggio dalla lista per leggere il contenuto</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Nuova Email</CardTitle>
              <CardDescription>
                Componi una nuova email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="to">Destinatario</Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="email@example.com"
                  value={composeEmail.to}
                  onChange={(e) => setComposeEmail(prev => ({ ...prev, to: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="subject">Oggetto</Label>
                <Input
                  id="subject"
                  placeholder="Oggetto dell'email"
                  value={composeEmail.subject}
                  onChange={(e) => setComposeEmail(prev => ({ ...prev, subject: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="body">Messaggio</Label>
                <Textarea
                  id="body"
                  placeholder="Scrivi il tuo messaggio..."
                  className="min-h-[200px] md:min-h-[300px]"
                  value={composeEmail.body}
                  onChange={(e) => setComposeEmail(prev => ({ ...prev, body: e.target.value }))}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-between gap-2 sm:gap-4">
                <Button variant="outline" className="w-full sm:w-auto">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Allega file
                </Button>
                <Button onClick={sendEmail} disabled={loading || !composeEmail.to || !composeEmail.subject} className="w-full sm:w-auto">
                  <Send className="h-4 w-4 mr-2" />
                  Invia
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Configurazione Email</CardTitle>
              <CardDescription>
                Configura le credenziali per accedere al sistema email aziendale
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="utente@abbattitorizapper.it"
                    value={emailConfig.email}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Password email"
                    value={emailConfig.password}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, password: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-3">Server IMAP (Ricezione)</h4>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="imap_server">Server</Label>
                      <Input
                        id="imap_server"
                        value={emailConfig.imap_server}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, imap_server: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="imap_port">Porta</Label>
                      <Input
                        id="imap_port"
                        type="number"
                        value={emailConfig.imap_port}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, imap_port: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Server SMTP (Invio)</h4>
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor="smtp_server">Server</Label>
                      <Input
                        id="smtp_server"
                        value={emailConfig.smtp_server}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_server: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="smtp_port">Porta</Label>
                      <Input
                        id="smtp_port"
                        type="number"
                        value={emailConfig.smtp_port}
                        onChange={(e) => setEmailConfig(prev => ({ ...prev, smtp_port: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button onClick={saveEmailConfig} disabled={loading} className="w-full">
                <Settings className="h-4 w-4 mr-2" />
                Salva Configurazione
              </Button>

              {isConfigured && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">✓ Email configurata per: {emailConfig.email}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EmailPage;