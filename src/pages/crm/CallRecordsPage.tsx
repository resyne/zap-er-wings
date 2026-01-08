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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, Download, Search, PhoneIncoming, PhoneOutgoing, RefreshCw, 
  Settings, Mail, Brain, ChevronDown, User, MessageSquare, Sparkles, 
  Link2, Plus, Pencil, Trash2, Server, ListChecks, Building2
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { ImapConfigDialog } from "@/components/crm/ImapConfigDialog";
import { Link } from "react-router-dom";

interface CallRecord {
  id: string;
  caller_number: string;
  called_number: string;
  service: string;
  call_date: string;
  call_time: string;
  duration_seconds: number;
  unique_call_id: string;
  recording_url: string | null;
  created_at: string;
  lead_id: string | null;
  extension_number: string | null;
  operator_id: string | null;
  operator_name: string | null;
  transcription: string | null;
  ai_summary: string | null;
  ai_sentiment: string | null;
  ai_actions: unknown;
  ai_processed_at: string | null;
  direction: string | null;
  matched_by: string | null;
  leads?: { id: string; company_name: string; contact_name: string } | null;
}

interface PbxNumber {
  id: string;
  name: string;
  phone_number: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

interface PhoneExtension {
  id: string;
  extension_number: string;
  user_id: string | null;
  operator_name: string;
  operator_email: string | null;
  department: string | null;
  is_active: boolean;
  pbx_id: string | null;
  created_at: string;
  pbx_numbers?: PbxNumber | null;
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export default function CallRecordsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImapDialog, setShowImapDialog] = useState(false);
  const [imapDialogPbxId, setImapDialogPbxId] = useState<string | null>(null);
  const [imapDialogPbxName, setImapDialogPbxName] = useState<string>("");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("calls");
  const [selectedPbxFilter, setSelectedPbxFilter] = useState<string>("all");
  
  // PBX state
  const [isPbxDialogOpen, setIsPbxDialogOpen] = useState(false);
  const [editingPbx, setEditingPbx] = useState<PbxNumber | null>(null);
  const [pbxFormData, setPbxFormData] = useState({
    name: '',
    phone_number: '',
    description: '',
    is_active: true
  });
  
  // Phone extensions state
  const [isExtensionDialogOpen, setIsExtensionDialogOpen] = useState(false);
  const [editingExtension, setEditingExtension] = useState<PhoneExtension | null>(null);
  const [extensionFormData, setExtensionFormData] = useState({
    extension_number: '',
    user_id: '',
    operator_name: '',
    operator_email: '',
    department: '',
    is_active: true,
    pbx_id: ''
  });

  // Queries
  const { data: imapConfigs, refetch: refetchConfigs } = useQuery({
    queryKey: ['imap-configs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imap_config')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: callRecords, isLoading: isLoadingCalls, refetch: refetchCalls } = useQuery({
    queryKey: ['call-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select(`*, leads:lead_id (id, company_name, contact_name)`)
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });
      if (error) throw error;
      return data as CallRecord[];
    },
  });

  const { data: pbxNumbers, isLoading: isLoadingPbx } = useQuery({
    queryKey: ['pbx-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_numbers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as PbxNumber[];
    }
  });

  const { data: extensions, isLoading: isLoadingExtensions } = useQuery({
    queryKey: ['phone-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*, pbx_numbers(*)')
        .order('extension_number');
      if (error) throw error;
      return data as PhoneExtension[];
    }
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data as Profile[];
    }
  });

  // PBX Mutations
  const savePbxMutation = useMutation({
    mutationFn: async (data: typeof pbxFormData) => {
      const payload = {
        name: data.name,
        phone_number: data.phone_number,
        description: data.description || null,
        is_active: data.is_active
      };
      if (editingPbx) {
        const { error } = await supabase.from('pbx_numbers').update(payload).eq('id', editingPbx.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pbx_numbers').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pbx-numbers'] });
      toast.success(editingPbx ? 'Centralino aggiornato' : 'Centralino aggiunto');
      handleClosePbxDialog();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const deletePbxMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('pbx_numbers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pbx-numbers'] });
      toast.success('Centralino eliminato');
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Extension Mutations
  const analyzeCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('analyze-call-record', {
        body: { call_record_id: callId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['call-records'] });
      toast.success('Chiamata analizzata con AI');
    },
    onError: (error: any) => {
      toast.error(`Errore analisi: ${error.message}`);
    }
  });

  const saveExtensionMutation = useMutation({
    mutationFn: async (data: typeof extensionFormData) => {
      const payload = {
        extension_number: data.extension_number,
        user_id: data.user_id || null,
        operator_name: data.operator_name,
        operator_email: data.operator_email || null,
        department: data.department || null,
        is_active: data.is_active,
        pbx_id: data.pbx_id || null
      };
      if (editingExtension) {
        const { error } = await supabase.from('phone_extensions').update(payload).eq('id', editingExtension.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('phone_extensions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-extensions'] });
      toast.success(editingExtension ? 'Interno aggiornato' : 'Interno aggiunto');
      handleCloseExtensionDialog();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const deleteExtensionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('phone_extensions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-extensions'] });
      toast.success('Interno eliminato');
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Handlers
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  const downloadRecording = async (recordingUrl: string, uniqueCallId: string) => {
    try {
      const { data, error } = await supabase.storage.from('call-recordings').download(recordingUrl);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${uniqueCallId}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Registrazione scaricata");
    } catch (error) {
      console.error('Error downloading recording:', error);
      toast.error("Errore nel download della registrazione");
    }
  };

  const handleSyncImap = async () => {
    if (!imapConfigs || imapConfigs.length === 0) {
      toast.error("Configura prima IMAP per sincronizzare le email");
      setShowImapDialog(true);
      return;
    }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-call-records-imap');
      if (error) throw error;
      const message = data.total_found > data.emails_processed
        ? `Processate ${data.emails_processed} di ${data.total_found} email (${data.new_call_records} nuove).`
        : `Sincronizzate ${data.emails_processed} email, ${data.new_call_records} nuove registrazioni`;
      toast.success(message);
      refetchCalls();
    } catch (error) {
      console.error('Error syncing IMAP:', error);
      toast.error("Errore nella sincronizzazione IMAP");
    } finally {
      setIsProcessing(false);
    }
  };

  // PBX handlers
  const handleOpenPbxDialog = (pbx?: PbxNumber) => {
    if (pbx) {
      setEditingPbx(pbx);
      setPbxFormData({
        name: pbx.name,
        phone_number: pbx.phone_number,
        description: pbx.description || '',
        is_active: pbx.is_active
      });
    } else {
      setEditingPbx(null);
      setPbxFormData({ name: '', phone_number: '', description: '', is_active: true });
    }
    setIsPbxDialogOpen(true);
  };

  const handleClosePbxDialog = () => {
    setIsPbxDialogOpen(false);
    setEditingPbx(null);
  };

  const handlePbxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pbxFormData.name || !pbxFormData.phone_number) {
      toast.error('Nome e numero sono obbligatori');
      return;
    }
    savePbxMutation.mutate(pbxFormData);
  };

  // Extension handlers
  const handleOpenExtensionDialog = (extension?: PhoneExtension) => {
    if (extension) {
      setEditingExtension(extension);
      setExtensionFormData({
        extension_number: extension.extension_number,
        user_id: extension.user_id || '',
        operator_name: extension.operator_name,
        operator_email: extension.operator_email || '',
        department: extension.department || '',
        is_active: extension.is_active,
        pbx_id: extension.pbx_id || ''
      });
    } else {
      setEditingExtension(null);
      setExtensionFormData({
        extension_number: '',
        user_id: '',
        operator_name: '',
        operator_email: '',
        department: '',
        is_active: true,
        pbx_id: selectedPbxFilter !== 'all' ? selectedPbxFilter : ''
      });
    }
    setIsExtensionDialogOpen(true);
  };

  const handleCloseExtensionDialog = () => {
    setIsExtensionDialogOpen(false);
    setEditingExtension(null);
  };

  const handleUserSelect = (userId: string) => {
    const profile = profiles?.find(p => p.id === userId);
    if (profile) {
      setExtensionFormData(prev => ({
        ...prev,
        user_id: userId,
        operator_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        operator_email: profile.email
      }));
    } else {
      setExtensionFormData(prev => ({ ...prev, user_id: userId }));
    }
  };

  const handleExtensionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extensionFormData.extension_number || !extensionFormData.operator_name) {
      toast.error('Numero interno e nome operatore sono obbligatori');
      return;
    }
    saveExtensionMutation.mutate(extensionFormData);
  };

  // Filtered data
  const filteredRecords = callRecords?.filter(record =>
    record.caller_number.includes(searchTerm) ||
    record.called_number.includes(searchTerm) ||
    record.unique_call_id.includes(searchTerm) ||
    record.operator_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.leads?.company_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredExtensions = selectedPbxFilter === 'all' 
    ? extensions 
    : extensions?.filter(ext => ext.pbx_id === selectedPbxFilter);

  // Stats
  const totalCalls = callRecords?.length || 0;
  const analyzedCalls = callRecords?.filter(c => c.ai_processed_at).length || 0;
  const linkedLeads = callRecords?.filter(c => c.lead_id).length || 0;
  const activePbx = pbxNumbers?.filter(p => p.is_active).length || 0;
  const activeExtensions = extensions?.filter(e => e.is_active).length || 0;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ImapConfigDialog 
        open={showImapDialog} 
        onOpenChange={setShowImapDialog}
        onSuccess={() => refetchConfigs()}
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            Gestione Chiamate
          </h1>
          <p className="text-muted-foreground mt-1">
            Registrazioni, analisi AI e configurazione centralini
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSyncImap} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Sincronizzazione...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Sincronizza IMAP
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalCalls}</p>
                <p className="text-xs text-muted-foreground">Chiamate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analyzedCalls}</p>
                <p className="text-xs text-muted-foreground">Analizzate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Link2 className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{linkedLeads}</p>
                <p className="text-xs text-muted-foreground">Con lead</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/10 rounded-lg">
                <Building2 className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activePbx}</p>
                <p className="text-xs text-muted-foreground">Centralini</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <User className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeExtensions}</p>
                <p className="text-xs text-muted-foreground">Interni</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="calls" className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Chiamate
          </TabsTrigger>
          <TabsTrigger value="pbx" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Centralini
          </TabsTrigger>
          <TabsTrigger value="extensions" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Interni
          </TabsTrigger>
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Setup
          </TabsTrigger>
        </TabsList>

        {/* CALLS TAB */}
        <TabsContent value="calls" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registrazioni Chiamate</CardTitle>
              <CardDescription>Lista completa delle chiamate registrate con analisi AI</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Cerca per numero, operatore, lead..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {isLoadingCalls ? (
                <div className="text-center py-8">Caricamento...</div>
              ) : !filteredRecords || filteredRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessuna registrazione trovata</p>
                  <p className="text-sm mt-2">Sincronizza le email per importare le chiamate</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead></TableHead>
                        <TableHead>Data/Ora</TableHead>
                        <TableHead>Chiamante</TableHead>
                        <TableHead>Operatore</TableHead>
                        <TableHead>Lead</TableHead>
                        <TableHead>Durata</TableHead>
                        <TableHead>AI</TableHead>
                        <TableHead className="text-right">Azioni</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => {
                        const isOutgoing = record.direction === 'outbound' || record.service.toLowerCase().includes('out');
                        const aiActions = Array.isArray(record.ai_actions) ? record.ai_actions as { action: string; priority: string; deadline?: string }[] : [];
                        const isExpanded = expandedRow === record.id;
                        
                        return (
                          <>
                            <TableRow key={record.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setExpandedRow(isExpanded ? null : record.id)}>
                              <TableCell>
                                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {format(new Date(record.call_date), 'dd/MM/yyyy', { locale: it })}
                                <br />
                                <span className="text-xs text-muted-foreground">{record.call_time}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {isOutgoing ? (
                                    <PhoneOutgoing className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <PhoneIncoming className="h-4 w-4 text-green-500" />
                                  )}
                                  <span className="text-sm">{record.caller_number}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {record.operator_name ? (
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground" />
                                    <span>{record.operator_name}</span>
                                    {record.extension_number && (
                                      <Badge variant="outline" className="text-xs">Int. {record.extension_number}</Badge>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {record.leads ? (
                                  <Link 
                                    to={`/crm/leads?id=${record.leads.id}`} 
                                    className="flex items-center gap-1 text-primary hover:underline"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Link2 className="h-3 w-3" />
                                    {record.leads.company_name || record.leads.contact_name}
                                  </Link>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>{formatDuration(record.duration_seconds)}</TableCell>
                              <TableCell>
                                {record.ai_processed_at ? (
                                  <Badge 
                                    variant={
                                      record.ai_sentiment === 'positivo' ? 'default' :
                                      record.ai_sentiment === 'negativo' ? 'destructive' : 'secondary'
                                    }
                                  >
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    {record.ai_sentiment || 'Analizzato'}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-muted-foreground">Non analizzato</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                  {record.recording_url && (
                                    <Button variant="ghost" size="sm" onClick={() => downloadRecording(record.recording_url!, record.unique_call_id)}>
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="sm" onClick={() => analyzeCallMutation.mutate(record.id)} disabled={analyzeCallMutation.isPending}>
                                    <Brain className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30 p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {record.ai_summary && (
                                      <div className="space-y-2">
                                        <h4 className="font-semibold flex items-center gap-2">
                                          <MessageSquare className="h-4 w-4" />
                                          Riassunto AI
                                        </h4>
                                        <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg">
                                          {record.ai_summary}
                                        </p>
                                      </div>
                                    )}
                                    {aiActions.length > 0 && (
                                      <div className="space-y-2">
                                        <h4 className="font-semibold flex items-center gap-2">
                                          <ListChecks className="h-4 w-4" />
                                          Azioni suggerite
                                        </h4>
                                        <ul className="space-y-1">
                                          {aiActions.map((action, idx) => (
                                            <li key={idx} className="text-sm flex items-start gap-2 bg-background p-2 rounded">
                                              <Badge variant={action.priority === 'alta' ? 'destructive' : action.priority === 'media' ? 'default' : 'secondary'} className="text-xs">
                                                {action.priority}
                                              </Badge>
                                              <span>{action.action}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {record.transcription && (
                                      <div className="space-y-2 md:col-span-2">
                                        <h4 className="font-semibold">Trascrizione</h4>
                                        <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg whitespace-pre-wrap">
                                          {record.transcription}
                                        </p>
                                      </div>
                                    )}
                                    {!record.ai_summary && !record.transcription && (
                                      <div className="text-center py-4 text-muted-foreground md:col-span-2">
                                        <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>Nessuna analisi AI disponibile</p>
                                        <Button variant="outline" size="sm" className="mt-2" onClick={() => analyzeCallMutation.mutate(record.id)}>
                                          Analizza ora
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PBX TAB */}
        <TabsContent value="pbx" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Numeri Centralino
                </CardTitle>
                <CardDescription>Configura i tuoi numeri di centralino per associare gli interni</CardDescription>
              </div>
              <Dialog open={isPbxDialogOpen} onOpenChange={setIsPbxDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => handleOpenPbxDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi Centralino
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingPbx ? 'Modifica Centralino' : 'Nuovo Centralino'}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handlePbxSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pbx_name">Nome *</Label>
                      <Input
                        id="pbx_name"
                        value={pbxFormData.name}
                        onChange={(e) => setPbxFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Es: Centralino Principale, Sede Milano..."
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pbx_phone">Numero Telefono *</Label>
                      <Input
                        id="pbx_phone"
                        value={pbxFormData.phone_number}
                        onChange={(e) => setPbxFormData(prev => ({ ...prev, phone_number: e.target.value }))}
                        placeholder="Es: +39 02 12345678"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pbx_description">Descrizione</Label>
                      <Textarea
                        id="pbx_description"
                        value={pbxFormData.description}
                        onChange={(e) => setPbxFormData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Note aggiuntive sul centralino..."
                        rows={3}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label htmlFor="pbx_active">Attivo</Label>
                      <Switch
                        id="pbx_active"
                        checked={pbxFormData.is_active}
                        onCheckedChange={(checked) => setPbxFormData(prev => ({ ...prev, is_active: checked }))}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={handleClosePbxDialog}>Annulla</Button>
                      <Button type="submit" disabled={savePbxMutation.isPending}>
                        {savePbxMutation.isPending ? 'Salvataggio...' : 'Salva'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {isLoadingPbx ? (
                <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
              ) : pbxNumbers && pbxNumbers.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {pbxNumbers.map((pbx) => {
                    const pbxExtensions = extensions?.filter(e => e.pbx_id === pbx.id) || [];
                    const pbxImapConfig = imapConfigs?.find(c => c.pbx_id === pbx.id);
                    return (
                      <Card key={pbx.id} className={!pbx.is_active ? 'opacity-60' : ''}>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {pbx.name}
                            </CardTitle>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenPbxDialog(pbx)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm('Eliminare questo centralino?')) {
                                  deletePbxMutation.mutate(pbx.id);
                                }
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <p className="font-mono text-lg">{pbx.phone_number}</p>
                            {pbx.description && (
                              <p className="text-sm text-muted-foreground">{pbx.description}</p>
                            )}
                            <div className="flex items-center justify-between">
                              <Badge variant={pbx.is_active ? 'default' : 'secondary'}>
                                {pbx.is_active ? 'Attivo' : 'Disattivato'}
                              </Badge>
                              <span className="text-sm text-muted-foreground">
                                {pbxExtensions.length} interni
                              </span>
                            </div>
                            
                            {/* IMAP Config Section */}
                            <div className="pt-3 border-t">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Mail className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-sm font-medium">IMAP</span>
                                </div>
                                {pbxImapConfig ? (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    Configurato
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-orange-600 border-orange-600">
                                    Non configurato
                                  </Badge>
                                )}
                              </div>
                              {pbxImapConfig && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {pbxImapConfig.username}
                                </p>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-2"
                                onClick={() => {
                                  setImapDialogPbxId(pbx.id);
                                  setImapDialogPbxName(pbx.name);
                                  setShowImapDialog(true);
                                }}
                              >
                                <Settings className="h-4 w-4 mr-2" />
                                {pbxImapConfig ? 'Modifica IMAP' : 'Configura IMAP'}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun centralino configurato</p>
                  <p className="text-sm">Aggiungi i tuoi numeri di centralino per organizzare gli interni</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EXTENSIONS TAB */}
        <TabsContent value="extensions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Mappatura Interni Telefonici</CardTitle>
                <CardDescription>Configura la corrispondenza tra interni e operatori</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedPbxFilter} onValueChange={setSelectedPbxFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filtra per centralino" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tutti i centralini</SelectItem>
                    {pbxNumbers?.map(pbx => (
                      <SelectItem key={pbx.id} value={pbx.id}>{pbx.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Dialog open={isExtensionDialogOpen} onOpenChange={setIsExtensionDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenExtensionDialog()}>
                      <Plus className="h-4 w-4 mr-2" />
                      Aggiungi Interno
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingExtension ? 'Modifica Interno' : 'Nuovo Interno'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleExtensionSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="ext_pbx">Centralino *</Label>
                        <Select value={extensionFormData.pbx_id} onValueChange={(v) => setExtensionFormData(prev => ({ ...prev, pbx_id: v }))}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona centralino..." />
                          </SelectTrigger>
                          <SelectContent>
                            {pbxNumbers?.map(pbx => (
                              <SelectItem key={pbx.id} value={pbx.id}>{pbx.name} ({pbx.phone_number})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="extension_number">Numero Interno *</Label>
                        <Input
                          id="extension_number"
                          value={extensionFormData.extension_number}
                          onChange={(e) => setExtensionFormData(prev => ({ ...prev, extension_number: e.target.value }))}
                          placeholder="Es: 101, 102, 201..."
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="user_id">Utente Sistema (opzionale)</Label>
                        <Select value={extensionFormData.user_id} onValueChange={handleUserSelect}>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleziona un utente..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Nessun utente</SelectItem>
                            {profiles?.map(profile => (
                              <SelectItem key={profile.id} value={profile.id}>
                                {profile.first_name || profile.last_name 
                                  ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                                  : profile.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="operator_name">Nome Operatore *</Label>
                        <Input
                          id="operator_name"
                          value={extensionFormData.operator_name}
                          onChange={(e) => setExtensionFormData(prev => ({ ...prev, operator_name: e.target.value }))}
                          placeholder="Nome e cognome"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="operator_email">Email Operatore</Label>
                        <Input
                          id="operator_email"
                          type="email"
                          value={extensionFormData.operator_email}
                          onChange={(e) => setExtensionFormData(prev => ({ ...prev, operator_email: e.target.value }))}
                          placeholder="email@azienda.it"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="department">Reparto</Label>
                        <Input
                          id="department"
                          value={extensionFormData.department}
                          onChange={(e) => setExtensionFormData(prev => ({ ...prev, department: e.target.value }))}
                          placeholder="Es: Commerciale, Assistenza..."
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="is_active">Attivo</Label>
                        <Switch
                          id="is_active"
                          checked={extensionFormData.is_active}
                          onCheckedChange={(checked) => setExtensionFormData(prev => ({ ...prev, is_active: checked }))}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={handleCloseExtensionDialog}>Annulla</Button>
                        <Button type="submit" disabled={saveExtensionMutation.isPending}>
                          {saveExtensionMutation.isPending ? 'Salvataggio...' : 'Salva'}
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingExtensions ? (
                <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
              ) : filteredExtensions && filteredExtensions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Interno</TableHead>
                      <TableHead>Centralino</TableHead>
                      <TableHead>Operatore</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Reparto</TableHead>
                      <TableHead>Stato</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredExtensions.map((ext) => (
                      <TableRow key={ext.id}>
                        <TableCell className="font-mono font-bold">{ext.extension_number}</TableCell>
                        <TableCell>
                          {ext.pbx_numbers ? (
                            <Badge variant="outline">{ext.pbx_numbers.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            {ext.operator_name}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{ext.operator_email || '-'}</TableCell>
                        <TableCell>{ext.department || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={ext.is_active ? 'default' : 'secondary'}>
                            {ext.is_active ? 'Attivo' : 'Disattivato'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleOpenExtensionDialog(ext)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => {
                              if (confirm('Eliminare questo interno?')) {
                                deleteExtensionMutation.mutate(ext.id);
                              }
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nessun interno configurato</p>
                  <p className="text-sm">Prima configura un centralino, poi aggiungi gli interni</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SETUP TAB */}
        <TabsContent value="setup" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* IMAP Config */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Configurazione IMAP
                </CardTitle>
                <CardDescription>Server email per importare le registrazioni chiamate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {imapConfigs && imapConfigs.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Nome:</span>
                      <span className="text-sm text-muted-foreground">{imapConfigs[0].name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Server:</span>
                      <span className="text-sm text-muted-foreground font-mono">{imapConfigs[0].host}:{imapConfigs[0].port}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Cartella:</span>
                      <span className="text-sm text-muted-foreground">{imapConfigs[0].folder}</span>
                    </div>
                    {imapConfigs[0].last_sync_at && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Ultima sync:</span>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(imapConfigs[0].last_sync_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                        </span>
                      </div>
                    )}
                    <Badge variant="default" className="w-fit">Configurato</Badge>
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>IMAP non configurato</p>
                  </div>
                )}
                <Button variant="outline" className="w-full" onClick={() => setShowImapDialog(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  {imapConfigs && imapConfigs.length > 0 ? 'Modifica configurazione' : 'Configura IMAP'}
                </Button>
              </CardContent>
            </Card>

            {/* AI Analysis Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Analisi AI
                </CardTitle>
                <CardDescription>Funzionalità di intelligenza artificiale per le chiamate</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">Riassunto automatico</p>
                      <p className="text-xs text-muted-foreground">Genera riassunti delle conversazioni</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <MessageSquare className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium text-sm">Sentiment Analysis</p>
                      <p className="text-xs text-muted-foreground">Analizza il tono della conversazione</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <ListChecks className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="font-medium text-sm">Estrazione azioni</p>
                      <p className="text-xs text-muted-foreground">Identifica follow-up e task</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Link2 className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="font-medium text-sm">Matching Lead</p>
                      <p className="text-xs text-muted-foreground">Collega automaticamente ai lead per numero</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* IMAP Dialog for PBX */}
      <ImapConfigDialog
        open={showImapDialog}
        onOpenChange={(open) => {
          setShowImapDialog(open);
          if (!open) {
            setImapDialogPbxId(null);
            setImapDialogPbxName("");
          }
        }}
        onSuccess={() => {
          refetchConfigs();
        }}
        pbxId={imapDialogPbxId}
        pbxName={imapDialogPbxName}
        existingConfig={
          imapDialogPbxId && imapConfigs
            ? imapConfigs.find(c => c.pbx_id === imapDialogPbxId) || null
            : null
        }
      />
    </div>
  );
}
