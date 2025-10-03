import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit, Trash2, Star, Copy, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";

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
  is_default: boolean;
  created_at: string;
}

export const NewsletterTemplateManager = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SavedTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<SavedTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    subject: '',
    message: '',
    logo_url: '',
    header_text: '',
    footer_text: '',
    signature: '',
    is_default: false
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('newsletter_templates')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i template",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      subject: '',
      message: '',
      logo_url: '',
      header_text: '',
      footer_text: '',
      signature: '',
      is_default: false
    });
    setEditingTemplate(null);
  };

  const handleOpenDialog = (template?: SavedTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        description: template.description || '',
        subject: template.subject,
        message: template.message,
        logo_url: template.logo_url || '',
        header_text: template.header_text,
        footer_text: template.footer_text,
        signature: template.signature,
        is_default: template.is_default
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const handleSave = async () => {
    if (!formData.name || !formData.signature) {
      toast({
        title: "Errore",
        description: "Nome e firma sono obbligatori",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (editingTemplate) {
        // Update existing template
        const { error } = await supabase
          .from('newsletter_templates')
          .update({
            name: formData.name,
            description: formData.description,
            subject: formData.subject,
            message: formData.message,
            logo_url: formData.logo_url || null,
            header_text: formData.header_text,
            footer_text: formData.footer_text,
            signature: formData.signature,
            is_default: formData.is_default
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;

        toast({
          title: "Template aggiornato",
          description: "Il template è stato aggiornato con successo",
        });
      } else {
        // Create new template
        const { error } = await supabase
          .from('newsletter_templates')
          .insert({
            name: formData.name,
            description: formData.description,
            subject: formData.subject,
            message: formData.message,
            logo_url: formData.logo_url || null,
            header_text: formData.header_text,
            footer_text: formData.footer_text,
            signature: formData.signature,
            is_default: formData.is_default,
            created_by: user?.id
          });

        if (error) throw error;

        toast({
          title: "Template creato",
          description: "Il template è stato creato con successo",
        });
      }

      // If this template is set as default, unset others
      if (formData.is_default) {
        await supabase
          .from('newsletter_templates')
          .update({ is_default: false })
          .neq('id', editingTemplate?.id || '');
      }

      fetchTemplates();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio del template",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questo template?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('newsletter_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template eliminato",
        description: "Il template è stato eliminato con successo",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Errore",
        description: "Errore nell'eliminazione del template",
        variant: "destructive",
      });
    }
  };

  const handleDuplicate = async (template: SavedTemplate) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const { error } = await supabase
        .from('newsletter_templates')
        .insert({
          name: `${template.name} (Copia)`,
          description: template.description,
          subject: template.subject,
          message: template.message,
          logo_url: template.logo_url,
          header_text: template.header_text,
          footer_text: template.footer_text,
          signature: template.signature,
          is_default: false,
          created_by: user?.id
        });

      if (error) throw error;

      toast({
        title: "Template duplicato",
        description: "Il template è stato duplicato con successo",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Errore",
        description: "Errore nella duplicazione del template",
        variant: "destructive",
      });
    }
  };

  const handleToggleDefault = async (template: SavedTemplate) => {
    try {
      // Unset all defaults first
      await supabase
        .from('newsletter_templates')
        .update({ is_default: false })
        .neq('id', '');

      // Set this one as default
      const { error } = await supabase
        .from('newsletter_templates')
        .update({ is_default: !template.is_default })
        .eq('id', template.id);

      if (error) throw error;

      toast({
        title: template.is_default ? "Default rimosso" : "Default impostato",
        description: template.is_default 
          ? "Questo template non è più quello predefinito" 
          : "Questo template è ora quello predefinito",
      });

      fetchTemplates();
    } catch (error) {
      console.error('Error toggling default:', error);
      toast({
        title: "Errore",
        description: "Errore nell'impostazione del template predefinito",
        variant: "destructive",
      });
    }
  };

  const generatePreview = (template: SavedTemplate) => {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        ${template.logo_url ? `
          <div style="text-align: center; padding: 20px; background-color: #f9fafb;">
            <img src="${template.logo_url}" alt="Logo" style="max-width: 200px; height: auto;" />
          </div>
        ` : ''}
        
        ${template.header_text ? `
          <div style="background-color: #1f2937; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${template.header_text}</h1>
          </div>
        ` : ''}
        
        <div style="padding: 30px;">
          <h2 style="color: #1f2937; margin-top: 0; margin-bottom: 20px; font-size: 20px;">
            ${template.subject || 'Oggetto del messaggio'}
          </h2>
          
          <div style="line-height: 1.6; color: #374151; margin-bottom: 30px;">
            ${(template.message || 'Contenuto del messaggio...').replace(/\n/g, '<br>')}
          </div>
          
          ${template.signature ? `
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280;">
              <div style="white-space: pre-line;">${template.signature}</div>
            </div>
          ` : ''}
        </div>
        
        ${template.footer_text ? `
          <div style="padding: 20px; background-color: #f9fafb; color: #9ca3af; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb;">
            ${template.footer_text}
          </div>
        ` : ''}
      </div>
    `;
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Template Newsletter</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci i template per le tue newsletter
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Modifica Template' : 'Nuovo Template'}
              </DialogTitle>
              <DialogDescription>
                {editingTemplate 
                  ? 'Modifica i dettagli del template'
                  : 'Crea un nuovo template per le tue newsletter'
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Nome Template *</label>
                  <Input
                    placeholder="Es. Newsletter Mensile"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Descrizione</label>
                  <Input
                    placeholder="Breve descrizione"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Logo URL</label>
                <Input
                  placeholder="https://example.com/logo.png"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Testo Header</label>
                <Input
                  placeholder="Newsletter Aziendale"
                  value={formData.header_text}
                  onChange={(e) => setFormData({ ...formData, header_text: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Oggetto Predefinito</label>
                <Input
                  placeholder="Oggetto dell'email"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Messaggio Predefinito</label>
                <Textarea
                  placeholder="Contenuto del messaggio..."
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  rows={5}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Firma *</label>
                <Textarea
                  placeholder="Cordiali saluti,&#10;Il Team"
                  value={formData.signature}
                  onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Testo Footer</label>
                <Input
                  placeholder="© 2024 La Tua Azienda"
                  value={formData.footer_text}
                  onChange={(e) => setFormData({ ...formData, footer_text: e.target.value })}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <label className="text-sm font-medium">
                  Imposta come template predefinito
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog}>
                Annulla
              </Button>
              <Button onClick={handleSave}>
                {editingTemplate ? 'Aggiorna' : 'Crea'} Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">Nessun template salvato</p>
            <p className="text-sm text-muted-foreground mt-2">
              Crea il tuo primo template per iniziare
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrizione</TableHead>
                <TableHead>Default</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {template.description || '-'}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleDefault(template)}
                    >
                      <Star
                        className={`h-4 w-4 ${
                          template.is_default ? 'fill-yellow-400 text-yellow-400' : ''
                        }`}
                      />
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setPreviewTemplate(template);
                          setPreviewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anteprima Template: {previewTemplate?.name}</DialogTitle>
            <DialogDescription>
              Anteprima di come apparirà l'email
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div 
              className="border rounded-lg p-4 bg-gray-50"
              dangerouslySetInnerHTML={{ __html: generatePreview(previewTemplate) }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
