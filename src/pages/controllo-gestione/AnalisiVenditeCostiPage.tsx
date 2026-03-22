import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagementCosts, useRevenueData } from "@/hooks/useManagementCosts";
import { format, startOfYear, endOfYear } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";

const AnalisiVenditeCostiPage = () => {
  const [allocMode, setAllocMode] = useState("not_allocated");
  const now = new Date();
  const dateFrom = format(startOfYear(now), "yyyy-MM-dd");
  const dateTo = format(endOfYear(now), "yyyy-MM-dd");

  const { data: costs = [] } = useManagementCosts({ status: "active", dateFrom, dateTo });
  const { data: revenues = [] } = useRevenueData(dateFrom, dateTo);

  // Monthly analysis
  const monthlyAnalysis = useMemo(() => {
    const months: Record<string, { periodo: string; ricavi: number; costiVariabili: number; margineLordo: number; costiFissiAllocati: number; margineNetto: number; profitLoss: number; marginePct: number }> = {};
    const year = now.getFullYear();
    const totalRevenue = revenues.reduce((s, r) => s + (Number(r.imponibile) || 0), 0);
    const totalFixedCosts = costs.filter(c => c.cost_type === "fixed").reduce((s, c) => s + Number(c.amount), 0);

    for (let m = 0; m < 12; m++) {
      const key = format(new Date(year, m, 1), "yyyy-MM");
      months[key] = { periodo: format(new Date(year, m, 1), "MMM yyyy"), ricavi: 0, costiVariabili: 0, margineLordo: 0, costiFissiAllocati: 0, margineNetto: 0, profitLoss: 0, marginePct: 0 };
    }

    revenues.forEach(r => {
      const key = (r.invoice_date || "").substring(0, 7);
      if (months[key]) months[key].ricavi += Number(r.imponibile) || 0;
    });

    costs.forEach(c => {
      const key = (c.date || "").substring(0, 7);
      if (months[key]) {
        if (c.cost_type === "variable") months[key].costiVariabili += Number(c.amount);
        if (c.cost_type === "fixed" && allocMode === "not_allocated") {
          // Don't allocate
        } else if (c.cost_type === "fixed" && allocMode === "percentage") {
          // Will be calculated after
        }
      }
    });

    Object.entries(months).forEach(([key, m]) => {
      m.margineLordo = m.ricavi - m.costiVariabili;
      if (allocMode === "percentage" && totalRevenue > 0) {
        m.costiFissiAllocati = totalFixedCosts * (m.ricavi / totalRevenue);
      } else if (allocMode === "equal") {
        m.costiFissiAllocati = totalFixedCosts / 12;
      }
      m.margineNetto = m.margineLordo - m.costiFissiAllocati;
      m.profitLoss = m.margineNetto;
      m.marginePct = m.ricavi > 0 ? (m.margineNetto / m.ricavi) * 100 : 0;
    });

    return Object.values(months);
  }, [costs, revenues, allocMode]);

  // Totals
  const totals = useMemo(() => {
    const ricavi = monthlyAnalysis.reduce((s, m) => s + m.ricavi, 0);
    const costiVar = monthlyAnalysis.reduce((s, m) => s + m.costiVariabili, 0);
    const costiFissi = monthlyAnalysis.reduce((s, m) => s + m.costiFissiAllocati, 0);
    const margineLordo = ricavi - costiVar;
    const margineNetto = margineLordo - costiFissi;
    const marginePct = ricavi > 0 ? (margineNetto / ricavi) * 100 : 0;
    const contribuzione = ricavi > 0 ? ((ricavi - costiVar) / ricavi) * 100 : 0;
    return { ricavi, costiVar, costiFissi, margineLordo, margineNetto, marginePct, contribuzione };
  }, [monthlyAnalysis]);

  const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const chartConfig = {
    ricavi: { label: "Ricavi", color: "hsl(var(--primary))" },
    costiVariabili: { label: "Costi Variabili", color: "hsl(25, 95%, 53%)" },
    margineNetto: { label: "Margine Netto", color: "hsl(142, 76%, 36%)" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analisi Vendite vs Costi</h1>
          <p className="text-muted-foreground">Confronto ricavi e costi per capire marginalità e profittabilità</p>
        </div>
        <Select value={allocMode} onValueChange={setAllocMode}>
          <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="not_allocated">Costi fissi non allocati</SelectItem>
            <SelectItem value="percentage">Allocati in % sui ricavi</SelectItem>
            <SelectItem value="equal">Allocati equamente (1/12)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Ricavi</div><div className="text-lg font-bold">{fmt(totals.ricavi)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Costi Variabili</div><div className="text-lg font-bold text-orange-600">{fmt(totals.costiVar)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Margine Contribuzione</div><div className="text-lg font-bold">{totals.contribuzione.toFixed(1)}%</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Costi Fissi Allocati</div><div className="text-lg font-bold text-red-600">{fmt(totals.costiFissi)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Margine Netto</div><div className={`text-lg font-bold ${totals.margineNetto >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.margineNetto)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Profitto / Perdita</div>
          <Badge variant={totals.margineNetto >= 0 ? "default" : "destructive"} className="mt-1">
            {totals.margineNetto >= 0 ? "Profitto" : "Perdita"} {totals.marginePct.toFixed(1)}%
          </Badge>
        </CardContent></Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Andamento Mensile</CardTitle></CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[350px]">
            <BarChart data={monthlyAnalysis}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="periodo" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="ricavi" fill="var(--color-ricavi)" name="Ricavi" />
              <Bar dataKey="costiVariabili" fill="var(--color-costiVariabili)" name="Costi Var." />
              <Bar dataKey="margineNetto" fill="var(--color-margineNetto)" name="Margine Netto" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Detail Table */}
      <Card>
        <CardHeader><CardTitle>Dettaglio Mensile</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3">Periodo</th>
                  <th className="text-right p-3">Ricavi</th>
                  <th className="text-right p-3">Costi Var.</th>
                  <th className="text-right p-3">Margine Lordo</th>
                  <th className="text-right p-3">Costi Fissi All.</th>
                  <th className="text-right p-3">Margine Netto</th>
                  <th className="text-right p-3">Margine %</th>
                </tr>
              </thead>
              <tbody>
                {monthlyAnalysis.map((m, i) => (
                  <tr key={i} className="border-b hover:bg-muted/30">
                    <td className="p-3 font-medium">{m.periodo}</td>
                    <td className="p-3 text-right">{fmt(m.ricavi)}</td>
                    <td className="p-3 text-right text-orange-600">{fmt(m.costiVariabili)}</td>
                    <td className="p-3 text-right">{fmt(m.margineLordo)}</td>
                    <td className="p-3 text-right text-red-600">{fmt(m.costiFissiAllocati)}</td>
                    <td className={`p-3 text-right font-medium ${m.margineNetto >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(m.margineNetto)}</td>
                    <td className="p-3 text-right">
                      <Badge variant={m.marginePct >= 10 ? "default" : m.marginePct >= 0 ? "secondary" : "destructive"}>
                        {m.marginePct.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
                {/* Totals row */}
                <tr className="border-t-2 font-bold bg-muted/30">
                  <td className="p-3">TOTALE</td>
                  <td className="p-3 text-right">{fmt(totals.ricavi)}</td>
                  <td className="p-3 text-right text-orange-600">{fmt(totals.costiVar)}</td>
                  <td className="p-3 text-right">{fmt(totals.margineLordo)}</td>
                  <td className="p-3 text-right text-red-600">{fmt(totals.costiFissi)}</td>
                  <td className={`p-3 text-right ${totals.margineNetto >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(totals.margineNetto)}</td>
                  <td className="p-3 text-right">
                    <Badge variant={totals.marginePct >= 10 ? "default" : "destructive"}>{totals.marginePct.toFixed(1)}%</Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalisiVenditeCostiPage;
