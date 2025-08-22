import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Package,
  AlertTriangle,
  Clock,
  CheckCircle
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

export function DashboardPage() {
  // Mock data - in real app, fetch from Supabase
  const kpiData = [
    {
      title: "Monthly Revenue",
      value: "€ 245,500",
      change: "+12.5%",
      trend: "up",
      icon: DollarSign,
      color: "text-success"
    },
    {
      title: "Active Orders",
      value: "127",
      change: "+8",
      trend: "up", 
      icon: ShoppingCart,
      color: "text-info"
    },
    {
      title: "Total Customers",
      value: "1,234",
      change: "+23",
      trend: "up",
      icon: Users,
      color: "text-primary"
    },
    {
      title: "Stock Items",
      value: "8,456",
      change: "-12",
      trend: "down",
      icon: Package,
      color: "text-warning"
    }
  ];

  const recentOrders = [
    { id: "ORD-001", customer: "ACME Corp", status: "in_production", value: "€ 15,000", date: "2024-01-15" },
    { id: "ORD-002", customer: "Tech Solutions", status: "shipped", value: "€ 8,500", date: "2024-01-14" },
    { id: "ORD-003", customer: "Global Industries", status: "confirmed", value: "€ 22,000", date: "2024-01-13" },
    { id: "ORD-004", customer: "Innovation Ltd", status: "delivered", value: "€ 12,300", date: "2024-01-12" },
  ];

  const alerts = [
    { type: "urgent", message: "5 items below minimum stock level", icon: AlertTriangle },
    { type: "warning", message: "3 overdue work orders need attention", icon: Clock },
    { type: "info", message: "New quality audit scheduled", icon: CheckCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to ZAPPER ERP - Your complete business management overview
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((kpi, index) => (
          <Card key={index} className="transition-all hover:shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{kpi.title}</CardTitle>
              <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <div className="flex items-center text-sm">
                {kpi.trend === "up" ? (
                  <TrendingUp className="h-3 w-3 text-success mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive mr-1" />
                )}
                <span className={kpi.trend === "up" ? "text-success" : "text-destructive"}>
                  {kpi.change}
                </span>
                <span className="text-muted-foreground ml-1">from last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Recent Orders
            </CardTitle>
            <CardDescription>
              Latest customer orders and their current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-4 rounded-lg border bg-muted/20">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{order.id}</span>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">{order.customer}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{order.value}</p>
                    <p className="text-sm text-muted-foreground">{order.date}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alerts
            </CardTitle>
            <CardDescription>
              Important notifications requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                  <alert.icon className={`h-4 w-4 mt-0.5 ${
                    alert.type === "urgent" ? "text-destructive" :
                    alert.type === "warning" ? "text-warning" :
                    "text-info"
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common tasks and shortcuts to key features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "New Quote", url: "/sales/quotes/new", color: "bg-primary" },
              { label: "Create Order", url: "/sales/orders/new", color: "bg-success" },
              { label: "New Work Order", url: "/service/wo/new", color: "bg-info" },
              { label: "Add Customer", url: "/crm/accounts/new", color: "bg-warning" },
            ].map((action, index) => (
              <button
                key={index}
                className={`${action.color} text-white p-4 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity`}
              >
                {action.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}