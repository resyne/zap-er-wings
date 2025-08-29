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
  ChevronRight,
  Store,
  ShieldCheck,
  BookOpen
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
  external?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navigationGroups: NavGroup[] = [
  {
    title: "Dashboard",
    items: [
      { title: "Panoramica", url: "/dashboard", icon: LayoutDashboard },
    ]
  },
  {
    title: "CRM", 
    items: [
      { title: "Dashboard CRM", url: "/crm/dashboard", icon: LayoutDashboard },
      { title: "Ordini", url: "/crm/orders", icon: ShoppingCart },
      { title: "Clienti", url: "/crm/customers", icon: Building2 },
    ]
  },
  {
    title: "Produzione",
    items: [
      { title: "Distinte Base", url: "/mfg/bom", icon: Database },
      { title: "Ordini di Produzione", url: "/mfg/work-orders", icon: Wrench },
      { title: "Esecuzioni", url: "/mfg/executions", icon: Clock },
      { title: "Seriali", url: "/mfg/serials", icon: Package },
      { title: "RMA", url: "/mfg/rma", icon: ClipboardCheck },
    ]
  },
  {
    title: "Assistenza Tecnica",
    items: [
      { title: "Dashboard", url: "/support", icon: LayoutDashboard },
      { title: "Rapporti di Intervento", url: "/support/service-reports", icon: FileText },
    ]
  },
  {
    title: "Magazzino",
    items: [
      { title: "Scorte", url: "/wms/stock", icon: Boxes },
      { title: "Movimenti", url: "/wms/movements", icon: Truck },
      { title: "Lotti e Seriali", url: "/wms/batches-serials", icon: Package },
      { title: "Inventario", url: "/wms/inventory", icon: ClipboardCheck },
      { title: "Prelievi", url: "/wms/picking", icon: Package },
      { title: "DDT", url: "/wms/ddt", icon: FileText },
    ]
  },
  {
    title: "Acquisti",
    items: [
      { title: "Fornitori", url: "/procurement/suppliers", icon: Building2 },
      { title: "Richieste Offerta", url: "/procurement/rfq", icon: FileText },
      { title: "Ordini Acquisto", url: "/procurement/po", icon: ShoppingBag },
      { title: "Ricevimenti", url: "/procurement/receipts", icon: Package },
      { title: "Controllo Qualità", url: "/procurement/qc", icon: ClipboardCheck },
      { title: "Rifornimenti", url: "/procurement/replenishment", icon: BarChart3 },
    ]
  },
  {
    title: "Qualità",
    items: [
      { title: "Non Conformità", url: "/quality/nc", icon: ClipboardCheck },
      { title: "CAPA", url: "/quality/capa", icon: Target },
      { title: "Audit", url: "/quality/audits", icon: ClipboardCheck },
      { title: "HSE", url: "/quality/hse", icon: UserCheck },
    ]
  },
  {
    title: "Finanza",
    items: [
      { title: "Prima Nota", url: "/finance/prima-nota", icon: FileText },
      { title: "Fatture", url: "/finance/invoices", icon: FileText },
      { title: "Flusso di Cassa", url: "/finance/cash", icon: DollarSign },
      { title: "Report", url: "/finance/reports", icon: BarChart3 },
      { title: "Esportazioni", url: "/finance/exports", icon: FileText },
    ]
  },
  {
    title: "Risorse Umane",
    items: [
      { title: "Personale", url: "/hr/people", icon: Users },
      { title: "Timesheet", url: "/hr/timesheets", icon: Clock },
      { title: "Rimborsi", url: "/hr/expenses", icon: DollarSign },
      { title: "Turni", url: "/hr/roster", icon: CalendarDays },
      { title: "Fluida", url: "/hr/fluida", icon: Users },
    ]
  },
  {
    title: "Analisi",
    items: [
      { title: "Report", url: "/bi/reports", icon: BarChart3 },
      { title: "Analisi", url: "/bi/analysis", icon: PieChart },
      { title: "KPI", url: "/bi/kpi", icon: Target },
    ]
  },
  {
    title: "Partnership",
    items: [
      { title: "Importers", url: "/partnerships/importers", icon: Users },
      { title: "Installers", url: "/partnerships/installers", icon: Wrench },
      { title: "Resellers", url: "/partnerships/resellers", icon: Store },
    ]
  },
  {
    title: "Documentazione",
    items: [
      { title: "Dashboard", url: "/docs", icon: FileText },
      { title: "Schede Tecniche", url: "/docs/technical-sheets", icon: FileText },
      { title: "Conformità", url: "/docs/compliance", icon: ShieldCheck },
      { title: "Manuali", url: "/docs/manuals", icon: BookOpen },
      { title: "Listini", url: "/docs/price-lists", icon: DollarSign },
    ]
  },
  {
    title: "Sistema",
    items: [
      { title: "Integrazioni", url: "/integrations", icon: Zap },
      { title: "Impostazioni", url: "/settings", icon: Settings },
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
                            {item.external ? (
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cn(
                                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-all",
                                  "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                                )}
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
                              </a>
                            ) : (
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
                            )}
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