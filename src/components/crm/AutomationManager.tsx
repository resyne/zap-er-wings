import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Clock, Mail, Calendar, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Automation {
  id: string;
  name: string;
  description: string | null;
  delay_days: number;
  target_audience: string;
  subject: string;
  is_active: boolean;
  created_at: string;
  sender_email: string;
  sender_name: string;
}

interface AutomationLog {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
}

export const AutomationManager = () => {
  const { toast } = useToast();
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAutomations();
  }, []);

  useEffect(() => {
    if (selectedAutomation) {
      fetchLogs(selectedAutomation);
    }
  }, [selectedAutomation]);

  const fetchAutomations = async () => {
    try {
      const { data, error } = await supabase
        .from("email_automations")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAutomations(data || []);
    } catch (error) {
      console.error("Error fetching automations:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare le automation",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (automationId: string) => {
    try {
      const { data, error } = await supabase
        .from("email_automation_logs")
        .select("*")
        .eq("automation_id", automationId)
        .order("scheduled_for", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error("Error fetching logs:", error);
    }
  };

  const toggleAutomation = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("email_automations")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Automation aggiornata",
        description: `Automation ${!currentStatus ? "attivata" : "disattivata"} con successo`,
      });

      fetchAutomations();
    } catch (error) {
      console.error("Error toggling automation:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'automation",
        variant: "destructive",
      });
    }
  };

  const deleteAutomation = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa automation?")) return;

    try {
      const { error } = await supabase
        .from("email_automations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Automation eliminata",
        description: "L'automation è stata eliminata con successo",
      });

      fetchAutomations();
      if (selectedAutomation === id) {
        setSelectedAutomation(null);
        setLogs([]);
      }
    } catch (error) {
      console.error("Error deleting automation:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'automation",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      scheduled: "secondary",
      sent: "default",
      failed: "destructive",
    };

    const labels: Record<string, string> = {
      scheduled: "Programmata",
      sent: "Inviata",
      failed: "Fallita",
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Caricamento...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map((automation) => (
          <Card
            key={automation.id}
            className={`cursor-pointer transition-all ${
              selectedAutomation === automation.id
                ? "ring-2 ring-primary"
                : "hover:shadow-md"
            }`}
            onClick={() => setSelectedAutomation(automation.id)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{automation.name}</CardTitle>
                  {automation.description && (
                    <p className="text-sm text-muted-foreground">
                      {automation.description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={automation.is_active}
                    onCheckedChange={() =>
                      toggleAutomation(automation.id, automation.is_active)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAutomation(automation.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>Follow-up dopo {automation.delay_days} giorni</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{automation.subject}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Creata il {format(new Date(automation.created_at), "dd/MM/yyyy", { locale: it })}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline">{automation.target_audience}</Badge>
                <Badge variant={automation.is_active ? "default" : "secondary"}>
                  {automation.is_active ? "Attiva" : "Disattivata"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedAutomation && logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cronologia Invii</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="font-medium">
                      {log.recipient_name || log.recipient_email}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {log.recipient_email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Programmata per:{" "}
                      {format(new Date(log.scheduled_for), "dd/MM/yyyy HH:mm", {
                        locale: it,
                      })}
                    </div>
                    {log.sent_at && (
                      <div className="text-xs text-muted-foreground">
                        Inviata il:{" "}
                        {format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", {
                          locale: it,
                        })}
                      </div>
                    )}
                  </div>
                  {getStatusBadge(log.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {automations.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              Nessuna automation configurata. Crea una nuova automation dalla
              composizione newsletter.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
