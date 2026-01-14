import { useState } from "react";
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
  FileText, Image, Video, Loader2, Trash2, Copy
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
}

export function WhatsAppTemplatePreview({ 
  template, 
  isOpen, 
  onClose,
  onSendTemplate 
}: WhatsAppTemplatePreviewProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"preview" | "edit">("preview");
  const [editData, setEditData] = useState({
    name: "",
    category: "",
    body: "",
    header: "",
    footer: "",
    headerType: "none" as "none" | "text" | "image" | "document" | "video"
  });

  // Initialize edit data when template changes
  useState(() => {
    if (template) {
      const components = parseComponents(template.components);
      setEditData({
        name: template.name,
        category: template.category,
        body: components.body,
        header: components.header,
        footer: components.footer,
        headerType: components.headerType
      });
    }
  });

  const parseComponents = (components: any): {
    header: string;
    body: string;
    footer: string;
    headerType: "none" | "text" | "image" | "document" | "video";
    buttons: { type: string; text: string; url?: string }[];
  } => {
    let header = "";
    let body = "";
    let footer = "";
    let headerType: "none" | "text" | "image" | "document" | "video" = "none";
    let buttons: { type: string; text: string; url?: string }[] = [];

    if (!components) return { header, body, footer, headerType, buttons };

    // Handle old format (single body object)
    if (components.body?.text) {
      return { 
        header: "", 
        body: components.body.text, 
        footer: "", 
        headerType: "none",
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
            } else if (comp.format === "DOCUMENT") {
              headerType = "document";
            } else if (comp.format === "VIDEO") {
              headerType = "video";
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

    return { header, body, footer, headerType, buttons };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case "PENDING":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "APPROVED": return "bg-green-100 text-green-800";
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "REJECTED": return "bg-red-100 text-red-800";
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

  // Update template mutation (only for PENDING/REJECTED templates not yet on Meta)
  const updateTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!template) return;
      
      // Build components array in Meta format
      const components: any[] = [];
      
      if (editData.headerType !== "none") {
        if (editData.headerType === "text" && editData.header) {
          components.push({
            type: "HEADER",
            format: "TEXT",
            text: editData.header
          });
        } else if (editData.headerType !== "text") {
          components.push({
            type: "HEADER",
            format: editData.headerType.toUpperCase()
          });
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

      const { error } = await supabase
        .from("whatsapp_templates")
        .update({
          name: editData.name,
          category: editData.category,
          components: components.length > 0 ? components : { body: { type: "BODY", text: editData.body } },
          status: "PENDING", // Reset status for re-submission
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
  const canEdit = template.status === "PENDING" || template.status === "REJECTED" || template.status === "FAILED";
  const canDelete = !template.meta_template_id; // Can only delete if not yet on Meta

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
            <TabsTrigger value="edit" disabled={!canEdit} className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Modifica
              {!canEdit && <span className="text-xs text-muted-foreground">(già approvato)</span>}
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

            {/* Rejection reason */}
            {template.rejection_reason && (
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

              {/* Warning for approved templates */}
              <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-800 dark:text-yellow-200">Nota sulle modifiche</p>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        Secondo le policy WhatsApp, i template già approvati non possono essere modificati.
                        Per modificare un template approvato, devi creare una nuova versione con un nome diverso (es. {template.name}_v2).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
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
              <Button
                onClick={() => updateTemplateMutation.mutate()}
                disabled={updateTemplateMutation.isPending || !editData.body.trim()}
              >
                {updateTemplateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : null}
                Salva Modifiche
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
