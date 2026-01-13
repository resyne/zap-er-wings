import { useState, useEffect, useRef } from "react";
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
  Phone, CreditCard, RefreshCw, Check,
  CheckCheck, Clock, AlertCircle, User, Trash2,
  DollarSign, MessageSquare, UserPlus, Search, Copy, 
  ExternalLink, Zap, Users, Webhook, Link2, Image, FileText, Video, Mic, Music
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import WaSenderChatInput from "@/components/wasender/WaSenderChatInput";

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  color: string;
  is_active: boolean;
}

interface WaSenderAccount {
  id: string;
  business_unit_id: string;
  phone_number: string;
  account_name: string | null;
  api_key: string | null;
  session_id: string | null;
  webhook_secret: string | null;
  status: string;
  credits_balance: number;
  is_active: boolean;
  created_at: string;
}

interface WaSenderConversation {
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
  created_at: string;
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

interface CreditTransaction {
  id: string;
  account_id: string;
  amount: number;
  transaction_type: string;
  balance_after: number | null;
  notes: string | null;
  created_at: string;
}

interface WaSenderContact {
  id: string;
  account_id: string;
  phone: string;
  name: string | null;
  customer_id: string | null;
  lead_id: string | null;
  tags: string[];
  created_at: string;
}

export default function WaSenderPage() {
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedBU, setSelectedBU] = useState<BusinessUnit | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<WaSenderAccount | null>(null);
  const [selectedConversation, setSelectedConversation] = useState<WaSenderConversation | null>(null);
  const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
  const [isCreditDialogOpen, setIsCreditDialogOpen] = useState(false);
  const [isNewConversationDialogOpen, setIsNewConversationDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [conversationSearch, setConversationSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [newContactData, setNewContactData] = useState({
    phone: '',
    name: '',
    customer_id: '',
    lead_id: ''
  });
  
  const [accountFormData, setAccountFormData] = useState({
    phone_number: '',
    account_name: '',
    api_key: '',
    session_id: ''
  });

  const [contactFormData, setContactFormData] = useState({
    phone: '',
    name: '',
    customer_id: '',
    lead_id: '',
    tags: ''
  });

  const [creditAmount, setCreditAmount] = useState('');

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation]);

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
    queryKey: ['wasender-accounts', selectedBU?.id],
    queryFn: async () => {
      if (!selectedBU) return [];
      const { data, error } = await (supabase as any)
        .from('wasender_accounts')
        .select('*')
        .eq('business_unit_id', selectedBU.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as WaSenderAccount[];
    },
    enabled: !!selectedBU
  });

  const { data: conversations, refetch: refetchConversations } = useQuery({
    queryKey: ['wasender-conversations', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await (supabase as any)
        .from('wasender_conversations')
        .select('*')
        .eq('account_id', selectedAccount.id)
        .order('last_message_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as WaSenderConversation[];
    },
    enabled: !!selectedAccount,
    refetchInterval: 5000 // Auto refresh every 5 seconds
  });

  const { data: messages, refetch: refetchMessages } = useQuery({
    queryKey: ['wasender-messages', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await (supabase as any)
        .from('wasender_messages')
        .select('*')
        .eq('conversation_id', selectedConversation.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      // Mark as read
      if (selectedConversation.unread_count > 0) {
        await (supabase as any)
          .from('wasender_conversations')
          .update({ unread_count: 0 })
          .eq('id', selectedConversation.id);
        refetchConversations();
      }
      
      return data as WaSenderMessage[];
    },
    enabled: !!selectedConversation,
    refetchInterval: 3000 // Auto refresh every 3 seconds
  });

  const { data: contacts } = useQuery({
    queryKey: ['wasender-contacts', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await (supabase as any)
        .from('wasender_contacts')
        .select('*')
        .eq('account_id', selectedAccount.id)
        .order('name', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as WaSenderContact[];
    },
    enabled: !!selectedAccount
  });

  const { data: creditTransactions } = useQuery({
    queryKey: ['wasender-credits', selectedAccount?.id],
    queryFn: async () => {
      if (!selectedAccount) return [];
      const { data, error } = await (supabase as any)
        .from('wasender_credit_transactions')
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
      const { error } = await (supabase as any).from('wasender_accounts').insert({
        business_unit_id: selectedBU!.id,
        phone_number: data.phone_number,
        account_name: data.account_name || null,
        api_key: data.api_key || null,
        session_id: data.session_id || null
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-accounts'] });
      toast.success('Account WaSender aggiunto');
      setIsAccountDialogOpen(false);
      setAccountFormData({ phone_number: '', account_name: '', api_key: '', session_id: '' });
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const saveContactMutation = useMutation({
    mutationFn: async (data: typeof contactFormData) => {
      const tags = data.tags ? data.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
      const { error } = await (supabase as any).from('wasender_contacts').insert({
        account_id: selectedAccount!.id,
        phone: data.phone,
        name: data.name || null,
        customer_id: data.customer_id || null,
        lead_id: data.lead_id || null,
        tags
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-contacts'] });
      toast.success('Contatto aggiunto');
      setIsContactDialogOpen(false);
      setContactFormData({ phone: '', name: '', customer_id: '', lead_id: '', tags: '' });
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const syncContactsMutation = useMutation({
    mutationFn: async () => {
      let synced = 0;
      
      // Sync customers with phone numbers
      if (customers) {
        for (const customer of customers) {
          if (!customer.phone) continue;
          
          // Check if contact exists
          const { data: existing } = await (supabase as any)
            .from('wasender_contacts')
            .select('id')
            .eq('account_id', selectedAccount!.id)
            .eq('phone', customer.phone)
            .maybeSingle();
          
          if (!existing) {
            await (supabase as any).from('wasender_contacts').insert({
              account_id: selectedAccount!.id,
              phone: customer.phone,
              name: customer.name,
              customer_id: customer.id,
              tags: ['cliente']
            });
            synced++;
          }
        }
      }
      
      // Sync leads with phone numbers
      if (leads) {
        for (const lead of leads) {
          if (!lead.phone) continue;
          
          const { data: existing } = await (supabase as any)
            .from('wasender_contacts')
            .select('id')
            .eq('account_id', selectedAccount!.id)
            .eq('phone', lead.phone)
            .maybeSingle();
          
          if (!existing) {
            await (supabase as any).from('wasender_contacts').insert({
              account_id: selectedAccount!.id,
              phone: lead.phone,
              name: lead.contact_name,
              lead_id: lead.id,
              tags: ['lead']
            });
            synced++;
          }
        }
      }
      
      return synced;
    },
    onSuccess: (synced) => {
      queryClient.invalidateQueries({ queryKey: ['wasender-contacts'] });
      toast.success(`${synced} contatti sincronizzati`);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const addCreditsMutation = useMutation({
    mutationFn: async (amount: number) => {
      const newBalance = (selectedAccount!.credits_balance || 0) + amount;
      
      await (supabase as any).from('wasender_credit_transactions').insert({
        account_id: selectedAccount!.id,
        amount: amount,
        transaction_type: 'topup',
        balance_after: newBalance,
        notes: 'Ricarica manuale'
      });

      const { error } = await (supabase as any)
        .from('wasender_accounts')
        .update({ credits_balance: newBalance })
        .eq('id', selectedAccount!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['wasender-credits'] });
      toast.success('Crediti aggiunti');
      setIsCreditDialogOpen(false);
      setCreditAmount('');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const handleMessageSent = () => {
    queryClient.invalidateQueries({ queryKey: ['wasender-messages'] });
    queryClient.invalidateQueries({ queryKey: ['wasender-conversations'] });
  };

  const createConversationMutation = useMutation({
    mutationFn: async (data: typeof newContactData) => {
      // Check if conversation exists
      const { data: existing } = await (supabase as any)
        .from('wasender_conversations')
        .select('id')
        .eq('account_id', selectedAccount!.id)
        .eq('customer_phone', data.phone)
        .maybeSingle();

      if (existing) {
        // Select existing conversation
        const { data: conv } = await (supabase as any)
          .from('wasender_conversations')
          .select('*')
          .eq('id', existing.id)
          .single();
        return conv;
      }

      const { data: newConv, error } = await (supabase as any).from('wasender_conversations').insert({
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
      queryClient.invalidateQueries({ queryKey: ['wasender-conversations'] });
      toast.success('Conversazione pronta');
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
      await (supabase as any).from('wasender_messages').delete().eq('conversation_id', conversationId);
      const { error } = await (supabase as any).from('wasender_conversations').delete().eq('id', conversationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-conversations'] });
      toast.success('Conversazione eliminata');
      setSelectedConversation(null);
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await (supabase as any).from('wasender_contacts').delete().eq('id', contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-contacts'] });
      toast.success('Contatto eliminato');
    },
    onError: (error: Error) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      // Prima elimina tutti i dati correlati
      // 1. Elimina i messaggi di tutte le conversazioni dell'account
      const { data: convs } = await (supabase as any)
        .from('wasender_conversations')
        .select('id')
        .eq('account_id', accountId);
      
      if (convs && convs.length > 0) {
        const convIds = convs.map((c: any) => c.id);
        await (supabase as any)
          .from('wasender_messages')
          .delete()
          .in('conversation_id', convIds);
      }
      
      // 2. Elimina le conversazioni
      await (supabase as any)
        .from('wasender_conversations')
        .delete()
        .eq('account_id', accountId);
      
      // 3. Elimina i contatti
      await (supabase as any)
        .from('wasender_contacts')
        .delete()
        .eq('account_id', accountId);
      
      // 4. Elimina le transazioni crediti
      await (supabase as any)
        .from('wasender_credit_transactions')
        .delete()
        .eq('account_id', accountId);
      
      // 5. Infine elimina l'account
      const { error } = await (supabase as any)
        .from('wasender_accounts')
        .delete()
        .eq('id', accountId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wasender-accounts'] });
      setSelectedAccount(null);
      setSelectedConversation(null);
      toast.success('Numero e tutti i dati correlati eliminati');
    },
    onError: (error: Error) => {
      toast.error(`Errore eliminazione: ${error.message}`);
    }
  });

  // Filtra conversazioni
  const filteredConversations = conversations?.filter(conv => {
    if (!conversationSearch) return true;
    const search = conversationSearch.toLowerCase();
    return (
      conv.customer_name?.toLowerCase().includes(search) ||
      conv.customer_phone.toLowerCase().includes(search) ||
      conv.last_message_preview?.toLowerCase().includes(search)
    );
  });

  // Filtra contatti
  const filteredContacts = contacts?.filter(contact => {
    if (!contactSearch) return true;
    const search = contactSearch.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(search) ||
      contact.phone.toLowerCase().includes(search) ||
      contact.tags?.some(t => t.toLowerCase().includes(search))
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

  const startConversationFromContact = (contact: WaSenderContact) => {
    setNewContactData({
      phone: contact.phone,
      name: contact.name || '',
      customer_id: contact.customer_id || '',
      lead_id: contact.lead_id || ''
    });
    createConversationMutation.mutate({
      phone: contact.phone,
      name: contact.name || '',
      customer_id: contact.customer_id || '',
      lead_id: contact.lead_id || ''
    });
  };

  // Always use the Supabase project URL for the webhook endpoint
  const webhookUrl = `https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/wasender-webhook`;

  // Se non è selezionata nessuna BU
  if (!selectedBU) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-emerald-600" />
            WaSender WhatsApp
          </h1>
          <p className="text-muted-foreground mt-1">
            Seleziona un'attività per gestire WhatsApp via WaSenderAPI
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
                  Gestisci WaSender
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedBU(null); setSelectedAccount(null); setSelectedConversation(null); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Torna alle attività
        </Button>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Zap className="h-8 w-8 text-emerald-600" />
            WaSender - {selectedBU.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestisci numeri, contatti, chat e crediti via WaSenderAPI
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
            <div key={account.id} className="flex items-center gap-1 group">
              <Button
                variant={selectedAccount?.id === account.id ? "default" : "outline"}
                onClick={() => { setSelectedAccount(account); setSelectedConversation(null); }}
                className="flex items-center gap-2"
              >
                <Phone className="h-4 w-4" />
                {account.phone_number}
                {account.account_name && <span className="text-xs opacity-70">({account.account_name})</span>}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  if (confirm(`Eliminare il numero ${account.phone_number} e tutti i dati correlati (chat, contatti, crediti)?`)) {
                    deleteAccountMutation.mutate(account.id);
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
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
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contatti
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
                        className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors group ${
                          selectedConversation?.id === conv.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => setSelectedConversation(conv)}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback className="bg-emerald-100 text-emerald-700">
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
                                  <Badge className="bg-emerald-600">{conv.unread_count}</Badge>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
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
                        <Button variant="link" className="mt-2" onClick={() => setIsNewConversationDialogOpen(true)}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Avvia nuova chat
                        </Button>
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
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">
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
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-muted'
                                }`}
                              >
                                {/* Media preview */}
                                {msg.media_url && msg.message_type === 'image' && (
                                  <img 
                                    src={msg.media_url} 
                                    alt="Immagine" 
                                    className="max-w-full rounded mb-2 max-h-48 object-cover"
                                  />
                                )}
                                {msg.media_url && msg.message_type === 'video' && (
                                  <video 
                                    src={msg.media_url} 
                                    controls 
                                    className="max-w-full rounded mb-2 max-h-48"
                                  />
                                )}
                                {msg.message_type === 'audio' && (
                                  <div className="mb-2">
                                    {msg.media_url ? (
                                      <audio 
                                        src={msg.media_url} 
                                        controls 
                                        className="w-full max-w-[280px]"
                                        preload="metadata"
                                      />
                                    ) : (
                                      <div className={`flex items-center gap-2 p-3 rounded ${
                                        msg.direction === 'outbound' ? 'bg-emerald-700/50' : 'bg-muted'
                                      }`}>
                                        <Music className="h-5 w-5" />
                                        <span className="text-sm">Messaggio vocale (non disponibile)</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {msg.media_url && msg.message_type === 'document' && (
                                  <a 
                                    href={msg.media_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 p-2 rounded mb-2 ${
                                      msg.direction === 'outbound' ? 'bg-emerald-700' : 'bg-background'
                                    }`}
                                  >
                                    <FileText className="h-5 w-5" />
                                    <span className="text-sm underline">Apri documento</span>
                                  </a>
                                )}
                                
                                {msg.content && (
                                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                )}
                                
                                {!msg.content && msg.message_type === 'image' && !msg.media_url && (
                                  <p className="text-sm opacity-75">📷 Immagine</p>
                                )}
                                {!msg.content && msg.message_type === 'video' && !msg.media_url && (
                                  <p className="text-sm opacity-75">🎬 Video</p>
                                )}
                                {!msg.content && msg.message_type === 'document' && !msg.media_url && (
                                  <p className="text-sm opacity-75">📄 Documento</p>
                                )}
                                
                                <div className={`flex items-center justify-end gap-1 mt-1 ${
                                  msg.direction === 'outbound' ? 'text-emerald-100' : 'text-muted-foreground'
                                }`}>
                                  <span className="text-xs">
                                    {format(new Date(msg.created_at), 'HH:mm')}
                                  </span>
                                  {msg.direction === 'outbound' && getStatusIcon(msg.status)}
                                </div>
                                {msg.error_message && (
                                  <p className="text-xs text-red-200 mt-1">{msg.error_message}</p>
                                )}
                              </div>
                            </div>
                          ))}
                          <div ref={messagesEndRef} />
                        </div>
                      </ScrollArea>
                      <WaSenderChatInput
                        conversationId={selectedConversation.id}
                        customerPhone={selectedConversation.customer_phone}
                        accountId={selectedAccount.id}
                        onMessageSent={handleMessageSent}
                        isSending={isSendingMessage}
                        setIsSending={setIsSendingMessage}
                      />
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="h-full flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                      <p>Seleziona una conversazione per iniziare</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Contacts Tab */}
          <TabsContent value="contacts" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Rubrica Contatti</CardTitle>
                  <CardDescription>Gestisci i contatti per invio messaggi rapido</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => syncContactsMutation.mutate()} disabled={syncContactsMutation.isPending}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${syncContactsMutation.isPending ? 'animate-spin' : ''}`} />
                    Sincronizza da CRM
                  </Button>
                  <Button onClick={() => setIsContactDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Contatto
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Cerca contatti..."
                      value={contactSearch}
                      onChange={(e) => setContactSearch(e.target.value)}
                      className="pl-8 max-w-sm"
                    />
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefono</TableHead>
                      <TableHead>Tag</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts?.map(contact => (
                      <TableRow key={contact.id}>
                        <TableCell className="font-medium">{contact.name || '-'}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {contact.tags?.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {contact.customer_id && <Badge variant="outline">Cliente</Badge>}
                          {contact.lead_id && <Badge variant="outline">Lead</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startConversationFromContact(contact)}
                            >
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm('Eliminare questo contatto?')) {
                                  deleteContactMutation.mutate(contact.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!filteredContacts || filteredContacts.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Nessun contatto trovato
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Saldo Attuale</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-emerald-600">
                    €{selectedAccount.credits_balance?.toFixed(2) || '0.00'}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">Stato Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={selectedAccount.is_active ? 'default' : 'secondary'} className="bg-emerald-600">
                    {selectedAccount.is_active ? 'Attivo' : 'Inattivo'}
                  </Badge>
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
                        <TableCell>{format(new Date(tx.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Badge variant={tx.transaction_type === 'topup' ? 'default' : 'secondary'}>
                            {tx.transaction_type === 'topup' ? 'Ricarica' : 
                             tx.transaction_type === 'message_sent' ? 'Messaggio' : tx.transaction_type}
                          </Badge>
                        </TableCell>
                        <TableCell className={tx.amount > 0 ? 'text-emerald-600' : 'text-red-600'}>
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
            {/* Webhook Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" />
                  Configurazione Webhook
                </CardTitle>
                <CardDescription>
                  Configura il webhook su WaSenderAPI per ricevere messaggi in arrivo
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Session ID Status */}
                <div className="space-y-2">
                  <Label>Session ID</Label>
                  <div className="flex gap-2 items-center">
                    <Input 
                      value={selectedAccount?.session_id || 'Non configurato'}
                      readOnly 
                      className={`bg-muted font-mono text-sm ${!selectedAccount?.session_id ? 'text-destructive' : ''}`}
                    />
                    {!selectedAccount?.session_id && (
                      <Badge variant="destructive">Mancante</Badge>
                    )}
                    {selectedAccount?.session_id && (
                      <Badge className="bg-emerald-600">Configurato</Badge>
                    )}
                  </div>
                  {!selectedAccount?.session_id && (
                    <p className="text-xs text-destructive">
                      ⚠️ Il Session ID è richiesto per ricevere messaggi. Elimina questo account e ricrealo inserendo il Session ID dalla dashboard WaSenderAPI.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      value={webhookUrl}
                      readOnly 
                      className="bg-muted font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => {
                      navigator.clipboard.writeText(webhookUrl);
                      toast.success('URL copiato!');
                    }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Istruzioni di configurazione
                  </h4>
                  <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                    <li>Vai su <strong>WaSenderAPI Dashboard</strong> → <strong>Sessions</strong></li>
                    <li>Seleziona la tua sessione WhatsApp</li>
                    <li>Nella sezione <strong>Webhook URL</strong>, inserisci l'URL sopra</li>
                    <li>Se richiesto, inserisci un <strong>Webhook Secret</strong> per la verifica</li>
                    <li>Abilita gli eventi: <code>messages.upsert</code>, <code>message.status</code></li>
                    <li>Salva le impostazioni</li>
                  </ol>
                  <Button variant="link" className="p-0 h-auto" asChild>
                    <a 
                      href="https://wasenderapi.com/api-docs/webhooks/webhook-setup" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Documentazione Webhooks
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* API Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-emerald-600" />
                  Configurazione API
                </CardTitle>
                <CardDescription>
                  Endpoint e configurazioni per l'invio messaggi via WaSenderAPI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input 
                    value="https://www.wasenderapi.com/api/send-message"
                    readOnly 
                    className="bg-muted font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Headers richiesti</Label>
                  <div className="bg-muted rounded-md p-3 font-mono text-xs space-y-1">
                    <p><span className="text-blue-600">Authorization:</span> Bearer {"<WASENDER_API_KEY>"}</p>
                    <p><span className="text-blue-600">Content-Type:</span> application/json</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Esempio richiesta</Label>
                  <div className="bg-muted rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
{`{
  "to": "+39123456789",
  "text": "Ciao, questo è un messaggio!"
}`}
                  </div>
                </div>
                <div className="rounded-lg border p-4 bg-emerald-50 dark:bg-emerald-950/30">
                  <p className="text-sm text-emerald-800 dark:text-emerald-200">
                    <strong>✓</strong> L'API key WaSender è configurata e utilizzata automaticamente per l'invio dei messaggi.
                  </p>
                </div>
                <Button variant="link" className="p-0 h-auto" asChild>
                  <a 
                    href="https://wasenderapi.com/api-docs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Documentazione completa WaSenderAPI
                  </a>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* No account selected */}
      {!selectedAccount && accounts && accounts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-xl font-semibold mb-2">Nessun numero configurato</h3>
            <p className="text-muted-foreground mb-4">
              Aggiungi il tuo primo numero WaSender per iniziare
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
            <DialogTitle>Aggiungi Numero WaSender</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Numero di Telefono *</Label>
              <Input
                placeholder="Es: +39123456789"
                value={accountFormData.phone_number}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, phone_number: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nome Account</Label>
              <Input
                placeholder="Nome identificativo (opzionale)"
                value={accountFormData.account_name}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, account_name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Session ID *</Label>
              <Input
                placeholder="ID sessione da WaSenderAPI (es: session_abc123)"
                value={accountFormData.session_id}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, session_id: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Trova il Session ID nella dashboard WaSenderAPI → Sessions
              </p>
            </div>
            <div>
              <Label>API Key (opzionale)</Label>
              <Input
                type="password"
                placeholder="API Key specifica per questo account"
                value={accountFormData.api_key}
                onChange={(e) => setAccountFormData(prev => ({ ...prev, api_key: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Se vuoto, verrà usata la chiave globale WASENDER_API_KEY
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAccountDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => saveAccountMutation.mutate(accountFormData)}
              disabled={!accountFormData.phone_number || !accountFormData.session_id || saveAccountMutation.isPending}
            >
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Contatto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Numero di Telefono *</Label>
              <Input
                placeholder="Es: +39 333 1234567"
                value={contactFormData.phone}
                onChange={(e) => setContactFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Nome del contatto"
                value={contactFormData.name}
                onChange={(e) => setContactFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tag (separati da virgola)</Label>
              <Input
                placeholder="Es: cliente, vip, newsletter"
                value={contactFormData.tags}
                onChange={(e) => setContactFormData(prev => ({ ...prev, tags: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Associa a Cliente</Label>
                <Select 
                  value={contactFormData.customer_id || "none"} 
                  onValueChange={(v) => setContactFormData(prev => ({ 
                    ...prev, 
                    customer_id: v === "none" ? "" : v,
                    lead_id: ''
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
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
                  value={contactFormData.lead_id || "none"} 
                  onValueChange={(v) => setContactFormData(prev => ({ 
                    ...prev, 
                    lead_id: v === "none" ? "" : v,
                    customer_id: ''
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {leads?.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.contact_name || lead.phone || 'Lead'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
              Annulla
            </Button>
            <Button 
              onClick={() => saveContactMutation.mutate(contactFormData)}
              disabled={!contactFormData.phone || saveContactMutation.isPending}
            >
              Salva
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

            {/* Quick select from contacts */}
            {contacts && contacts.length > 0 && (
              <div>
                <Label>Oppure seleziona dalla rubrica</Label>
                <Select 
                  onValueChange={(contactId) => {
                    const contact = contacts.find(c => c.id === contactId);
                    if (contact) {
                      setNewContactData({
                        phone: contact.phone,
                        name: contact.name || '',
                        customer_id: contact.customer_id || '',
                        lead_id: contact.lead_id || ''
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona contatto..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name || contact.phone} - {contact.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Associa a Cliente</Label>
                <Select 
                  value={newContactData.customer_id || "none"} 
                  onValueChange={(v) => setNewContactData(prev => ({ 
                    ...prev, 
                    customer_id: v === "none" ? "" : v,
                    lead_id: '',
                    name: v === "none" ? prev.name : (prev.name || customers?.find(c => c.id === v)?.name || '')
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
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
                  value={newContactData.lead_id || "none"} 
                  onValueChange={(v) => setNewContactData(prev => ({ 
                    ...prev, 
                    lead_id: v === "none" ? "" : v,
                    customer_id: '',
                    name: v === "none" ? prev.name : (prev.name || leads?.find(l => l.id === v)?.contact_name || '')
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuno</SelectItem>
                    {leads?.map(lead => (
                      <SelectItem key={lead.id} value={lead.id}>
                        {lead.contact_name || lead.phone || 'Lead'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              {createConversationMutation.isPending ? 'Avvio...' : 'Avvia Chat'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
