import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Mail, MessageCircle, Loader2, Plus, Trash2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface NotificationSetting {
  id: string;
  account_id: string;
  user_id: string;
  notify_on_message: boolean;
  email_when_offline: boolean;
  whatsapp_when_offline: boolean;
}

interface WhatsAppNotificationSettingsProps {
  accountId: string;
}

export function WhatsAppNotificationSettings({ accountId }: WhatsAppNotificationSettingsProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [accountId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("email");

      // Load existing settings for this account
      const { data: settingsData } = await supabase
        .from("whatsapp_notification_settings")
        .select("*")
        .eq("account_id", accountId);

      if (profilesData) setProfiles(profilesData);
      if (settingsData) setSettings(settingsData);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Impossibile caricare i dati");
    }
    setLoading(false);
  };

  const getAvailableUsers = () => {
    const settingsUserIds = settings.map((s) => s.user_id);
    return profiles.filter((p) => !settingsUserIds.includes(p.id));
  };

  const addUserToNotifications = async () => {
    if (!selectedUserToAdd) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_notification_settings")
        .insert({
          account_id: accountId,
          user_id: selectedUserToAdd,
          notify_on_message: true,
          email_when_offline: true,
        });

      if (error) throw error;

      toast.success("Utente aggiunto alle notifiche");
      setSelectedUserToAdd("");
      loadData();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Impossibile aggiungere l'utente");
    }
    setSaving(false);
  };

  const removeUserFromNotifications = async (settingId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_notification_settings")
        .delete()
        .eq("id", settingId);

      if (error) throw error;

      toast.success("Utente rimosso dalle notifiche");
      loadData();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast.error(error.message || "Impossibile rimuovere l'utente");
    }
    setSaving(false);
  };

  const updateSetting = async (
    settingId: string,
    field: "notify_on_message" | "email_when_offline" | "whatsapp_when_offline",
    value: boolean
  ) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_notification_settings")
        .update({ [field]: value })
        .eq("id", settingId);

      if (error) throw error;

      setSettings((prev) =>
        prev.map((s) =>
          s.id === settingId ? { ...s, [field]: value } : s
        )
      );

      toast.success("Impostazione aggiornata");
    } catch (error: any) {
      console.error("Error updating setting:", error);
      toast.error(error.message || "Impossibile aggiornare l'impostazione");
    }
    setSaving(false);
  };

  const getProfileDisplay = (userId: string) => {
    const profile = profiles.find((p) => p.id === userId);
    if (!profile) return "Utente sconosciuto";
    const name = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ");
    return name || profile.email;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const availableUsers = getAvailableUsers();

  return (
    <div className="space-y-4">
      {/* Add user section */}
      <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
        <Users className="h-5 w-5 text-muted-foreground shrink-0" />
        <Select
          value={selectedUserToAdd}
          onValueChange={setSelectedUserToAdd}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Seleziona utente da aggiungere..." />
          </SelectTrigger>
          <SelectContent>
            {availableUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {[user.first_name, user.last_name].filter(Boolean).join(" ") || user.email}{" "}
                <span className="text-muted-foreground">({user.email})</span>
              </SelectItem>
            ))}
            {availableUsers.length === 0 && (
              <SelectItem value="none" disabled>
                Tutti gli utenti sono già configurati
              </SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={addUserToNotifications}
          disabled={!selectedUserToAdd || saving}
          size="sm"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-1" />
          )}
          Aggiungi
        </Button>
      </div>

      {/* Users list */}
      {settings.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <Bell className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nessun utente configurato per le notifiche.</p>
          <p className="text-xs mt-1">
            Aggiungi utenti per ricevere notifiche sui messaggi WhatsApp.
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[250px]">
          <div className="space-y-2">
            {settings.map((setting) => (
              <div
                key={setting.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {getProfileDisplay(setting.user_id)}
                  </div>
                  <div className="text-sm text-muted-foreground truncate">
                    {profiles.find((p) => p.id === setting.user_id)?.email}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`notify-${setting.id}`}
                      checked={setting.notify_on_message}
                      onCheckedChange={(checked) =>
                        updateSetting(setting.id, "notify_on_message", !!checked)
                      }
                    />
                    <Label
                      htmlFor={`notify-${setting.id}`}
                      className="text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Bell className="h-3 w-3" />
                      In-app
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`email-${setting.id}`}
                      checked={setting.email_when_offline}
                      onCheckedChange={(checked) =>
                        updateSetting(setting.id, "email_when_offline", !!checked)
                      }
                    />
                    <Label
                      htmlFor={`email-${setting.id}`}
                      className="text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Mail className="h-3 w-3" />
                      Email
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`whatsapp-${setting.id}`}
                      checked={setting.whatsapp_when_offline}
                      onCheckedChange={(checked) =>
                        updateSetting(setting.id, "whatsapp_when_offline", !!checked)
                      }
                    />
                    <Label
                      htmlFor={`whatsapp-${setting.id}`}
                      className="text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp
                    </Label>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeUserFromNotifications(setting.id)}
                    disabled={saving}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Info box */}
      <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
        <p className="font-medium flex items-center gap-1">
          <Bell className="h-4 w-4" />
          Come funziona
        </p>
        <ul className="text-xs text-muted-foreground space-y-0.5 ml-5">
          <li>• <strong>In-app:</strong> notifica istantanea se l'utente ha l'ERP aperto</li>
          <li>• <strong>Email:</strong> email con messaggio e traduzione se l'utente è offline</li>
          <li>• <strong>WhatsApp:</strong> messaggio WhatsApp con il template "nuovo_messaggio_chat" se offline</li>
        </ul>
      </div>
    </div>
  );
}
