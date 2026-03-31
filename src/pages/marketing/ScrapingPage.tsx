import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Search, Globe, Mail, Loader2, CheckCircle2, XCircle, ExternalLink, Copy, Rocket, Bot, RefreshCw, Eye, Pause, Play, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmailTemplateEditor, DEFAULT_TEMPLATE } from "@/components/marketing/EmailTemplateEditor";

interface ScrapingResult {
  title: string;
  url: string;
  description: string;
  position: number;
}

interface GeneratedEmail {
  source: ScrapingResult;
  email: {
    subject: string;
    body: string;
    recipientName: string;
    recipientCompany: string;
  } | null;
  error: string | null;
}

interface Mission {
  id: string;
  name: string;
  query: string;
  mission_description: string;
  sender_name: string;
  sender_company: string;
  status: string;
  total_cities: number;
  completed_cities: number;
  total_results: number;
  created_at: string;
}

interface MissionResult {
  id: string;
  city: string;
  title: string;
  url: string;
  description: string;
  position: number;
  generated_email_subject: string | null;
  generated_email_body: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  email_generated: boolean;
  email_sent: boolean;
  contact_email: string | null;
}

export default function ScrapingPage() {
  const { toast } = useToast();

  // Scraping config (manual)
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("it");
  const [language, setLanguage] = useState("it");
  const [maxResults, setMaxResults] = useState(20);
  const [mission, setMission] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [emailLanguage, setEmailLanguage] = useState("Italiano");

  // Manual scraping state
  const [scraping, setScraping] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [results, setResults] = useState<ScrapingResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<GeneratedEmail[]>([]);

  // Agent/Mission state
  const [missionName, setMissionName] = useState("");
  const [agentQuery, setAgentQuery] = useState("");
  const [agentMission, setAgentMission] = useState("");
  const [agentSenderName, setAgentSenderName] = useState("");
  const [agentSenderCompany, setAgentSenderCompany] = useState("");
  const [agentMaxResults, setAgentMaxResults] = useState(20);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(false);
  const [launchingAgent, setLaunchingAgent] = useState(false);
  const [viewingMission, setViewingMission] = useState<Mission | null>(null);
  const [missionResults, setMissionResults] = useState<MissionResult[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [generatingMissionEmails, setGeneratingMissionEmails] = useState(false);
  const [emailGenProgress, setEmailGenProgress] = useState({ processed: 0, total: 0, running: false });
  const emailGenPausedRef = useRef(false);
  const [emailGenPaused, setEmailGenPaused] = useState(false);
  const [recoveringEmails, setRecoveringEmails] = useState(false);
  const [recoverProgress, setRecoverProgress] = useState({ processed: 0, total: 0, found: 0, running: false });
  const recoverPausedRef = useRef(false);
  const [recoverPaused, setRecoverPaused] = useState(false);
  const [dialogEmailTab, setDialogEmailTab] = useState("by-city");

  // Email template & sending state - persist to Supabase
  const [htmlTemplate, setHtmlTemplate] = useState(DEFAULT_TEMPLATE);
  const [emailSenderEmail, setEmailSenderEmail] = useState("noreply@erp.abbattitorizapper.it");
  const [emailSenderName, setEmailSenderName] = useState("ZAPPER Team");
  const [replyToEmail, setReplyToEmail] = useState("info@abbattitorizapper.it");
  const [templateUnsaved, setTemplateUnsaved] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load email settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('scraping_email_settings')
          .select('setting_key, setting_value');
        if (error) throw error;
        if (data) {
          for (const row of data) {
            switch (row.setting_key) {
              case 'sender_email': if (row.setting_value) setEmailSenderEmail(row.setting_value); break;
              case 'sender_name': if (row.setting_value) setEmailSenderName(row.setting_value); break;
              case 'reply_to': if (row.setting_value) setReplyToEmail(row.setting_value); break;
              case 'html_template': if (row.setting_value) setHtmlTemplate(row.setting_value); break;
            }
          }
        }
      } catch (err) {
        console.error('Error loading email settings:', err);
      } finally {
        setSettingsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  const handleTemplateChange = (val: string) => {
    setHtmlTemplate(val);
    setTemplateUnsaved(true);
  };
  const handleSenderEmailChange = (val: string) => {
    setEmailSenderEmail(val);
    setTemplateUnsaved(true);
  };
  const handleSenderNameChange = (val: string) => {
    setEmailSenderName(val);
    setTemplateUnsaved(true);
  };
  const handleReplyToChange = (val: string) => {
    setReplyToEmail(val);
    setTemplateUnsaved(true);
  };
  const saveTemplate = async () => {
    try {
      const settings = [
        { setting_key: 'sender_email', setting_value: emailSenderEmail },
        { setting_key: 'sender_name', setting_value: emailSenderName },
        { setting_key: 'reply_to', setting_value: replyToEmail },
        { setting_key: 'html_template', setting_value: htmlTemplate },
      ];
      for (const s of settings) {
        await supabase
          .from('scraping_email_settings')
          .update({ setting_value: s.setting_value, updated_at: new Date().toISOString() })
          .eq('setting_key', s.setting_key);
      }
      setTemplateUnsaved(false);
      toast({ title: "Template salvato!" });
    } catch (err: any) {
      toast({ title: "Errore salvataggio", description: err.message, variant: "destructive" });
    }
  };
  const [sendingEmails, setSendingEmails] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [previewEmail, setPreviewEmail] = useState<MissionResult | null>(null);

  const [activeTab, setActiveTab] = useState("agent");

  useEffect(() => {
    fetchMissions();
  }, []);

  // Poll running missions: trigger next batch every 8 seconds
  useEffect(() => {
    const runningMissions = missions.filter(m => m.status === 'running' || m.status === 'pending');
    if (runningMissions.length === 0) return;

    const interval = setInterval(async () => {
      // Trigger next batch for each running mission
      for (const m of runningMissions.filter(m => m.status === 'running')) {
        try {
          await supabase.functions.invoke('scraping-agent', {
            body: { missionId: m.id },
          });
        } catch (err) {
          console.error('Batch trigger error:', err);
        }
      }
      await fetchMissions();
    }, 8000);
    return () => clearInterval(interval);
  }, [missions]);

  const fetchMissions = async () => {
    setLoadingMissions(true);
    try {
      const { data, error } = await supabase
        .from('scraping_missions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setMissions((data as Mission[]) || []);
    } catch (error) {
      console.error('Error fetching missions:', error);
    } finally {
      setLoadingMissions(false);
    }
  };

  const launchAgent = async () => {
    if (!missionName.trim() || !agentQuery.trim() || !agentMission.trim()) {
      toast({ title: "Errore", description: "Compila nome, query e missione", variant: "destructive" });
      return;
    }

    setLaunchingAgent(true);
    try {
      // Create mission record
      const { data: missionData, error: insertError } = await supabase
        .from('scraping_missions')
        .insert({
          name: missionName,
          query: agentQuery,
          mission_description: agentMission,
          sender_name: agentSenderName,
          sender_company: agentSenderCompany,
          max_results_per_city: agentMaxResults,
          status: 'pending',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Launch first batch
      const { error } = await supabase.functions.invoke('scraping-agent', {
        body: { missionId: (missionData as Mission).id },
      });

      if (error) {
        console.error('First batch error:', error);
      }

      toast({
        title: "Agente avviato!",
        description: `Lo scraping procede in batch automatici su ~140 città italiane`,
      });

      // Reset form
      setMissionName("");
      setAgentQuery("");
      setAgentMission("");
      setAgentSenderName("");
      setAgentSenderCompany("");

      // Refresh missions list
      await fetchMissions();
    } catch (error: any) {
      console.error('Agent launch error:', error);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setLaunchingAgent(false);
    }
  };

  const viewMissionResults = async (m: Mission) => {
    setViewingMission(m);
    setLoadingResults(true);
    try {
      const { data, error } = await supabase
        .from('scraping_results')
        .select('*')
        .eq('mission_id', m.id)
        .order('city', { ascending: true })
        .limit(1000);

      if (error) throw error;
      setMissionResults((data as MissionResult[]) || []);
    } catch (error) {
      console.error('Error fetching results:', error);
    } finally {
      setLoadingResults(false);
    }
  };

  const refreshMissionResults = useCallback(async (missionId: string) => {
    try {
      const { data, error } = await supabase
        .from('scraping_results')
        .select('*')
        .eq('mission_id', missionId)
        .order('city', { ascending: true })
        .limit(2000);
      if (!error && data) setMissionResults(data as MissionResult[]);
    } catch {}
  }, []);

  const generateMissionEmails = async () => {
    if (!viewingMission) return;
    emailGenPausedRef.current = false;
    setEmailGenPaused(false);
    setGeneratingMissionEmails(true);
    const totalToProcess = missionResults.filter(r => !r.email_generated).length;
    setEmailGenProgress({ processed: 0, total: totalToProcess, running: true });

    try {
      let done = false;
      let totalProcessed = 0;

      while (!done && !emailGenPausedRef.current) {
        const { data, error } = await supabase.functions.invoke('enrich-and-generate-emails', {
          body: { missionId: viewingMission.id, batchSize: 10 },
        });

        if (error) throw error;

        totalProcessed += data.processed || 0;
        done = data.done;
        setEmailGenProgress({ processed: totalProcessed, total: totalToProcess, running: !done && !emailGenPausedRef.current });

        // Refresh results to show new emails in real-time
        await refreshMissionResults(viewingMission.id);

        if (!done && !emailGenPausedRef.current) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (emailGenPausedRef.current) {
        toast({ title: "In pausa", description: `${totalProcessed} email generate. Puoi riprendere quando vuoi.` });
      } else {
        toast({ title: "Email generate!", description: `${totalProcessed} email create con analisi del sito web` });
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      if (!emailGenPausedRef.current) {
        setGeneratingMissionEmails(false);
        setEmailGenProgress(prev => ({ ...prev, running: false }));
      }
    }
  };

  const pauseEmailGen = () => {
    emailGenPausedRef.current = true;
    setEmailGenPaused(true);
    setEmailGenProgress(prev => ({ ...prev, running: false }));
  };

  const resumeEmailGen = () => {
    setEmailGenPaused(false);
    generateMissionEmails();
  };

  const recoverMissingEmails = async () => {
    if (!viewingMission) return;
    recoverPausedRef.current = false;
    setRecoverPaused(false);
    setRecoveringEmails(true);
    setRecoverProgress({ processed: 0, total: 0, found: 0, running: true });

    try {
      let done = false;
      let totalProcessed = 0;
      let totalFound = 0;
      let realTotal: number | null = null;

      while (!done && !recoverPausedRef.current) {
        const { data, error } = await supabase.functions.invoke('enrich-and-generate-emails', {
          body: { missionId: viewingMission.id, batchSize: 10, emailOnly: true },
        });

        if (error) throw error;

        // On first batch, capture the real total from the DB
        if (realTotal === null) {
          realTotal = (data.processed || 0) + (data.remaining || 0);
        }

        totalProcessed += data.processed || 0;
        totalFound += data.successCount || 0;
        done = data.done;
        setRecoverProgress({ processed: totalProcessed, total: realTotal, found: totalFound, running: !done && !recoverPausedRef.current });

        await refreshMissionResults(viewingMission.id);

        if (!done && !recoverPausedRef.current) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      if (recoverPausedRef.current) {
        toast({ title: "In pausa", description: `${totalFound} email trovate su ${totalProcessed} analizzati.` });
      } else {
        toast({ title: "Recupero completato!", description: `${totalFound} email trovate su ${totalProcessed} analizzati` });
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      if (!recoverPausedRef.current) {
        setRecoveringEmails(false);
        setRecoverProgress(prev => ({ ...prev, running: false }));
      }
    }
  };

  const pauseRecover = () => {
    recoverPausedRef.current = true;
    setRecoverPaused(true);
    setRecoverProgress(prev => ({ ...prev, running: false }));
  };

  const resumeRecover = () => {
    setRecoverPaused(false);
    recoverMissingEmails();
  };

  const copyMissionEmail = (r: MissionResult) => {
    navigator.clipboard.writeText(`Oggetto: ${r.generated_email_subject}\n\n${r.generated_email_body}`);
    toast({ title: "Copiato!" });
  };

  const sendSelectedEmails = async (ids?: string[]) => {
    const idsToSend = ids || Array.from(selectedEmailIds);
    if (idsToSend.length === 0) {
      toast({ title: "Errore", description: "Seleziona almeno un'email da inviare", variant: "destructive" });
      return;
    }
    if (!emailSenderEmail) {
      toast({ title: "Errore", description: "Configura l'email mittente", variant: "destructive" });
      return;
    }
    setSendingEmails(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-scraping-email', {
        body: {
          resultIds: idsToSend,
          senderEmail: emailSenderEmail,
          senderName: emailSenderName,
          replyToEmail,
          htmlTemplate,
        },
      });
      if (error) throw error;
      toast({
        title: "Email inviate!",
        description: `${data.sent} inviate, ${data.failed} fallite su ${data.total} totali`,
      });
      if (data.errors?.length) {
        console.warn('Send errors:', data.errors);
      }
      // Refresh results
      if (viewingMission) await refreshMissionResults(viewingMission.id);
      setSelectedEmailIds(new Set());
    } catch (error: any) {
      toast({ title: "Errore invio", description: error.message, variant: "destructive" });
    } finally {
      setSendingEmails(false);
    }
  };

  const toggleEmailSelection = (id: string) => {
    const next = new Set(selectedEmailIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedEmailIds(next);
  };

  const hasValidEmail = (r: MissionResult) => !!r.contact_email && r.contact_email !== 'NOT_FOUND';
  const isSendable = (r: MissionResult) => r.generated_email_subject && !r.email_sent && hasValidEmail(r);

  const selectAllEmails = () => {
    const sendable = missionResults.filter(isSendable);
    if (selectedEmailIds.size === sendable.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(sendable.map(r => r.id)));
    }
  };

  // Manual scraping handlers
  const handleScrape = async () => {
    if (!query.trim()) {
      toast({ title: "Errore", description: "Inserisci una query", variant: "destructive" });
      return;
    }
    setScraping(true);
    setResults([]);
    setSelectedResults(new Set());
    setGeneratedEmails([]);
    try {
      const { data, error } = await supabase.functions.invoke('apify-scrape', {
        body: { query, location, language, maxResults },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
      setResults(data.results || []);
      setSelectedResults(new Set(data.results?.map((_: any, i: number) => i) || []));
      toast({ title: "Completato", description: `${data.resultsCount} risultati trovati` });
      if (data.results?.length > 0) setActiveTab("results");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setScraping(false);
    }
  };

  const handleGenerateEmails = async () => {
    if (selectedResults.size === 0 || !mission.trim()) return;
    setGenerating(true);
    try {
      const selectedData = results.filter((_, i) => selectedResults.has(i));
      const { data, error } = await supabase.functions.invoke('generate-scraping-emails', {
        body: { results: selectedData, mission, senderName, senderCompany, language: emailLanguage },
      });
      if (error) throw error;
      setGeneratedEmails(data.emails || []);
      toast({ title: "Email generate", description: `${data.successCount}/${data.totalProcessed} email generate` });
      setActiveTab("emails");
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const toggleResult = (i: number) => {
    const next = new Set(selectedResults);
    if (next.has(i)) next.delete(i); else next.add(i);
    setSelectedResults(next);
  };
  const toggleAll = () => {
    setSelectedResults(selectedResults.size === results.length ? new Set() : new Set(results.map((_, i) => i)));
  };
  const copyEmail = (email: GeneratedEmail) => {
    if (!email.email) return;
    navigator.clipboard.writeText(`Oggetto: ${email.email.subject}\n\n${email.email.body}`);
    toast({ title: "Copiato" });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="secondary">In attesa</Badge>;
      case 'running': return <Badge className="bg-blue-500 text-white">In corso</Badge>;
      case 'completed': return <Badge className="bg-green-600 text-white">Completata</Badge>;
      case 'failed': return <Badge variant="destructive">Fallita</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Group mission results by city
  const resultsByCity = missionResults.reduce((acc, r) => {
    if (!acc[r.city]) acc[r.city] = [];
    acc[r.city].push(r);
    return acc;
  }, {} as Record<string, MissionResult[]>);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Search className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Scraping & Lead Generation</h1>
            <p className="text-sm text-muted-foreground">
              Cerca attività con Apify e genera email personalizzate con AI
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="border-b">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:grid-cols-none lg:flex">
            <TabsTrigger value="agent" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Agente</span>
            </TabsTrigger>
            <TabsTrigger value="missions" className="flex items-center gap-2">
              <Rocket className="h-4 w-4" />
              <span className="hidden sm:inline">Missioni {missions.length > 0 && `(${missions.length})`}</span>
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Ricerca Manuale</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2" disabled={results.length === 0}>
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Risultati</span>
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2" disabled={generatedEmails.length === 0}>
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Email</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Agent Tab */}
        <TabsContent value="agent" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Nuova Missione Automatica
                </CardTitle>
                <CardDescription>
                  L'agente eseguirà lo scraping per ~140 città italiane (50k+ abitanti)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Nome missione *</Label>
                  <Input value={missionName} onChange={(e) => setMissionName(e.target.value)} placeholder="es: Ricerca Spazzacamini Italia" className="mt-1" />
                </div>
                <div>
                  <Label>Query di ricerca *</Label>
                  <Input value={agentQuery} onChange={(e) => setAgentQuery(e.target.value)} placeholder="es: spazzacamino (la città viene aggiunta automaticamente)" className="mt-1" />
                  <p className="text-xs text-muted-foreground mt-1">L'agente cercherà "{agentQuery || '...'} + [città]" per ogni città</p>
                </div>
                <div>
                  <Label>Missione / Scopo email *</Label>
                  <Textarea value={agentMission} onChange={(e) => setAgentMission(e.target.value)} placeholder="es: Presentazione Programma Partnership ZAPPER..." className="mt-1 min-h-[80px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nome mittente</Label>
                    <Input value={agentSenderName} onChange={(e) => setAgentSenderName(e.target.value)} placeholder="es: Mario Rossi" className="mt-1" />
                  </div>
                  <div>
                    <Label>Azienda</Label>
                    <Input value={agentSenderCompany} onChange={(e) => setAgentSenderCompany(e.target.value)} placeholder="es: ZAPPER" className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label>Max risultati per città</Label>
                  <Select value={String(agentMaxResults)} onValueChange={(v) => setAgentMaxResults(Number(v))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={launchAgent} disabled={launchingAgent} className="w-full" size="lg">
                  {launchingAgent ? (
                    <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Avvio in corso...</>
                  ) : (
                    <><Bot className="h-5 w-5 mr-2" />Lancia Agente</>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Come funziona</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 mt-0.5"><span className="text-primary font-bold text-xs">1</span></div>
                  <p>Inserisci la query base (es: "spazzacamino") e la missione delle email</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 mt-0.5"><span className="text-primary font-bold text-xs">2</span></div>
                  <p>L'agente cerca automaticamente "{agentQuery || 'query'} + [città]" per tutte le ~140 città italiane con 50k+ abitanti</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 mt-0.5"><span className="text-primary font-bold text-xs">3</span></div>
                  <p>Tutti i risultati vengono salvati nel database, organizzati per città</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 mt-0.5"><span className="text-primary font-bold text-xs">4</span></div>
                  <p>Puoi poi generare email AI personalizzate per ciascun risultato dalla sezione Missioni</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Missioni di Scraping</h3>
            <Button variant="outline" size="sm" onClick={fetchMissions}>
              <RefreshCw className="h-4 w-4 mr-2" />Aggiorna
            </Button>
          </div>

          {missions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Nessuna missione ancora. Vai su "Agente" per lanciarne una.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {missions.map((m) => (
                <Card key={m.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold">{m.name}</h4>
                          {getStatusBadge(m.status)}
                        </div>
                        <p className="text-sm text-muted-foreground">Query: "{m.query}"</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(m.created_at).toLocaleString('it-IT')}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <p><span className="font-medium">{m.completed_cities}</span>/{m.total_cities} città</p>
                          <p><span className="font-medium">{m.total_results}</span> risultati</p>
                        </div>
                        {m.status === 'completed' && (
                          <Button variant="outline" size="sm" onClick={() => viewMissionResults(m)}>
                            <Eye className="h-4 w-4 mr-1" />Vedi
                          </Button>
                        )}
                      </div>
                    </div>
                    {m.status === 'running' && m.total_cities > 0 && (
                      <div className="mt-3">
                        <Progress value={(m.completed_cities / m.total_cities) * 100} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-1">
                          {Math.round((m.completed_cities / m.total_cities) * 100)}% completato
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Manual Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Configurazione Scraping</CardTitle>
                <CardDescription>Ricerca manuale singola tramite Apify</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Query *</Label>
                  <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="es: spazzacamino Milano" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Paese</Label>
                    <Select value={location} onValueChange={setLocation}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italia</SelectItem>
                        <SelectItem value="de">Germania</SelectItem>
                        <SelectItem value="fr">Francia</SelectItem>
                        <SelectItem value="es">Spagna</SelectItem>
                        <SelectItem value="gb">UK</SelectItem>
                        <SelectItem value="us">USA</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Lingua</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="it">Italiano</SelectItem>
                        <SelectItem value="de">Tedesco</SelectItem>
                        <SelectItem value="fr">Francese</SelectItem>
                        <SelectItem value="en">Inglese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button onClick={handleScrape} disabled={scraping} className="w-full" size="lg">
                  {scraping ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Scraping...</> : <><Search className="h-5 w-5 mr-2" />Avvia Scraping</>}
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" />Missione Email</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Missione *</Label>
                  <Textarea value={mission} onChange={(e) => setMission(e.target.value)} placeholder="es: Presentazione Programma Partnership ZAPPER" className="mt-1 min-h-[80px]" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Mittente</Label><Input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="mt-1" /></div>
                  <div><Label>Azienda</Label><Input value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} className="mt-1" /></div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Risultati Scraping</CardTitle>
                  <CardDescription>{selectedResults.size} di {results.length} selezionati</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={toggleAll}>
                    {selectedResults.size === results.length ? "Deseleziona" : "Seleziona tutti"}
                  </Button>
                  <Button size="sm" onClick={handleGenerateEmails} disabled={generating || selectedResults.size === 0 || !mission.trim()}>
                    {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generando...</> : <><Mail className="h-4 w-4 mr-2" />Genera Email ({selectedResults.size})</>}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"><Checkbox checked={selectedResults.size === results.length && results.length > 0} onCheckedChange={toggleAll} /></TableHead>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Titolo</TableHead>
                      <TableHead>Descrizione</TableHead>
                      <TableHead className="w-10">Link</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i} className={selectedResults.has(i) ? "bg-primary/5" : ""}>
                        <TableCell><Checkbox checked={selectedResults.has(i)} onCheckedChange={() => toggleResult(i)} /></TableCell>
                        <TableCell className="text-muted-foreground">{r.position || i + 1}</TableCell>
                        <TableCell className="font-medium max-w-xs truncate">{r.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">{r.description}</TableCell>
                        <TableCell><a href={r.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" /></a></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Emails Tab */}
        <TabsContent value="emails" className="space-y-4">
          <div className="space-y-4">
            {generatedEmails.map((item, i) => (
              <Card key={i} className={item.error ? "border-destructive/50" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.email ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      <CardTitle className="text-base">{item.source.title}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.email?.recipientCompany && <Badge variant="outline">{item.email.recipientCompany}</Badge>}
                      {item.email && <Button variant="ghost" size="sm" onClick={() => copyEmail(item)}><Copy className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                </CardHeader>
                {item.email ? (
                  <CardContent className="space-y-2">
                    <div><Label className="text-xs text-muted-foreground">Oggetto</Label><p className="font-medium">{item.email.subject}</p></div>
                    <div><Label className="text-xs text-muted-foreground">Corpo</Label><p className="text-sm whitespace-pre-wrap bg-muted/50 rounded-md p-3 mt-1">{item.email.body}</p></div>
                  </CardContent>
                ) : (
                  <CardContent><p className="text-sm text-destructive">{item.error}</p></CardContent>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Mission Results Dialog */}
      <Dialog open={!!viewingMission} onOpenChange={(open) => { if (!open) { setViewingMission(null); setGeneratingMissionEmails(false); emailGenPausedRef.current = true; setEmailGenPaused(false); } }}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                Risultati: {viewingMission?.name}
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({missionResults.length} risultati in {Object.keys(resultsByCity).length} città)
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Recover missing emails button */}
                {recoverProgress.running ? (
                  <Button onClick={pauseRecover} variant="outline" size="sm">
                    <Pause className="h-4 w-4 mr-1" />Pausa Recupero
                  </Button>
                ) : recoverPaused ? (
                  <Button onClick={resumeRecover} variant="outline" size="sm">
                    <Play className="h-4 w-4 mr-1" />Riprendi Recupero
                  </Button>
                ) : missionResults.some(r => r.email_generated && (!r.contact_email || r.contact_email === 'NOT_FOUND')) && !emailGenProgress.running ? (
                  <Button onClick={recoverMissingEmails} variant="outline" size="sm" disabled={recoveringEmails}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Recupera Email ({missionResults.filter(r => r.email_generated && (!r.contact_email || r.contact_email === 'NOT_FOUND')).length})
                  </Button>
                ) : null}

                {/* Generate emails button */}
                {emailGenProgress.running ? (
                  <Button onClick={pauseEmailGen} variant="outline" size="sm">
                    <Pause className="h-4 w-4 mr-1" />Pausa
                  </Button>
                ) : emailGenPaused ? (
                  <Button onClick={resumeEmailGen} size="sm">
                    <Play className="h-4 w-4 mr-1" />Riprendi
                  </Button>
                ) : missionResults.some(r => !r.email_generated) ? (
                  <Button onClick={generateMissionEmails} disabled={generatingMissionEmails} size="sm">
                    <Mail className="h-4 w-4 mr-1" />Genera Email AI
                  </Button>
                ) : null}
              </div>
            </DialogTitle>
          </DialogHeader>

          {(emailGenProgress.running || emailGenPaused) && (
            <div className="space-y-2 p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {emailGenProgress.running ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Pause className="h-4 w-4 text-amber-500" />
                  )}
                  {emailGenProgress.running ? 'Analisi siti web e generazione email...' : 'In pausa'}
                </span>
                <span>{emailGenProgress.processed}/{emailGenProgress.total}</span>
              </div>
              <Progress value={emailGenProgress.total > 0 ? (emailGenProgress.processed / emailGenProgress.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {(recoverProgress.running || recoverPaused) && (
            <div className="space-y-2 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {recoverProgress.running ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Pause className="h-4 w-4 text-amber-500" />
                  )}
                  {recoverProgress.running ? 'Recupero email dai siti web...' : 'Recupero in pausa'}
                </span>
                <span>{recoverProgress.processed}/{recoverProgress.total} ({recoverProgress.found} trovate)</span>
              </div>
              <Progress value={recoverProgress.total > 0 ? (recoverProgress.processed / recoverProgress.total) * 100 : 0} className="h-2" />
            </div>
          )}

          {loadingResults ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <Tabs value={dialogEmailTab} onValueChange={setDialogEmailTab}>
              <TabsList>
                <TabsTrigger value="by-city">Per Città</TabsTrigger>
                <TabsTrigger value="emails">
                  Email Generate ({missionResults.filter(r => r.generated_email_subject).length})
                </TabsTrigger>
                <TabsTrigger value="template">Template HTML</TabsTrigger>
              </TabsList>

              <TabsContent value="by-city" className="space-y-4 mt-4">
                {Object.entries(resultsByCity).map(([city, cityResults]) => (
                  <Card key={city}>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{city}</span>
                        <div className="flex gap-2">
                          {cityResults.some(r => r.generated_email_subject) && (
                            <Badge className="bg-green-600 text-white">{cityResults.filter(r => r.generated_email_subject).length} email</Badge>
                          )}
                          <Badge variant="secondary">{cityResults.length} risultati</Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-0 pb-3">
                      <div className="space-y-1">
                        {cityResults.slice(0, 5).map((r) => (
                          <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                            <div className="flex items-center gap-2 truncate max-w-md">
                              {r.generated_email_subject ? (
                                <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />
                              ) : null}
                              <span className="truncate">{r.title}</span>
                            </div>
                            <a href={r.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-primary" />
                            </a>
                          </div>
                        ))}
                        {cityResults.length > 5 && (
                          <p className="text-xs text-muted-foreground">... e altri {cityResults.length - 5} risultati</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="emails" className="space-y-3 mt-4">
                {(() => {
                  const emailResults = missionResults.filter(r => r.generated_email_subject);
                   const sendable = emailResults.filter(r => isSendable(r));
                   if (emailResults.length === 0) {
                    return (
                      <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                          Nessuna email generata ancora. Clicca "Genera Email AI" per iniziare.
                        </CardContent>
                      </Card>
                    );
                  }
                  return (
                    <>
                      {/* Bulk send controls */}
                      <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                        <div className="flex items-center gap-3">
                          <Checkbox
                            checked={selectedEmailIds.size === sendable.length && sendable.length > 0}
                            onCheckedChange={selectAllEmails}
                            disabled={sendable.length === 0}
                          />
                          <span className="text-sm">
                            {selectedEmailIds.size > 0
                              ? `${selectedEmailIds.size} selezionate`
                              : `${sendable.length} da inviare`}
                            {emailResults.filter(r => r.email_sent).length > 0 && (
                              <span className="text-muted-foreground ml-1">
                                ({emailResults.filter(r => r.email_sent).length} già inviate)
                              </span>
                            )}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => sendSelectedEmails()}
                          disabled={sendingEmails || selectedEmailIds.size === 0}
                        >
                          {sendingEmails ? (
                            <><Loader2 className="h-4 w-4 mr-1 animate-spin" />Invio...</>
                          ) : (
                            <><Send className="h-4 w-4 mr-1" />Invia con Resend ({selectedEmailIds.size})</>
                          )}
                        </Button>
                      </div>

                      {emailResults.map((r) => (
                        <Card key={r.id} className={r.email_sent ? "border-green-200 bg-green-50/30" : !hasValidEmail(r) ? "opacity-60" : ""}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {!r.email_sent && hasValidEmail(r) && (
                                  <Checkbox
                                    checked={selectedEmailIds.has(r.id)}
                                    onCheckedChange={() => toggleEmailSelection(r.id)}
                                  />
                                )}
                                {r.email_sent ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : hasValidEmail(r) ? (
                                  <Mail className="h-4 w-4 text-primary" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-destructive" />
                                )}
                                <CardTitle className="text-sm">{r.recipient_company || r.title}</CardTitle>
                                <Badge variant="outline" className="text-xs">{r.city}</Badge>
                                {r.email_sent && <Badge className="bg-green-600 text-white text-xs">Inviata</Badge>}
                                {!hasValidEmail(r) && !r.email_sent && <Badge variant="destructive" className="text-xs">No email</Badge>}
                              </div>
                              <div className="flex items-center gap-1">
                                <Button variant="ghost" size="sm" onClick={() => copyMissionEmail(r)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                                {!r.email_sent && hasValidEmail(r) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setPreviewEmail(r)}
                                    disabled={sendingEmails}
                                    title="Anteprima e invia"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                                {!r.email_sent && hasValidEmail(r) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => sendSelectedEmails([r.id])}
                                    disabled={sendingEmails}
                                    title="Invia direttamente con Resend"
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {r.contact_email && r.contact_email !== 'NOT_FOUND' && (
                              <div>
                                <Label className="text-xs text-muted-foreground">Email contatto</Label>
                                <p className="text-sm font-medium text-primary">{r.contact_email}</p>
                              </div>
                            )}
                            {(!r.contact_email || r.contact_email === 'NOT_FOUND') && (
                              <div>
                                <Label className="text-xs text-destructive">⚠️ Nessuna email di contatto trovata</Label>
                              </div>
                            )}
                            <div>
                              <Label className="text-xs text-muted-foreground">Oggetto</Label>
                              <p className="font-medium text-sm">{r.generated_email_subject}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Corpo</Label>
                              <p className="text-xs whitespace-pre-wrap bg-muted/50 rounded-md p-3 mt-1">{r.generated_email_body}</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="template" className="mt-4">
                <EmailTemplateEditor
                  htmlTemplate={htmlTemplate}
                  onTemplateChange={handleTemplateChange}
                  senderEmail={emailSenderEmail}
                  onSenderEmailChange={handleSenderEmailChange}
                  senderName={emailSenderName}
                  onSenderNameChange={handleSenderNameChange}
                  replyToEmail={replyToEmail}
                  onReplyToEmailChange={handleReplyToChange}
                />
                <div className="flex justify-end mt-4">
                  <Button onClick={saveTemplate} disabled={!templateUnsaved} className="gap-2">
                    <Download className="h-4 w-4" />
                    {templateUnsaved ? 'Salva Template' : 'Salvato ✓'}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Email Preview Dialog */}
      <Dialog open={!!previewEmail} onOpenChange={(open) => !open && setPreviewEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anteprima Email</DialogTitle>
          </DialogHeader>
          {previewEmail && (() => {
            const previewHtml = htmlTemplate
              .replace(/\{\{subject\}\}/g, previewEmail.generated_email_subject || '')
              .replace(/\{\{body\}\}/g, (previewEmail.generated_email_body || '').replace(/\n/g, '<br>'))
              .replace(/\{\{recipient_name\}\}/g, previewEmail.recipient_name || '')
              .replace(/\{\{recipient_company\}\}/g, previewEmail.recipient_company || '')
              .replace(/\{\{sender_name\}\}/g, emailSenderName || '')
              .replace(/\{\{city\}\}/g, previewEmail.city || '')
              .replace(/\{\{url\}\}/g, previewEmail.url || '');
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Destinatario</Label>
                    <p className="font-medium">{previewEmail.contact_email || '⚠️ Nessuna email'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Oggetto</Label>
                    <p className="font-medium">{previewEmail.generated_email_subject}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Da</Label>
                    <p className="font-medium">{emailSenderName} &lt;{emailSenderEmail}&gt;</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Reply-To</Label>
                    <p className="font-medium">{replyToEmail || emailSenderEmail}</p>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: 400 }}
                    title="Email Preview"
                    sandbox=""
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setPreviewEmail(null)}>Annulla</Button>
                  <Button
                    onClick={() => {
                      sendSelectedEmails([previewEmail.id]);
                      setPreviewEmail(null);
                    }}
                    disabled={sendingEmails || !previewEmail.contact_email}
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Conferma Invio
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
