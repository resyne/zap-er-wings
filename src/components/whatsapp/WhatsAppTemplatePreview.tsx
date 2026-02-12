import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Eye, Pencil, AlertCircle, CheckCircle2, Clock, XCircle,
  FileText, Image, Video, Loader2, Trash2, Copy, Send, Plus, X, Phone, Link, Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";

interface WhatsAppTemplate {
  id: string;
  account_id: string;
  template_id: string | null;
  meta_template_id?: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
  rejection_reason: string | null;
  created_at: string;
}

interface WhatsAppTemplatePreviewProps {
  template: WhatsAppTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onSendTemplate?: (template: WhatsAppTemplate) => void;
  onUploadToMeta?: (templateId: string) => void;
}

export function WhatsAppTemplatePreview({ 
  template, 
  isOpen, 
  onClose,
  onSendTemplate,
  onUploadToMeta
}: WhatsAppTemplatePreviewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [editData, setEditData] = useState({
    name: "",
    category: "",
    body: "",
    header: "",
    footer: "",
    headerType: "none" as "none" | "text" | "image" | "document" | "video",
    headerMediaUrl: "" as string,
    buttons: [] as { type: string; text: string; url?: string; phone_number?: string }[]
  });
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  // Initialize edit data when template changes
  useEffect(() => {
    if (template && isOpen) {
      const components = parseComponents(template.components);
      setEditData({
        name: template.name,
        category: template.category,
        body: components.body,
        header: components.header,
        footer: components.footer,
        headerType: components.headerType,
        headerMediaUrl: components.headerMediaUrl || "",
        buttons: components.buttons
      });
      setActiveTab("preview");
    }
  }, [template, isOpen]);

  const parseComponents = (components: any): {
    header: string;
    body: string;
    footer: string;
    headerType: "none" | "text" | "image" | "document" | "video";
    headerMediaUrl: string;
    buttons: { type: string; text: string; url?: string }[];
  } => {
    let header = "";
    let body = "";
    let footer = "";
    let headerType: "none" | "text" | "image" | "document" | "video" = "none";
    let headerMediaUrl = "";
    let buttons: { type: string; text: string; url?: string }[] = [];

    if (!components) return { header, body, footer, headerType, headerMediaUrl, buttons };

    // Handle old format (single body object)
    if (components.body?.text) {
      return { 
        header: "", 
        body: components.body.text, 
        footer: "", 
        headerType: "none",
        headerMediaUrl: "",
        buttons: []
      };
    }

    // Handle array format from Meta API
    if (Array.isArray(components)) {
      for (const comp of components) {
        switch (comp.type) {
          case "HEADER":
            if (comp.format === "TEXT") {
              headerType = "text";
              header = comp.text || "";
            } else if (comp.format === "IMAGE") {
              headerType = "image";
              headerMediaUrl = comp.example?.header_handle?.[0] || comp.media_url || "";
            } else if (comp.format === "DOCUMENT") {
              headerType = "document";
              headerMediaUrl = comp.example?.header_handle?.[0] || comp.media_url || "";
            } else if (comp.format === "VIDEO") {
              headerType = "video";
              headerMediaUrl = comp.example?.header_handle?.[0] || comp.media_url || "";
            }
            break;
          case "BODY":
            body = comp.text || "";
            break;
          case "FOOTER":
            footer = comp.text || "";
            break;
          case "BUTTONS":
            buttons = comp.buttons?.map((b: any) => ({
              type: b.type,
              text: b.text,
              url: b.url
            })) || [];
            break;
        }
      }
    }

    return { header, body, footer, headerType, headerMediaUrl, buttons };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "DRAFT":
        return <Pencil className="h-4 w-4 text-blue-600" />;
      case "DISABLED":
        return <XCircle className="h-4 w-4 text-gray-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      case "DRAFT": return "bg-blue-100 text-blue-800";
      case "DISABLED": return "bg-gray-100 text-gray-500";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "MARKETING": return "bg-blue-100 text-blue-800";
      case "UTILITY": return "bg-green-100 text-green-800";
      case "AUTHENTICATION": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;
      
      // If template is on Meta, we can't delete it from there via API easily
      // Just mark as deleted locally or remove from our DB
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template eliminato");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Build components helper
  const buildComponentsArray = () => {
    const components: any[] = [];
    
    if (editData.headerType !== "none") {
      if (editData.headerType === "text" && editData.header) {
        components.push({
          type: "HEADER",
          format: "TEXT",
          text: editData.header
        });
      } else if (editData.headerType !== "text") {
        const headerComp: any = {
          type: "HEADER",
          format: editData.headerType.toUpperCase()
        };
        // Add media URL if present (for sample media during template creation)
        if (editData.headerMediaUrl) {
          headerComp.media_url = editData.headerMediaUrl;
          // Meta API format for examples
          headerComp.example = {
            header_handle: [editData.headerMediaUrl]
          };
        }
        components.push(headerComp);
      }
    }
    
    if (editData.body) {
      components.push({
        type: "BODY",
        text: editData.body
      });
    }
    
    if (editData.footer) {
      components.push({
        type: "FOOTER",
        text: editData.footer
      });
    }

    if (editData.buttons && editData.buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: editData.buttons.map(btn => {
          const buttonObj: any = {
            type: btn.type,
            text: btn.text
          };
          if (btn.type === "URL" && btn.url) {
            buttonObj.url = btn.url;
          }
          if (btn.type === "PHONE_NUMBER" && btn.phone_number) {
            buttonObj.phone_number = btn.phone_number;
          }
          return buttonObj;
        })
      });
    }
    
    return components.length > 0 ? components : { body: { type: "BODY", text: editData.body } };
  };

  // Update template mutation (for PENDING/REJECTED/DRAFT templates)
  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;
      
      const components = buildComponentsArray();

      const { error } = await supabase
        .from("whatsapp_templates")
        .update({
          name: editData.name,
          category: editData.category,
          components: components,
          status: template.status === "DRAFT" ? "DRAFT" : "PENDING",
          rejection_reason: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", template.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template aggiornato - ricaricalo su Meta per la revisione");
      setActiveTab("preview");
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Create new version mutation (for APPROVED templates - disables old, creates new)
  const createNewVersionMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;
      
      const components = buildComponentsArray();
      
      // 1. Disable the old template
      const { error: disableError } = await supabase
        .from("whatsapp_templates")
        .update({
          status: "DISABLED",
          updated_at: new Date().toISOString()
        })
        .eq("id", template.id);
      
      if (disableError) throw disableError;
      
      // 2. Create new template with new name
      const { error: createError } = await supabase
        .from("whatsapp_templates")
        .insert({
          account_id: template.account_id,
          name: editData.name,
          language: template.language,
          category: editData.category,
          components: components,
          status: "DRAFT",
          template_id: null,
          meta_template_id: null
        });
      
      if (createError) throw createError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Nuova versione creata! Il vecchio template è stato disabilitato. Invia il nuovo a Meta per l'approvazione.");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const copyTemplateContent = () => {
    if (!template) return;
    const components = parseComponents(template.components);
    const text = [components.header, components.body, components.footer]
      .filter(Boolean)
      .join("\n\n");
    navigator.clipboard.writeText(text);
    toast.success("Contenuto copiato");
  };

  if (!template) return null;

  const components = parseComponents(template.components);
  // Ora si può modificare sempre - per template approvati creeremo una nuova versione
  const canEdit = true;
  const isApproved = template.status === "APPROVED";
  const canDelete = !template.meta_template_id || template.status === "DRAFT" || template.status === "DISABLED"; // Can delete if not yet on Meta or if DRAFT/DISABLED
  const canUploadToMeta = (template.status === "DRAFT" || template.status === "PENDING") && onUploadToMeta;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Template: {template.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "preview" | "edit")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Anteprima
            </TabsTrigger>
            <TabsTrigger value="edit" className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              {isApproved ? "Nuova versione" : "Modifica"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4 mt-4">
            {/* Status and Info */}
            <div className="flex flex-wrap gap-2 items-center">
              <Badge className={getStatusColor(template.status)}>
                {getStatusIcon(template.status)}
                <span className="ml-1">{template.status}</span>
              </Badge>
              <Badge className={getCategoryColor(template.category)}>
                {template.category}
              </Badge>
              <Badge variant="outline">
                {template.language.toUpperCase()}
              </Badge>
              {template.meta_template_id && (
                <Badge variant="secondary">
                  Su Meta
                </Badge>
              )}
            </div>

            {/* Rejection reason - show only for REJECTED or FAILED status */}
            {template.rejection_reason && (template.status === "REJECTED" || template.status === "FAILED") && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Motivo rifiuto</p>
                      <p className="text-sm text-red-700">{template.rejection_reason}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Phone Preview */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span>Anteprima Messaggio</span>
                  <Button variant="ghost" size="sm" onClick={copyTemplateContent}>
                    <Copy className="h-4 w-4 mr-1" />
                    Copia
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-[#e5ddd5] dark:bg-gray-800 rounded-lg p-4">
                  <div className="max-w-xs bg-white dark:bg-gray-700 rounded-lg shadow p-3 space-y-2">
                    {/* Header */}
                    {components.headerType !== "none" && (
                      <div className="border-b pb-2">
                        {components.headerType === "text" && components.header && (
                          <p className="font-semibold text-sm">{components.header}</p>
                        )}
                        {components.headerType === "image" && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Image className="h-4 w-4" />
                            <span className="text-xs">[Immagine]</span>
                          </div>
                        )}
                        {components.headerType === "document" && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">[Documento]</span>
                          </div>
                        )}
                        {components.headerType === "video" && (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Video className="h-4 w-4" />
                            <span className="text-xs">[Video]</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Body */}
                    <p className="text-sm whitespace-pre-wrap">{components.body || "(Nessun corpo)"}</p>
                    
                    {/* Footer */}
                    {components.footer && (
                      <p className="text-xs text-muted-foreground border-t pt-2">
                        {components.footer}
                      </p>
                    )}
                    
                    {/* Buttons */}
                    {components.buttons.length > 0 && (
                      <div className="border-t pt-2 space-y-1">
                        {components.buttons.map((btn, idx) => (
                          <div 
                            key={idx}
                            className="text-center text-sm text-blue-600 py-1 border rounded"
                          >
                            {btn.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Variables info */}
            {components.body.includes("{{") && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Variabili nel template</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(components.body.matchAll(/\{\{(\d+)\}\}/g)).map((match, idx) => (
                      <Badge key={idx} variant="outline">
                        {`{{${match[1]}}}`}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Queste variabili verranno sostituite quando invii il template
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Meta info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Creato: {format(new Date(template.created_at), "dd/MM/yyyy HH:mm")}</p>
              {template.meta_template_id && <p>Meta ID: {template.meta_template_id}</p>}
            </div>
          </TabsContent>

          <TabsContent value="edit" className="space-y-4 mt-4">
            <div className="space-y-4">
              {/* Name */}
              <div>
                <Label>Nome Template</Label>
                <Input
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                  placeholder="nome_template"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Solo lettere minuscole, numeri e underscore
                </p>
              </div>

              {/* Category */}
              <div>
                <Label>Categoria</Label>
                <Select
                  value={editData.category}
                  onValueChange={(v) => setEditData({ ...editData, category: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">Marketing</SelectItem>
                    <SelectItem value="UTILITY">Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Header Type */}
              <div>
                <Label>Header (opzionale)</Label>
                <Select
                  value={editData.headerType}
                  onValueChange={(v) => setEditData({ ...editData, headerType: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun header</SelectItem>
                    <SelectItem value="text">Testo</SelectItem>
                    <SelectItem value="image">Immagine</SelectItem>
                    <SelectItem value="document">Documento</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                  </SelectContent>
                </Select>
                {editData.headerType === "text" && (
                  <Input
                    className="mt-2"
                    value={editData.header}
                    onChange={(e) => setEditData({ ...editData, header: e.target.value })}
                    placeholder="Testo header"
                  />
                )}
                
                {/* Media upload for image/document/video headers */}
                {(editData.headerType === "image" || editData.headerType === "document" || editData.headerType === "video") && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editData.headerMediaUrl}
                        onChange={(e) => setEditData({ ...editData, headerMediaUrl: e.target.value })}
                        placeholder={`URL ${editData.headerType === "image" ? "immagine" : editData.headerType === "document" ? "documento" : "video"} (es. https://...)`}
                        className="flex-1"
                      />
                      <span className="text-muted-foreground">oppure</span>
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          accept={
                            editData.headerType === "image" 
                              ? "image/jpeg,image/png" 
                              : editData.headerType === "document" 
                                ? ".pdf" 
                                : "video/mp4"
                          }
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            setIsUploadingMedia(true);
                            toast.info(`Caricamento "${file.name}" in corso...`);
                            try {
                              const fileExt = file.name.split('.').pop();
                              const fileName = `template-media/${Date.now()}.${fileExt}`;
                              
                              const { data, error } = await supabase.storage
                                .from('whatsapp-media')
                                .upload(fileName, file, {
                                  cacheControl: '3600',
                                  upsert: false
                                });
                              
                              if (error) throw error;
                              
                              const { data: urlData } = supabase.storage
                                .from('whatsapp-media')
                                .getPublicUrl(fileName);
                              
                              if (!urlData?.publicUrl) {
                                throw new Error("URL pubblico non generato");
                              }
                              
                              setEditData({ ...editData, headerMediaUrl: urlData.publicUrl });
                              toast.success(`✅ File "${file.name}" caricato con successo!`, {
                                description: "L'URL è stato inserito automaticamente nel campo header.",
                                duration: 5000,
                              });
                              console.log("Header media uploaded:", urlData.publicUrl);
                            } catch (err: any) {
                              console.error("Upload error:", err);
                              toast.error(`❌ Errore caricamento: ${err.message}`, {
                                description: "Verifica che il bucket 'whatsapp-media' esista e sia configurato correttamente.",
                                duration: 8000,
                              });
                            } finally {
                              setIsUploadingMedia(false);
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          disabled={isUploadingMedia}
                          asChild
                        >
                          <span>
                            {isUploadingMedia ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                    
                    {/* Preview */}
                    {editData.headerMediaUrl && (
                      <div className="border rounded p-2 bg-muted/50">
                        {editData.headerType === "image" ? (
                          <img 
                            src={editData.headerMediaUrl} 
                            alt="Header preview" 
                            className="max-h-32 rounded"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-sm">
                            {editData.headerType === "document" ? (
                              <FileText className="h-4 w-4" />
                            ) : (
                              <Video className="h-4 w-4" />
                            )}
                            <span className="truncate">{editData.headerMediaUrl}</span>
                          </div>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1"
                          onClick={() => setEditData({ ...editData, headerMediaUrl: "" })}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Rimuovi
                        </Button>
                      </div>
                    )}
                    
                    <p className="text-xs text-muted-foreground">
                      {editData.headerType === "image" && "Formati: JPEG, PNG. Max 5MB."}
                      {editData.headerType === "document" && "Formato: PDF. Max 100MB."}
                      {editData.headerType === "video" && "Formato: MP4. Max 16MB."}
                    </p>
                  </div>
                )}
              </div>

              {/* Body */}
              <div>
                <Label>Corpo del messaggio *</Label>
                <Textarea
                  value={editData.body}
                  onChange={(e) => setEditData({ ...editData, body: e.target.value })}
                  placeholder="Ciao {{1}}, il tuo ordine {{2}} è stato spedito!"
                  rows={5}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Usa {"{{1}}"}, {"{{2}}"}, ecc. per le variabili
                </p>
              </div>

              {/* Footer */}
              <div>
                <Label>Footer (opzionale)</Label>
                <Input
                  value={editData.footer}
                  onChange={(e) => setEditData({ ...editData, footer: e.target.value })}
                  placeholder="es. Rispondi STOP per cancellarti"
                />
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Pulsanti (opzionale)</Label>
                  {editData.buttons.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditData({
                          ...editData,
                          buttons: [...editData.buttons, { type: "QUICK_REPLY", text: "" }]
                        });
                      }}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Aggiungi
                    </Button>
                  )}
                </div>
                
                {editData.buttons.map((btn, idx) => (
                  <Card key={idx} className="p-3">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Select
                          value={btn.type}
                          onValueChange={(v) => {
                            const newButtons = [...editData.buttons];
                            newButtons[idx] = { ...newButtons[idx], type: v };
                            setEditData({ ...editData, buttons: newButtons });
                          }}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                            <SelectItem value="URL">URL</SelectItem>
                            <SelectItem value="PHONE_NUMBER">Telefono</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          value={btn.text}
                          onChange={(e) => {
                            const newButtons = [...editData.buttons];
                            newButtons[idx] = { ...newButtons[idx], text: e.target.value };
                            setEditData({ ...editData, buttons: newButtons });
                          }}
                          placeholder="Testo pulsante (max 25 car.)"
                          className="flex-1"
                          maxLength={25}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const newButtons = editData.buttons.filter((_, i) => i !== idx);
                            setEditData({ ...editData, buttons: newButtons });
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {/* Character count indicator */}
                      <div className="flex justify-end">
                        <span className={`text-xs ${btn.text.length > 25 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {btn.text.length}/25
                        </span>
                      </div>
                      
                      {btn.type === "URL" && (
                        <div className="flex items-center gap-2">
                          <Link className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={btn.url || ""}
                            onChange={(e) => {
                              const newButtons = [...editData.buttons];
                              newButtons[idx] = { ...newButtons[idx], url: e.target.value };
                              setEditData({ ...editData, buttons: newButtons });
                            }}
                            placeholder="https://esempio.com"
                            className="flex-1"
                          />
                        </div>
                      )}
                      
                      {btn.type === "PHONE_NUMBER" && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <Input
                            value={btn.phone_number || ""}
                            onChange={(e) => {
                              const newButtons = [...editData.buttons];
                              newButtons[idx] = { ...newButtons[idx], phone_number: e.target.value };
                              setEditData({ ...editData, buttons: newButtons });
                            }}
                            placeholder="+39123456789"
                            className="flex-1"
                          />
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
                
                <p className="text-xs text-muted-foreground">
                  Max 3 pulsanti. Ogni pulsante max 25 caratteri.
                </p>
              </div>

              {/* Warning for approved templates */}
              {isApproved ? (
                <Card className={`border-2 ${editData.name === template.name ? 'border-destructive bg-destructive/10' : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className={`h-5 w-5 mt-0.5 ${editData.name === template.name ? 'text-destructive' : 'text-blue-600'}`} />
                      <div className="text-sm">
                        <p className={`font-medium ${editData.name === template.name ? 'text-destructive' : 'text-blue-800 dark:text-blue-200'}`}>
                          {editData.name === template.name ? 'Nome obbligatorio diverso!' : 'Creazione nuova versione'}
                        </p>
                        <p className={editData.name === template.name ? 'text-destructive/80' : 'text-blue-700 dark:text-blue-300'}>
                          {editData.name === template.name 
                            ? 'Devi usare un nome diverso per creare una nuova versione del template.'
                            : 'Stai creando una nuova versione del template. Il template attuale verrà disabilitato e questa nuova versione dovrà essere inviata a Meta per l\'approvazione.'
                          }
                        </p>
                        <p className={`mt-1 ${editData.name === template.name ? 'text-destructive/80' : 'text-blue-700 dark:text-blue-300'}`}>
                          <strong>Suggerimento:</strong> Usa un nome diverso (es. {template.name}_v2)
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20">
                  <CardContent className="pt-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-yellow-800 dark:text-yellow-200">Nota sulle modifiche</p>
                        <p className="text-yellow-700 dark:text-yellow-300">
                          Dopo il salvataggio, dovrai inviare il template a Meta per l'approvazione.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {activeTab === "preview" ? (
            <>
              {canDelete && (
                <Button
                  variant="destructive"
                  onClick={() => deleteTemplateMutation.mutate()}
                  disabled={deleteTemplateMutation.isPending}
                >
                  {deleteTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-1" />
                  )}
                  Elimina
                </Button>
              )}
              <div className="flex-1" />
              <Button variant="outline" onClick={onClose}>
                Chiudi
              </Button>
              {canUploadToMeta && (
                <Button 
                  variant="default"
                  onClick={() => onUploadToMeta(template.id)}
                >
                  <Send className="h-4 w-4 mr-1" />
                  Invia a Meta
                </Button>
              )}
              {template.status === "APPROVED" && onSendTemplate && (
                <Button onClick={() => onSendTemplate(template)}>
                  Invia Template
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setActiveTab("preview")}>
                Annulla
              </Button>
              {isApproved ? (
                <Button
                  onClick={() => createNewVersionMutation.mutate()}
                  disabled={createNewVersionMutation.isPending || !editData.body.trim() || !editData.name.trim() || editData.name === template.name}
                  title={editData.name === template.name ? "Devi usare un nome diverso per la nuova versione" : undefined}
                >
                  {createNewVersionMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Crea Nuova Versione
                </Button>
              ) : (
                <Button
                  onClick={() => updateTemplateMutation.mutate()}
                  disabled={updateTemplateMutation.isPending || !editData.body.trim()}
                >
                  {updateTemplateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Salva Modifiche
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
