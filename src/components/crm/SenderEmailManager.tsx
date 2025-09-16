import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Mail, Check, X, RefreshCw, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface SenderEmail {
  id: string;
  email: string;
  name: string;
  domain: string;
  is_verified: boolean;
  is_default: boolean;
  resend_domain_id?: string;
  created_at: string;
}

interface SenderEmailManagerProps {
  onEmailSelect: (email: SenderEmail) => void;
  selectedEmailId?: string;
}

export const SenderEmailManager = ({ onEmailSelect, selectedEmailId }: SenderEmailManagerProps) => {
  const { toast } = useToast();
  const [senderEmails, setSenderEmails] = useState<SenderEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState({ email: '', name: '' });
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchSenderEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('sender_emails')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSenderEmails(data || []);
      
      // Auto-select default email if none selected
      if (!selectedEmailId && data && data.length > 0) {
        const defaultEmail = data.find(email => email.is_default) || data[0];
        onEmailSelect(defaultEmail);
      }
    } catch (error) {
      console.error('Error fetching sender emails:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli indirizzi email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSenderEmails();
  }, []);

  const extractDomain = (email: string) => {
    return email.split('@')[1] || '';
  };

  const handleAddEmail = async () => {
    if (!newEmail.email || !newEmail.name) {
      toast({
        title: "Errore",
        description: "Inserisci email e nome",
        variant: "destructive",
      });
      return;
    }

    if (!newEmail.email.includes('@')) {
      toast({
        title: "Errore",
        description: "Inserisci un indirizzo email valido",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      const domain = extractDomain(newEmail.email);
      console.log('Adding sender email:', { email: newEmail.email, name: newEmail.name, domain });
      
      const { data, error } = await supabase
        .from('sender_emails')
        .insert({
          email: newEmail.email,
          name: newEmail.name,
          domain,
          is_verified: false,
          is_default: senderEmails.length === 0 // First email becomes default
        })
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('Sender email added successfully:', data);

      setSenderEmails(prev => [data, ...prev]);
      setNewEmail({ email: '', name: '' });
      setDialogOpen(false);

      toast({
        title: "Email aggiunta",
        description: "Indirizzo email mittente aggiunto con successo",
      });

      // Verify domain with Resend (don't fail if this fails)
      try {
        await verifyDomainWithResend(data.id, domain);
      } catch (verifyError) {
        console.warn('Domain verification failed, but email was added:', verifyError);
      }
    } catch (error: any) {
      console.error('Error adding sender email:', error);
      
      let errorMessage = "Errore nell'aggiunta dell'indirizzo email";
      
      if (error.code === '23505') {
        errorMessage = "Questo indirizzo email è già stato aggiunto";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Errore",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const verifyDomainWithResend = async (emailId: string, domain: string) => {
    setVerifying(emailId);
    try {
      const { data, error } = await supabase.functions.invoke('verify-resend-domain', {
        body: { emailId, domain }
      });

      if (error) throw error;

      // Update local state
      setSenderEmails(prev => prev.map(email => 
        email.id === emailId 
          ? { ...email, is_verified: data.verified, resend_domain_id: data.domainId }
          : email
      ));

      if (data.verified) {
        toast({
          title: "Dominio verificato",
          description: "Il dominio è stato verificato con Resend",
        });
      } else {
        toast({
          title: "Verifica richiesta",
          description: "Controlla le impostazioni DNS del dominio per completare la verifica",
          variant: "default",
        });
      }
    } catch (error) {
      console.error('Error verifying domain:', error);
      toast({
        title: "Errore verifica",
        description: "Errore nella verifica del dominio",
        variant: "destructive",
      });
    } finally {
      setVerifying(null);
    }
  };

  const setAsDefault = async (emailId: string) => {
    try {
      // Remove default from all emails
      await supabase
        .from('sender_emails')
        .update({ is_default: false })
        .neq('id', emailId);

      // Set new default
      const { error } = await supabase
        .from('sender_emails')
        .update({ is_default: true })
        .eq('id', emailId);

      if (error) throw error;

      setSenderEmails(prev => prev.map(email => ({
        ...email,
        is_default: email.id === emailId
      })));

      toast({
        title: "Email predefinita",
        description: "Email mittente predefinita aggiornata",
      });
    } catch (error) {
      console.error('Error setting default email:', error);
      toast({
        title: "Errore",
        description: "Errore nell'impostazione dell'email predefinita",
        variant: "destructive",
      });
    }
  };

  const removeEmail = async (emailId: string) => {
    try {
      const { error } = await supabase
        .from('sender_emails')
        .delete()
        .eq('id', emailId);

      if (error) throw error;

      setSenderEmails(prev => prev.filter(email => email.id !== emailId));

      toast({
        title: "Email rimossa",
        description: "Indirizzo email mittente rimosso",
      });
    } catch (error) {
      console.error('Error removing sender email:', error);
      toast({
        title: "Errore",
        description: "Errore nella rimozione dell'indirizzo email",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Caricamento indirizzi email...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Indirizzi Email Mittente
            </CardTitle>
            <CardDescription>
              Gestisci gli indirizzi email da cui inviare le newsletter
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Email
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Aggiungi Email Mittente</DialogTitle>
                <DialogDescription>
                  Aggiungi un nuovo indirizzo email per inviare newsletter
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Indirizzo Email</label>
                  <Input
                    type="email"
                    placeholder="newsletter@tuodominio.com"
                    value={newEmail.email}
                    onChange={(e) => setNewEmail(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Nome Mittente</label>
                  <Input
                    placeholder="Newsletter Aziendale"
                    value={newEmail.name}
                    onChange={(e) => setNewEmail(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <Button onClick={handleAddEmail} className="w-full">
                  Aggiungi Email
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {senderEmails.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nessun indirizzo email mittente configurato</p>
            <p className="text-sm">Aggiungi il primo indirizzo email per iniziare</p>
          </div>
        ) : (
          <div className="space-y-3">
            {senderEmails.map((email) => (
              <div
                key={email.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedEmailId === email.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:bg-muted/50'
                }`}
                onClick={() => onEmailSelect(email)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{email.name}</span>
                      {email.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          Predefinita
                        </Badge>
                      )}
                      {email.is_verified ? (
                        <Badge variant="default" className="text-xs flex items-center gap-1">
                          <Check className="h-3 w-3" />
                          Verificata
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Non verificata
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{email.email}</p>
                    <p className="text-xs text-muted-foreground">Dominio: {email.domain}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!email.is_verified && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          verifyDomainWithResend(email.id, email.domain);
                        }}
                        disabled={verifying === email.id}
                      >
                        {verifying === email.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          'Verifica'
                        )}
                      </Button>
                    )}
                    {!email.is_default && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAsDefault(email.id);
                        }}
                      >
                        Predefinita
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeEmail(email.id);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {senderEmails.length > 0 && (
          <>
            <Separator />
            <div className="text-xs text-muted-foreground">
              <p><strong>Nota:</strong> Gli indirizzi email devono essere verificati tramite Resend per poter inviare newsletter.</p>
              <p>Assicurati di configurare correttamente i record DNS per il tuo dominio.</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};