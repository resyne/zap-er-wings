import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  Package, 
  Wrench, 
  Truck, 
  ShoppingCart,
  Users,
  TrendingUp,
  Plus,
  FileText,
  CheckSquare
} from "lucide-react";
import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface DashboardKPI {
  salesOrders: number;
  workOrders: number;
  serviceOrders: number;
  shippingOrders: number;
  newLeads: number;
  negotiationLeads: number;
}

interface Task {
  id: string;
  title: string;
  status: string;
  category: string;
  due_date?: string;
}

export function DashboardPage() {
  const [kpis, setKpis] = useState<DashboardKPI>({
    salesOrders: 0,
    workOrders: 0,
    serviceOrders: 0,
    shippingOrders: 0,
    newLeads: 0,
    negotiationLeads: 0
  });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState<'rfq' | 'order' | 'task' | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load KPIs
      const [salesOrdersRes, workOrdersRes, serviceOrdersRes, shippingOrdersRes, leadsRes, tasksRes] = await Promise.all([
        supabase.from("sales_orders").select("id", { count: 'exact' }).in('status', ['draft', 'in_progress']),
        supabase.from("work_orders").select("id", { count: 'exact' }).in('status', ['planned', 'in_progress']),
        supabase.from("service_work_orders").select("id", { count: 'exact' }).in('status', ['planned', 'in_progress']),
        supabase.from("shipping_orders").select("id", { count: 'exact' }).in('status', ['in_preparazione', 'in_progress']),
        supabase.from("leads").select("id, status", { count: 'exact' }),
        supabase.from("tasks").select("*").eq('status', 'in_progress').order('due_date', { ascending: true }).limit(10)
      ]);

      const newLeads = leadsRes.data?.filter(l => l.status === 'new').length || 0;
      const negotiationLeads = leadsRes.data?.filter(l => l.status === 'qualified' || l.status === 'proposal').length || 0;

      setKpis({
        salesOrders: salesOrdersRes.count || 0,
        workOrders: workOrdersRes.count || 0,
        serviceOrders: serviceOrdersRes.count || 0,
        shippingOrders: shippingOrdersRes.count || 0,
        newLeads,
        negotiationLeads
      });

      setTasks(tasksRes.data || []);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
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

  const kpiCards = [
    {
      title: "Ordini in Corso",
      value: kpis.salesOrders,
      icon: ShoppingCart,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      link: "/crm/orders"
    },
    {
      title: "Ordini di Produzione",
      value: kpis.workOrders,
      icon: Wrench,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      link: "/mfg/work-orders"
    },
    {
      title: "Ordini di Lavoro",
      value: kpis.serviceOrders,
      icon: Package,
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      link: "/support/work-orders"
    },
    {
      title: "Ordini di Spedizione",
      value: kpis.shippingOrders,
      icon: Truck,
      color: "text-green-600",
      bgColor: "bg-green-50",
      link: "/warehouse/shipping-orders"
    },
    {
      title: "Nuovi Lead",
      value: kpis.newLeads,
      icon: Users,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
      link: "/crm/leads"
    },
    {
      title: "Lead in Negoziazione",
      value: kpis.negotiationLeads,
      icon: TrendingUp,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
      link: "/crm/leads"
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Panoramica generale delle attività</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpiCards.map((kpi, index) => (
          <Link key={index} to={kpi.link}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {kpi.title}
                </CardTitle>
                <div className={`${kpi.bgColor} p-2 rounded-lg`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Azioni Rapide</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Button onClick={() => setWizardOpen('rfq')} className="gap-2">
            <FileText className="h-4 w-4" />
            Nuova Richiesta di Offerta
          </Button>
          <Button onClick={() => setWizardOpen('order')} className="gap-2">
            <ShoppingCart className="h-4 w-4" />
            Nuovo Ordine
          </Button>
          <Button onClick={() => setWizardOpen('task')} className="gap-2">
            <CheckSquare className="h-4 w-4" />
            Nuova Task
          </Button>
        </CardContent>
      </Card>

      {/* Tasks in Progress */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Task in Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nessuna task in progress</p>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="font-medium">{task.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline">{task.category}</Badge>
                      {task.due_date && (
                        <span className="text-xs">Scadenza: {new Date(task.due_date).toLocaleDateString('it-IT')}</span>
                      )}
                    </div>
                  </div>
                  <Link to="/tasks">
                    <Button variant="ghost" size="sm">
                      Visualizza
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wizards */}
      <Dialog open={wizardOpen === 'rfq'} onOpenChange={(open) => !open && setWizardOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuova Richiesta di Offerta</DialogTitle>
            <DialogDescription>
              Wizard per creare una nuova richiesta di offerta
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Funzionalità in sviluppo...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={wizardOpen === 'order'} onOpenChange={(open) => !open && setWizardOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuovo Ordine</DialogTitle>
            <DialogDescription>
              Wizard per creare un nuovo ordine
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Funzionalità in sviluppo...</p>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={wizardOpen === 'task'} onOpenChange={(open) => !open && setWizardOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nuova Task</DialogTitle>
            <DialogDescription>
              Wizard per creare una nuova task
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-muted-foreground">Funzionalità in sviluppo...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
