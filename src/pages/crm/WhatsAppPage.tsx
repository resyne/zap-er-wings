import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  MessageCircle, Plus, Settings, ArrowLeft, Building2, 
  Send, Phone, CreditCard, FileText, RefreshCw, Check,
  CheckCheck, Clock, AlertCircle, User, Pencil, Trash2,
  DollarSign, MessageSquare, UserPlus, Search, Copy, 
  ExternalLink, Webhook, Shield, Link2
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  color: string;
  is_active: boolean;
}

interface WhatsAppAccount {
  id: string;
  business_unit_id: string;
  phone_number_id: string;
  display_phone_number: string;
  waba_id: string;
  verified_name: string | null;
  quality_rating: string | null;
  messaging_limit: string | null;
  status: string;
  credits_balance: number;
  is_active: boolean;
  created_at: string;
}

interface WhatsAppTemplate {
  id: string;
  account_id: string;
  template_id: string | null;
  name: string;
  language: string;
  category: string;
  status: string;
  components: any;
  rejection_reason: string | null;
  created_at: string;
}

interface WhatsAppConversation {
  id: string;
  account_id: string;
  customer_phone: string;
  customer_name: string | null;
  customer_id: string | null;
  lead_id: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
  expires_at: string | null;
  created_at: string;
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
  status: string;
  error_message: string | null;
  created_at: string;
}

interface CreditTransaction {
  id: string;
  account_id: string;
  amount: number;
  transaction_type: string;
  conversation_type: string | null;
  balance_after: number | null;
  notes: string | null;
  created_at: string;
}

export default function WhatsAppPage() {
  const queryClient = useQueryClient();
  const [selectedBU, setSelectedBU] = useState<BusinessUnit | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<WhatsAppAccount | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<WhatsAppConversation | null>(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [conversationSearch, setConversationSearch] = useState("");
  const [newContactData, setNewContactData] = useState({
    phone: '',
    name: '',
    customer_id: '',
    lead_id: ''
  });
  
  const [accountFormData, setAccountFormData] = useState({
    phone_number_id: '',
    display_phone_number: '',
    waba_id: '',
    access_token: '',
    verified_name: ''
  });

  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    language: 'it',
    category: 'MARKETING',
    body: ''
  });

  const [creditAmount, setCreditAmount] = useState('');

  // Query per clienti e lead (per associazione)
  const { data: customers } = useQuery({
    queryKey: ['customers-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, email')
        .eq('active', true)
        .order('name')
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  const { data: leads } = useQuery({
    queryKey: ['leads-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('id, contact_name, phone, email')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  // Queries
  const { data: businessUnits } = useQuery({
    queryKey: ['business-units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_units')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data as BusinessUnit[];
    }
  });

  const { data: accounts } = useQuery({
    queryKey: ['whatsapp-accounts', selectedBU?.id],
    queryFn: async () => {
      if (!selectedBU) return [];
      const { data, error } = await supabase
        .from('whatsapp_accounts')
        .select('*')
        .eq('business_unit_id', selectedBU.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppAccount[];
    },
    enabled: !!selectedBU
  });

  const { data: templates } = useQuery({
    queryKey: ['whatsapp-templates', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('account_id', selectedAccount.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppTemplate[];
    },
    enabled: !!selectedAccount
  });

  const { data: conversations } = useQuery({
    queryKey: ['whatsapp-conversations', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await supabase
        .from('whatsapp_conversations')
        .select('*')
        .eq('account_id', selectedAccount.id)
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      return data as WhatsAppConversation[];
    },
    enabled: !!selectedAccount
  });

  const { data: messages } = useQuery({
    queryKey: ['whatsapp-messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as WhatsAppMessage[];
    },
    enabled: !!selectedConversation
  });

  const { data: creditTransactions } = useQuery({
    queryKey: ['whatsapp-credits', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await supabase
        .from('whatsapp_credit_transactions')
        .select('*')
        .eq('account_id', selectedAccount.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as CreditTransaction[];
    },
    enabled: !!selectedAccount
  });

  // Mutations
  const saveAccountMutation = useMutation({
    mutationFn: async (data: typeof accountFormData) => {
      const { error } = await supabase.from('whatsapp_accounts').insert({
        business_unit_id: selectedBU!.id,
        phone_number_id: data.phone_number_id,
        display_phone_number: data.display_phone_number,
        waba_id: data.waba_id,
        access_token: data.access_token,
        verified_name: data.verified_name || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      toast.success('Account WhatsApp aggiunto');
      setIsAccountDialogOpen(false);
      setAccountFormData({ phone_number_id: '', display_phone_number: '', waba_id: '', access_token: '', verified_name: '' });
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: typeof templateFormData) => {
      const { error } = await supabase.from('whatsapp_templates').insert({
        account_id: selectedAccount!.id,
        name: data.name,
        language: data.language,
        category: data.category,
        components: {
          body: { type: 'BODY', text: data.body }
        },
        status: 'PENDING'
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-templates'] });
      toast.success('Template creato');
      setIsTemplateDialogOpen(false);
      setTemplateFormData({ name: '', language: 'it', category: 'MARKETING', body: '' });
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newBalance = (selectedAccount!.credits_balance || 0) + amount;
      
      await supabase.from('whatsapp_credit_transactions').insert({
        account_id: selectedAccount!.id,
        amount: amount,
        transaction_type: 'topup',
        balance_after: newBalance,
        notes: 'Ricarica manuale'
      });

      const { error } = await supabase
        .from('whatsapp_accounts')
        .update({ credits_balance: newBalance })
        .eq('id', selectedAccount!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-credits'] });
      toast.success('Crediti aggiunti');
      setIsCreditDialogOpen(false);
      setCreditAmount('');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase.from('whatsapp_messages').insert({
        conversation_id: selectedConversation!.id,
        direction: 'outbound',
        message_type: 'text',
        content: content,
        status: 'sent'
      });
      if (error) throw error;

      // Update conversation
      await supabase.from('whatsapp_conversations').update({
        last_message_at: new Date().toISOString(),
        last_message_preview: content.substring(0, 100)
      }).eq('id', selectedConversation!.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      setNewMessage('');
      toast.success('Messaggio inviato');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof newContactData) => {
      // Verifica se esiste già una conversazione con questo numero
      const { data: existing } = await supabase
        .from('whatsapp_conversations')
        .select('id')
        .eq('account_id', selectedAccount!.id)
        .eq('customer_phone', data.phone)
        .maybeSingle();

      if (existing) {
        throw new Error('Esiste già una conversazione con questo numero');
      }

      const { data: newConv, error } = await supabase.from('whatsapp_conversations').insert({
        account_id: selectedAccount!.id,
        customer_phone: data.phone,
        customer_name: data.name || null,
        customer_id: data.customer_id || null,
        lead_id: data.lead_id || null,
        status: 'active'
      }).select().single();
      
      if (error) throw error;
      return newConv;
    },
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Nuova conversazione creata');
      setIsNewConversationDialogOpen(false);
      setNewContactData({ phone: '', name: '', customer_id: '', lead_id: '' });
      setSelectedConversation(newConv);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      // Prima elimina i messaggi
      await supabase.from('whatsapp_messages').delete().eq('conversation_id', conversationId);
      // Poi elimina la conversazione
      const { error } = await supabase.from('whatsapp_conversations').delete().eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-conversations'] });
      toast.success('Conversazione eliminata');
      if (selectedConversation) {
        setSelectedConversation(null);
      }
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Filtra conversazioni in base alla ricerca
  const filteredConversations = conversations?.filter(conv => {
    if (!conversationSearch) return true;
    const search = conversationSearch.toLowerCase();
    return (
      conv.customer_name?.toLowerCase().includes(search) ||
      conv.customer_phone.toLowerCase().includes(search) ||
      conv.last_message_preview?.toLowerCase().includes(search)
    );
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'read': return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case 'delivered': return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case 'sent': return <Check className="h-3 w-3 text-muted-foreground" />;
      case 'failed': return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'MARKETING': return 'bg-purple-100 text-purple-700';
      case 'UTILITY': return 'bg-blue-100 text-blue-700';
      case 'AUTHENTICATION': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-700';
      case 'PENDING': return 'bg-yellow-100 text-yellow-700';
      case 'REJECTED': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Se non è selezionata nessuna BU, mostra la selezione
  if (!selectedBU) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-green-600" />
            WhatsApp Business
          </h1>
          <p className="text-muted-foreground mt-1">
            Seleziona un'attività per gestire WhatsApp
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {businessUnits?.map(bu => (
            <Card 
              key={bu.id} 
              className="cursor-pointer hover:shadow-lg transition-shadow border-l-4"
              style={{ borderLeftColor: bu.color }}
              onClick={() => setSelectedBU(bu)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" style={{ color: bu.color }} />
                  {bu.name}
                </CardTitle>
                <CardDescription>{bu.code}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  Gestisci WhatsApp
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Vista dettaglio BU
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header con back */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedBU(null); setSelectedAccount(null); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alle attività
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MessageCircle className="h-8 w-8 text-green-600" />
            WhatsApp - {selectedBU.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci numeri, template, chat e crediti
          </p>
        </div>
        <Button onClick={() => setIsAccountDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Aggiungi Numero
        </Button>
      </div>

      {/* Account selector */}
      {accounts && accounts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {accounts.map(account => (
            <Button
              key={account.id}
              variant={selectedAccount?.id === account.id ? "default" : "outline"}
              onClick={() => setSelectedAccount(account)}
              className="flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              {account.display_phone_number}
              {account.verified_name && <span className="text-xs opacity-70">({account.verified_name})</span>}
            </Button>
          ))}
        </div>
      )}

      {/* Account Details */}
      {selectedAccount && (
        <Tabs defaultValue="chats" className="w-full">
          <TabsList>
            <TabsTrigger value="chats" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Chat
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Template
            </TabsTrigger>
            <TabsTrigger value="credits" className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Crediti
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Impostazioni
            </TabsTrigger>
          </TabsList>

          {/* Chats Tab */}
          <TabsContent value="chats" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
              {/* Conversations List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Conversazioni</CardTitle>
                    <Button size="sm" onClick={() => setIsNewConversationDialogOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca conversazioni..."
                      value={conversationSearch}
                      onChange={(e) => setConversationSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[480px]">
                    {filteredConversations?.map(conv => (
                      <div
                        key={conv.id}
                        className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedConversation?.id === conv.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedConversation(conv)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {conv.customer_name?.charAt(0) || <User className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="font-medium truncate">
                                {conv.customer_name || conv.customer_phone}
                              </p>
                              <div className="flex items-center gap-1">
                                {conv.unread_count > 0 && (
                                  <Badge className="bg-green-600">{conv.unread_count}</Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm('Eliminare questa conversazione?')) {
                                      deleteConversationMutation.mutate(conv.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {conv.last_message_preview || 'Nessun messaggio'}
                            </p>
                            {conv.last_message_at && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: it })}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!filteredConversations || filteredConversations.length === 0) && (
                      <div className="p-8 text-center text-muted-foreground">
                        <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>{conversationSearch ? 'Nessun risultato' : 'Nessuna conversazione'}</p>
                        {!conversationSearch && (
                          <Button 
                            variant="link" 
                            className="mt-2"
                            onClick={() => setIsNewConversationDialogOpen(true)}
                          >
                            <UserPlus className="h-4 w-4 mr-2" />
                            Avvia nuova chat
                          </Button>
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Chat Window */}
              <Card className="lg:col-span-2">
                {selectedConversation ? (
                  <>
                    <CardHeader className="pb-2 border-b">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarFallback>
                            {selectedConversation.customer_name?.charAt(0) || <User className="h-4 w-4" />}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">
                            {selectedConversation.customer_name || selectedConversation.customer_phone}
                          </CardTitle>
                          <CardDescription>{selectedConversation.customer_phone}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex flex-col h-[520px]">
                      <ScrollArea className="flex-1 p-4">
                        <div className="space-y-4">
                          {messages?.map(msg => (
                            <div
                              key={msg.id}
                              className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                            >
                              <div
                                className={`max-w-[70%] rounded-lg px-4 py-2 ${
                                  msg.direction === 'outbound'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-muted'
                                }`}
                              >
                                <p className="text-sm">{msg.content}</p>
                                <div className={`flex items-center justify-end gap-1 mt-1 ${
                                  msg.direction === 'outbound' ? 'text-green-100' : 'text-muted-foreground'
                                }`}>
                                  <span className="text-xs">
                                    {format(new Date(msg.created_at), 'HH:mm')}
                                  </span>
                                  {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                      <div className="p-4 border-t">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Scrivi un messaggio..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && newMessage.trim()) {
                                sendMessageMutation.mutate(newMessage.trim());
                              }
                            }}
                          />
                          <Button 
                            onClick={() => newMessage.trim() && sendMessageMutation.mutate(newMessage.trim())}
                            disabled={!newMessage.trim() || sendMessageMutation.isPending}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Seleziona una conversazione</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Template Messaggi</CardTitle>
                  <CardDescription>Gestisci i template per messaggi di marketing, utility e autenticazione</CardDescription>
                </div>
                <Button onClick={() => setIsTemplateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Template
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Lingua</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead>Creato</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates?.map(template => (
                      <TableRow key={template.id}>
                        <TableCell className="font-medium">{template.name}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(template.category)}>
                            {template.category}
                          </Badge>
                        </TableCell>
                        <TableCell>{template.language.toUpperCase()}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(template.status)}>
                            {template.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(template.created_at), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!templates || templates.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Nessun template creato
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credits Tab */}
          <TabsContent value="credits" className="mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Saldo Attuale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-green-600">
                    €{selectedAccount.credits_balance?.toFixed(2) || '0.00'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Quality Rating</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {selectedAccount.quality_rating || 'N/A'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Limite Messaggi</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {selectedAccount.messaging_limit || 'Standard'}
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Storico Transazioni</CardTitle>
                  <CardDescription>Ricariche e consumi crediti</CardDescription>
                </div>
                <Button onClick={() => setIsCreditDialogOpen(true)}>
                  <DollarSign className="h-4 w-4 mr-2" />
                  Ricarica Crediti
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Importo</TableHead>
                      <TableHead>Saldo</TableHead>
                      <TableHead>Note</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditTransactions?.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          {format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={tx.transaction_type === 'topup' ? 'default' : 'secondary'}>
                            {tx.transaction_type === 'topup' ? 'Ricarica' : 
                             tx.transaction_type === 'message_sent' ? 'Messaggio' : tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={tx.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount > 0 ? '+' : ''}{tx.amount.toFixed(2)}€
                        </TableCell>
                        <TableCell>{tx.balance_after?.toFixed(2) || '-'}€</TableCell>
                        <TableCell className="text-muted-foreground">{tx.notes || '-'}</TableCell>
                      </TableRow>
                    ))}
                    {(!creditTransactions || creditTransactions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nessuna transazione
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4 space-y-6">
            {/* Account Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Configurazione Account</CardTitle>
                <CardDescription>Dettagli dell'account WhatsApp Business</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Phone Number ID</Label>
                    <Input value={selectedAccount.phone_number_id} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Numero</Label>
                    <Input value={selectedAccount.display_phone_number} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>WABA ID</Label>
                    <Input value={selectedAccount.waba_id} readOnly className="bg-muted" />
                  </div>
                  <div>
                    <Label>Nome Verificato</Label>
                    <Input value={selectedAccount.verified_name || '-'} readOnly className="bg-muted" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="font-medium">Stato Account</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedAccount.is_active ? 'Attivo' : 'Disattivato'}
                    </p>
                  </div>
                  <Badge variant={selectedAccount.is_active ? 'default' : 'secondary'}>
                    {selectedAccount.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Webhook Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Configurazione Webhook
                </CardTitle>
                <CardDescription>
                  Configura il webhook per ricevere messaggi in tempo reale da WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Webhook URL */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Callback URL
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      value="https://erp.abbattitorizapper.it/functions/v1/whatsapp-webhook"
                      readOnly 
                      className="bg-muted font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText('https://erp.abbattitorizapper.it/functions/v1/whatsapp-webhook');
                        toast.success('URL copiato negli appunti');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Copia questo URL e incollalo nella configurazione del webhook su Meta Business Manager
                  </p>
                </div>

                {/* Verify Token */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Verify Token
                  </Label>
                  <div className="flex gap-2">
                    <Input 
                      value="WHATSAPP_VERIFY_TOKEN_ZAPPER"
                      readOnly 
                      className="bg-muted font-mono text-sm"
                    />
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText('WHATSAPP_VERIFY_TOKEN_ZAPPER');
                        toast.success('Token copiato negli appunti');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Usa questo token come "Verify Token" durante la configurazione del webhook
                  </p>
                </div>

                {/* Webhook Fields */}
                <div className="space-y-2">
                  <Label>Campi Webhook da sottoscrivere</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {['messages', 'message_template_status_update', 'message_template_quality_update'].map(field => (
                      <div key={field} className="flex items-center gap-2 p-2 rounded-md bg-muted">
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-mono">{field}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Assicurati di selezionare questi campi nella configurazione del webhook
                  </p>
                </div>

                {/* Instructions */}
                <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Istruzioni di configurazione
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Vai su <strong>Meta Business Manager</strong> → <strong>WhatsApp</strong> → <strong>Configuration</strong></li>
                    <li>Nella sezione <strong>Webhook</strong>, clicca su <strong>Edit</strong></li>
                    <li>Inserisci il <strong>Callback URL</strong> copiato sopra</li>
                    <li>Inserisci il <strong>Verify Token</strong> copiato sopra</li>
                    <li>Clicca su <strong>Verify and save</strong></li>
                    <li>Sottoscrivi i campi: <code>messages</code>, <code>message_template_status_update</code></li>
                  </ol>
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <a 
                      href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started#configure-webhooks" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Documentazione ufficiale Meta
                    </a>
                  </Button>
                </div>

                {/* Test Webhook */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="font-medium">Test Webhook</p>
                    <p className="text-sm text-muted-foreground">
                      Verifica che il webhook sia configurato correttamente
                    </p>
                  </div>
                  <Button 
                    variant="outline"
                    onClick={async () => {
                      try {
                        const webhookUrl = `${window.location.origin.replace('preview--', '').replace('.lovable.app', '.functions.supabase.co')}/functions/v1/whatsapp-webhook`;
                        const testUrl = `${webhookUrl}?hub.mode=subscribe&hub.verify_token=WHATSAPP_VERIFY_TOKEN_ZAPPER&hub.challenge=test123`;
                        const response = await fetch(testUrl);
                        if (response.ok) {
                          toast.success('Webhook verificato correttamente!');
                        } else {
                          toast.error('Errore nella verifica del webhook');
                        }
                      } catch (error) {
                        toast.error('Impossibile raggiungere il webhook');
                      }
                    }}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Testa Webhook
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* API Configuration Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Configurazione API
                </CardTitle>
                <CardDescription>
                  Endpoint e configurazioni per l'invio messaggi
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Endpoint (Graph API v21.0)</Label>
                  <Input 
                    value={`https://graph.facebook.com/v21.0/${selectedAccount.phone_number_id}/messages`}
                    readOnly 
                    className="bg-muted font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Headers richiesti</Label>
                  <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1">
                    <p><span className="text-blue-600">Authorization:</span> Bearer {"<ACCESS_TOKEN>"}</p>
                    <p><span className="text-blue-600">Content-Type:</span> application/json</p>
                  </div>
                </div>
                <div className="rounded-lg border p-4 bg-amber-50 dark:bg-amber-950/30">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>Nota:</strong> L'access token è memorizzato in modo sicuro e utilizzato automaticamente per l'invio dei messaggi.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* No account selected */}
      {!selectedAccount && accounts && accounts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Nessun numero configurato</h3>
            <p className="text-muted-foreground mb-4">
              Aggiungi il tuo primo numero WhatsApp Business per iniziare
            </p>
            <Button onClick={() => setIsAccountDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Numero
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add Account Dialog */}
      <Dialog open={isAccountDialogOpen} onOpenChange={setIsAccountDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi Numero WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Phone Number ID *</Label>
              <Input
                placeholder="Es: 123456789012345"
                value={accountFormData.phone_number_id}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, phone_number_id: e.target.value }))}
              />
            </div>
            <div>
              <Label>Numero di Telefono *</Label>
              <Input
                placeholder="Es: +39123456789"
                value={accountFormData.display_phone_number}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, display_phone_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>WABA ID *</Label>
              <Input
                placeholder="WhatsApp Business Account ID"
                value={accountFormData.waba_id}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, waba_id: e.target.value }))}
              />
            </div>
            <div>
              <Label>Access Token *</Label>
              <Input
                type="password"
                placeholder="Token di accesso Meta"
                value={accountFormData.access_token}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, access_token: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nome Verificato</Label>
              <Input
                placeholder="Nome del business"
                value={accountFormData.verified_name}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, verified_name: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => saveAccountMutation.mutate(accountFormData)}
              disabled={!accountFormData.phone_number_id || !accountFormData.display_phone_number || !accountFormData.waba_id}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Template Dialog */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome Template *</Label>
              <Input
                placeholder="Es: benvenuto_cliente"
                value={templateFormData.name}
                onChange={(e) => setTemplateFormData(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select 
                value={templateFormData.category} 
                onValueChange={(v) => setTemplateFormData(prev => ({ ...prev, category: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="AUTHENTICATION">Autenticazione</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lingua</Label>
              <Select 
                value={templateFormData.language} 
                onValueChange={(v) => setTemplateFormData(prev => ({ ...prev, language: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="en">Inglese</SelectItem>
                  <SelectItem value="de">Tedesco</SelectItem>
                  <SelectItem value="fr">Francese</SelectItem>
                  <SelectItem value="es">Spagnolo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Corpo del Messaggio *</Label>
              <Textarea
                placeholder="Scrivi il testo del template. Usa {{1}}, {{2}} per i parametri dinamici."
                value={templateFormData.body}
                onChange={(e) => setTemplateFormData(prev => ({ ...prev, body: e.target.value }))}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => saveTemplateMutation.mutate(templateFormData)}
              disabled={!templateFormData.name || !templateFormData.body}
            >
              Crea Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Credits Dialog */}
      <Dialog open={isCreditDialogOpen} onOpenChange={setIsCreditDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Ricarica Crediti</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Importo (€)</Label>
              <Input
                type="number"
                placeholder="Es: 50"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Saldo attuale: €{selectedAccount?.credits_balance?.toFixed(2) || '0.00'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreditDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => addCreditsMutation.mutate(parseFloat(creditAmount))}
              disabled={!creditAmount || parseFloat(creditAmount) <= 0}
            >
              Ricarica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Conversation Dialog */}
      <Dialog open={isNewConversationDialogOpen} onOpenChange={setIsNewConversationDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Conversazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Numero di Telefono *</Label>
              <Input
                placeholder="Es: +39 333 1234567"
                value={newContactData.phone}
                onChange={(e) => setNewContactData(prev => ({ ...prev, phone: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Inserisci il numero con prefisso internazionale
              </p>
            </div>
            <div>
              <Label>Nome Contatto</Label>
              <Input
                placeholder="Nome del contatto"
                value={newContactData.name}
                onChange={(e) => setNewContactData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Associa a Cliente</Label>
                <Select 
                  value={newContactData.customer_id} 
                  onValueChange={(v) => setNewContactData(prev => ({ 
                    ...prev, 
                    customer_id: v,
                    lead_id: '', // Clear lead if customer selected
                    name: prev.name || customers?.find(c => c.id === v)?.name || ''
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuno</SelectItem>
                    {customers?.map(customer => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Associa a Lead</Label>
                <Select 
                  value={newContactData.lead_id} 
                  onValueChange={(v) => setNewContactData(prev => ({ 
                    ...prev, 
                    lead_id: v,
                    customer_id: '', // Clear customer if lead selected
                    name: prev.name || leads?.find(l => l.id === v)?.contact_name || ''
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessuno</SelectItem>
                    {leads?.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.contact_name || lead.phone || 'Lead senza nome'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Puoi associare la conversazione a un cliente o lead esistente per tracciare le comunicazioni.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsNewConversationDialogOpen(false);
              setNewContactData({ phone: '', name: '', customer_id: '', lead_id: '' });
            }}>
              Annulla
            </Button>
            <Button 
              onClick={() => createConversationMutation.mutate(newContactData)}
              disabled={!newContactData.phone || createConversationMutation.isPending}
            >
              {createConversationMutation.isPending ? 'Creazione...' : 'Avvia Chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
