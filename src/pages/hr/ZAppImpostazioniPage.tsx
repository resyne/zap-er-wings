import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Plus, Trash2, Loader2, Settings, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

type NotificationEventType = "nuova_commessa" | "cambio_stato_commessa" | "nuovo_ordine" | "scadenza_imminente";
type NotificationChannel = "whatsapp" | "email";

interface NotificationRule {
  id: string;
  event_type: NotificationEventType;
  channel: NotificationChannel;
  recipient_name: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  is_active: boolean;
  created_at: string;
}

const EVENT_LABELS: Record<NotificationEventType, { label: string; color: string }> = {
  nuova_commessa: { label: "Nuova Commessa", color: "bg-blue-100 text-blue-800" },
  cambio_stato_commessa: { label: "Cambio Stato Commessa", color: "bg-amber-100 text-amber-800" },
  nuovo_ordine: { label: "Nuovo Ordine", color: "bg-green-100 text-green-800" },
  scadenza_imminente: { label: "Scadenza Imminente", color: "bg-red-100 text-red-800" },
};

const CHANNEL_ICONS: Record<NotificationChannel, typeof Mail> = {
  whatsapp: MessageSquare,
  email: Mail,
};

export default function ZAppImpostazioniPage() {
  const navigate = useNavigate();
  const { userRole } = useUserRole();
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formEventType, setFormEventType] = useState<NotificationEventType>("nuova_commessa");
  const [formChannel, setFormChannel] = useState<NotificationChannel>("whatsapp");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");

  const isAdmin = userRole === "admin";

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("zapp_notification_rules")
      .select("*")
      .order("event_type")
      .order("channel");

    if (error) {
      console.error("Error loading rules:", error);
      toast.error("Errore nel caricamento delle regole");
    } else {
      setRules(data || []);
    }
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!formName.trim()) {
      toast.error("Inserisci un nome destinatario");
      return;
    }
    if (formChannel === "whatsapp" && !formPhone.trim()) {
      toast.error("Inserisci un numero di telefono per WhatsApp");
      return;
    }
    if (formChannel === "email" && !formEmail.trim()) {
      toast.error("Inserisci un'email");
      return;
    }

    setSaving(true);
    const { error } = await supabase.from("zapp_notification_rules").insert({
      event_type: formEventType,
      channel: formChannel,
      recipient_name: formName.trim(),
      recipient_phone: formPhone.trim() || null,
      recipient_email: formEmail.trim() || null,
    });

    if (error) {
      console.error("Error adding rule:", error);
      toast.error("Errore nell'aggiunta della regola");
    } else {
      toast.success("Regola aggiunta");
      setDialogOpen(false);
      resetForm();
      loadRules();
    }
    setSaving(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from("zapp_notification_rules")
      .update({ is_active: active })
      .eq("id", id);

    if (error) {
      toast.error("Errore nell'aggiornamento");
    } else {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, is_active: active } : r)));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("zapp_notification_rules")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Errore nella cancellazione");
    } else {
      toast.success("Regola eliminata");
      setRules((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const resetForm = () => {
    setFormEventType("nuova_commessa");
    setFormChannel("whatsapp");
    setFormName("");
    setFormPhone("");
    setFormEmail("");
  };

  // Group rules by event_type
  const grouped = rules.reduce<Record<NotificationEventType, NotificationRule[]>>((acc, rule) => {
    if (!acc[rule.event_type]) acc[rule.event_type] = [];
    acc[rule.event_type].push(rule);
    return acc;
  }, {} as Record<NotificationEventType, NotificationRule[]>);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-gray-600 text-white px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Impostazioni</h1>
          </div>
        </div>
        <div className="p-6 text-center text-muted-foreground">
          Solo gli amministratori possono accedere a questa pagina.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-gray-600 text-white px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold">Impostazioni Notifiche</h1>
              <p className="text-gray-300 text-xs">Gestisci chi riceve notifiche e per quali eventi</p>
            </div>
          </div>
          <Button
            size="sm"
            className="bg-white text-gray-700 hover:bg-gray-100"
            onClick={() => { resetForm(); setDialogOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Aggiungi
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-muted-foreground font-medium">Nessuna regola configurata</p>
            <p className="text-sm text-muted-foreground mt-1">Aggiungi regole per ricevere notifiche automatiche</p>
          </div>
        ) : (
          Object.entries(EVENT_LABELS).map(([eventType, { label, color }]) => {
            const eventRules = grouped[eventType as NotificationEventType] || [];
            if (eventRules.length === 0) return null;

            return (
              <Card key={eventType}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge variant="secondary" className={`${color} text-xs`}>{label}</Badge>
                    <span className="text-muted-foreground font-normal">({eventRules.length})</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {eventRules.map((rule) => {
                    const ChannelIcon = CHANNEL_ICONS[rule.channel];
                    return (
                      <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <ChannelIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{rule.recipient_name}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {rule.channel === "whatsapp" ? rule.recipient_phone : rule.recipient_email}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) => handleToggle(rule.id, checked)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })
        )}

        {/* Info */}
        <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
          <p className="font-medium flex items-center gap-1">
            <Settings className="h-4 w-4" />
            Come funziona
          </p>
          <ul className="text-xs text-muted-foreground space-y-0.5 ml-5 list-disc">
            <li><strong>Nuova Commessa:</strong> notifica alla creazione di una commessa</li>
            <li><strong>Cambio Stato:</strong> notifica quando una commessa cambia stato</li>
            <li><strong>Nuovo Ordine:</strong> notifica alla creazione di un ordine di vendita</li>
            <li><strong>Scadenza Imminente:</strong> notifica quando una commessa è vicina alla deadline</li>
          </ul>
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuova Regola Notifica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Evento</Label>
              <Select value={formEventType} onValueChange={(v) => setFormEventType(v as NotificationEventType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(EVENT_LABELS).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Canale</Label>
              <Select value={formChannel} onValueChange={(v) => setFormChannel(v as NotificationChannel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nome Destinatario</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="es. Pasquale" />
            </div>

            {formChannel === "whatsapp" && (
              <div>
                <Label>Numero WhatsApp</Label>
                <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="es. +39 333 1234567" />
              </div>
            )}

            {formChannel === "email" && (
              <div>
                <Label>Email</Label>
                <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="es. nome@azienda.it" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
              Aggiungi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
