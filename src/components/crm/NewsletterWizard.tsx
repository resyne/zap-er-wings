import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, Check, Mail, Users, FileText, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";

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
    customListIds?: string[];
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
  const [customListIds, setCustomListIds] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);

  // Step 3: Composizione
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<SenderEmail | null>(null);
  const [senderName, setSenderName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Automation settings
  const [enableAutomation, setEnableAutomation] = useState(false);
  const [automations, setAutomations] = useState<Array<{
    name: string;
    description: string;
    delayDays: number;
    subject: string;
    message: string;
  }>>([]);

  const steps: WizardStep[] = [
    { step: 1, title: "Template", description: "Personalizza il template della mail" },
    { step: 2, title: "Destinatari", description: "Seleziona chi riceverà la mail" },
    { step: 3, title: "Composizione", description: "Scrivi oggetto e messaggio" }
  ];

  // Fetch saved templates and sender emails on mount
  useEffect(() => {
    fetchSavedTemplates();
    fetchSenderEmails();
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
      if (targetAudience === 'custom_list' && customListIds.length > 0) {
        // Sum up contacts from all selected lists
        const totalContacts = customListIds.reduce((sum, listId) => {
          const list = emailLists.find(l => l.id === listId);
          return sum + (list?.contact_count || 0);
        }, 0);
        setRecipientCount(totalContacts);
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
      return template.signature.trim() !== "" && selectedSenderEmail !== null && senderName.trim() !== "";
    }
    if (currentStep === 2) {
      if (targetAudience === 'custom_list') {
        return customListIds.length > 0;
      }
      return true;
    }
    if (currentStep === 3) {
      return subject.trim() !== "" && message.trim() !== "";
    }
    return false;
  };

  const handleNext = async () => {
    if (currentStep === 2) {
      await fetchRecipientCount();
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

  const handleSend = async () => {
    if (!selectedSenderEmail) {
      toast({
        title: "Errore",
        description: "Seleziona un mittente",
        variant: "destructive",
      });
      return;
    }

    try {
      // If automation is enabled, create automations
      if (enableAutomation && automations.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        
        for (const automation of automations) {
          if (!automation.subject.trim() || !automation.message.trim()) {
            toast({
              title: "Attenzione",
              description: `L'automation "${automation.name}" richiede oggetto e messaggio`,
              variant: "destructive",
            });
            return;
          }

          const { error: automationError } = await supabase
            .from("email_automations")
            .insert({
              name: automation.name,
              description: automation.description || null,
              template_id: selectedTemplateId || null,
              trigger_type: "after_campaign",
              delay_days: automation.delayDays,
              target_audience: targetAudience,
              email_list_id: targetAudience === 'custom_list' && customListIds.length > 0 ? customListIds[0] : null,
              sender_email: selectedSenderEmail.email,
              sender_name: senderName,
              subject: automation.subject,
              message: automation.message,
              is_active: true,
              created_by: userData.user?.id,
            });

          if (automationError) {
            console.error("Error creating automation:", automationError);
            toast({
              title: "Attenzione",
              description: `Errore nella creazione dell'automation "${automation.name}"`,
              variant: "destructive",
            });
          }
        }

        toast({
          title: "Automations create",
          description: `${automations.length} automation${automations.length > 1 ? 's' : ''} configurata con successo`,
        });
      }

      // Send the newsletter
      onSend({
        template,
        targetAudience,
        customListIds: targetAudience === 'custom_list' ? customListIds : undefined,
        senderEmail: selectedSenderEmail,
        senderName,
        subject,
        message
      });
    } catch (error) {
      console.error("Error in handleSend:", error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore durante la configurazione",
        variant: "destructive",
      });
    }
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
                
                {/* Sender Email Selection */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-primary/5 rounded-lg">
                  <div>
                    <label className="text-sm font-medium">Email Mittente *</label>
                    {loadingSenders ? (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                        <span className="text-xs text-muted-foreground">Caricamento...</span>
                      </div>
                    ) : senderEmails.length === 0 ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Nessuna email mittente configurata. Vai in Impostazioni per aggiungerne una.
                      </p>
                    ) : (
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
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Nome Mittente *</label>
                    <Input
                      value={senderName}
                      onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nome visualizzato"
                      disabled={!selectedSenderEmail}
                    />
                  </div>
                </div>

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
                
                {/* System Lists */}
                <div className="space-y-2 mb-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Liste Sistema</div>
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

                {/* Custom Lists */}
                {emailLists.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Liste Personalizzate {targetAudience === 'custom_list' && customListIds.length > 0 && (
                        <span className="text-primary">({customListIds.length} selezionate)</span>
                      )}
                    </div>
                    <div className="grid gap-3">
                      {emailLists.map((list) => {
                        const isSelected = targetAudience === 'custom_list' && customListIds.includes(list.id);
                        return (
                          <div
                            key={list.id}
                            className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-primary ${
                              isSelected ? 'border-primary bg-primary/5' : ''
                            }`}
                            onClick={() => {
                              setTargetAudience('custom_list');
                              if (isSelected) {
                                // Remove from selection
                                setCustomListIds(prev => prev.filter(id => id !== list.id));
                                if (customListIds.length === 1) {
                                  // If this was the last selected list, reset to customers
                                  setTargetAudience('customers');
                                }
                              } else {
                                // Add to selection
                                setCustomListIds(prev => [...prev, list.id]);
                              }
                            }}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isSelected}
                                onClick={(e) => e.stopPropagation()}
                                className="mt-0.5"
                              />
                              <div className="flex-1">
                                <div className="font-medium">{list.name}</div>
                                {list.description && (
                                  <div className="text-xs text-muted-foreground mt-1">{list.description}</div>
                                )}
                              </div>
                              <Badge variant="outline" className="ml-2">
                                {list.contact_count} contatti
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

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
            <div className="space-y-6">
              {/* Riepilogo Template e Mittente */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-2">Template e Mittente</div>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="p-2 bg-background rounded border">
                    <div className="font-medium text-foreground mb-1">Mittente</div>
                    <div>{selectedSenderEmail?.email}</div>
                    <div className="text-xs">Nome: {senderName}</div>
                  </div>
                  {template.logo && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Logo:</span>
                      <img src={template.logo} alt="Logo" className="h-8 object-contain" />
                    </div>
                  )}
                  {template.headerText && (
                    <div>
                      <span className="font-medium">Header:</span> {template.headerText}
                    </div>
                  )}
                  {template.signature && (
                    <div>
                      <span className="font-medium">Firma:</span> {template.signature.split('\n')[0]}...
                    </div>
                  )}
                  {template.footerText && (
                    <div>
                      <span className="font-medium">Footer:</span> {template.footerText}
                    </div>
                  )}
                </div>
              </div>

              {/* Riepilogo Destinatari */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <div className="text-sm font-medium mb-2">Destinatari</div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {targetAudience === 'customers' && 'Clienti'}
                    {targetAudience === 'crm_contacts' && 'Contatti CRM'}
                    {targetAudience === 'partners' && 'Partner'}
                    {targetAudience === 'custom_list' && (
                      <div className="space-y-1">
                        {customListIds.map(listId => {
                          const list = emailLists.find(l => l.id === listId);
                          return (
                            <div key={listId} className="flex items-center gap-2">
                              <Badge variant="outline">{list?.name || 'Lista'}</Badge>
                              <span className="text-xs">({list?.contact_count || 0} contatti)</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {recipientCount > 0 && (
                    <Badge variant="secondary">{recipientCount} destinatari</Badge>
                  )}
                </div>
              </div>

              {/* Mittente e Oggetto */}
              <div className="space-y-4">
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
              </div>

              <Separator className="my-6" />

              {/* Automation Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="enable-automation" className="text-base">
                      Abilita Follow-up Automatico
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Invia automaticamente un'email di follow-up ai destinatari dopo un periodo di tempo
                    </p>
                  </div>
                  <Switch
                    id="enable-automation"
                    checked={enableAutomation}
                    onCheckedChange={(checked) => {
                      setEnableAutomation(checked);
                      if (checked && automations.length === 0) {
                        setAutomations([{
                          name: "Follow-up dopo 7 giorni",
                          description: "",
                          delayDays: 7,
                          subject: "",
                          message: ""
                        }]);
                      }
                    }}
                  />
                </div>

                {enableAutomation && (
                  <div className="space-y-6">
                    {automations.map((automation, index) => (
                      <div key={index} className="space-y-4 p-4 border rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold">Follow-up #{index + 1}</h4>
                          {automations.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newAutomations = automations.filter((_, i) => i !== index);
                                setAutomations(newAutomations);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`automation-name-${index}`}>Nome Automation (opzionale)</Label>
                          <Input
                            id={`automation-name-${index}`}
                            placeholder="Follow-up dopo 7 giorni"
                            value={automation.name}
                            onChange={(e) => {
                              const newAutomations = [...automations];
                              newAutomations[index].name = e.target.value;
                              setAutomations(newAutomations);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`automation-description-${index}`}>Descrizione (opzionale)</Label>
                          <Textarea
                            id={`automation-description-${index}`}
                            placeholder="Descrivi lo scopo di questa automation..."
                            value={automation.description}
                            onChange={(e) => {
                              const newAutomations = [...automations];
                              newAutomations[index].description = e.target.value;
                              setAutomations(newAutomations);
                            }}
                            rows={2}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`delay-days-${index}`}>Giorni di attesa prima del follow-up</Label>
                          <Input
                            id={`delay-days-${index}`}
                            type="number"
                            min="1"
                            value={automation.delayDays}
                            onChange={(e) => {
                              const newAutomations = [...automations];
                              newAutomations[index].delayDays = parseInt(e.target.value) || 1;
                              setAutomations(newAutomations);
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            L'email di follow-up verrà inviata {automation.delayDays} giorni dopo l'invio iniziale
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`automation-subject-${index}`}>Oggetto Follow-up *</Label>
                          <Input
                            id={`automation-subject-${index}`}
                            placeholder="Oggetto dell'email di follow-up"
                            value={automation.subject}
                            onChange={(e) => {
                              const newAutomations = [...automations];
                              newAutomations[index].subject = e.target.value;
                              setAutomations(newAutomations);
                            }}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`automation-message-${index}`}>Messaggio Follow-up *</Label>
                          <Textarea
                            id={`automation-message-${index}`}
                            placeholder="Scrivi il messaggio per questa email di follow-up..."
                            value={automation.message}
                            onChange={(e) => {
                              const newAutomations = [...automations];
                              newAutomations[index].message = e.target.value;
                              setAutomations(newAutomations);
                            }}
                            rows={6}
                          />
                        </div>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const lastDelay = automations.length > 0 
                          ? automations[automations.length - 1].delayDays 
                          : 0;
                        setAutomations([...automations, {
                          name: `Follow-up dopo ${lastDelay + 7} giorni`,
                          description: "",
                          delayDays: lastDelay + 7,
                          subject: "",
                          message: ""
                        }]);
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi altro Follow-up
                    </Button>
                  </div>
                )}
              </div>

              {/* Anteprima Email Aggiornata */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Anteprima Email</label>
                  <Badge variant="outline" className="text-xs">Anteprima in tempo reale</Badge>
                </div>
                <div className="border rounded-lg p-4 bg-gray-50 max-h-96 overflow-auto">
                  <div dangerouslySetInnerHTML={{ __html: generatePreview() }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  L'anteprima mostra come apparirà l'email con il template e il contenuto che hai inserito
                </p>
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
