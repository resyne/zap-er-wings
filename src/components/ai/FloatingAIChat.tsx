import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Bot, User, X, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  isLoading?: boolean;
}

export default function FloatingAIChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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

    // Aggiungi messaggio di "sto lavorando..."
    const workingMessage: Message = {
      role: "system",
      content: "🔄 Sto analizzando la richiesta...",
      isLoading: true
    };
    setMessages(prev => [...prev, workingMessage]);

    try {
      // Get the current session to include auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('crm-ai-assistant', {
        body: { 
          messages: [...messages, userMessage].filter(m => m.role !== "system").map(m => ({
            role: m.role,
            content: m.content
          }))
        },
        headers: session?.access_token ? {
          Authorization: `Bearer ${session.access_token}`
        } : {}
      });

      if (error) throw error;

      // Rimuovi il messaggio di caricamento
      setMessages(prev => prev.filter(m => !m.isLoading));

      // Aggiungi conferma di successo
      const successMessage: Message = {
        role: "system",
        content: "✅ Operazione completata con successo!"
      };
      
      const assistantMessage: Message = {
        role: "assistant",
        content: data.message
      };

      setMessages(prev => [...prev, successMessage, assistantMessage]);

      toast({
        title: "Completato",
        description: "L'assistente AI ha completato l'operazione",
      });

    } catch (error) {
      console.error('Error calling AI assistant:', error);
      
      // Rimuovi il messaggio di caricamento
      setMessages(prev => prev.filter(m => !m.isLoading));
      
      // Aggiungi messaggio di errore
      const errorMessage: Message = {
        role: "system",
        content: "❌ Si è verificato un errore. Riprova."
      };
      setMessages(prev => [...prev, errorMessage]);

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
    <>
      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(true)}
        size="lg"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:scale-110 transition-transform z-50 bg-gradient-to-r from-primary to-primary/80"
        aria-label="Apri assistente AI"
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      {/* Chat Dialog with Blurred Background */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl h-[80vh] p-0 gap-0 bg-background/95 backdrop-blur-xl border-2">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">JESSY - Back office AI</h2>
                <p className="text-xs text-muted-foreground">
                  Gestisci Lead, Clienti, Preventivi e Offerte
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="rounded-full"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center text-muted-foreground py-12">
                  <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Ciao! 👋</p>
                  <p className="text-sm mb-4">Come posso aiutarti oggi?</p>
                  <div className="text-xs space-y-1 max-w-xs mx-auto">
                    <p className="font-medium mb-2">Esempi:</p>
                    <p className="text-left bg-muted/50 p-2 rounded">"Mostrami tutti i lead attivi"</p>
                    <p className="text-left bg-muted/50 p-2 rounded">"Crea un nuovo cliente"</p>
                    <p className="text-left bg-muted/50 p-2 rounded">"Quali offerte sono in sospeso?"</p>
                  </div>
                </div>
              )}
              
              {messages.map((message, index) => {
                if (message.role === "system") {
                  return (
                    <div key={index} className="flex justify-center">
                      <div className="bg-muted/50 rounded-full px-4 py-2 text-sm flex items-center gap-2">
                        {message.isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                        <span>{message.content}</span>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className={`flex gap-3 animate-fade-in ${
                      message.role === "assistant" ? "justify-start" : "justify-end"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-5 h-5 text-primary-foreground" />
                      </div>
                    )}
                    
                    <div
                      className={`rounded-2xl px-4 py-3 max-w-[75%] ${
                        message.role === "assistant"
                          ? "bg-muted"
                          : "bg-primary text-primary-foreground"
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                    </div>

                    {message.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                        <User className="w-5 h-5 text-secondary-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t bg-background/50 backdrop-blur-sm">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi qui la tua richiesta..."
                className="min-h-[50px] max-h-[120px] resize-none"
                disabled={isLoading}
              />
              <Button
                onClick={sendMessage}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-[50px] w-[50px] rounded-full"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Premi Invio per inviare • Shift+Invio per andare a capo
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
