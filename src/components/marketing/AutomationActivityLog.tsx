import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Mail, MessageCircle, CheckCircle2, Clock, XCircle, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LogEntry {
  id: string;
  type: "email" | "whatsapp";
  status: string;
  leadName: string;
  campaignName: string;
  scheduledAt: string | null;
  sentAt: string | null;
  error?: string;
}

export function AutomationActivityLog() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();

    // Subscribe to realtime updates for both tables
    const emailChannel = supabase
      .channel('email-automation-logs')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'lead_automation_executions' },
        () => loadLogs()
      )
      .subscribe();

    const whatsappChannel = supabase
      .channel('whatsapp-automation-logs')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_automation_executions' },
        () => loadLogs()
      )
      .subscribe();

    // Also refresh every 30 seconds as fallback
    const interval = setInterval(loadLogs, 30000);

    return () => {
      supabase.removeChannel(emailChannel);
      supabase.removeChannel(whatsappChannel);
      clearInterval(interval);
    };
  }, []);

  const loadLogs = async () => {
    try {
      // Fetch email automation logs
      const { data: emailLogs } = await supabase
        .from("lead_automation_executions")
        .select(`
          id,
          status,
          scheduled_at,
          sent_at,
          error_message,
          lead:leads(company_name, contact_name),
          campaign:lead_automation_campaigns(name)
        `)
        .order("created_at", { ascending: false })
        .limit(25);

      // Fetch WhatsApp automation logs
      const { data: whatsappLogs } = await supabase
        .from("whatsapp_automation_executions")
        .select(`
          id,
          status,
          scheduled_for,
          sent_at,
          error_message,
          lead:leads(company_name, contact_name),
          campaign:whatsapp_automation_campaigns(name)
        `)
        .order("created_at", { ascending: false })
        .limit(25);

      // Combine and format logs
      const formattedLogs: LogEntry[] = [];

      (emailLogs || []).forEach((log: any) => {
        formattedLogs.push({
          id: log.id,
          type: "email",
          status: log.status || "pending",
          leadName: log.lead?.company_name || log.lead?.contact_name || "Lead sconosciuto",
          campaignName: log.campaign?.name || "Campagna",
          scheduledAt: log.scheduled_at,
          sentAt: log.sent_at,
          error: log.error_message,
        });
      });

      (whatsappLogs || []).forEach((log: any) => {
        formattedLogs.push({
          id: log.id,
          type: "whatsapp",
          status: log.status || "pending",
          leadName: log.lead?.company_name || log.lead?.contact_name || "Lead sconosciuto",
          campaignName: log.campaign?.name || "Campagna",
          scheduledAt: log.scheduled_for,
          sentAt: log.sent_at,
          error: log.error_message,
        });
      });

      // Sort by scheduled/sent date
      formattedLogs.sort((a, b) => {
        const dateA = new Date(a.sentAt || a.scheduledAt || 0).getTime();
        const dateB = new Date(b.sentAt || b.scheduledAt || 0).getTime();
        return dateB - dateA;
      });

      setLogs(formattedLogs.slice(0, 50));
    } catch (error) {
      console.error("Error loading automation logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "pending":
      case "scheduled":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "failed":
      case "error":
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge variant="default" className="bg-green-500/10 text-green-700 hover:bg-green-500/20">Inviato</Badge>;
      case "pending":
      case "scheduled":
        return <Badge variant="secondary">In attesa</Badge>;
      case "failed":
      case "error":
        return <Badge variant="destructive">Errore</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd MMM HH:mm", { locale: it });
  };

  // Calculate stats
  const stats = {
    emailSent: logs.filter(l => l.type === "email" && l.status === "sent").length,
    emailPending: logs.filter(l => l.type === "email" && (l.status === "pending" || l.status === "scheduled")).length,
    whatsappSent: logs.filter(l => l.type === "whatsapp" && l.status === "sent").length,
    whatsappPending: logs.filter(l => l.type === "whatsapp" && (l.status === "pending" || l.status === "scheduled")).length,
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-medium flex items-center justify-between">
          <span>Attività Recenti</span>
          <div className="flex items-center gap-4 text-sm font-normal">
            <div className="flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-blue-500" />
              <span className="text-muted-foreground">{stats.emailSent} inv.</span>
              {stats.emailPending > 0 && (
                <span className="text-amber-600">/ {stats.emailPending} pend.</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">{stats.whatsappSent} inv.</span>
              {stats.whatsappPending > 0 && (
                <span className="text-amber-600">/ {stats.whatsappPending} pend.</span>
              )}
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nessuna attività di automazione registrata
          </p>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={`${log.type}-${log.id}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0">
                    {log.type === "email" ? (
                      <div className="p-1.5 bg-blue-500/10 rounded">
                        <Mail className="h-3.5 w-3.5 text-blue-500" />
                      </div>
                    ) : (
                      <div className="p-1.5 bg-green-500/10 rounded">
                        <MessageCircle className="h-3.5 w-3.5 text-green-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{log.leadName}</span>
                      {getStatusBadge(log.status)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {log.campaignName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {getStatusIcon(log.status)}
                    <span className="text-xs text-muted-foreground">
                      {formatDate(log.sentAt || log.scheduledAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
