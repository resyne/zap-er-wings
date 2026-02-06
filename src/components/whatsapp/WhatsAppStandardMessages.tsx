import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  MessageSquareText, Plus, Trash2, Pencil, MoreVertical, 
  Loader2, FileText, Search, Settings2, Paperclip, X,
  Image, Video, Mic, FolderOpen, Languages, Sparkles, Globe
} from "lucide-react";
import { toast } from "sonner";
import { BusinessFilesDialog } from "./WhatsAppBusinessFilesLibrary";

interface StandardMessage {
  id: string;
  account_id: string;
  name: string;
  message: string;
  category: string | null;
  language: string;
  attachment_file_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  created_at: string;
}

interface AttachmentData {
  url: string;
  name: string;
  type: string;
}

interface LeadData {
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  country?: string;
}

interface StandardMessagesDialogProps {
  accountId: string;
  accountName?: string;
  onSelectMessage: (message: string, attachment?: AttachmentData) => void;
  trigger: React.ReactNode;
  leadData?: LeadData;
}

const LANGUAGES = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
];

const getLanguageInfo = (code: string) => LANGUAGES.find(l => l.code === code) || LANGUAGES[0];

const getAttachmentIcon = (type: string | null) => {
  switch (type) {
    case "image":
      return <Image className="h-3 w-3" />;
    case "video":
      return <Video className="h-3 w-3" />;
    case "audio":
      return <Mic className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
};

// Helper function to replace variables with lead data
const replaceVariables = (message: string, leadData?: LeadData): string => {
  if (!leadData) return message;
  
  return message
    .replace(/\{\{nome\}\}/gi, leadData.name || '')
    .replace(/\{\{azienda\}\}/gi, leadData.company || '')
    .replace(/\{\{email\}\}/gi, leadData.email || '')
    .replace(/\{\{telefono\}\}/gi, leadData.phone || '')
    .replace(/\{\{paese\}\}/gi, leadData.country || '');
};

// Map country to language code
const countryToLanguageCode = (country?: string): string => {
  if (!country) return 'it';
  const c = country.toLowerCase();
  if (['italia', 'italy'].includes(c)) return 'it';
  if (['spagna', 'spain', 'españa'].includes(c)) return 'es';
  if (['francia', 'france'].includes(c)) return 'fr';
  if (['germania', 'germany', 'deutschland'].includes(c)) return 'de';
  if (['portogallo', 'portugal'].includes(c)) return 'pt';
  if (['regno unito', 'uk', 'united kingdom', 'stati uniti', 'usa', 'united states', 'australia', 'canada'].includes(c)) return 'en';
  return 'en'; // Default to English for unknown
};

export function StandardMessagesDialog({ 
  accountId, 
  accountName,
  onSelectMessage, 
  trigger,
  leadData
}: StandardMessagesDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showManage, setShowManage] = useState(false);
  
  // Auto-detect language from lead country
  const detectedLanguage = countryToLanguageCode(leadData?.country);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(detectedLanguage);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-standard-messages', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_standard_messages')
        .select('*')
        .eq('account_id', accountId)
        .order('language', { ascending: true })
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as StandardMessage[];
    },
    enabled: open && !!accountId
  });

  // Filter by language and search
  const filteredMessages = messages?.filter(m => {
    const matchesLanguage = m.language === selectedLanguage;
    const matchesSearch = !search || 
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.message.toLowerCase().includes(search.toLowerCase()) ||
      (m.category?.toLowerCase().includes(search.toLowerCase()));
    return matchesLanguage && matchesSearch;
  });

  // Group by category
  const groupedMessages = filteredMessages?.reduce((acc, msg) => {
    const cat = msg.category || 'Senza categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(msg);
    return acc;
  }, {} as Record<string, StandardMessage[]>);

  // Count messages per language
  const languageCounts = messages?.reduce((acc, msg) => {
    acc[msg.language] = (acc[msg.language] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const handleSelect = (msg: StandardMessage) => {
    const attachment = msg.attachment_url ? {
      url: msg.attachment_url,
      name: msg.attachment_name || 'Allegato',
      type: msg.attachment_type || 'document'
    } : undefined;
    
    // Replace variables with lead data
    const processedMessage = replaceVariables(msg.message, leadData);
    
    onSelectMessage(processedMessage, attachment);
    setOpen(false);
    toast.success(`Messaggio "${msg.name}" selezionato${attachment ? ' con allegato' : ''}`);
  };

  // Reset language when lead changes
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (v) {
      setSelectedLanguage(detectedLanguage);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Messaggi Standard
            {accountName && (
              <Badge variant="secondary" className="ml-2 font-normal">
                {accountName}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        {/* Language tabs */}
        <div className="flex flex-wrap gap-1.5">
          {LANGUAGES.map(lang => {
            const count = languageCounts[lang.code] || 0;
            const isSelected = selectedLanguage === lang.code;
            const isDetected = lang.code === detectedLanguage;
            return (
              <Button
                key={lang.code}
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={`relative ${count === 0 && !isSelected ? 'opacity-50' : ''}`}
                onClick={() => setSelectedLanguage(lang.code)}
              >
                <span className="mr-1">{lang.flag}</span>
                <span className="hidden sm:inline">{lang.label}</span>
                <span className="sm:hidden">{lang.code.toUpperCase()}</span>
                {count > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px]"
                  >
                    {count}
                  </Badge>
                )}
                {isDetected && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 bg-emerald-500 rounded-full" title="Lingua del lead" />
                )}
              </Button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca messaggi..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => setShowManage(true)}
            title="Gestisci messaggi"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[300px] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !filteredMessages || filteredMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquareText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                Nessun messaggio in {getLanguageInfo(selectedLanguage).label}
              </p>
              <Button 
                variant="link" 
                className="mt-2" 
                onClick={() => setShowManage(true)}
              >
                Crea il primo messaggio
              </Button>
            </div>
          ) : groupedMessages && Object.keys(groupedMessages).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedMessages).map(([category, msgs]) => (
                <div key={category}>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {msgs.map(msg => (
                      <div
                        key={msg.id}
                        className="p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                        onClick={() => handleSelect(msg)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{msg.name}</p>
                          </div>
                          {msg.attachment_url && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                              {getAttachmentIcon(msg.attachment_type)}
                              Allegato
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {msg.message}
                        </p>
                        {msg.attachment_name && (
                          <p className="text-xs text-primary mt-1 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />
                            {msg.attachment_name}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">Nessun risultato per "{search}"</p>
            </div>
          )}
        </ScrollArea>

        {/* Management dialog */}
        <ManageMessagesDialog 
          accountId={accountId}
          accountName={accountName}
          open={showManage}
          onOpenChange={setShowManage}
        />
      </DialogContent>
    </Dialog>
  );
}

// Dialog for managing (CRUD) standard messages
function ManageMessagesDialog({ 
  accountId, 
  accountName,
  open, 
  onOpenChange 
}: { 
  accountId: string; 
  accountName?: string;
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [editingMessage, setEditingMessage] = useState<StandardMessage | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterLanguage, setFilterLanguage] = useState<string>('all');

  // Form state
  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formLanguage, setFormLanguage] = useState("it");
  const [formAttachment, setFormAttachment] = useState<{
    fileId?: string;
    url: string;
    name: string;
    type: string;
  } | null>(null);

  // Auto-translate state
  const [isTranslating, setIsTranslating] = useState(false);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-standard-messages', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_standard_messages')
        .select('*')
        .eq('account_id', accountId)
        .order('language', { ascending: true })
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as StandardMessage[];
    },
    enabled: open && !!accountId
  });

  // Filter messages by language
  const filteredMessages = messages?.filter(m => 
    filterLanguage === 'all' || m.language === filterLanguage
  );

  // Group by language then category
  const groupedMessages = filteredMessages?.reduce((acc, msg) => {
    const langKey = msg.language;
    if (!acc[langKey]) acc[langKey] = {};
    const catKey = msg.category || 'Senza categoria';
    if (!acc[langKey][catKey]) acc[langKey][catKey] = [];
    acc[langKey][catKey].push(msg);
    return acc;
  }, {} as Record<string, Record<string, StandardMessage[]>>);

  // Helper to translate text
  const translateText = async (text: string, targetLang: string, sourceLang: string): Promise<string> => {
    try {
      const response = await supabase.functions.invoke('translate-chat-message', {
        body: {
          text,
          target_language: targetLang,
          source_language: sourceLang
        }
      });
      if (response.error) throw response.error;
      return response.data?.translation || text;
    } catch (err) {
      console.error(`Translation to ${targetLang} failed:`, err);
      return text;
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const baseLanguage = formLanguage;
      
      // Insert base message
      const { error } = await supabase
        .from('whatsapp_standard_messages')
        .insert({
          account_id: accountId,
          name: formName.trim(),
          message: formMessage.trim(),
          category: formCategory.trim() || null,
          language: baseLanguage,
          attachment_file_id: formAttachment?.fileId || null,
          attachment_url: formAttachment?.url || null,
          attachment_name: formAttachment?.name || null,
          attachment_type: formAttachment?.type || null,
          created_by: userData.user?.id
        });
      if (error) throw error;

      // Auto-translate to all other languages
      const otherLanguages = LANGUAGES.filter(l => l.code !== baseLanguage);
      toast.info(`Traduzione automatica in ${otherLanguages.length} lingue...`);

      for (const lang of otherLanguages) {
        try {
          const [translatedName, translatedMessage] = await Promise.all([
            translateText(formName.trim(), lang.code, baseLanguage),
            translateText(formMessage.trim(), lang.code, baseLanguage)
          ]);

          await supabase
            .from('whatsapp_standard_messages')
            .insert({
              account_id: accountId,
              name: translatedName,
              message: translatedMessage,
              category: formCategory.trim() || null,
              language: lang.code,
              attachment_file_id: formAttachment?.fileId || null,
              attachment_url: formAttachment?.url || null,
              attachment_name: formAttachment?.name || null,
              attachment_type: formAttachment?.type || null,
              created_by: userData.user?.id
            });
        } catch (langError) {
          console.error(`Failed to create ${lang.code} version:`, langError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-standard-messages', accountId] });
      toast.success(`Messaggio creato in ${LANGUAGES.length} lingue!`);
      resetForm();
    },
    onError: (err: Error) => {
      toast.error("Errore: " + err.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingMessage) return;
      const { error } = await supabase
        .from('whatsapp_standard_messages')
        .update({
          name: formName.trim(),
          message: formMessage.trim(),
          category: formCategory.trim() || null,
          language: formLanguage,
          attachment_file_id: formAttachment?.fileId || null,
          attachment_url: formAttachment?.url || null,
          attachment_name: formAttachment?.name || null,
          attachment_type: formAttachment?.type || null,
        })
        .eq('id', editingMessage.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-standard-messages', accountId] });
      toast.success("Messaggio aggiornato");
      resetForm();
    },
    onError: (err: Error) => {
      toast.error("Errore: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('whatsapp_standard_messages')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-standard-messages', accountId] });
      toast.success("Messaggio eliminato");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => {
      toast.error("Errore: " + err.message);
    }
  });

  const resetForm = () => {
    setFormName("");
    setFormMessage("");
    setFormCategory("");
    setFormLanguage("it");
    setFormAttachment(null);
    setEditingMessage(null);
    setShowCreateForm(false);
  };

  const startEdit = (msg: StandardMessage) => {
    setEditingMessage(msg);
    setFormName(msg.name);
    setFormMessage(msg.message);
    setFormCategory(msg.category || "");
    setFormLanguage(msg.language || "it");
    setFormAttachment(msg.attachment_url ? {
      fileId: msg.attachment_file_id || undefined,
      url: msg.attachment_url,
      name: msg.attachment_name || 'Allegato',
      type: msg.attachment_type || 'document'
    } : null);
    setShowCreateForm(true);
  };

  const handleSave = () => {
    if (!formName.trim() || !formMessage.trim()) {
      toast.error("Nome e messaggio sono obbligatori");
      return;
    }
    if (editingMessage) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const handleSelectFile = (file: { id: string; file_url: string; name: string; file_type: string }) => {
    setFormAttachment({
      fileId: file.id,
      url: file.file_url,
      name: file.name,
      type: file.file_type
    });
  };

  // Auto-translate function
  const handleAutoTranslate = async (targetLang: string) => {
    if (!formMessage.trim()) {
      toast.error("Scrivi prima il messaggio da tradurre");
      return;
    }

    setIsTranslating(true);
    try {
      const response = await supabase.functions.invoke('translate-chat-message', {
        body: {
          text: formMessage,
          targetLanguage: targetLang,
          sourceLanguage: formLanguage
        }
      });

      if (response.error) throw response.error;
      
      const translatedText = response.data?.translatedText;
      if (translatedText) {
        setFormMessage(translatedText);
        setFormLanguage(targetLang);
        toast.success(`Tradotto in ${getLanguageInfo(targetLang).label}`);
      }
    } catch (err: any) {
      toast.error("Errore traduzione: " + (err.message || "Errore sconosciuto"));
    } finally {
      setIsTranslating(false);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Gestisci Messaggi Standard
              {accountName && (
                <Badge variant="secondary" className="ml-2 font-normal">
                  {accountName}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {showCreateForm ? (
            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    placeholder="es. Saluto iniziale"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Lingua *</Label>
                  <Select value={formLanguage} onValueChange={setFormLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          <span className="flex items-center gap-2">
                            <span>{lang.flag}</span>
                            <span>{lang.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Input
                  placeholder="es. Saluti, Informazioni, Promozioni"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Messaggio *</Label>
                <Textarea
                  placeholder="Scrivi il testo del messaggio..."
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  rows={4}
                />
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Variabili:</span>
                  {[
                    { key: '{{nome}}', label: 'Nome' },
                    { key: '{{azienda}}', label: 'Azienda' },
                    { key: '{{email}}', label: 'Email' },
                    { key: '{{telefono}}', label: 'Telefono' },
                    { key: '{{paese}}', label: 'Paese' },
                  ].map(v => (
                    <Badge 
                      key={v.key}
                      variant="outline" 
                      className="text-[10px] cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                      onClick={() => setFormMessage(prev => prev + v.key)}
                    >
                      {v.label}
                    </Badge>
                  ))}
                </div>

                {/* Auto-translate buttons */}
                <div className="flex flex-wrap gap-1.5 pt-2 border-t">
                  <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
                    <Languages className="h-3 w-3" />
                    Traduci in:
                  </span>
                  {LANGUAGES.filter(l => l.code !== formLanguage).map(lang => (
                    <Button
                      key={lang.code}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      disabled={isTranslating || !formMessage.trim()}
                      onClick={() => handleAutoTranslate(lang.code)}
                    >
                      {isTranslating ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <span className="mr-1">{lang.flag}</span>
                      )}
                      {lang.code.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Attachment selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Allegato preimpostato
                </Label>
                
                {formAttachment ? (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                    <div className="p-1.5 bg-background rounded">
                      {getAttachmentIcon(formAttachment.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{formAttachment.name}</p>
                      <p className="text-xs text-muted-foreground">{formAttachment.type}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => setFormAttachment(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <BusinessFilesDialog
                    accountId={accountId}
                    accountName={accountName}
                    onSelectFile={handleSelectFile}
                    trigger={
                      <Button variant="outline" className="w-full">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Seleziona da libreria
                      </Button>
                    }
                  />
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={resetForm} disabled={isSaving}>
                  Annulla
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingMessage ? "Salva modifiche" : "Crea messaggio"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex gap-2 mb-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo messaggio
                </Button>
                <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                  <SelectTrigger className="w-[140px]">
                    <Globe className="h-4 w-4 mr-2" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutte le lingue</SelectItem>
                    {LANGUAGES.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <ScrollArea className="flex-1">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !filteredMessages || filteredMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun messaggio ancora</p>
                  </div>
                ) : groupedMessages && Object.keys(groupedMessages).length > 0 ? (
                  <div className="space-y-4 pr-2">
                    {Object.entries(groupedMessages).sort(([a], [b]) => a.localeCompare(b)).map(([langCode, categories]) => (
                      <div key={langCode}>
                        {filterLanguage === 'all' && (
                          <div className="flex items-center gap-2 mb-2 sticky top-0 bg-background py-1">
                            <span className="text-lg">{getLanguageInfo(langCode).flag}</span>
                            <span className="text-sm font-medium">{getLanguageInfo(langCode).label}</span>
                          </div>
                        )}
                        {Object.entries(categories).map(([category, msgs]) => (
                          <div key={`${langCode}-${category}`} className="mb-3">
                            <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2 pl-1">
                              {category}
                            </h4>
                            <div className="space-y-2">
                              {msgs.map(msg => (
                                <div 
                                  key={msg.id} 
                                  className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">{msg.name}</p>
                                      {filterLanguage === 'all' && (
                                        <span className="text-xs">{getLanguageInfo(msg.language).flag}</span>
                                      )}
                                      {msg.attachment_url && (
                                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                                          {getAttachmentIcon(msg.attachment_type)}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                                      {msg.message}
                                    </p>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => startEdit(msg)}>
                                        <Pencil className="h-4 w-4 mr-2" />
                                        Modifica
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem 
                                        className="text-destructive"
                                        onClick={() => setDeleteConfirm(msg.id)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Elimina
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo messaggio?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm)}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
