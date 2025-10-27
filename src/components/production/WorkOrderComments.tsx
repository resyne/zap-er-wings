import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Send, Trash2, AtSign, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface WorkOrderComment {
  id: string;
  work_order_id: string;
  content: string;
  created_at: string;
  user_id: string;
  tagged_users: string[];
  profiles?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url?: string | null;
  };
}

interface User {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface WorkOrderCommentsProps {
  workOrderId: string;
}

export function WorkOrderComments({ workOrderId }: WorkOrderCommentsProps) {
  const [comments, setComments] = useState<WorkOrderComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("work_order_comments")
        .select(`
          *,
          profiles(id, first_name, last_name, email, avatar_url)
        `)
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i commenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [workOrderId, toast]);

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
    if (!newComment.trim()) return;

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("work_order_comments")
        .insert({
          work_order_id: workOrderId,
          content: newComment,
          user_id: user.id,
          tagged_users: selectedUsers,
        });

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commento aggiunto con successo",
      });

      setNewComment("");
      setSelectedUsers([]);
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
        .from("work_order_comments")
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

  const toggleUserTag = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const getUserDisplayName = (user: User | WorkOrderComment['profiles']) => {
    if (!user) return "Utente";
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.email;
  };

  const getInitials = (user: User | WorkOrderComment['profiles']) => {
    if (!user) return "U";
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  if (loading) {
    return <div className="text-center py-4">Caricamento commenti...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Commenti</span>
          <Badge variant="secondary">{comments.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add comment form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Aggiungi un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <AtSign className="h-4 w-4 mr-2" />
                  Tagga utenti {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca utenti..." />
                  <CommandList>
                    <CommandEmpty>Nessun utente trovato.</CommandEmpty>
                    <CommandGroup>
                      {users.map((user) => (
                        <CommandItem
                          key={user.id}
                          onSelect={() => toggleUserTag(user.id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span>{getUserDisplayName(user)}</span>
                            {selectedUsers.includes(user.id) && (
                              <Check className="h-4 w-4" />
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <Button onClick={handleAddComment} disabled={submitting || !newComment.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Invia
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nessun commento ancora. Sii il primo a commentare!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(comment.profiles)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm">
                        {getUserDisplayName(comment.profiles)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {format(new Date(comment.created_at), "dd MMM yyyy 'alle' HH:mm", { locale: it })}
                      </span>
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
                    <div className="flex flex-wrap gap-1">
                      {comment.tagged_users.map((userId) => {
                        const taggedUser = users.find((u) => u.id === userId);
                        return taggedUser ? (
                          <Badge key={userId} variant="secondary" className="text-xs">
                            @{getUserDisplayName(taggedUser)}
                          </Badge>
                        ) : null;
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
