import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
  Plus,
  Receipt,
  Mail
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

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

export function DashboardPage() {
  const { user, profile, signOut } = useAuth();
  const [activities, setActivities] = useState<UserActivity[]>([]);
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
        .select(`
          *,
          opportunity:crm_deals(name)
        `)
        .eq("assigned_to", user.id)
        .eq("activity_type", "todo")
        .order("scheduled_date", { ascending: true, nullsFirst: false });

      if (activitiesError) throw activitiesError;

      // Load general requests assigned to user
      const { data: requestsData, error: requestsError } = await supabase
        .from("requests")
        .select("*")
        .eq("assigned_to", user.id)
        .neq("status", "completed")
        .order("due_date", { ascending: true, nullsFirst: false });

      if (requestsError) throw requestsError;

      setActivities((activitiesData as any) || []);
      setRequests(requestsData || []);
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

  const totalTasks = activities.length + requests.length;
  const urgentTasks = [
    ...activities.filter(a => a.scheduled_date && new Date(a.scheduled_date) < new Date(Date.now() + 24 * 60 * 60 * 1000)),
    ...requests.filter(r => r.priority === "high" || (r.due_date && new Date(r.due_date) < new Date(Date.now() + 24 * 60 * 60 * 1000)))
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
            {profile?.role || "User"}
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Attività Totali</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTasks}</div>
            <p className="text-xs text-muted-foreground">
              Attività e richieste assegnate
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
              Da completare entro 24h
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CRM</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activities.length}</div>
            <p className="text-xs text-muted-foreground">
              Attività CRM assegnate
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Richieste</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.length}</div>
            <p className="text-xs text-muted-foreground">
              Richieste varie assegnate
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CRM Activities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Attività CRM
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nessuna attività CRM assegnata
                </p>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium">{activity.title}</h4>
                        {activity.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {activity.description}
                          </p>
                        )}
                        {activity.opportunity?.name && (
                          <p className="text-sm text-blue-600 mt-1">
                            Opportunità: {activity.opportunity.name}
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
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* General Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Richieste Assegnate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {requests.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  Nessuna richiesta assegnata
                </p>
              ) : (
                requests.map((request) => (
                  <div key={request.id} className="p-3 border rounded-lg">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{request.title}</h4>
                          <Badge variant={getPriorityColor(request.priority) as any}>
                            {request.priority}
                          </Badge>
                        </div>
                        {request.description && (
                          <p className="text-sm text-muted-foreground mt-1">
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
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => markRequestCompleted(request.id)}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Funzioni Rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button variant="default" asChild>
              <a href="/finance/prima-nota">
                <Receipt className="w-4 h-4 mr-2" />
                Nuovo Movimento Prima Nota
              </a>
            </Button>
            <Button variant="default" asChild>
              <a href="/webmail">
                <Mail className="w-4 h-4 mr-2" />
                Email (v2)
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}