import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Activity } from "lucide-react";

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  created_by: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; email: string | null };
}

const actionLabels: Record<string, { label: string; color: string }> = {
  task_added: { label: "📋 Task aggiunta", color: "text-blue-600" },
  task_completed: { label: "✅ Task completata", color: "text-green-600" },
  task_reopened: { label: "🔄 Task riaperta", color: "text-orange-500" },
  task_deleted: { label: "🗑️ Task eliminata", color: "text-red-500" },
  comment_added: { label: "💬 Commento", color: "text-purple-600" },
  status_changed: { label: "📌 Stato cambiato", color: "text-amber-600" },
  project_updated: { label: "✏️ Progetto aggiornato", color: "text-muted-foreground" },
  attachment_added: { label: "📎 Allegato aggiunto", color: "text-teal-600" },
};

export function ProjectActivityLog({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("production_project_activity_log")
      .select("*, profile:created_by(first_name, last_name, email)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mb-2" />
        <p className="text-sm">Nessuna attività registrata</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 max-h-[300px] overflow-y-auto">
      {logs.map(log => {
        const meta = actionLabels[log.action] || { label: log.action, color: "text-muted-foreground" };
        return (
          <div key={log.id} className="flex gap-2 p-1.5 rounded hover:bg-muted/30 text-xs">
            <div className="flex-shrink-0 w-[140px]">
              <span className="text-[10px] text-muted-foreground">
                {new Date(log.created_at).toLocaleString("it-IT", {
                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                })}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <span className={`font-medium ${meta.color}`}>{meta.label}</span>
              {log.details && (
                <p className="text-muted-foreground truncate">{log.details}</p>
              )}
              {log.profile && (
                <span className="text-[10px] text-muted-foreground">
                  — {log.profile.first_name || log.profile.email}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
