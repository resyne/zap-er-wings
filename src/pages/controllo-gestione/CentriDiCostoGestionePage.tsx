import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useManagementCosts } from "@/hooks/useManagementCosts";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, TrendingUp, DollarSign } from "lucide-react";

const CentriDiCostoGestionePage = () => {
  const { data: costs = [] } = useManagementCosts({ status: "active" });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cost_centers").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const centerData = useMemo(() => {
    const totalAllCosts = costs.reduce((s, c) => s + Number(c.amount), 0);

    return costCenters.map(cc => {
      const centerCosts = costs.filter(c => c.cost_center_id === cc.id);
      const total = centerCosts.reduce((s, c) => s + Number(c.amount), 0);
      const fixed = centerCosts.filter(c => c.cost_type === "fixed").reduce((s, c) => s + Number(c.amount), 0);
      const variable = centerCosts.filter(c => c.cost_type === "variable").reduce((s, c) => s + Number(c.amount), 0);
      const pctOfTotal = totalAllCosts > 0 ? (total / totalAllCosts) * 100 : 0;

      return { ...cc, total, fixed, variable, count: centerCosts.length, pctOfTotal };
    });
  }, [costs, costCenters]);

  // Unassigned costs
  const unassigned = useMemo(() => {
    const unassignedCosts = costs.filter(c => !c.cost_center_id);
    return {
      total: unassignedCosts.reduce((s, c) => s + Number(c.amount), 0),
      count: unassignedCosts.length,
    };
  }, [costs]);

  const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Centri di Costo</h1>
        <p className="text-muted-foreground">Analisi costi per area aziendale e incidenza sulla redditività</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="h-4 w-4" />Centri Attivi</div>
            <div className="text-2xl font-bold">{costCenters.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="h-4 w-4" />Totale Costi Allocati</div>
            <div className="text-2xl font-bold">{fmt(centerData.reduce((s, c) => s + c.total, 0))}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" />Non Allocati</div>
            <div className="text-2xl font-bold text-orange-600">{fmt(unassigned.total)}</div>
            <p className="text-xs text-muted-foreground">{unassigned.count} costi senza centro</p>
          </CardContent>
        </Card>
      </div>

      {/* Center Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {centerData.map(center => (
          <Card key={center.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{center.name}</CardTitle>
                <Badge variant="outline">{center.code}</Badge>
              </div>
              {center.description && <p className="text-xs text-muted-foreground">{center.description}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Totale costi</span>
                <span className="text-lg font-bold">{fmt(center.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Costi fissi</span>
                <span className="font-medium text-red-600">{fmt(center.fixed)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Costi variabili</span>
                <span className="font-medium text-orange-600">{fmt(center.variable)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Numero voci</span>
                <span className="font-medium">{center.count}</span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Incidenza % su totale</span>
                  <span>{center.pctOfTotal.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(center.pctOfTotal, 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {centerData.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>Nessun centro di costo configurato.</p>
            <p className="text-sm">Vai su Setup Contabile per creare i centri di costo.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CentriDiCostoGestionePage;
