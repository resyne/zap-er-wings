import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, AtSign, Send } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";

interface TicketComment {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  tagged_users: string[];
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  } | null;
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface TicketCommentsProps {
  ticketId: string;
}

export function TicketComments({ ticketId }: TicketCommentsProps) {
  const [comments, setComments] = useState<TicketComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("ticket_comments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const commentsWithProfiles = await Promise.all(
        (data || []).map(async (comment) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("id, first_name, last_name, email")
            .eq("id", comment.created_by)
            .single();

          return {
            ...comment,
            profiles: profile,
          };
        })
      );

      setComments(commentsWithProfiles);
    } catch (error: any) {
      console.error("Error loading comments:", error);
      toast.error("Errore nel caricamento dei commenti");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

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

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast.error("Inserisci un commento");
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase.from("ticket_comments").insert({
        ticket_id: ticketId,
        content: newComment,
        created_by: user.id,
        tagged_users: selectedUsers,
      });

      if (error) throw error;

      toast.success("Commento aggiunto");
      setNewComment("");
      setSelectedUsers([]);
      loadComments();
    } catch (error: any) {
      console.error("Error adding comment:", error);
      toast.error("Errore nell'aggiunta del commento");
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("ticket_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast.success("Commento eliminato");
      loadComments();
    } catch (error: any) {
      console.error("Error deleting comment:", error);
      toast.error("Errore nell'eliminazione del commento");
    }
  };

  const toggleUserTag = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const getTaggedUserNames = (taggedUserIds: string[]) => {
    return users
      .filter((u) => taggedUserIds.includes(u.id))
      .map((u) => `${u.first_name || ""} ${u.last_name || ""}`.trim() || u.email)
      .join(", ");
  };

  const getUserDisplayName = (user?: User | null) => {
    if (!user) return "Utente sconosciuto";
    return `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email || "Utente";
  };

  const getInitials = (user?: User | null) => {
    if (!user) return "?";
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    return "?";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Caricamento commenti...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Storico Avanzamento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new comment */}
        <div className="space-y-2">
          <Textarea
            placeholder="Aggiungi un aggiornamento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Popover open={showUserPicker} onOpenChange={setShowUserPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <AtSign className="h-4 w-4 mr-2" />
                  Menziona ({selectedUsers.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca utente..." />
                  <CommandList>
                    <CommandEmpty>Nessun utente trovato</CommandEmpty>
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => toggleUserTag(user.id)}
                        >
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="checkbox"
                              checked={selectedUsers.includes(user.id)}
                              onChange={() => {}}
                              className="h-4 w-4"
                            />
                            <span>{getUserDisplayName(user)}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button onClick={handleAddComment} size="sm">
              <Send className="h-4 w-4 mr-2" />
              Invia
            </Button>
          </div>
          {selectedUsers.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {selectedUsers.map((userId) => {
                const user = users.find((u) => u.id === userId);
                return (
                  <Badge key={userId} variant="secondary">
                    {getUserDisplayName(user)}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>

        {/* Comments list */}
        <div className="space-y-4">
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessun commento ancora
            </p>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="flex gap-3 p-4 rounded-lg border bg-card"
              >
                <Avatar>
                  <AvatarFallback>
                    {getInitials(comment.profiles)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {getUserDisplayName(comment.profiles)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: it,
                        })}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                  {comment.tagged_users && comment.tagged_users.length > 0 && (
                    <div className="flex gap-1 flex-wrap mt-2">
                      <span className="text-xs text-muted-foreground">
                        Menzionati:
                      </span>
                      {comment.tagged_users.map((userId) => {
                        const user = users.find((u) => u.id === userId);
                        return (
                          <Badge key={userId} variant="outline" className="text-xs">
                            {getUserDisplayName(user)}
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
