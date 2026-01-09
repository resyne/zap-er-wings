import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, TrendingUp, Clock, Target, Award, AlertCircle, Activity, Filter, Phone } from "lucide-react";
import { format, subDays, differenceInDays, differenceInHours, startOfDay, startOfWeek, startOfMonth, endOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { useHideAmounts } from "@/hooks/useHideAmounts";
import { formatAmount } from "@/lib/formatAmount";
import JessyActivityLog from "@/components/crm/JessyActivityLog";

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

interface UserCallStats {
  userId: string;
  userName: string;
  callsToday: number;
  callsThisWeek: number;
  callsThisMonth: number;
  totalCalls: number;
  avgCallsPerDay: number;
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
  isAI?: boolean;
  aiActionType?: string;
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
  'other': 'Altro',
  'ai_action': 'Azione AI'
};

const aiActionLabels: Record<string, string> = {
  'get_leads': 'Consultazione Lead',
  'create_lead': 'Creazione Lead',
  'update_lead': 'Aggiornamento Lead',
  'get_customers': 'Consultazione Clienti',
  'create_customer': 'Creazione Cliente',
  'get_offers': 'Consultazione Offerte',
  'get_cost_drafts': 'Consultazione Preventivi'
};

const activityStatusLabels: Record<string, string> = {
  'scheduled': 'Programmata',
  'completed': 'Completata',
  'cancelled': 'Annullata'
};

export default function LeadKpiPage() {
  const { toast } = useToast();
  const { hideAmounts } = useHideAmounts();
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
  const [userCallStats, setUserCallStats] = useState<UserCallStats[]>([]);
  const [activityFilter, setActivityFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const getFilteredActivityLogs = () => {
    const now = new Date();
    let startDate: Date;

    switch (activityFilter) {
      case 'today':
        startDate = startOfDay(now);
        break;
      case 'week':
        startDate = startOfWeek(now, { weekStartsOn: 1 }); // Lunedì
        break;
      case 'month':
        startDate = startOfMonth(now);
        break;
      case 'all':
        return activityLogs;
      default:
        startDate = startOfWeek(now, { weekStartsOn: 1 });
    }

    return activityLogs.filter(log => {
      const logDate = new Date(log.activityDate);
      return logDate >= startDate && logDate <= endOfDay(now);
    });
  };

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

      // Fetch AI activity logs
      const { data: aiLogs, error: aiLogsError } = await supabase
        .from('ai_activity_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (aiLogsError) throw aiLogsError;

      // Fetch call records for call statistics
      const { data: callRecords, error: callRecordsError } = await supabase
        .from('call_records')
        .select('id, operator_id, operator_name, call_date, duration_seconds, extension_number')
        .order('call_date', { ascending: false });

      if (callRecordsError) throw callRecordsError;

      // Fetch phone extensions to map calls without operator_id
      const { data: phoneExtensions, error: phoneExtensionsError } = await supabase
        .from('phone_extensions')
        .select('extension_number, operator_name, user_id');

      if (phoneExtensionsError) throw phoneExtensionsError;

      const now = new Date();
      const thirtyDaysAgo = subDays(now, 30);
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const monthStart = startOfMonth(now);

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
          isAI: false,
        };
      });

      // Process AI activity logs and add them
      const aiActivityLogsData: ActivityLog[] = (aiLogs || [])
        .filter(log => log.entity_type === 'lead' || log.action_type.includes('lead'))
        .map(log => {
          const userProfile = profiles?.find(p => p.id === log.user_id);
          const userName = userProfile 
            ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() || 'Utente'
            : 'Utente';
          
          let leadName = 'Lead';
          if (log.entity_id && log.entity_type === 'lead') {
            const lead = leads?.find(l => l.id === log.entity_id);
            leadName = lead?.company_name || 'Lead';
          }

          return {
            id: log.id,
            leadId: log.entity_id || '',
            leadName,
            activityType: 'ai_action',
            activityDate: log.created_at,
            assignedTo: log.user_id || '',
            assignedToName: userName,
            status: log.success ? 'completed' : 'cancelled',
            notes: log.action_description || log.request_summary,
            createdAt: log.created_at,
            isAI: true,
            aiActionType: log.action_type,
          };
        });

      // Combine and sort all activity logs
      const combinedLogs = [...activityLogsData, ...aiActivityLogsData].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setActivityLogs(combinedLogs);

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

      // Calculate user call statistics
      const callStatsMap = new Map<string, UserCallStats>();
      
      callRecords?.forEach(call => {
        // Determine operator from operator_id or extension_number
        let operatorId = call.operator_id;
        let operatorName = call.operator_name;
        
        // If no operator_id, try to find operator from extension_number
        if (!operatorId && call.extension_number) {
          const extension = phoneExtensions?.find(ext => ext.extension_number === call.extension_number);
          if (extension) {
            operatorId = extension.user_id;
            operatorName = extension.operator_name;
          }
        }
        
        if (!operatorId) return;

        if (!callStatsMap.has(operatorId)) {
          const profile = profiles?.find(p => p.id === operatorId);
          const userName = profile 
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || operatorName || 'Unknown'
            : operatorName || 'Unknown';
          
          callStatsMap.set(operatorId, {
            userId: operatorId,
            userName,
            callsToday: 0,
            callsThisWeek: 0,
            callsThisMonth: 0,
            totalCalls: 0,
            avgCallsPerDay: 0,
          });
        }

        const stats = callStatsMap.get(operatorId)!;
        const callDate = new Date(call.call_date);
        
        stats.totalCalls++;
        
        if (callDate >= todayStart) {
          stats.callsToday++;
        }
        if (callDate >= weekStart) {
          stats.callsThisWeek++;
        }
        if (callDate >= monthStart) {
          stats.callsThisMonth++;
        }
      });

      // Calculate average calls per day for each user
      callStatsMap.forEach(stats => {
        // Filter calls for this user considering both operator_id and extension mapping
        const userCalls = callRecords?.filter(c => {
          if (c.operator_id === stats.userId) return true;
          if (!c.operator_id && c.extension_number) {
            const ext = phoneExtensions?.find(e => e.extension_number === c.extension_number);
            return ext?.user_id === stats.userId;
          }
          return false;
        }) || [];
        
        if (userCalls.length > 0) {
          const dates = userCalls.map(c => new Date(c.call_date));
          const oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
          const daysSinceFirst = Math.max(differenceInDays(now, oldestDate), 1);
          stats.avgCallsPerDay = stats.totalCalls / daysSinceFirst;
        }
      });

      setUserCallStats(Array.from(callStatsMap.values()));

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
            <div className="text-2xl font-bold">{formatAmount(kpis.totalValue, hideAmounts)}</div>
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
          <TabsTrigger value="jessy">JESSY AI</TabsTrigger>
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
          <div className="flex items-center gap-4 mb-4">
            <Filter className="h-5 w-5 text-muted-foreground" />
            <Select value={activityFilter} onValueChange={(value: any) => setActivityFilter(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtra per periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Oggi</SelectItem>
                <SelectItem value="week">Questa Settimana</SelectItem>
                <SelectItem value="month">Questo Mese</SelectItem>
                <SelectItem value="all">Tutto</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {getFilteredActivityLogs().length} attività trovate
            </span>
          </div>

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
              <CardTitle>Log Attività</CardTitle>
              <CardDescription>
                {activityFilter === 'today' && 'Attività di oggi'}
                {activityFilter === 'week' && 'Attività di questa settimana'}
                {activityFilter === 'month' && 'Attività di questo mese'}
                {activityFilter === 'all' && 'Tutte le attività'}
              </CardDescription>
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
                  {getFilteredActivityLogs().map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.activityDate), 'dd/MM/yyyy HH:mm', { locale: it })}
                      </TableCell>
                      <TableCell className="font-medium">{log.leadName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={log.isAI ? 'bg-purple-500/10 text-purple-600 border-purple-500/20' : ''}>
                          {log.isAI && log.aiActionType 
                            ? aiActionLabels[log.aiActionType] || log.aiActionType
                            : activityTypeLabels[log.activityType] || log.activityType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {log.isAI ? (
                          <span className="flex items-center gap-1">
                            {log.assignedToName} <span className="text-xs text-muted-foreground">→ JESSY</span>
                          </span>
                        ) : (
                          log.assignedToName
                        )}
                      </TableCell>
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
                  {getFilteredActivityLogs().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessuna attività trovata per il periodo selezionato
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          {/* Filtro periodo */}
          <div className="flex items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center gap-3">
              <Filter className="h-5 w-5 text-muted-foreground" />
              <Select value={activityFilter} onValueChange={(value: any) => setActivityFilter(value)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtra per periodo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Oggi</SelectItem>
                  <SelectItem value="week">Questa Settimana</SelectItem>
                  <SelectItem value="month">Questo Mese</SelectItem>
                  <SelectItem value="all">Tutto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {activityFilter === 'today' && '📅 Attività di oggi'}
              {activityFilter === 'week' && '📅 Attività di questa settimana'}
              {activityFilter === 'month' && '📅 Attività di questo mese'}
              {activityFilter === 'all' && '📅 Tutte le attività'}
            </span>
          </div>

          {/* Statistiche Chiamate per Utente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Statistiche Chiamate per Utente
              </CardTitle>
              <CardDescription>
                Numero di chiamate effettuate per giorno, settimana e mese
              </CardDescription>
            </CardHeader>
            <CardContent>
              {userCallStats.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Utente</TableHead>
                      <TableHead className="text-center">Oggi</TableHead>
                      <TableHead className="text-center">Questa Settimana</TableHead>
                      <TableHead className="text-center">Questo Mese</TableHead>
                      <TableHead className="text-center">Totale</TableHead>
                      <TableHead className="text-center">Media/Giorno</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userCallStats.map((stats) => (
                      <TableRow key={stats.userId}>
                        <TableCell className="font-medium">{stats.userName}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20">
                            {stats.callsToday}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-green-500/10 border-green-500/20">
                            {stats.callsThisWeek}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className="bg-orange-500/10 border-orange-500/20">
                            {stats.callsThisMonth}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-semibold">{stats.totalCalls}</TableCell>
                        <TableCell className="text-center text-muted-foreground">
                          {stats.avgCallsPerDay.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nessuna statistica chiamate disponibile
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card statistiche attività utenti */}
          <div className="grid gap-4 md:grid-cols-3">
            {salesPerformance.map(user => {
              const userActivities = getFilteredActivityLogs().filter(
                log => log.assignedTo === user.userId
              );
              const completedCount = userActivities.filter(a => a.status === 'completed').length;
              const scheduledCount = userActivities.filter(a => a.status === 'scheduled').length;
              const userCalls = userCallStats.find(s => s.userId === user.userId);
              
              return (
                <Card key={user.userId} className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{user.userName}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          {userActivities.length} {userActivities.length === 1 ? 'attività' : 'attività'}
                        </CardDescription>
                      </div>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="text-3xl font-bold">{userActivities.length}</div>
                    
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="text-xs bg-green-500/10 border-green-500/20">
                        ✓ {completedCount} Completate
                      </Badge>
                      <Badge variant="outline" className="text-xs bg-orange-500/10 border-orange-500/20">
                        ⏰ {scheduledCount} Programmate
                      </Badge>
                    </div>

                    {userCalls && userCalls.totalCalls > 0 && (
                      <div className="pt-2 border-t">
                        <div className="flex items-center gap-1 mb-1.5">
                          <Phone className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs font-medium text-muted-foreground">Chiamate</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary" className="text-xs">
                            Oggi: {userCalls.callsToday}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Sett: {userCalls.callsThisWeek}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Mese: {userCalls.callsThisMonth}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t space-y-1">
                      <div className="text-xs text-muted-foreground">
                        Media: <span className="font-medium text-foreground">{userActivityStats.find(s => s.userId === user.userId)?.avgActivitiesPerDay.toFixed(1) || 0} attività/giorno</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ultima: <span className="font-medium text-foreground">
                          {userActivityStats.find(s => s.userId === user.userId)?.lastActivityDate 
                            ? format(new Date(userActivityStats.find(s => s.userId === user.userId)!.lastActivityDate), 'dd/MM/yyyy HH:mm', { locale: it })
                            : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Sezione Log Attività */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <h3 className="text-lg font-semibold text-muted-foreground">Log Attività</h3>
              <div className="h-px flex-1 bg-border" />
            </div>
            
            <p className="text-sm text-muted-foreground text-center">
              {getFilteredActivityLogs().length} {getFilteredActivityLogs().length === 1 ? 'attività trovata' : 'attività trovate'}
            </p>

            {salesPerformance.map(user => {
              const userActivities = getFilteredActivityLogs().filter(
                log => log.assignedTo === user.userId
              );
              
              if (userActivities.length === 0) return null;

              return (
                <Card key={user.userId} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{user.userName}</CardTitle>
                        <CardDescription className="mt-1">
                          {userActivities.length} {userActivities.length === 1 ? 'attività' : 'attività'} nel periodo selezionato
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-green-500/10 border-green-500/30">
                          ✓ {user.wonLeads} Vinti
                        </Badge>
                        <Badge variant="outline" className="bg-red-500/10 border-red-500/30">
                          ✗ {user.lostLeads} Persi
                        </Badge>
                        <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30">
                          📊 {user.conversionRate.toFixed(1)}% Conv.
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[130px]">Data/Ora</TableHead>
                            <TableHead className="min-w-[180px]">Lead</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Stato</TableHead>
                            <TableHead className="min-w-[200px]">Note</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {userActivities.map(log => (
                            <TableRow key={log.id} className="hover:bg-muted/30">
                              <TableCell className="font-mono text-xs whitespace-nowrap">
                                {format(new Date(log.activityDate), 'dd/MM/yyyy HH:mm', { locale: it })}
                              </TableCell>
                              <TableCell className="font-medium">{log.leadName}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {log.isAI && log.aiActionType
                                    ? aiActionLabels[log.aiActionType] || log.aiActionType
                                    : activityTypeLabels[log.activityType] || log.activityType}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    log.status === 'completed'
                                      ? 'default'
                                      : log.status === 'cancelled'
                                      ? 'destructive'
                                      : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {activityStatusLabels[log.status] || log.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs text-sm">
                                <div className="truncate" title={log.notes}>
                                  {log.notes}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {salesPerformance.every(user => 
              getFilteredActivityLogs().filter(log => log.assignedTo === user.userId).length === 0
            ) && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nessuna attività trovata per il periodo selezionato
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jessy" className="space-y-4">
          <JessyActivityLog />
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
