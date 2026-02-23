import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Megaphone, User, AlertTriangle, Palmtree, Info, Zap, Check } from "lucide-react";

const commTypes = [
  { value: "announcement", label: "Comunicazione aziendale", icon: Megaphone },
  { value: "personal", label: "Personale", icon: User },
  { value: "formal_warning", label: "Richiamo formale", icon: AlertTriangle },
  { value: "vacation_response", label: "Risposta ferie", icon: Check },
  { value: "info", label: "Informativa", icon: Info },
  { value: "urgent", label: "Urgente", icon: Zap },
];

const priorities = [
  { value: "low", label: "Bassa" },
  { value: "normal", label: "Normale" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SendCommunicationDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [commType, setCommType] = useState("announcement");
  const [priority, setPriority] = useState("normal");
  const [recipientId, setRecipientId] = useState<string>("all");

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("internal_communications").insert({
        title,
        content,
        communication_type: commType,
        priority,
        sender_id: user?.id,
        recipient_id: recipientId === "all" ? null : recipientId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Comunicazione inviata", description: "La comunicazione è stata inviata con successo." });
      queryClient.invalidateQueries({ queryKey: ["admin-communications"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCommType("announcement");
    setPriority("normal");
    setRecipientId("all");
  };

  const handleSend = () => {
    if (!title.trim() || !content.trim()) {
      toast({ title: "Campi obbligatori", description: "Inserisci titolo e contenuto.", variant: "destructive" });
      return;
    }
    sendMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Nuova Comunicazione
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={commType} onValueChange={setCommType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {commTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <t.icon className="h-3.5 w-3.5" />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priorità</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Destinatario</Label>
            <Select value={recipientId} onValueChange={setRecipientId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">📢 Tutti i dipendenti</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.first_name && p.last_name
                      ? `${p.first_name} ${p.last_name}`
                      : p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Titolo</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Oggetto della comunicazione" />
          </div>

          <div className="space-y-1.5">
            <Label>Contenuto</Label>
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Scrivi il messaggio..." rows={5} />
          </div>

          <Button onClick={handleSend} disabled={sendMutation.isPending} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? "Invio..." : "Invia Comunicazione"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
