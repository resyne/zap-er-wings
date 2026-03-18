import { useState, Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Truck, Wrench, CheckSquare, Receipt, AlertTriangle, FileCheck, BarChart3 } from "lucide-react";
import DdtSection from "@/components/documenti-operativi/DdtSection";
import OrdiniSection from "@/components/documenti-operativi/OrdiniSection";
import OfferteAccettateSection from "@/components/documenti-operativi/OfferteAccettateSection";
import RapportiSection from "@/components/documenti-operativi/RapportiSection";

const GiustificativiSection = lazy(() => import("../management-control-2/RegistroPage"));

const Fallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center space-y-3">
      <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Caricamento...</p>
    </div>
  </div>
);

const tabs = [
  { value: "ddt", label: "DDT", icon: Truck },
  { value: "ordini", label: "Ordini", icon: ShoppingCart },
  { value: "offerte", label: "Offerte Accettate", icon: CheckSquare },
  { value: "rapporti", label: "Rapporti", icon: Wrench },
  { value: "giustificativi", label: "Giustificativi", icon: Receipt },
] as const;

function useSummaryStats() {
  return useQuery({
    queryKey: ["documenti-operativi-summary"],
    queryFn: async () => {
      const [ordersRes, ddtsRes, reportsRes] = await Promise.all([
        supabase.from("sales_orders").select("id, invoiced, archived, non_contabilizzato, accounting_document_id", { count: "exact" }).or("archived.is.null,archived.eq.false"),
        supabase.from("ddts").select("id, invoiced, archived", { count: "exact" }).or("archived.is.null,archived.eq.false"),
        supabase.from("service_reports").select("id, invoiced, archived, status", { count: "exact" }).eq("status", "completed").or("archived.is.null,archived.eq.false"),
      ]);
      const orders = ordersRes.data || [];
      const ddts = ddtsRes.data || [];
      const reports = reportsRes.data || [];

      const ordersPending = orders.filter(o => !o.invoiced && !o.non_contabilizzato).length;
      const ddtsPending = ddts.filter(d => !d.invoiced).length;
      const reportsPending = reports.filter(r => !r.invoiced).length;
      const totalPending = ordersPending + ddtsPending + reportsPending;
      const totalDocs = orders.length + ddts.length + reports.length;
      const totalLinked = totalDocs - totalPending;

      return { ordersPending, ddtsPending, reportsPending, totalPending, totalDocs, totalLinked };
    },
    refetchInterval: 30000,
  });
}

export default function DocumentiOperativiPage() {
  const [activeTab, setActiveTab] = useState("ddt");
  const { data: stats } = useSummaryStats();

  const tabBadge = (value: string) => {
    if (!stats) return null;
    const count = value === "ordini" ? stats.ordersPending : value === "ddt" ? stats.ddtsPending : value === "rapporti" ? stats.reportsPending : 0;
    if (count === 0) return null;
    return (
      <span className="ml-1.5 inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold leading-none">
        {count}
      </span>
    );
  };

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      {stats && stats.totalPending > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card className="border-amber-500/20 bg-amber-500/[0.03]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{stats.totalPending}</p>
                <p className="text-xs text-muted-foreground">Da collegare</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalLinked}</p>
                <p className="text-xs text-muted-foreground">Collegati</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalDocs}</p>
                <p className="text-xs text-muted-foreground">Totale documenti</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                  ${isActive 
                    ? "bg-background shadow-sm text-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden md:inline">{tab.label}</span>
                <span className="md:hidden text-xs">{tab.label.split(' ')[0]}</span>
                {tabBadge(tab.value)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="ddt" className="mt-0">
          <DdtSection />
        </TabsContent>

        <TabsContent value="ordini" className="mt-0">
          <OrdiniSection />
        </TabsContent>

        <TabsContent value="offerte" className="mt-0">
          <OfferteAccettateSection />
        </TabsContent>

        <TabsContent value="rapporti" className="mt-0">
          <RapportiSection />
        </TabsContent>

        <TabsContent value="giustificativi" className="mt-0">
          <Suspense fallback={<Fallback />}>
            <GiustificativiSection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
