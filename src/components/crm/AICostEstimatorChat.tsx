import { useState, useRef, useEffect } from "react";
import { Bot, Send, Loader2, Sparkles, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EstimateItem {
  category: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total: number;
}

interface Estimate {
  type: "estimate";
  title: string;
  items: EstimateItem[];
  subtotal: number;
  margin_percent: number;
  margin_amount: number;
  total_net: number;
  vat_percent: number;
  vat_amount: number;
  total_gross: number;
  notes: string[];
  assumptions: string[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-cost-estimator`;

function extractEstimate(text: string): Estimate | null {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[1]);
    if (parsed.type === "estimate") return parsed;
  } catch { /* ignore */ }
  return null;
}

function removeJsonBlock(text: string): string {
  return text.replace(/```json\s*[\s\S]*?```/g, "").trim();
}

export default function AICostEstimatorChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!resp.ok || !resp.body) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || `Errore ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e: any) {
      console.error("AI Cost Estimator error:", e);
      toast({ title: "Errore AI", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const resetChat = () => {
    setMessages([]);
    setInput("");
  };

  const categoryColors: Record<string, string> = {
    "Materiali": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "Manodopera": "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    "Accessori": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "Noleggi": "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  };

  const renderEstimate = (estimate: Estimate) => (
    <Card className="mt-3 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          {estimate.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cat.</TableHead>
              <TableHead>Descrizione</TableHead>
              <TableHead className="text-right">Qtà</TableHead>
              <TableHead className="text-right">Prezzo Unit.</TableHead>
              <TableHead className="text-right">Totale</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {estimate.items.map((item, i) => (
              <TableRow key={i}>
                <TableCell>
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${categoryColors[item.category] || "bg-muted text-muted-foreground"}`}>
                    {item.category}
                  </span>
                </TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-right text-sm">{item.quantity} {item.unit}</TableCell>
                <TableCell className="text-right text-sm">€{item.unit_price.toFixed(2)}</TableCell>
                <TableCell className="text-right text-sm font-medium">€{item.total.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="border-t pt-3 space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotale:</span><span>€{estimate.subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground">
            <span>Margine ({estimate.margin_percent}%):</span><span>€{estimate.margin_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-semibold"><span>Totale Netto:</span><span>€{estimate.total_net.toFixed(2)}</span></div>
          <div className="flex justify-between text-muted-foreground">
            <span>IVA ({estimate.vat_percent}%):</span><span>€{estimate.vat_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Totale Lordo:</span><span className="text-primary">€{estimate.total_gross.toFixed(2)}</span>
          </div>
        </div>

        {estimate.notes?.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1 border-t pt-2">
            <p className="font-medium">Note:</p>
            {estimate.notes.map((n, i) => <p key={i}>• {n}</p>)}
          </div>
        )}
        {estimate.assumptions?.length > 0 && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium">Ipotesi:</p>
            {estimate.assumptions.map((a, i) => <p key={i}>• {a}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderMessage = (msg: Message, idx: number) => {
    const estimate = msg.role === "assistant" ? extractEstimate(msg.content) : null;
    const textContent = msg.role === "assistant" ? removeJsonBlock(msg.content) : msg.content;

    return (
      <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
        {msg.role === "assistant" && (
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className={`max-w-[85%] space-y-1 ${msg.role === "user" ? "text-right" : ""}`}>
          <div className={`inline-block rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
            msg.role === "user"
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          }`}>
            {textContent}
          </div>
          {estimate && renderEstimate(estimate)}
        </div>
      </div>
    );
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Previsione AI Costi
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={resetChat}>
              <RotateCcw className="h-4 w-4 mr-1" />
              Nuova
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Descrivi il lavoro da quotare e l'AI genererà un preventivo basato su listini e tariffe aziendali
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0 gap-2">
        <ScrollArea className="flex-1 pr-3" ref={scrollRef as any}>
          <div className="space-y-3 pb-2">
            {messages.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <Bot className="h-10 w-10 mx-auto text-muted-foreground/50" />
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Come posso aiutarti a quotare?</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {[
                      "Fornitura e posa canna fumaria 6 metri, diametro 250mm",
                      "Installazione canna fumaria esterna con 2 curve",
                      "Sostituzione canna fumaria esistente",
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => { setInput(suggestion); textareaRef.current?.focus(); }}
                        className="text-xs border rounded-full px-3 py-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {messages.map((msg, i) => renderMessage(msg, i))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex gap-2 items-end border-t pt-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Descrivi il lavoro da quotare..."
            className="min-h-[40px] max-h-[100px] resize-none text-sm"
            rows={1}
          />
          <Button size="sm" onClick={sendMessage} disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
