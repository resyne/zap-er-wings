import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Plus, 
  Play, 
  Pause, 
  Trash2, 
  Edit, 
  Mail, 
  Clock, 
  Users, 
  FileText,
  Eye,
  Upload,
  ArrowRight,
  Target,
  Zap,
  Settings,
  Globe
} from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  target_pipeline: string | null;
  is_active: boolean;
  created_at: string;
  sender_email: string | null;
  sender_name: string | null;
  steps?: CampaignStep[];
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  subject: string;
  html_content: string;
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  is_active: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  html_content: string;
  created_at: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isStepDialogOpen, setIsStepDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isEditStepDialogOpen, setIsEditStepDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewStepId, setPreviewStepId] = useState<string | null>(null);
  const [previewLanguage, setPreviewLanguage] = useState("default");
  const [previewSubject, setPreviewSubject] = useState("");
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [activeTab, setActiveTab] = useState("campaigns");

  const [newCampaign, setNewCampaign] = useState({
    name: "",
    description: "",
    trigger_type: "new_lead",
    target_pipeline: "",
    sender_email: "noreply@abbattitorizapper.it",
    sender_name: "Vesuviano Forni"
  });

  const [newStep, setNewStep] = useState({
    subject: "",
    html_content: "",
    delay_days: 0,
    delay_hours: 0,
    delay_minutes: 0
  });

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    html_content: ""
  });

  useEffect(() => {
    fetchCampaigns();
    fetchTemplates();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data: campaignsData, error: campaignsError } = await supabase
        .from("lead_automation_campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (campaignsError) throw campaignsError;

      // Fetch steps for each campaign
      const campaignsWithSteps = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: steps } = await supabase
            .from("lead_automation_steps")
            .select("*")
            .eq("campaign_id", campaign.id)
            .order("step_order", { ascending: true });
          return { ...campaign, steps: steps || [] };
        })
      );

      setCampaigns(campaignsWithSteps);
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      toast.error("Errore nel caricamento delle campagne");
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_automation_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  };

  const handleCreateCampaign = async () => {
    if (!newCampaign.name) {
      toast.error("Inserisci un nome per la campagna");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("lead_automation_campaigns")
        .insert({
          name: newCampaign.name,
          description: newCampaign.description || null,
          trigger_type: newCampaign.trigger_type,
          target_pipeline: newCampaign.target_pipeline === "all" ? null : (newCampaign.target_pipeline || null),
          sender_email: newCampaign.sender_email || "noreply@abbattitorizapper.it",
          sender_name: newCampaign.sender_name || "Vesuviano Forni"
        })
        .select()
        .single();

      if (error) throw error;

      setCampaigns([{ ...data, steps: [] }, ...campaigns]);
      setIsCreateDialogOpen(false);
      setNewCampaign({ 
        name: "", 
        description: "", 
        trigger_type: "new_lead", 
        target_pipeline: "",
        sender_email: "noreply@abbattitorizapper.it",
        sender_name: "Vesuviano Forni"
      });
      toast.success("Campagna creata con successo");
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("Errore nella creazione della campagna");
    }
  };

  const handleAddStep = async () => {
    if (!selectedCampaign || !newStep.subject || !newStep.html_content) {
      toast.error("Compila tutti i campi obbligatori");
      return;
    }

    try {
      const stepOrder = (selectedCampaign.steps?.length || 0) + 1;
      const { data, error } = await supabase
        .from("lead_automation_steps")
        .insert({
          campaign_id: selectedCampaign.id,
          step_order: stepOrder,
          subject: newStep.subject,
          html_content: newStep.html_content,
          delay_days: newStep.delay_days,
          delay_hours: newStep.delay_hours,
          delay_minutes: newStep.delay_minutes
        })
        .select()
        .single();

      if (error) throw error;

      // Update local state
      const updatedCampaign = {
        ...selectedCampaign,
        steps: [...(selectedCampaign.steps || []), data]
      };
      setSelectedCampaign(updatedCampaign);
      setCampaigns(campaigns.map(c => c.id === selectedCampaign.id ? updatedCampaign : c));
      
      setIsStepDialogOpen(false);
      setNewStep({ subject: "", html_content: "", delay_days: 0, delay_hours: 0, delay_minutes: 0 });
      toast.success("Step aggiunto con successo");
    } catch (error) {
      console.error("Error adding step:", error);
      toast.error("Errore nell'aggiunta dello step");
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplate.name || !newTemplate.html_content) {
      toast.error("Inserisci nome e contenuto del template");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("lead_automation_templates")
        .insert({
          name: newTemplate.name,
          description: newTemplate.description || null,
          html_content: newTemplate.html_content
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates([data, ...templates]);
      setIsTemplateDialogOpen(false);
      setNewTemplate({ name: "", description: "", html_content: "" });
      toast.success("Template salvato con successo");
    } catch (error) {
      console.error("Error saving template:", error);
      toast.error("Errore nel salvataggio del template");
    }
  };

  const handleToggleCampaign = async (campaign: Campaign) => {
    try {
      const { error } = await supabase
        .from("lead_automation_campaigns")
        .update({ is_active: !campaign.is_active })
        .eq("id", campaign.id);

      if (error) throw error;

      setCampaigns(campaigns.map(c => 
        c.id === campaign.id ? { ...c, is_active: !c.is_active } : c
      ));
      toast.success(campaign.is_active ? "Campagna disattivata" : "Campagna attivata");
    } catch (error) {
      console.error("Error toggling campaign:", error);
      toast.error("Errore nell'aggiornamento della campagna");
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa campagna?")) return;

    try {
      const { error } = await supabase
        .from("lead_automation_campaigns")
        .delete()
        .eq("id", campaignId);

      if (error) throw error;

      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
      }
      toast.success("Campagna eliminata");
    } catch (error) {
      console.error("Error deleting campaign:", error);
      toast.error("Errore nell'eliminazione della campagna");
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedCampaign) return;

    try {
      const { error } = await supabase
        .from("lead_automation_steps")
        .delete()
        .eq("id", stepId);

      if (error) throw error;

      const updatedSteps = selectedCampaign.steps?.filter(s => s.id !== stepId) || [];
      const updatedCampaign = { ...selectedCampaign, steps: updatedSteps };
      setSelectedCampaign(updatedCampaign);
      setCampaigns(campaigns.map(c => c.id === selectedCampaign.id ? updatedCampaign : c));
      toast.success("Step eliminato");
    } catch (error) {
      console.error("Error deleting step:", error);
      toast.error("Errore nell'eliminazione dello step");
    }
  };

  const handleEditStep = (step: CampaignStep) => {
    setEditingStep(step);
    setIsEditStepDialogOpen(true);
  };

  const handleUpdateStep = async () => {
    if (!editingStep || !selectedCampaign) return;

    try {
      const { error } = await supabase
        .from("lead_automation_steps")
        .update({
          subject: editingStep.subject,
          html_content: editingStep.html_content,
          delay_days: editingStep.delay_days,
          delay_hours: editingStep.delay_hours,
          delay_minutes: editingStep.delay_minutes
        })
        .eq("id", editingStep.id);

      if (error) throw error;

      // Update local state
      const updatedSteps = selectedCampaign.steps?.map(s => 
        s.id === editingStep.id ? editingStep : s
      ) || [];
      const updatedCampaign = { ...selectedCampaign, steps: updatedSteps };
      setSelectedCampaign(updatedCampaign);
      setCampaigns(campaigns.map(c => c.id === selectedCampaign.id ? updatedCampaign : c));

      setIsEditStepDialogOpen(false);
      setEditingStep(null);
      toast.success("Step aggiornato con successo");
    } catch (error) {
      console.error("Error updating step:", error);
      toast.error("Errore nell'aggiornamento dello step");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo template?")) return;

    try {
      const { error } = await supabase
        .from("lead_automation_templates")
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      setTemplates(templates.filter(t => t.id !== templateId));
      toast.success("Template eliminato");
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Errore nell'eliminazione del template");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>, target: 'step' | 'template') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (target === 'step') {
        setNewStep({ ...newStep, html_content: content });
      } else {
        setNewTemplate({ ...newTemplate, html_content: content });
      }
    };
    reader.readAsText(file);
  };

  const getTotalDelay = (step: CampaignStep) => {
    const parts = [];
    if (step.delay_days > 0) parts.push(`${step.delay_days}g`);
    if (step.delay_hours > 0) parts.push(`${step.delay_hours}h`);
    if (step.delay_minutes > 0) parts.push(`${step.delay_minutes}m`);
    return parts.length > 0 ? parts.join(" ") : "Immediato";
  };

  const processHtmlWithPlaceholders = (html: string) => {
    return html
      .replace(/\{\{nome\}\}/gi, "Mario")
      .replace(/\{\{cognome\}\}/gi, "Rossi")
      .replace(/\{\{email\}\}/gi, "mario.rossi@example.com")
      .replace(/\{\{telefono\}\}/gi, "+39 123 456 7890")
      .replace(/\{\{azienda\}\}/gi, "Esempio S.r.l.")
      .replace(/\{\{linkconfiguratore\}\}/gi, "https://example.com/configuratore/ABC123");
  };

  const loadTranslation = async (stepId: string, language: string) => {
    if (language === "default") {
      // Load default from step
      const step = selectedCampaign?.steps?.find(s => s.id === stepId);
      if (step) {
        setPreviewHtml(step.html_content);
        setPreviewSubject(step.subject);
      }
      return;
    }

    setLoadingTranslation(true);
    try {
      // First check if translation exists in database
      const { data, error } = await supabase
        .from("lead_automation_step_translations")
        .select("subject, html_content")
        .eq("step_id", stepId)
        .eq("language_code", language)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreviewHtml(data.html_content);
        setPreviewSubject(data.subject);
      } else {
        // No translation found - generate one using AI
        const step = selectedCampaign?.steps?.find(s => s.id === stepId);
        if (step) {
          toast.info("Generazione traduzione in corso con AI...");
          
          const { data: translationData, error: translationError } = await supabase.functions.invoke(
            'translate-email-content',
            {
              body: {
                step_id: stepId,
                subject: step.subject,
                html_content: step.html_content,
                target_language: language
              }
            }
          );

          if (translationError) {
            console.error("Translation error:", translationError);
            toast.error("Errore nella traduzione automatica");
            setPreviewHtml(step.html_content);
            setPreviewSubject(step.subject);
          } else if (translationData?.error) {
            console.error("Translation API error:", translationData.error);
            toast.error(translationData.error);
            setPreviewHtml(step.html_content);
            setPreviewSubject(step.subject);
          } else {
            setPreviewHtml(translationData.translated_html);
            setPreviewSubject(translationData.translated_subject);
            toast.success("Traduzione generata e salvata!");
          }
        }
      }
    } catch (error) {
      console.error("Error loading translation:", error);
      toast.error("Errore nel caricamento della traduzione");
    } finally {
      setLoadingTranslation(false);
    }
  };

  const handleOpenPreview = (step: CampaignStep) => {
    setPreviewStepId(step.id);
    setPreviewHtml(step.html_content);
    setPreviewSubject(step.subject);
    setPreviewLanguage("default");
    setIsPreviewDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Campagne Email Automation</h1>
          <p className="text-muted-foreground">
            Crea sequenze email automatiche per i nuovi lead
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsTemplateDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Nuovo Template
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuova Campagna
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="campaigns">
            <Zap className="h-4 w-4 mr-2" />
            Campagne
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="h-4 w-4 mr-2" />
            Template HTML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Campaign List */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="font-semibold text-lg">Le tue campagne</h3>
              {campaigns.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Target className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Nessuna campagna creata
                    </p>
                    <Button className="mt-4" onClick={() => setIsCreateDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Crea prima campagna
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-3 pr-4">
                    {campaigns.map((campaign) => (
                      <Card
                        key={campaign.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedCampaign?.id === campaign.id ? "ring-2 ring-primary" : ""
                        }`}
                        onClick={() => setSelectedCampaign(campaign)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{campaign.name}</h4>
                                <Badge variant={campaign.is_active ? "default" : "secondary"}>
                                  {campaign.is_active ? "Attiva" : "Inattiva"}
                                </Badge>
                              </div>
                              {campaign.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {campaign.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Mail className="h-3 w-3" />
                                  {campaign.steps?.length || 0} email
                                </span>
                                {campaign.target_pipeline && (
                                  <span className="flex items-center gap-1">
                                    <Target className="h-3 w-3" />
                                    {campaign.target_pipeline}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleToggleCampaign(campaign);
                                }}
                              >
                                {campaign.is_active ? (
                                  <Pause className="h-4 w-4" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteCampaign(campaign.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>

            {/* Campaign Details */}
            <div className="lg:col-span-2">
              {selectedCampaign ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedCampaign.name}</CardTitle>
                        <CardDescription>
                          {selectedCampaign.description || "Nessuna descrizione"}
                        </CardDescription>
                      </div>
                      <Button onClick={() => setIsStepDialogOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Aggiungi Email
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4 p-4 bg-muted/50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Trigger:</span>{" "}
                          <Badge variant="outline">
                            {selectedCampaign.trigger_type === "new_lead" ? "Nuovo Lead" : selectedCampaign.trigger_type}
                          </Badge>
                        </div>
                        {selectedCampaign.target_pipeline && (
                          <div>
                            <span className="text-muted-foreground">Pipeline:</span>{" "}
                            <Badge variant="outline">{selectedCampaign.target_pipeline}</Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    <h4 className="font-semibold mb-4">Sequenza Email</h4>
                    
                    {selectedCampaign.steps && selectedCampaign.steps.length > 0 ? (
                      <div className="space-y-4">
                        {selectedCampaign.steps.map((step, index) => (
                          <div key={step.id} className="relative">
                            {index > 0 && (
                              <div className="absolute left-6 -top-4 h-4 w-0.5 bg-border" />
                            )}
                            <div className="flex items-start gap-4 p-4 border rounded-lg">
                              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="font-bold text-primary">{index + 1}</span>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Clock className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm text-muted-foreground">
                                    {index === 0 ? "Subito" : `Dopo ${getTotalDelay(step)}`}
                                  </span>
                                </div>
                                <h5 className="font-medium">{step.subject}</h5>
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenPreview(step)}
                                  >
                                    <Eye className="h-3 w-3 mr-1" />
                                    Preview
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditStep(step)}
                                  >
                                    <Edit className="h-3 w-3 mr-1" />
                                    Modifica
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteStep(step.id)}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                            {index < (selectedCampaign.steps?.length || 0) - 1 && (
                              <div className="flex justify-center my-2">
                                <ArrowRight className="h-4 w-4 text-muted-foreground rotate-90" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nessuna email nella sequenza</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setIsStepDialogOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Aggiungi prima email
                        </Button>
                      </div>
                    )}

                    <Separator className="my-6" />

                    <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Placeholder disponibili</h5>
                      <p className="text-sm text-muted-foreground mb-2">
                        Usa questi placeholder nel tuo HTML per personalizzare le email:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["{{nome}}", "{{cognome}}", "{{email}}", "{{telefono}}", "{{azienda}}"].map((ph) => (
                          <code key={ph} className="px-2 py-1 bg-background rounded text-sm">
                            {ph}
                          </code>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-24">
                    <Settings className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Seleziona una campagna</h3>
                    <p className="text-muted-foreground text-center">
                      Seleziona una campagna dalla lista per visualizzare e modificare la sequenza email
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground text-center">
                    Nessun template salvato
                  </p>
                  <Button className="mt-4" onClick={() => setIsTemplateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Crea primo template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              templates.map((template) => (
                <Card key={template.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.description && (
                          <CardDescription>{template.description}</CardDescription>
                        )}
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setPreviewHtml(template.html_content);
                        setIsPreviewDialogOpen(true);
                      }}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Anteprima
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Nuova Campagna</DialogTitle>
            <DialogDescription>
              Crea una nuova campagna di email automation per i tuoi lead
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome campagna *</Label>
              <Input
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                placeholder="Es. Benvenuto nuovo lead"
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Textarea
                value={newCampaign.description}
                onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                placeholder="Descrizione opzionale della campagna"
              />
            </div>
            <div>
              <Label>Trigger</Label>
              <Select
                value={newCampaign.trigger_type}
                onValueChange={(v) => setNewCampaign({ ...newCampaign, trigger_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_lead">Nuovo Lead</SelectItem>
                  <SelectItem value="lead_status_change">Cambio stato lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pipeline target (opzionale)</Label>
              <Select
                value={newCampaign.target_pipeline}
                onValueChange={(v) => setNewCampaign({ ...newCampaign, target_pipeline: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tutte le pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutte le pipeline</SelectItem>
                  <SelectItem value="Zapper">Zapper</SelectItem>
                  <SelectItem value="Vesuviano">Vesuviano</SelectItem>
                  <SelectItem value="Zapper Pro">Zapper Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Configurazione Mittente
              </h4>
              <div>
                <Label>Nome mittente</Label>
                <Input
                  value={newCampaign.sender_name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, sender_name: e.target.value })}
                  placeholder="Es. Vesuviano Forni"
                />
              </div>
              <div>
                <Label>Email mittente</Label>
                <Input
                  type="email"
                  value={newCampaign.sender_email}
                  onChange={(e) => setNewCampaign({ ...newCampaign, sender_email: e.target.value })}
                  placeholder="Es. noreply@abbattitorizapper.it"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  L'email deve essere verificata su Resend
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleCreateCampaign}>Crea Campagna</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Step Dialog */}
      <Dialog open={isStepDialogOpen} onOpenChange={setIsStepDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Aggiungi Email alla Sequenza</DialogTitle>
            <DialogDescription>
              Configura il contenuto e il timing di questa email
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Oggetto email *</Label>
              <Input
                value={newStep.subject}
                onChange={(e) => setNewStep({ ...newStep, subject: e.target.value })}
                placeholder="Es. Benvenuto in Zapper!"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Giorni di attesa</Label>
                <Input
                  type="number"
                  min="0"
                  value={newStep.delay_days}
                  onChange={(e) => setNewStep({ ...newStep, delay_days: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Ore di attesa</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={newStep.delay_hours}
                  onChange={(e) => setNewStep({ ...newStep, delay_hours: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Minuti di attesa</Label>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={newStep.delay_minutes}
                  onChange={(e) => setNewStep({ ...newStep, delay_minutes: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Contenuto HTML *</Label>
                <div className="flex gap-2">
                  <Select
                    onValueChange={(templateId) => {
                      const template = templates.find(t => t.id === templateId);
                      if (template) {
                        setNewStep({ ...newStep, html_content: template.html_content });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Usa template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Carica HTML
                      <input
                        type="file"
                        accept=".html,.htm"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e, 'step')}
                      />
                    </label>
                  </Button>
                </div>
              </div>
              <Textarea
                value={newStep.html_content}
                onChange={(e) => setNewStep({ ...newStep, html_content: e.target.value })}
                placeholder="<html>...</html>"
                className="font-mono text-sm h-48"
              />
            </div>

            {newStep.html_content && (
              <div>
                <Label>Anteprima</Label>
                <div className="border rounded-lg p-4 bg-background mt-2 max-h-64 overflow-auto">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: processHtmlWithPlaceholders(newStep.html_content) 
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStepDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAddStep}>Aggiungi Email</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo Template HTML</DialogTitle>
            <DialogDescription>
              Salva un template riutilizzabile per le tue campagne
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome template *</Label>
              <Input
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                placeholder="Es. Template benvenuto"
              />
            </div>
            <div>
              <Label>Descrizione</Label>
              <Input
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                placeholder="Descrizione opzionale"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Contenuto HTML *</Label>
                <Button variant="outline" size="sm" asChild>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4 mr-2" />
                    Carica file HTML
                    <input
                      type="file"
                      accept=".html,.htm"
                      className="hidden"
                      onChange={(e) => handleFileUpload(e, 'template')}
                    />
                  </label>
                </Button>
              </div>
              <Textarea
                value={newTemplate.html_content}
                onChange={(e) => setNewTemplate({ ...newTemplate, html_content: e.target.value })}
                placeholder="<html>...</html>"
                className="font-mono text-sm h-48"
              />
            </div>

            {newTemplate.html_content && (
              <div>
                <Label>Anteprima</Label>
                <div className="border rounded-lg p-4 bg-background mt-2 max-h-64 overflow-auto">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: processHtmlWithPlaceholders(newTemplate.html_content) 
                    }} 
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleSaveTemplate}>Salva Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={(open) => {
        setIsPreviewDialogOpen(open);
        if (!open) {
          setPreviewStepId(null);
          setPreviewLanguage("default");
        }
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Anteprima Email</span>
              {previewStepId && (
                <Select
                  value={previewLanguage}
                  onValueChange={(lang) => {
                    setPreviewLanguage(lang);
                    if (previewStepId) {
                      loadTranslation(previewStepId, lang);
                    }
                  }}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Lingua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">🇮🇹 Italiano (Default)</SelectItem>
                    <SelectItem value="en">🇬🇧 English</SelectItem>
                    <SelectItem value="es">🇪🇸 Español</SelectItem>
                    <SelectItem value="fr">🇫🇷 Français</SelectItem>
                    <SelectItem value="de">🇩🇪 Deutsch</SelectItem>
                    <SelectItem value="pt">🇵🇹 Português</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </DialogTitle>
            <DialogDescription>
              {previewSubject && (
                <div className="mt-2">
                  <strong>Oggetto:</strong> {previewSubject}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                I placeholder sono sostituiti con dati di esempio
              </div>
            </DialogDescription>
          </DialogHeader>
          {loadingTranslation ? (
            <div className="flex items-center justify-center h-[500px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-[500px] border rounded-lg p-4 bg-background">
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: processHtmlWithPlaceholders(previewHtml) 
                }} 
              />
            </ScrollArea>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Chiudi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Step Dialog */}
      <Dialog open={isEditStepDialogOpen} onOpenChange={setIsEditStepDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Email</DialogTitle>
            <DialogDescription>
              Modifica il contenuto e le impostazioni di questo step
            </DialogDescription>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div>
                <Label>Oggetto email *</Label>
                <Input
                  value={editingStep.subject}
                  onChange={(e) => setEditingStep({ ...editingStep, subject: e.target.value })}
                  placeholder="Es. Benvenuto in Zapper!"
                />
              </div>

              <div>
                <Label>Ritardo invio</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">Giorni</Label>
                    <Input
                      type="number"
                      min="0"
                      value={editingStep.delay_days}
                      onChange={(e) => setEditingStep({ ...editingStep, delay_days: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Ore</Label>
                    <Input
                      type="number"
                      min="0"
                      max="23"
                      value={editingStep.delay_hours}
                      onChange={(e) => setEditingStep({ ...editingStep, delay_hours: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Minuti</Label>
                    <Input
                      type="number"
                      min="0"
                      max="59"
                      value={editingStep.delay_minutes}
                      onChange={(e) => setEditingStep({ ...editingStep, delay_minutes: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Contenuto HTML *</Label>
                  <Button variant="outline" size="sm" asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      Carica file HTML
                      <input
                        type="file"
                        accept=".html,.htm"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              const content = ev.target?.result as string;
                              setEditingStep({ ...editingStep, html_content: content });
                            };
                            reader.readAsText(file);
                          }
                        }}
                      />
                    </label>
                  </Button>
                </div>
                <Textarea
                  value={editingStep.html_content}
                  onChange={(e) => setEditingStep({ ...editingStep, html_content: e.target.value })}
                  placeholder="<html>...</html>"
                  className="font-mono text-sm h-48"
                />
              </div>

              {editingStep.html_content && (
                <div>
                  <Label>Anteprima</Label>
                  <div className="border rounded-lg p-4 bg-background mt-2 max-h-64 overflow-auto">
                    <div 
                      dangerouslySetInnerHTML={{ 
                        __html: processHtmlWithPlaceholders(editingStep.html_content) 
                      }} 
                    />
                  </div>
                </div>
              )}

              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  <strong>Placeholder:</strong> {`{{nome}}, {{cognome}}, {{email}}, {{telefono}}, {{azienda}}`}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditStepDialogOpen(false);
              setEditingStep(null);
            }}>
              Annulla
            </Button>
            <Button onClick={handleUpdateStep}>Salva Modifiche</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
