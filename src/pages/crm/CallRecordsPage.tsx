import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Phone, Download, Search, PhoneIncoming, PhoneOutgoing, RefreshCw, Settings, Mail, Brain, ChevronDown, User, MessageSquare, Sparkles, Link2 } from "lucide-react";
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

export default function CallRecordsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showImapDialog, setShowImapDialog] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

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

  const { data: callRecords, isLoading, refetch } = useQuery({
    queryKey: ['call-records'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('call_records')
        .select(`
          *,
          leads:lead_id (id, company_name, contact_name)
        `)
        .order('call_date', { ascending: false })
        .order('call_time', { ascending: false });

      if (error) throw error;
      return data as CallRecord[];
    },
  });

  // Mutation per analisi AI
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

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const downloadRecording = async (recordingUrl: string, uniqueCallId: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('call-recordings')
        .download(recordingUrl);

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

  const handleProcessEmails = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-call-records-emails');
      
      if (error) throw error;
      
      toast.success(`Processate ${data.processed} chiamate dalle email. Ignorate: ${data.skipped}, Errori: ${data.errors}`);
      
      refetch();
    } catch (error) {
      console.error('Error processing emails:', error);
      toast.error("Errore nel processare le email");
    } finally {
      setIsProcessing(false);
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
        ? `Processate ${data.emails_processed} di ${data.total_found} email (${data.new_call_records} nuove). Clicca di nuovo per processare le rimanenti.`
        : `Sincronizzate ${data.emails_processed} email, ${data.new_call_records} nuove registrazioni`;
      
      toast.success(message);
      
      refetch();
    } catch (error) {
      console.error('Error syncing IMAP:', error);
      toast.error("Errore nella sincronizzazione IMAP");
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRecords = callRecords?.filter(record =>
    record.caller_number.includes(searchTerm) ||
    record.called_number.includes(searchTerm) ||
    record.unique_call_id.includes(searchTerm)
  );

  return (
    <div className="container mx-auto p-6 space-y-6">
      <ImapConfigDialog 
        open={showImapDialog} 
        onOpenChange={setShowImapDialog}
        onSuccess={() => refetchConfigs()}
      />

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Registrazioni Chiamate</h1>
          <p className="text-muted-foreground">
            Sincronizza automaticamente le registrazioni via IMAP
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImapDialog(true)}>
            <Settings className="mr-2 h-4 w-4" />
            Configura IMAP
          </Button>
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

      {imapConfigs && imapConfigs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Configurazione Attiva
            </CardTitle>
            <CardDescription>
              Server IMAP configurato per la sincronizzazione automatica
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Nome:</span>
                <span className="text-sm text-muted-foreground">{imapConfigs[0].name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Server:</span>
                <span className="text-sm text-muted-foreground font-mono">{imapConfigs[0].host}:{imapConfigs[0].port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Cartella:</span>
                <span className="text-sm text-muted-foreground">{imapConfigs[0].folder}</span>
              </div>
              {imapConfigs[0].last_sync_at && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium">Ultima sincronizzazione:</span>
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(imapConfigs[0].last_sync_at), 'dd/MM/yyyy HH:mm', { locale: it })}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

        <Card>
          <CardHeader>
            <CardTitle>Registrazioni</CardTitle>
            <CardDescription>
              Lista completa delle chiamate registrate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cerca per numero o ID chiamata..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8">Caricamento...</div>
            ) : !filteredRecords || filteredRecords.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nessuna registrazione trovata
              </div>
            ) : (
              <div className="rounded-md border">
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
                              <span className="text-xs text-muted-foreground">
                                {record.call_time}
                              </span>
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
                                    <Badge variant="outline" className="text-xs">
                                      Int. {record.extension_number}
                                    </Badge>
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
                                <Badge variant="outline" className="text-muted-foreground">
                                  Non analizzato
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                {record.recording_url && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => downloadRecording(record.recording_url!, record.unique_call_id)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => analyzeCallMutation.mutate(record.id)}
                                  disabled={analyzeCallMutation.isPending}
                                >
                                  <Brain className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/30 p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Riassunto AI */}
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
                                  
                                  {/* Azioni suggerite */}
                                  {aiActions.length > 0 && (
                                    <div className="space-y-2">
                                      <h4 className="font-semibold">Azioni suggerite</h4>
                                      <ul className="space-y-1">
                                        {aiActions.map((action, idx) => (
                                          <li key={idx} className="flex items-start gap-2 text-sm">
                                            <Badge 
                                              variant={
                                                action.priority === 'alta' ? 'destructive' :
                                                action.priority === 'media' ? 'default' : 'secondary'
                                              }
                                              className="text-xs shrink-0"
                                            >
                                              {action.priority}
                                            </Badge>
                                            <span>{action.action}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  
                                  {/* Trascrizione */}
                                  {record.transcription && (
                                    <div className="md:col-span-2 space-y-2">
                                      <h4 className="font-semibold">Trascrizione</h4>
                                      <p className="text-sm text-muted-foreground bg-background p-3 rounded-lg max-h-40 overflow-y-auto">
                                        {record.transcription}
                                      </p>
                                    </div>
                                  )}
                                  
                                  {/* Info chiamata */}
                                  <div className="md:col-span-2 flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
                                    <span>ID: {record.unique_call_id}</span>
                                    <span>Servizio: {record.service}</span>
                                    {record.matched_by && <span>Match: {record.matched_by}</span>}
                                    {record.ai_processed_at && (
                                      <span>Analizzato: {format(new Date(record.ai_processed_at), 'dd/MM/yyyy HH:mm', { locale: it })}</span>
                                    )}
                                  </div>
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
    </div>
  );
}
