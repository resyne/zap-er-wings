import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  ShoppingCart, 
  Wrench, 
  Truck, 
  Users, 
  TrendingUp,
  Plus,
  FileText,
  CheckSquare,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { NewRfqDialog } from "@/components/dashboard/NewRfqDialog";
import { NewOrderDialog } from "@/components/dashboard/NewOrderDialog";
import { NewTaskDialog } from "@/components/dashboard/NewTaskDialog";

interface DashboardKPIs {
  salesOrders: { draft: number; inProgress: number };
  workOrders: { planned: number; inProgress: number };
  serviceOrders: { planned: number; inProgress: number };
  shippingOrders: { inPreparazione: number; inProgress: number };
  newLeads: number;
  negotiationLeads: number;
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  due_date?: string;
  assigned_to?: string;
  category?: string;
}

export function DirectionalDashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPIs>({
    salesOrders: { draft: 0, inProgress: 0 },
    workOrders: { planned: 0, inProgress: 0 },
    serviceOrders: { planned: 0, inProgress: 0 },
    shippingOrders: { inPreparazione: 0, inProgress: 0 },
    newLeads: 0,
    negotiationLeads: 0,
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRfqDialog, setShowRfqDialog] = useState(false);
  const [showOrderDialog, setShowOrderDialog] = useState(false);
  const [showTaskDialog, setShowTaskDialog] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load Sales Orders
      const { data: salesOrdersData } = await supabase
        .from("sales_orders")
        .select("status");

      // Load Work Orders (Production)
      const { data: workOrdersData } = await supabase
        .from("work_orders")
        .select("status");

      // Load Service Work Orders
      const { data: serviceOrdersData } = await supabase
        .from("service_work_orders")
        .select("status");

      // Load Shipping Orders
      const { data: shippingOrdersData } = await supabase
        .from("shipping_orders")
        .select("status");

      // Load Leads
      const { data: leadsData } = await supabase
        .from("leads")
        .select("status");

      // Load Tasks in progress
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("status", "in_progress")
        .order("due_date", { ascending: true, nullsFirst: false });

      // Calculate KPIs
      setKpis({
        salesOrders: {
          draft: salesOrdersData?.filter(o => o.status === "draft").length || 0,
          inProgress: salesOrdersData?.filter(o => o.status === "in_progress").length || 0,
        },
        workOrders: {
          planned: workOrdersData?.filter(o => o.status === "planned").length || 0,
          inProgress: workOrdersData?.filter(o => o.status === "in_progress").length || 0,
        },
        serviceOrders: {
          planned: serviceOrdersData?.filter(o => o.status === "planned").length || 0,
          inProgress: serviceOrdersData?.filter(o => o.status === "in_progress").length || 0,
        },
        shippingOrders: {
          inPreparazione: shippingOrdersData?.filter(o => o.status === "in_preparazione").length || 0,
          inProgress: shippingOrdersData?.filter(o => o.status === "in_progress").length || 0,
        },
        newLeads: leadsData?.filter(l => l.status === "new").length || 0,
        negotiationLeads: leadsData?.filter(l => ["qualified", "proposal"].includes(l.status)).length || 0,
      });

      setTasks(tasksData || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "medium": return "default";
      case "low": return "secondary";
      default: return "outline";
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard Direzionale</h1>
        <p className="text-muted-foreground">
          Panoramica generale delle attività aziendali
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Sales Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini di Vendita</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bozza</span>
                <span className="text-2xl font-bold">{kpis.salesOrders.draft}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Corso</span>
                <span className="text-2xl font-bold text-blue-600">{kpis.salesOrders.inProgress}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Production Work Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini di Produzione</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pianificati</span>
                <span className="text-2xl font-bold">{kpis.workOrders.planned}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Corso</span>
                <span className="text-2xl font-bold text-orange-600">{kpis.workOrders.inProgress}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Service Work Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini di Lavoro</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pianificati</span>
                <span className="text-2xl font-bold">{kpis.serviceOrders.planned}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Corso</span>
                <span className="text-2xl font-bold text-purple-600">{kpis.serviceOrders.inProgress}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shipping Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ordini di Spedizione</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Preparazione</span>
                <span className="text-2xl font-bold">{kpis.shippingOrders.inPreparazione}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Corso</span>
                <span className="text-2xl font-bold text-green-600">{kpis.shippingOrders.inProgress}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* New Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Nuovi Lead</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.newLeads}</div>
            <p className="text-xs text-muted-foreground">
              Da qualificare
            </p>
          </CardContent>
        </Card>

        {/* Leads in Negotiation */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lead in Negoziazione</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{kpis.negotiationLeads}</div>
            <p className="text-xs text-muted-foreground">
              Qualificati e in proposta
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Azioni Rapide
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button onClick={() => setShowRfqDialog(true)}>
              <FileText className="w-4 h-4 mr-2" />
              Nuova Richiesta di Offerta
            </Button>
            <Button onClick={() => setShowOrderDialog(true)} variant="secondary">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Nuovo Ordine
            </Button>
            <Button onClick={() => setShowTaskDialog(true)} variant="outline">
              <CheckSquare className="w-4 h-4 mr-2" />
              Nuova Task
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tasks in Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5" />
            Task in Corso ({tasks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                Nessuna task in corso
              </p>
            ) : (
              tasks.map((task) => (
                <div key={task.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{task.title}</h4>
                        {task.priority && (
                          <Badge variant={getPriorityColor(task.priority) as any} className="text-xs">
                            {task.priority}
                          </Badge>
                        )}
                        {task.category && (
                          <Badge variant="outline" className="text-xs">
                            {task.category}
                          </Badge>
                        )}
                      </div>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {task.description}
                        </p>
                      )}
                      {task.due_date && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          Scadenza: {format(new Date(task.due_date), "dd MMM yyyy", { locale: it })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <NewRfqDialog open={showRfqDialog} onOpenChange={setShowRfqDialog} onSuccess={loadDashboardData} />
      <NewOrderDialog open={showOrderDialog} onOpenChange={setShowOrderDialog} onSuccess={loadDashboardData} />
      <NewTaskDialog open={showTaskDialog} onOpenChange={setShowTaskDialog} onSuccess={loadDashboardData} />
    </div>
  );
}
