import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Clock, User, FileEdit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface ActivityLog {
  id: string;
  action: string;
  details: any;
  old_values: any;
  new_values: any;
  created_at: string;
  user_id: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

interface WorkOrderActivityLogProps {
  workOrderId: string;
}

export function WorkOrderActivityLog({ workOrderId }: WorkOrderActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, [workOrderId]);

  const loadLogs = async () => {
    try {
      const { data: logsData, error: logsError } = await supabase
        .from("work_order_logs")
        .select("*")
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });

      if (logsError) throw logsError;

      // Load user profiles for the logs
      const userIds = [...new Set(logsData?.map(log => log.user_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Merge logs with profiles
      const logsWithProfiles = logsData?.map(log => ({
        ...log,
        profiles: profiles?.find(p => p.id === log.user_id)
      })) || [];

      setLogs(logsWithProfiles);
    } catch (error: any) {
      console.error("Error loading logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
    return email || "Sistema";
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "created":
        return <Badge className="bg-green-100 text-green-800">Creato</Badge>;
      case "updated":
        return <Badge className="bg-blue-100 text-blue-800">Aggiornato</Badge>;
      case "assigned":
        return <Badge className="bg-purple-100 text-purple-800">Assegnato</Badge>;
      case "status_changed":
        return <Badge className="bg-amber-100 text-amber-800">Stato Modificato</Badge>;
      case "deleted":
        return <Badge className="bg-red-100 text-red-800">Eliminato</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const renderChangeDetails = (log: ActivityLog) => {
    if (!log.details?.changes) return null;

    const changes = log.details.changes;
    const changeEntries = Object.entries(changes).filter(([_, value]) => value !== null);

    if (changeEntries.length === 0) return null;

    return (
      <div className="mt-2 space-y-1 text-xs">
        {changeEntries.map(([field, change]: [string, any]) => {
          const fieldLabels: Record<string, string> = {
            status: "Stato",
            assigned_to: "Assegnato a",
            priority: "Priorità",
            title: "Titolo",
            planned_start_date: "Inizio Pianificato",
            planned_end_date: "Fine Pianificata",
          };

          return (
            <div key={field} className="pl-4 border-l-2 border-muted">
              <span className="font-medium">{fieldLabels[field] || field}:</span>{" "}
              <span className="text-muted-foreground">
                {change.old !== null && change.old !== undefined ? (
                  <>
                    <span className="line-through">{String(change.old)}</span>
                    {" → "}
                  </>
                ) : null}
                <span className="text-foreground font-medium">{String(change.new)}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Caricamento storico...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Storico Attività
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            Nessuna attività registrata
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {logs.map((log, index) => (
              <div
                key={log.id}
                className={`flex gap-3 pb-4 ${
                  index !== logs.length - 1 ? "border-b" : ""
                }`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <FileEdit className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getActionBadge(log.action)}
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: it,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">
                      {getUserName(
                        log.profiles?.first_name,
                        log.profiles?.last_name,
                        log.profiles?.email
                      )}
                    </span>
                  </div>
                  {log.details?.message && (
                    <p className="text-sm text-muted-foreground">{log.details.message}</p>
                  )}
                  {renderChangeDetails(log)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
