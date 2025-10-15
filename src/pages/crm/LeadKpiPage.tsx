import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, Clock, Target, Award, AlertCircle, Activity } from "lucide-react";
import { format, subDays, differenceInDays, differenceInHours } from "date-fns";
import { it } from "date-fns/locale";

interface LeadKPI {
  totalLeads: number;
  newLeadsLast30Days: number;
  conversionRate: number;
  avgLeadTime: number;
  avgTimeToNextActivity: number;
  wonDeals: number;
  lostDeals: number;
  totalValue: number;
}

interface SalesPerformance {
  userId: string;
  userName: string;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  avgResponseTime: number;
  totalValue: number;
}

interface LeadsByStatus {
  status: string;
  count: number;
}

interface LeadsByPipeline {
  pipeline: string;
  count: number;
  value: number;
}

interface LeadTimeline {
  date: string;
  newLeads: number;
  wonLeads: number;
  lostLeads: number;
}

interface ActivityLog {
  id: string;
  leadId: string;
  leadName: string;
  activityType: string;
  activityDate: string;
  assignedTo: string;
  assignedToName: string;
  status: string;
  notes: string;
  createdAt: string;
}

interface UserActivityStats {
  userId: string;
  userName: string;
  totalActivities: number;
  completedActivities: number;
  scheduledActivities: number;
  cancelledActivities: number;
  avgActivitiesPerDay: number;
  lastActivityDate: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const statusLabels: Record<string, string> = {
  'new': 'Nuovo',
  'qualified': 'Qualificato',
  'negotiation': 'Negoziazione',
  'won': 'Vinto',
  'lost': 'Perso'
};

const activityTypeLabels: Record<string, string> = {
  'call': 'Chiamata',
  'email': 'Email',
  'meeting': 'Incontro',
  'demo': 'Demo',
  'follow_up': 'Follow-up',
  'other': 'Altro'
};

const activityStatusLabels: Record<string, string> = {
  'scheduled': 'Programmata',
  'completed': 'Completata',
  'cancelled': 'Annullata'
};

export default function LeadKpiPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<LeadKPI>({
    totalLeads: 0,
    newLeadsLast30Days: 0,
    conversionRate: 0,
    avgLeadTime: 0,
    avgTimeToNextActivity: 0,
    wonDeals: 0,
    lostDeals: 0,
    totalValue: 0,
  });
  const [salesPerformance, setSalesPerformance] = useState<SalesPerformance[]>([]);
  const [leadsByStatus, setLeadsByStatus] = useState<LeadsByStatus[]>([]);
  const [leadsByPipeline, setLeadsByPipeline] = useState<LeadsByPipeline[]>([]);
  const [timeline, setTimeline] = useState<LeadTimeline[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [userActivityStats, setUserActivityStats] = useState<UserActivityStats[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch all leads
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('*');

      if (leadsError) throw leadsError;

      // Fetch profiles for sales users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name');

      if (profilesError) throw profilesError;

      // Fetch lead activities for response time calculation
      const { data: activities, error: activitiesError } = await supabase
        .from('lead_activities')
        .select(`
          id,
          lead_id,
          activity_type,
          activity_date,
          assigned_to,
          status,
          notes,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (activitiesError) throw activitiesError;

      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);

      // Calculate KPIs
      const totalLeads = leads?.length || 0;
      const newLeadsLast30Days = leads?.filter(l => 
        new Date(l.created_at) >= thirtyDaysAgo
      ).length || 0;
      
      const wonLeads = leads?.filter(l => l.status === 'won') || [];
      const lostLeads = leads?.filter(l => l.status === 'lost') || [];
      const wonDeals = wonLeads.length;
      const lostDeals = lostLeads.length;
      
      const totalDeals = wonDeals + lostDeals;
      const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
      
      const totalValue = wonLeads.reduce((sum, lead) => sum + (lead.value || 0), 0);

      // Calculate average lead time (from creation to won/lost)
      const closedLeads = [...wonLeads, ...lostLeads];
      const avgLeadTime = closedLeads.length > 0
        ? closedLeads.reduce((sum, lead) => {
            return sum + differenceInDays(new Date(lead.updated_at), new Date(lead.created_at));
          }, 0) / closedLeads.length
        : 0;

      // Calculate average time to next activity
      const leadsWithNextActivity = leads?.filter(l => l.next_activity_date) || [];
      const avgTimeToNextActivity = leadsWithNextActivity.length > 0
        ? leadsWithNextActivity.reduce((sum, lead) => {
            const activityDate = new Date(lead.next_activity_date);
            const hoursUntil = differenceInHours(activityDate, now);
            return sum + Math.abs(hoursUntil);
          }, 0) / leadsWithNextActivity.length
        : 0;

      setKpis({
        totalLeads,
        newLeadsLast30Days,
        conversionRate,
        avgLeadTime,
        avgTimeToNextActivity: avgTimeToNextActivity / 24, // Convert to days
        wonDeals,
        lostDeals,
        totalValue,
      });

      // Calculate sales performance by user
      const salesMap = new Map<string, SalesPerformance>();
      
      leads?.forEach(lead => {
        if (!lead.assigned_to) return;
        
        if (!salesMap.has(lead.assigned_to)) {
          const profile = profiles?.find(p => p.id === lead.assigned_to);
          const userName = profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown';
          salesMap.set(lead.assigned_to, {
            userId: lead.assigned_to,
            userName,
            totalLeads: 0,
            wonLeads: 0,
            lostLeads: 0,
            conversionRate: 0,
            avgResponseTime: 0,
            totalValue: 0,
          });
        }

        const performance = salesMap.get(lead.assigned_to)!;
        performance.totalLeads++;
        
        if (lead.status === 'won') {
          performance.wonLeads++;
          performance.totalValue += lead.value || 0;
        } else if (lead.status === 'lost') {
          performance.lostLeads++;
        }
      });

      // Calculate conversion rates and response times
      salesMap.forEach((performance, userId) => {
        const totalClosed = performance.wonLeads + performance.lostLeads;
        performance.conversionRate = totalClosed > 0 
          ? (performance.wonLeads / totalClosed) * 100 
          : 0;

        // Calculate average response time
        const userActivities = activities?.filter(a => a.assigned_to === userId) || [];
        if (userActivities.length > 0) {
          const totalResponseTime = userActivities.reduce((sum, activity) => {
            const lead = leads?.find(l => l.id === activity.lead_id);
            if (!lead) return sum;
            return sum + differenceInHours(
              new Date(activity.created_at), 
              new Date(lead.created_at)
            );
          }, 0);
          performance.avgResponseTime = totalResponseTime / userActivities.length;
        }
      });

      setSalesPerformance(Array.from(salesMap.values()));

      // Leads by status
      const statusMap = new Map<string, number>();
      leads?.forEach(lead => {
        const count = statusMap.get(lead.status || 'new') || 0;
        statusMap.set(lead.status || 'new', count + 1);
      });
      setLeadsByStatus(
        Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))
      );

      // Leads by pipeline
      const pipelineMap = new Map<string, { count: number; value: number }>();
      leads?.forEach(lead => {
        const pipeline = lead.pipeline || 'Nessuna Pipeline';
        const current = pipelineMap.get(pipeline) || { count: 0, value: 0 };
        pipelineMap.set(pipeline, {
          count: current.count + 1,
          value: current.value + (lead.value || 0),
        });
      });
      setLeadsByPipeline(
        Array.from(pipelineMap.entries()).map(([pipeline, data]) => ({
          pipeline,
          count: data.count,
          value: data.value,
        }))
      );

      // Timeline data (last 30 days)
      const timelineMap = new Map<string, LeadTimeline>();
      for (let i = 29; i >= 0; i--) {
        const date = format(subDays(now, i), 'dd/MM', { locale: it });
        timelineMap.set(date, { date, newLeads: 0, wonLeads: 0, lostLeads: 0 });
      }

      leads?.forEach(lead => {
        const createdDate = new Date(lead.created_at);
        if (createdDate >= thirtyDaysAgo) {
          const dateKey = format(createdDate, 'dd/MM', { locale: it });
          const timeline = timelineMap.get(dateKey);
          if (timeline) {
            timeline.newLeads++;
            if (lead.status === 'won') timeline.wonLeads++;
            if (lead.status === 'lost') timeline.lostLeads++;
          }
        }
      });

      setTimeline(Array.from(timelineMap.values()));

      // Process activity logs
      const activityLogsData: ActivityLog[] = (activities || []).map(activity => {
        const lead = leads?.find(l => l.id === activity.lead_id);
        const assignedProfile = profiles?.find(p => p.id === activity.assigned_to);
        const assignedToName = assignedProfile 
          ? `${assignedProfile.first_name || ''} ${assignedProfile.last_name || ''}`.trim() || 'Non assegnato'
          : 'Non assegnato';

        return {
          id: activity.id,
          leadId: activity.lead_id,
          leadName: lead?.company_name || 'Lead eliminato',
          activityType: activity.activity_type,
          activityDate: activity.activity_date,
          assignedTo: activity.assigned_to || '',
          assignedToName,
          status: activity.status || 'scheduled',
          notes: activity.notes || '',
          createdAt: activity.created_at,
        };
      });

      setActivityLogs(activityLogsData);

      // Calculate user activity stats
      const userStatsMap = new Map<string, UserActivityStats>();
      
      activityLogsData.forEach(activity => {
        if (!activity.assignedTo) return;

        if (!userStatsMap.has(activity.assignedTo)) {
          userStatsMap.set(activity.assignedTo, {
            userId: activity.assignedTo,
            userName: activity.assignedToName,
            totalActivities: 0,
            completedActivities: 0,
            scheduledActivities: 0,
            cancelledActivities: 0,
            avgActivitiesPerDay: 0,
            lastActivityDate: activity.createdAt,
          });
        }

        const stats = userStatsMap.get(activity.assignedTo)!;
        stats.totalActivities++;
        
        if (activity.status === 'completed') stats.completedActivities++;
        else if (activity.status === 'scheduled') stats.scheduledActivities++;
        else if (activity.status === 'cancelled') stats.cancelledActivities++;

        // Update last activity date
        if (new Date(activity.createdAt) > new Date(stats.lastActivityDate)) {
          stats.lastActivityDate = activity.createdAt;
        }
      });

      // Calculate average activities per day
      userStatsMap.forEach(stats => {
        const userActivities = activityLogsData.filter(a => a.assignedTo === stats.userId);
        if (userActivities.length > 0) {
          const oldestActivity = userActivities[userActivities.length - 1];
          const daysSinceFirst = differenceInDays(now, new Date(oldestActivity.createdAt)) || 1;
          stats.avgActivitiesPerDay = stats.totalActivities / daysSinceFirst;
        }
      });

      setUserActivityStats(Array.from(userStatsMap.values()));

    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati KPI",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Caricamento KPI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Lead KPI Dashboard</h1>
          <p className="text-muted-foreground">
            Monitoraggio performance e metriche dei lead
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Lead</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.totalLeads}</div>
            <p className="text-xs text-muted-foreground">
              +{kpis.newLeadsLast30Days} negli ultimi 30 giorni
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasso di Conversione</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {kpis.wonDeals} vinti / {kpis.wonDeals + kpis.lostDeals} chiusi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead Time Medio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgLeadTime.toFixed(0)} giorni</div>
            <p className="text-xs text-muted-foreground">
              Dal lead alla chiusura
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valore Totale Vinto</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{kpis.totalValue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Da {kpis.wonDeals} deal vinti
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Panoramica</TabsTrigger>
          <TabsTrigger value="sales">Performance Sales</TabsTrigger>
          <TabsTrigger value="activities">Log Attività</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Lead per Status</CardTitle>
                <CardDescription>Distribuzione lead per stato</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={leadsByStatus}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ status, count }) => `${statusLabels[status] || status}: ${count}`}
                    >
                      {leadsByStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Lead per Pipeline</CardTitle>
                <CardDescription>Distribuzione lead per pipeline</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={leadsByPipeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="pipeline" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="count" fill="#0088FE" name="Numero Lead" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 mb-4">
            {userActivityStats.map(stats => (
              <Card key={stats.userId}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stats.userName}</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalActivities}</div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      ✓ {stats.completedActivities} Completate
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      ⏰ {stats.scheduledActivities} Programmate
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Media: {stats.avgActivitiesPerDay.toFixed(1)} attività/giorno
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ultima: {format(new Date(stats.lastActivityDate), 'dd/MM/yyyy HH:mm', { locale: it })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Log Attività Recenti</CardTitle>
              <CardDescription>Ultimi 100 log di attività su lead</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Assegnato a</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activityLogs.slice(0, 100).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.activityDate), 'dd/MM/yyyy HH:mm', { locale: it })}
                      </TableCell>
                      <TableCell className="font-medium">{log.leadName}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {activityTypeLabels[log.activityType] || log.activityType}
                        </Badge>
                      </TableCell>
                      <TableCell>{log.assignedToName}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            log.status === 'completed' ? 'default' : 
                            log.status === 'cancelled' ? 'destructive' : 
                            'secondary'
                          }
                        >
                          {activityStatusLabels[log.status] || log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                  {activityLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessuna attività registrata
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance per Sales</CardTitle>
              <CardDescription>Confronto performance venditori</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={salesPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="userName" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="totalLeads" fill="#8884d8" name="Totale Lead" />
                  <Bar dataKey="wonLeads" fill="#00C49F" name="Lead Vinti" />
                  <Bar dataKey="lostLeads" fill="#FF8042" name="Lead Persi" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Tasso di Conversione per Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" />
                    <YAxis />
                    <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
                    <Bar dataKey="conversionRate" fill="#00C49F" name="Tasso Conversione %" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Valore Totale per Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={salesPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="userName" />
                    <YAxis />
                    <Tooltip formatter={(value) => `€${Number(value).toLocaleString()}`} />
                    <Bar dataKey="totalValue" fill="#FFBB28" name="Valore Totale €" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trend Lead Ultimi 30 Giorni</CardTitle>
              <CardDescription>Andamento creazione e chiusura lead</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={timeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="newLeads" stroke="#0088FE" name="Nuovi Lead" />
                  <Line type="monotone" dataKey="wonLeads" stroke="#00C49F" name="Lead Vinti" />
                  <Line type="monotone" dataKey="lostLeads" stroke="#FF8042" name="Lead Persi" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
