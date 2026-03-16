import { useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBeccaPhoneNumbers, isBeccaPhone } from "@/hooks/useBeccaPhoneNumbers";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageCircle, ArrowLeft, Check, CheckCheck, Clock, AlertCircle, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface BeccaConversation {
  id: string;
  account_id: string;
  customer_phone: string;
  customer_name: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  status: string;
}

interface BeccaMessage {
  id: string;
  conversation_id: string;
  direction: string;
  message_type: string;
  content: string | null;
  status: string;
  created_at: string;
}

export function BeccaConversationsTab() {
  const queryClient = useQueryClient();
  const { data: beccaPhones = [] } = useBeccaPhoneNumbers();
  const [selectedConv, setSelectedConv] = useState<BeccaConversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations across all accounts
  const { data: allConversations = [] } = useQuery({
    queryKey: ["becca-conversations", beccaPhones],
    queryFn: async () => {
      if (!beccaPhones.length) return [];
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select("*")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      // Filter to only Becca authorized phones
      return (data || []).filter((c: any) =>
        isBeccaPhone(c.customer_phone, beccaPhones)
      ) as BeccaConversation[];
    },
    enabled: beccaPhones.length > 0,
    refetchInterval: 5000,
  });

  // Fetch messages for selected conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["becca-conv-messages", selectedConv?.id],
    queryFn: async () => {
      if (!selectedConv) return [];
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", selectedConv.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as BeccaMessage[];
    },
    enabled: !!selectedConv,
    refetchInterval: 3000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fetch authorized users for display name mapping
  const { data: authorizedUsers = [] } = useQuery({
    queryKey: ["becca-authorized-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("becca_authorized_users" as any)
        .select("phone_number, display_name")
        .eq("is_active", true);
      return (data || []) as any[];
    },
  });

  const getDisplayName = (phone: string) => {
    const normalized = phone.replace(/\D/g, "").slice(-9);
    const user = authorizedUsers.find(
      (u: any) => u.phone_number.replace(/\D/g, "").slice(-9) === normalized
    );
    return user?.display_name || phone;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "read": return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "delivered": return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "sent": return <Check className="h-3 w-3 text-muted-foreground" />;
      case "failed": return <AlertCircle className="h-3 w-3 text-destructive" />;
      default: return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  if (selectedConv) {
    const displayName = getDisplayName(selectedConv.customer_phone);
    return (
      <Card className="h-[600px] flex flex-col">
        {/* Chat header */}
        <div className="flex items-center gap-3 p-4 border-b">
          <Button variant="ghost" size="icon" onClick={() => setSelectedConv(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-violet-100 text-violet-700 text-sm font-medium">
              {displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{displayName}</p>
            <p className="text-xs text-muted-foreground">{selectedConv.customer_phone}</p>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-3">
            {messages.map((msg) => {
              const isOutbound = msg.direction === "outbound";
              return (
                <div key={msg.id} className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOutbound
                        ? "bg-violet-600 text-white rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content || `[${msg.message_type}]`}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isOutbound ? "justify-end" : ""}`}>
                      <span className={`text-[10px] ${isOutbound ? "text-violet-200" : "text-muted-foreground"}`}>
                        {format(new Date(msg.created_at), "HH:mm")}
                      </span>
                      {isOutbound && getStatusIcon(msg.status)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </Card>
    );
  }

  // Conversation list
  return (
    <Card>
      <CardContent className="p-0">
        {allConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Bot className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">Nessuna conversazione interna Becca</p>
          </div>
        ) : (
          <div className="divide-y">
            {allConversations.map((conv) => {
              const displayName = getDisplayName(conv.customer_phone);
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConv(conv)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-violet-100 text-violet-700 text-sm font-medium">
                      {displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm truncate">{displayName}</p>
                      {conv.last_message_at && (
                        <span className="text-xs text-muted-foreground flex-shrink-0">
                          {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: it })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_preview || "Nessun messaggio"}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge className="bg-violet-600 text-white text-xs px-1.5 min-w-[20px] flex items-center justify-center">
                      {conv.unread_count}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
