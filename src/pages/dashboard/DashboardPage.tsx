import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { WeeklyCalendar } from "@/components/dashboard/WeeklyCalendar";
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  Calendar,
  User,
  LogOut,
  Settings,
  Eye,
  ExternalLink
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface UserActivity {
  id: string;
  opportunity_id: string;
  activity_type: string;
  title: string;
  description?: string;
  scheduled_date?: string;
  completed_at?: string;
  assigned_to?: string;
  created_at: string;
  opportunity?: {
    name: string;
  };
}

interface UserRequest {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  assigned_to?: string;
  created_by?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  category: string;
  assigned_to?: string;
  due_date?: string;
  start_date?: string;
  estimated_hours?: number;
  tags?: string[];
  created_at: string;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  activity_date: string;
  assigned_to: string;
  status: string;
  notes?: string;
  leads?: {
    company_name: string;
  };
}

// Component to display user role
function RoleDisplay() {
  const { userRole } = useUserRole();
  return <>{userRole || "user"}</>;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leadActivities, setLeadActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserTasks();
    }
  }, [user]);

  const loadUserTasks = async () => {
    if (!user) return;

    try {
      // Load CRM activities assigned to user
      const { data: activitiesData, error: activitiesError } = await supabase
        .from("opportunity_activities")
        .select("*")
        .eq("assigned_to", user.id)
        .eq("activity_type", "todo")
        .order("scheduled_date", { ascending: true, nullsFirst: false });

      if (activitiesError) {
        console.error("Error loading activities:", activitiesError);
      }

      // Load general requests assigned to user
      const { data: requestsData, error: requestsError } = await supabase
        .from("requests")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (requestsError) throw requestsError;

      // Load tasks assigned to user
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .or("is_template.is.null,is_template.eq.false")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (tasksError) throw tasksError;

      // Load lead activities
      const { data: leadActivitiesData, error: leadActivitiesError } = await supabase
        .from("lead_activities")
        .select("*, leads(company_name)")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("activity_date", { ascending: true });

      if (leadActivitiesError) console.error("Error loading lead activities:", leadActivitiesError);

      setActivities((activitiesData as any) || []);
      setRequests(requestsData || []);
      setTasks(tasksData || []);
      setLeadActivities(leadActivitiesData || []);
    } catch (error) {
      console.error("Error loading user tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const markActivityCompleted = async (activityId: string) => {
    try {
      const { error } = await supabase
        .from("opportunity_activities")
        .update({
          activity_type: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", activityId);

      if (error) throw error;

      // Refresh tasks
      loadUserTasks();
    } catch (error) {
      console.error("Error completing activity:", error);
    }
  };

  const markRequestCompleted = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString()
        })
        .eq("id", requestId);

      if (error) throw error;

      // Refresh tasks
      loadUserTasks();
    } catch (error) {
      console.error("Error completing request:", error);
    }
  };

  const markTaskCompleted = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "completed"
        })
        .eq("id", taskId);

      if (error) throw error;

      // Refresh tasks
      loadUserTasks();
    } catch (error) {
      console.error("Error completing task:", error);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "default";
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento dashboard...</div>
        </div>
      </div>
    );
  }

  const totalTasks = activities.length + requests.length + tasks.length + leadActivities.length;
  const urgentTasks = [
    ...activities.filter(a => a.scheduled_date && new Date(a.scheduled_date) < new Date(Date.now() + 24 * 60 * 60 * 1000)),
    ...requests.filter(r => r.priority === "high" || (r.due_date && new Date(r.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000))),
    ...tasks.filter(t => t.priority === "high" || (t.due_date && new Date(t.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000))),
    ...leadActivities.filter(la => new Date(la.activity_date) < new Date(Date.now() + 24 * 60 * 60 * 1000) && la.status === 'scheduled')
  ].length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with user info */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            Benvenuto, {profile?.first_name || user?.email}!
          </h1>
          <p className="text-muted-foreground">
            Ecco le tue attività di oggi
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-4 h-4" />
            <RoleDisplay />
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Profilo
          </Button>
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Esci
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attività Totali</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              Tutte le attività assegnate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgenti</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{urgentTasks}</div>
            <p className="text-xs text-muted-foreground">
              Scadono entro 24h
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Generali</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.length}</div>
            <p className="text-xs text-muted-foreground">
              Task sistema
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRM Activities (Lead + Opportunities) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Attività CRM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(leadActivities.length + activities.length) === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nessuna attività CRM
                </p>
              ) : (
                <>
                  {/* Lead Activities */}
                  {leadActivities.map((activity) => {
                    const isOverdue = new Date(activity.activity_date) < new Date() && activity.status === 'scheduled';
                    return (
                      <div 
                        key={`lead-${activity.id}`} 
                        className={`p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow ${isOverdue ? 'border-l-4 border-l-destructive bg-destructive/5' : ''}`}
                        onClick={() => navigate(`/crm/leads?lead=${activity.lead_id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Lead</Badge>
                              <h4 className="font-medium capitalize">{activity.activity_type}</h4>
                              {isOverdue && <Badge variant="destructive">Scaduta</Badge>}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {activity.leads?.company_name || 'Lead'}
                            </p>
                            {activity.notes && (
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                                {activity.notes}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(activity.activity_date), "dd MMM yyyy", { locale: it })}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewItem({ type: 'lead', data: activity });
                                setIsPreviewOpen(true);
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await supabase
                                  .from('lead_activities')
                                  .update({ status: 'completed' })
                                  .eq('id', activity.id);
                                loadUserTasks();
                              }}
                              className="h-7 w-7 p-0"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Opportunity Activities */}
                  {activities.map((activity) => (
                    <div key={`crm-${activity.id}`} className="p-3 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Opportunità</Badge>
                            <h4 className="font-medium">{activity.title}</h4>
                          </div>
                          {activity.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {activity.description}
                            </p>
                          )}
                          {activity.opportunity?.name && (
                            <p className="text-sm text-blue-600 mt-1">
                              {activity.opportunity.name}
                            </p>
                          )}
                          {activity.scheduled_date && (
                            <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(activity.scheduled_date), "dd MMM yyyy HH:mm", { locale: it })}
                            </div>
                          )}
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => markActivityCompleted(activity.id)}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* All Tasks (Tasks + Requests) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Task
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(tasks.length + requests.length) === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nessun task assegnato
                </p>
              ) : (
                <>
                  {/* Tasks */}
                  {tasks.map((task) => (
                    <div 
                      key={`task-${task.id}`} 
                      className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/tasks?task=${task.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{task.title}</h4>
                            <Badge variant={getPriorityColor(task.priority) as any}>
                              {task.priority}
                            </Badge>
                          </div>
                          {task.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {task.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="capitalize">{task.category}</span>
                            {task.due_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(task.due_date), "dd MMM yyyy", { locale: it })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewItem({ type: 'task', data: task });
                              setIsPreviewOpen(true);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              markTaskCompleted(task.id);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Requests */}
                  {requests.map((request) => (
                    <div 
                      key={`request-${request.id}`} 
                      className="p-3 border rounded-lg cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => navigate(`/tasks?task=${request.id}`)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium">{request.title}</h4>
                            <Badge variant={getPriorityColor(request.priority) as any}>
                              {request.priority}
                            </Badge>
                          </div>
                          {request.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {request.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>Tipo: {request.type}</span>
                            {request.due_date && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(request.due_date), "dd MMM yyyy", { locale: it })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewItem({ type: 'request', data: request });
                              setIsPreviewOpen(true);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              markRequestCompleted(request.id);
                            }}
                            className="h-7 w-7 p-0"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Calendar Section */}
      <WeeklyCalendar />

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anteprima Dettagli</DialogTitle>
          </DialogHeader>
          {previewItem && (
            <div className="space-y-4">
              {previewItem.type === 'lead' && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Attività Lead</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Lead</Badge>
                        <span className="capitalize">{previewItem.data.activity_type}</span>
                      </div>
                      <p className="text-sm"><strong>Lead:</strong> {previewItem.data.leads?.company_name || 'N/A'}</p>
                      <p className="text-sm"><strong>Data:</strong> {format(new Date(previewItem.data.activity_date), "PPP 'alle' HH:mm", { locale: it })}</p>
                      {previewItem.data.notes && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Note:</p>
                          <p className="text-sm text-muted-foreground">{previewItem.data.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsPreviewOpen(false);
                      navigate(`/crm/leads?lead=${previewItem.data.lead_id}`);
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Vai al Lead
                  </Button>
                </>
              )}
              {previewItem.type === 'task' && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Task</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{previewItem.data.title}</h4>
                        <Badge variant={getPriorityColor(previewItem.data.priority) as any}>
                          {previewItem.data.priority}
                        </Badge>
                      </div>
                      {previewItem.data.description && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Descrizione:</p>
                          <p className="text-sm text-muted-foreground">{previewItem.data.description}</p>
                        </div>
                      )}
                      <p className="text-sm"><strong>Categoria:</strong> <span className="capitalize">{previewItem.data.category}</span></p>
                      {previewItem.data.due_date && (
                        <p className="text-sm"><strong>Scadenza:</strong> {format(new Date(previewItem.data.due_date), "PPP", { locale: it })}</p>
                      )}
                      {previewItem.data.estimated_hours && (
                        <p className="text-sm"><strong>Ore stimate:</strong> {previewItem.data.estimated_hours}h</p>
                      )}
                      {previewItem.data.tags && previewItem.data.tags.length > 0 && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {previewItem.data.tags.map((tag: string) => (
                              <Badge key={tag} variant="outline">{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsPreviewOpen(false);
                      navigate(`/tasks?task=${previewItem.data.id}`);
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Vai al Task
                  </Button>
                </>
              )}
              {previewItem.type === 'request' && (
                <>
                  <div>
                    <h3 className="font-semibold mb-2">Richiesta</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{previewItem.data.title}</h4>
                        <Badge variant={getPriorityColor(previewItem.data.priority) as any}>
                          {previewItem.data.priority}
                        </Badge>
                      </div>
                      {previewItem.data.description && (
                        <div>
                          <p className="text-sm font-semibold mb-1">Descrizione:</p>
                          <p className="text-sm text-muted-foreground">{previewItem.data.description}</p>
                        </div>
                      )}
                      <p className="text-sm"><strong>Tipo:</strong> {previewItem.data.type}</p>
                      <p className="text-sm"><strong>Stato:</strong> {previewItem.data.status}</p>
                      {previewItem.data.due_date && (
                        <p className="text-sm"><strong>Scadenza:</strong> {format(new Date(previewItem.data.due_date), "PPP", { locale: it })}</p>
                      )}
                    </div>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={() => {
                      setIsPreviewOpen(false);
                      navigate(`/tasks?task=${previewItem.data.id}`);
                    }}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Vai alla Richiesta
                  </Button>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}