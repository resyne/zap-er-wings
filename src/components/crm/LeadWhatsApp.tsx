import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  MessageCircle, Check, CheckCheck, Clock, AlertCircle, 
  Image, FileText, Video, Mic, Plus, RefreshCw, Link2, Bot
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import WaSenderChatInput from "@/components/wasender/WaSenderChatInput";
import { MessageStatusIndicator } from "@/components/whatsapp/MessageStatusIndicator";

interface LeadWhatsAppProps {
  leadId: string;
  leadPhone?: string;
  leadName?: string;
}

interface WaSenderAccount {
  id: string;
  phone_number: string;
  account_name: string | null;
  session_id: string | null;
  is_active: boolean;
}

interface WaSenderConversation {
  id: string;
  account_id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
}

interface WaSenderMessage {
  id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  file_name: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

// WhatsApp Business API (Meta) types
interface WhatsAppConversation {
  id: string;
  account_id: string;
  customer_phone: string;
  customer_name: string | null;
  lead_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  template_name: string | null;
  template_params: any[] | null;
  interactive_data: any | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function LeadWhatsApp({ leadId, leadPhone, leadName }: LeadWhatsAppProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<WaSenderConversation | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Fetch active WaSender accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['wasender-accounts-lead'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wasender_accounts')
        .select('id, phone_number, account_name, session_id, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WaSenderAccount[];
    }
  });

  // Auto-select first account
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch conversation for this lead
  const { data: conversation, isLoading: conversationLoading, refetch: refetchConversation } = useQuery({
    queryKey: ['wasender-lead-conversation', leadId, selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return null;
      
      const { data, error } = await supabase
        .from('wasender_conversations')
        .select('*')
        .eq('lead_id', leadId)
        .eq('account_id', selectedAccountId)
        .maybeSingle();
      
      if (error) throw error;
      return data as WaSenderConversation | null;
    },
    enabled: !!selectedAccountId
  });

  // Set conversation when loaded
  useEffect(() => {
    if (conversation) {
      setSelectedConversation(conversation);
    }
  }, [conversation]);

  // Fetch messages for the conversation
  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['wasender-lead-messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation?.id) return [];
      
      const { data, error } = await supabase
        .from('wasender_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WaSenderMessage[];
    },
    enabled: !!selectedConversation?.id,
    refetchInterval: 5000 // Poll every 5 seconds
  });

  // Fetch WhatsApp Business API (Meta) conversations for this lead
  const { data: waApiConversations, refetch: refetchWaApiConversations } = useQuery({
    queryKey: ['whatsapp-api-lead-conversations', leadId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('lead_id', leadId)
        .order('last_message_at', { ascending: false });
      
      if (error) throw error;
      return data as WhatsAppConversation[];
    }
  });

  // Fetch messages for all WhatsApp API conversations
  const { data: waApiMessages, isLoading: waApiMessagesLoading, refetch: refetchWaApiMessages } = useQuery({
    queryKey: ['whatsapp-api-lead-messages', waApiConversations?.map(c => c.id)],
    queryFn: async () => {
      if (!waApiConversations || waApiConversations.length === 0) return [];
      
      const conversationIds = waApiConversations.map(c => c.id);
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .in('conversation_id', conversationIds)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!waApiConversations && waApiConversations.length > 0,
    refetchInterval: 5000
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, waApiMessages]);

  // Create conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccountId || !leadPhone) {
        throw new Error("Account e numero di telefono richiesti");
      }
      
      // Normalize phone number
      const normalizedPhone = leadPhone.replace(/[^\d+]/g, "").replace(/^\+/, "");
      
      const { data, error } = await supabase
        .from('wasender_conversations')
        .insert({
          account_id: selectedAccountId,
          customer_phone: normalizedPhone,
          customer_name: leadName || null,
          lead_id: leadId,
          status: 'active'
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSelectedConversation(data);
      queryClient.invalidateQueries({ queryKey: ['wasender-lead-conversation'] });
      toast.success('Conversazione WhatsApp creata');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Note: sendMessageMutation removed - now using WaSenderChatInput component

  // getStatusIcon replaced by MessageStatusIndicator component

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />;
      case 'video': return <Video className="h-4 w-4" />;
      case 'audio': return <Mic className="h-4 w-4" />;
      case 'document': return <FileText className="h-4 w-4" />;
      default: return null;
    }
  };

  const renderMediaContent = (msg: WaSenderMessage) => {
    if (!msg.media_url) return null;

    switch (msg.message_type) {
      case 'image':
      case 'sticker':
        return (
          <img
            src={msg.media_url}
            alt="Immagine"
            className="max-w-[200px] rounded-lg cursor-pointer hover:opacity-90"
            onClick={() => window.open(msg.media_url!, '_blank')}
          />
        );
      case 'video':
        return (
          <video
            src={msg.media_url}
            controls
            className="max-w-[200px] rounded-lg"
          />
        );
      case 'audio':
        return (
          <audio src={msg.media_url} controls className="max-w-[200px]" />
        );
      case 'document':
        return (
          <a
            href={msg.media_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-500 hover:underline"
          >
            <FileText className="h-4 w-4" />
            <span className="truncate max-w-[150px]">{msg.file_name || 'Documento'}</span>
          </a>
        );
      default:
        return null;
    }
  };

  // Helper to render WhatsApp API message content with template resolution
  const renderWaApiMessageContent = (msg: WhatsAppMessage) => {
    // If it's a template message, show template info
    if (msg.message_type === 'template' && msg.template_name) {
      let displayContent = msg.content || `[Template: ${msg.template_name}]`;
      
      // Try to resolve template parameters if available
      if (msg.template_params && Array.isArray(msg.template_params)) {
        const params = msg.template_params;
        params.forEach((param, index) => {
          const placeholder = `{{${index + 1}}}`;
          displayContent = displayContent.replace(placeholder, String(param));
        });
      }
      
      return (
        <div className="space-y-1">
          <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
          <Badge variant="outline" className="text-xs">
            <Bot className="h-3 w-3 mr-1" />
            Automation
          </Badge>
        </div>
      );
    }
    
    // Handle interactive messages (button replies)
    if (msg.message_type === 'interactive' && msg.interactive_data) {
      const data = msg.interactive_data as any;
      return (
        <div className="space-y-1">
          {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
          {data.button_text && (
            <Badge variant="secondary" className="text-xs">
              🔘 {data.button_text}
            </Badge>
          )}
        </div>
      );
    }
    
    // Regular text or media
    if (msg.media_url) {
      return (
        <div className="space-y-1">
          <a href={msg.media_url} target="_blank" rel="noopener noreferrer" 
             className="flex items-center gap-1 text-primary hover:underline text-sm">
            <FileText className="h-3 w-3" />
            Allegato
          </a>
          {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
        </div>
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{msg.content || ""}</p>;
  };

  const hasWaApiMessages = waApiMessages && waApiMessages.length > 0;
  const hasWaSenderConversation = selectedConversation || conversation;
  const hasAnyContent = hasWaApiMessages || hasWaSenderConversation;

  // No phone number for lead
  if (!leadPhone) {
    return (
      <div className="text-center py-6">
        <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Nessun numero di telefono associato a questo lead
        </p>
      </div>
    );
  }

  // Show WhatsApp API automation messages section
  const renderWaApiSection = () => {
    if (!waApiMessages || waApiMessages.length === 0) return null;
    
    return (
      <div className="border rounded-lg bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Messaggi Automazione WhatsApp</span>
            <Badge variant="secondary" className="text-xs">{waApiMessages.length}</Badge>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              refetchWaApiConversations();
              refetchWaApiMessages();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        
        <ScrollArea className="h-[250px] p-3">
          <div className="space-y-3">
            {waApiMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    msg.direction === 'outbound'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {renderWaApiMessageContent(msg)}
                  
                  <div className={`flex items-center gap-1.5 mt-1 ${
                    msg.direction === 'outbound' ? 'justify-end' : ''
                  }`}>
                    <span className={`text-xs ${
                      msg.direction === 'outbound' ? 'opacity-70' : 'text-muted-foreground'
                    }`}>
                      {format(new Date(msg.created_at), 'dd/MM HH:mm')}
                    </span>
                    {msg.direction === 'outbound' && (
                      <MessageStatusIndicator
                        status={msg.status}
                        errorMessage={msg.error_message}
                        showLabel={msg.status === 'failed'}
                        isOutbound={true}
                      />
                    )}
                  </div>
                  
                  {msg.status === 'failed' && msg.error_message && (
                    <p className="text-xs text-destructive mt-1">⚠️ {msg.error_message}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    );
  };

  // Show WaSender manual chat section
  const renderWaSenderSection = () => {
    // No WaSender accounts configured
    if (!accountsLoading && (!accounts || accounts.length === 0)) {
      return null; // Don't show WaSender section if not configured
    }

    // No conversation yet - show create button
    if (!conversationLoading && !conversation && !selectedConversation) {
      return (
        <div className="border rounded-lg bg-card p-4">
          <div className="text-center">
            <MessageCircle className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Avvia una chat manuale WhatsApp
            </p>
            {accounts && accounts.length > 1 && (
              <div className="flex items-center justify-center gap-2 mb-3">
                <span className="text-sm text-muted-foreground">Account:</span>
                <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(acc => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.account_name || acc.phone_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button 
              size="sm"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
            >
              <Plus className="h-4 w-4 mr-2" />
              Inizia Chat
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="border rounded-lg bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            {accounts && accounts.length > 1 && (
              <Select value={selectedAccountId} onValueChange={(val) => {
                setSelectedAccountId(val);
                setSelectedConversation(null);
              }}>
                <SelectTrigger className="w-[150px] h-7 text-xs">
                  <SelectValue placeholder="Account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts?.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.account_name || acc.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <span className="text-sm font-medium">Chat Manuale</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              refetchConversation();
              refetchMessages();
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[250px] p-3">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-3">
              {messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                      msg.direction === 'outbound'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                  >
                    {msg.message_type !== 'text' && renderMediaContent(msg)}
                    
                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    
                    <div className={`flex items-center gap-1.5 mt-1 ${
                      msg.direction === 'outbound' ? 'justify-end' : ''
                    }`}>
                      <span className={`text-xs ${
                        msg.direction === 'outbound' ? 'opacity-70' : 'text-muted-foreground'
                      }`}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {msg.direction === 'outbound' && (
                        <MessageStatusIndicator
                          status={msg.status}
                          errorMessage={msg.error_message}
                          showLabel={msg.status === 'failed'}
                          isOutbound={true}
                        />
                      )}
                    </div>
                    
                    {msg.status === 'failed' && msg.error_message && (
                      <p className="text-xs text-destructive mt-1">⚠️ {msg.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-6 w-6 mb-2" />
              <p className="text-xs">Nessun messaggio</p>
            </div>
          )}
        </ScrollArea>

        {selectedConversation && (
          <WaSenderChatInput
            conversationId={selectedConversation.id}
            customerPhone={selectedConversation.customer_phone}
            accountId={selectedAccountId}
            onMessageSent={() => {
              refetchMessages();
              queryClient.invalidateQueries({ queryKey: ['wasender-lead-conversation'] });
            }}
            isSending={isSending}
            setIsSending={setIsSending}
          />
        )}
      </div>
    );
  };

  // Main render with tabs if both types exist, or single section otherwise
  if (hasWaApiMessages && (hasWaSenderConversation || (accounts && accounts.length > 0))) {
    return (
      <div className="space-y-3">
        <Tabs defaultValue="automation" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="automation" className="text-xs">
              <Bot className="h-3 w-3 mr-1" />
              Automazione ({waApiMessages?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="manual" className="text-xs">
              <MessageCircle className="h-3 w-3 mr-1" />
              Chat Manuale
            </TabsTrigger>
          </TabsList>
          <TabsContent value="automation" className="mt-3">
            {renderWaApiSection()}
          </TabsContent>
          <TabsContent value="manual" className="mt-3">
            {renderWaSenderSection()}
          </TabsContent>
        </Tabs>
        
        <Button variant="link" size="sm" className="p-0 h-auto" asChild>
          <a href="/crm/wasender" className="flex items-center gap-1 text-xs">
            <Link2 className="h-3 w-3" />
            Vai a ERP WhatsApp
          </a>
        </Button>
      </div>
    );
  }

  // Only automation messages
  if (hasWaApiMessages) {
    return (
      <div className="space-y-3">
        {renderWaApiSection()}
        
        <Button variant="link" size="sm" className="p-0 h-auto" asChild>
          <a href="/crm/whatsapp" className="flex items-center gap-1 text-xs">
            <Link2 className="h-3 w-3" />
            Vai a WhatsApp API
          </a>
        </Button>
      </div>
    );
  }

  // Only WaSender (or nothing)
  return (
    <div className="space-y-3">
      {renderWaSenderSection() || (
        <div className="text-center py-6">
          <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            Nessun messaggio WhatsApp
          </p>
        </div>
      )}
      
      <Button variant="link" size="sm" className="p-0 h-auto" asChild>
        <a href="/crm/wasender" className="flex items-center gap-1 text-xs">
          <Link2 className="h-3 w-3" />
          Vai a ERP WhatsApp
        </a>
      </Button>
    </div>
  );
}
