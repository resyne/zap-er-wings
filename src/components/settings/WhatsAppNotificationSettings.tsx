import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Users, Bell, Mail, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface WhatsAppAccount {
  id: string;
  verified_name: string | null;
  display_phone_number: string | null;
}

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
  user?: Profile;
}

export function WhatsAppNotificationSettings() {
  const [accounts, setAccounts] = useState<WhatsAppAccount[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedUserToAdd, setSelectedUserToAdd] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load WhatsApp accounts
      const { data: accountsData } = await supabase
        .from("whatsapp_accounts")
        .select("id, verified_name, display_phone_number")
        .eq("is_active", true)
        .order("verified_name");

      // Load profiles (potential recipients)
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("email");

      // Load existing settings
      const { data: settingsData } = await supabase
        .from("whatsapp_notification_settings")
        .select("*");

      if (accountsData) setAccounts(accountsData);
      if (profilesData) setProfiles(profilesData);
      if (settingsData) setSettings(settingsData);

      // Select first account by default
      if (accountsData && accountsData.length > 0 && !selectedAccount) {
        setSelectedAccount(accountsData[0].id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const getSettingsForAccount = (accountId: string) => {
    return settings.filter((s) => s.account_id === accountId);
  };

  const getUsersNotInSettings = (accountId: string) => {
    const accountSettings = getSettingsForAccount(accountId);
    const settingsUserIds = accountSettings.map((s) => s.user_id);
    return profiles.filter((p) => !settingsUserIds.includes(p.id));
  };

  const addUserToNotifications = async () => {
    if (!selectedAccount || !selectedUserToAdd) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("whatsapp_notification_settings")
        .insert({
          account_id: selectedAccount,
          user_id: selectedUserToAdd,
          notify_on_message: true,
          email_when_offline: true,
        });

      if (error) throw error;

      toast({
        title: "Utente aggiunto",
        description: "L'utente riceverà le notifiche per i messaggi WhatsApp",
      });

      setSelectedUserToAdd("");
      loadData();
    } catch (error: any) {
      console.error("Error adding user:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiungere l'utente",
        variant: "destructive",
      });
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

      toast({
        title: "Utente rimosso",
        description: "L'utente non riceverà più notifiche",
      });

      loadData();
    } catch (error: any) {
      console.error("Error removing user:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile rimuovere l'utente",
        variant: "destructive",
      });
    }
    setSaving(false);
  };

  const updateSetting = async (
    settingId: string,
    field: "notify_on_message" | "email_when_offline",
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

      toast({
        title: "Impostazione aggiornata",
        description: "La preferenza è stata salvata",
      });
    } catch (error: any) {
      console.error("Error updating setting:", error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile aggiornare l'impostazione",
        variant: "destructive",
      });
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

  if (accounts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nessun account WhatsApp configurato.</p>
          <p className="text-sm mt-2">
            Configura un account WhatsApp per gestire le notifiche.
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentAccountSettings = selectedAccount
    ? getSettingsForAccount(selectedAccount)
    : [];
  const availableUsers = selectedAccount
    ? getUsersNotInSettings(selectedAccount)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Label>Account WhatsApp:</Label>
        <Select
          value={selectedAccount || ""}
          onValueChange={setSelectedAccount}
        >
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="Seleziona account" />
          </SelectTrigger>
          <SelectContent>
            {accounts.map((account) => (
              <SelectItem key={account.id} value={account.id}>
                {account.verified_name || 'Account'} ({account.display_phone_number})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Utenti Notificati
            </CardTitle>
            <CardDescription>
              Configura chi riceve notifiche quando arriva un messaggio WhatsApp.
              Gli utenti online riceveranno una notifica in-app, quelli offline
              riceveranno un'email.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Add user */}
            <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
              <Users className="h-5 w-5 text-muted-foreground" />
              <Select
                value={selectedUserToAdd}
                onValueChange={setSelectedUserToAdd}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleziona utente da aggiungere" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {[user.first_name, user.last_name]
                        .filter(Boolean)
                        .join(" ") || user.email}{" "}
                      <span className="text-muted-foreground">
                        ({user.email})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={addUserToNotifications}
                disabled={!selectedUserToAdd || saving}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Aggiungi
              </Button>
            </div>

            {/* Current settings */}
            {currentAccountSettings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessun utente configurato per le notifiche.</p>
                <p className="text-sm mt-2">
                  Aggiungi utenti per ricevere notifiche sui messaggi.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {currentAccountSettings.map((setting) => (
                    <div
                      key={setting.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">
                          {getProfileDisplay(setting.user_id)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {profiles.find((p) => p.id === setting.user_id)?.email}
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`notify-${setting.id}`}
                            checked={setting.notify_on_message}
                            onCheckedChange={(checked) =>
                              updateSetting(
                                setting.id,
                                "notify_on_message",
                                !!checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`notify-${setting.id}`}
                            className="text-sm flex items-center gap-1"
                          >
                            <Bell className="h-4 w-4" />
                            Notifica
                          </Label>
                        </div>

                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`email-${setting.id}`}
                            checked={setting.email_when_offline}
                            onCheckedChange={(checked) =>
                              updateSetting(
                                setting.id,
                                "email_when_offline",
                                !!checked
                              )
                            }
                          />
                          <Label
                            htmlFor={`email-${setting.id}`}
                            className="text-sm flex items-center gap-1"
                          >
                            <Mail className="h-4 w-4" />
                            Email offline
                          </Label>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            removeUserFromNotifications(setting.id)
                          }
                          disabled={saving}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            <div className="p-4 bg-muted rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Come funziona
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>
                  • <strong>Notifica in-app:</strong> Se l'utente è online
                  (ERP aperto), riceve una notifica istantanea
                </li>
                <li>
                  • <strong>Email offline:</strong> Se l'utente non è online,
                  riceve un'email con il contenuto del messaggio e la traduzione
                </li>
                <li>
                  • Gli utenti vengono considerati "online" se hanno l'ERP
                  aperto in una scheda attiva
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
