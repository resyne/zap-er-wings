import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Target, 
  Sparkles,
  ChevronRight,
  Plus,
  Trash2,
  RefreshCw,
  Check,
  AlertCircle,
  Lightbulb,
  ArrowLeft,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Scale,
  Rocket
} from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyResultDraft {
  id: string;
  title: string;
  target_value: number;
  unit: string;
  deadline: string;
  ai_feedback?: {
    measurable: boolean;
    achievable: boolean;
    specific: boolean;
    issues: string[];
    suggestions: string[];
  };
}

interface TimelineAnalysis {
  is_appropriate: boolean;
  suggested_duration: string;
  reasoning: string;
  risk_level: "low" | "medium" | "high";
}

interface KRSuggestion {
  title: string;
  target_value: number;
  unit: string;
  deadline: string;
  rationale: string;
}

interface OKRCheckResult {
  overall_score: number;
  issues: string[];
  strengths: string[];
  kr_count_assessment: {
    status: "too_few" | "optimal" | "too_many";
    message: string;
  };
  recommendations: string[];
}

export default function StrategyWiseOraclePage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // Step 1: Objective
  const [objectiveTitle, setObjectiveTitle] = useState("");
  const [objectiveDescription, setObjectiveDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  
  // Step 2: Timeline Analysis
  const [timelineAnalysis, setTimelineAnalysis] = useState<TimelineAnalysis | null>(null);
  const [isAnalyzingTimeline, setIsAnalyzingTimeline] = useState(false);
  
  // Step 3: AI Suggested KRs
  const [suggestedKRs, setSuggestedKRs] = useState<KRSuggestion[]>([]);
  const [isGeneratingKRs, setIsGeneratingKRs] = useState(false);
  
  // Step 4: User KRs
  const [keyResults, setKeyResults] = useState<KeyResultDraft[]>([]);
  
  // Step 5: OKR Check
  const [okrCheck, setOkrCheck] = useState<OKRCheckResult | null>(null);
  const [isCheckingOKR, setIsCheckingOKR] = useState(false);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  // Step 1: Analyze objective and timeline
  const analyzeObjective = async () => {
    if (!objectiveTitle.trim()) {
      toast.error("Inserisci un titolo per l'obiettivo");
      return;
    }

    setIsAnalyzingTimeline(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { 
          action: "analyze_timeline",
          data: { 
            title: objectiveTitle,
            description: objectiveDescription,
            target_date: targetDate
          }
        },
      });

      if (error) throw error;

      setTimelineAnalysis(data.analysis);
      setStep(2);
    } catch (error: any) {
      console.error("Timeline analysis error:", error);
      toast.error("Errore nell'analisi: " + error.message);
    } finally {
      setIsAnalyzingTimeline(false);
    }
  };

  // Step 2: Generate KR suggestions
  const generateKRSuggestions = async () => {
    setIsGeneratingKRs(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { 
          action: "suggest_key_results",
          data: { 
            title: objectiveTitle,
            description: objectiveDescription,
            target_date: targetDate,
            timeline_analysis: timelineAnalysis
          }
        },
      });

      if (error) throw error;

      setSuggestedKRs(data.suggestions || []);
      setStep(3);
    } catch (error: any) {
      console.error("KR suggestion error:", error);
      toast.error("Errore nella generazione dei KR: " + error.message);
    } finally {
      setIsGeneratingKRs(false);
    }
  };

  // Add suggested KR to user list
  const addSuggestedKR = (kr: KRSuggestion) => {
    setKeyResults([...keyResults, {
      id: generateId(),
      title: kr.title,
      target_value: kr.target_value,
      unit: kr.unit,
      deadline: kr.deadline
    }]);
    toast.success("Key Result aggiunto!");
  };

  // Add empty KR
  const addEmptyKR = () => {
    setKeyResults([...keyResults, {
      id: generateId(),
      title: "",
      target_value: 0,
      unit: "",
      deadline: targetDate
    }]);
  };

  // Remove KR
  const removeKR = (id: string) => {
    setKeyResults(keyResults.filter(kr => kr.id !== id));
  };

  // Update KR field
  const updateKR = (id: string, field: keyof KeyResultDraft, value: any) => {
    setKeyResults(keyResults.map(kr => 
      kr.id === id ? { ...kr, [field]: value } : kr
    ));
  };

  // Step 4: Run OKR Check
  const runOKRCheck = async () => {
    if (keyResults.length === 0) {
      toast.error("Aggiungi almeno un Key Result");
      return;
    }

    const validKRs = keyResults.filter(kr => kr.title.trim());
    if (validKRs.length === 0) {
      toast.error("Compila almeno un Key Result");
      return;
    }

    setIsCheckingOKR(true);
    try {
      const { data, error } = await supabase.functions.invoke("strategy-wise-oracle", {
        body: { 
          action: "check_okr",
          data: { 
            objective: {
              title: objectiveTitle,
              description: objectiveDescription,
              target_date: targetDate
            },
            key_results: validKRs
          }
        },
      });

      if (error) throw error;

      setOkrCheck(data.check);
      setStep(5);
    } catch (error: any) {
      console.error("OKR check error:", error);
      toast.error("Errore nel check OKR: " + error.message);
    } finally {
      setIsCheckingOKR(false);
    }
  };

  // Save OKR
  const saveOKR = async () => {
    setIsLoading(true);
    try {
      const { data: objData, error: objError } = await supabase
        .from("strategic_objectives")
        .insert({
          title: objectiveTitle,
          description: objectiveDescription,
          target_date: targetDate || null,
          source: "manual",
          status: "validated",
          wise_analysis: okrCheck as any
        })
        .select()
        .single();

      if (objError) throw objError;

      for (const kr of keyResults.filter(kr => kr.title.trim())) {
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

      toast.success("OKR salvato con successo!");
      resetWizard();
    } catch (error: any) {
      toast.error("Errore nel salvataggio: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep(1);
    setObjectiveTitle("");
    setObjectiveDescription("");
    setTargetDate("");
    setTimelineAnalysis(null);
    setSuggestedKRs([]);
    setKeyResults([]);
    setOkrCheck(null);
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const getStepProgress = () => (step / 5) * 100;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "low": return "text-green-600";
      case "medium": return "text-amber-500";
      case "high": return "text-red-500";
      default: return "text-muted-foreground";
    }
  };

  const getKRCountIcon = (status: string) => {
    switch (status) {
      case "optimal": return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "too_few": return <AlertCircle className="h-5 w-5 text-amber-500" />;
      case "too_many": return <XCircle className="h-5 w-5 text-red-500" />;
      default: return null;
    }
  };

  // Calculate default target date (3 months from now)
  useEffect(() => {
    if (!targetDate) {
      const threeMonthsLater = new Date();
      threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);
      setTargetDate(threeMonthsLater.toISOString().split("T")[0]);
    }
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg">
            <Sparkles className="h-8 w-8" />
          </div>
        </div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Strategy Wise Oracle
        </h1>
        <p className="text-muted-foreground">
          Crea OKR intelligenti con l'aiuto dell'AI
        </p>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Step {step} di 5</span>
          <span>{Math.round(getStepProgress())}% completato</span>
        </div>
        <Progress value={getStepProgress()} className="h-2" />
        <div className="flex justify-between">
          {["Obiettivo", "Timeline", "Suggerimenti", "I Tuoi KR", "Check"].map((label, i) => (
            <div 
              key={label}
              className={cn(
                "flex flex-col items-center gap-1 text-xs",
                step > i + 1 ? "text-primary" : step === i + 1 ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all",
                step > i + 1 ? "bg-primary text-primary-foreground" : 
                step === i + 1 ? "bg-primary/20 text-primary ring-2 ring-primary" : 
                "bg-muted text-muted-foreground"
              )}>
                {step > i + 1 ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span className="hidden sm:block">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Define Objective */}
      {step === 1 && (
        <Card className="border-2 border-indigo-100 dark:border-indigo-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-xl bg-indigo-100 dark:bg-indigo-900 w-fit mb-2">
              <Target className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <CardTitle className="text-2xl">Definisci il tuo Obiettivo</CardTitle>
            <CardDescription>
              Qual è il grande traguardo che vuoi raggiungere?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label className="text-base font-medium">
                Titolo dell'Obiettivo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={objectiveTitle}
                onChange={(e) => setObjectiveTitle(e.target.value)}
                placeholder="Es: Raddoppiare le vendite nel mercato DACH"
                className="text-lg h-12"
              />
              <p className="text-xs text-muted-foreground">
                💡 Un buon obiettivo è ambizioso ma raggiungibile, chiaro e ispirante
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium">Descrizione</Label>
              <Textarea
                value={objectiveDescription}
                onChange={(e) => setObjectiveDescription(e.target.value)}
                placeholder="Descrivi il contesto, le motivazioni e cosa significa raggiungere questo obiettivo..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Data Target
              </Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full sm:w-auto"
              />
              <p className="text-xs text-muted-foreground">
                Di default impostiamo 3 mesi. L'AI ti dirà se è realistico.
              </p>
            </div>

            <Button 
              onClick={analyzeObjective} 
              disabled={isAnalyzingTimeline || !objectiveTitle.trim()}
              className="w-full h-12 text-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {isAnalyzingTimeline ? (
                <>
                  <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                  Analisi in corso...
                </>
              ) : (
                <>
                  Analizza con l'AI
                  <ChevronRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Timeline Analysis */}
      {step === 2 && timelineAnalysis && (
        <Card className="border-2 border-amber-100 dark:border-amber-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-xl bg-amber-100 dark:bg-amber-900 w-fit mb-2">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <CardTitle className="text-2xl">Analisi Timeline</CardTitle>
            <CardDescription>
              L'AI ha valutato la fattibilità temporale del tuo obiettivo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Objective Summary */}
            <div className="p-4 bg-muted/50 rounded-xl">
              <h3 className="font-medium mb-1">{objectiveTitle}</h3>
              {objectiveDescription && (
                <p className="text-sm text-muted-foreground">{objectiveDescription}</p>
              )}
              <div className="mt-2 text-sm">
                <span className="text-muted-foreground">Target: </span>
                <span className="font-medium">{new Date(targetDate).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            </div>

            {/* AI Analysis */}
            <div className={cn(
              "p-6 rounded-xl border-2",
              timelineAnalysis.is_appropriate 
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800"
                : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
            )}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  "p-2 rounded-lg",
                  timelineAnalysis.is_appropriate ? "bg-green-200 dark:bg-green-800" : "bg-amber-200 dark:bg-amber-800"
                )}>
                  {timelineAnalysis.is_appropriate ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <h4 className="font-semibold text-lg">
                    {timelineAnalysis.is_appropriate 
                      ? "Timeline appropriata!" 
                      : "Attenzione alla timeline"}
                  </h4>
                  <p className="text-sm">{timelineAnalysis.reasoning}</p>
                  <div className="flex flex-wrap gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Durata suggerita: <strong>{timelineAnalysis.suggested_duration}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className={cn("h-4 w-4", getRiskColor(timelineAnalysis.risk_level))} />
                      <span className="text-sm">
                        Rischio: <strong className={getRiskColor(timelineAnalysis.risk_level)}>
                          {timelineAnalysis.risk_level === "low" ? "Basso" : 
                           timelineAnalysis.risk_level === "medium" ? "Medio" : "Alto"}
                        </strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Modifica Obiettivo
              </Button>
              <Button 
                onClick={generateKRSuggestions}
                disabled={isGeneratingKRs}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                {isGeneratingKRs ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Generazione KR...
                  </>
                ) : (
                  <>
                    Suggerisci Key Results
                    <Sparkles className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: AI Suggested KRs */}
      {step === 3 && (
        <Card className="border-2 border-purple-100 dark:border-purple-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-xl bg-purple-100 dark:bg-purple-900 w-fit mb-2">
              <Lightbulb className="h-8 w-8 text-purple-600 dark:text-purple-400" />
            </div>
            <CardTitle className="text-2xl">Key Results Suggeriti</CardTitle>
            <CardDescription>
              L'AI suggerisce questi KR per il tuo obiettivo. Aggiungili o passa ai tuoi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {suggestedKRs.length > 0 ? (
              <>
                <div className="space-y-3">
                  {suggestedKRs.map((kr, index) => (
                    <div 
                      key={index}
                      className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 rounded-xl border border-purple-200 dark:border-purple-800"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium">{kr.title}</h4>
                          <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Target: {kr.target_value} {kr.unit}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(kr.deadline).toLocaleDateString("it-IT")}
                            </span>
                          </div>
                          {kr.rationale && (
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              💡 {kr.rationale}
                            </p>
                          )}
                        </div>
                        <Button 
                          size="sm"
                          onClick={() => addSuggestedKR(kr)}
                          disabled={keyResults.some(k => k.title === kr.title)}
                        >
                          {keyResults.some(k => k.title === kr.title) ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {keyResults.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800 text-sm">
                    <Check className="h-4 w-4 inline mr-2 text-green-600" />
                    {keyResults.length} Key Result{keyResults.length > 1 ? "s" : ""} aggiunti
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nessun suggerimento disponibile</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
              <Button 
                onClick={() => setStep(4)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                Definisci i Tuoi KR
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: User Key Results */}
      {step === 4 && (
        <Card className="border-2 border-blue-100 dark:border-blue-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-xl bg-blue-100 dark:bg-blue-900 w-fit mb-2">
              <Target className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <CardTitle className="text-2xl">I Tuoi Key Results</CardTitle>
            <CardDescription>
              Aggiungi o modifica i Key Results. L'AI li analizzerà nel prossimo step.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Objective reminder */}
            <div className="p-3 bg-muted/50 rounded-lg text-sm">
              <span className="font-medium">Obiettivo: </span>
              {objectiveTitle}
            </div>

            {/* KR List */}
            <div className="space-y-4">
              {keyResults.map((kr, index) => (
                <div 
                  key={kr.id}
                  className="p-4 border rounded-xl space-y-3 bg-card"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">
                      Key Result #{index + 1}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeKR(kr.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Es: Chiudere 10 nuovi contratti nella regione DACH"
                    value={kr.title}
                    onChange={(e) => updateKR(kr.id, "title", e.target.value)}
                  />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Target</Label>
                      <Input
                        type="number"
                        value={kr.target_value}
                        onChange={(e) => updateKR(kr.id, "target_value", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Unità</Label>
                      <Input
                        placeholder="%, €, n°..."
                        value={kr.unit}
                        onChange={(e) => updateKR(kr.id, "unit", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Deadline</Label>
                      <Input
                        type="date"
                        value={kr.deadline}
                        onChange={(e) => updateKR(kr.id, "deadline", e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add KR Button */}
            <Button 
              variant="outline" 
              onClick={addEmptyKR}
              className="w-full border-dashed"
            >
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Key Result
            </Button>

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
              <p className="font-medium mb-1">💡 Suggerimenti per buoni Key Results:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Devono essere <strong>misurabili</strong> con numeri concreti</li>
                <li>Idealmente tra <strong>2 e 5 KR</strong> per obiettivo</li>
                <li>Devono essere <strong>sfidanti ma raggiungibili</strong></li>
                <li>Evita KR vaghi come "migliorare" o "aumentare"</li>
              </ul>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={goBack} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
              <Button 
                onClick={runOKRCheck}
                disabled={isCheckingOKR || keyResults.length === 0}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700"
              >
                {isCheckingOKR ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analisi in corso...
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4 mr-2" />
                    Esegui OKR Check
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: OKR Check Results */}
      {step === 5 && okrCheck && (
        <Card className="border-2 border-green-100 dark:border-green-900 shadow-lg">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto p-3 rounded-xl bg-green-100 dark:bg-green-900 w-fit mb-2">
              <Scale className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">OKR Check Completato</CardTitle>
            <CardDescription>
              Ecco l'analisi del tuo OKR. Salva o torna indietro per modificare.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Overall Score */}
            <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-xl">
              <div className="text-6xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {okrCheck.overall_score}%
              </div>
              <p className="text-muted-foreground mt-1">Punteggio OKR</p>
            </div>

            {/* KR Count Assessment */}
            <div className={cn(
              "p-4 rounded-xl flex items-start gap-3",
              okrCheck.kr_count_assessment.status === "optimal" 
                ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800"
                : okrCheck.kr_count_assessment.status === "too_few"
                  ? "bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800"
                  : "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800"
            )}>
              {getKRCountIcon(okrCheck.kr_count_assessment.status)}
              <div>
                <h4 className="font-medium">Numero di Key Results</h4>
                <p className="text-sm text-muted-foreground">{okrCheck.kr_count_assessment.message}</p>
              </div>
            </div>

            {/* Strengths */}
            {okrCheck.strengths?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Punti di Forza
                </h4>
                <ul className="space-y-1">
                  {okrCheck.strengths.map((s, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Issues */}
            {okrCheck.issues?.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  Aree di Miglioramento
                </h4>
                <ul className="space-y-1">
                  {okrCheck.issues.map((issue, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {okrCheck.recommendations?.length > 0 && (
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800">
                <h4 className="font-medium flex items-center gap-2 text-blue-600 mb-2">
                  <Lightbulb className="h-4 w-4" />
                  Raccomandazioni
                </h4>
                <ul className="space-y-1">
                  {okrCheck.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-muted-foreground">• {rec}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => setStep(4)} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Modifica KR
              </Button>
              <Button 
                onClick={saveOKR}
                disabled={isLoading}
                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Salva OKR
                  </>
                )}
              </Button>
            </div>

            {/* Start Over */}
            <Button 
              variant="ghost" 
              onClick={resetWizard}
              className="w-full text-muted-foreground"
            >
              Ricomincia da capo
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
