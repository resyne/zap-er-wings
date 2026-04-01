import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, ArrowLeft, Check, Mail, Users, FileText, Loader2, Plus, Trash2, Eye, Code, Send, Save, Edit, Sparkles } from "lucide-react";
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
  const [previewTab, setPreviewTab] = useState<string>("preview");
  const [customHtml, setCustomHtml] = useState<string>("");

  // Template CRUD
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateFormData, setTemplateFormData] = useState({
    name: '', description: '', logo_url: '', header_text: '', footer_text: '', signature: '', is_default: false
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Step 1: Template
  const [template, setTemplate] = useState<NewsletterTemplate>({
    logo: "", headerText: "", footerText: "", signature: ""
  });

  // Step 2: Mittente + Destinatari
  const [selectedSenderEmail, setSelectedSenderEmail] = useState<SenderEmail | null>(null);
  const [senderName, setSenderName] = useState("");
  const [targetAudience, setTargetAudience] = useState<'customers' | 'crm_contacts' | 'custom_list' | 'partners'>('customers');
  const [customListIds, setCustomListIds] = useState<string[]>([]);
  const [recipientCount, setRecipientCount] = useState(0);

  // Step 3: Composizione
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // AI Generation
  const [aiPrompt, setAiPrompt] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

  // Automation
  const [enableAutomation, setEnableAutomation] = useState(false);
  const [automations, setAutomations] = useState<Array<{
    name: string; description: string; delayDays: number; subject: string; message: string;
  }>>([]);

  const steps = [
    { step: 1, title: "Template", description: "Scegli e personalizza il template" },
    { step: 2, title: "Mittente & Destinatari", description: "Chi invia e chi riceve" },
    { step: 3, title: "Composizione", description: "Scrivi e invia la newsletter" }
  ];

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
      const defaultTemplate = data?.find(t => t.is_default);
      if (defaultTemplate) loadTemplate(defaultTemplate);
    } catch (error) {
      console.error('Error fetching templates:', error);
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

  const fetchSenderEmails = async () => {
    setLoadingSenders(true);
    try {
      const { data, error } = await supabase
        .from('sender_emails').select('*').eq('is_verified', true).order('created_at', { ascending: false });
      if (error) throw error;
      setSenderEmails(data || []);
      if (data && data.length > 0) {
        setSelectedSenderEmail(data[0]);
        setSenderName(data[0].name);
      }
    } catch (error) {
      console.error('Error fetching sender emails:', error);
    } finally {
      setLoadingSenders(false);
    }
  };

  const fetchRecipientCount = async () => {
    try {
      if (targetAudience === 'custom_list' && customListIds.length > 0) {
        const { data, error } = await supabase
          .from('email_list_contacts').select('email').in('email_list_id', customListIds).not('email', 'is', null);
        if (error) throw error;
        const uniqueEmails = new Set((data || []).map(c => c.email.toLowerCase()));
        setRecipientCount(uniqueEmails.size);
      } else if (targetAudience === 'customers') {
        const { count } = await supabase.from('customers').select('id', { count: 'exact' }).eq('active', true);
        setRecipientCount(count || 0);
      } else if (targetAudience === 'crm_contacts') {
        const { count } = await supabase.from('crm_contacts').select('id', { count: 'exact' });
        setRecipientCount(count || 0);
      } else if (targetAudience === 'partners') {
        const { count } = await supabase.from('partners').select('id', { count: 'exact' });
        setRecipientCount(count || 0);
      }
    } catch (error) {
      console.error('Error fetching recipient count:', error);
    }
  };

  // ===== TEMPLATE CRUD =====
  const openNewTemplateDialog = () => {
    setEditingTemplateId(null);
    setTemplateFormData({
      name: '', description: '',
      logo_url: template.logo, header_text: template.headerText,
      footer_text: template.footerText, signature: template.signature,
      is_default: false
    });
    setTemplateDialogOpen(true);
  };

  const openEditTemplateDialog = (tmpl: SavedTemplate) => {
    setEditingTemplateId(tmpl.id);
    setTemplateFormData({
      name: tmpl.name, description: tmpl.description || '',
      logo_url: tmpl.logo_url || '', header_text: tmpl.header_text,
      footer_text: tmpl.footer_text, signature: tmpl.signature,
      is_default: tmpl.is_default
    });
    setTemplateDialogOpen(true);
  };

  const saveTemplateFromWizard = async () => {
    if (!templateFormData.name.trim()) {
      toast({ title: "Errore", description: "Il nome del template è obbligatorio", variant: "destructive" });
      return;
    }
    setSavingTemplate(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (editingTemplateId) {
        const { error } = await supabase.from('newsletter_templates').update({
          name: templateFormData.name, description: templateFormData.description,
          logo_url: templateFormData.logo_url || null, header_text: templateFormData.header_text,
          footer_text: templateFormData.footer_text, signature: templateFormData.signature,
          is_default: templateFormData.is_default, subject: '', message: ''
        }).eq('id', editingTemplateId);
        if (error) throw error;
        toast({ title: "Template aggiornato", description: "Template salvato con successo" });
      } else {
        const { error } = await supabase.from('newsletter_templates').insert({
          name: templateFormData.name, description: templateFormData.description,
          logo_url: templateFormData.logo_url || null, header_text: templateFormData.header_text,
          footer_text: templateFormData.footer_text, signature: templateFormData.signature,
          is_default: templateFormData.is_default, subject: '', message: '',
          created_by: user?.id
        });
        if (error) throw error;
        toast({ title: "Template creato", description: "Nuovo template salvato con successo" });
      }
      if (templateFormData.is_default) {
        await supabase.from('newsletter_templates').update({ is_default: false }).neq('id', editingTemplateId || '');
      }
      setTemplateDialogOpen(false);
      await fetchSavedTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({ title: "Errore", description: "Errore nel salvataggio del template", variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const saveCurrentAsTemplate = () => {
    setEditingTemplateId(null);
    setTemplateFormData({
      name: '', description: '',
      logo_url: template.logo, header_text: template.headerText,
      footer_text: template.footerText, signature: template.signature,
      is_default: false
    });
    setTemplateDialogOpen(true);
  };

  // ===== AI GENERATION =====
  const generateWithAi = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Attenzione", description: "Inserisci un prompt per generare il contenuto", variant: "destructive" });
      return;
    }
    setGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-newsletter', {
        body: {
          prompt: aiPrompt,
          templateContext: { headerText: template.headerText, signature: template.signature }
        }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.subject) setSubject(data.subject);
      if (data?.message) setMessage(data.message);

      toast({ title: "Contenuto generato", description: "L'AI ha generato oggetto e messaggio per la tua newsletter" });
    } catch (error: any) {
      console.error('AI generation error:', error);
      toast({
        title: "Errore AI",
        description: error.message || "Impossibile generare il contenuto",
        variant: "destructive",
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 1) return selectedTemplateId !== "" || template.signature.trim() !== "";
    if (currentStep === 2) {
      if (!selectedSenderEmail || !senderName.trim()) return false;
      if (targetAudience === 'custom_list') return customListIds.length > 0;
      return true;
    }
    if (currentStep === 3) return subject.trim() !== "" && message.trim() !== "";
    return false;
  };

  const handleNext = async () => {
    if (currentStep === 2) await fetchRecipientCount();
    if (currentStep < 3) setCurrentStep(currentStep + 1);
  };

  const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const handleSend = async () => {
    if (!selectedSenderEmail) {
      toast({ title: "Errore", description: "Seleziona un mittente", variant: "destructive" });
      return;
    }
    try {
      if (enableAutomation && automations.length > 0) {
        const { data: userData } = await supabase.auth.getUser();
        for (const automation of automations) {
          if (!automation.subject.trim() || !automation.message.trim()) {
            toast({ title: "Attenzione", description: `L'automation "${automation.name}" richiede oggetto e messaggio`, variant: "destructive" });
            return;
          }
          await supabase.from("email_automations").insert({
            name: automation.name, description: automation.description || null,
            template_id: selectedTemplateId || null, trigger_type: "after_campaign",
            delay_days: automation.delayDays, target_audience: targetAudience,
            email_list_id: targetAudience === 'custom_list' && customListIds.length > 0 ? customListIds[0] : null,
            sender_email: selectedSenderEmail.email, sender_name: senderName,
            subject: automation.subject, message: automation.message,
            is_active: true, created_by: userData.user?.id,
          });
        }
        toast({ title: "Automations create", description: `${automations.length} automation configurate` });
      }
      onSend({ template, targetAudience, customListIds: targetAudience === 'custom_list' ? customListIds : undefined, senderEmail: selectedSenderEmail, senderName, subject, message });
    } catch (error) {
      console.error("Error in handleSend:", error);
      toast({ title: "Errore", description: "Si è verificato un errore durante l'invio", variant: "destructive" });
    }
  };

  const generatePreviewHtml = () => {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
${template.logo ? `<tr><td style="text-align:center;padding:20px;background:#f9fafb;"><img src="${template.logo}" alt="Logo" style="max-width:200px;height:auto;" /></td></tr>` : ''}
${template.headerText ? `<tr><td style="background:#1f2937;color:white;padding:20px;text-align:center;"><h1 style="margin:0;font-size:24px;">${template.headerText}</h1></td></tr>` : ''}
<tr><td style="padding:30px;">
<h2 style="color:#1f2937;margin:0 0 20px;font-size:20px;">${subject || 'Oggetto della newsletter'}</h2>
<div style="line-height:1.6;color:#374151;margin-bottom:30px;">${(message || 'Il contenuto del messaggio apparirà qui...').replace(/\n/g, '<br>')}</div>
${template.signature ? `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;color:#6b7280;white-space:pre-line;">${template.signature}</div>` : ''}
</td></tr>
${template.footerText ? `<tr><td style="padding:20px;background:#f9fafb;color:#9ca3af;font-size:12px;text-align:center;border-top:1px solid #e5e7eb;">${template.footerText}</td></tr>` : ''}
</table>
</td></tr>
</table>
</body></html>`;
  };

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                currentStep > step.step ? 'bg-emerald-500 text-white' :
                currentStep === step.step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {currentStep > step.step ? <Check className="h-5 w-5" /> : step.step}
              </div>
              <div className="text-center mt-2">
                <div className={`text-sm font-medium ${currentStep === step.step ? 'text-primary' : 'text-muted-foreground'}`}>{step.title}</div>
                <div className="text-xs text-muted-foreground hidden sm:block">{step.description}</div>
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-0.5 flex-1 mx-2 transition-colors ${currentStep > step.step ? 'bg-emerald-500' : 'bg-muted'}`} />
            )}
          </div>
        ))}
      </div>

      {/* ===== STEP 1: TEMPLATE ===== */}
      {currentStep === 1 && (
        <div className="space-y-4">
          {/* Template selection */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Seleziona Template
                </CardTitle>
                <Button size="sm" variant="outline" onClick={openNewTemplateDialog} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Nuovo Template
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Caricamento template...</span>
                </div>
              ) : savedTemplates.length > 0 ? (
                <div className="grid gap-2">
                  {savedTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 group ${
                        selectedTemplateId === tmpl.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border'
                      }`}
                      onClick={() => loadTemplate(tmpl)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{tmpl.name}</div>
                          {tmpl.description && <div className="text-xs text-muted-foreground">{tmpl.description}</div>}
                        </div>
                        <div className="flex items-center gap-1">
                          {tmpl.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); openEditTemplateDialog(tmpl); }}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                  Nessun template salvato. Creane uno nuovo.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template customization */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Personalizza Template</CardTitle>
                  <CardDescription>Modifica i dettagli del template selezionato</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={saveCurrentAsTemplate} className="gap-1.5">
                  <Save className="h-3.5 w-3.5" />
                  Salva come Template
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Logo (URL)</Label>
                <Input placeholder="https://example.com/logo.png (opzionale)" value={template.logo}
                  onChange={(e) => setTemplate({ ...template, logo: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Testo Header</Label>
                <Input placeholder="Titolo della newsletter (opzionale)" value={template.headerText}
                  onChange={(e) => setTemplate({ ...template, headerText: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Firma *</Label>
                <Textarea placeholder={"Cordiali saluti,\nIl Team"} value={template.signature}
                  onChange={(e) => setTemplate({ ...template, signature: e.target.value })} rows={3} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Testo Footer</Label>
                <Input placeholder="© 2025 La Tua Azienda (opzionale)" value={template.footerText}
                  onChange={(e) => setTemplate({ ...template, footerText: e.target.value })} className="mt-1" />
              </div>
            </CardContent>
          </Card>

          {/* Template Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Anteprima Template
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={previewTab} onValueChange={setPreviewTab}>
                <TabsList className="h-8 mb-3">
                  <TabsTrigger value="preview" className="text-xs h-7 px-3 gap-1"><Eye className="h-3 w-3" /> Anteprima</TabsTrigger>
                  <TabsTrigger value="html" className="text-xs h-7 px-3 gap-1"><Code className="h-3 w-3" /> HTML</TabsTrigger>
                </TabsList>
                <TabsContent value="preview" className="mt-0">
                  <div className="border rounded-lg overflow-hidden bg-muted/30" style={{ maxHeight: 400 }}>
                    <iframe srcDoc={customHtml || generatePreviewHtml()} className="w-full border-0" style={{ height: 380 }} title="Template Preview" sandbox="" />
                  </div>
                </TabsContent>
                <TabsContent value="html" className="mt-0">
                  <textarea value={customHtml || generatePreviewHtml()}
                    onChange={(e) => setCustomHtml(e.target.value)}
                    className="w-full h-[380px] font-mono text-xs p-3 rounded-lg border bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-ring" spellCheck={false} />
                  {customHtml && (
                    <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setCustomHtml("")}>
                      <ArrowLeft className="h-3 w-3 mr-1" /> Ripristina template originale
                    </Button>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 2: MITTENTE & DESTINATARI ===== */}
      {currentStep === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Mittente</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingSenders ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Caricamento...</span>
                </div>
              ) : senderEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  Nessuna email mittente configurata. Vai in Impostazioni per aggiungerne una.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs">Email Mittente *</Label>
                    <Select value={selectedSenderEmail?.id || ""} onValueChange={(value) => {
                      const sender = senderEmails.find(s => s.id === value);
                      if (sender) { setSelectedSenderEmail(sender); setSenderName(sender.name); }
                    }}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Seleziona mittente" /></SelectTrigger>
                      <SelectContent>
                        {senderEmails.map(sender => (
                          <SelectItem key={sender.id} value={sender.id}>{sender.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Nome Mittente *</Label>
                    <Input value={senderName} onChange={(e) => setSenderName(e.target.value)}
                      placeholder="Nome visualizzato" className="mt-1" disabled={!selectedSenderEmail} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Destinatari</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">Liste Sistema</div>
                <div className="grid gap-2">
                  {([
                    { key: 'customers' as const, label: 'Clienti' },
                    { key: 'crm_contacts' as const, label: 'Contatti CRM' },
                    { key: 'partners' as const, label: 'Partner' },
                  ]).map(({ key, label }) => (
                    <div key={key}
                      className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 ${
                        targetAudience === key ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                      onClick={() => { setTargetAudience(key); setCustomListIds([]); }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{label}</span>
                        <Badge variant="secondary" className="text-xs">Sistema</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {emailLists.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">
                    Liste Personalizzate
                    {targetAudience === 'custom_list' && customListIds.length > 0 && (
                      <span className="text-primary ml-1">({customListIds.length} selezionate)</span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {emailLists.map((list) => {
                      const isSelected = targetAudience === 'custom_list' && customListIds.includes(list.id);
                      return (
                        <div key={list.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-all hover:border-primary/50 ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                          onClick={() => {
                            setTargetAudience('custom_list');
                            if (isSelected) {
                              const newIds = customListIds.filter(id => id !== list.id);
                              setCustomListIds(newIds);
                              if (newIds.length === 0) setTargetAudience('customers');
                            } else { setCustomListIds(prev => [...prev, list.id]); }
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox checked={isSelected} onClick={(e) => e.stopPropagation()} />
                            <div className="flex-1">
                              <div className="font-medium text-sm">{list.name}</div>
                              {list.description && <div className="text-xs text-muted-foreground mt-0.5">{list.description}</div>}
                            </div>
                            <Badge variant="outline" className="text-xs">{list.contact_count} contatti</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {recipientCount > 0 && (
                <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium">Destinatari totali</span>
                  <span className="text-lg font-bold text-primary">{recipientCount}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== STEP 3: COMPOSIZIONE ===== */}
      {currentStep === 3 && (
        <div className="space-y-4">
          {/* Riepilogo compatto */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="gap-1"><Mail className="h-3 w-3" />{selectedSenderEmail?.email}</Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="h-3 w-3" />
              {targetAudience === 'customers' && 'Clienti'}
              {targetAudience === 'crm_contacts' && 'Contatti CRM'}
              {targetAudience === 'partners' && 'Partner'}
              {targetAudience === 'custom_list' && `${customListIds.length} liste`}
              {recipientCount > 0 && ` (${recipientCount})`}
            </Badge>
          </div>

          {/* AI Generation */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium">Genera con AI</Label>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Descrivi la newsletter che vuoi creare... es: 'Newsletter mensile per i clienti con aggiornamenti sui nuovi prodotti abbattitori di fumi'"
                  rows={2}
                  className="flex-1"
                />
                <Button onClick={generateWithAi} disabled={generatingAi || !aiPrompt.trim()} className="gap-1.5 self-end">
                  {generatingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Genera
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">L'AI genererà oggetto e messaggio in base al tuo prompt</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Editor */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Contenuto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Oggetto *</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)}
                    placeholder="Oggetto della newsletter" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Messaggio *</Label>
                  <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                    placeholder="Scrivi il contenuto della newsletter..." rows={12} className="mt-1" />
                </div>
              </CardContent>
            </Card>

            {/* Right: Live Preview */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Anteprima Live</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-muted/30">
                  <iframe srcDoc={generatePreviewHtml()} className="w-full border-0" style={{ height: 420 }} title="Email Preview" sandbox="" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Automation */}
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="enable-automation" className="text-sm font-medium">Follow-up Automatico</Label>
                  <p className="text-xs text-muted-foreground">Invia un follow-up automatico dopo un periodo di tempo</p>
                </div>
                <Switch id="enable-automation" checked={enableAutomation}
                  onCheckedChange={(checked) => {
                    setEnableAutomation(checked);
                    if (checked && automations.length === 0) {
                      setAutomations([{ name: "Follow-up dopo 7 giorni", description: "", delayDays: 7, subject: "", message: "" }]);
                    }
                  }}
                />
              </div>
              {enableAutomation && (
                <div className="mt-4 space-y-4">
                  {automations.map((automation, index) => (
                    <div key={index} className="space-y-3 p-4 border rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-sm">Follow-up #{index + 1}</h4>
                        {automations.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => setAutomations(automations.filter((_, i) => i !== index))}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Nome</Label>
                          <Input value={automation.name} onChange={(e) => { const a = [...automations]; a[index].name = e.target.value; setAutomations(a); }} className="mt-1" />
                        </div>
                        <div>
                          <Label className="text-xs">Giorni di attesa</Label>
                          <Input type="number" min="1" value={automation.delayDays} onChange={(e) => { const a = [...automations]; a[index].delayDays = parseInt(e.target.value) || 1; setAutomations(a); }} className="mt-1" />
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Oggetto Follow-up *</Label>
                        <Input value={automation.subject} onChange={(e) => { const a = [...automations]; a[index].subject = e.target.value; setAutomations(a); }} className="mt-1" />
                      </div>
                      <div>
                        <Label className="text-xs">Messaggio Follow-up *</Label>
                        <Textarea value={automation.message} onChange={(e) => { const a = [...automations]; a[index].message = e.target.value; setAutomations(a); }} rows={4} className="mt-1" />
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => {
                      const lastDelay = automations.length > 0 ? automations[automations.length - 1].delayDays : 0;
                      setAutomations([...automations, { name: `Follow-up dopo ${lastDelay + 7} giorni`, description: "", delayDays: lastDelay + 7, subject: "", message: "" }]);
                    }}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" /> Aggiungi Follow-up
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Indietro
        </Button>
        {currentStep < 3 ? (
          <Button onClick={handleNext} disabled={!canProceed()} className="gap-2">
            Avanti <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSend} disabled={!canProceed()} className="gap-2">
            <Send className="h-4 w-4" /> Invia Newsletter
          </Button>
        )}
      </div>

      {/* Template Save/Edit Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplateId ? 'Modifica Template' : 'Salva Template'}</DialogTitle>
            <DialogDescription>
              {editingTemplateId ? 'Modifica i dettagli del template' : 'Salva le impostazioni correnti come nuovo template'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome Template *</Label>
              <Input placeholder="Es. Newsletter Mensile" value={templateFormData.name}
                onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrizione</Label>
              <Input placeholder="Breve descrizione" value={templateFormData.description}
                onChange={(e) => setTemplateFormData({ ...templateFormData, description: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Logo (URL)</Label>
              <Input placeholder="https://..." value={templateFormData.logo_url}
                onChange={(e) => setTemplateFormData({ ...templateFormData, logo_url: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Testo Header</Label>
              <Input placeholder="Titolo" value={templateFormData.header_text}
                onChange={(e) => setTemplateFormData({ ...templateFormData, header_text: e.target.value })} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Firma</Label>
              <Textarea placeholder={"Cordiali saluti,\nIl Team"} value={templateFormData.signature}
                onChange={(e) => setTemplateFormData({ ...templateFormData, signature: e.target.value })} rows={3} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Testo Footer</Label>
              <Input placeholder="© 2025 Azienda" value={templateFormData.footer_text}
                onChange={(e) => setTemplateFormData({ ...templateFormData, footer_text: e.target.value })} className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={templateFormData.is_default}
                onCheckedChange={(checked) => setTemplateFormData({ ...templateFormData, is_default: checked })} />
              <Label className="text-xs">Imposta come predefinito</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Annulla</Button>
            <Button onClick={saveTemplateFromWizard} disabled={savingTemplate} className="gap-1.5">
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
