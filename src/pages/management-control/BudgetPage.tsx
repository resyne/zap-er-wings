import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, TrendingDown, Target, AlertTriangle } from "lucide-react";
import { useState } from "react";

const BudgetPage = () => {
  const [selectedYear, setSelectedYear] = useState("2024");
  const [selectedMonth, setSelectedMonth] = useState("all");

  const budgetData = [
    {
      account: "Ricavi Macchine",
      category: "revenue",
      budgeted: 480000,
      actual: 456000,
      variance: -24000,
      variancePercent: -5.0,
      ytdBudgeted: 1440000,
      ytdActual: 1368000,
    },
    {
      account: "Ricavi Installazioni", 
      category: "revenue",
      budgeted: 240000,
      actual: 264000,
      variance: 24000,
      variancePercent: 10.0,
      ytdBudgeted: 720000,
      ytdActual: 792000,
    },
    {
      account: "Ricavi Service",
      category: "revenue", 
      budgeted: 180000,
      actual: 186000,
      variance: 6000,
      variancePercent: 3.3,
      ytdBudgeted: 540000,
      ytdActual: 558000,
    },
    {
      account: "Costi Materiali",
      category: "cost",
      budgeted: 300000,
      actual: 315000,
      variance: 15000,
      variancePercent: 5.0,
      ytdBudgeted: 900000,
      ytdActual: 945000,
    },
    {
      account: "Costi Manodopera",
      category: "cost",
      budgeted: 120000,
      actual: 118000,
      variance: -2000,
      variancePercent: -1.7,
      ytdBudgeted: 360000,
      ytdActual: 354000,
    },
    {
      account: "Personale",
      category: "opex",
      budgeted: 150000,
      actual: 165000,
      variance: 15000,
      variancePercent: 10.0,
      ytdBudgeted: 450000,
      ytdActual: 495000,
    },
    {
      account: "Marketing",
      category: "opex",
      budgeted: 45000,
      actual: 52000,
      variance: 7000,
      variancePercent: 15.6,
      ytdBudgeted: 135000,
      ytdActual: 156000,
    },
  ];

  const forecastData = [
    {
      scenario: "Best Case",
      revenue: 1200000,
      costs: 900000,
      ebitda: 300000,
      probability: 25,
    },
    {
      scenario: "Base Case",
      revenue: 1080000,
      costs: 810000,
      ebitda: 270000,
      probability: 50,
    },
    {
      scenario: "Worst Case",
      revenue: 960000,
      costs: 780000,
      ebitda: 180000,
      probability: 25,
    },
  ];

  const getVarianceColor = (variance: number, isPercent: boolean = false) => {
    if (variance > 0) {
      return "text-green-600";
    } else if (variance < 0) {
      return "text-red-600";
    } else {
      return "text-gray-600";
    }
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) {
      return <TrendingUp className="w-4 h-4 text-green-600" />;
    } else if (variance < 0) {
      return <TrendingDown className="w-4 h-4 text-red-600" />;
    } else {
      return <Target className="w-4 h-4 text-gray-600" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "revenue": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "cost": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "opex": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const totalBudgetedRevenue = budgetData.filter(item => item.category === "revenue").reduce((sum, item) => sum + item.budgeted, 0);
  const totalActualRevenue = budgetData.filter(item => item.category === "revenue").reduce((sum, item) => sum + item.actual, 0);
  const revenueVariance = totalActualRevenue - totalBudgetedRevenue;
  const revenueVariancePercent = (revenueVariance / totalBudgetedRevenue) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Budget & Forecast</h1>
        <p className="text-muted-foreground">
          Pianificazione e controllo del budget aziendale
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ricavi vs Budget</CardTitle>
            {getVarianceIcon(revenueVariance)}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ {totalActualRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              <span className={getVarianceColor(revenueVariancePercent)}>
                {revenueVariancePercent > 0 ? '+' : ''}{revenueVariancePercent.toFixed(1)}% vs budget
              </span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scostamenti &gt;10%</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <p className="text-xs text-muted-foreground">
              Voci con scostamenti significativi
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">EBITDA Forecast</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€ 270k</div>
            <p className="text-xs text-muted-foreground">
              Scenario base case
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuratezza Budget</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">
              Precisione delle previsioni
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="budget" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="budget">Budget vs Actual</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
        </TabsList>

        <TabsContent value="budget">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Analisi Budget vs Actual</CardTitle>
                  <CardDescription>
                    Confronto tra budget e dati consuntivi
                  </CardDescription>
                </div>
                <div className="flex items-center space-x-4">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2024">2024</SelectItem>
                      <SelectItem value="2023">2023</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tutto l'anno</SelectItem>
                      <SelectItem value="01">Gennaio</SelectItem>
                      <SelectItem value="02">Febbraio</SelectItem>
                      <SelectItem value="03">Marzo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Voce di Budget</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Actual</TableHead>
                      <TableHead className="text-right">Scostamento</TableHead>
                      <TableHead className="text-right">Scostamento %</TableHead>
                      <TableHead className="text-right">YTD Budget</TableHead>
                      <TableHead className="text-right">YTD Actual</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {budgetData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.account}</TableCell>
                        <TableCell>
                          <Badge className={getCategoryColor(item.category)}>
                            {item.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">€ {item.budgeted.toLocaleString()}</TableCell>
                        <TableCell className="text-right">€ {item.actual.toLocaleString()}</TableCell>
                        <TableCell className={`text-right ${getVarianceColor(item.variance)}`}>
                          {item.variance > 0 ? '+' : ''}€ {item.variance.toLocaleString()}
                        </TableCell>
                        <TableCell className={`text-right ${getVarianceColor(item.variancePercent)}`}>
                          <div className="flex items-center justify-end space-x-1">
                            {getVarianceIcon(item.variance)}
                            <span>{item.variancePercent > 0 ? '+' : ''}{item.variancePercent.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">€ {item.ytdBudgeted.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-muted-foreground">€ {item.ytdActual.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forecast">
          <Card>
            <CardHeader>
              <CardTitle>Forecast Rolling 90 giorni</CardTitle>
              <CardDescription>
                Previsioni per i prossimi 3 mesi basate su pipeline e contratti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {forecastData.map((forecast, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <h3 className="font-medium">{forecast.scenario}</h3>
                        <Badge variant="outline">{forecast.probability}% probabilità</Badge>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Ricavi</p>
                        <p className="text-lg font-medium">€ {forecast.revenue.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Costi</p>
                        <p className="text-lg font-medium">€ {forecast.costs.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">EBITDA</p>
                        <p className="text-lg font-medium text-green-600">€ {forecast.ebitda.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Margine EBITDA</p>
                        <p className="text-lg font-medium">{((forecast.ebitda / forecast.revenue) * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BudgetPage;