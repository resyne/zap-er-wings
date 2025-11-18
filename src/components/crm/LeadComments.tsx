import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { MessageSquare, Send, Trash2, AtSign } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface LeadComment {
  id: string;
  content: string;
  created_by: string;
  tagged_users: string[];
  created_at: string;
  profiles?: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface LeadCommentsProps {
  leadId: string;
}

export default function LeadComments({ leadId }: LeadCommentsProps) {
  const [comments, setComments] = useState<LeadComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from("lead_comments")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (commentsError) throw commentsError;

      // Load profiles for all comment authors
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.created_by))];
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        // Merge profiles with comments
        const commentsWithProfiles = commentsData.map(comment => ({
          ...comment,
          profiles: profilesData?.find(p => p.id === comment.created_by) || {
            first_name: "Unknown",
            last_name: "User",
            email: ""
          }
        }));

        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error("Error loading comments:", error);
    }
  }, [leadId]);

  const loadUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("user_type", "erp")
        .order("first_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  }, []);

  useEffect(() => {
    loadComments();
    loadUsers();
  }, [loadComments, loadUsers]);

  // Realtime subscription per i commenti
  useEffect(() => {
    const channel = supabase
      .channel('lead-comments-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lead_comments',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          loadComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lead_comments',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          loadComments();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'lead_comments',
          filter: `lead_id=eq.${leadId}`
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId, loadComments]);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Errore",
        description: "Inserisci un commento",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("lead_comments")
        .insert({
          lead_id: leadId,
          content: newComment,
          created_by: user.id,
          tagged_users: selectedUsers,
        });

      if (error) throw error;

      // Se il lead è "new", cambialo a "qualified" perché c'è stata interazione
      try {
        const { data: leadData } = await supabase
          .from("leads")
          .select("status")
          .eq("id", leadId)
          .single();

        if (leadData?.status === "new") {
          await supabase
            .from("leads")
            .update({ status: "qualified" })
            .eq("id", leadId);
        }
      } catch (statusError) {
        console.error("Error updating lead status:", statusError);
        // Non bloccare l'inserimento del commento se l'aggiornamento dello status fallisce
      }

      toast({
        title: "Commento aggiunto",
        description: "Il commento è stato aggiunto con successo",
      });

      setNewComment("");
      setSelectedUsers([]);
      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il commento: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("lead_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Commento eliminato",
        description: "Il commento è stato eliminato con successo",
      });

      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il commento: " + error.message,
        variant: "destructive",
      });
    }
  };

  const toggleUserTag = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getTaggedUserNames = (taggedUserIds: string[]) => {
    return users
      .filter(u => taggedUserIds.includes(u.id))
      .map(u => `${u.first_name} ${u.last_name}`)
      .join(", ");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Commenti ({comments.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Scrivi un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          
          {/* Tagged Users Display */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Taggati:</span>
              {selectedUsers.map(userId => {
                const user = users.find(u => u.id === userId);
                return user ? (
                  <Badge key={userId} variant="secondary">
                    @{user.first_name} {user.last_name}
                  </Badge>
                ) : null;
              })}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Popover open={showUserPicker} onOpenChange={setShowUserPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <AtSign className="w-4 h-4 mr-2" />
                  Tagga Utente
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca utente..." />
                  <CommandEmpty>Nessun utente trovato</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-y-auto">
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.first_name} ${user.last_name}`}
                        onSelect={() => {
                          toggleUserTag(user.id);
                          setShowUserPicker(false);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={() => toggleUserTag(user.id)}
                            className="rounded"
                          />
                          <span>{user.first_name} {user.last_name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({user.email})
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>

            <Button onClick={handleAddComment} disabled={loading} size="sm">
              <Send className="w-4 h-4 mr-2" />
              Invia
            </Button>
          </div>
        </div>

        {/* Comments List */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun commento ancora
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">
                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: it,
                        })}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                    {comment.tagged_users && comment.tagged_users.length > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <AtSign className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {getTaggedUserNames(comment.tagged_users)}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteComment(comment.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
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
