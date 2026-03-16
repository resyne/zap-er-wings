import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WhatsAppChatInput } from "@/components/whatsapp/WhatsAppChatInput";
import { MessageStatusIndicator } from "@/components/whatsapp/MessageStatusIndicator";
import { TranslatedMessageBubble } from "@/components/crm/TranslatedMessageBubble";
import WhatsAppVideoPlayer from "@/components/whatsapp/WhatsAppVideoPlayer";
import WhatsAppImageDisplay from "@/components/whatsapp/WhatsAppImageDisplay";
import WhatsAppAudioPlayer from "@/components/crm/WhatsAppAudioPlayer";
import SaveToLeadButton from "@/components/whatsapp/SaveToLeadButton";
import { useAuth } from "@/hooks/useAuth";
import { useLeadDataForPhone } from "@/hooks/useLeadDataForPhone";
import { useBeccaPhoneNumbers, isBeccaPhone } from "@/hooks/useBeccaPhoneNumbers";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import {
  ArrowLeft, MessageCircle, Search, Check, CheckCheck,
  Clock, AlertCircle, User, Phone, FileText, Image as ImageIcon,
  Volume2, Archive, MoreVertical, Bot, Send, Plus
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Types
interface WhatsAppAccount {
  id: string;
  business_unit_id: string;
  phone_number_id: string;
  display_phone_number: string;
  verified_name: string | null;
  pipeline: string | null;
  is_active: boolean;
}

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
  has_customer_reply?: boolean | null;
  ai_enabled?: boolean | null;
  assigned_user_id?: string | null;
  leads?: { pipeline: string | null } | null;
}

interface WhatsAppMessage {
  id: string;
  conversation_id: string;
  wamid: string | null;
  direction: string;
  message_type: string;
  content: string | null;
  media_url: string | null;
  template_name: string | null;
  template_params?: string[] | null;
  status: string;
  error_message: string | null;
  created_at: string;
  sent_by: string | null;
  transcription?: string | null;
  transcription_translated?: string | null;
  transcription_language?: string | null;
}

interface WhatsAppTemplate {
  id: string;
  account_id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
  is_disabled?: boolean;
}

export default function ZAppWhatsAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showNewConvDialog, setShowNewConvDialog] = useState(false);
  const [newConvPhone, setNewConvPhone] = useState("");
  const [newConvName, setNewConvName] = useState("");

  // Template state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [templateParams, setTemplateParams] = useState<string[]>([]);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Fetch all WhatsApp accounts
  const { data: accounts } = useQuery({
    queryKey: ["zapp-whatsapp-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, business_unit_id, phone_number_id, display_phone_number, verified_name, pipeline, is_active")
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data as WhatsAppAccount[];
    },
  });

  // Auto-select first account
  useEffect(() => {
    if (accounts?.length && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts?.find(a => a.id === selectedAccountId) || null;

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ["zapp-whatsapp-conversations", selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*, leads:lead_id(pipeline)")
        .eq("account_id", selectedAccountId)
        .neq("status", "archived")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data as WhatsAppConversation[];
    },
    enabled: !!selectedAccountId,
    refetchInterval: 5000,
  });

  // Fetch messages for selected conversation
  const { data: messages } = useQuery({
    queryKey: ["zapp-whatsapp-messages", selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000,
  });

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ["zapp-whatsapp-templates", selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("account_id", selectedAccountId)
        .eq("status", "APPROVED")
        .order("name");
      if (error) throw error;
      return (data as WhatsAppTemplate[]).filter(t => !t.is_disabled);
    },
    enabled: !!selectedAccountId,
  });

  // User profiles for sender names
  const { data: profiles } = useQuery({
    queryKey: ["zapp-user-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email");
      if (error) throw error;
      return data;
    },
  });

  // Lead data for active conversation
  const { data: activeLeadData } = useLeadDataForPhone({
    phone: selectedConversation?.customer_phone ?? null,
    leadId: selectedConversation?.lead_id ?? null,
    pipeline: selectedAccount?.pipeline ?? null,
    enabled: !!selectedConversation,
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!selectedAccountId) return;

    const convChannel = supabase
      .channel("zapp-wa-conv-rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_conversations",
        filter: `account_id=eq.${selectedAccountId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["zapp-whatsapp-conversations", selectedAccountId] });
      })
      .subscribe();

    const msgChannel = supabase
      .channel("zapp-wa-msg-rt")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "whatsapp_messages",
      }, (payload) => {
        if (selectedConversation && (payload.new as any).conversation_id === selectedConversation.id) {
          queryClient.invalidateQueries({ queryKey: ["zapp-whatsapp-messages", selectedConversation.id] });
        }
        queryClient.invalidateQueries({ queryKey: ["zapp-whatsapp-conversations", selectedAccountId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [selectedAccountId, selectedConversation?.id, queryClient]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatScrollRef.current && messages?.length) {
      setTimeout(() => {
        chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    }
  }, [messages?.length]);

  // Mark as read
  const markAsReadMutation = useMutation({
    mutationFn: async (convId: string) => {
      await supabase.from("whatsapp_conversations").update({ unread_count: 0 }).eq("id", convId);
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (convId: string) => {
      const { error } = await supabase.from("whatsapp_conversations").update({ status: "archived" }).eq("id", convId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["zapp-whatsapp-conversations"] });
      setSelectedConversation(null);
      setShowChat(false);
      toast.success("Conversazione archiviata");
    },
  });

  // New conversation
  const createConvMutation = useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from("whatsapp_conversations")
        .select("id")
        .eq("account_id", selectedAccountId!)
        .eq("customer_phone", newConvPhone)
        .maybeSingle();
      if (existing) throw new Error("Conversazione già esistente con questo numero");

      const { data, error } = await supabase.from("whatsapp_conversations").insert({
        account_id: selectedAccountId!,
        customer_phone: newConvPhone,
        customer_name: newConvName || null,
        status: "active",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (conv) => {
      queryClient.invalidateQueries({ queryKey: ["zapp-whatsapp-conversations"] });
      setShowNewConvDialog(false);
      setNewConvPhone("");
      setNewConvName("");
      setSelectedConversation(conv);
      setShowChat(true);
      toast.success("Conversazione creata");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Send template
  const sendTemplateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !selectedConversation) throw new Error("Dati mancanti");
      const response = await supabase.functions.invoke("whatsapp-send", {
        body: {
          account_id: selectedAccountId,
          to: selectedConversation.customer_phone,
          type: "template",
          template_name: selectedTemplate.name,
          template_language: selectedTemplate.language,
          template_params: templateParams.length > 0 ? templateParams.map(p => p.trim() === '' ? '-' : p) : undefined,
          sent_by: user?.id,
        },
      });
      if (response.error || !response.data?.success) {
        throw new Error(response.data?.error || "Errore invio template");
      }
    },
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ["zapp-whatsapp-messages", selectedConversation?.id] });
      queryClient.refetchQueries({ queryKey: ["zapp-whatsapp-conversations", selectedAccountId] });
      setShowTemplateSelector(false);
      setSelectedTemplate(null);
      setTemplateParams([]);
      toast.success("Template inviato");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Helpers
  const getUserName = (userId: string | null) => {
    if (!userId) return null;
    const p = profiles?.find(pr => pr.id === userId);
    if (!p) return null;
    return p.first_name || p.last_name
      ? `${p.first_name || ""} ${p.last_name || ""}`.trim()
      : p.email?.split("@")[0] || null;
  };

  const getTemplateParamCount = (template: WhatsAppTemplate) => {
    let bodyText = "";
    if (Array.isArray(template.components)) {
      const body = template.components.find((c: any) => c.type === "BODY" || c.type === "body");
      bodyText = body?.text || "";
    } else if (template.components?.body?.text) {
      bodyText = template.components.body.text;
    }
    const matches = bodyText.match(/\{\{\d+\}\}/g);
    return matches ? matches.length : 0;
  };

  const getTemplateBodyText = (template: WhatsAppTemplate) => {
    if (Array.isArray(template.components)) {
      const body = template.components.find((c: any) => c.type === "BODY" || c.type === "body");
      return body?.text || "";
    }
    return template.components?.body?.text || "";
  };

  const fillTemplateVariables = (text: string, params?: Array<string | null | undefined>) => {
    if (!text) return "";
    return text.replace(/\{\{(\d+)\}\}/g, (_m, nStr) => {
      const idx = Math.max(1, Number(nStr)) - 1;
      const val = params?.[idx];
      const normalized = (val ?? "").toString().trim();
      return normalized.length ? normalized : "-";
    });
  };

  const isWithin24hWindow = () => {
    if (!messages?.length) return false;
    const lastInbound = [...messages].reverse().find(m => m.direction === "inbound");
    if (!lastInbound) return false;
    return (Date.now() - new Date(lastInbound.created_at).getTime()) / (1000 * 60 * 60) < 24;
  };

  const handleSelectConversation = (conv: WhatsAppConversation) => {
    setSelectedConversation(conv);
    setShowChat(true);
    if (conv.unread_count > 0) markAsReadMutation.mutate(conv.id);
  };

  const filteredConversations = conversations?.filter(conv => {
    if (!searchQuery) return true;
    const s = searchQuery.toLowerCase();
    return (
      conv.customer_name?.toLowerCase().includes(s) ||
      conv.customer_phone.toLowerCase().includes(s) ||
      conv.last_message_preview?.toLowerCase().includes(s)
    );
  });

  // ========== RENDER ==========

  // Chat view (full screen mobile)
  if (showChat && selectedConversation) {
    return (
      <div className="h-screen flex flex-col bg-background">
        {/* Chat Header */}
        <div className="bg-green-600 text-white px-3 py-3 flex items-center gap-3 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 shrink-0"
            onClick={() => { setShowChat(false); setSelectedConversation(null); }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-white/20 text-white text-sm">
              {(selectedConversation.customer_name || selectedConversation.customer_phone)?.[0]?.toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">
              {selectedConversation.customer_name || selectedConversation.customer_phone}
            </p>
            {selectedConversation.customer_name && (
              <p className="text-xs text-green-100 truncate">{selectedConversation.customer_phone}</p>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => archiveMutation.mutate(selectedConversation.id)}>
                <Archive className="h-4 w-4 mr-2" />
                Archivia
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Messages */}
        <div
          ref={chatScrollRef}
          className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-[#ece5dd] dark:bg-muted/30"
        >
          {messages?.map((msg) => {
            const isOutbound = msg.direction === "outbound";
            const senderName = isOutbound ? getUserName(msg.sent_by) : null;

            return (
              <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 shadow-sm ${
                    isOutbound
                      ? "bg-[#dcf8c6] dark:bg-green-900/40 text-foreground"
                      : "bg-white dark:bg-card text-foreground"
                  }`}
                >
                  {/* Sender name for outbound */}
                  {senderName && (
                    <p className="text-[10px] font-semibold text-green-700 dark:text-green-400 mb-0.5">
                      {senderName}
                    </p>
                  )}

                  {/* Media content */}
                  {msg.message_type === "image" && msg.media_url && (
                    <div className="mb-1">
                      <WhatsAppImageDisplay
                        messageId={msg.id}
                        mediaId={msg.media_url}
                        accountId={selectedAccountId!}
                        isOutbound={isOutbound}
                      />
                    </div>
                  )}
                  {msg.message_type === "video" && msg.media_url && (
                    <div className="mb-1">
                      <WhatsAppVideoPlayer
                        messageId={msg.id}
                        mediaId={msg.media_url}
                        accountId={selectedAccountId!}
                        isOutbound={isOutbound}
                      />
                    </div>
                  )}
                  {msg.message_type === "audio" && msg.media_url && (
                    <div className="mb-1">
                      <WhatsAppAudioPlayer
                        messageId={msg.id}
                        mediaId={msg.media_url}
                        accountId={selectedAccountId!}
                        existingTranscription={msg.transcription}
                        existingTranslation={msg.transcription_translated}
                        existingLanguage={msg.transcription_language}
                      />
                    </div>
                  )}
                  {msg.message_type === "document" && msg.media_url && (
                    <a
                      href={msg.media_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-muted/30 rounded mb-1"
                    >
                      <FileText className="h-4 w-4 text-orange-500" />
                      <span className="text-xs underline truncate">Documento</span>
                    </a>
                  )}

                  {/* Template content */}
                  {msg.message_type === "template" && msg.template_name && (
                    <div className="mb-1">
                      <Badge variant="outline" className="text-[10px] mb-1">
                        <Bot className="h-3 w-3 mr-1" />
                        Template
                      </Badge>
                      {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
                    </div>
                  )}

                  {/* Text content (text, button, and other text-based types) */}
                  {(msg.message_type === "text" || msg.message_type === "button" || msg.message_type === "interactive") && msg.content && (
                    <TranslatedMessageBubble
                      messageId={msg.id}
                      originalText={msg.content}
                      isInbound={msg.direction === "inbound"}
                      savedTranslation={(msg as any).translation_it}
                    />
                  )}

                  {/* Fallback for unsupported/unknown message types with content */}
                  {!["text", "button", "interactive", "template", "image", "video", "audio", "document"].includes(msg.message_type) && msg.content && (
                    <p className="text-sm whitespace-pre-wrap italic text-muted-foreground">{msg.content}</p>
                  )}

                  {/* Caption for media with text */}
                  {msg.message_type !== "text" && msg.message_type !== "template" && msg.content && (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}

                  {/* Save to lead button for inbound media */}
                  {msg.direction === "inbound" && msg.media_url && selectedConversation.lead_id && (
                    <div className="mt-1">
                      <SaveToLeadButton
                        mediaUrl={msg.media_url}
                        messageType={msg.message_type}
                        leadId={selectedConversation.lead_id}
                        messageId={msg.id}
                        accountId={selectedAccountId!}
                      />
                    </div>
                  )}

                  {/* Footer: time + status */}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(msg.created_at), "HH:mm")}
                    </span>
                    {isOutbound && <MessageStatusIndicator status={msg.status} size="sm" />}
                  </div>

                  {msg.error_message && (
                    <p className="text-[10px] text-red-500 mt-0.5 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {msg.error_message}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Template selector / outside 24h window */}
        {showTemplateSelector && (
          <div className="bg-background border-t p-3 space-y-3 max-h-[60vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Seleziona Template</h4>
              <Button variant="ghost" size="sm" onClick={() => { setShowTemplateSelector(false); setSelectedTemplate(null); }}>
                Chiudi
              </Button>
            </div>
            {!selectedTemplate ? (
              <div className="space-y-2">
                {templates?.map(t => (
                  <button
                    key={t.id}
                    className="w-full text-left p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    onClick={() => {
                      setSelectedTemplate(t);
                      setTemplateParams(Array(getTemplateParamCount(t)).fill(""));
                    }}
                  >
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{getTemplateBodyText(t)}</p>
                    <div className="flex gap-1 mt-1">
                      <Badge variant="secondary" className="text-[10px]">{t.language.toUpperCase()}</Badge>
                      <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                    </div>
                  </button>
                ))}
                {(!templates || templates.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nessun template disponibile</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium mb-1">{selectedTemplate.name}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {fillTemplateVariables(getTemplateBodyText(selectedTemplate), templateParams)}
                  </p>
                </div>
                {templateParams.map((param, idx) => (
                  <div key={idx}>
                    <Label className="text-xs">Parametro {idx + 1}</Label>
                    <Input
                      value={param}
                      onChange={e => {
                        const newParams = [...templateParams];
                        newParams[idx] = e.target.value;
                        setTemplateParams(newParams);
                      }}
                      className="h-9 text-sm"
                      placeholder={`Valore parametro {{${idx + 1}}}`}
                    />
                  </div>
                ))}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setSelectedTemplate(null)}>
                    Indietro
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => sendTemplateMutation.mutate()}
                    disabled={sendTemplateMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Invia
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="border-t bg-background p-2 shrink-0">
          {!isWithin24hWindow() && !showTemplateSelector ? (
            <div className="text-center py-2">
              <p className="text-xs text-muted-foreground mb-2">
                Fuori dalla finestra 24h. Invia un template per ricontattare.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowTemplateSelector(true)}
              >
                <FileText className="h-4 w-4 mr-1" />
                Invia Template
              </Button>
            </div>
          ) : isWithin24hWindow() ? (
            <WhatsAppChatInput
              accountId={selectedAccountId!}
              accountName={selectedAccount?.verified_name || selectedAccount?.display_phone_number}
              conversationPhone={selectedConversation.customer_phone}
              onMessageSent={() => {
                queryClient.refetchQueries({ queryKey: ["zapp-whatsapp-messages", selectedConversation.id] });
                queryClient.refetchQueries({ queryKey: ["zapp-whatsapp-conversations", selectedAccountId] });
              }}
              userId={user?.id}
              leadData={activeLeadData ?? undefined}
            />
          ) : null}
        </div>
      </div>
    );
  }

  // ========== CONVERSATION LIST VIEW ==========
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-green-600 text-white px-4 py-4 shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => navigate("/hr/z-app")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold">WhatsApp</h1>
            <p className="text-green-100 text-xs">
              {selectedAccount?.verified_name || selectedAccount?.display_phone_number || "Chat"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setShowNewConvDialog(true)}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>

        {/* Account selector pills */}
        {accounts && accounts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => { setSelectedAccountId(acc.id); setSelectedConversation(null); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedAccountId === acc.id
                    ? "bg-white text-green-700"
                    : "bg-white/20 text-white"
                }`}
              >
                {acc.verified_name || acc.display_phone_number}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-200" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cerca conversazione..."
            className="pl-9 bg-white/20 border-0 text-white placeholder:text-green-200 h-9 text-sm rounded-full"
          />
        </div>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {filteredConversations?.map(conv => (
            <button
              key={conv.id}
              onClick={() => handleSelectConversation(conv)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-green-100 text-green-700 text-sm font-semibold">
                  {(conv.customer_name || conv.customer_phone)?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm truncate">
                    {conv.customer_name || conv.customer_phone}
                  </p>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {conv.last_message_at
                      ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: it })
                      : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-muted-foreground truncate pr-2">
                    {conv.last_message_preview || "Nessun messaggio"}
                  </p>
                  {conv.unread_count > 0 && (
                    <Badge className="bg-green-600 text-white text-[10px] h-5 min-w-[20px] shrink-0">
                      {conv.unread_count}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}

          {filteredConversations?.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">Nessuna conversazione</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* New conversation dialog */}
      <Dialog open={showNewConvDialog} onOpenChange={setShowNewConvDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuova Conversazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">Numero di telefono *</Label>
              <Input
                value={newConvPhone}
                onChange={e => setNewConvPhone(e.target.value)}
                placeholder="+39 333 1234567"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">Nome (opzionale)</Label>
              <Input
                value={newConvName}
                onChange={e => setNewConvName(e.target.value)}
                placeholder="Nome contatto"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createConvMutation.mutate()}
              disabled={!newConvPhone.trim() || createConvMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Crea Conversazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
