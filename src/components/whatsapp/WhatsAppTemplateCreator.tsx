import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, Image, Video, Loader2, Plus, Type, AlertTriangle, X, 
  Phone, ExternalLink, MessageSquare, Trash2
} from "lucide-react";

interface WhatsAppTemplateCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: TemplateFormData) => void;
  isSaving?: boolean;
}

export interface TemplateButton {
  type: "URL" | "PHONE_NUMBER" | "QUICK_REPLY";
  text: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateFormData {
  name: string;
  language: string;
  category: string;
  headerType: "none" | "text" | "image" | "document" | "video";
  headerText: string;
  body: string;
  footer: string;
  buttons: TemplateButton[];
}

const HEADER_OPTIONS = [
  { value: "none", label: "Nessun header", icon: X, description: "Nessun header nel template" },
  { value: "text", label: "Testo", icon: Type, description: "Testo, può contenere una variabile" },
  { value: "image", label: "Immagine", icon: Image, description: "Immagine JPG o PNG" },
  { value: "document", label: "Documento", icon: FileText, description: "PDF o altro documento" },
  { value: "video", label: "Video", icon: Video, description: "Video MP4" },
];

const BUTTON_TYPES = [
  { value: "URL", label: "URL", icon: ExternalLink, description: "Apri un link" },
  { value: "PHONE_NUMBER", label: "Chiama", icon: Phone, description: "Numero di telefono" },
  { value: "QUICK_REPLY", label: "Risposta rapida", icon: MessageSquare, description: "Risposta predefinita" },
];

export function WhatsAppTemplateCreator({ 
  isOpen, 
  onClose,
  onSave,
  isSaving = false
}: WhatsAppTemplateCreatorProps) {
  const [formData, setFormData] = useState<TemplateFormData>({
    name: "",
    language: "it",
    category: "MARKETING",
    headerType: "none",
    headerText: "",
    body: "",
    footer: "",
    buttons: []
  });

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        language: "it",
        category: "MARKETING",
        headerType: "none",
        headerText: "",
        body: "",
        footer: "",
        buttons: []
      });
    }
  }, [isOpen]);

  const handleNameChange = (value: string) => {
    // WhatsApp template names: lowercase, numbers, underscores only
    const sanitized = value.toLowerCase().replace(/[^a-z0-9_]/g, "_");
    setFormData(prev => ({ ...prev, name: sanitized }));
  };

  const addVariable = (field: "headerText" | "body") => {
    const currentText = formData[field];
    // Find the highest existing variable number
    const matches = currentText.match(/\{\{(\d+)\}\}/g) || [];
    const numbers = matches.map((m: string) => parseInt(m.replace(/[{}]/g, "")));
    const nextNum = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    
    setFormData(prev => ({
      ...prev,
      [field]: prev[field] + `{{${nextNum}}}`
    }));
  };

  const addButton = () => {
    if (formData.buttons.length >= 10) return;
    setFormData(prev => ({
      ...prev,
      buttons: [...prev.buttons, { type: "QUICK_REPLY", text: "" }]
    }));
  };

  const updateButton = (index: number, updates: Partial<TemplateButton>) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.map((btn, i) => 
        i === index ? { ...btn, ...updates } : btn
      )
    }));
  };

  const removeButton = (index: number) => {
    setFormData(prev => ({
      ...prev,
      buttons: prev.buttons.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.body) return;
    onSave(formData);
  };

  // Count variables in body
  const bodyVariables = formData.body.match(/\{\{(\d+)\}\}/g) || [];
  const headerVariables = formData.headerText.match(/\{\{(\d+)\}\}/g) || [];

  const isValid = formData.name.length >= 1 && formData.body.length >= 1;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Crea Nuovo Template
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto max-h-[calc(90vh-180px)] pr-2">
          {/* Left side - Form */}
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome Template *</Label>
                  <Input
                    placeholder="es: benvenuto_cliente"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Solo lettere minuscole, numeri e _
                  </p>
                </div>
                <div>
                  <Label>Lingua</Label>
                  <Select 
                    value={formData.language} 
                    onValueChange={(v) => setFormData(prev => ({ ...prev, language: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">🇮🇹 Italiano</SelectItem>
                      <SelectItem value="en">🇬🇧 Inglese</SelectItem>
                      <SelectItem value="de">🇩🇪 Tedesco</SelectItem>
                      <SelectItem value="fr">🇫🇷 Francese</SelectItem>
                      <SelectItem value="es">🇪🇸 Spagnolo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label>Categoria</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MARKETING">📢 Marketing</SelectItem>
                    <SelectItem value="UTILITY">🔧 Utility</SelectItem>
                    <SelectItem value="AUTHENTICATION">🔐 Autenticazione</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Header Section */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Header</Label>
                <Badge variant="outline" className="text-xs">Opzionale</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Aggiungi un titolo o scegli il tipo di media per l'header.
              </p>
              
              <div>
                <Label className="text-sm">Formato</Label>
                <Select 
                  value={formData.headerType} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    headerType: v as TemplateFormData["headerType"],
                    headerText: v !== "text" ? "" : prev.headerText
                  }))}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADER_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="h-4 w-4" />
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {opt.description}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.headerType === "text" && (
                <div className="space-y-2">
                  <Label className="text-sm">Testo Header</Label>
                  <Input
                    placeholder="Es: Offerta speciale per te!"
                    value={formData.headerText}
                    onChange={(e) => setFormData(prev => ({ ...prev, headerText: e.target.value }))}
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Puoi usare una variabile nell'header
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => addVariable("headerText")}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Aggiungi variabile
                    </Button>
                  </div>
                </div>
              )}

              {formData.headerType !== "none" && formData.headerType !== "text" && (
                <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {formData.headerType === "image" && <Image className="h-5 w-5" />}
                    {formData.headerType === "document" && <FileText className="h-5 w-5" />}
                    {formData.headerType === "video" && <Video className="h-5 w-5" />}
                    <span className="font-medium">
                      {formData.headerType === "image" && "Immagine"}
                      {formData.headerType === "document" && "Documento"}
                      {formData.headerType === "video" && "Video"}
                    </span>
                  </div>
                  <p className="text-xs">
                    Il file verrà caricato quando invii il template
                  </p>
                </div>
              )}
            </div>

            {/* Body Section */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Body *</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Inserisci il testo del messaggio nella lingua selezionata.
              </p>
              
              <div className="space-y-2">
                <Label className="text-sm">Testo messaggio</Label>
                <Textarea
                  placeholder="Ciao {{1}}, grazie per averci contattato! Il tuo ordine {{2}} è confermato."
                  value={formData.body}
                  onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
                  rows={5}
                  className="resize-none"
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {formData.body.length}/1024 caratteri
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => addVariable("body")}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Aggiungi variabile
                  </Button>
                </div>
              </div>
            </div>

            {/* Footer Section */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Footer</Label>
                <Badge variant="outline" className="text-xs">Opzionale</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Aggiungi una breve riga di testo in fondo al template.
              </p>
              <div>
                <Label className="text-sm">Footer text</Label>
                <Textarea
                  placeholder="Es: Rispondi STOP per annullare l'iscrizione"
                  value={formData.footer}
                  onChange={(e) => setFormData(prev => ({ ...prev, footer: e.target.value.slice(0, 60) }))}
                  rows={2}
                  className="resize-none mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.footer.length}/60 caratteri
                </p>
              </div>
            </div>

            {/* Buttons Section */}
            <div className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Buttons</Label>
                <Badge variant="outline" className="text-xs">Opzionale</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Crea fino a 10 pulsanti per far rispondere i clienti o eseguire azioni.
              </p>

              {/* Existing buttons */}
              {formData.buttons.length > 0 && (
                <div className="space-y-3">
                  {formData.buttons.map((button, index) => (
                    <div key={index} className="rounded-lg border bg-muted/30 p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Pulsante {index + 1}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => removeButton(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={button.type}
                            onValueChange={(v) => updateButton(index, { 
                              type: v as TemplateButton["type"],
                              url: undefined,
                              phone_number: undefined
                            })}
                          >
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {BUTTON_TYPES.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <div className="flex items-center gap-2">
                                    <opt.icon className="h-4 w-4" />
                                    <span>{opt.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Testo pulsante</Label>
                          <Input
                            className="mt-1"
                            placeholder="Es: Scopri di più"
                            value={button.text}
                            onChange={(e) => updateButton(index, { text: e.target.value.slice(0, 25) })}
                            maxLength={25}
                          />
                        </div>
                      </div>

                      {button.type === "URL" && (
                        <div>
                          <Label className="text-xs">URL</Label>
                          <Input
                            className="mt-1"
                            placeholder="https://esempio.com/pagina"
                            value={button.url || ""}
                            onChange={(e) => updateButton(index, { url: e.target.value })}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Puoi usare {"{{1}}"} per URL dinamici
                          </p>
                        </div>
                      )}

                      {button.type === "PHONE_NUMBER" && (
                        <div>
                          <Label className="text-xs">Numero di telefono</Label>
                          <Input
                            className="mt-1"
                            placeholder="+39 123 456 7890"
                            value={button.phone_number || ""}
                            onChange={(e) => updateButton(index, { phone_number: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Add button */}
              {formData.buttons.length < 10 && (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={addButton}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Aggiungi pulsante
                </Button>
              )}
            </div>
          </div>

          {/* Right side - Live Preview */}
          <div className="lg:sticky lg:top-0">
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                  Anteprima Template
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* WhatsApp-style preview */}
                <div 
                  className="rounded-lg p-4 min-h-[300px]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8d6c1' fill-opacity='0.2'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    backgroundColor: "#e5ddd5"
                  }}
                >
                  <div className="max-w-[280px] bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden">
                    {/* Header Preview */}
                    {formData.headerType !== "none" && (
                      <div className="border-b">
                        {formData.headerType === "text" && (
                          <div className="px-3 py-2 bg-[#dcf8c6] dark:bg-green-900/30">
                            <p className="font-bold text-sm">
                              {formData.headerText || <span className="text-muted-foreground italic">Header text...</span>}
                            </p>
                          </div>
                        )}
                        {formData.headerType === "image" && (
                          <div className="h-32 bg-gray-100 dark:bg-gray-600 flex items-center justify-center">
                            <Image className="h-10 w-10 text-gray-400" />
                          </div>
                        )}
                        {formData.headerType === "document" && (
                          <div className="h-16 bg-gray-100 dark:bg-gray-600 flex items-center justify-center gap-2">
                            <FileText className="h-8 w-8 text-gray-400" />
                            <span className="text-sm text-gray-500">documento.pdf</span>
                          </div>
                        )}
                        {formData.headerType === "video" && (
                          <div className="h-32 bg-gray-800 flex items-center justify-center">
                            <Video className="h-10 w-10 text-gray-400" />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Body Preview */}
                    <div className="px-3 py-2 bg-[#dcf8c6] dark:bg-green-900/30">
                      {formData.body ? (
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {formData.body}
                        </p>
                      ) : (
                        <div className="flex items-center gap-2 text-amber-600">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm">Testo body obbligatorio.</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Preview */}
                    {formData.footer && (
                      <div className="px-3 py-1 bg-[#dcf8c6] dark:bg-green-900/30 border-t border-green-200/50">
                        <p className="text-xs text-muted-foreground">
                          {formData.footer}
                        </p>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="px-3 py-1 bg-[#dcf8c6] dark:bg-green-900/30 text-right">
                      <span className="text-[10px] text-muted-foreground">12:34</span>
                    </div>

                    {/* Buttons Preview */}
                    {formData.buttons.length > 0 && (
                      <div className="border-t divide-y">
                        {formData.buttons.map((btn, idx) => (
                          <div 
                            key={idx}
                            className="px-3 py-2 text-center text-sm text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer flex items-center justify-center gap-2"
                          >
                            {btn.type === "URL" && <ExternalLink className="h-3 w-3" />}
                            {btn.type === "PHONE_NUMBER" && <Phone className="h-3 w-3" />}
                            {btn.type === "QUICK_REPLY" && <MessageSquare className="h-3 w-3" />}
                            {btn.text || <span className="italic text-muted-foreground">Testo pulsante...</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Variables Summary */}
                  {(bodyVariables.length > 0 || headerVariables.length > 0) && (
                    <div className="mt-4 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Variabili nel template:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {[...headerVariables, ...bodyVariables].map((v, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {v}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Annulla
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isValid || isSaving}
          >
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Crea Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
