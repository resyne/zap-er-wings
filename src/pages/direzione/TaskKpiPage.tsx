import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, CheckCircle2, Clock, AlertCircle, TrendingUp, Calendar } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface TaskKPI {
  total: number;
  completed: number;
  in_progress: number;
  overdue: number;
  completion_rate: number;
}

interface UserTaskStats {
  user_id: string;
  user_name: string;
  total_tasks: number;
  completed_tasks: number;
  in_progress_tasks: number;
  overdue_tasks: number;
  completion_rate: number;
}

interface RecentTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  assigned_to: string;
  assigned_name: string;
  due_date: string | null;
  completed_at: string | null;
}

export default function TaskKpiPage() {
  const [kpis, setKpis] = useState<TaskKPI>({
    total: 0,
    completed: 0,
    in_progress: 0,
    overdue: 0,
    completion_rate: 0,
  });
  const [userStats, setUserStats] = useState<UserTaskStats[]>([]);
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadKPIs();
  }, []);

  const loadKPIs = async () => {
    setLoading(true);
    try {
      // Carica tutte le task non template
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_template", false);

      if (tasksError) throw tasksError;

      // Calcola KPI globali
      const total = tasks?.length || 0;
      const completed = tasks?.filter(t => t.status === "completed").length || 0;
      const in_progress = tasks?.filter(t => t.status === "in_progress").length || 0;
      const overdue = tasks?.filter(t => {
        if (t.status === "completed") return false;
        if (!t.due_date) return false;
        return new Date(t.due_date) < new Date();
      }).length || 0;
      const completion_rate = total > 0 ? (completed / total) * 100 : 0;

      setKpis({
        total,
        completed,
        in_progress,
        overdue,
        completion_rate,
      });

      // Carica profili utenti
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name");

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Calcola statistiche per utente
      const userStatsMap = new Map<string, UserTaskStats>();
      
      tasks?.forEach(task => {
        if (!task.assigned_to) return;
        
        const userId = task.assigned_to;
        const profile = profilesMap.get(userId);
        const userName = profile 
          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
          : "Utente Sconosciuto";

        if (!userStatsMap.has(userId)) {
          userStatsMap.set(userId, {
            user_id: userId,
            user_name: userName,
            total_tasks: 0,
            completed_tasks: 0,
            in_progress_tasks: 0,
            overdue_tasks: 0,
            completion_rate: 0,
          });
        }

        const stats = userStatsMap.get(userId)!;
        stats.total_tasks++;
        
        if (task.status === "completed") {
          stats.completed_tasks++;
        } else if (task.status === "in_progress") {
          stats.in_progress_tasks++;
        }

        if (task.status !== "completed" && task.due_date && new Date(task.due_date) < new Date()) {
          stats.overdue_tasks++;
        }
      });

      // Calcola completion rate per utente
      userStatsMap.forEach(stats => {
        stats.completion_rate = stats.total_tasks > 0 
          ? (stats.completed_tasks / stats.total_tasks) * 100 
          : 0;
      });

      setUserStats(Array.from(userStatsMap.values()).sort((a, b) => b.total_tasks - a.total_tasks));

      // Carica task recenti
      const { data: recent, error: recentError } = await supabase
        .from("tasks")
        .select("id, title, status, priority, assigned_to, due_date, completed_at")
        .eq("is_template", false)
        .order("updated_at", { ascending: false })
        .limit(10);

      if (recentError) throw recentError;

      setRecentTasks(recent?.map(t => {
        const profile = profilesMap.get(t.assigned_to);
        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assigned_to: t.assigned_to,
          assigned_name: profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : "Non assegnato",
          due_date: t.due_date,
          completed_at: t.completed_at,
        };
      }) || []);

    } catch (error) {
      console.error("Error loading task KPIs:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "to_do": { label: "Da Fare", variant: "outline" },
      "in_progress": { label: "In Corso", variant: "default" },
      "completed": { label: "Completato", variant: "secondary" },
      "cancelled": { label: "Annullato", variant: "destructive" },
    };

    const config = statusConfig[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "low": { label: "Bassa", variant: "outline" },
      "medium": { label: "Media", variant: "default" },
      "high": { label: "Alta", variant: "destructive" },
    };

    const config = priorityConfig[priority] || { label: priority, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento KPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Task KPI</h1>
          <p className="text-muted-foreground">Monitora le performance e i risultati delle task assegnate</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Task Totali</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpis.completed}</div>
            <p className="text-xs text-muted-foreground">
              {kpis.completion_rate.toFixed(1)}% del totale
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Corso</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpis.in_progress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Scadenza</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{kpis.overdue}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso Completamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.completion_rate.toFixed(1)}%</div>
          </CardContent>
        </Card>
      </div>

      {/* User Stats Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Statistiche per Utente
          </CardTitle>
          <CardDescription>Performance delle task assegnate a ciascun utente</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Utente</TableHead>
                <TableHead className="text-center">Task Totali</TableHead>
                <TableHead className="text-center">Completate</TableHead>
                <TableHead className="text-center">In Corso</TableHead>
                <TableHead className="text-center">In Scadenza</TableHead>
                <TableHead className="text-center">% Completamento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userStats.map((stat) => (
                <TableRow key={stat.user_id}>
                  <TableCell className="font-medium">{stat.user_name}</TableCell>
                  <TableCell className="text-center">{stat.total_tasks}</TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-600 font-semibold">{stat.completed_tasks}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-blue-600 font-semibold">{stat.in_progress_tasks}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={stat.overdue_tasks > 0 ? "text-red-600 font-semibold" : ""}>
                      {stat.overdue_tasks}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={stat.completion_rate >= 75 ? "secondary" : stat.completion_rate >= 50 ? "default" : "destructive"}>
                      {stat.completion_rate.toFixed(1)}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Tasks */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Task Recenti
          </CardTitle>
          <CardDescription>Ultime task aggiornate nel sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titolo</TableHead>
                <TableHead>Assegnato a</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Priorità</TableHead>
                <TableHead>Scadenza</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.assigned_name}</TableCell>
                  <TableCell>{getStatusBadge(task.status)}</TableCell>
                  <TableCell>{getPriorityBadge(task.priority)}</TableCell>
                  <TableCell>
                    {task.due_date ? format(new Date(task.due_date), "dd MMM yyyy", { locale: it }) : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
