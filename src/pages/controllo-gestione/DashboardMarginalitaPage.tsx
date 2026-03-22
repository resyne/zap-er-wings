import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, DollarSign, Target, AlertTriangle, BarChart3, PieChart } from "lucide-react";
import { useManagementCosts, useRevenueData } from "@/hooks/useManagementCosts";
import { useManagementCommesse, useCommesseTotals } from "@/hooks/useManagementCommesse";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, endOfYear, startOfQuarter, endOfQuarter } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer, Legend, Area, AreaChart, ReferenceLine } from "recharts";
import CommesseGestioneSection from "@/components/controllo-gestione/CommesseGestioneSection";

const DashboardMarginalitaPage = () => {
  const [period, setPeriod] = useState("year");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "month": return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
      case "quarter": return { from: format(startOfQuarter(now), "yyyy-MM-dd"), to: format(endOfQuarter(now), "yyyy-MM-dd") };
      case "year": default: return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
    }
  }, [period]);

  const { data: costs = [] } = useManagementCosts({ status: "active", dateFrom: dateRange.from, dateTo: dateRange.to });
  const { data: revenues = [] } = useRevenueData(dateRange.from, dateRange.to);
  const { data: commesse = [] } = useManagementCommesse();
  const commesseTotals = useCommesseTotals(commesse);

  const metrics = useMemo(() => {
    const totalRevenue = revenues.reduce((s, r) => s + (Number(r.imponibile) || 0), 0) + commesseTotals.totaleRicavi;
    const fixedCosts = costs.filter(c => c.cost_type === "fixed").reduce((s, c) => s + Number(c.amount), 0);
    const variableCosts = costs.filter(c => c.cost_type === "variable").reduce((s, c) => s + Number(c.amount), 0) + commesseTotals.totaleCostiDiretti;
    const grossMargin = totalRevenue - variableCosts;
    const netMargin = totalRevenue - variableCosts - fixedCosts;
    const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
    const netMarginPct = totalRevenue > 0 ? (netMargin / totalRevenue) * 100 : 0;
    const variableCostPct = totalRevenue > 0 ? (variableCosts / totalRevenue) * 100 : 0;
    const fixedCostPct = totalRevenue > 0 ? (fixedCosts / totalRevenue) * 100 : 0;
    const contributionMarginPct = totalRevenue > 0 ? ((totalRevenue - variableCosts) / totalRevenue) * 100 : 0;
    const breakEven = contributionMarginPct > 0 ? fixedCosts / (contributionMarginPct / 100) : 0;

    return { totalRevenue, fixedCosts, variableCosts, grossMargin, netMargin, grossMarginPct, netMarginPct, variableCostPct, fixedCostPct, breakEven };
  }, [costs, revenues, commesseTotals]);

  // Monthly data for charts
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; ricavi: number; costiVar: number; costiFissi: number; margineLordo: number; margineNetto: number }> = {};
    const year = new Date().getFullYear();
    for (let m = 0; m < 12; m++) {
      const key = format(new Date(year, m, 1), "yyyy-MM");
      const label = format(new Date(year, m, 1), "MMM");
      months[key] = { month: label, ricavi: 0, costiVar: 0, costiFissi: 0, margineLordo: 0, margineNetto: 0 };
    }
    revenues.forEach(r => {
      const key = (r.invoice_date || "").substring(0, 7);
      if (months[key]) months[key].ricavi += Number(r.imponibile) || 0;
    });
    costs.forEach(c => {
      const key = (c.date || "").substring(0, 7);
      if (months[key]) {
        if (c.cost_type === "fixed") months[key].costiFissi += Number(c.amount);
        else months[key].costiVar += Number(c.amount);
      }
    });
    Object.values(months).forEach(m => {
      m.margineLordo = m.ricavi - m.costiVar;
      m.margineNetto = m.ricavi - m.costiVar - m.costiFissi;
    });
    return Object.values(months);
  }, [costs, revenues]);

  const fmt = (n: number) => "€ " + n.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const chartConfig = {
    ricavi: { label: "Ricavi", color: "hsl(var(--primary))" },
    costiVar: { label: "Costi Variabili", color: "hsl(25, 95%, 53%)" },
    costiFissi: { label: "Costi Fissi", color: "hsl(0, 84%, 60%)" },
    margineLordo: { label: "Margine Lordo", color: "hsl(142, 76%, 36%)" },
    margineNetto: { label: "Margine Netto", color: "hsl(221, 83%, 53%)" },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard Marginalità</h1>
          <p className="text-muted-foreground">Panoramica economica: ricavi, costi, margini e break-even</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="month">Mese corrente</SelectItem>
            <SelectItem value="quarter">Trimestre corrente</SelectItem>
            <SelectItem value="year">Anno corrente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" />Ricavi Totali</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmt(metrics.totalRevenue)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingDown className="h-4 w-4" />Costi Variabili</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(metrics.variableCosts)}</div>
            <p className="text-xs text-muted-foreground">{metrics.variableCostPct.toFixed(1)}% dei ricavi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="h-4 w-4" />Margine Lordo</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.grossMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(metrics.grossMargin)}</div>
            <p className="text-xs text-muted-foreground">{metrics.grossMarginPct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingDown className="h-4 w-4" />Costi Fissi</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(metrics.fixedCosts)}</div>
            <p className="text-xs text-muted-foreground">{metrics.fixedCostPct.toFixed(1)}% dei ricavi</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Margine Netto</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.netMargin >= 0 ? "text-green-600" : "text-red-600"}`}>{fmt(metrics.netMargin)}</div>
            <p className="text-xs text-muted-foreground">{metrics.netMarginPct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Utile / Perdita</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${metrics.netMargin >= 0 ? "text-green-600" : "text-red-600"}`}>
              {metrics.netMargin >= 0 ? "📈 Utile" : "📉 Perdita"}
            </div>
            <p className="text-xs">{fmt(Math.abs(metrics.netMargin))}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="h-4 w-4" />Break-Even</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(metrics.breakEven)}</div>
            <Badge variant={metrics.totalRevenue >= metrics.breakEven ? "default" : "destructive"} className="mt-1">
              {metrics.totalRevenue >= metrics.breakEven ? "✅ Sopra BEP" : "⚠️ Sotto BEP"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Incidenza Costi</CardTitle></CardHeader>
          <CardContent>
            <div className="text-sm space-y-1">
              <div className="flex justify-between"><span>Variabili</span><span className="font-medium">{metrics.variableCostPct.toFixed(1)}%</span></div>
              <div className="flex justify-between"><span>Fissi</span><span className="font-medium">{metrics.fixedCostPct.toFixed(1)}%</span></div>
              <div className="flex justify-between font-bold"><span>Totale</span><span>{(metrics.variableCostPct + metrics.fixedCostPct).toFixed(1)}%</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" />Ricavi vs Costi per Mese</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar dataKey="ricavi" fill="var(--color-ricavi)" name="Ricavi" />
                <Bar dataKey="costiVar" fill="var(--color-costiVar)" name="Costi Var." />
                <Bar dataKey="costiFissi" fill="var(--color-costiFissi)" name="Costi Fissi" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><PieChart className="h-5 w-5" />Trend Margini</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <AreaChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Area type="monotone" dataKey="margineLordo" fill="var(--color-margineLordo)" fillOpacity={0.2} stroke="var(--color-margineLordo)" name="Margine Lordo" />
                <Area type="monotone" dataKey="margineNetto" fill="var(--color-margineNetto)" fillOpacity={0.2} stroke="var(--color-margineNetto)" name="Margine Netto" />
                <ReferenceLine y={0} stroke="red" strokeDasharray="3 3" />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Alert Section */}
      {(metrics.fixedCostPct > 60 || metrics.netMarginPct < 10) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-orange-500" />Alert & Avvisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {metrics.netMarginPct < 10 && metrics.netMarginPct >= 0 && (
              <div className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div>
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Margine netto basso</p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-300">Il margine netto è al {metrics.netMarginPct.toFixed(1)}% (soglia: 10%)</p>
                </div>
                <Badge variant="secondary">Warning</Badge>
              </div>
            )}
            {metrics.netMarginPct < 0 && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Perdita operativa</p>
                  <p className="text-sm text-red-600 dark:text-red-300">Stai perdendo {fmt(Math.abs(metrics.netMargin))}</p>
                </div>
                <Badge variant="destructive">Critico</Badge>
              </div>
            )}
            {metrics.fixedCostPct > 60 && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">Costi fissi elevati</p>
                  <p className="text-sm text-orange-600 dark:text-orange-300">I costi fissi incidono per il {metrics.fixedCostPct.toFixed(1)}% sui ricavi (soglia: 60%)</p>
                </div>
                <Badge variant="secondary">Warning</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DashboardMarginalitaPage;
