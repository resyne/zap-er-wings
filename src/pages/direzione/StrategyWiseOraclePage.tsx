import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { 
  Eye, 
  Scale, 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  Lightbulb,
  CheckCircle2,
  Clock,
  Users,
  BarChart3,
  Sparkles,
  ChevronRight,
  Plus,
  Trash2,
  ArrowRight
} from "lucide-react";

interface StrategicObjective {
  id: string;
  title: string;
  description: string;
  status: "draft" | "validated" | "active" | "completed";
  source: "oracle" | "manual";
  impact: "low" | "medium" | "high";
  effort: "low" | "medium" | "high";
  keyResults: KeyResult[];
  createdAt: string;
}

interface KeyResult {
  id: string;
  title: string;
  target: number;
  current: number;
  unit: string;
  deadline: string;
  status: "on_track" | "at_risk" | "off_track";
}

interface OracleInsight {
  id: string;
  type: "opportunity" | "risk" | "bottleneck" | "blindspot";
  title: string;
  description: string;
  dataSource: string;
  confidence: number;
  suggestedAction?: string;
}

const mockInsights: OracleInsight[] = [
  {
    id: "1",
    type: "opportunity",
    title: "Mercato DACH sottovalutato",
    description: "I lead dalla Germania mostrano un tasso di conversione del 45% vs media del 28%. Il follow-up medio è di 5 giorni vs 2 giorni per Italia.",
    dataSource: "CRM + Lead Analytics",
    confidence: 87,
    suggestedAction: "Ridurre tempo di follow-up DACH a 24h e valutare partner locale"
  },
  {
    id: "2",
    type: "bottleneck",
    title: "Collo di bottiglia in produzione",
    description: "Il 72% dei ritardi ordini deriva dalla fase di assemblaggio finale. Capacità al 94% con picchi al 110%.",
    dataSource: "Work Orders + Production",
    confidence: 92,
    suggestedAction: "Valutare turno aggiuntivo o outsourcing assemblaggio"
  },
  {
    id: "3",
    type: "blindspot",
    title: "Marginalità nascosta sui ricambi",
    description: "I ricambi generano margine del 68% ma rappresentano solo il 4% del fatturato. Potenziale inespresso.",
    dataSource: "Controllo Gestione",
    confidence: 78,
    suggestedAction: "Sviluppare strategia post-vendita e contratti manutenzione"
  },
  {
    id: "4",
    type: "risk",
    title: "Concentrazione clienti",
    description: "Top 3 clienti = 42% fatturato. Rischio elevato in caso di perdita singolo cliente.",
    dataSource: "Fatturato + CRM",
    confidence: 95,
    suggestedAction: "Diversificare base clienti, target: top 3 < 30% entro 12 mesi"
  }
];

const mockObjectives: StrategicObjective[] = [
  {
    id: "1",
    title: "Espansione mercato DACH",
    description: "Aumentare la penetrazione nel mercato tedesco, austriaco e svizzero attraverso partnership locali e riduzione tempi di risposta.",
    status: "active",
    source: "oracle",
    impact: "high",
    effort: "medium",
    keyResults: [
      { id: "kr1", title: "Revenue DACH", target: 500000, current: 180000, unit: "€", deadline: "2025-12-31", status: "on_track" },
      { id: "kr2", title: "Partner attivi", target: 5, current: 2, unit: "partner", deadline: "2025-09-30", status: "at_risk" },
      { id: "kr3", title: "Tempo medio risposta lead", target: 24, current: 48, unit: "ore", deadline: "2025-06-30", status: "off_track" }
    ],
    createdAt: "2025-01-15"
  }
];

export default function StrategyWiseOraclePage() {
  const [activeTab, setActiveTab] = useState("oracle");
  const [selectedInsight, setSelectedInsight] = useState<OracleInsight | null>(null);
  const [objectives, setObjectives] = useState<StrategicObjective[]>(mockObjectives);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const getInsightTypeIcon = (type: OracleInsight["type"]) => {
    switch (type) {
      case "opportunity": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "risk": return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "bottleneck": return <Clock className="h-5 w-5 text-orange-500" />;
      case "blindspot": return <Eye className="h-5 w-5 text-purple-500" />;
    }
  };

  const getInsightTypeBadge = (type: OracleInsight["type"]) => {
    const styles = {
      opportunity: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      bottleneck: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      blindspot: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    };
    const labels = {
      opportunity: "Opportunità",
      risk: "Rischio",
      bottleneck: "Collo di bottiglia",
      blindspot: "Blind Spot"
    };
    return <Badge className={styles[type]}>{labels[type]}</Badge>;
  };

  const getStatusColor = (status: KeyResult["status"]) => {
    switch (status) {
      case "on_track": return "text-green-600";
      case "at_risk": return "text-orange-500";
      case "off_track": return "text-red-500";
    }
  };

  const getImpactBadge = (impact: "low" | "medium" | "high") => {
    const styles = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-green-100 text-green-800"
    };
    const labels = { low: "Basso", medium: "Medio", high: "Alto" };
    return <Badge className={styles[impact]}>{labels[impact]}</Badge>;
  };

  const runOracleAnalysis = () => {
    setIsAnalyzing(true);
    setTimeout(() => setIsAnalyzing(false), 3000);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <Sparkles className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Strategy Wise Oracle</h1>
            <p className="text-muted-foreground">
              Vedi ciò che potresti non vedere. Costruisci il percorso migliore per arrivarci.
            </p>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="oracle" className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            ORACLE
          </TabsTrigger>
          <TabsTrigger value="wise" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            WISE
          </TabsTrigger>
        </TabsList>

        {/* ORACLE Tab */}
        <TabsContent value="oracle" className="space-y-6">
          {/* Oracle Header */}
          <Card className="border-indigo-200 dark:border-indigo-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900">
                    <Eye className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">🔮 ORACLE</CardTitle>
                    <CardDescription>
                      Vedere ciò che potresti non vedere
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={runOracleAnalysis} disabled={isAnalyzing}>
                  {isAnalyzing ? (
                    <>
                      <Sparkles className="h-4 w-4 mr-2 animate-spin" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Avvia Analisi
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ORACLE analizza i dati ERP (CRM, task, offerte, ordini, partnership, controllo di gestione) 
                per far emergere pattern, colli di bottiglia e leve strategiche che potrebbero non essere 
                immediatamente evidenti. Non parte da un obiettivo imposto: parte dalla realtà.
              </p>
            </CardContent>
          </Card>

          {/* Insights Grid */}
          <div className="grid gap-4 md:grid-cols-2">
            {mockInsights.map((insight) => (
              <Card 
                key={insight.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedInsight?.id === insight.id ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => setSelectedInsight(insight)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getInsightTypeIcon(insight.type)}
                      <CardTitle className="text-base">{insight.title}</CardTitle>
                    </div>
                    {getInsightTypeBadge(insight.type)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      Fonte: {insight.dataSource}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Confidenza:</span>
                      <Badge variant="outline">{insight.confidence}%</Badge>
                    </div>
                  </div>
                  {insight.suggestedAction && (
                    <div className="pt-2 border-t">
                      <div className="flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                        <p className="text-sm">{insight.suggestedAction}</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Convert to Objective */}
          {selectedInsight && (
            <Card className="border-primary">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Trasforma in Obiettivo Strategico
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{selectedInsight.title}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedInsight.suggestedAction}</p>
                </div>
                <Button className="w-full" onClick={() => setActiveTab("wise")}>
                  Procedi con WISE per strutturare l'obiettivo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* WISE Tab */}
        <TabsContent value="wise" className="space-y-6">
          {/* Wise Header */}
          <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                    <Scale className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">⚖️ WISE</CardTitle>
                    <CardDescription>
                      Pesare e strutturare l'obiettivo in modo saggio
                    </CardDescription>
                  </div>
                </div>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Obiettivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                WISE interviene dopo che un obiettivo è stato individuato per verificarne la qualità 
                e aiutarti a raggiungerlo nel modo più intelligente possibile. Analizza l'Objective scelto,
                valuta i Key Results proposti e verifica la coerenza con dati ERP, capacità del team e timeline realistiche.
              </p>
            </CardContent>
          </Card>

          {/* Objectives List */}
          <div className="space-y-4">
            {objectives.map((objective) => (
              <Card key={objective.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle>{objective.title}</CardTitle>
                        {objective.source === "oracle" && (
                          <Badge variant="outline" className="text-indigo-600">
                            <Eye className="h-3 w-3 mr-1" />
                            Da ORACLE
                          </Badge>
                        )}
                      </div>
                      <CardDescription>{objective.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Impatto:</span>
                          {getImpactBadge(objective.impact)}
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-muted-foreground">Sforzo:</span>
                          {getImpactBadge(objective.effort)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Key Results */}
                  <div className="space-y-3">
                    <h4 className="font-medium flex items-center gap-2">
                      <Target className="h-4 w-4" />
                      Key Results
                    </h4>
                    {objective.keyResults.map((kr) => (
                      <div key={kr.id} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{kr.title}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${getStatusColor(kr.status)}`}>
                              {kr.current} / {kr.target} {kr.unit}
                            </span>
                            <Badge variant={
                              kr.status === "on_track" ? "default" :
                              kr.status === "at_risk" ? "secondary" : "destructive"
                            }>
                              {kr.status === "on_track" ? "In linea" :
                               kr.status === "at_risk" ? "A rischio" : "Fuori target"}
                            </Badge>
                          </div>
                        </div>
                        <Progress 
                          value={(kr.current / kr.target) * 100} 
                          className="h-2"
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Deadline: {new Date(kr.deadline).toLocaleDateString("it-IT")}</span>
                          <span>{Math.round((kr.current / kr.target) * 100)}% completato</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WISE Analysis Section */}
                  <Card className="border-amber-200 dark:border-amber-800">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Scale className="h-4 w-4 text-amber-600" />
                        Analisi WISE
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-green-600">72%</div>
                          <div className="text-muted-foreground">Fattibilità</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">85%</div>
                          <div className="text-muted-foreground">Coerenza dati</div>
                        </div>
                        <div className="text-center p-3 bg-muted rounded-lg">
                          <div className="text-2xl font-bold text-orange-500">63%</div>
                          <div className="text-muted-foreground">Carico CC</div>
                        </div>
                      </div>
                      <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                          <div className="text-sm">
                            <p className="font-medium text-amber-800 dark:text-amber-200">Suggerimento WISE</p>
                            <p className="text-amber-700 dark:text-amber-300 mt-1">
                              Il KR "Tempo medio risposta lead" richiede risorse aggiuntive. 
                              Considera di posticipare la deadline o ridurre il target a 36h per Q2.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Empty State */}
          {objectives.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nessun obiettivo definito</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Inizia con ORACLE per scoprire opportunità, oppure crea un obiettivo manualmente.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("oracle")}>
                    <Eye className="h-4 w-4 mr-2" />
                    Vai a ORACLE
                  </Button>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Obiettivo
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Workflow Diagram */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🧩 Come ORACLE e WISE lavorano insieme</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-center gap-3 text-sm">
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <BarChart3 className="h-5 w-5 text-blue-500" />
              <span>Dati ERP</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
              <Eye className="h-5 w-5 text-indigo-600" />
              <span>ORACLE</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Users className="h-5 w-5 text-gray-500" />
              <span>Scelta Umana</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-amber-100 dark:bg-amber-900 rounded-lg">
              <Scale className="h-5 w-5 text-amber-600" />
              <span>WISE</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
            <div className="flex items-center gap-2 p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span>OKR + Timeline + CC</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
