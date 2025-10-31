import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Bot, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface ActivityLog {
  id: string;
  created_at: string;
  action_type: string;
  action_description: string;
  request_summary: string;
  response_summary: string | null;
  success: boolean;
  error_message: string | null;
}

export default function JessyActivityLog() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActivities();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('jessy-activity-logs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ai_activity_logs'
        },
        (payload) => {
          setActivities(prev => [payload.new as ActivityLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('ai_activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error loading activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (actionType: string) => {
    const labels: Record<string, string> = {
      'get_leads': 'Consultazione Lead',
      'create_lead': 'Creazione Lead',
      'update_lead': 'Aggiornamento Lead',
      'get_customers': 'Consultazione Clienti',
      'create_customer': 'Creazione Cliente',
      'get_offers': 'Consultazione Offerte',
      'get_cost_drafts': 'Consultazione Preventivi'
    };
    return labels[actionType] || actionType;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Attività JESSY - Back office AI
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin mr-2" />
            Caricamento...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-5 w-5" />
          Attività JESSY - Back office AI
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Nessuna attività registrata</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {activity.success ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      )}
                      <span className="font-medium text-sm">
                        {getActionLabel(activity.action_type)}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {formatDistanceToNow(new Date(activity.created_at), {
                        addSuffix: true,
                        locale: it
                      })}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-1">
                    <span className="font-medium">Richiesta:</span> {activity.request_summary}
                  </p>
                  
                  {activity.response_summary && (
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium">Risultato:</span> {activity.response_summary}
                    </p>
                  )}

                  {activity.error_message && (
                    <p className="text-sm text-red-500 mt-1">
                      <span className="font-medium">Errore:</span> {activity.error_message}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
