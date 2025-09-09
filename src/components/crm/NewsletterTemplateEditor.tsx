import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Image, Signature, FileText, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

interface NewsletterTemplateEditorProps {
  onTemplateChange: (template: TemplateConfig) => void;
}

export const NewsletterTemplateEditor = ({ onTemplateChange }: NewsletterTemplateEditorProps) => {
  const { toast } = useToast();
  const [template, setTemplate] = useState<TemplateConfig>({
    headerText: "Newsletter Aziendale",
    footerText: "© 2024 La Tua Azienda. Tutti i diritti riservati.",
    signature: "Cordiali saluti,\nIl Team Marketing",
    attachments: []
  });
  const [uploading, setUploading] = useState(false);

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

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word') || type.includes('document')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    return '📎';
  };

  return (
    <div className="space-y-6">
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
          </CardTitle>
          <CardDescription>
            Aggiungi documenti come allegati alla newsletter
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="text-center p-6 border-2 border-dashed rounded-lg">
              <Plus className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">Aggiungi allegati</p>
              <p className="text-xs text-muted-foreground">PDF, DOC, XLS, IMG fino a 10MB</p>
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
    </div>
  );
};