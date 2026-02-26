import { useState, useEffect } from "react";
import { Bell, Loader2, Settings, Mail, MessageSquare, Plus, Trash2, User, ChevronDown, ChevronUp } from "lucide-react";
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

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone?: string | null;
}

type NotificationEventType = "nuova_commessa" | "cambio_stato_commessa" | "nuovo_ordine" | "scadenza_imminente" | "nuovo_ordine_acquisto" | "cambio_stato_ordine_acquisto";
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

const EVENT_SECTIONS: { type: NotificationEventType; label: string; description: string; icon: string }[] = [
  { type: "nuova_commessa", label: "Nuova Commessa", description: "Notifica alla creazione di una commessa", icon: "📋" },
  { type: "cambio_stato_commessa", label: "Cambio Stato Commessa", description: "Notifica quando una commessa cambia stato", icon: "🔄" },
  { type: "nuovo_ordine", label: "Nuovo Ordine di Vendita", description: "Notifica alla creazione di un ordine di vendita", icon: "🛒" },
  { type: "nuovo_ordine_acquisto", label: "Nuovo Ordine di Acquisto", description: "Notifica alla creazione di un ordine di acquisto", icon: "📦" },
  { type: "cambio_stato_ordine_acquisto", label: "Cambio Stato Ordine Acquisto", description: "Notifica quando un ordine di acquisto cambia stato", icon: "🔃" },
  { type: "scadenza_imminente", label: "Scadenza Imminente", description: "Notifica quando una commessa è vicina alla deadline", icon: "⏰" },
];

export function NotificationSettings() {
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogEventType, setDialogEventType] = useState<NotificationEventType>("nuova_commessa");
  const [formChannel, setFormChannel] = useState<NotificationChannel>("whatsapp");
  const [formSelectedUser, setFormSelectedUser] = useState("");
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [rulesRes, profilesRes] = await Promise.all([
      supabase.from("zapp_notification_rules").select("*").order("event_type").order("channel"),
      supabase.from("profiles").select("id, email, first_name, last_name, phone").order("email"),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    setLoading(false);
  };

  const toggleSection = (type: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  };

  const openAddDialog = (eventType: NotificationEventType) => {
    setDialogEventType(eventType);
    setFormChannel("whatsapp");
    setFormSelectedUser("");
    setFormName("");
    setFormPhone("");
    setFormEmail("");
    setDialogOpen(true);
  };

  const handleUserSelect = (userId: string) => {
    setFormSelectedUser(userId);
    const profile = profiles.find((p) => p.id === userId);
    if (profile) {
      setFormName([profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email);
      setFormEmail(profile.email);
      setFormPhone((profile as any).phone || "");
    }
  };

  const handleAdd = async () => {
    if (!formName.trim()) { toast.error("Inserisci un nome"); return; }
    if (!formPhone.trim() && !formEmail.trim()) { toast.error("Inserisci almeno un numero o un'email"); return; }
    setSaving(true);
    const { error } = await supabase.from("zapp_notification_rules").insert({
      event_type: dialogEventType,
      channel: formChannel,
      recipient_name: formName.trim(),
      recipient_phone: formPhone.trim() || null,
      recipient_email: formEmail.trim() || null,
    });
    if (error) toast.error("Errore nell'aggiunta");
    else { toast.success("Destinatario aggiunto"); setDialogOpen(false); loadData(); }
    setSaving(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("zapp_notification_rules").update({ is_active: active }).eq("id", id);
    if (error) toast.error("Errore");
    else setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: active } : r));
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("zapp_notification_rules").delete().eq("id", id);
    if (error) toast.error("Errore");
    else { toast.success("Rimosso"); setRules(prev => prev.filter(r => r.id !== id)); }
  };

  const getRulesForEvent = (eventType: NotificationEventType) => rules.filter(r => r.event_type === eventType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {EVENT_SECTIONS.map(section => {
        const eventRules = getRulesForEvent(section.type);
        const isExpanded = expandedSections.has(section.type);

        return (
          <Card key={section.type}>
            <CardHeader className="pb-2 cursor-pointer" onClick={() => toggleSection(section.type)}>
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{section.icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{section.label}</span>
                      {eventRules.length > 0 && (
                        <Badge variant="secondary" className="text-xs">{eventRules.length}</Badge>
                      )}
                    </div>
                    <p className="text-xs font-normal text-muted-foreground mt-0.5">{section.description}</p>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-2">
                {eventRules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-3">Nessun destinatario configurato</p>
                ) : (
                  eventRules.map(rule => (
                    <div key={rule.id} className="flex items-center gap-3 p-3 rounded-lg border bg-background">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {rule.channel === "whatsapp" ? (
                          <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{rule.recipient_name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {[rule.recipient_phone, rule.recipient_email].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Switch checked={rule.is_active} onCheckedChange={(c) => handleToggle(rule.id, c)} />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(rule.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button variant="outline" size="sm" className="w-full" onClick={() => openAddDialog(section.type)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi destinatario
                </Button>
              </CardContent>
            )}
          </Card>
        );
      })}

      <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
        <p className="font-medium flex items-center gap-1">
          <Settings className="h-4 w-4" />
          Come funziona
        </p>
        <ul className="text-xs text-muted-foreground space-y-0.5 ml-5 list-disc">
          <li>Espandi ogni evento per vedere e gestire i destinatari</li>
          <li>Ogni destinatario può ricevere notifiche via <strong>WhatsApp</strong> o <strong>Email</strong></li>
          <li>Usa lo switch per attivare/disattivare temporaneamente</li>
        </ul>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aggiungi Destinatario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-2 bg-muted rounded text-sm">
              <span className="font-medium">{EVENT_SECTIONS.find(s => s.type === dialogEventType)?.icon} {EVENT_SECTIONS.find(s => s.type === dialogEventType)?.label}</span>
            </div>
            <div>
              <Label>Canale</Label>
              <Select value={formChannel} onValueChange={(v) => setFormChannel(v as NotificationChannel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Seleziona Utente</Label>
              <Select value={formSelectedUser} onValueChange={handleUserSelect}>
                <SelectTrigger><SelectValue placeholder="Seleziona un utente..." /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {[p.first_name, p.last_name].filter(Boolean).join(" ") || p.email} ({p.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome Destinatario</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="es. Pasquale" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="es. nome@azienda.it" />
            </div>
            <div>
              <Label>Numero WhatsApp</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="es. +39 333 1234567" />
            </div>
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
