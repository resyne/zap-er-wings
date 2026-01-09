import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Target, 
  Plus,
  ChevronRight,
  Calendar,
  FolderKanban,
  CheckCircle2,
  Clock,
  TrendingUp,
  MoreHorizontal,
  Trash2,
  Edit,
  Eye,
  Sparkles,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Project {
  id: string;
  customer_name: string;
  code: string;
  status: string;
}

interface KeyResult {
  id: string;
  objective_id: string;
  title: string;
  description?: string;
  target_value: number;
  current_value: number;
  unit: string;
  deadline?: string;
  status: string;
  project_id?: string;
  created_at: string;
  project?: Project | null;
}

interface StrategicObjective {
  id: string;
  title: string;
  description?: string;
  status: string;
  quarter?: string;
  year?: number;
  target_date?: string;
  created_at: string;
  key_results?: KeyResult[];
}

const QUARTERS = [
  { value: "Q1", label: "Q1 (Gen-Mar)" },
  { value: "Q2", label: "Q2 (Apr-Giu)" },
  { value: "Q3", label: "Q3 (Lug-Set)" },
  { value: "Q4", label: "Q4 (Ott-Dic)" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

export default function StrategyPage() {
  const navigate = useNavigate();
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  
  // Dialog states
  const [isNewObjectiveOpen, setIsNewObjectiveOpen] = useState(false);
  const [isNewKROpen, setIsNewKROpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  
  // Form states
  const [newObjective, setNewObjective] = useState({
    title: "",
    description: "",
    quarter: getCurrentQuarter(),
    year: CURRENT_YEAR,
  });
  
  const [newKR, setNewKR] = useState({
    title: "",
    description: "",
    target_value: 100,
    unit: "%",
    deadline: "",
  });

  function getCurrentQuarter(): string {
    const month = new Date().getMonth();
    if (month < 3) return "Q1";
    if (month < 6) return "Q2";
    if (month < 9) return "Q3";
    return "Q4";
  }

  const fetchObjectives = async () => {
    setIsLoading(true);
    try {
      let query = supabase
        .from("strategic_objectives")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (selectedQuarter !== "all") {
        query = query.eq("quarter", selectedQuarter);
      }
      if (selectedYear) {
        query = query.eq("year", selectedYear);
      }

      const { data: objectivesData, error: objError } = await query;
      if (objError) throw objError;

      // Fetch key results for each objective with their linked projects
      const objectivesWithKRs = await Promise.all(
        (objectivesData || []).map(async (obj) => {
          const { data: krData } = await supabase
            .from("key_results")
            .select("*, management_projects!key_results_project_id_fkey(id, customer_name, code, status)")
            .eq("objective_id", obj.id)
            .order("created_at", { ascending: true });
          
          const krsWithProjects = (krData || []).map((kr: any) => ({
            ...kr,
            project: kr.management_projects || null,
          }));
          
          return { ...obj, key_results: krsWithProjects };
        })
      );

      setObjectives(objectivesWithKRs);
    } catch (error: any) {
      console.error("Error fetching objectives:", error);
      toast.error("Errore nel caricamento degli obiettivi");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchObjectives();
  }, [selectedQuarter, selectedYear]);

  const handleCreateObjective = async () => {
    if (!newObjective.title.trim()) {
      toast.error("Inserisci un titolo per l'obiettivo");
      return;
    }

    try {
      const { error } = await supabase.from("strategic_objectives").insert({
        title: newObjective.title,
        description: newObjective.description || null,
        quarter: newObjective.quarter,
        year: newObjective.year,
        status: "draft",
        source: "manual",
      });

      if (error) throw error;

      toast.success("Obiettivo creato con successo!");
      setIsNewObjectiveOpen(false);
      setNewObjective({
        title: "",
        description: "",
        quarter: getCurrentQuarter(),
        year: CURRENT_YEAR,
      });
      fetchObjectives();
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleCreateKR = async () => {
    if (!selectedObjective || !newKR.title.trim()) {
      toast.error("Inserisci un titolo per il Key Result");
      return;
    }

    try {
      // 1. Generate project code
      const projectCode = `PRJ-${Date.now().toString(36).toUpperCase()}`;
      
      // 2. Create the project first
      const { data: projectData, error: projectError } = await supabase
        .from("management_projects")
        .insert({
          customer_name: newKR.title,
          code: projectCode,
          project_type: "strategic",
          status: "planning",
          objective_id: selectedObjective.id,
        })
        .select()
        .single();

      if (projectError) throw projectError;

      // 3. Create the Key Result linked to the project
      const { error: krError } = await supabase.from("key_results").insert({
        objective_id: selectedObjective.id,
        title: newKR.title,
        description: newKR.description || null,
        target_value: newKR.target_value,
        current_value: 0,
        unit: newKR.unit,
        deadline: newKR.deadline || null,
        status: "on_track",
        project_id: projectData.id,
      });

      if (krError) throw krError;

      // 4. Update the project with the key_result_id (reverse link)
      const { data: krData } = await supabase
        .from("key_results")
        .select("id")
        .eq("project_id", projectData.id)
        .single();

      if (krData) {
        await supabase
          .from("management_projects")
          .update({ key_result_id: krData.id })
          .eq("id", projectData.id);
      }

      toast.success("Key Result e Progetto creati!");
      setIsNewKROpen(false);
      setNewKR({
        title: "",
        description: "",
        target_value: 100,
        unit: "%",
        deadline: "",
      });
      fetchObjectives();
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo obiettivo?")) return;
    
    try {
      const { error } = await supabase.from("strategic_objectives").delete().eq("id", id);
      if (error) throw error;
      toast.success("Obiettivo eliminato");
      fetchObjectives();
    } catch (error: any) {
      toast.error("Errore nell'eliminazione: " + error.message);
    }
  };

  const handleDeleteKR = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo Key Result e il progetto collegato?")) return;
    
    try {
      // First, get the KR to find linked project
      const { data: kr } = await supabase
        .from("key_results")
        .select("project_id")
        .eq("id", id)
        .single();

      // Delete the Key Result
      const { error } = await supabase.from("key_results").delete().eq("id", id);
      if (error) throw error;

      // Delete the linked project if exists
      if (kr?.project_id) {
        await supabase.from("management_projects").delete().eq("id", kr.project_id);
      }

      toast.success("Key Result e Progetto eliminati");
      fetchObjectives();
    } catch (error: any) {
      toast.error("Errore nell'eliminazione: " + error.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "validated": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "completed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "draft": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getKRStatusColor = (status: string) => {
    switch (status) {
      case "on_track": return "text-green-600";
      case "at_risk": return "text-amber-600";
      case "behind": return "text-red-600";
      case "completed": return "text-emerald-600";
      default: return "text-muted-foreground";
    }
  };

  const calculateProgress = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, (current / target) * 100);
  };

  const getObjectiveProgress = (objective: StrategicObjective) => {
    const krs = objective.key_results || [];
    if (krs.length === 0) return 0;
    
    const totalProgress = krs.reduce((acc, kr) => {
      return acc + calculateProgress(kr.current_value, kr.target_value);
    }, 0);
    
    return totalProgress / krs.length;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Strategy</h1>
              <p className="text-muted-foreground text-sm">
                Definisci obiettivi trimestrali e Key Results con <span className="font-medium text-indigo-600">WiseRule</span>
              </p>
            </div>
          </div>
        </div>
        
        <Dialog open={isNewObjectiveOpen} onOpenChange={setIsNewObjectiveOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Nuovo Obiettivo
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nuovo Obiettivo Trimestrale</DialogTitle>
              <DialogDescription>
                Definisci un obiettivo strategico per il trimestre selezionato
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Trimestre</Label>
                  <Select 
                    value={newObjective.quarter} 
                    onValueChange={(v) => setNewObjective({ ...newObjective, quarter: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUARTERS.map((q) => (
                        <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Anno</Label>
                  <Select 
                    value={String(newObjective.year)} 
                    onValueChange={(v) => setNewObjective({ ...newObjective, year: parseInt(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {YEARS.map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Titolo Obiettivo *</Label>
                <Input
                  value={newObjective.title}
                  onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                  placeholder="Es: Raddoppiare le vendite nel mercato DACH"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Descrizione</Label>
                <Textarea
                  value={newObjective.description}
                  onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                  placeholder="Descrivi il contesto e cosa significa raggiungere questo obiettivo..."
                  rows={3}
                />
              </div>
              
              <Button onClick={handleCreateObjective} className="w-full">
                Crea Obiettivo
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={selectedQuarter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedQuarter("all")}
              >
                Tutti
              </Button>
              {QUARTERS.map((q) => (
                <Button
                  key={q.value}
                  variant={selectedQuarter === q.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedQuarter(q.value)}
                >
                  {q.value}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objectives List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground mt-4">Caricamento obiettivi...</p>
        </div>
      ) : objectives.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessun obiettivo definito</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Inizia creando il tuo primo obiettivo trimestrale
            </p>
            <Button onClick={() => setIsNewObjectiveOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crea Obiettivo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {objectives.map((objective) => {
            const progress = getObjectiveProgress(objective);
            const krCount = objective.key_results?.length || 0;
            
            return (
              <Card key={objective.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {objective.quarter} {objective.year}
                        </Badge>
                        <Badge className={getStatusColor(objective.status)}>
                          {objective.status === "draft" ? "Bozza" : 
                           objective.status === "validated" ? "Validato" :
                           objective.status === "in_progress" ? "In Corso" :
                           objective.status === "completed" ? "Completato" : objective.status}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg">{objective.title}</CardTitle>
                      {objective.description && (
                        <CardDescription className="mt-1">{objective.description}</CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteObjective(objective.id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progresso complessivo</span>
                      <span className="font-medium">{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                </CardHeader>
                
                <CardContent>
                  {/* Key Results */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        Key Results ({krCount})
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedObjective(objective);
                          setIsNewKROpen(true);
                        }}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Aggiungi KR
                      </Button>
                    </div>
                    
                    {krCount === 0 ? (
                      <p className="text-sm text-muted-foreground italic py-4 text-center">
                        Nessun Key Result definito. Aggiungi il primo per tracciare il progresso.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {objective.key_results?.map((kr) => {
                          const krProgress = calculateProgress(kr.current_value, kr.target_value);
                          
                          return (
                            <div 
                              key={kr.id} 
                              className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className={cn("text-sm", getKRStatusColor(kr.status))}>
                                      {kr.status === "on_track" ? "●" : 
                                       kr.status === "at_risk" ? "◐" :
                                       kr.status === "behind" ? "○" : "✓"}
                                    </span>
                                    <span className="font-medium text-sm truncate">{kr.title}</span>
                                  </div>
                                  <div className="flex items-center gap-4 mt-2">
                                    <div className="flex-1">
                                      <Progress value={krProgress} className="h-1.5" />
                                    </div>
                                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                                      {kr.current_value} / {kr.target_value} {kr.unit}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2">
                                    {kr.deadline && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        Scadenza: {format(new Date(kr.deadline), "dd MMM yyyy", { locale: it })}
                                      </div>
                                    )}
                                    {kr.project && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-5 px-2 text-xs text-primary"
                                        onClick={() => navigate(`/controllo-gestione/projects`)}
                                      >
                                        <FolderKanban className="h-3 w-3 mr-1" />
                                        {kr.project.code}
                                        <ExternalLink className="h-2.5 w-2.5 ml-1" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteKR(kr.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New KR Dialog */}
      <Dialog open={isNewKROpen} onOpenChange={setIsNewKROpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo Key Result</DialogTitle>
            <DialogDescription>
              {selectedObjective && `Per l'obiettivo: ${selectedObjective.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Titolo Key Result *</Label>
              <Input
                value={newKR.title}
                onChange={(e) => setNewKR({ ...newKR, title: e.target.value })}
                placeholder="Es: Acquisire 10 nuovi clienti enterprise"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Descrizione</Label>
              <Textarea
                value={newKR.description}
                onChange={(e) => setNewKR({ ...newKR, description: e.target.value })}
                placeholder="Descrivi come misurerai questo risultato..."
                rows={2}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valore Target</Label>
                <Input
                  type="number"
                  value={newKR.target_value}
                  onChange={(e) => setNewKR({ ...newKR, target_value: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Unità di Misura</Label>
                <Select value={newKR.unit} onValueChange={(v) => setNewKR({ ...newKR, unit: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="%">%</SelectItem>
                    <SelectItem value="€">€</SelectItem>
                    <SelectItem value="unità">unità</SelectItem>
                    <SelectItem value="clienti">clienti</SelectItem>
                    <SelectItem value="ore">ore</SelectItem>
                    <SelectItem value="punti">punti</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Scadenza</Label>
              <Input
                type="date"
                value={newKR.deadline}
                onChange={(e) => setNewKR({ ...newKR, deadline: e.target.value })}
              />
            </div>
            
            <Button onClick={handleCreateKR} className="w-full">
              Crea Key Result
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
