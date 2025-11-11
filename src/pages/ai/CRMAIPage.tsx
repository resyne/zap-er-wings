import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Bot, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function CRMAIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Carica la cronologia della conversazione attiva
  useEffect(() => {
    const loadConversationHistory = async () => {
      try {
        // Ottieni l'ultima conversazione dell'utente
        const { data: conversations, error: convError } = await supabase
          .from('ai_conversations')
          .select('id')
          .order('updated_at', { ascending: false })
          .limit(1);

        if (convError) throw convError;

        if (conversations && conversations.length > 0) {
          const lastConvId = conversations[0].id;
          setConversationId(lastConvId);

          // Carica i messaggi di questa conversazione
          const { data: loadedMessages, error: msgError } = await supabase
            .from('ai_messages')
            .select('role, content')
            .eq('conversation_id', lastConvId)
            .order('created_at', { ascending: true });

          if (msgError) throw msgError;

          if (loadedMessages && loadedMessages.length > 0) {
            setMessages(loadedMessages as Message[]);
          }
        }
      } catch (error) {
        console.error('Error loading conversation history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversationHistory();
  }, []);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('crm-ai-assistant', {
        body: { 
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          conversationId: conversationId
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      });

      if (error) throw error;

      // Aggiorna il conversationId se è stato creato uno nuovo
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: data.message
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('Error calling AI assistant:', error);
      toast({
        title: "Errore",
        description: "Si è verificato un errore nella comunicazione con l'assistente AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="container mx-auto py-6 h-[calc(100vh-8rem)]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Assistente AI CRM</h1>
        <p className="text-muted-foreground">
          Chiedi all'AI di leggere, creare o modificare dati nel CRM: Lead, Clienti, Preventivi e Offerte
        </p>
      </div>

      <Card className="h-[calc(100%-8rem)] flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Benvenuto nell'Assistente AI CRM</p>
                <p className="text-sm">Prova a chiedere:</p>
                <ul className="text-sm mt-2 space-y-1">
                  <li>"Mostrami tutti i lead attivi"</li>
                  <li>"Crea un nuovo lead per l'azienda XYZ"</li>
                  <li>"Quali clienti abbiamo nella pipeline Zapper?"</li>
                  <li>"Mostrami le offerte inviate questa settimana"</li>
                </ul>
              </div>
            ) : null}
            
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex gap-3 ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-5 h-5 text-primary-foreground" />
                  </div>
                )}
                
                <div
                  className={`rounded-lg px-4 py-3 max-w-[80%] ${
                    message.role === "assistant"
                      ? "bg-muted"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>

                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="rounded-lg px-4 py-3 bg-muted">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chiedi qualcosa sui tuoi dati CRM..."
              className="min-h-[60px] max-h-[120px]"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-[60px] w-[60px]"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Premi Invio per inviare, Shift+Invio per andare a capo
          </p>
        </div>
      </Card>
    </div>
  );
}
