import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle, Calendar, User, Clock, Edit, Trash2 } from "lucide-react";
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

export default function LeadActivities({ leadId }: LeadActivitiesProps) {
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<LeadActivity | null>(null);
  const [newActivity, setNewActivity] = useState({
    activity_type: "",
    activity_date: "",
    assigned_to: "",
    notes: "",
    status: "scheduled"
  });
  const { toast } = useToast();

  useEffect(() => {
    loadActivities();
    loadUsers();
  }, [leadId]);

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

      toast({
        title: "Attività creata",
        description: "L'attività è stata creata con successo",
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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      const { error } = await supabase
        .from("lead_activities")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user.id
        })
        .eq("id", activity.id);

      if (error) throw error;

      toast({
        title: "Attività completata",
        description: "L'attività è stata segnata come completata",
      });

      loadActivities();
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "scheduled":
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
            {activities.map((activity) => (
              <Card key={activity.id} className="border-l-4 border-l-primary">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{getActivityTypeLabel(activity.activity_type)}</h4>
                        {getStatusBadge(activity.status)}
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
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
