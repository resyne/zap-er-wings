import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Check, Mail, Users, FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WizardStep {
  step: number;
  title: string;
  description: string;
}

interface EmailList {
  id: string;
  name: string;
  description: string;
  contact_count: number;
}

interface SenderEmail {
  id: string;
  email: string;
  name: string;
  is_verified: boolean;
}

interface NewsletterTemplate {
  logo: string;
  headerText: string;
  footerText: string;
  signature: string;
}

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  logo_url?: string;
  header_text: string;
  footer_text: string;
  signature: string;
  is_default: boolean;
}

interface NewsletterWizardProps {
  onSend: (data: {
    template: NewsletterTemplate;
    targetAudience: string;
    customListId?: string;
    senderEmail: SenderEmail;
    senderName: string;
    subject: string;
    message: string;
  }) => void;
  emailLists: EmailList[];
}

export const NewsletterWizard = ({ onSend, emailLists }: NewsletterWizardProps) => {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [senderEmails, setSenderEmails] = useState<SenderEmail[]>([]);
  const [loadingSenders, setLoadingSenders] = useState(false);
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");

  // Step 1: Template
  const [template, setTemplate] = useState<NewsletterTemplate>({
    logo: "",
    headerText: "",
    footerText: "",
    signature: ""
  });

  // Step 2: Destinatari
  const [targetAudience, setTargetAudience] = useState<'customers' | 'crm_contacts' | 'custom_list' | 'partners'>('customers');
  const [customListId, setCustomListId] = useState<string>("");
  const [recipientCount, setRecipientCount] = useState(0);

  // Step 3: Composizione
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<SenderEmail | null>(null);
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const steps: WizardStep[] = [
    { step: 1, title: "Template", description: "Personalizza il template della mail" },
    { step: 2, title: "Destinatari", description: "Seleziona chi riceverà la mail" },
    { step: 3, title: "Composizione", description: "Scrivi oggetto e messaggio" }
  ];

  // Fetch saved templates on mount
  useEffect(() => {
    fetchSavedTemplates();
  }, []);

  const fetchSavedTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('id, name, description, logo_url, header_text, footer_text, signature, is_default')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setSavedTemplates(data || []);
      
      // Auto-select default template if exists
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate) {
        loadTemplate(defaultTemplate);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i template salvati",
        variant: "destructive",
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadTemplate = (savedTemplate: SavedTemplate) => {
    setSelectedTemplateId(savedTemplate.id);
    setTemplate({
      logo: savedTemplate.logo_url || "",
      headerText: savedTemplate.header_text || "",
      footerText: savedTemplate.footer_text || "",
      signature: savedTemplate.signature || ""
    });
  };

  // Fetch sender emails quando arriviamo allo step 3
  const fetchSenderEmails = async () => {
    if (senderEmails.length > 0) return;
    
    setLoadingSenders(true);
    try {
      const { data, error } = await supabase
        .from('sender_emails')
        .select('*')
        .eq('is_verified', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSenderEmails(data || []);
      
      if (data && data.length > 0) {
        setSelectedSenderEmail(data[0]);
        setSenderName(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching sender emails:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le email mittente",
        variant: "destructive",
      });
    } finally {
      setLoadingSenders(false);
    }
  };

  // Fetch recipient counts
  const fetchRecipientCount = async () => {
    try {
      if (targetAudience === 'custom_list' && customListId) {
        const list = emailLists.find(l => l.id === customListId);
        setRecipientCount(list?.contact_count || 0);
      } else if (targetAudience === 'customers') {
        const { count } = await supabase
          .from('customers')
          .select('id', { count: 'exact' })
          .eq('active', true);
        setRecipientCount(count || 0);
      } else if (targetAudience === 'crm_contacts') {
        const { count } = await supabase
          .from('crm_contacts')
          .select('id', { count: 'exact' });
        setRecipientCount(count || 0);
      } else if (targetAudience === 'partners') {
        const { count } = await supabase
          .from('partners')
          .select('id', { count: 'exact' });
        setRecipientCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching recipient count:', error);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return template.signature.trim() !== "";
    }
    if (currentStep === 2) {
      if (targetAudience === 'custom_list') {
        return customListId !== "";
      }
      return true;
    }
    if (currentStep === 3) {
      return selectedSenderEmail !== null && subject.trim() !== "" && message.trim() !== "";
    }
    return false;
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      await fetchRecipientCount();
    }
    if (currentStep === 3) {
      await fetchSenderEmails();
    }
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSend = () => {
    if (!selectedSenderEmail) {
      toast({
        title: "Errore",
        description: "Seleziona un mittente",
        variant: "destructive",
      });
      return;
    }

    onSend({
      template,
      targetAudience,
      customListId: targetAudience === 'custom_list' ? customListId : undefined,
      senderEmail: selectedSenderEmail,
      senderName,
      subject,
      message
    });
  };

  const generatePreview = () => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        ${template.logo ? `
          <div style="text-align: center; padding: 20px; background-color: #f9fafb;">
            <img src="${template.logo}" alt="Logo" style="max-width: 200px; height: auto;" />
          </div>
        ` : ''}
        
        ${template.headerText ? `
          <div style="background-color: #1f2937; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${template.headerText}</h1>
          </div>
        ` : ''}
        
        <div style="padding: 30px;">
          <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 20px; font-size: 20px;">
            ${subject || 'Oggetto della mail'}
          </h2>
          
          <div style="line-height: 1.6; color: #374151; margin-bottom: 30px;">
            ${(message || 'Il messaggio apparirà qui...').replace(/\n/g, '<br>')}
          </div>
          
          ${template.signature ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
              <div style="white-space: pre-line;">${template.signature}</div>
            </div>
          ` : ''}
        </div>
        
        ${template.footerText ? `
          <div style="padding: 20px; background-color: #f9fafb; color: #9ca3af; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb;">
            ${template.footerText}
          </div>
        ` : ''}
      </div>
    `;
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.step} className="flex items-center flex-1">
            <div className={`flex flex-col items-center flex-1 ${index < steps.length - 1 ? 'relative' : ''}`}>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                currentStep > step.step ? 'bg-green-500 text-white' :
                currentStep === step.step ? 'bg-primary text-white' :
                'bg-gray-200 text-gray-500'
              }`}>
                {currentStep > step.step ? <Check className="h-5 w-5" /> : step.step}
              </div>
              <div className="text-center mt-2">
                <div className={`text-sm font-medium ${currentStep === step.step ? 'text-primary' : 'text-muted-foreground'}`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block">
                  {step.description}
                </div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 ${currentStep > step.step ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {currentStep === 1 && <FileText className="h-5 w-5" />}
            {currentStep === 2 && <Users className="h-5 w-5" />}
            {currentStep === 3 && <Mail className="h-5 w-5" />}
            {steps[currentStep - 1].title}
          </CardTitle>
          <CardDescription>{steps[currentStep - 1].description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Template */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {/* Saved Templates Selection */}
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Caricamento template...</span>
                </div>
              ) : savedTemplates.length > 0 ? (
                <div>
                  <label className="text-sm font-medium mb-2 block">Template Salvati</label>
                  <div className="grid gap-2 mb-4">
                    {savedTemplates.map((tmpl) => (
                      <div
                        key={tmpl.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                          selectedTemplateId === tmpl.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''
                        }`}
                        onClick={() => loadTemplate(tmpl)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{tmpl.name}</div>
                            {tmpl.description && (
                              <div className="text-xs text-muted-foreground">{tmpl.description}</div>
                            )}
                          </div>
                          {tmpl.is_default && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
                  Nessun template salvato. Crea i tuoi template nella sezione Impostazioni.
                </div>
              )}

              {/* Manual Template Fields */}
              <div className="space-y-4">
                <div className="text-sm font-medium">Personalizza Template</div>
                <div>
                  <label className="text-sm font-medium">Logo (URL)</label>
                  <Input
                    placeholder="https://example.com/logo.png (opzionale)"
                    value={template.logo}
                    onChange={(e) => setTemplate({ ...template, logo: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Testo Header</label>
                  <Input
                    placeholder="Newsletter Aziendale (opzionale)"
                    value={template.headerText}
                    onChange={(e) => setTemplate({ ...template, headerText: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Firma *</label>
                  <Textarea
                    placeholder="Cordiali saluti,&#10;Il Team"
                    value={template.signature}
                    onChange={(e) => setTemplate({ ...template, signature: e.target.value })}
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Testo Footer</label>
                  <Input
                    placeholder="© 2024 La Tua Azienda (opzionale)"
                    value={template.footerText}
                    onChange={(e) => setTemplate({ ...template, footerText: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Destinatari */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Seleziona lista destinatari</label>
                <div className="grid gap-3">
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                      targetAudience === 'customers' ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setTargetAudience('customers')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Clienti</span>
                      <Badge variant="secondary">Sistema</Badge>
                    </div>
                  </div>
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                      targetAudience === 'crm_contacts' ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setTargetAudience('crm_contacts')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Contatti CRM</span>
                      <Badge variant="secondary">Sistema</Badge>
                    </div>
                  </div>
                  <div
                    className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                      targetAudience === 'partners' ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => setTargetAudience('partners')}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Partner</span>
                      <Badge variant="secondary">Sistema</Badge>
                    </div>
                  </div>
                </div>
              </div>

              {targetAudience === 'custom_list' && (
                <div>
                  <label className="text-sm font-medium">Lista Personalizzata</label>
                  <Select value={customListId} onValueChange={setCustomListId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona una lista" />
                    </SelectTrigger>
                    <SelectContent>
                      {emailLists.map(list => (
                        <SelectItem key={list.id} value={list.id}>
                          {list.name} ({list.contact_count} contatti)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button onClick={fetchRecipientCount} variant="outline" className="w-full">
                Aggiorna conteggio destinatari
              </Button>

              {recipientCount > 0 && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="text-sm font-medium">Destinatari totali</div>
                  <div className="text-2xl font-bold text-primary">{recipientCount}</div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Composizione */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Email Mittente *</label>
                  <Select
                    value={selectedSenderEmail?.id || ""}
                    onValueChange={(value) => {
                      const sender = senderEmails.find(s => s.id === value);
                      if (sender) {
                        setSelectedSenderEmail(sender);
                        setSenderName(sender.name);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona mittente" />
                    </SelectTrigger>
                    <SelectContent>
                      {senderEmails.map(sender => (
                        <SelectItem key={sender.id} value={sender.id}>
                          {sender.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Nome Mittente *</label>
                  <Input
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Nome visualizzato"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Oggetto *</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Oggetto della mail"
                />
              </div>

              <div>
                <label className="text-sm font-medium">Messaggio *</label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Il tuo messaggio..."
                  rows={10}
                />
              </div>

              {/* Preview */}
              <div>
                <label className="text-sm font-medium mb-2 block">Anteprima Email</label>
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: generatePreview() }} />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={currentStep === 1}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>

        {currentStep < 3 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
          >
            Avanti
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleSend}
            disabled={!canProceed()}
          >
            <Mail className="h-4 w-4 mr-2" />
            Invia Email
          </Button>
        )}
      </div>
    </div>
  );
};
