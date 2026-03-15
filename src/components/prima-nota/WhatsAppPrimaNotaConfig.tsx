import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { MessageSquare, Plus, Trash2, Phone, CheckCircle2, XCircle, AlertTriangle, Receipt } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export function WhatsAppPrimaNotaConfig() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newPhone, setNewPhone] = useState("");
  const [newLabel, setNewLabel] = useState("Prima Nota");
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // Fetch WhatsApp accounts
  const { data: accounts = [] } = useQuery({
    queryKey: ["whatsapp-accounts-prima-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_accounts")
        .select("id, verified_name, display_phone_number")
        .eq("is_active", true)
        .order("verified_name");
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch configs
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ["whatsapp-prima-nota-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_prima_nota_config")
        .select("*, whatsapp_accounts(name, phone_number)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch recent logs
  const { data: recentLogs = [] } = useQuery({
    queryKey: ["whatsapp-prima-nota-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_prima_nota_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("whatsapp_prima_nota_config").insert({
        account_id: selectedAccountId,
        authorized_phone: newPhone.replace(/\s/g, ''),
        user_label: newLabel,
        created_by: user?.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Numero autorizzato aggiunto");
      setShowAddDialog(false);
      setNewPhone("");
      setNewLabel("Prima Nota");
      setSelectedAccountId("");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-prima-nota-configs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_prima_nota_config")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-prima-nota-configs"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_prima_nota_config").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configurazione rimossa");
      queryClient.invalidateQueries({ queryKey: ["whatsapp-prima-nota-configs"] });
    },
  });

  const completedCount = recentLogs.filter(l => l.status === 'completed').length;
  const failedCount = recentLogs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-lg">WhatsApp → Prima Nota</CardTitle>
                <CardDescription>
                  Invia messaggi, foto o vocali al numero WhatsApp aziendale per creare movimenti automaticamente
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> Autorizza numero
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* How it works */}
          <div className="bg-muted/50 rounded-lg p-4 mb-4 text-sm space-y-2">
            <p className="font-medium text-foreground">Come funziona:</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Autorizza il tuo numero di telefono qui sotto</li>
              <li>Invia un messaggio al numero WhatsApp aziendale dal tuo telefono</li>
              <li>L'AI analizza il messaggio e crea un movimento in <strong>bozza</strong></li>
              <li>Ricevi conferma via WhatsApp con i dettagli</li>
              <li>Valida il movimento dalla Prima Nota</li>
            </ol>
            <p className="text-xs text-muted-foreground/70 mt-2">
              💡 Esempi: "Pagato fornitore Rossi 1500€ fattura F-001 IVA 22%" • Foto della ricevuta • Vocale con i dettagli
            </p>
          </div>

          {/* Configured numbers */}
          {configs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Nessun numero autorizzato</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Etichetta</TableHead>
                  <TableHead>Account WhatsApp</TableHead>
                  <TableHead>Attivo</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {configs.map((config: any) => (
                  <TableRow key={config.id}>
                    <TableCell className="font-mono">{config.authorized_phone}</TableCell>
                    <TableCell>{config.user_label}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {config.whatsapp_accounts?.name || "N/D"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={config.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: config.id, active: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteMutation.mutate(config.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Log */}
      {recentLogs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">Attività recente</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> {completedCount} ok
                </Badge>
                {failedCount > 0 && (
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    <XCircle className="h-3 w-3 mr-1" /> {failedCount} errori
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {recentLogs.map((log: any) => (
                  <div
                    key={log.id}
                    className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/30"
                  >
                    {log.status === 'completed' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    ) : log.status === 'failed' ? (
                      <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    )}
                    <span className="truncate flex-1 text-muted-foreground">
                      {log.raw_message?.substring(0, 80) || "Messaggio elaborato"}
                      {log.error_message && ` — ${log.error_message}`}
                    </span>
                    <span className="text-xs text-muted-foreground/60 shrink-0">
                      {format(new Date(log.created_at), "dd/MM HH:mm", { locale: it })}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorizza numero per Prima Nota</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Account WhatsApp</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc: any) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name} ({acc.phone_number})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Numero di telefono autorizzato</Label>
              <Input
                placeholder="Es: +39 333 1234567"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Il numero dal quale invierai i messaggi al numero aziendale
              </p>
            </div>
            <div>
              <Label>Etichetta</Label>
              <Input
                placeholder="Es: Prima Nota - Stanislao"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => addMutation.mutate()}
              disabled={!selectedAccountId || !newPhone || addMutation.isPending}
            >
              Autorizza
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
