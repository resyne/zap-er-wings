import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Users,
  ShoppingCart,
  Package,
  Wrench,
  Truck,
  DollarSign,
  ClipboardCheck,
  Settings,
  FileText,
  Zap,
  Building2,
  Target,
  CalendarDays,
  Boxes,
  ShoppingBag,
  Clock,
  UserCheck,
  Database,
  PieChart,
  LayoutDashboard,
  ChevronDown,
  ChevronRight
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<any>;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { title: "Overview", url: "/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "CRM", 
    items: [
      { title: "CRM Dashboard", url: "/crm/dashboard", icon: LayoutDashboard },
      { title: "Orders", url: "/crm/orders", icon: ShoppingCart },
      { title: "Customers", url: "/crm/customers", icon: Building2 },
    ]
  },
  {
    title: "Production",
    items: [
      { title: "BOMs", url: "/mfg/bom", icon: Database },
      { title: "Work Orders", url: "/mfg/work-orders", icon: Wrench },
      { title: "Executions", url: "/mfg/executions", icon: Clock },
      { title: "Serials", url: "/mfg/serials", icon: Package },
      { title: "RMA", url: "/mfg/rma", icon: ClipboardCheck },
    ]
  },
  {
    title: "Field Service",
    items: [
      { title: "Schedule", url: "/service/schedule", icon: CalendarDays },
      { title: "Work Orders", url: "/service/wo", icon: Wrench },
      { title: "Checklists", url: "/service/checklists", icon: ClipboardCheck },
      { title: "Reports", url: "/service/reports", icon: FileText },
      { title: "Tickets", url: "/service/tickets", icon: Users },
      { title: "Contracts", url: "/service/contracts", icon: FileText },
    ]
  },
  {
    title: "Warehouse",
    items: [
      { title: "Stock", url: "/wms/stock", icon: Boxes },
      { title: "Movements", url: "/wms/movements", icon: Truck },
      { title: "Batches & Serials", url: "/wms/batches-serials", icon: Package },
      { title: "Inventory", url: "/wms/inventory", icon: ClipboardCheck },
      { title: "Picking", url: "/wms/picking", icon: Package },
      { title: "DDT", url: "/wms/ddt", icon: FileText },
    ]
  },
  {
    title: "Procurement",
    items: [
      { title: "Suppliers", url: "/procurement/suppliers", icon: Building2 },
      { title: "RFQ", url: "/procurement/rfq", icon: FileText },
      { title: "Purchase Orders", url: "/procurement/po", icon: ShoppingBag },
      { title: "Receipts", url: "/procurement/receipts", icon: Package },
      { title: "Quality Control", url: "/procurement/qc", icon: ClipboardCheck },
      { title: "Replenishment", url: "/procurement/replenishment", icon: BarChart3 },
    ]
  },
  {
    title: "Quality",
    items: [
      { title: "Non Conformity", url: "/quality/nc", icon: ClipboardCheck },
      { title: "CAPA", url: "/quality/capa", icon: Target },
      { title: "Audits", url: "/quality/audits", icon: ClipboardCheck },
      { title: "HSE", url: "/quality/hse", icon: UserCheck },
    ]
  },
  {
    title: "Finance",
    items: [
      { title: "Prima Nota", url: "/finance/prima-nota", icon: FileText },
      { title: "Invoices", url: "/finance/invoices", icon: FileText },
      { title: "Cash Flow", url: "/finance/cash", icon: DollarSign },
      { title: "Reports", url: "/finance/reports", icon: BarChart3 },
      { title: "Exports", url: "/finance/exports", icon: FileText },
    ]
  },
  {
    title: "HR & Time",
    items: [
      { title: "People", url: "/hr/people", icon: Users },
      { title: "Timesheets", url: "/hr/timesheets", icon: Clock },
      { title: "Expenses", url: "/hr/expenses", icon: DollarSign },
      { title: "Roster", url: "/hr/roster", icon: CalendarDays },
    ]
  },
  {
    title: "Analytics",
    items: [
      { title: "Reports", url: "/bi/reports", icon: BarChart3 },
      { title: "Analysis", url: "/bi/analysis", icon: PieChart },
      { title: "KPIs", url: "/bi/kpi", icon: Target },
    ]
  },
  {
    title: "Partnerships",
    items: [
      { title: "Partners", url: "/partnerships/partners", icon: Users },
    ]
  },
  {
    title: "System",
    items: [
      { title: "Documents", url: "/docs", icon: FileText },
      { title: "Integrations", url: "/integrations", icon: Zap },
      { title: "Settings", url: "/settings", icon: Settings },
    ]
  }
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const currentPath = location.pathname;
  const [openGroups, setOpenGroups] = useState<string[]>(
    navigationGroups
      .filter(group => group.items.some(item => currentPath.startsWith(item.url.split('/')[1] || item.url)))
      .map(group => group.title)
  );

  const isActive = (path: string) => {
    if (path === "/dashboard") return currentPath === "/" || currentPath === "/dashboard";
    return currentPath.startsWith(path);
  };

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => 
      prev.includes(groupTitle) 
        ? prev.filter(g => g !== groupTitle)
        : [...prev, groupTitle]
    );
  };

  return (
    <Sidebar className={collapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-sidebar-background border-r border-sidebar-border">
        {/* Logo/Brand */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded bg-gradient-to-br from-primary to-primary-glow flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">Z</span>
            </div>
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-bold text-sidebar-foreground">ZAPPER</span>
                <span className="text-xs text-sidebar-foreground/60">ERP System</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {navigationGroups.map((group) => (
            <SidebarGroup key={group.title}>
              <Collapsible
                open={!collapsed && openGroups.includes(group.title)}
                onOpenChange={() => toggleGroup(group.title)}
              >
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className={cn(
                    "flex items-center justify-between w-full text-xs font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors",
                    collapsed && "sr-only"
                  )}>
                    {group.title}
                    {!collapsed && (
                      openGroups.includes(group.title) ? 
                        <ChevronDown className="h-3 w-3" /> : 
                        <ChevronRight className="h-3 w-3" />
                    )}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className={({ isActive: linkIsActive }) =>
                                cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                                  "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent",
                                  (linkIsActive || isActive(item.url)) && 
                                    "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                                )
                              }
                            >
                              <item.icon className="h-4 w-4 shrink-0" />
                              {!collapsed && (
                                <span className="text-sm font-medium">{item.title}</span>
                              )}
                              {!collapsed && item.badge && (
                                <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                                  {item.badge}
                                </span>
                              )}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          ))}
        </div>
      </SidebarContent>
    </Sidebar>
  );
}