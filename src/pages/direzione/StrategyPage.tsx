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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Target, 
  Plus,
  ChevronRight,
  ChevronDown,
  Calendar,
  FolderKanban,
  Clock,
  Trash2,
  Compass,
  Focus,
  ExternalLink,
  Info,
  AlertTriangle,
  Building2,
  ArrowLeft,
  Settings,
  Eye,
  EyeOff,
  Sparkles,
  Settings2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, addMonths } from "date-fns";
import { it } from "date-fns/locale";
import { GovernancePresetDialog } from "@/components/strategy/GovernancePresetDialog";

// ==================== TYPES ====================

interface BusinessUnit {
  id: string;
  name: string;
  code: string;
  description?: string;
  color: string;
  logo_url?: string;
  is_active: boolean;
}

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
  focus_id?: string;
  scope_included?: string[];
  scope_excluded?: string[];
  business_unit_id?: string;
  target_date?: string;
  created_at: string;
  key_results?: KeyResult[];
}

interface StrategicFocus {
  id: string;
  vision_id?: string;
  title: string;
  description?: string;
  status: string;
  business_unit_id?: string;
  start_date: string;
  end_date?: string;
  created_at: string;
}

interface StrategicVision {
  id: string;
  title: string;
  description?: string;
  status: string;
  business_unit_id?: string;
  start_date: string;
  end_date?: string;
  observation_kpis?: any[];
  created_at: string;
}

// ==================== CONSTANTS ====================

const QUARTERS = [
  { value: "Q1", label: "Q1 (Gen-Mar)" },
  { value: "Q2", label: "Q2 (Apr-Giu)" },
  { value: "Q3", label: "Q3 (Lug-Set)" },
  { value: "Q4", label: "Q4 (Ott-Dic)" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

const AREAS = [
  "Commerciale",
  "Produzione",
  "Marketing",
  "Amministrazione",
  "R&D",
  "Assistenza",
  "Logistica",
];

function getCurrentQuarter(): string {
  const month = new Date().getMonth();
  if (month < 3) return "Q1";
  if (month < 6) return "Q2";
  if (month < 9) return "Q3";
  return "Q4";
}

// ==================== COMPONENT ====================

export default function StrategyPage() {
  const navigate = useNavigate();
  
  // Business Unit states
  const [businessUnits, setBusinessUnits] = useState<BusinessUnit[]>([]);
  const [selectedBU, setSelectedBU] = useState<BusinessUnit | null>(null);
  const [isManageBUOpen, setIsManageBUOpen] = useState(false);
  const [newBU, setNewBU] = useState({ name: "", code: "", description: "", color: "#3B82F6" });
  
  // Data states for selected BU
  const [vision, setVision] = useState<StrategicVision | null>(null);
  const [focus, setFocus] = useState<StrategicFocus | null>(null);
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Filters
  const [selectedQuarter, setSelectedQuarter] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);
  
  // Dialog states
  const [isNewVisionOpen, setIsNewVisionOpen] = useState(false);
  const [isNewFocusOpen, setIsNewFocusOpen] = useState(false);
  const [isNewObjectiveOpen, setIsNewObjectiveOpen] = useState(false);
  const [isNewKROpen, setIsNewKROpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  
  // Collapsible states
  const [visionOpen, setVisionOpen] = useState(true);
  const [focusOpen, setFocusOpen] = useState(true);
  
  // Form states
  const [newVision, setNewVision] = useState({
    title: "",
    description: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
  });
  
  const [newFocus, setNewFocus] = useState({
    title: "",
    description: "",
    start_date: format(new Date(), "yyyy-MM-dd"),
    end_date: format(addMonths(new Date(), 6), "yyyy-MM-dd"),
  });
  
  const [newObjective, setNewObjective] = useState({
    title: "",
    description: "",
    quarter: getCurrentQuarter(),
    year: CURRENT_YEAR,
    scope_included: [] as string[],
    scope_excluded: [] as string[],
  });
  
  const [newKR, setNewKR] = useState({
    title: "",
    description: "",
    target_value: 100,
    unit: "%",
    deadline: "",
  });

  // ==================== DATA FETCHING ====================

  const fetchBusinessUnits = async () => {
    try {
      const { data, error } = await supabase
        .from("business_units")
        .select("*")
        .order("name");
      
      if (error) throw error;
      setBusinessUnits(data || []);
    } catch (error: any) {
      console.error("Error fetching business units:", error);
    }
  };

  const fetchDataForBU = async (buId: string) => {
    setIsLoading(true);
    try {
      // Fetch active Vision for this BU (only 1 allowed)
      const { data: visionData } = await supabase
        .from("strategic_visions")
        .select("*")
        .eq("business_unit_id", buId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      if (visionData) {
        setVision({
          ...visionData,
          observation_kpis: Array.isArray(visionData.observation_kpis) ? visionData.observation_kpis : [],
        });
      } else {
        setVision(null);
      }

      // Fetch active Focus for this BU (only 1 allowed)
      const { data: focusData } = await supabase
        .from("strategic_focus")
        .select("*")
        .eq("business_unit_id", buId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      
      setFocus(focusData || null);

      // Fetch objectives with filters for this BU
      let query = supabase
        .from("strategic_objectives")
        .select("*")
        .eq("business_unit_id", buId)
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
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBusinessUnits();
  }, []);

  useEffect(() => {
    if (selectedBU) {
      fetchDataForBU(selectedBU.id);
    }
  }, [selectedBU, selectedQuarter, selectedYear]);

  // ==================== BU HANDLERS ====================

  const handleCreateBU = async () => {
    if (!newBU.name.trim() || !newBU.code.trim()) {
      toast.error("Inserisci nome e codice");
      return;
    }

    try {
      const { error } = await supabase.from("business_units").insert({
        name: newBU.name,
        code: newBU.code.toUpperCase(),
        description: newBU.description || null,
        color: newBU.color,
        is_active: true,
      });

      if (error) throw error;
      toast.success("Attività creata!");
      setNewBU({ name: "", code: "", description: "", color: "#3B82F6" });
      fetchBusinessUnits();
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  const handleToggleBU = async (bu: BusinessUnit) => {
    try {
      await supabase
        .from("business_units")
        .update({ is_active: !bu.is_active })
        .eq("id", bu.id);
      fetchBusinessUnits();
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  const handleDeleteBU = async (bu: BusinessUnit) => {
    if (!confirm(`Eliminare l'attività ${bu.name}? Tutti i dati strategici collegati verranno eliminati.`)) return;
    
    try {
      const { error } = await supabase.from("business_units").delete().eq("id", bu.id);
      if (error) throw error;
      toast.success("Attività eliminata");
      fetchBusinessUnits();
      if (selectedBU?.id === bu.id) {
        setSelectedBU(null);
      }
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  // ==================== VISION HANDLERS ====================

  const handleCreateVision = async () => {
    if (!newVision.title.trim() || !selectedBU) {
      toast.error("Inserisci un titolo per la Vision");
      return;
    }

    if (vision) {
      toast.error("Esiste già una Vision attiva. Archiviala prima di crearne una nuova.");
      return;
    }

    try {
      const { error } = await supabase.from("strategic_visions").insert({
        title: newVision.title,
        description: newVision.description || null,
        start_date: newVision.start_date,
        end_date: newVision.end_date || null,
        status: "active",
        business_unit_id: selectedBU.id,
      });

      if (error) throw error;

      toast.success("Vision creata con successo!");
      setIsNewVisionOpen(false);
      setNewVision({
        title: "",
        description: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(addMonths(new Date(), 12), "yyyy-MM-dd"),
      });
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleArchiveVision = async () => {
    if (!vision || !selectedBU) return;
    if (!confirm("Archiviare la Vision attuale? Gli OKR in corso verranno archiviati.")) return;

    try {
      await supabase
        .from("strategic_visions")
        .update({ status: "archived" })
        .eq("id", vision.id);
      
      if (focus) {
        await supabase
          .from("strategic_focus")
          .update({ status: "archived" })
          .eq("id", focus.id);
      }

      toast.success("Vision archiviata");
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  // ==================== FOCUS HANDLERS ====================

  const handleCreateFocus = async () => {
    if (!newFocus.title.trim() || !selectedBU) {
      toast.error("Inserisci un titolo per il Focus Strategico");
      return;
    }

    if (!vision) {
      toast.error("Devi prima creare una Vision attiva");
      return;
    }

    if (focus) {
      toast.error("Esiste già un Focus attivo. Archivialo prima di crearne uno nuovo.");
      return;
    }

    try {
      const { error } = await supabase.from("strategic_focus").insert({
        vision_id: vision.id,
        title: newFocus.title,
        description: newFocus.description || null,
        start_date: newFocus.start_date,
        end_date: newFocus.end_date || null,
        status: "active",
        business_unit_id: selectedBU.id,
      });

      if (error) throw error;

      toast.success("Focus Strategico creato!");
      setIsNewFocusOpen(false);
      setNewFocus({
        title: "",
        description: "",
        start_date: format(new Date(), "yyyy-MM-dd"),
        end_date: format(addMonths(new Date(), 6), "yyyy-MM-dd"),
      });
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleArchiveFocus = async () => {
    if (!focus || !selectedBU) return;
    if (!confirm("Archiviare il Focus attuale?")) return;

    try {
      await supabase
        .from("strategic_focus")
        .update({ status: "archived" })
        .eq("id", focus.id);

      toast.success("Focus archiviato");
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  // ==================== OBJECTIVE HANDLERS ====================

  const handleCreateObjective = async () => {
    if (!newObjective.title.trim() || !selectedBU) {
      toast.error("Inserisci un titolo per l'Obiettivo");
      return;
    }

    if (!focus) {
      toast.error("Devi prima creare un Focus Strategico attivo");
      return;
    }

    if (newObjective.scope_included.length === 0) {
      toast.error("Seleziona almeno un'area coinvolta");
      return;
    }

    try {
      const { error } = await supabase.from("strategic_objectives").insert({
        title: newObjective.title,
        description: newObjective.description || null,
        quarter: newObjective.quarter,
        year: newObjective.year,
        focus_id: focus.id,
        scope_included: newObjective.scope_included,
        scope_excluded: newObjective.scope_excluded,
        status: "draft",
        source: "manual",
        business_unit_id: selectedBU.id,
      });

      if (error) throw error;

      toast.success("Obiettivo creato con successo!");
      setIsNewObjectiveOpen(false);
      setNewObjective({
        title: "",
        description: "",
        quarter: getCurrentQuarter(),
        year: CURRENT_YEAR,
        scope_included: [],
        scope_excluded: [],
      });
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleDeleteObjective = async (id: string) => {
    if (!confirm("Sei sicuro di voler eliminare questo obiettivo?") || !selectedBU) return;
    
    try {
      const { error } = await supabase.from("strategic_objectives").delete().eq("id", id);
      if (error) throw error;
      toast.success("Obiettivo eliminato");
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore nell'eliminazione: " + error.message);
    }
  };

  // ==================== KR HANDLERS ====================

  const handleCreateKR = async () => {
    if (!selectedObjective || !newKR.title.trim() || !selectedBU) {
      toast.error("Inserisci un titolo per il Key Result");
      return;
    }

    try {
      const projectCode = `PRJ-${Date.now().toString(36).toUpperCase()}`;
      
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

      const { data: krData, error: krError } = await supabase.from("key_results").insert({
        objective_id: selectedObjective.id,
        title: newKR.title,
        description: newKR.description || null,
        target_value: newKR.target_value,
        current_value: 0,
        unit: newKR.unit,
        deadline: newKR.deadline || null,
        status: "on_track",
        project_id: projectData.id,
      }).select().single();

      if (krError) throw krError;

      await supabase
        .from("management_projects")
        .update({ key_result_id: krData.id })
        .eq("id", projectData.id);

      toast.success("Key Result e Progetto creati!");
      setIsNewKROpen(false);
      setNewKR({
        title: "",
        description: "",
        target_value: 100,
        unit: "%",
        deadline: "",
      });
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore nella creazione: " + error.message);
    }
  };

  const handleDeleteKR = async (id: string) => {
    if (!confirm("Eliminare questo Key Result e il progetto collegato?") || !selectedBU) return;
    
    try {
      const { data: kr } = await supabase
        .from("key_results")
        .select("project_id")
        .eq("id", id)
        .single();

      const { error } = await supabase.from("key_results").delete().eq("id", id);
      if (error) throw error;

      if (kr?.project_id) {
        await supabase.from("management_projects").delete().eq("id", kr.project_id);
      }

      toast.success("Key Result eliminato");
      fetchDataForBU(selectedBU.id);
    } catch (error: any) {
      toast.error("Errore: " + error.message);
    }
  };

  // ==================== HELPERS ====================

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "validated": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "in_progress": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "completed": return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200";
      case "draft": return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
      case "archived": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
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
    const totalProgress = krs.reduce((acc, kr) => acc + calculateProgress(kr.current_value, kr.target_value), 0);
    return totalProgress / krs.length;
  };

  const toggleScopeArea = (area: string, type: "included" | "excluded") => {
    if (type === "included") {
      const current = newObjective.scope_included;
      if (current.includes(area)) {
        setNewObjective({ ...newObjective, scope_included: current.filter(a => a !== area) });
      } else {
        setNewObjective({ 
          ...newObjective, 
          scope_included: [...current, area],
          scope_excluded: newObjective.scope_excluded.filter(a => a !== area)
        });
      }
    } else {
      const current = newObjective.scope_excluded;
      if (current.includes(area)) {
        setNewObjective({ ...newObjective, scope_excluded: current.filter(a => a !== area) });
      } else {
        setNewObjective({ 
          ...newObjective, 
          scope_excluded: [...current, area],
          scope_included: newObjective.scope_included.filter(a => a !== area)
        });
      }
    }
  };

  // ==================== RENDER: DASHBOARD VIEW ====================

  if (!selectedBU) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Strategy Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                Seleziona un'attività per gestire Vision, Focus e OKR
              </p>
            </div>
          </div>
          <Dialog open={isManageBUOpen} onOpenChange={setIsManageBUOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Gestisci Attività
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Gestione Attività (Business Units)</DialogTitle>
                <DialogDescription>
                  Aggiungi, modifica o rimuovi le attività aziendali
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                {/* Add new BU */}
                <div className="p-4 border rounded-lg space-y-4">
                  <h4 className="font-medium">Nuova Attività</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome *</Label>
                      <Input
                        value={newBU.name}
                        onChange={(e) => setNewBU({ ...newBU, name: e.target.value })}
                        placeholder="Es: ZAPPER"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Codice *</Label>
                      <Input
                        value={newBU.code}
                        onChange={(e) => setNewBU({ ...newBU, code: e.target.value.toUpperCase() })}
                        placeholder="Es: ZAP"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2 col-span-2">
                      <Label>Descrizione</Label>
                      <Input
                        value={newBU.description}
                        onChange={(e) => setNewBU({ ...newBU, description: e.target.value })}
                        placeholder="Descrizione opzionale"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Colore</Label>
                      <Input
                        type="color"
                        value={newBU.color}
                        onChange={(e) => setNewBU({ ...newBU, color: e.target.value })}
                        className="h-10 p-1"
                      />
                    </div>
                  </div>
                  <Button onClick={handleCreateBU} className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi Attività
                  </Button>
                </div>

                {/* Existing BUs */}
                <div className="space-y-2">
                  <h4 className="font-medium">Attività Esistenti</h4>
                  {businessUnits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">Nessuna attività definita</p>
                  ) : (
                    <div className="space-y-2">
                      {businessUnits.map((bu) => (
                        <div
                          key={bu.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-lg border",
                            !bu.is_active && "opacity-50"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: bu.color }}
                            />
                            <div>
                              <span className="font-medium">{bu.name}</span>
                              <span className="text-sm text-muted-foreground ml-2">({bu.code})</span>
                              {bu.description && (
                                <p className="text-xs text-muted-foreground">{bu.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleBU(bu)}
                              title={bu.is_active ? "Disattiva" : "Attiva"}
                            >
                              {bu.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDeleteBU(bu)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Business Units Cards */}
        {businessUnits.filter(bu => bu.is_active).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nessuna Attività Definita</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Crea la tua prima attività per iniziare a definire la strategia
              </p>
              <Button onClick={() => setIsManageBUOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Attività
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {businessUnits.filter(bu => bu.is_active).map((bu) => (
              <Card 
                key={bu.id}
                className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50"
                onClick={() => setSelectedBU(bu)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                      style={{ backgroundColor: bu.color }}
                    >
                      {bu.code.substring(0, 2)}
                    </div>
                    <div>
                      <CardTitle className="text-xl">{bu.name}</CardTitle>
                      {bu.description && (
                        <CardDescription>{bu.description}</CardDescription>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Clicca per gestire strategia</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==================== RENDER: STRATEGY VIEW FOR SELECTED BU ====================

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header with Back Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setSelectedBU(null)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold"
              style={{ backgroundColor: selectedBU.color }}
            >
              {selectedBU.code.substring(0, 2)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{selectedBU.name}</h1>
              <p className="text-muted-foreground text-sm">
                Strategy OKR con <span className="font-medium text-indigo-600">WiseRule</span>
              </p>
            </div>
          </div>
        </div>
        <GovernancePresetDialog
          businessUnitId={selectedBU.id}
          businessUnitName={selectedBU.name}
          businessUnitCode={selectedBU.code}
          trigger={
            <Button variant="outline" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Governance Preset
            </Button>
          }
        />
      </div>

      {/* 1️⃣ VISION SECTION */}
      <Collapsible open={visionOpen} onOpenChange={setVisionOpen}>
        <Card className={cn("border-2", vision ? "border-indigo-200 dark:border-indigo-800" : "border-dashed")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900">
                    <Compass className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Vision
                      <Badge variant="outline" className="text-xs font-normal">6-12 mesi</Badge>
                    </CardTitle>
                    <CardDescription>Strategic Intent - La direzione di medio periodo</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {vision && (
                    <Badge className={getStatusColor(vision.status)}>
                      {vision.status === "active" ? "Attiva" : vision.status}
                    </Badge>
                  )}
                  {visionOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {!vision ? (
                <div className="text-center py-8">
                  <Compass className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground mb-4">Nessuna Vision attiva definita</p>
                  <Dialog open={isNewVisionOpen} onOpenChange={setIsNewVisionOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Crea Vision
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Nuova Vision per {selectedBU.name}</DialogTitle>
                        <DialogDescription>
                          Definisci la direzione strategica di medio periodo (6-12 mesi)
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                          <div className="flex gap-2">
                            <Info className="h-4 w-4 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                              <strong>Caratteristiche:</strong> Qualitativa, senza KPI diretti, non gestita come OKR.
                            </div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Titolo Vision *</Label>
                          <Input
                            value={newVision.title}
                            onChange={(e) => setNewVision({ ...newVision, title: e.target.value })}
                            placeholder="Es: Espandere sui mercati esteri"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Descrizione</Label>
                          <Textarea
                            value={newVision.description}
                            onChange={(e) => setNewVision({ ...newVision, description: e.target.value })}
                            placeholder="Descrivi cosa significa questa Vision..."
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Data Inizio</Label>
                            <Input
                              type="date"
                              value={newVision.start_date}
                              onChange={(e) => setNewVision({ ...newVision, start_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Data Fine</Label>
                            <Input
                              type="date"
                              value={newVision.end_date}
                              onChange={(e) => setNewVision({ ...newVision, end_date: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <Button onClick={handleCreateVision} className="w-full">
                          Crea Vision
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border border-indigo-100 dark:border-indigo-800">
                    <h3 className="font-semibold text-lg text-indigo-900 dark:text-indigo-100">{vision.title}</h3>
                    {vision.description && (
                      <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-1">{vision.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-indigo-600 dark:text-indigo-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(vision.start_date), "MMM yyyy", { locale: it })}
                        {vision.end_date && ` → ${format(new Date(vision.end_date), "MMM yyyy", { locale: it })}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleArchiveVision}>
                      Archivia Vision
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 2️⃣ FOCUS STRATEGICO SECTION */}
      <Collapsible open={focusOpen} onOpenChange={setFocusOpen}>
        <Card className={cn("border-2", focus ? "border-purple-200 dark:border-purple-800" : "border-dashed")}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900">
                    <Focus className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      Focus Strategico
                      <Badge variant="outline" className="text-xs font-normal">6 mesi</Badge>
                    </CardTitle>
                    <CardDescription>Strategic Theme - La priorità dominante</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {focus && (
                    <Badge className={getStatusColor(focus.status)}>
                      {focus.status === "active" ? "Attivo" : focus.status}
                    </Badge>
                  )}
                  {focusOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {!vision ? (
                <div className="text-center py-6">
                  <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
                  <p className="text-muted-foreground text-sm">Crea prima una Vision attiva</p>
                </div>
              ) : !focus ? (
                <div className="text-center py-8">
                  <Focus className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground mb-4">Nessun Focus Strategico attivo</p>
                  <Dialog open={isNewFocusOpen} onOpenChange={setIsNewFocusOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Crea Focus
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Nuovo Focus Strategico</DialogTitle>
                        <DialogDescription>
                          Definisci la priorità dominante per i prossimi 6 mesi
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800">
                          <div className="flex gap-2">
                            <Info className="h-4 w-4 text-purple-600 mt-0.5" />
                            <div className="text-sm text-purple-800 dark:text-purple-200">
                              <strong>Caratteristiche:</strong> Tematico, non numerico. Ponte tra Vision e OKR.
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Titolo Focus *</Label>
                          <Input
                            value={newFocus.title}
                            onChange={(e) => setNewFocus({ ...newFocus, title: e.target.value })}
                            placeholder="Es: Crescita commerciale"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Descrizione</Label>
                          <Textarea
                            value={newFocus.description}
                            onChange={(e) => setNewFocus({ ...newFocus, description: e.target.value })}
                            placeholder="Descrivi questo focus..."
                            rows={2}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Data Inizio</Label>
                            <Input
                              type="date"
                              value={newFocus.start_date}
                              onChange={(e) => setNewFocus({ ...newFocus, start_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Data Fine</Label>
                            <Input
                              type="date"
                              value={newFocus.end_date}
                              onChange={(e) => setNewFocus({ ...newFocus, end_date: e.target.value })}
                            />
                          </div>
                        </div>
                        
                        <Button onClick={handleCreateFocus} className="w-full">
                          Crea Focus
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border border-purple-100 dark:border-purple-800">
                    <h3 className="font-semibold text-lg text-purple-900 dark:text-purple-100">{focus.title}</h3>
                    {focus.description && (
                      <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">{focus.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-purple-600 dark:text-purple-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(focus.start_date), "MMM yyyy", { locale: it })}
                        {focus.end_date && ` → ${format(new Date(focus.end_date), "MMM yyyy", { locale: it })}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={handleArchiveFocus}>
                      Archivia Focus
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* 3️⃣ OKR SECTION */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  OKR - Objectives & Key Results
                  <Badge variant="outline" className="text-xs font-normal">90 giorni</Badge>
                </CardTitle>
                <CardDescription>Obiettivi trimestrali con risultati misurabili</CardDescription>
              </div>
            </div>
            <Dialog open={isNewObjectiveOpen} onOpenChange={setIsNewObjectiveOpen}>
              <DialogTrigger asChild>
                <Button disabled={!focus}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuovo Objective
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Nuovo Objective</DialogTitle>
                  <DialogDescription>
                    Definisci l'obiettivo principale del trimestre (max 90 giorni)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quarter</Label>
                      <Select value={newObjective.quarter} onValueChange={(v) => setNewObjective({ ...newObjective, quarter: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QUARTERS.map(q => (
                            <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Anno</Label>
                      <Select value={String(newObjective.year)} onValueChange={(v) => setNewObjective({ ...newObjective, year: parseInt(v) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {YEARS.map(y => (
                            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Titolo Objective *</Label>
                    <Input
                      value={newObjective.title}
                      onChange={(e) => setNewObjective({ ...newObjective, title: e.target.value })}
                      placeholder="Es: Aumentare il fatturato del 10%"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Descrizione</Label>
                    <Textarea
                      value={newObjective.description}
                      onChange={(e) => setNewObjective({ ...newObjective, description: e.target.value })}
                      placeholder="Descrivi l'obiettivo in dettaglio..."
                      rows={2}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Aree Coinvolte *</Label>
                    <div className="flex flex-wrap gap-2">
                      {AREAS.map((area) => (
                        <Button
                          key={area}
                          type="button"
                          variant={newObjective.scope_included.includes(area) ? "default" : "outline"}
                          size="sm"
                          onClick={() => toggleScopeArea(area, "included")}
                        >
                          {area}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Aree Escluse (opzionale)</Label>
                    <div className="flex flex-wrap gap-2">
                      {AREAS.filter(a => !newObjective.scope_included.includes(a)).map((area) => (
                        <Button
                          key={area}
                          type="button"
                          variant={newObjective.scope_excluded.includes(area) ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => toggleScopeArea(area, "excluded")}
                        >
                          {area}
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  <Button onClick={handleCreateObjective} className="w-full">
                    Crea Objective
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mb-6">
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

          {/* Objectives List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              <p className="text-muted-foreground mt-4">Caricamento...</p>
            </div>
          ) : !focus ? (
            <div className="text-center py-8">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="text-muted-foreground">Crea prima una Vision e un Focus Strategico</p>
            </div>
          ) : objectives.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <Target className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Nessun Objective definito</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Crea il tuo primo Objective trimestrale
              </p>
              <Button onClick={() => setIsNewObjectiveOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crea Objective
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {objectives.map((objective) => {
                const progress = getObjectiveProgress(objective);
                const krCount = objective.key_results?.length || 0;
                
                return (
                  <Card key={objective.id} className="overflow-hidden border-l-4 border-l-emerald-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">
                              {objective.quarter} {objective.year}
                            </Badge>
                            <Badge className={getStatusColor(objective.status)}>
                              {objective.status === "draft" ? "Bozza" : 
                               objective.status === "validated" ? "Validato" :
                               objective.status === "in_progress" ? "In Corso" :
                               objective.status === "completed" ? "Completato" : objective.status}
                            </Badge>
                            {objective.scope_included && objective.scope_included.length > 0 && (
                              <div className="flex gap-1">
                                {objective.scope_included.map((area) => (
                                  <Badge key={area} variant="secondary" className="text-xs">
                                    {area}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <CardTitle className="text-lg">{objective.title}</CardTitle>
                          {objective.description && (
                            <CardDescription className="mt-1">{objective.description}</CardDescription>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteObjective(objective.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
                            Nessun Key Result. Aggiungi 2-5 KR per tracciare il progresso.
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
                                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        {kr.deadline && (
                                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <Clock className="h-3 w-3" />
                                            {format(new Date(kr.deadline), "dd MMM yyyy", { locale: it })}
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
        </CardContent>
      </Card>

      {/* New KR Dialog */}
      <Dialog open={isNewKROpen} onOpenChange={setIsNewKROpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuovo Key Result</DialogTitle>
            <DialogDescription>
              {selectedObjective && `Per l'Objective: ${selectedObjective.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800">
              <div className="flex gap-2">
                <Info className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div className="text-sm text-emerald-800 dark:text-emerald-200">
                  <strong>Un KR deve essere:</strong> Misurabile con metrica, baseline e target.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Titolo Key Result *</Label>
              <Input
                value={newKR.title}
                onChange={(e) => setNewKR({ ...newKR, title: e.target.value })}
                placeholder="Es: Aumentare conversione dal 18% al 28%"
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
                    <SelectItem value="ordini">ordini</SelectItem>
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
