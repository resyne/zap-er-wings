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
}

const EmailPage = () => {
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    email: "",
    password: "",
    imap_server: "mail.abbattitorizapper.it",
    imap_port: 993,
    smtp_server: "mail.abbattitorizapper.it",
    smtp_port: 465
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
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          from: emailConfig.email,
          to: composeEmail.to,
          subject: composeEmail.subject,
          body: composeEmail.body,
          smtp_config: {
            server: emailConfig.smtp_server,
            port: emailConfig.smtp_port,
            email: emailConfig.email,
            password: emailConfig.password
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Email inviata",
        description: "L'email è stata inviata con successo."
      });

      setComposeEmail({ to: "", subject: "", body: "" });
    } catch (error) {
      toast({
        title: "Errore invio",
        description: "Impossibile inviare l'email.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEmails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('fetch-emails', {
        body: {
          imap_config: {
            server: emailConfig.imap_server,
            port: emailConfig.imap_port,
            email: emailConfig.email,
            password: emailConfig.password
          }
        }
      });

      if (error) throw error;

      setEmails(data.emails || []);
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile recuperare le email.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const mockEmails: Email[] = [
    {
      id: "1",
      from: "cliente@example.com",
      to: emailConfig.email,
      subject: "Richiesta preventivo abbattitore",
      body: "Buongiorno, vorrei ricevere un preventivo per un abbattitore di temperatura...",
      date: "2024-01-15 10:30",
      read: false,
      starred: false
    },
    {
      id: "2", 
      from: "fornitore@supplier.com",
      to: emailConfig.email,
      subject: "Conferma ordine materiali",
      body: "Confermiamo la ricezione del vostro ordine di materiali...",
      date: "2024-01-15 09:15",
      read: true,
      starred: true
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Email</h1>
          <p className="text-muted-foreground">
            Sistema email aziendale integrato
          </p>
        </div>
      </div>

      <Tabs defaultValue={isConfigured ? "inbox" : "settings"} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="inbox" disabled={!isConfigured}>
            <Inbox className="h-4 w-4 mr-2" />
            Posta in arrivo
          </TabsTrigger>
          <TabsTrigger value="compose" disabled={!isConfigured}>
            <Send className="h-4 w-4 mr-2" />
            Scrivi
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Configurazione
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={fetchEmails} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                Aggiorna
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Messaggi</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-2">
                    {(emails.length > 0 ? emails : mockEmails).map((email) => (
                      <div
                        key={email.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                          selectedEmail?.id === email.id ? 'bg-muted' : ''
                        } ${!email.read ? 'border-primary' : ''}`}
                        onClick={() => setSelectedEmail(email)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{email.from}</span>
                          <div className="flex items-center gap-1">
                            {email.starred && <Star className="h-3 w-3 text-yellow-500" />}
                            {!email.read && <Badge variant="secondary" className="text-xs">Nuovo</Badge>}
                          </div>
                        </div>
                        <p className="font-medium text-sm">{email.subject}</p>
                        <p className="text-xs text-muted-foreground truncate">{email.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">{email.date}</p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Anteprima</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedEmail ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{selectedEmail.from}</Badge>
                        <span className="text-sm text-muted-foreground">{selectedEmail.date}</span>
                      </div>
                      <h3 className="font-semibold">{selectedEmail.subject}</h3>
                    </div>
                    <Separator />
                    <div className="prose prose-sm max-w-none">
                      <p className="whitespace-pre-wrap">{selectedEmail.body}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Reply className="h-4 w-4 mr-2" />
                        Rispondi
                      </Button>
                      <Button variant="outline" size="sm">
                        <Forward className="h-4 w-4 mr-2" />
                        Inoltra
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    Seleziona un'email per visualizzarla
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="compose" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Nuova Email</CardTitle>
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
                  className="min-h-[300px]"
                  value={composeEmail.body}
                  onChange={(e) => setComposeEmail(prev => ({ ...prev, body: e.target.value }))}
                />
              </div>
              <div className="flex justify-between">
                <Button variant="outline">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Allega file
                </Button>
                <Button onClick={sendEmail} disabled={loading || !composeEmail.to || !composeEmail.subject}>
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
              <CardTitle>Configurazione Email</CardTitle>
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