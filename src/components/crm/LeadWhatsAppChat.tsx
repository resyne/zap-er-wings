import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageCircle, Check, CheckCheck, Clock, AlertCircle, 
  Image, FileText, Video, Mic, RefreshCw, Send, Loader2,
  Bot, Lock, Unlock, Paperclip, X, Timer
} from "lucide-react";
import { format, differenceInHours, differenceInMinutes } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

interface LeadWhatsAppChatProps {
  leadId: string;
  leadPhone: string;
  leadName?: string;
  leadCountry?: string;
}

interface WhatsAppAccount {
  id: string;
  display_phone_number: string;
  verified_name: string | null;
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
  sent_by: string | null;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
}

// Check if we're within the 24h window based on last inbound message
function getConversationWindow(messages: WhatsAppMessage[]): {
  isOpen: boolean;
  lastInboundAt: Date | null;
  hoursRemaining: number;
  minutesRemaining: number;
} {
  // Find the most recent inbound (from customer) message
  const inboundMessages = messages.filter(m => m.direction === 'inbound');
  if (inboundMessages.length === 0) {
    return { isOpen: false, lastInboundAt: null, hoursRemaining: 0, minutesRemaining: 0 };
  }
  
  const lastInbound = inboundMessages.reduce((latest, msg) => 
    new Date(msg.created_at) > new Date(latest.created_at) ? msg : latest
  );
  
  const lastInboundAt = new Date(lastInbound.created_at);
  const now = new Date();
  const hoursSince = differenceInHours(now, lastInboundAt);
  const minutesSince = differenceInMinutes(now, lastInboundAt) % 60;
  
  const isOpen = hoursSince < 24;
  const hoursRemaining = isOpen ? 24 - hoursSince - 1 : 0;
  const minutesRemaining = isOpen ? 60 - minutesSince : 0;
  
  return { isOpen, lastInboundAt, hoursRemaining, minutesRemaining };
}

export default function LeadWhatsAppChat({ leadId, leadPhone, leadName, leadCountry }: LeadWhatsAppChatProps) {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [templateParams, setTemplateParams] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // Fetch active WhatsApp Business API accounts
  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['whatsapp-accounts-lead'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('id, display_phone_number, verified_name, is_active')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppAccount[];
    }
  });

  // Fetch user profiles for showing who sent messages
  const { data: userProfiles } = useQuery({
    queryKey: ['user-profiles-for-chat'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email');
      if (error) throw error;
      return data as { id: string; first_name: string | null; last_name: string | null; email: string | null }[];
    }
  });

  const getUserName = (userId: string | null): string | null => {
    if (!userId || !userProfiles) return null;
    const profile = userProfiles.find(p => p.id === userId);
    if (!profile) return null;
    const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(' ');
    return fullName || profile.email || null;
  };

  // Auto-select first account
  useEffect(() => {
    if (accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  // Fetch or create conversation for this lead
  const { data: conversation, refetch: refetchConversation } = useQuery({
    queryKey: ['whatsapp-lead-conversation', leadId, selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return null;
      
      // Normalize phone number
      const normalizedPhone = leadPhone.replace(/[^\d]/g, "");
      
      // Try to find existing conversation
      const { data: existing, error: findError } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('account_id', selectedAccountId)
        .or(`lead_id.eq.${leadId},customer_phone.eq.${normalizedPhone}`)
        .maybeSingle();
      
      if (findError && findError.code !== 'PGRST116') throw findError;
      
      if (existing) {
        // Update lead_id if not set
        if (!existing.lead_id) {
          await supabase
            .from('whatsapp_conversations')
            .update({ lead_id: leadId })
            .eq('id', existing.id);
        }
        return existing as WhatsAppConversation;
      }
      
      // Create new conversation
      const { data: newConv, error: createError } = await supabase
        .from('whatsapp_conversations')
        .insert({
          account_id: selectedAccountId,
          customer_phone: normalizedPhone,
          customer_name: leadName || null,
          lead_id: leadId,
          status: 'active'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      return newConv as WhatsAppConversation;
    },
    enabled: !!selectedAccountId && !!leadPhone
  });

  // Fetch messages for the conversation
  const { data: messages, isLoading: messagesLoading, refetch: refetchMessages } = useQuery({
    queryKey: ['whatsapp-lead-messages', conversation?.id],
    queryFn: async () => {
      if (!conversation?.id) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!conversation?.id,
    refetchInterval: 5000
  });

  // Fetch approved templates for the account (for sending)
  const { data: templates } = useQuery({
    queryKey: ['whatsapp-templates-approved', selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, name, language, category, status, components')
        .eq('account_id', selectedAccountId)
        .eq('status', 'APPROVED')
        .order('name');
      
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!selectedAccountId
  });

  // Fetch ALL templates for message display (includes all languages)
  const { data: allTemplates } = useQuery({
    queryKey: ['whatsapp-templates-all', selectedAccountId],
    queryFn: async () => {
      if (!selectedAccountId) return [];
      
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('id, name, language, category, status, components')
        .eq('account_id', selectedAccountId)
        .order('name');
      
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!selectedAccountId
  });

  // Calculate conversation window status
  const windowStatus = messages ? getConversationWindow(messages) : { isOpen: false, lastInboundAt: null, hoursRemaining: 0, minutesRemaining: 0 };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Extract template parameters when template is selected
  useEffect(() => {
    if (selectedTemplateId && templates) {
      const template = templates.find(t => t.id === selectedTemplateId);
      if (template) {
        const components = template.components;
        let paramCount = 0;
        
        if (Array.isArray(components)) {
          const bodyComponent = components.find((c: any) => c.type === 'BODY');
          if (bodyComponent?.text) {
            const matches = bodyComponent.text.match(/\{\{\d+\}\}/g);
            paramCount = matches ? matches.length : 0;
          }
        }
        
        // Pre-fill with lead data
        const defaultParams: string[] = [];
        for (let i = 0; i < paramCount; i++) {
          if (i === 0) defaultParams.push(leadName || 'Cliente');
          else defaultParams.push('');
        }
        setTemplateParams(defaultParams);
      }
    }
  }, [selectedTemplateId, templates, leadName]);

  // Send free-form message (only within 24h window)
  const sendTextMessage = async () => {
    if (!message.trim() || !conversation || !selectedAccountId) return;
    if (!windowStatus.isOpen) {
      toast.error("Finestra 24h chiusa. Usa un template per riavviare la conversazione.");
      return;
    }
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          account_id: selectedAccountId,
          to: conversation.customer_phone,
          type: 'text',
          content: message.trim(),
          sent_by: currentUserId,
          lead_id: leadId
        }
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Errore invio messaggio');
      }
      
      setMessage('');
      refetchMessages();
      toast.success('Messaggio inviato');
    } catch (err: any) {
      toast.error(err.message || 'Errore invio');
    } finally {
      setIsSending(false);
    }
  };

  // Send template message
  const sendTemplateMessage = async () => {
    if (!selectedTemplateId || !conversation || !selectedAccountId) return;
    
    const template = templates?.find(t => t.id === selectedTemplateId);
    if (!template) return;
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: {
          account_id: selectedAccountId,
          to: conversation.customer_phone,
          type: 'template',
          template_name: template.name,
          template_language: template.language,
          template_params: templateParams.filter(p => p.trim() !== ''),
          sent_by: currentUserId,
          lead_id: leadId
        }
      });
      
      if (error || !data?.success) {
        throw new Error(data?.error || 'Errore invio template');
      }
      
      setSelectedTemplateId('');
      setTemplateParams([]);
      refetchMessages();
      toast.success('Template inviato');
    } catch (err: any) {
      toast.error(err.message || 'Errore invio');
    } finally {
      setIsSending(false);
    }
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

  // Helper to resolve template content from templates list
  const resolveTemplateContent = (templateName: string, templateParams: any[] | null): string => {
    // Find matching template in ALL templates (includes all languages)
    // Try to find any version of this template
    const template = allTemplates?.find(t => t.name === templateName) || templates?.find(t => t.name === templateName);
    if (!template || !Array.isArray(template.components)) {
      return `[Template: ${templateName}]`;
    }
    
    // Extract body text from template components
    const bodyComponent = template.components.find((c: any) => c.type === 'BODY');
    let bodyText = bodyComponent?.text || '';
    
    // Replace variables with params
    if (templateParams && Array.isArray(templateParams)) {
      templateParams.forEach((param, index) => {
        bodyText = bodyText.replace(`{{${index + 1}}}`, String(param));
      });
    }
    
    // Also get header if present
    const headerComponent = template.components.find((c: any) => c.type === 'HEADER');
    let headerText = '';
    if (headerComponent?.format === 'TEXT' && headerComponent?.text) {
      headerText = headerComponent.text + '\n\n';
    }
    
    // Get footer if present
    const footerComponent = template.components.find((c: any) => c.type === 'FOOTER');
    let footerText = '';
    if (footerComponent?.text) {
      footerText = '\n\n' + footerComponent.text;
    }
    
    // Get buttons if present
    const buttonsComponent = template.components.find((c: any) => c.type === 'BUTTONS');
    let buttonsText = '';
    if (buttonsComponent?.buttons && Array.isArray(buttonsComponent.buttons)) {
      const buttonLabels = buttonsComponent.buttons.map((b: any) => `🔘 ${b.text}`).join(' | ');
      buttonsText = '\n\n' + buttonLabels;
    }
    
    return headerText + bodyText + footerText + buttonsText;
  };

  const renderMessageContent = (msg: WhatsAppMessage) => {
    if (msg.message_type === 'template' && msg.template_name) {
      // Try to get content from message first, or resolve from template
      let displayContent = msg.content;
      
      if (!displayContent || displayContent.includes('{{')) {
        // Resolve from template if content is empty or still has placeholders
        displayContent = resolveTemplateContent(msg.template_name, msg.template_params);
      } else if (msg.template_params && Array.isArray(msg.template_params)) {
        // Replace any remaining placeholders
        msg.template_params.forEach((param, index) => {
          displayContent = displayContent!.replace(`{{${index + 1}}}`, String(param));
        });
      }
      
      return (
        <div className="space-y-1">
          <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
          <Badge variant="outline" className="text-xs">
            <Bot className="h-3 w-3 mr-1" />
            {msg.template_name}
          </Badge>
        </div>
      );
    }
    
    if (msg.message_type === 'interactive' && msg.interactive_data) {
      const data = msg.interactive_data as any;
      return (
        <div className="space-y-1">
          {msg.content && <p className="text-sm whitespace-pre-wrap">{msg.content}</p>}
          {data.button_text && (
            <Badge variant="secondary" className="text-xs">🔘 {data.button_text}</Badge>
          )}
        </div>
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{msg.content || ""}</p>;
  };

  const getSelectedTemplatePreview = () => {
    if (!selectedTemplateId || !templates) return null;
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return null;
    
    let bodyText = '';
    if (Array.isArray(template.components)) {
      const bodyComp = template.components.find((c: any) => c.type === 'BODY');
      bodyText = bodyComp?.text || '';
    }
    
    // Replace parameters with values
    templateParams.forEach((param, idx) => {
      bodyText = bodyText.replace(`{{${idx + 1}}}`, param || `[param ${idx + 1}]`);
    });
    
    return bodyText;
  };

  // No accounts
  if (!accountsLoading && (!accounts || accounts.length === 0)) {
    return (
      <div className="text-center py-6">
        <MessageCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">
          Nessun account WhatsApp Business API configurato
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Account selector */}
      {accounts && accounts.length > 1 && (
        <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Seleziona account WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map(acc => (
              <SelectItem key={acc.id} value={acc.id}>
                {acc.verified_name || acc.display_phone_number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Window status banner */}
      {conversation && messages && messages.length > 0 && (
        <Alert variant={windowStatus.isOpen ? "default" : "destructive"} className="py-2">
          <div className="flex items-center gap-2">
            {windowStatus.isOpen ? (
              <>
                <Unlock className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm">
                  <span className="font-medium text-green-700">Finestra attiva</span>
                  <span className="text-muted-foreground ml-2">
                    ({windowStatus.hoursRemaining}h {windowStatus.minutesRemaining}m rimanenti)
                  </span>
                </AlertDescription>
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <span className="font-medium">Finestra 24h chiusa</span>
                  <span className="text-muted-foreground ml-2">— Usa un template per riavviare</span>
                </AlertDescription>
              </>
            )}
          </div>
        </Alert>
      )}

      {/* Messages area */}
      <Card>
        <CardContent className="p-0">
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
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {/* Show who sent the message for outbound */}
                      {msg.direction === 'outbound' && msg.sent_by && (
                        <p className="text-xs opacity-70 mb-1 font-medium">
                          {getUserName(msg.sent_by) || 'Operatore'}
                        </p>
                      )}
                      {msg.direction === 'outbound' && !msg.sent_by && msg.message_type === 'template' && (
                        <p className="text-xs opacity-70 mb-1 font-medium flex items-center gap-1">
                          <Bot className="h-3 w-3" /> Automazione
                        </p>
                      )}
                      
                      {renderMessageContent(msg)}
                      
                      <div className={`flex items-center gap-1 mt-1 ${
                        msg.direction === 'outbound' ? 'justify-end' : ''
                      }`}>
                        <span className={`text-xs ${
                          msg.direction === 'outbound' ? 'opacity-70' : 'text-muted-foreground'
                        }`}>
                          {format(new Date(msg.created_at), 'dd/MM HH:mm')}
                        </span>
                        {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                      </div>
                      
                      {msg.status === 'failed' && msg.error_message && (
                        <p className="text-xs text-destructive mt-1">{msg.error_message}</p>
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
                <p className="text-xs mt-1">Invia un template per iniziare la conversazione</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input area - changes based on window status */}
      {conversation && (
        <div className="space-y-3">
          {/* Template selector (always visible, highlighted when window is closed) */}
          <div className={`space-y-2 p-3 rounded-lg border ${!windowStatus.isOpen ? 'bg-accent/50 border-primary/30' : 'bg-muted/30'}`}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              {!windowStatus.isOpen ? 'Invia Template (richiesto)' : 'Invia Template'}
            </div>
            
            <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona un template approvato" />
              </SelectTrigger>
              <SelectContent>
                {templates?.map(template => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} ({template.language.toUpperCase()}) - {template.category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Template parameters */}
            {selectedTemplateId && templateParams.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Parametri template:</p>
                {templateParams.map((param, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Parametro {{${idx + 1}}}`}
                    value={param}
                    onChange={(e) => {
                      const newParams = [...templateParams];
                      newParams[idx] = e.target.value;
                      setTemplateParams(newParams);
                    }}
                    className="h-8 text-sm"
                  />
                ))}
              </div>
            )}
            
            {/* Template preview */}
            {selectedTemplateId && (
              <div className="bg-muted/50 rounded p-2 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Anteprima:</p>
                <p className="whitespace-pre-wrap">{getSelectedTemplatePreview()}</p>
              </div>
            )}
            
            {selectedTemplateId && (
              <Button 
                onClick={sendTemplateMessage} 
                disabled={isSending}
                className="w-full"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                Invia Template
              </Button>
            )}
          </div>

          {/* Free-form text input (only when window is open) */}
          {windowStatus.isOpen && (
            <div className="flex gap-2">
              <Input
                placeholder="Scrivi un messaggio..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
                    e.preventDefault();
                    sendTextMessage();
                  }
                }}
                disabled={isSending}
                className="flex-1"
              />
              <Button 
                onClick={sendTextMessage}
                disabled={isSending || !message.trim()}
                size="icon"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Refresh button */}
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs"
        onClick={() => {
          refetchConversation();
          refetchMessages();
        }}
      >
        <RefreshCw className="h-3 w-3 mr-1" />
        Aggiorna
      </Button>
    </div>
  );
}
