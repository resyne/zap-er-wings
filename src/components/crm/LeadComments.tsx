import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, Trash2, AtSign } from "lucide-react";
import { format } from "date-fns";
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

      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.created_by))];
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

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
    <div className="space-y-3">
      {/* Add Comment */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Aggiungi commento..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={2}
          className="text-sm resize-none"
        />
        <div className="flex flex-col gap-1">
          <Popover open={showUserPicker} onOpenChange={setShowUserPicker}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <AtSign className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-0" align="end">
              <Command>
                <CommandInput placeholder="Cerca utente..." />
                <CommandEmpty>Nessun utente trovato</CommandEmpty>
                <CommandGroup className="max-h-[150px] overflow-y-auto">
                  {users.map((user) => (
                    <CommandItem
                      key={user.id}
                      value={`${user.first_name} ${user.last_name}`}
                      onSelect={() => {
                        toggleUserTag(user.id);
                        setShowUserPicker(false);
                      }}
                    >
                      <div className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selectedUsers.includes(user.id)}
                          onChange={() => toggleUserTag(user.id)}
                          className="rounded"
                        />
                        <span>{user.first_name} {user.last_name}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>
          <Button onClick={handleAddComment} disabled={loading} size="icon" className="h-8 w-8">
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      
      {/* Tagged Users */}
      {selectedUsers.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          {selectedUsers.map(userId => {
            const user = users.find(u => u.id === userId);
            return user ? (
              <Badge key={userId} variant="secondary" className="text-xs">
                @{user.first_name}
              </Badge>
            ) : null;
          })}
        </div>
      )}

      {/* Comments List */}
      {comments.length > 0 && (
        <div className="space-y-2 pt-2 border-t">
          {comments.map((comment) => (
            <div key={comment.id} className="group flex gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {comment.profiles?.first_name} {comment.profiles?.last_name}
                  </span>
                  <span>•</span>
                  <span>
                    {format(new Date(comment.created_at), "dd/MM/yy HH:mm", { locale: it })}
                  </span>
                  {comment.tagged_users && comment.tagged_users.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <AtSign className="h-3 w-3" />
                        {getTaggedUserNames(comment.tagged_users)}
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm mt-0.5">{comment.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteComment(comment.id)}
                className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
