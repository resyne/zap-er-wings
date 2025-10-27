import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Send, AtSign, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Comment {
  id: string;
  comment: string;
  user_id: string;
  tagged_users: string[];
  created_at: string;
  profiles?: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
}

interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  email: string;
}

interface ShippingOrderCommentsProps {
  shippingOrderId: string;
}

export function ShippingOrderComments({ shippingOrderId }: ShippingOrderCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    loadComments();
    loadUsers();
  }, [shippingOrderId]);

  const loadComments = async () => {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from("shipping_order_comments")
        .select("*")
        .eq("shipping_order_id", shippingOrderId)
        .order("created_at", { ascending: true });

      if (commentsError) throw commentsError;

      // Load profiles for comments
      const userIds = [...new Set(commentsData?.map(c => c.user_id) || [])];
      
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      const commentsWithProfiles = commentsData?.map((c: any) => ({
        id: c.id,
        comment: c.comment,
        user_id: c.user_id,
        tagged_users: c.tagged_users || [],
        created_at: c.created_at,
        profiles: profiles?.find(p => p.id === c.user_id)
      })) || [];

      setComments(commentsWithProfiles);
    } catch (error: any) {
      console.error("Error loading comments:", error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .order("first_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(position);

    // Check if user typed @
    const textBeforeCursor = value.substring(0, position);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      if (!textAfterAt.includes(" ")) {
        setShowUserPicker(true);
      }
    } else {
      setShowUserPicker(false);
    }
  };

  const insertUserTag = (user: User) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");
    const textAfterCursor = newComment.substring(cursorPosition);
    
    const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email;
    const newText = 
      newComment.substring(0, lastAtSymbol) + 
      `@${userName} ` + 
      textAfterCursor;
    
    setNewComment(newText);
    setShowUserPicker(false);
  };

  const extractTaggedUserIds = (content: string): string[] => {
    const taggedUserIds: string[] = [];
    
    // Find all @mentions in the content
    const mentions = content.match(/@[\w\s]+/g) || [];
    
    mentions.forEach((mention) => {
      const userName = mention.substring(1).trim();
      const user = users.find((u) => {
        const fullName = `${u.first_name || ""} ${u.last_name || ""}`.trim();
        return fullName === userName || u.email === userName;
      });
      
      if (user && !taggedUserIds.includes(user.id)) {
        taggedUserIds.push(user.id);
      }
    });
    
    return taggedUserIds;
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const taggedUserIds = extractTaggedUserIds(newComment);

      const { error } = await supabase
        .from("shipping_order_comments")
        .insert({
          shipping_order_id: shippingOrderId,
          user_id: user.id,
          comment: newComment,
          tagged_users: taggedUserIds,
        });

      if (error) throw error;

      toast({
        title: "Commento aggiunto",
        description: "Il commento è stato pubblicato con successo",
      });

      setNewComment("");
      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile pubblicare il commento: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const { error } = await supabase
        .from("shipping_order_comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      toast({
        title: "Commento eliminato",
        description: "Il commento è stato eliminato",
      });

      loadComments();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il commento",
        variant: "destructive",
      });
    }
  };

  const getUserInitials = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return "??";
  };

  const getUserName = (firstName?: string, lastName?: string, email?: string) => {
    if (firstName || lastName) {
      return `${firstName || ""} ${lastName || ""}`.trim();
    }
    return email || "Utente sconosciuto";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <AtSign className="w-5 h-5" />
          Commenti e Attività
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comments list */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nessun commento. Aggiungi il primo commento!
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 p-3 rounded-lg bg-muted/30">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="text-xs">
                    {getUserInitials(
                      comment.profiles?.first_name,
                      comment.profiles?.last_name,
                      comment.profiles?.email
                    )}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">
                        {getUserName(
                          comment.profiles?.first_name,
                          comment.profiles?.last_name,
                          comment.profiles?.email
                        )}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                          locale: it,
                        })}
                      </span>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-destructive"
                        >
                          Elimina commento
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {comment.comment}
                  </p>
                  {comment.tagged_users && comment.tagged_users.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {comment.tagged_users.map((userId) => {
                        const user = users.find((u) => u.id === userId);
                        if (!user) return null;
                        return (
                          <Badge key={userId} variant="secondary" className="text-xs">
                            @{getUserName(user.first_name, user.last_name, user.email)}
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

        {/* New comment input */}
        <div className="space-y-2 border-t pt-4">
          <div className="relative">
            <Textarea
              placeholder="Aggiungi un commento... (usa @ per menzionare qualcuno)"
              value={newComment}
              onChange={handleCommentChange}
              rows={3}
              className="resize-none"
            />
            {showUserPicker && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {users
                  .filter((user) => {
                    const textBeforeCursor = newComment.substring(0, cursorPosition);
                    const lastAtSymbol = textBeforeCursor.lastIndexOf("@");
                    const searchTerm = textBeforeCursor
                      .substring(lastAtSymbol + 1)
                      .toLowerCase();
                    const userName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
                    return (
                      userName.toLowerCase().includes(searchTerm) ||
                      user.email.toLowerCase().includes(searchTerm)
                    );
                  })
                  .map((user) => (
                    <button
                      key={user.id}
                      onClick={() => insertUserTag(user)}
                      className="w-full px-3 py-2 text-left hover:bg-muted transition-colors"
                    >
                      <div className="font-medium text-sm">
                        {getUserName(user.first_name, user.last_name, user.email)}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">
              Usa @ per menzionare un utente
            </span>
            <Button onClick={handleSubmit} size="sm" disabled={!newComment.trim()}>
              <Send className="w-4 h-4 mr-2" />
              Pubblica
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
