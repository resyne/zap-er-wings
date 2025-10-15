import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Send, MessageSquare, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface Comment {
  id: string;
  created_at: string;
  updated_at: string;
  user_id: string;
  comment: string;
  mentions: string[];
  profiles?: {
    first_name?: string;
    last_name?: string;
    email?: string;
  };
}

interface User {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

interface OrderCommentsProps {
  orderId: string;
  orderType: 'work' | 'service' | 'shipping';
}

export function OrderComments({ orderId, orderType }: OrderCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [showUserList, setShowUserList] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchComments();
    fetchUsers();
    getCurrentUser();
  }, [orderId]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setCurrentUserId(user?.id || null);
  };

  const fetchComments = async () => {
    const columnName = orderType === 'work' ? 'work_order_id' : 
                       orderType === 'service' ? 'service_work_order_id' : 
                       'shipping_order_id';

    const { data, error } = await supabase
      .from('order_comments')
      .select(`
        id,
        created_at,
        updated_at,
        user_id,
        comment,
        mentions
      `)
      .eq(columnName, orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching comments:', error);
      return;
    }

    // Fetch profiles separately
    if (data) {
      const commentsWithProfiles = await Promise.all(
        data.map(async (comment) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name, last_name, email')
            .eq('id', comment.user_id)
            .single();
          
          return {
            ...comment,
            profiles: profile || undefined
          };
        })
      );
      
      setComments(commentsWithProfiles);
    }
  };

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .order('first_name');

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    setUsers(data || []);
  };

  const handleCommentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    
    setNewComment(value);
    setCursorPosition(cursor);

    // Mostra lista utenti se viene digitato @
    const textBeforeCursor = value.substring(0, cursor);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtSymbol !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtSymbol + 1);
      // Mostra lista solo se @ è seguito da lettere o è appena stato digitato
      setShowUserList(/^[a-zA-Z]*$/.test(textAfterAt));
    } else {
      setShowUserList(false);
    }
  };

  const handleUserSelect = (user: User) => {
    const textBeforeCursor = newComment.substring(0, cursorPosition);
    const lastAtSymbol = textBeforeCursor.lastIndexOf('@');
    const textAfterCursor = newComment.substring(cursorPosition);
    
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '';
    const newText = newComment.substring(0, lastAtSymbol) + `@${userName} ` + textAfterCursor;
    
    setNewComment(newText);
    setShowUserList(false);
  };

  const extractMentions = (text: string): string[] => {
    const mentionPattern = /@([^\s]+(?:\s+[^\s]+)?)/g;
    const mentions: string[] = [];
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionedName = match[1];
      const user = users.find(u => {
        const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim();
        return fullName === mentionedName || u.email === mentionedName;
      });
      
      if (user) {
        mentions.push(user.id);
      }
    }

    return mentions;
  };

  const handleSubmit = async () => {
    if (!newComment.trim()) return;

    const mentions = extractMentions(newComment);
    const columnName = orderType === 'work' ? 'work_order_id' : 
                       orderType === 'service' ? 'service_work_order_id' : 
                       'shipping_order_id';

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Errore",
        description: "Devi essere autenticato per commentare",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from('order_comments')
      .insert([{
        [columnName]: orderId,
        comment: newComment,
        mentions: mentions,
        user_id: user.id
      }]);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile aggiungere il commento",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Successo",
      description: "Commento aggiunto con successo",
    });

    setNewComment("");
    fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    const { error } = await supabase
      .from('order_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare il commento",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Successo",
      description: "Commento eliminato",
    });

    fetchComments();
  };

  const getUserName = (profile: any) => {
    if (!profile) return 'Utente sconosciuto';
    const fullName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    return fullName || profile.email || 'Utente';
  };

  const getInitials = (profile: any) => {
    if (!profile) return 'U';
    if (profile.first_name && profile.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (profile.email) {
      return profile.email[0].toUpperCase();
    }
    return 'U';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Commenti
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Form nuovo commento */}
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              value={newComment}
              onChange={handleCommentChange}
              placeholder="Scrivi un commento... (usa @ per menzionare qualcuno)"
              rows={3}
              className="resize-none"
            />
            {showUserList && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className="w-full px-3 py-2 text-left hover:bg-accent flex items-center gap-2"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {getInitials(user)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {getUserName(user)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={!newComment.trim()}>
            <Send className="h-4 w-4 mr-2" />
            Invia commento
          </Button>
        </div>

        {/* Lista commenti */}
        <div className="space-y-3">
          {comments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun commento ancora
            </p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {getInitials(comment.profiles)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {getUserName(comment.profiles)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { 
                          addSuffix: true,
                          locale: it 
                        })}
                      </p>
                    </div>
                  </div>
                  {currentUserId === comment.user_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(comment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap">{comment.comment}</p>
                {comment.mentions && comment.mentions.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {comment.mentions.map((userId) => {
                      const user = users.find(u => u.id === userId);
                      if (!user) return null;
                      return (
                        <Badge key={userId} variant="secondary" className="text-xs">
                          @{getUserName(user)}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}