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
  MessageSquareText, Plus, Trash2, Pencil, MoreVertical, 
  Loader2, FileText, Search, Settings2, Paperclip, X,
  Image, Video, Mic, FolderOpen
} from "lucide-react";
import { toast } from "sonner";
import { BusinessFilesDialog } from "./WhatsAppBusinessFilesLibrary";

interface StandardMessage {
  id: string;
  account_id: string;
  name: string;
  message: string;
  category: string | null;
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

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-standard-messages', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_standard_messages')
        .select('*')
        .eq('account_id', accountId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as StandardMessage[];
    },
    enabled: open && !!accountId
  });

  const filteredMessages = messages?.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.message.toLowerCase().includes(search.toLowerCase()) ||
    (m.category?.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by category
  const groupedMessages = filteredMessages?.reduce((acc, msg) => {
    const cat = msg.category || 'Senza categoria';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(msg);
    return acc;
  }, {} as Record<string, StandardMessage[]>);

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          ) : !messages || messages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquareText className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nessun messaggio standard</p>
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
                          <p className="font-medium text-sm">{msg.name}</p>
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

  // Form state
  const [formName, setFormName] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formAttachment, setFormAttachment] = useState<{
    fileId?: string;
    url: string;
    name: string;
    type: string;
  } | null>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['whatsapp-standard-messages', accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_standard_messages')
        .select('*')
        .eq('account_id', accountId)
        .order('category', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return data as StandardMessage[];
    },
    enabled: open && !!accountId
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('whatsapp_standard_messages')
        .insert({
          account_id: accountId,
          name: formName.trim(),
          message: formMessage.trim(),
          category: formCategory.trim() || null,
          attachment_file_id: formAttachment?.fileId || null,
          attachment_url: formAttachment?.url || null,
          attachment_name: formAttachment?.name || null,
          attachment_type: formAttachment?.type || null,
          created_by: userData.user?.id
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-standard-messages', accountId] });
      toast.success("Messaggio creato");
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
    setFormAttachment(null);
    setEditingMessage(null);
    setShowCreateForm(false);
  };

  const startEdit = (msg: StandardMessage) => {
    setEditingMessage(msg);
    setFormName(msg.name);
    setFormMessage(msg.message);
    setFormCategory(msg.category || "");
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

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-lg">
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
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="es. Saluto iniziale"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
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
                <p className="text-xs text-muted-foreground">
                  Le variabili verranno sostituite automaticamente con i dati del lead
                </p>
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
                <p className="text-xs text-muted-foreground">
                  Quando selezioni questo messaggio, l'allegato verrà inserito automaticamente
                </p>
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
            <>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setShowCreateForm(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nuovo messaggio
              </Button>

              <ScrollArea className="h-[300px] pr-2">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nessun messaggio ancora</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map(msg => (
                      <div 
                        key={msg.id} 
                        className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-sm">{msg.name}</p>
                            {msg.attachment_url && (
                              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                                {getAttachmentIcon(msg.attachment_type)}
                              </Badge>
                            )}
                          </div>
                          {msg.category && (
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {msg.category}
                            </Badge>
                          )}
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
                )}
              </ScrollArea>
            </>
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
