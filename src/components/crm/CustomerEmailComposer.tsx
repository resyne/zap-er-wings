import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Mail, 
  Send, 
  Users, 
  Eye, 
  FileText,
  MapPin,
  Filter
} from "lucide-react";

interface CustomerEmailComposerProps {
  onClose?: () => void;
}

export function CustomerEmailComposer({ onClose }: CustomerEmailComposerProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Form data
  const [emailData, setEmailData] = useState({
    subject: "",
    message: "",
    active_only: true,
    city: "",
    country: "",
    sender_name: "Customer Service",
    sender_email: "noreply@erp.abbattitorizapper.it"
  });

  // Recipients preview
  const [recipientsCount, setRecipientsCount] = useState(0);
  const [customersBreakdown, setCustomersBreakdown] = useState<any[]>([]);

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
      const { data, error } = await supabase.functions.invoke('send-customer-emails', {
        body: {
          active_only: emailData.active_only,
          city: emailData.city || undefined,
          country: emailData.country || undefined,
          subject: emailData.subject,
          message: emailData.message
        }
      });

      if (error) throw error;

      toast({
        title: "Email inviata!",
        description: `Email inviata con successo a ${data.emails_sent} clienti`,
      });

      // Reset form
      setEmailData({
        subject: "",
        message: "",
        active_only: true,
        city: "",
        country: "",
        sender_name: "Customer Service",
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
      // Get count with current filters
      let query = supabase
        .from('customers')
        .select('id', { count: 'exact' })
        .not('email', 'is', null);

      if (emailData.active_only) {
        query = query.eq('active', true);
      }
      if (emailData.city) {
        query = query.eq('city', emailData.city);
      }
      if (emailData.country) {
        query = query.eq('country', emailData.country);
      }

      const { count } = await query;
      setRecipientsCount(count || 0);

      // Get breakdown for debugging
      const { data: breakdown } = await supabase
        .from('customers')
        .select('active, city, country')
        .not('email', 'is', null);

      if (breakdown) {
        const stats = breakdown.reduce((acc: any, customer) => {
          const key = `${customer.active ? 'active' : 'inactive'}_${customer.city || 'no_city'}_${customer.country || 'no_country'}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
        
        setCustomersBreakdown(Object.entries(stats).map(([key, count]) => {
          const [status, city, country] = key.split('_');
          return { status, city, country, count };
        }));
      }
    } catch (error) {
      console.error('Error getting recipients:', error);
    }
  };

  // Get recipients count when component mounts and filters change
  useEffect(() => {
    getRecipientsPreview();
  }, [emailData.active_only, emailData.city, emailData.country]);

  const renderPreview = () => (
    <div className="border rounded-lg p-6 bg-white">
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-blue-600">Comunicazione Clienti</span>
          </div>
          <Badge variant="outline">{emailData.subject}</Badge>
        </div>
        
        <div className="space-y-2 text-sm text-muted-foreground">
          <div><strong>Da:</strong> {emailData.sender_name} &lt;{emailData.sender_email}&gt;</div>
          <div><strong>A:</strong> Clienti selezionati ({recipientsCount} destinatari)</div>
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
          <p>Cordiali saluti,<br />Il Team Customer Service</p>
          <p className="text-xs text-muted-foreground mt-2">
            Questa email è stata inviata automaticamente dal sistema di gestione clienti.
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
          Compositore Email Clienti
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
                  placeholder="Customer Service"
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
- {customer_name} per il nome del cliente
- {company_name} per il nome dell'azienda"
                rows={8}
                className="resize-none"
              />
              <div className="text-xs text-muted-foreground">
                💡 Tip: Usa <code>{"{customer_name}"}</code> e <code>{"{company_name}"}</code> per personalizzare il messaggio
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
                <div className="flex items-center space-x-2">
                  <Switch
                    id="active_only"
                    checked={emailData.active_only}
                    onCheckedChange={(checked) => setEmailData({...emailData, active_only: checked})}
                  />
                  <Label htmlFor="active_only">Solo clienti attivi</Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Città</Label>
                <Input
                  id="city"
                  value={emailData.city}
                  onChange={(e) => setEmailData({...emailData, city: e.target.value})}
                  placeholder="Filtra per città (opzionale)"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Paese</Label>
                <Input
                  id="country"
                  value={emailData.country}
                  onChange={(e) => setEmailData({...emailData, country: e.target.value})}
                  placeholder="Filtra per paese (opzionale)"
                />
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-semibold">Destinatari Selezionati</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{recipientsCount}</div>
              <div className="text-sm text-muted-foreground">
                clienti riceveranno questa email
              </div>
            </div>

            {/* Debug breakdown */}
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold mb-3">📊 Ripartizione Clienti (Debug)</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {customersBreakdown.slice(0, 10).map((item, index) => (
                  <div key={index} className="flex justify-between border-b pb-1">
                    <span className="font-medium">
                      {item.status} - {item.city} - {item.country}
                    </span>
                    <span className="text-blue-600">{item.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-2 border-t font-semibold flex justify-between">
                <span>Totale:</span>
                <span className="text-blue-600">
                  {customersBreakdown.reduce((sum, item) => sum + item.count, 0)}
                </span>
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