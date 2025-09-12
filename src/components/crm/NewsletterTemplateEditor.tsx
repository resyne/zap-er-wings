import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Image, Signature, FileText, X, Plus, Save, Eye, Star, Edit, Trash2, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

interface TemplateConfig {
  logo?: string;
  headerText: string;
  footerText: string;
  signature: string;
  attachments: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
  }>;
}

interface SavedTemplate {
  id: string;
  name: string;
  description: string;
  subject: string;
  message: string;
  logo_url?: string;
  header_text: string;
  footer_text: string;
  signature: string;
  attachments: any;
  is_default: boolean;
  created_by?: string;
  created_at: string;
}

interface NewsletterTemplateEditorProps {
  onTemplateChange: (template: TemplateConfig) => void;
  onTemplateSelect: (template: { subject: string; message: string }) => void;
}

export const NewsletterTemplateEditor = ({ onTemplateChange, onTemplateSelect }: NewsletterTemplateEditorProps) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("design");
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<SavedTemplate | null>(null);
  
  const [saveData, setSaveData] = useState({
    name: '',
    description: '',
    subject: '',
    message: ''
  });

  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: "Newsletter Aziendale",
    footerText: "© 2024 La Tua Azienda. Tutti i diritti riservati.",
    signature: "Cordiali saluti,\nIl Team Marketing",
    attachments: []
  });
  const [uploading, setUploading] = useState(false);

  const fetchSavedTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedTemplates((data || []).map(template => ({
        ...template,
        attachments: Array.isArray(template.attachments) ? template.attachments : []
      })));
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei template",
        variant: "destructive",
      });
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchSavedTemplates();
  }, []);

  const handleLogoUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    
    const file = files[0];
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      const updatedTemplate = { ...template, logo: data.publicUrl };
      setTemplate(updatedTemplate);
      onTemplateChange(updatedTemplate);

      toast({
        title: "Logo caricato",
        description: "Logo aziendale aggiornato con successo",
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento del logo",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [template, onTemplateChange, toast]);

  const handleDocumentUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `attachment-${Date.now()}-${file.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(fileName);

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: data.publicUrl,
          type: file.type
        };
      });

      const newAttachments = await Promise.all(uploadPromises);
      const updatedTemplate = {
        ...template,
        attachments: [...template.attachments, ...newAttachments]
      };
      
      setTemplate(updatedTemplate);
      onTemplateChange(updatedTemplate);

      toast({
        title: "Documenti caricati",
        description: `${newAttachments.length} documento/i aggiunto/i con successo`,
      });
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei documenti",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  }, [template, onTemplateChange, toast]);

  const removeAttachment = (attachmentId: string) => {
    const updatedTemplate = {
      ...template,
      attachments: template.attachments.filter(att => att.id !== attachmentId)
    };
    setTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
  };

  const updateTemplate = (field: keyof TemplateConfig, value: any) => {
    const updatedTemplate = { ...template, [field]: value };
    setTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
  };

  const removeLogo = () => {
    const updatedTemplate = { ...template, logo: undefined };
    setTemplate(updatedTemplate);
    onTemplateChange(updatedTemplate);
  };

  const handleSaveTemplate = async () => {
    if (!saveData.name || !saveData.subject || !saveData.message) {
      toast({
        title: "Errore",
        description: "Compila tutti i campi obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .insert({
          name: saveData.name,
          description: saveData.description,
          subject: saveData.subject,
          message: saveData.message,
          logo_url: template.logo,
          header_text: template.headerText,
          footer_text: template.footerText,
          signature: template.signature,
          attachments: template.attachments,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setSavedTemplates(prev => [{
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : []
      }, ...prev]);
      setSaveData({ name: '', description: '', subject: '', message: '' });
      setSaveDialogOpen(false);

      toast({
        title: "Template salvato",
        description: "Il template è stato salvato con successo",
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio del template",
        variant: "destructive",
      });
    }
  };

  const loadTemplate = (savedTemplate: SavedTemplate) => {
    setSelectedTemplate(savedTemplate);
    
    const newTemplate: TemplateConfig = {
      logo: savedTemplate.logo_url,
      headerText: savedTemplate.header_text,
      footerText: savedTemplate.footer_text,
      signature: savedTemplate.signature,
      attachments: Array.isArray(savedTemplate.attachments) ? savedTemplate.attachments : []
    };
    
    setTemplate(newTemplate);
    onTemplateChange(newTemplate);
    onTemplateSelect({
      subject: savedTemplate.subject,
      message: savedTemplate.message
    });

    setActiveTab("design");

    toast({
      title: "Template caricato",
      description: `Template "${savedTemplate.name}" caricato con successo`,
    });
  };

  const duplicateTemplate = async (templateToDuplicate: SavedTemplate) => {
    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .insert({
          name: `${templateToDuplicate.name} (Copia)`,
          description: templateToDuplicate.description,
          subject: templateToDuplicate.subject,
          message: templateToDuplicate.message,
          logo_url: templateToDuplicate.logo_url,
          header_text: templateToDuplicate.header_text,
          footer_text: templateToDuplicate.footer_text,
          signature: templateToDuplicate.signature,
          attachments: templateToDuplicate.attachments,
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      setSavedTemplates(prev => [{
        ...data,
        attachments: Array.isArray(data.attachments) ? data.attachments : []
      }, ...prev]);

      toast({
        title: "Template duplicato",
        description: "Il template è stato duplicato con successo",
      });
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Errore",
        description: "Errore nella duplicazione del template",
        variant: "destructive",
      });
    }
  };

  const deleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('newsletter_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setSavedTemplates(prev => prev.filter(t => t.id !== templateId));

      toast({
        title: "Template eliminato",
        description: "Il template è stato eliminato con successo",
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del template",
        variant: "destructive",
      });
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📎';
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="design" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Design Template
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Template Salvati
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="space-y-6">
          {/* Save Template Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Save className="h-5 w-5" />
                    Salva Template
                  </CardTitle>
                  <CardDescription>
                    Salva il design corrente come nuovo template riutilizzabile
                  </CardDescription>
                </div>
                <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Save className="h-4 w-4 mr-2" />
                      Salva come Template
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Salva Nuovo Template</DialogTitle>
                      <DialogDescription>
                        Salva il design corrente come template riutilizzabile per le tue newsletter
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">Nome Template*</label>
                          <Input
                            placeholder="Es. Newsletter Natalizia"
                            value={saveData.name}
                            onChange={(e) => setSaveData(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium">Descrizione</label>
                          <Input
                            placeholder="Breve descrizione del template"
                            value={saveData.description}
                            onChange={(e) => setSaveData(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">Oggetto Email*</label>
                        <Input
                          placeholder="Oggetto della newsletter"
                          value={saveData.subject}
                          onChange={(e) => setSaveData(prev => ({ ...prev, subject: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Messaggio*</label>
                        <Textarea
                          placeholder="Contenuto del messaggio della newsletter"
                          value={saveData.message}
                          onChange={(e) => setSaveData(prev => ({ ...prev, message: e.target.value }))}
                          rows={8}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                        Annulla
                      </Button>
                      <Button onClick={handleSaveTemplate}>
                        <Save className="h-4 w-4 mr-2" />
                        Salva Template
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground">
                <p>Dopo aver personalizzato il design del template qui sotto, usa il pulsante "Salva come Template" per renderlo riutilizzabile.</p>
                <p className="mt-1">Il template includerà automaticamente tutte le impostazioni di design correnti.</p>
              </div>
            </CardContent>
          </Card>

          {/* Logo Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Logo Aziendale
              </CardTitle>
              <CardDescription>
                Aggiungi il logo della tua azienda all'intestazione della newsletter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {template.logo ? (
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <img 
                    src={template.logo} 
                    alt="Logo aziendale" 
                    className="h-16 w-auto object-contain border rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Logo caricato</p>
                    <p className="text-sm text-muted-foreground">Logo aziendale attivo</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={removeLogo}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center p-8 border-2 border-dashed rounded-lg">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm font-medium">Carica logo aziendale</p>
                    <p className="text-xs text-muted-foreground">PNG, JPG fino a 5MB</p>
                  </div>
                  <FileUpload
                    onChange={handleLogoUpload}
                    maxFiles={1}
                    acceptedFileTypes={["image/jpeg", "image/png", "image/webp"]}
                    className="w-full"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Header and Footer */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Intestazione e Piè di Pagina
              </CardTitle>
              <CardDescription>
                Personalizza l'intestazione e il piè di pagina della newsletter
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Testo Intestazione</label>
                <Input
                  placeholder="Intestazione della newsletter..."
                  value={template.headerText}
                  onChange={(e) => updateTemplate('headerText', e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Testo Piè di Pagina</label>
                <Textarea
                  placeholder="Piè di pagina della newsletter..."
                  value={template.footerText}
                  onChange={(e) => updateTemplate('footerText', e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Signature className="h-5 w-5" />
                Firma Email
              </CardTitle>
              <CardDescription>
                Aggiungi una firma personalizzata alle tue newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <label className="text-sm font-medium">Firma</label>
                <Textarea
                  placeholder="La tua firma email..."
                  value={template.signature}
                  onChange={(e) => updateTemplate('signature', e.target.value)}
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Allegati
                {selectedTemplate && (
                  <Badge variant="outline" className="ml-2">
                    Template: {selectedTemplate.name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Aggiungi documenti come allegati alla newsletter
                {selectedTemplate && " (puoi aggiungere allegati anche ai template salvati)"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="text-center p-6 border-2 border-dashed rounded-lg hover:border-primary/50 transition-colors">
                  <Plus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Aggiungi allegati</p>
                  <p className="text-xs text-muted-foreground">PDF, DOC, XLS, IMG fino a 10MB</p>
                  {uploading && <p className="text-xs text-primary mt-1">Caricamento in corso...</p>}
                </div>
                <FileUpload
                  onChange={handleDocumentUpload}
                  maxFiles={5}
                  acceptedFileTypes={["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/jpeg", "image/png"]}
                  className="w-full"
                />
              </div>

              {template.attachments.length > 0 && (
                <div className="space-y-2">
                  <Separator />
                  <p className="text-sm font-medium">Allegati ({template.attachments.length})</p>
                  <div className="space-y-2">
                    {template.attachments.map((attachment) => (
                      <div key={attachment.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <span className="text-lg">{getFileIcon(attachment.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{attachment.name}</p>
                          <Badge variant="secondary" className="text-xs">
                            {attachment.type}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeAttachment(attachment.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Template Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Anteprima Template</CardTitle>
              <CardDescription>
                Visualizza come apparirà il template nella newsletter
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg p-6 bg-background space-y-4">
                {template.logo && (
                  <div className="text-center">
                    <img 
                      src={template.logo} 
                      alt="Logo" 
                      className="h-12 w-auto mx-auto"
                    />
                  </div>
                )}
                
                <div className="text-center">
                  <h2 className="text-xl font-bold">{template.headerText}</h2>
                </div>
                
                <Separator />
                
                <div className="bg-muted/30 p-4 rounded border-l-4 border-primary">
                  <p className="text-sm text-muted-foreground mb-2">Contenuto Newsletter</p>
                  <p>Il contenuto della tua newsletter apparirà qui...</p>
                </div>
                
                {template.attachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Allegati:</p>
                    <div className="flex flex-wrap gap-2">
                      {template.attachments.map((attachment) => (
                        <Badge key={attachment.id} variant="outline" className="flex items-center gap-1">
                          <span>{getFileIcon(attachment.type)}</span>
                          {attachment.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                
                <div className="whitespace-pre-line text-sm">
                  {template.signature}
                </div>
                
                <Separator />
                
                <div className="text-center text-xs text-muted-foreground">
                  {template.footerText}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Salvati</CardTitle>
              <CardDescription>
                Seleziona un template esistente da utilizzare
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingTemplates ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-2 text-muted-foreground">Caricamento template...</p>
                </div>
              ) : savedTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nessun template salvato</p>
                  <p className="text-sm text-muted-foreground">Vai alla tab "Design Template" per creare il tuo primo template</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedTemplates.map((savedTemplate) => (
                    <Card 
                      key={savedTemplate.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedTemplate?.id === savedTemplate.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {savedTemplate.is_default && (
                                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                              )}
                              {savedTemplate.name}
                            </CardTitle>
                            {savedTemplate.description && (
                              <CardDescription className="text-xs mt-1">
                                {savedTemplate.description}
                              </CardDescription>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Oggetto:</p>
                          <p className="text-sm truncate">{savedTemplate.subject}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Messaggio:</p>
                          <p className="text-sm text-muted-foreground line-clamp-3">
                            {savedTemplate.message.substring(0, 100)}...
                          </p>
                        </div>
                        <div className="flex items-center gap-1 pt-2">
                          <Button
                            size="sm"
                            onClick={() => loadTemplate(savedTemplate)}
                            className="flex-1"
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Usa
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPreviewTemplate(savedTemplate);
                              setPreviewDialogOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => duplicateTemplate(savedTemplate)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          {!savedTemplate.is_default && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => deleteTemplate(savedTemplate.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Template Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
            <DialogDescription>{previewTemplate?.description}</DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Oggetto:</p>
                <p className="text-sm bg-muted p-2 rounded">{previewTemplate.subject}</p>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Messaggio:</p>
                <div className="text-sm bg-muted p-4 rounded whitespace-pre-wrap">
                  {previewTemplate.message}
                </div>
              </div>
              <div className="border rounded-lg p-4 bg-background">
                <div className="space-y-4">
                  {previewTemplate.logo_url && (
                    <div className="text-center">
                      <img 
                        src={previewTemplate.logo_url} 
                        alt="Logo" 
                        className="h-12 w-auto mx-auto"
                      />
                    </div>
                  )}
                  <div className="text-center">
                    <h3 className="text-lg font-bold">{previewTemplate.header_text}</h3>
                  </div>
                  <Separator />
                  <div className="whitespace-pre-line text-sm">
                    {previewTemplate.signature}
                  </div>
                  <Separator />
                  <div className="text-center text-xs text-muted-foreground">
                    {previewTemplate.footer_text}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};