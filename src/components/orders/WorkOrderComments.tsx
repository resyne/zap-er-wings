import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Trash2, AtSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface WorkOrderComment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  tagged_users: string[];
  user_profiles?: {
    first_name: string;
    last_name: string;
  };
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
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
  const [showUserPicker, setShowUserPicker] = useState(false);
  const { toast } = useToast();

  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("work_order_comments")
        .select(`
          *,
          user_profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq("work_order_id", workOrderId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error: any) {
      console.error("Errore nel caricamento dei commenti:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, first_name, last_name")
        .eq("user_type", "erp")
        .order("first_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Errore nel caricamento degli utenti:", error);
    }
  };

  useEffect(() => {
    loadComments();
    loadUsers();
  }, [workOrderId]);

  const handleAddComment = async () => {
    if (!newComment.trim()) {
      toast({
        title: "Errore",
        description: "Il commento non può essere vuoto",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non autenticato");

      const { error } = await supabase.from("work_order_comments").insert({
        work_order_id: workOrderId,
        content: newComment,
        user_id: user.id,
        tagged_users: selectedUsers,
      });

      if (error) throw error;

      // Send notifications to tagged users
      if (selectedUsers.length > 0) {
        const { data: userProfile } = await supabase
          .from("user_profiles")
          .select("first_name, last_name")
          .eq("id", user.id)
          .single();

        const authorName = userProfile 
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : "Un utente";

        for (const userId of selectedUsers) {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "Menzionato in un commento",
            message: `${authorName} ti ha menzionato in un commento della commessa di produzione`,
            type: "mention",
            link: `/mfg/work-orders`,
          });
        }
      }

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
        description: "Impossibile aggiungere il commento: " + error.message,
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

  const getUserDisplayName = (user: User) => {
    return `${user.first_name} ${user.last_name}`;
  };

  const getInitials = (comment: WorkOrderComment) => {
    if (comment.user_profiles) {
      return `${comment.user_profiles.first_name[0]}${comment.user_profiles.last_name[0]}`.toUpperCase();
    }
    return "??";
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Caricamento commenti...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Commenti e Attività</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Existing Comments */}
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nessun commento ancora. Aggiungi il primo!
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{getInitials(comment)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {comment.user_profiles
                          ? `${comment.user_profiles.first_name} ${comment.user_profiles.last_name}`
                          : "Utente Sconosciuto"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(comment.created_at).toLocaleString("it-IT")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                      className="h-8 w-8 p-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{comment.content}</p>
                  {comment.tagged_users && comment.tagged_users.length > 0 && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      {comment.tagged_users.map((userId) => {
                        const user = users.find((u) => u.id === userId);
                        return user ? (
                          <Badge key={userId} variant="secondary" className="text-xs">
                            @{getUserDisplayName(user)}
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

        {/* New Comment Form */}
        <div className="space-y-2">
          <Textarea
            placeholder="Aggiungi un commento..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            rows={3}
          />
          <div className="flex items-center justify-between">
            <Popover open={showUserPicker} onOpenChange={setShowUserPicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <AtSign className="h-4 w-4 mr-2" />
                  Tagga Utenti {selectedUsers.length > 0 && `(${selectedUsers.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca utente..." />
                  <CommandEmpty>Nessun utente trovato</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-auto">
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => toggleUserTag(user.id)}
                      >
                        <div className={`flex items-center gap-2 w-full`}>
                          <div className={`h-4 w-4 border rounded ${
                            selectedUsers.includes(user.id)
                              ? "bg-primary border-primary"
                              : "border-input"
                          }`} />
                          <span>{getUserDisplayName(user)}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
            <Button onClick={handleAddComment} disabled={submitting}>
              {submitting ? "Invio..." : "Pubblica"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
