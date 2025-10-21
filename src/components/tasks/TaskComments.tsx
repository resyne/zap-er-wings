import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TaskComment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  author?: {
    first_name: string;
    last_name: string;
  };
}

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const { data: commentsData, error } = await supabase
        .from("task_comments")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Load authors separately
      const commentsWithAuthors = await Promise.all(
        (commentsData || []).map(async (comment) => {
          const { data: author } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .eq("id", comment.user_id)
            .single();

          return {
            ...comment,
            author: author || undefined,
          };
        })
      );

      setComments(commentsWithAuthors);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i commenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const { error: commentError } = await supabase
        .from("task_comments")
        .insert({
          task_id: taskId,
          comment: newComment,
          user_id: user.id,
        });

      if (commentError) throw commentError;

      toast({
        title: "Successo",
        description: "Commento aggiunto",
      });

      setNewComment("");
      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("task_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commento eliminato",
      });

      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getUserFullName = (user?: { first_name: string; last_name: string }) => {
    if (!user) return "Utente";
    return `${user.first_name} ${user.last_name}`.trim();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Commenti</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Aggiungi un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleAddComment}
              disabled={!newComment.trim() || submitting}
              size="sm"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Invia
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun commento ancora
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 space-y-2 bg-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {getUserFullName(comment.author)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(
                          new Date(comment.created_at),
                          "dd MMM yyyy, HH:mm",
                          { locale: it }
                        )}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDeleteComment(comment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
