import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageCircle, Send, Check, CheckCheck, Clock, AlertCircle, 
  Image, FileText, Video, Mic, Plus, RefreshCw, Link2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import WaSenderChatInput from "@/components/wasender/WaSenderChatInput";

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
  status: string;
  error_message: string | null;
  created_at: string;
}

export default function LeadWhatsApp({ leadId, leadPhone, leadName }: LeadWhatsAppProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedConversation, setSelectedConversation] = useState<WaSenderConversation | null>(null);
  const [newMessage, setNewMessage] = useState("");

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

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedConversation?.id || !selectedAccountId) {
        throw new Error("Conversazione non selezionata");
      }

      const account = accounts?.find(a => a.id === selectedAccountId);
      if (!account?.session_id) {
        throw new Error("Account senza Session ID configurato");
      }

      // Insert message in pending state
      const { data: msgData, error: insertError } = await supabase
        .from('wasender_messages')
        .insert({
          conversation_id: selectedConversation.id,
          direction: 'outbound',
          message_type: 'text',
          content,
          status: 'pending'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Call edge function to send via WaSender API
      const { error: sendError } = await supabase.functions.invoke('wasender-send', {
        body: {
          messageId: msgData.id,
          conversationId: selectedConversation.id,
          accountId: selectedAccountId,
          phone: selectedConversation.customer_phone,
          content
        }
      });

      if (sendError) {
        // Update message status to failed
        await supabase
          .from('wasender_messages')
          .update({ status: 'failed', error_message: sendError.message })
          .eq('id', msgData.id);
        throw sendError;
      }

      return msgData;
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      queryClient.invalidateQueries({ queryKey: ['wasender-lead-conversation'] });
    },
    onError: (error: Error) => {
      toast.error(`Errore invio: ${error.message}`);
      refetchMessages();
    }
  });

  const handleSendMessage = () => {
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'pending': return <Clock className="h-3 w-3 text-muted-foreground" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

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
            Apri documento
          </a>
        );
      default:
        return null;
    }
  };

  // No accounts configured
  if (!accountsLoading && (!accounts || accounts.length === 0)) {
    return (
      <div className="text-center py-6">
        <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Nessun account WhatsApp configurato
        </p>
        <Button variant="outline" size="sm" asChild>
          <a href="/crm/wasender">Configura Account</a>
        </Button>
      </div>
    );
  }

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

  // No conversation yet - show create button
  if (!conversationLoading && !conversation && !selectedConversation) {
    return (
      <div className="space-y-4">
        {accounts && accounts.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Account:</span>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Seleziona account" />
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
        
        <div className="text-center py-6 border rounded-lg bg-muted/30">
          <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground mb-3">
            Nessuna conversazione WhatsApp con questo lead
          </p>
          <Button 
            onClick={() => createConversationMutation.mutate()}
            disabled={createConversationMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-2" />
            Inizia Conversazione
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Verrà creata una chat con {leadPhone}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Account selector if multiple accounts */}
      {accounts && accounts.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Account:</span>
          <Select value={selectedAccountId} onValueChange={(val) => {
            setSelectedAccountId(val);
            setSelectedConversation(null);
          }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleziona account" />
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

      {/* Chat messages area */}
      <div className="border rounded-lg bg-card">
        <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700">
                {(leadName || leadPhone || "?").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{leadName || leadPhone}</p>
              {leadName && <p className="text-xs text-muted-foreground">{leadPhone}</p>}
            </div>
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

        <ScrollArea className="h-[300px] p-3">
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
                        ? 'bg-emerald-500 text-white'
                        : 'bg-muted'
                    }`}
                  >
                    {/* Media content */}
                    {msg.message_type !== 'text' && renderMediaContent(msg)}
                    
                    {/* Text content */}
                    {msg.content && (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    )}
                    
                    {/* Timestamp and status */}
                    <div className={`flex items-center gap-1 mt-1 ${
                      msg.direction === 'outbound' ? 'justify-end' : ''
                    }`}>
                      <span className={`text-xs ${
                        msg.direction === 'outbound' ? 'text-emerald-100' : 'text-muted-foreground'
                      }`}>
                        {format(new Date(msg.created_at), 'HH:mm')}
                      </span>
                      {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                    </div>
                    
                    {/* Error message */}
                    {msg.status === 'failed' && msg.error_message && (
                      <p className="text-xs text-red-200 mt-1">{msg.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-8 w-8 mb-2" />
              <p className="text-sm">Nessun messaggio</p>
              <p className="text-xs">Invia il primo messaggio!</p>
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t p-2">
          <div className="flex gap-2">
            <Input
              placeholder="Scrivi un messaggio..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={sendMessageMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendMessageMutation.isPending}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Link to full chat */}
      <Button variant="link" size="sm" className="p-0 h-auto" asChild>
        <a href="/crm/wasender" className="flex items-center gap-1 text-xs">
          <Link2 className="h-3 w-3" />
          Vai a ERP WhatsApp per tutte le chat
        </a>
      </Button>
    </div>
  );
}
