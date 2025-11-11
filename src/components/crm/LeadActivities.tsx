import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, Calendar, User, Clock, Edit, Trash2, MessageSquare, Send } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  activity_date: string;
  assigned_to?: string;
  notes?: string;
  status: string;
  completed_at?: string;
  completed_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

interface LeadActivitiesProps {
  leadId: string;
  onActivityCompleted?: () => void;
}

const activityTypes = [
  { value: "call", label: "Chiamata" },
  { value: "email", label: "Email" },
  { value: "meeting", label: "Incontro" },
  { value: "demo", label: "Demo" },
  { value: "follow_up", label: "Follow-up" },
  { value: "quote", label: "Preventivo" },
  { value: "other", label: "Altro" }
];

const activityStatuses = [
  { value: "scheduled", label: "Programmata" },
  { value: "completed", label: "Completata" },
  { value: "cancelled", label: "Cancellata" }
];

export default function LeadActivities({ leadId, onActivityCompleted }: LeadActivitiesProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [activityToComplete, setActivityToComplete] = useState<LeadActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);
  const [comments, setComments] = useState<Record<string, any[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [showMentions, setShowMentions] = useState<Record<string, boolean>>({});
  const [expandedActivities, setExpandedActivities] = useState<Record<string, boolean>>({});
  const [newActivity, setNewActivity] = useState({
    activity_type: "",
    activity_date: "",
    assigned_to: "",
    notes: "",
    status: "scheduled"
  });
  const [completionData, setCompletionData] = useState({
    notes: "",
    next_activity_type: "",
    next_activity_date: "",
    next_activity_assigned_to: "",
    next_activity_notes: ""
  });
  const { toast } = useToast();

  useEffect(() => {
    loadActivities();
    loadUsers();
    syncNextActivityToTable();
  }, [leadId]);

  useEffect(() => {
    if (activities.length > 0) {
      activities.forEach(activity => {
        loadComments(activity.id);
      });
    }
  }, [activities]);

  const syncNextActivityToTable = async () => {
    try {
      // Controlla se il lead ha next_activity_* ma non ha attività corrispondente
      const { data: leadData, error: leadError } = await supabase
        .from("leads")
        .select("next_activity_type, next_activity_date, next_activity_assigned_to, next_activity_notes")
        .eq("id", leadId)
        .single();

      if (leadError || !leadData?.next_activity_type || !leadData?.next_activity_date) return;

      // Verifica se esiste già l'attività
      const { data: existingActivity } = await supabase
        .from("lead_activities")
        .select("id")
        .eq("lead_id", leadId)
        .eq("activity_type", leadData.next_activity_type)
        .eq("status", "scheduled")
        .maybeSingle();

      // Se non esiste, creala
      if (!existingActivity) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("lead_activities").insert([{
          lead_id: leadId,
          activity_type: leadData.next_activity_type,
          activity_date: leadData.next_activity_date,
          assigned_to: leadData.next_activity_assigned_to || null,
          notes: leadData.next_activity_notes || null,
          status: "scheduled",
          created_by: user?.id
        }]);
        
        // Ricarica le attività
        loadActivities();
      }
    } catch (error) {
      console.error("Error syncing next activity:", error);
    }
  };

  const loadComments = async (activityId: string) => {
    try {
      const { data, error } = await supabase
        .from("lead_activity_comments")
        .select(`
          *,
          profiles:user_id (
            id,
            first_name,
            last_name
          )
        `)
        .eq("activity_id", activityId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setComments(prev => ({ ...prev, [activityId]: data || [] }));
    } catch (error) {
      console.error("Error loading comments:", error);
    }
  };

  const handleAddComment = async (activityId: string) => {
    const comment = newComment[activityId]?.trim();
    if (!comment) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Estrai le mentions dal testo (@username)
      const mentionMatches = comment.match(/@(\w+)/g);
      const mentionedUsers: string[] = [];
      
      if (mentionMatches) {
        for (const mention of mentionMatches) {
          const username = mention.substring(1);
          const foundUser = users.find(u => 
            `${u.first_name}${u.last_name}`.toLowerCase().includes(username.toLowerCase())
          );
          if (foundUser) {
            mentionedUsers.push(foundUser.id);
          }
        }
      }

      const { error } = await supabase
        .from("lead_activity_comments")
        .insert([{
          activity_id: activityId,
          user_id: user.id,
          comment,
          mentions: mentionedUsers
        }]);

      if (error) throw error;

      // Se il lead è "new", cambialo a "qualified" perché c'è stata interazione
      const { data: leadData } = await supabase
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single();

      if (leadData?.status === "new") {
        await supabase
          .from("leads")
          .update({ status: "qualified" })
          .eq("id", leadId);
      }

      toast({
        title: "Commento aggiunto",
        description: "Il commento è stato aggiunto con successo",
      });
      setNewComment(prev => ({ ...prev, [activityId]: "" }));
      setShowMentions(prev => ({ ...prev, [activityId]: false }));
      loadComments(activityId);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const insertMention = (activityId: string, userName: string) => {
    const currentComment = newComment[activityId] || "";
    const lastAtIndex = currentComment.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const beforeMention = currentComment.substring(0, lastAtIndex);
      const newText = `${beforeMention}@${userName} `;
      setNewComment(prev => ({ ...prev, [activityId]: newText }));
    } else {
      setNewComment(prev => ({ ...prev, [activityId]: `${currentComment}@${userName} ` }));
    }
    
    setShowMentions(prev => ({ ...prev, [activityId]: false }));
  };

  const handleCommentChange = (activityId: string, value: string) => {
    setNewComment(prev => ({ ...prev, [activityId]: value }));
    
    // Mostra suggerimenti mention se l'ultimo carattere è @
    const lastChar = value[value.length - 1];
    const beforeLastChar = value[value.length - 2];
    
    if (lastChar === "@" && (!beforeLastChar || beforeLastChar === " ")) {
      setShowMentions(prev => ({ ...prev, [activityId]: true }));
    } else if (!value.includes("@")) {
      setShowMentions(prev => ({ ...prev, [activityId]: false }));
    }
  };

  const loadActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", leadId)
        .order("activity_date", { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error: any) {
      console.error("Error loading activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .eq("user_type", "erp")
        .order("first_name", { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  };

  const handleCreateActivity = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const activityData = {
        lead_id: leadId,
        activity_type: newActivity.activity_type,
        activity_date: new Date(newActivity.activity_date).toISOString(),
        assigned_to: newActivity.assigned_to || null,
        notes: newActivity.notes || null,
        status: newActivity.status,
        created_by: user.id
      };

      const { error } = await supabase
        .from("lead_activities")
        .insert([activityData]);

      if (error) throw error;

      // Se il lead è "new", cambialo a "qualified" perché c'è stata interazione
      const { data: leadData } = await supabase
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single();

      if (leadData?.status === "new") {
        await supabase
          .from("leads")
          .update({ status: "qualified" })
          .eq("id", leadId);
      }

      // Aggiungi l'attività al calendario personale e aziendale se assegnata
      if (newActivity.assigned_to) {
        await supabase.from("calendar_events").insert([{
          user_id: newActivity.assigned_to,
          title: `Lead Activity: ${getActivityTypeLabel(newActivity.activity_type)}`,
          description: newActivity.notes || "",
          event_date: new Date(newActivity.activity_date).toISOString(),
          event_type: "lead_activity",
          color: "blue"
        }]);
      }

      toast({
        title: "Attività creata",
        description: "L'attività è stata creata e aggiunta al calendario",
      });

      setIsDialogOpen(false);
      resetForm();
      loadActivities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleUpdateActivity = async () => {
    if (!editingActivity) return;

    try {
      const activityData = {
        activity_type: newActivity.activity_type,
        activity_date: new Date(newActivity.activity_date).toISOString(),
        assigned_to: newActivity.assigned_to || null,
        notes: newActivity.notes || null,
        status: newActivity.status
      };

      const { error } = await supabase
        .from("lead_activities")
        .update(activityData)
        .eq("id", editingActivity.id);

      if (error) throw error;

      toast({
        title: "Attività aggiornata",
        description: "L'attività è stata aggiornata con successo",
      });

      setIsDialogOpen(false);
      setEditingActivity(null);
      resetForm();
      loadActivities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleCompleteActivity = async (activity: LeadActivity) => {
    setActivityToComplete(activity);
    setCompletionData({
      notes: "",
      next_activity_type: "",
      next_activity_date: "",
      next_activity_assigned_to: "",
      next_activity_notes: ""
    });
    setIsCompleteDialogOpen(true);
  };

  const confirmCompleteActivity = async () => {
    if (!activityToComplete) return;

    // Validazione obbligatoria
    if (!completionData.notes.trim()) {
      toast({
        title: "Nota obbligatoria",
        description: "Devi inserire una nota per completare l'attività",
        variant: "destructive",
      });
      return;
    }

    if (!completionData.next_activity_type || !completionData.next_activity_date) {
      toast({
        title: "Prossima attività obbligatoria",
        description: "Devi pianificare la prossima attività",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Completa l'attività corrente con la nota
      const { error: updateError } = await supabase
        .from("lead_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id,
          notes: completionData.notes
        })
        .eq("id", activityToComplete.id);

      if (updateError) throw updateError;

      // Se il lead è "new", cambialo a "qualified" perché c'è stata interazione
      const { data: leadData } = await supabase
        .from("leads")
        .select("status")
        .eq("id", leadId)
        .single();

      if (leadData?.status === "new") {
        await supabase
          .from("leads")
          .update({ status: "qualified" })
          .eq("id", leadId);
      }

      // Crea la prossima attività
      const { error: insertError } = await supabase
        .from("lead_activities")
        .insert([{
          lead_id: leadId,
          activity_type: completionData.next_activity_type,
          activity_date: new Date(completionData.next_activity_date).toISOString(),
          assigned_to: completionData.next_activity_assigned_to || null,
          notes: completionData.next_activity_notes || null,
          status: "scheduled",
          created_by: user.id
        }]);

      if (insertError) throw insertError;

      // Aggiorna il lead con la prossima attività
      await supabase
        .from("leads")
        .update({
          next_activity_type: completionData.next_activity_type,
          next_activity_date: new Date(completionData.next_activity_date).toISOString(),
          next_activity_assigned_to: completionData.next_activity_assigned_to || null,
          next_activity_notes: completionData.next_activity_notes || null
        })
        .eq("id", leadId);

      // Aggiungi al calendario se assegnata
      if (completionData.next_activity_assigned_to) {
        await supabase.from("calendar_events").insert([{
          user_id: completionData.next_activity_assigned_to,
          title: `Lead Activity: ${completionData.next_activity_type}`,
          description: completionData.next_activity_notes || "",
          event_date: new Date(completionData.next_activity_date).toISOString(),
          event_type: "lead_activity",
          color: "blue"
        }]);
      }

      toast({
        title: "Attività completata",
        description: "L'attività è stata completata e la prossima attività è stata pianificata",
      });

      setIsCompleteDialogOpen(false);
      setActivityToComplete(null);
      loadActivities();
      
      // Notifica il componente padre per ricaricare i lead
      if (onActivityCompleted) {
        onActivityCompleted();
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile completare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("lead_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      toast({
        title: "Attività eliminata",
        description: "L'attività è stata eliminata con successo",
      });

      loadActivities();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'attività: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditActivity = (activity: LeadActivity) => {
    setEditingActivity(activity);
    setNewActivity({
      activity_type: activity.activity_type,
      activity_date: new Date(activity.activity_date).toISOString().slice(0, 16),
      assigned_to: activity.assigned_to || "",
      notes: activity.notes || "",
      status: activity.status
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setNewActivity({
      activity_type: "",
      activity_date: "",
      assigned_to: "",
      notes: "",
      status: "scheduled"
    });
  };

  const getActivityTypeLabel = (type: string) => {
    return activityTypes.find(t => t.value === type)?.label || type;
  };

  const getStatusBadge = (status: string, activityDate: string) => {
    const isOverdue = status === "scheduled" && new Date(activityDate) < new Date();
    
    switch (status) {
      case "scheduled":
        if (isOverdue) {
          return <Badge variant="destructive" className="animate-pulse">Scaduta</Badge>;
        }
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Programmata</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-green-50 text-green-700">Completata</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Cancellata</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Attività e Storico</CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setEditingActivity(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Nuova Attività
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingActivity ? "Modifica Attività" : "Nuova Attività"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="activity_type">Tipo Attività *</Label>
                <Select
                  value={newActivity.activity_type}
                  onValueChange={(value) => setNewActivity({ ...newActivity, activity_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {activityTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="activity_date">Data e Ora *</Label>
                <div className="flex gap-2 mb-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() + 1);
                      setNewActivity({ ...newActivity, activity_date: date.toISOString().slice(0, 16) });
                    }}
                  >
                    +1 giorno
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() + 3);
                      setNewActivity({ ...newActivity, activity_date: date.toISOString().slice(0, 16) });
                    }}
                  >
                    +3 giorni
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const date = new Date();
                      date.setDate(date.getDate() + 7);
                      setNewActivity({ ...newActivity, activity_date: date.toISOString().slice(0, 16) });
                    }}
                  >
                    +7 giorni
                  </Button>
                </div>
                <Input
                  id="activity_date"
                  type="datetime-local"
                  value={newActivity.activity_date}
                  onChange={(e) => setNewActivity({ ...newActivity, activity_date: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="assigned_to">Assegnato a</Label>
                <Select
                  value={newActivity.assigned_to}
                  onValueChange={(value) => setNewActivity({ ...newActivity, assigned_to: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="status">Stato</Label>
                <Select
                  value={newActivity.status}
                  onValueChange={(value) => setNewActivity({ ...newActivity, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {activityStatuses.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={newActivity.notes}
                  onChange={(e) => setNewActivity({ ...newActivity, notes: e.target.value })}
                  placeholder="Note sull'attività..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setEditingActivity(null);
                resetForm();
              }}>
                Annulla
              </Button>
              <Button onClick={editingActivity ? handleUpdateActivity : handleCreateActivity}>
                {editingActivity ? "Aggiorna" : "Crea"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">Caricamento...</p>
        ) : activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nessuna attività registrata</p>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const isOverdue = activity.status === "scheduled" && new Date(activity.activity_date) < new Date();
              return (
              <Card key={activity.id} className={`border-l-4 ${isOverdue ? 'border-l-destructive bg-red-50/50' : 'border-l-primary'}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{getActivityTypeLabel(activity.activity_type)}</h4>
                        {getStatusBadge(activity.status, activity.activity_date)}
                      </div>
                      
                      <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(activity.activity_date), "PPP 'alle' HH:mm", { locale: it })}
                          </span>
                        </div>
                        
                        {activity.assigned_to && (
                          <div className="flex items-center gap-1">
                            <User className="w-4 h-4" />
                            <span>
                              {users.find(u => u.id === activity.assigned_to)?.first_name}{" "}
                              {users.find(u => u.id === activity.assigned_to)?.last_name}
                            </span>
                          </div>
                        )}

                        {activity.completed_at && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            <span>Completata il {format(new Date(activity.completed_at), "PPP", { locale: it })}</span>
                          </div>
                        )}
                      </div>

                      {activity.notes && (
                        <p className="text-sm text-muted-foreground italic">{activity.notes}</p>
                      )}

                      {/* Sezione Commenti */}
                      <div className="mt-4 border-t pt-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mb-2"
                          onClick={() => setExpandedActivities(prev => ({ 
                            ...prev, 
                            [activity.id]: !prev[activity.id] 
                          }))}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Commenti ({comments[activity.id]?.length || 0})
                        </Button>

                        {expandedActivities[activity.id] && (
                          <div className="space-y-3 mt-3">
                            {/* Commenti esistenti */}
                            {comments[activity.id]?.map((comment: any) => (
                              <div key={comment.id} className="flex gap-2 bg-muted/50 p-3 rounded-lg">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                    {comment.profiles?.first_name?.[0]}{comment.profiles?.last_name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium">
                                      {comment.profiles?.first_name} {comment.profiles?.last_name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(comment.created_at), "dd MMM HH:mm", { locale: it })}
                                    </span>
                                  </div>
                                  <p className="text-sm whitespace-pre-wrap">
                                    {comment.comment}
                                  </p>
                                </div>
                              </div>
                            ))}

                            {/* Input nuovo commento */}
                            <div className="relative">
                              <Textarea
                                placeholder="Scrivi un commento... (usa @ per taggare utenti)"
                                value={newComment[activity.id] || ""}
                                onChange={(e) => handleCommentChange(activity.id, e.target.value)}
                                className="min-h-[80px] resize-none"
                              />
                              
                              {/* Suggerimenti mentions */}
                              {showMentions[activity.id] && (
                                <div className="absolute z-10 w-64 mt-1 bg-popover border rounded-md shadow-md">
                                  <Command>
                                    <CommandInput placeholder="Cerca utente..." />
                                    <CommandEmpty>Nessun utente trovato</CommandEmpty>
                                    <CommandGroup>
                                      {users.map((user) => (
                                        <CommandItem
                                          key={user.id}
                                          onSelect={() => insertMention(
                                            activity.id, 
                                            `${user.first_name}${user.last_name}`
                                          )}
                                        >
                                          <User className="mr-2 h-4 w-4" />
                                          <span>{user.first_name} {user.last_name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </Command>
                                </div>
                              )}

                              <Button
                                size="sm"
                                className="mt-2"
                                onClick={() => handleAddComment(activity.id)}
                                disabled={!newComment[activity.id]?.trim()}
                              >
                                <Send className="h-4 w-4 mr-2" />
                                Invia commento
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {activity.status === "scheduled" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleCompleteActivity(activity)}
                          title="Segna come completata"
                        >
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleEditActivity(activity)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Elimina attività</AlertDialogTitle>
                            <AlertDialogDescription>
                              Sei sicuro di voler eliminare questa attività? Questa azione non può essere annullata.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annulla</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteActivity(activity.id)}>
                              Elimina
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog per completamento attività */}
      <Dialog open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completa Attività</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-1">Attività da completare:</p>
              <p className="text-sm text-muted-foreground capitalize">
                {activityToComplete && getActivityTypeLabel(activityToComplete.activity_type)}
              </p>
            </div>

            <div>
              <Label htmlFor="completion_notes">Nota di chiusura *</Label>
              <Textarea
                id="completion_notes"
                value={completionData.notes}
                onChange={(e) => setCompletionData({ ...completionData, notes: e.target.value })}
                placeholder="Descrivi l'esito dell'attività..."
                rows={3}
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Campo obbligatorio
              </p>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Prossima Attività *</h4>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="next_type">Tipo Attività *</Label>
                  <Select
                    value={completionData.next_activity_type}
                    onValueChange={(value) => setCompletionData({ ...completionData, next_activity_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {activityTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="next_date">Data e Ora *</Label>
                  <div className="flex gap-2 mb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 1);
                        setCompletionData({ ...completionData, next_activity_date: date.toISOString().slice(0, 16) });
                      }}
                    >
                      +1 giorno
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + 7);
                        setCompletionData({ ...completionData, next_activity_date: date.toISOString().slice(0, 16) });
                      }}
                    >
                      +7 giorni
                    </Button>
                  </div>
                  <Input
                    id="next_date"
                    type="datetime-local"
                    value={completionData.next_activity_date}
                    onChange={(e) => setCompletionData({ ...completionData, next_activity_date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="next_assigned">Assegnato a</Label>
                  <Select
                    value={completionData.next_activity_assigned_to}
                    onValueChange={(value) => setCompletionData({ ...completionData, next_activity_assigned_to: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona utente" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="next_notes">Note</Label>
                  <Textarea
                    id="next_notes"
                    value={completionData.next_activity_notes}
                    onChange={(e) => setCompletionData({ ...completionData, next_activity_notes: e.target.value })}
                    placeholder="Note sulla prossima attività..."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCompleteDialogOpen(false)}>
              Annulla
            </Button>
            <Button onClick={confirmCompleteActivity}>
              Completa e Pianifica
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
