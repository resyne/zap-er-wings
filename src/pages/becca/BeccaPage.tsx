import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Bot, Plus, Trash2, Activity, Settings, Users, Clock, CheckCircle2, XCircle, AlertCircle, FileText, ListTodo, ShoppingCart, UserPlus } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const actionIcons: Record<string, any> = {
  prima_nota: FileText,
  task: ListTodo,
  sales_order: ShoppingCart,
  lead: UserPlus,
  error: XCircle,
  unknown: AlertCircle,
};

const actionLabels: Record<string, string> = {
  prima_nota: "Prima Nota",
  task: "Task",
  sales_order: "Ordine",
  lead: "Lead",
  error: "Errore",
  unknown: "Non classificato",
};

const statusColors: Record<string, string> = {
  completed: "bg-green-500/10 text-green-700 border-green-200",
  failed: "bg-red-500/10 text-red-700 border-red-200",
  awaiting_confirmation: "bg-amber-500/10 text-amber-700 border-amber-200",
  pending: "bg-blue-500/10 text-blue-700 border-blue-200",
};

export default function BeccaPage() {
  const queryClient = useQueryClient();
  const [newPhone, setNewPhone] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<string>("");

  // Fetch WhatsApp accounts
  const { data: accounts } = useQuery({
    queryKey: ["whatsapp-accounts"],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_accounts").select("id, verified_name, display_phone_number").eq("is_active", true);
      return data || [];
    },
  });

  // Fetch authorized users
  const { data: authorizedUsers } = useQuery({
    queryKey: ["becca-authorized-users"],
    queryFn: async () => {
      const { data } = await supabase
        .from("becca_authorized_users" as any)
        .select("*")
        .order("created_at", { ascending: false });
      return (data || []) as any[];
    },
  });

  // Fetch activity log
  const { data: activityLog } = useQuery({
    queryKey: ["becca-activity-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("becca_activity_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
    refetchInterval: 10000,
  });

  // Fetch settings
  const { data: settingsData } = useQuery({
    queryKey: ["becca-settings", selectedAccount],
    queryFn: async () => {
      if (!selectedAccount) return null;
      const { data } = await supabase
        .from("becca_settings" as any)
        .select("*")
        .eq("account_id", selectedAccount)
        .single();
      return data as any;
    },
    enabled: !!selectedAccount,
  });

  // Add authorized user
  const addUserMutation = useMutation({
    mutationFn: async () => {
      if (!selectedAccount || !newPhone || !newName) throw new Error("Compila tutti i campi");
      const { error } = await supabase.from("becca_authorized_users" as any).insert({
        account_id: selectedAccount,
        phone_number: newPhone,
        display_name: newName,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Utente autorizzato aggiunto");
      setNewPhone("");
      setNewName("");
      queryClient.invalidateQueries({ queryKey: ["becca-authorized-users"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Remove authorized user
  const removeUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("becca_authorized_users" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Utente rimosso");
      queryClient.invalidateQueries({ queryKey: ["becca-authorized-users"] });
    },
  });

  // Toggle user active
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("becca_authorized_users" as any)
        .update({ is_active: isActive } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["becca-authorized-users"] }),
  });

  // Save settings
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const { error } = await supabase
        .from("becca_settings" as any)
        .upsert({ account_id: selectedAccount, ...settings } as any, { onConflict: "account_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Impostazioni salvate");
      queryClient.invalidateQueries({ queryKey: ["becca-settings"] });
    },
  });

  const stats = {
    total: activityLog?.length || 0,
    completed: activityLog?.filter((l: any) => l.status === "completed").length || 0,
    failed: activityLog?.filter((l: any) => l.status === "failed").length || 0,
    awaiting: activityLog?.filter((l: any) => l.status === "awaiting_confirmation").length || 0,
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg">
          <Bot className="h-8 w-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">Becca</h1>
          <p className="text-muted-foreground">
            Assistente AI aziendale via WhatsApp — Prima Nota, Task, Ordini, Lead
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Messaggi elaborati</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">Completati</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600" />
            <div>
              <p className="text-2xl font-bold">{stats.awaiting}</p>
              <p className="text-xs text-muted-foreground">In attesa conferma</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-2xl font-bold">{stats.failed}</p>
              <p className="text-xs text-muted-foreground">Errori</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-2" />Attività</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-2" />Utenti autorizzati</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-2" />Impostazioni</TabsTrigger>
        </TabsList>

        {/* Activity Log */}
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Log attività Becca</CardTitle>
              <CardDescription>Ultime azioni eseguite dall'AI</CardDescription>
            </CardHeader>
            <CardContent>
              {!activityLog?.length ? (
                <p className="text-muted-foreground text-center py-8">Nessuna attività ancora. Invia un messaggio WhatsApp a Becca!</p>
              ) : (
                <div className="space-y-3">
                  {activityLog.map((log: any) => {
                    const Icon = actionIcons[log.action_type] || AlertCircle;
                    return (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
                        <div className={`p-2 rounded-lg ${log.action_type === 'error' ? 'bg-red-100' : 'bg-violet-100'}`}>
                          <Icon className={`h-4 w-4 ${log.action_type === 'error' ? 'text-red-600' : 'text-violet-600'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">
                              {actionLabels[log.action_type] || log.action_type}
                            </span>
                            <Badge variant="outline" className={statusColors[log.status] || ""}>
                              {log.status === "completed" ? "Completato" : log.status === "failed" ? "Errore" : log.status === "awaiting_confirmation" ? "In attesa" : log.status}
                            </Badge>
                            {log.confidence_score && (
                              <Badge variant="outline" className="text-xs">
                                {log.confidence_score}% fiducia
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 truncate">
                            {log.raw_message || "N/D"}
                          </p>
                          {log.error_message && (
                            <p className="text-xs text-red-600 mt-1">{log.error_message}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Authorized Users */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>Utenti autorizzati</CardTitle>
              <CardDescription>Solo questi numeri possono usare Becca via WhatsApp</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Account selector */}
              <div>
                <Label>Account WhatsApp</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.phone_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Add new user */}
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label>Numero telefono</Label>
                  <Input placeholder="+39 333 1234567" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label>Nome</Label>
                  <Input placeholder="Mario Rossi" value={newName} onChange={e => setNewName(e.target.value)} />
                </div>
                <Button onClick={() => addUserMutation.mutate()} disabled={!selectedAccount || !newPhone || !newName}>
                  <Plus className="h-4 w-4 mr-1" /> Aggiungi
                </Button>
              </div>

              {/* Users list */}
              <div className="space-y-2">
                {authorizedUsers?.map((user: any) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className={`h-2 w-2 rounded-full ${user.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <div>
                        <p className="font-medium text-sm">{user.display_name}</p>
                        <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                      </div>
                      <div className="flex gap-1">
                        {(user.allowed_actions || []).map((a: string) => (
                          <Badge key={a} variant="secondary" className="text-xs">{actionLabels[a] || a}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={(checked) => toggleUserMutation.mutate({ id: user.id, isActive: checked })}
                      />
                      <Button variant="ghost" size="icon" onClick={() => removeUserMutation.mutate(user.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
                {!authorizedUsers?.length && (
                  <p className="text-muted-foreground text-center py-4">Nessun utente autorizzato</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Impostazioni Becca</CardTitle>
              <CardDescription>Configura il comportamento dell'assistente AI</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Account WhatsApp</Label>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts?.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name} ({a.phone_number})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAccount && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Becca attiva</Label>
                      <p className="text-xs text-muted-foreground">Abilita/disabilita l'elaborazione AI dei messaggi</p>
                    </div>
                    <Switch
                      checked={settingsData?.is_enabled ?? true}
                      onCheckedChange={(checked) => saveSettingsMutation.mutate({ is_enabled: checked })}
                    />
                  </div>

                  <div>
                    <Label>Personalità AI</Label>
                    <Textarea
                      defaultValue={settingsData?.ai_persona || "Sei Becca, l'assistente AI aziendale di Zapper. Sei efficiente, precisa e professionale."}
                      className="min-h-[100px]"
                      onBlur={(e) => saveSettingsMutation.mutate({ ai_persona: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Soglia auto-conferma (%)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Se la confidenza AI è sopra questa soglia, Becca esegue l'azione senza chiedere conferma
                    </p>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={settingsData?.auto_confirm_threshold || 90}
                      onBlur={(e) => saveSettingsMutation.mutate({ auto_confirm_threshold: parseInt(e.target.value) || 90 })}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
