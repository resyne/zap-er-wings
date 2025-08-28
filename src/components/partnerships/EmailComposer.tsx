import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Send, 
  Users, 
  Settings, 
  Eye, 
  FileText,
  MapPin,
  Filter
} from "lucide-react";

interface EmailComposerProps {
  onClose?: () => void;
}

export function EmailComposer({ onClose }: EmailComposerProps) {
  const [loading, setLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const { toast } = useToast();

  // Form data
  const [emailData, setEmailData] = useState({
    subject: "",
    message: "",
    partner_type: "all",
    region: "",
    acquisition_status: "all",
    sender_name: "Partnership Team",
    sender_email: "noreply@erp.abbattitorizapper.it"
  });

  // Recipients preview
  const [recipientsCount, setRecipientsCount] = useState(0);

  const handleSendEmail = async () => {
    if (!emailData.subject.trim() || !emailData.message.trim()) {
      toast({
        title: "Errore",
        description: "Oggetto e messaggio sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-partner-emails', {
        body: {
          partner_type: emailData.partner_type === "all" ? undefined : emailData.partner_type,
          region: emailData.region || undefined,
          acquisition_status: emailData.acquisition_status === "all" ? undefined : emailData.acquisition_status,
          subject: emailData.subject,
          message: emailData.message,
          is_cronjob: false
        }
      });

      if (error) throw error;

      toast({
        title: "Email inviata!",
        description: `Email inviata con successo a ${data.emails_sent} partner`,
      });

      // Reset form
      setEmailData({
        subject: "",
        message: "",
        partner_type: "all",
        region: "",
        acquisition_status: "all",
        sender_name: "Partnership Team",
        sender_email: "noreply@erp.abbattitorizapper.it"
      });

      onClose?.();
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({
        title: "Errore",
        description: "Errore durante l'invio dell'email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getRecipientsPreview = async () => {
    try {
      let query = supabase
        .from('partners')
        .select('id, first_name, last_name, email, company_name, partner_type, region', { count: 'exact' })
        .not('email', 'is', null);

      if (emailData.partner_type !== "all") {
        query = query.eq('partner_type', emailData.partner_type);
      }
      if (emailData.region) {
        query = query.eq('region', emailData.region);
      }
      if (emailData.acquisition_status !== "all") {
        query = query.eq('acquisition_status', emailData.acquisition_status);
      }

      const { count } = await query;
      setRecipientsCount(count || 0);
    } catch (error) {
      console.error('Error getting recipients:', error);
    }
  };

  // Get recipients count when filters change
  useState(() => {
    getRecipientsPreview();
  });

  const renderPreview = () => (
    <div className="border rounded-lg p-6 bg-white">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-600">Comunicazione Partnership</span>
          </div>
          <Badge variant="outline">{emailData.subject}</Badge>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div><strong>Da:</strong> {emailData.sender_name} &lt;{emailData.sender_email}&gt;</div>
          <div><strong>A:</strong> Partner selezionati ({recipientsCount} destinatari)</div>
          <div><strong>Oggetto:</strong> {emailData.subject}</div>
        </div>

        <Separator />

        <div 
          className="prose prose-sm max-w-none"
          dangerouslySetInnerHTML={{ 
            __html: emailData.message.replace(/\n/g, '<br>') 
          }}
        />

        <Separator />

        <div className="text-sm text-muted-foreground">
          <p>Cordiali saluti,<br />Il Team Partnership</p>
          <p className="text-xs text-muted-foreground mt-2">
            Questa email è stata inviata automaticamente dal sistema di gestione partnership.
          </p>
        </div>

        <Separator />

        {/* Company Footer */}
        <div className="flex flex-col items-center space-y-3 py-4 bg-muted/30 rounded-lg">
          <img 
            src="/lovable-uploads/e8493046-02d3-407a-ae34-b061ef9720af.png" 
            alt="ZAPPER Logo" 
            className="h-12 object-contain"
          />
          <div className="text-center text-xs text-muted-foreground leading-relaxed">
            <div className="font-medium">info@abbattitorizapper.it | Scafati (SA) - Italy | 08119968436</div>
            <div className="text-blue-600 hover:text-blue-800">
              <a href="https://www.abbattitorizapper.it" target="_blank" rel="noopener noreferrer">
                www.abbattitorizapper.it
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Compositore Email Partnership
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="compose" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Componi
            </TabsTrigger>
            <TabsTrigger value="recipients" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Destinatari ({recipientsCount})
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Anteprima
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose" className="space-y-6">
            {/* Sender Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sender_name">Nome Mittente</Label>
                <Input
                  id="sender_name"
                  value={emailData.sender_name}
                  onChange={(e) => setEmailData({...emailData, sender_name: e.target.value})}
                  placeholder="Partnership Team"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sender_email">Email Mittente</Label>
                <Input
                  id="sender_email"
                  value={emailData.sender_email}
                  onChange={(e) => setEmailData({...emailData, sender_email: e.target.value})}
                  placeholder="noreply@erp.abbattitorizapper.it"
                />
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <Label htmlFor="subject">Oggetto</Label>
              <Input
                id="subject"
                value={emailData.subject}
                onChange={(e) => setEmailData({...emailData, subject: e.target.value})}
                placeholder="Inserisci l'oggetto dell'email..."
              />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Messaggio</Label>
              <Textarea
                id="message"
                value={emailData.message}
                onChange={(e) => setEmailData({...emailData, message: e.target.value})}
                placeholder="Scrivi il messaggio dell'email...

Puoi usare:
- {partner_name} per il nome del partner
- {company_name} per il nome dell'azienda"
                rows={8}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                💡 Tip: Usa <code>{"{partner_name}"}</code> e <code>{"{company_name}"}</code> per personalizzare il messaggio
              </div>
            </div>
          </TabsContent>

          <TabsContent value="recipients" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="w-4 h-4" />
              <span className="font-semibold">Filtra Destinatari</span>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="partner_type">Tipo Partner</Label>
                <Select 
                  value={emailData.partner_type} 
                  onValueChange={(value) => {
                    setEmailData({...emailData, partner_type: value});
                    getRecipientsPreview();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i partner</SelectItem>
                    <SelectItem value="rivenditore">Rivenditori</SelectItem>
                    <SelectItem value="installatore">Installatori</SelectItem>
                    <SelectItem value="importatore">Importatori</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region">Regione</Label>
                <Input
                  id="region"
                  value={emailData.region}
                  onChange={(e) => {
                    setEmailData({...emailData, region: e.target.value});
                    getRecipientsPreview();
                  }}
                  placeholder="Filtra per regione (opzionale)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acquisition_status">Fase Acquisizione</Label>
                <Select 
                  value={emailData.acquisition_status} 
                  onValueChange={(value) => {
                    setEmailData({...emailData, acquisition_status: value});
                    getRecipientsPreview();
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona fase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le fasi</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="contatto">Primo Contatto</SelectItem>
                    <SelectItem value="negoziazione">Negoziazione</SelectItem>
                    <SelectItem value="contratto">Contratto</SelectItem>
                    <SelectItem value="attivo">Attivo</SelectItem>
                    <SelectItem value="inattivo">Inattivo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-semibold">Destinatari Selezionati</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{recipientsCount}</div>
              <div className="text-sm text-muted-foreground">
                partner riceveranno questa email
              </div>
            </div>
          </TabsContent>

          <TabsContent value="preview" className="space-y-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-4 h-4" />
              <span className="font-semibold">Anteprima Email</span>
            </div>
            {renderPreview()}
          </TabsContent>
        </Tabs>

        <div className="flex justify-between pt-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button 
            onClick={handleSendEmail} 
            disabled={loading || !emailData.subject.trim() || !emailData.message.trim()}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {loading ? "Invio in corso..." : `Invia Email (${recipientsCount})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}