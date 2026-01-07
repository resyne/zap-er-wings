import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  ArrowRight,
  RefreshCw,
  X,
  Edit,
  Save
} from "lucide-react";

interface StrategicObjective {
  id: string;
  title: string;
  description: string | null;
  status: string;
  source: string;
  impact: string | null;
  effort: string | null;
  risk_level: string | null;
  start_date: string | null;
  target_date: string | null;
  wise_analysis: any;
  created_at: string;
}

interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  description: string | null;
  target_value: number;
  current_value: number;
  unit: string;
  deadline: string | null;
  status: string;
  priority: number;
}

interface OracleInsight {
  id: string;
  insight_type: string;
  title: string;
  description: string;
  data_source: string | null;
  confidence: number;
  suggested_action: string | null;
  raw_data: any;
  is_dismissed: boolean;
  converted_to_objective_id: string | null;
  created_at: string;
}

export default function StrategyWiseOraclePage() {
  const [activeTab, setActiveTab] = useState("oracle");
  const [insights, setInsights] = useState<OracleInsight[]>([]);
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [keyResults, setKeyResults] = useState<Record<string, KeyResult[]>>({});
  const [selectedInsight, setSelectedInsight] = useState<OracleInsight | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertingInsight, setConvertingInsight] = useState<OracleInsight | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [analyzingObjective, setAnalyzingObjective] = useState<string | null>(null);

  const [newObjective, setNewObjective] = useState({
    title: "",
    description: "",
    impact: "medium",
    effort: "medium",
    target_date: "",
  });

  const [newKeyResults, setNewKeyResults] = useState<Array<{
    title: string;
    target_value: number;
    unit: string;
    deadline: string;
  }>>([{ title: "", target_value: 0, unit: "", deadline: "" }]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [insightsRes, objectivesRes] = await Promise.all([
        supabase
          .from("oracle_insights")
          .select("*")
          .eq("is_dismissed", false)
          .order("created_at", { ascending: false }),
        supabase
          .from("strategic_objectives")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (insightsRes.data) setInsights(insightsRes.data);
      if (objectivesRes.data) {
        setObjectives(objectivesRes.data);
        // Load key results for each objective
        const krMap: Record<string, KeyResult[]> = {};
        for (const obj of objectivesRes.data) {
          const { data } = await supabase
            .from("key_results")
            .select("*")
            .eq("objective_id", obj.id)
            .order("priority", { ascending: true });
          if (data) krMap[obj.id] = data;
        }
        setKeyResults(krMap);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Errore nel caricamento dei dati");
    } finally {
      setIsLoading(false);
    }
  };

  const runOracleAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { action: "oracle_analyze" },
      });

      if (error) throw error;

      if (data?.insights && data.insights.length > 0) {
        // Save insights to database
        for (const insight of data.insights) {
          await supabase.from("oracle_insights").insert({
            insight_type: insight.type,
            title: insight.title,
            description: insight.description,
            data_source: insight.data_source,
            confidence: insight.confidence,
            suggested_action: insight.suggested_action,
          });
        }
        await loadData();
        toast.success(`ORACLE ha identificato ${data.insights.length} insights`);
      } else {
        toast.info("Nessun nuovo insight identificato");
      }
    } catch (error: any) {
      console.error("Oracle analysis error:", error);
      toast.error("Errore nell'analisi ORACLE: " + error.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      await supabase
        .from("oracle_insights")
        .update({ is_dismissed: true })
        .eq("id", insightId);
      setInsights(insights.filter(i => i.id !== insightId));
      toast.success("Insight archiviato");
    } catch (error) {
      toast.error("Errore nell'archiviazione");
    }
  };

  const convertInsightToObjective = async () => {
    if (!convertingInsight) return;
    
    setIsConverting(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { 
          action: "convert_insight_to_objective",
          data: { insight: convertingInsight }
        },
      });

      if (error) throw error;

      if (data?.objective) {
        // Create objective
        const { data: objData, error: objError } = await supabase
          .from("strategic_objectives")
          .insert({
            title: data.objective.title,
            description: data.objective.description,
            impact: data.objective.impact,
            effort: data.objective.effort,
            target_date: data.objective.target_date,
            source: "oracle",
            status: "draft",
          })
          .select()
          .single();

        if (objError) throw objError;

        // Create key results
        if (data.key_results && objData) {
          for (const kr of data.key_results) {
            await supabase.from("key_results").insert({
              objective_id: objData.id,
              title: kr.title,
              target_value: kr.target_value,
              current_value: 0,
              unit: kr.unit,
              deadline: kr.deadline,
              status: "on_track",
            });
          }
        }

        // Mark insight as converted
        await supabase
          .from("oracle_insights")
          .update({ converted_to_objective_id: objData.id })
          .eq("id", convertingInsight.id);

        await loadData();
        setShowConvertDialog(false);
        setConvertingInsight(null);
        setActiveTab("wise");
        toast.success("Obiettivo creato con successo!");
      }
    } catch (error: any) {
      console.error("Convert error:", error);
      toast.error("Errore nella conversione: " + error.message);
    } finally {
      setIsConverting(false);
    }
  };

  const runWiseAnalysis = async (objectiveId: string) => {
    setAnalyzingObjective(objectiveId);
    try {
      const objective = objectives.find(o => o.id === objectiveId);
      const krs = keyResults[objectiveId] || [];

      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { 
          action: "wise_analyze",
          data: { objective, keyResults: krs }
        },
      });

      if (error) throw error;

      if (data?.analysis) {
        await supabase
          .from("strategic_objectives")
          .update({ wise_analysis: data.analysis })
          .eq("id", objectiveId);
        
        await loadData();
        toast.success("Analisi WISE completata");
      }
    } catch (error: any) {
      console.error("WISE analysis error:", error);
      toast.error("Errore nell'analisi WISE: " + error.message);
    } finally {
      setAnalyzingObjective(null);
    }
  };

  const createObjective = async () => {
    if (!newObjective.title) {
      toast.error("Inserisci un titolo per l'obiettivo");
      return;
    }

    try {
      const { data: objData, error: objError } = await supabase
        .from("strategic_objectives")
        .insert({
          title: newObjective.title,
          description: newObjective.description,
          impact: newObjective.impact,
          effort: newObjective.effort,
          target_date: newObjective.target_date || null,
          source: "manual",
          status: "draft",
        })
        .select()
        .single();

      if (objError) throw objError;

      // Create key results
      for (const kr of newKeyResults.filter(kr => kr.title)) {
        await supabase.from("key_results").insert({
          objective_id: objData.id,
          title: kr.title,
          target_value: kr.target_value,
          current_value: 0,
          unit: kr.unit,
          deadline: kr.deadline || null,
          status: "on_track",
        });
      }

      await loadData();
      setShowCreateDialog(false);
      setNewObjective({ title: "", description: "", impact: "medium", effort: "medium", target_date: "" });
      setNewKeyResults([{ title: "", target_value: 0, unit: "", deadline: "" }]);
      toast.success("Obiettivo creato con successo!");
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const updateObjectiveStatus = async (objectiveId: string, status: string) => {
    try {
      await supabase
        .from("strategic_objectives")
        .update({ status })
        .eq("id", objectiveId);
      await loadData();
      toast.success("Stato aggiornato");
    } catch (error) {
      toast.error("Errore nell'aggiornamento");
    }
  };

  const updateKeyResultValue = async (krId: string, currentValue: number) => {
    try {
      await supabase
        .from("key_results")
        .update({ current_value: currentValue })
        .eq("id", krId);
      await loadData();
    } catch (error) {
      toast.error("Errore nell'aggiornamento");
    }
  };

  const getInsightTypeIcon = (type: string) => {
    switch (type) {
      case "opportunity": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "risk": return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case "bottleneck": return <Clock className="h-5 w-5 text-orange-500" />;
      case "blindspot": return <Eye className="h-5 w-5 text-purple-500" />;
      default: return <Lightbulb className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getInsightTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      opportunity: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      risk: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      bottleneck: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      blindspot: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
    };
    const labels: Record<string, string> = {
      opportunity: "Opportunità",
      risk: "Rischio",
      bottleneck: "Collo di bottiglia",
      blindspot: "Blind Spot"
    };
    return <Badge className={styles[type] || "bg-gray-100"}>{labels[type] || type}</Badge>;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "text-green-600";
      case "at_risk": return "text-orange-500";
      case "off_track": return "text-red-500";
      case "completed": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  const getImpactBadge = (impact: string | null) => {
    const styles: Record<string, string> = {
      low: "bg-gray-100 text-gray-800",
      medium: "bg-blue-100 text-blue-800",
      high: "bg-green-100 text-green-800"
    };
    const labels: Record<string, string> = { low: "Basso", medium: "Medio", high: "Alto" };
    return <Badge className={styles[impact || "medium"]}>{labels[impact || "medium"]}</Badge>;
  };

  const addKeyResult = () => {
    setNewKeyResults([...newKeyResults, { title: "", target_value: 0, unit: "", deadline: "" }]);
  };

  const removeKeyResult = (index: number) => {
    setNewKeyResults(newKeyResults.filter((_, i) => i !== index));
  };

  const updateKeyResultField = (index: number, field: string, value: any) => {
    const updated = [...newKeyResults];
    updated[index] = { ...updated[index], [field]: value };
    setNewKeyResults(updated);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
              <div className="flex items-center justify-between flex-wrap gap-4">
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
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analisi in corso...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Avvia Analisi ERP
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                ORACLE analizza i dati ERP (CRM, task, offerte, ordini, partnership, controllo di gestione) 
                per far emergere pattern, colli di bottiglia e leve strategiche che potrebbero non essere 
                immediatamente evidenti.
              </p>
            </CardContent>
          </Card>

          {/* Insights Grid */}
          {insights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {insights.map((insight) => (
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
                        {getInsightTypeIcon(insight.insight_type)}
                        <CardTitle className="text-base">{insight.title}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        {getInsightTypeBadge(insight.insight_type)}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => { e.stopPropagation(); dismissInsight(insight.id); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Fonte: {insight.data_source || "ERP"}
                      </span>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">Confidenza:</span>
                        <Badge variant="outline">{insight.confidence}%</Badge>
                      </div>
                    </div>
                    {insight.suggested_action && (
                      <div className="pt-2 border-t">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                          <p className="text-sm">{insight.suggested_action}</p>
                        </div>
                      </div>
                    )}
                    {!insight.converted_to_objective_id && (
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setConvertingInsight(insight);
                          setShowConvertDialog(true);
                        }}
                      >
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Converti in Obiettivo
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Nessun insight disponibile</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Avvia un'analisi ORACLE per scoprire opportunità, rischi e pattern nascosti nei tuoi dati ERP.
                </p>
                <Button onClick={runOracleAnalysis} disabled={isAnalyzing}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Avvia Analisi
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
              <div className="flex items-center justify-between flex-wrap gap-4">
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
                <Button onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Obiettivo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                WISE analizza l'Objective scelto, valuta i Key Results proposti e verifica la coerenza 
                con dati ERP, capacità del team e timeline realistiche.
              </p>
            </CardContent>
          </Card>

          {/* Objectives List */}
          <div className="space-y-4">
            {objectives.map((objective) => (
              <Card key={objective.id}>
                <CardHeader>
                  <div className="flex items-start justify-between flex-wrap gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle>{objective.title}</CardTitle>
                        {objective.source === "oracle" && (
                          <Badge variant="outline" className="text-indigo-600">
                            <Eye className="h-3 w-3 mr-1" />
                            Da ORACLE
                          </Badge>
                        )}
                        <Select 
                          value={objective.status} 
                          onValueChange={(v) => updateObjectiveStatus(objective.id, v)}
                        >
                          <SelectTrigger className="w-[130px] h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="draft">Bozza</SelectItem>
                            <SelectItem value="validated">Validato</SelectItem>
                            <SelectItem value="active">Attivo</SelectItem>
                            <SelectItem value="completed">Completato</SelectItem>
                            <SelectItem value="archived">Archiviato</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <CardDescription>{objective.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => runWiseAnalysis(objective.id)}
                        disabled={analyzingObjective === objective.id}
                      >
                        {analyzingObjective === objective.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Scale className="h-4 w-4 mr-1" />
                            Analizza
                          </>
                        )}
                      </Button>
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
                    {(keyResults[objective.id] || []).map((kr) => (
                      <div key={kr.id} className="p-3 bg-muted rounded-lg space-y-2">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <span className="font-medium">{kr.title}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={kr.current_value}
                              onChange={(e) => updateKeyResultValue(kr.id, parseFloat(e.target.value) || 0)}
                              className="w-20 h-7 text-sm"
                            />
                            <span className="text-sm text-muted-foreground">/ {kr.target_value} {kr.unit}</span>
                            <Badge variant={
                              kr.status === "on_track" ? "default" :
                              kr.status === "at_risk" ? "secondary" : "destructive"
                            }>
                              {kr.status === "on_track" ? "In linea" :
                               kr.status === "at_risk" ? "A rischio" : 
                               kr.status === "completed" ? "Completato" : "Fuori target"}
                            </Badge>
                          </div>
                        </div>
                        <Progress 
                          value={Math.min((kr.current_value / kr.target_value) * 100, 100)} 
                          className="h-2"
                        />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Deadline: {kr.deadline ? new Date(kr.deadline).toLocaleDateString("it-IT") : "N/D"}</span>
                          <span>{Math.round((kr.current_value / kr.target_value) * 100)}% completato</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* WISE Analysis Section */}
                  {objective.wise_analysis && (
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
                            <div className="text-2xl font-bold text-green-600">
                              {objective.wise_analysis.feasibility_score || 0}%
                            </div>
                            <div className="text-muted-foreground">Fattibilità</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              {objective.wise_analysis.coherence_score || 0}%
                            </div>
                            <div className="text-muted-foreground">Coerenza</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-orange-500">
                              {objective.wise_analysis.workload_score || 0}%
                            </div>
                            <div className="text-muted-foreground">Carico CC</div>
                          </div>
                        </div>
                        {objective.wise_analysis.overall_assessment && (
                          <div className="p-3 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800">
                            <p className="text-sm">{objective.wise_analysis.overall_assessment}</p>
                          </div>
                        )}
                        {objective.wise_analysis.suggestions?.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Suggerimenti:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {objective.wise_analysis.suggestions.map((s: string, i: number) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
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
                  <Button onClick={() => setShowCreateDialog(true)}>
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
              <span>OKR + Timeline</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Objective Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo Obiettivo Strategico</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Titolo *</Label>
              <Input 
                value={newObjective.title}
                onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                placeholder="Es: Espansione mercato DACH"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea 
                value={newObjective.description}
                onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                placeholder="Descrivi l'obiettivo in dettaglio..."
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Impatto</Label>
                <Select 
                  value={newObjective.impact}
                  onValueChange={(v) => setNewObjective({ ...newObjective, impact: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basso</SelectItem>
                    <SelectItem value="medium">Medio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sforzo</Label>
                <Select 
                  value={newObjective.effort}
                  onValueChange={(v) => setNewObjective({ ...newObjective, effort: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basso</SelectItem>
                    <SelectItem value="medium">Medio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data Target</Label>
                <Input 
                  type="date"
                  value={newObjective.target_date}
                  onChange={(e) => setNewObjective({ ...newObjective, target_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Key Results</Label>
                <Button variant="outline" size="sm" onClick={addKeyResult}>
                  <Plus className="h-4 w-4 mr-1" />
                  Aggiungi KR
                </Button>
              </div>
              {newKeyResults.map((kr, index) => (
                <div key={index} className="p-3 border rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Key Result {index + 1}</span>
                    {newKeyResults.length > 1 && (
                      <Button variant="ghost" size="icon" onClick={() => removeKeyResult(index)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <Input 
                    placeholder="Titolo KR"
                    value={kr.title}
                    onChange={(e) => updateKeyResultField(index, "title", e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-2">
                    <Input 
                      type="number"
                      placeholder="Target"
                      value={kr.target_value || ""}
                      onChange={(e) => updateKeyResultField(index, "target_value", parseFloat(e.target.value) || 0)}
                    />
                    <Input 
                      placeholder="Unità (€, %, ore...)"
                      value={kr.unit}
                      onChange={(e) => updateKeyResultField(index, "unit", e.target.value)}
                    />
                    <Input 
                      type="date"
                      placeholder="Deadline"
                      value={kr.deadline}
                      onChange={(e) => updateKeyResultField(index, "deadline", e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Annulla
            </Button>
            <Button onClick={createObjective}>
              <Save className="h-4 w-4 mr-2" />
              Crea Obiettivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Insight Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Converti in Obiettivo</DialogTitle>
          </DialogHeader>
          {convertingInsight && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  {getInsightTypeIcon(convertingInsight.insight_type)}
                  <span className="font-medium">{convertingInsight.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">{convertingInsight.description}</p>
                {convertingInsight.suggested_action && (
                  <div className="mt-2 pt-2 border-t">
                    <p className="text-sm"><strong>Azione suggerita:</strong> {convertingInsight.suggested_action}</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                WISE analizzerà questo insight e creerà automaticamente un obiettivo strategico 
                con Key Results appropriati.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Annulla
            </Button>
            <Button onClick={convertInsightToObjective} disabled={isConverting}>
              {isConverting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Conversione...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Converti
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
