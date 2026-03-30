import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Check,
  X,
  Edit3,
  Clock,
  Send,
  RefreshCw,
  Loader2,
  MessageCircle,
  User,
  Calendar,
  Brain,
  Zap,
  Settings2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

interface FollowupItem {
  id: string;
  account_id: string;
  conversation_id: string;
  customer_phone: string;
  customer_name: string | null;
  lead_id: string | null;
  proposed_message: string;
  ai_reasoning: string | null;
  status: string;
  followup_number: number;
  days_inactive: number;
  delay_days: number;
  scheduled_at: string | null;
  approved_at: string | null;
  sent_at: string | null;
  rejected_at: string | null;
  edited_message: string | null;
  detected_language: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "In attesa", color: "bg-amber-500/10 text-amber-700 border-amber-200", icon: Clock },
  approved: { label: "Approvato", color: "bg-blue-500/10 text-blue-700 border-blue-200", icon: Check },
  sent: { label: "Inviato", color: "bg-green-500/10 text-green-700 border-green-200", icon: Send },
  rejected: { label: "Rifiutato", color: "bg-red-500/10 text-red-700 border-red-200", icon: X },
  edited: { label: "Modificato", color: "bg-purple-500/10 text-purple-700 border-purple-200", icon: Edit3 },
};

export function BeccaFollowupTab() {
  const queryClient = useQueryClient();
  const [selectedItem, setSelectedItem] = useState<FollowupItem | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [minDays, setMinDays] = useState(3);
  const [statusFilter, setStatusFilter] = useState<string>("pending");

  // Fetch followup queue
  const { data: followups, isLoading } = useQuery({
    queryKey: ["becca-followup-queue", statusFilter],
    queryFn: async () => {
      let query = supabase
        .from("becca_followup_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FollowupItem[];
    },
    refetchInterval: 15000,
  });

  // Approve followup
  const approveMutation = useMutation({
    mutationFn: async (item: FollowupItem) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Update status to approved
      const { error: updateError } = await supabase
        .from("becca_followup_queue" as any)
        .update({
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: user?.id,
        } as any)
        .eq("id", item.id);

      if (updateError) throw updateError;

      // Send template to reopen conversation window
      // The AI personalized message will be used by Becca when the customer replies
      const lang = item.detected_language || "it";
      const templateName = "becca_followup";
      const customerName = item.customer_name || "👋";

      const { error: templateError } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          to: item.customer_phone,
          type: "template",
          template_name: templateName,
          template_language: lang,
          template_params: [customerName],
          account_id: item.account_id,
        },
      });

      if (templateError) throw new Error(`Errore template: ${templateError.message}`);

      // Update status to sent (only template sent, Becca handles the rest when customer replies)
      const { error: sentError } = await supabase
        .from("becca_followup_queue" as any)
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
        } as any)
        .eq("id", item.id);

      if (sentError) throw sentError;
    },
    onSuccess: () => {
      toast.success("Template follow-up inviato! Becca risponderà quando il cliente reagisce.");
      setSelectedItem(null);
      queryClient.invalidateQueries({ queryKey: ["becca-followup-queue"] });
    },
    onError: (e: any) => toast.error(`Errore invio: ${e.message}`),
  });

  // Reject followup
  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("becca_followup_queue" as any)
        .update({
          status: "rejected",
          rejected_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Follow-up rifiutato");
      setSelectedItem(null);
      setRejectDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["becca-followup-queue"] });
    },
  });

  // Edit & save followup
  const editMutation = useMutation({
    mutationFn: async ({ id, message }: { id: string; message: string }) => {
      const { error } = await supabase
        .from("becca_followup_queue" as any)
        .update({
          edited_message: message,
          status: "edited",
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Messaggio modificato");
      setEditDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["becca-followup-queue"] });
    },
  });

  // Generate followups
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("becca-generate-followups", {
        body: { min_inactive_days: minDays },
      });
      if (error) throw error;
      toast.success(`Generati ${data?.generated || 0} follow-up`);
      queryClient.invalidateQueries({ queryKey: ["becca-followup-queue"] });
    } catch (e: any) {
      toast.error(`Errore: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const pendingCount = followups?.filter(f => f.status === "pending" || f.status === "edited").length || 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold">Follow-up Vesuviano</h3>
                <p className="text-xs text-muted-foreground">
                  {pendingCount > 0 ? `${pendingCount} messaggi da approvare` : "Nessun messaggio in coda"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs whitespace-nowrap">Giorni inattività:</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={minDays}
                  onChange={(e) => setMinDays(parseInt(e.target.value) || 3)}
                  className="w-16 h-8"
                />
              </div>
              <Button onClick={handleGenerate} disabled={isGenerating} size="sm">
                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Brain className="h-4 w-4 mr-1" />}
                Genera Follow-up
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filter tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {[
          { key: "pending", label: "In attesa" },
          { key: "edited", label: "Modificati" },
          { key: "sent", label: "Inviati" },
          { key: "rejected", label: "Rifiutati" },
          { key: "all", label: "Tutti" },
        ].map(({ key, label }) => (
          <Button
            key={key}
            variant={statusFilter === key ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(key)}
            className="text-xs"
          >
            {label}
            {key === "pending" && pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {pendingCount}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Followup list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !followups?.length ? (
        <Card>
          <CardContent className="p-8 text-center">
            <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nessun follow-up trovato</p>
            <p className="text-xs text-muted-foreground mt-1">
              Clicca "Genera Follow-up" per analizzare le conversazioni inattive
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {followups.map((item) => {
            const cfg = statusConfig[item.status] || statusConfig.pending;
            const StatusIcon = cfg.icon;
            return (
              <Card
                key={item.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setSelectedItem(item)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {item.customer_name || item.customer_phone}
                        </span>
                        <Badge variant="outline" className={cfg.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Follow-up #{item.followup_number}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {item.days_inactive}g inattivo
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {item.edited_message || item.proposed_message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: it })}
                      </p>
                    </div>
                    {(item.status === "pending" || item.status === "edited") && (
                      <div className="flex gap-1 flex-shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={(e) => { e.stopPropagation(); approveMutation.mutate(item); }}
                          disabled={approveMutation.isPending}
                        >
                          {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setEditMessage(item.edited_message || item.proposed_message);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                            setRejectDialogOpen(true);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedItem && !editDialogOpen && !rejectDialogOpen} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Follow-up #{selectedItem?.followup_number}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.customer_name || selectedItem?.customer_phone} · {selectedItem?.days_inactive} giorni inattivo
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Messaggio proposto</Label>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm whitespace-pre-wrap">
                    {selectedItem.edited_message || selectedItem.proposed_message}
                  </p>
                </div>
              </div>

              {selectedItem.ai_reasoning && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Brain className="h-3 w-3" /> Ragionamento AI
                  </Label>
                  <p className="text-xs text-muted-foreground italic">{selectedItem.ai_reasoning}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground">Telefono:</span>
                  <p className="font-medium">{selectedItem.customer_phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Creato:</span>
                  <p className="font-medium">
                    {format(new Date(selectedItem.created_at), "dd MMM yyyy HH:mm", { locale: it })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {selectedItem && (selectedItem.status === "pending" || selectedItem.status === "edited") && (
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedItem(selectedItem);
                  setRejectDialogOpen(true);
                }}
              >
                <X className="h-4 w-4 mr-1" /> Rifiuta
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMessage(selectedItem.edited_message || selectedItem.proposed_message);
                  setEditDialogOpen(true);
                }}
              >
                <Edit3 className="h-4 w-4 mr-1" /> Modifica
              </Button>
              <Button
                onClick={() => approveMutation.mutate(selectedItem)}
                disabled={approveMutation.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                Approva e Invia
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifica messaggio</DialogTitle>
            <DialogDescription>
              Modifica il messaggio prima di inviarlo al cliente
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={editMessage}
            onChange={(e) => setEditMessage(e.target.value)}
            className="min-h-[120px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Annulla</Button>
            <Button
              onClick={() => {
                if (selectedItem) {
                  editMutation.mutate({ id: selectedItem.id, message: editMessage });
                }
              }}
              disabled={editMutation.isPending}
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rifiutare questo follow-up?</AlertDialogTitle>
            <AlertDialogDescription>
              Il messaggio non verrà inviato. Potrai generare un nuovo follow-up per questa conversazione in futuro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedItem && rejectMutation.mutate(selectedItem.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Rifiuta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
