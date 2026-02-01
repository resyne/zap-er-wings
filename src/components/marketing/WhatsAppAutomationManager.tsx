import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Clock, MessageCircle, Plus, Trash2, Edit, Languages, CheckCircle, XCircle, Users, Sparkles, MousePointerClick } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface WhatsAppCampaign {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  target_pipeline: string | null;
  whatsapp_account_id: string | null;
  is_active: boolean;
  require_opt_in: boolean;
  auto_select_language: boolean;
  created_at: string;
}

interface WhatsAppStep {
  id: string;
  campaign_id: string;
  step_order: number;
  template_id: string | null;
  template_name: string | null;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  is_active: boolean;
  trigger_type: string | null;
  trigger_button_text: string | null;
  trigger_from_step_id: string | null;
  template?: {
    name: string;
    language: string;
    status: string;
    components?: any[];
  };
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  status: string;
  category: string;
}

interface WhatsAppAccount {
  id: string;
  display_phone_number: string;
  verified_name: string;
  pipeline: string | null;
}

interface Execution {
  id: string;
  lead_id: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  selected_language: string | null;
  lead?: {
    contact_name: string;
    company_name: string;
    country: string;
    phone: string;
  };
}

export const WhatsAppAutomationManager = () => {
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState<WhatsAppCampaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [steps, setSteps] = useState<WhatsAppStep[]>([]);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [showStepDialog, setShowStepDialog] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<WhatsAppCampaign | null>(null);
  const [editingStep, setEditingStep] = useState<WhatsAppStep | null>(null);
  
  // Form states
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    description: "",
    trigger_type: "opt_in",
    target_pipeline: "all",
    whatsapp_account_id: "",
    require_opt_in: true,
    auto_select_language: true
  });
  
  const [stepForm, setStepForm] = useState({
    template_name: "",
    delay_days: 0,
    delay_hours: 0,
    delay_minutes: 0,
    trigger_type: "delay" as "delay" | "button_reply",
    trigger_button_text: "",
    trigger_from_step_id: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      fetchSteps(selectedCampaign);
      fetchExecutions(selectedCampaign);
    }
  }, [selectedCampaign]);

  const fetchData = async () => {
    try {
      const [campaignsRes, templatesRes, accountsRes] = await Promise.all([
        supabase.from("whatsapp_automation_campaigns").select("*").order("created_at", { ascending: false }),
        supabase.from("whatsapp_templates").select("id, name, language, status, category").eq("status", "APPROVED"),
        supabase.from("whatsapp_accounts").select("id, display_phone_number, verified_name, pipeline").eq("is_active", true)
      ]);

      if (campaignsRes.error) throw campaignsRes.error;
      if (templatesRes.error) throw templatesRes.error;
      if (accountsRes.error) throw accountsRes.error;

      setCampaigns(campaignsRes.data || []);
      setTemplates(templatesRes.data || []);
      setAccounts(accountsRes.data || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchSteps = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_automation_steps")
        .select(`
          *,
          template:whatsapp_templates(name, language, status)
        `)
        .eq("campaign_id", campaignId)
        .order("step_order", { ascending: true });

      if (error) throw error;
      setSteps(data || []);
    } catch (error) {
      console.error("Error fetching steps:", error);
    }
  };

  const fetchExecutions = async (campaignId: string) => {
    try {
      const { data, error } = await supabase
        .from("whatsapp_automation_executions")
        .select(`
          *,
          lead:leads(contact_name, company_name, country, phone)
        `)
        .eq("campaign_id", campaignId)
        .order("scheduled_for", { ascending: false })
        .limit(50);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error("Error fetching executions:", error);
    }
  };

  const saveCampaign = async () => {
    try {
      const payload = {
        name: campaignForm.name,
        description: campaignForm.description || null,
        trigger_type: campaignForm.trigger_type,
        target_pipeline: campaignForm.target_pipeline === "all" ? null : campaignForm.target_pipeline,
        whatsapp_account_id: campaignForm.whatsapp_account_id || null,
        require_opt_in: campaignForm.require_opt_in,
        auto_select_language: campaignForm.auto_select_language
      };

      if (editingCampaign) {
        const { error } = await supabase
          .from("whatsapp_automation_campaigns")
          .update(payload)
          .eq("id", editingCampaign.id);
        if (error) throw error;
        toast({ title: "Campagna aggiornata" });
      } else {
        const { error } = await supabase
          .from("whatsapp_automation_campaigns")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Campagna creata" });
      }

      setShowCampaignDialog(false);
      setEditingCampaign(null);
      resetCampaignForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving campaign:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa campagna?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_automation_campaigns")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Campagna eliminata" });
      
      if (selectedCampaign === id) {
        setSelectedCampaign(null);
        setSteps([]);
        setExecutions([]);
      }
      fetchData();
    } catch (error: any) {
      console.error("Error deleting campaign:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleCampaign = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("whatsapp_automation_campaigns")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast({
        title: "Campagna aggiornata",
        description: `Campagna ${!currentStatus ? "attivata" : "disattivata"}`,
      });
      fetchData();
    } catch (error: any) {
      console.error("Error toggling campaign:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const saveStep = async () => {
    if (!selectedCampaign || !stepForm.template_name) return;

    try {
      const nextOrder = steps.length + 1;
      
      const payload = {
        campaign_id: selectedCampaign,
        step_order: editingStep ? editingStep.step_order : nextOrder,
        template_name: stepForm.template_name,
        delay_days: stepForm.delay_days,
        delay_hours: stepForm.delay_hours,
        delay_minutes: stepForm.delay_minutes,
        trigger_type: stepForm.trigger_type,
        trigger_button_text: stepForm.trigger_type === "button_reply" ? stepForm.trigger_button_text : null,
        trigger_from_step_id: stepForm.trigger_type === "button_reply" && stepForm.trigger_from_step_id ? stepForm.trigger_from_step_id : null
      };

      if (editingStep) {
        const { error } = await supabase
          .from("whatsapp_automation_steps")
          .update(payload)
          .eq("id", editingStep.id);
        if (error) throw error;
        toast({ title: "Step aggiornato" });
      } else {
        const { error } = await supabase
          .from("whatsapp_automation_steps")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Step aggiunto" });
      }

      setShowStepDialog(false);
      setEditingStep(null);
      resetStepForm();
      fetchSteps(selectedCampaign);
    } catch (error: any) {
      console.error("Error saving step:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteStep = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo step?")) return;

    try {
      const { error } = await supabase
        .from("whatsapp_automation_steps")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Step eliminato" });
      if (selectedCampaign) {
        fetchSteps(selectedCampaign);
      }
    } catch (error: any) {
      console.error("Error deleting step:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const resetCampaignForm = () => {
    setCampaignForm({
      name: "",
      description: "",
      trigger_type: "opt_in",
      target_pipeline: "all",
      whatsapp_account_id: "",
      require_opt_in: true,
      auto_select_language: true
    });
  };

  const resetStepForm = () => {
    setStepForm({
      template_name: "",
      delay_days: 0,
      delay_hours: 0,
      delay_minutes: 0,
      trigger_type: "delay",
      trigger_button_text: "",
      trigger_from_step_id: ""
    });
  };

  const openEditCampaign = (campaign: WhatsAppCampaign) => {
    setEditingCampaign(campaign);
    setCampaignForm({
      name: campaign.name,
      description: campaign.description || "",
      trigger_type: campaign.trigger_type,
      target_pipeline: campaign.target_pipeline || "all",
      whatsapp_account_id: campaign.whatsapp_account_id || "",
      require_opt_in: campaign.require_opt_in,
      auto_select_language: campaign.auto_select_language
    });
    setShowCampaignDialog(true);
  };

  const openEditStep = (step: WhatsAppStep) => {
    setEditingStep(step);
    setStepForm({
      template_name: step.template_name || step.template?.name || "",
      delay_days: step.delay_days,
      delay_hours: step.delay_hours,
      delay_minutes: step.delay_minutes,
      trigger_type: (step.trigger_type as "delay" | "button_reply") || "delay",
      trigger_button_text: step.trigger_button_text || "",
      trigger_from_step_id: step.trigger_from_step_id || ""
    });
    setShowStepDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: "default" | "secondary" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Programmato" },
      sent: { variant: "default", label: "Inviato" },
      failed: { variant: "destructive", label: "Fallito" },
      cancelled: { variant: "secondary", label: "Annullato" }
    };
    const c = config[status] || { variant: "secondary", label: status };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header con bottone crea */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                WhatsApp Automation
              </CardTitle>
              <CardDescription>
                Crea campagne automatiche WhatsApp con selezione automatica della lingua basata sul paese del lead
              </CardDescription>
            </div>
            <Button onClick={() => { resetCampaignForm(); setShowCampaignDialog(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nuova Campagna
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Lista campagne */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {campaigns.map((campaign) => (
          <Card
            key={campaign.id}
            className={`cursor-pointer transition-all ${
              selectedCampaign === campaign.id ? "ring-2 ring-primary" : "hover:shadow-md"
            }`}
            onClick={() => setSelectedCampaign(campaign.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  {campaign.description && (
                    <p className="text-sm text-muted-foreground">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={campaign.is_active}
                    onCheckedChange={() => toggleCampaign(campaign.id, campaign.is_active)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEditCampaign(campaign)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteCampaign(campaign.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">
                  {campaign.trigger_type === "opt_in" ? "Opt-in" : campaign.trigger_type}
                </Badge>
                {campaign.target_pipeline && (
                  <Badge variant="outline">{campaign.target_pipeline}</Badge>
                )}
                <Badge variant={campaign.is_active ? "default" : "secondary"}>
                  {campaign.is_active ? "Attiva" : "Disattivata"}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {campaign.auto_select_language && (
                  <span className="flex items-center gap-1">
                    <Languages className="h-4 w-4" />
                    AI Lingua
                  </span>
                )}
                {campaign.require_opt_in && (
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    Opt-in richiesto
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Creata il {format(new Date(campaign.created_at), "dd/MM/yyyy", { locale: it })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Nessuna campagna WhatsApp. Clicca "Nuova Campagna" per iniziare.
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dettagli campagna selezionata */}
      {selectedCampaign && (
        <>
          {/* Step della campagna */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Step della Campagna</CardTitle>
                  <CardDescription>Definisci la sequenza di messaggi WhatsApp</CardDescription>
                </div>
                <Button onClick={() => { resetStepForm(); setShowStepDialog(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi Step
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nessuno step. Aggiungi il primo messaggio della sequenza.
                </p>
              ) : (
                <div className="space-y-3">
                  {steps.map((step, index) => {
                    // Get available languages for this template name
                    const templateName = step.template_name || step.template?.name;
                    const availableLanguages = templates
                      .filter(t => t.name === templateName)
                      .map(t => t.language.toUpperCase());
                    
                    // Get the trigger step info
                    const triggerStep = step.trigger_from_step_id 
                      ? steps.find(s => s.id === step.trigger_from_step_id)
                      : null;
                    const triggerStepName = triggerStep?.template_name || triggerStep?.template?.name;
                    
                    return (
                      <div
                        key={step.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                            {index + 1}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {templateName || "Template non trovato"}
                              {templateName && (
                                <Badge variant="secondary" className="text-xs">
                                  <Languages className="h-3 w-3 mr-1" />
                                  AI
                                </Badge>
                              )}
                            </div>
                            {/* Trigger info */}
                            {step.trigger_type === "button_reply" ? (
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <MousePointerClick className="h-3 w-3" />
                                <span>Su click: </span>
                                <Badge variant="outline" className="text-xs">
                                  {step.trigger_button_text}
                                </Badge>
                                {triggerStepName && (
                                  <span className="text-xs">da Step "{triggerStepName}"</span>
                                )}
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                {step.delay_days > 0 && `${step.delay_days}g `}
                                {step.delay_hours > 0 && `${step.delay_hours}h `}
                                {step.delay_minutes > 0 && `${step.delay_minutes}m`}
                                {step.delay_days === 0 && step.delay_hours === 0 && step.delay_minutes === 0 && "Immediato"}
                              </div>
                            )}
                            {availableLanguages.length > 0 && (
                              <div className="flex gap-1 mt-1">
                                {availableLanguages.map(lang => (
                                  <Badge key={lang} variant="outline" className="text-xs">
                                    {lang}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditStep(step)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteStep(step.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Esecuzioni */}
          {executions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Cronologia Invii
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {executions.map((exec) => (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">
                          {exec.lead?.contact_name || exec.lead?.company_name || "Lead"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {exec.lead?.phone}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Programmato: {format(new Date(exec.scheduled_for), "dd/MM/yyyy HH:mm", { locale: it })}
                          {exec.selected_language && (
                            <Badge variant="outline" className="text-xs">
                              {exec.selected_language.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {getStatusBadge(exec.status)}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Dialog Crea/Modifica Campagna */}
      <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? "Modifica Campagna" : "Nuova Campagna WhatsApp"}
            </DialogTitle>
            <DialogDescription>
              Configura una campagna di automazione WhatsApp con selezione automatica della lingua
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome Campagna</Label>
              <Input
                value={campaignForm.name}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Es: Follow-up lead Vesuviano"
              />
            </div>

            <div>
              <Label>Descrizione</Label>
              <Textarea
                value={campaignForm.description}
                onChange={(e) => setCampaignForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrizione opzionale..."
              />
            </div>

            <div>
              <Label>Trigger</Label>
              <Select
                value={campaignForm.trigger_type}
                onValueChange={(v) => setCampaignForm(prev => ({ ...prev, trigger_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="opt_in">Opt-in esplicito</SelectItem>
                  <SelectItem value="lead_created">Nuovo lead creato</SelectItem>
                  <SelectItem value="status_change">Cambio stato pipeline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Pipeline Target</Label>
              <Select
                value={campaignForm.target_pipeline}
                onValueChange={(v) => setCampaignForm(prev => ({ ...prev, target_pipeline: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le pipeline</SelectItem>
                  <SelectItem value="zapper">Zapper</SelectItem>
                  <SelectItem value="vesuviano">Vesuviano</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Account WhatsApp</Label>
              <Select
                value={campaignForm.whatsapp_account_id}
                onValueChange={(v) => setCampaignForm(prev => ({ ...prev, whatsapp_account_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.display_phone_number} - {acc.verified_name}
                      {acc.pipeline && ` (${acc.pipeline})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Selezione automatica lingua (AI)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Seleziona il template nella lingua del lead in base al paese
                </p>
              </div>
              <Switch
                checked={campaignForm.auto_select_language}
                onCheckedChange={(v) => setCampaignForm(prev => ({ ...prev, auto_select_language: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Richiedi Opt-in</Label>
                <p className="text-xs text-muted-foreground">
                  I lead devono dare consenso esplicito
                </p>
              </div>
              <Switch
                checked={campaignForm.require_opt_in}
                onCheckedChange={(v) => setCampaignForm(prev => ({ ...prev, require_opt_in: v }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
              Annulla
            </Button>
            <Button onClick={saveCampaign} disabled={!campaignForm.name}>
              {editingCampaign ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Aggiungi/Modifica Step */}
      <Dialog open={showStepDialog} onOpenChange={setShowStepDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingStep ? "Modifica Step" : "Aggiungi Step"}
            </DialogTitle>
            <DialogDescription>
              Seleziona un template e configura quando attivarlo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="flex items-center gap-2">
                Template WhatsApp
                <Badge variant="secondary" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI seleziona lingua
                </Badge>
              </Label>
              <Select
                value={stepForm.template_name}
                onValueChange={(v) => setStepForm(prev => ({ ...prev, template_name: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona template generico" />
                </SelectTrigger>
                <SelectContent>
                  {/* Group templates by name and show only unique names */}
                  {Array.from(new Set(templates.map(t => t.name))).map((templateName) => {
                    const templateVariants = templates.filter(t => t.name === templateName);
                    const languages = templateVariants.map(t => t.language.toUpperCase()).join(", ");
                    const category = templateVariants[0]?.category || "";
                    return (
                      <SelectItem key={templateName} value={templateName}>
                        {templateName} - {category}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({languages})
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                L'AI selezionerà automaticamente la lingua corretta in base al paese del lead
              </p>
            </div>

            {/* Trigger Type Selection */}
            <div>
              <Label>Attivazione Step</Label>
              <Select
                value={stepForm.trigger_type}
                onValueChange={(v) => setStepForm(prev => ({ 
                  ...prev, 
                  trigger_type: v as "delay" | "button_reply",
                  // Reset button fields if switching to delay
                  trigger_button_text: v === "delay" ? "" : prev.trigger_button_text,
                  trigger_from_step_id: v === "delay" ? "" : prev.trigger_from_step_id
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="delay">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Ritardo temporale
                    </div>
                  </SelectItem>
                  <SelectItem value="button_reply">
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="h-4 w-4" />
                      Click su pulsante Quick Reply
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Delay Configuration - only show for delay trigger */}
            {stepForm.trigger_type === "delay" && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Giorni</Label>
                    <Input
                      type="number"
                      min="0"
                      value={stepForm.delay_days}
                      onChange={(e) => setStepForm(prev => ({ ...prev, delay_days: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Ore</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={stepForm.delay_hours}
                      onChange={(e) => setStepForm(prev => ({ ...prev, delay_hours: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                  <div>
                    <Label>Minuti</Label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={stepForm.delay_minutes}
                      onChange={(e) => setStepForm(prev => ({ ...prev, delay_minutes: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ritardo rispetto al trigger o allo step precedente
                </p>
              </>
            )}

            {/* Button Reply Configuration - only show for button_reply trigger */}
            {stepForm.trigger_type === "button_reply" && (
              <>
                <div>
                  <Label>Step Precedente (con pulsante)</Label>
                  <Select
                    value={stepForm.trigger_from_step_id}
                    onValueChange={(v) => setStepForm(prev => ({ ...prev, trigger_from_step_id: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona lo step con il pulsante" />
                    </SelectTrigger>
                    <SelectContent>
                      {steps
                        .filter(s => editingStep ? s.id !== editingStep.id : true)
                        .map((s, idx) => (
                          <SelectItem key={s.id} value={s.id}>
                            Step {idx + 1}: {s.template_name || s.template?.name || "Template"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Seleziona quale step precedente contiene il pulsante da monitorare
                  </p>
                </div>

                <div>
                  <Label>Testo del Pulsante</Label>
                  <Input
                    value={stepForm.trigger_button_text}
                    onChange={(e) => setStepForm(prev => ({ ...prev, trigger_button_text: e.target.value }))}
                    placeholder="Es: Sì, voglio info"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Inserisci il testo esatto del pulsante Quick Reply che attiva questo step
                  </p>
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStepDialog(false)}>
              Annulla
            </Button>
            <Button 
              onClick={saveStep} 
              disabled={
                !stepForm.template_name || 
                (stepForm.trigger_type === "button_reply" && (!stepForm.trigger_button_text || !stepForm.trigger_from_step_id))
              }
            >
              {editingStep ? "Salva" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
