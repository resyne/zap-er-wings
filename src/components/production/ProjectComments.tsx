import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Send, Loader2, Trash2 } from "lucide-react";

interface Comment {
  id: string;
  content: string;
  created_by: string | null;
  created_at: string;
  profile?: { first_name: string | null; last_name: string | null; email: string | null };
}

export function ProjectComments({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("production_project_comments")
      .select("*, profile:created_by(first_name, last_name, email)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    setComments((data as any[]) || []);
    setLoading(false);
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const addComment = async () => {
    if (!newComment.trim()) return;
    setSending(true);
    const { error } = await supabase.from("production_project_comments").insert({
      project_id: projectId,
      content: newComment.trim(),
      created_by: user?.id,
    });
    if (error) { toast.error("Errore"); } else {
      await supabase.from("production_project_activity_log").insert({
        project_id: projectId,
        action: "comment_added",
        details: "Nuovo commento aggiunto",
        created_by: user?.id,
      });
      setNewComment("");
      load();
    }
    setSending(false);
  };

  const deleteComment = async (id: string) => {
    await supabase.from("production_project_comments").delete().eq("id", id);
    toast.success("Eliminato");
    load();
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin mx-auto" />;

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Textarea
          placeholder="Scrivi un commento..."
          value={newComment}
          onChange={e => setNewComment(e.target.value)}
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={addComment} disabled={sending || !newComment.trim()} className="gap-1">
            {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Invia
          </Button>
        </div>
      </div>

      {comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nessun commento</p>
      ) : (
        <div className="space-y-2 max-h-[250px] overflow-y-auto">
          {comments.map(c => (
            <div key={c.id} className="p-2 rounded border bg-muted/30 group">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium">
                  {c.profile?.first_name
                    ? `${c.profile.first_name} ${c.profile.last_name || ""}`
                    : c.profile?.email || "Utente"}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  {c.created_by === user?.id && (
                    <Button
                      variant="ghost" size="sm"
                      className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => deleteComment(c.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
