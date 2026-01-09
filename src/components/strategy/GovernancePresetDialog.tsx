import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Settings2, 
  Compass, 
  Focus, 
  Target, 
  CheckCircle2,
  Shield,
  Bot,
  Clock,
  ChevronDown,
  ChevronRight,
  Save,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GovernancePreset {
  id: string;
  business_unit_id: string;
  name: string;
  philosophy?: string;
  // Vision
  vision_max_active: number;
  vision_min_duration_months: number;
  vision_max_duration_months: number;
  vision_required_for_focus: boolean;
  vision_kpi_observation: boolean;
  // Focus
  focus_max_active: number;
  focus_min_duration_months: number;
  focus_max_duration_months: number;
  focus_required_for_okr: boolean;
  focus_max_okr_cycles: number;
  // Objective
  objective_max_active: number;
  objective_default_duration_days: number;
  objective_max_duration_days: number;
  objective_scope_required: boolean;
  objective_focus_required: boolean;
  // KR
  kr_min_per_objective: number;
  kr_max_per_objective: number;
  kr_baseline_required: boolean;
  kr_target_required: boolean;
  kr_owner_required: boolean;
  kr_metric_erp_required: boolean;
  // Task
  task_linked_to_kr: boolean;
  task_without_kr_allowed: boolean;
  task_cross_kr: boolean;
  task_effort_required: boolean;
  // Guardrail
  guardrail_margin_min: boolean;
  guardrail_cash_buffer: boolean;
  guardrail_team_load_max: boolean;
  guardrail_violation_action: string;
  guardrail_override_role: string;
  // AI Oracle
  ai_suggest_vision: boolean;
  ai_suggest_focus: boolean;
  ai_propose_objective: boolean;
  ai_highlight_production_risks: boolean;
  ai_highlight_bottlenecks: boolean;
  // AI Wise
  ai_reject_non_measurable_kr: boolean;
  ai_warning_load_timeline: boolean;
  ai_suggest_milestones: boolean;
  ai_validate_focus_okr_coherence: boolean;
  ai_severity: string;
  // Temporal
  temporal_validation: boolean;
  temporal_auto_realign: boolean;
}

interface GovernancePresetDialogProps {
  businessUnitId: string;
  businessUnitName: string;
  businessUnitCode: string;
  trigger?: React.ReactNode;
}

export function GovernancePresetDialog({ 
  businessUnitId, 
  businessUnitName, 
  businessUnitCode,
  trigger 
}: GovernancePresetDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [preset, setPreset] = useState<GovernancePreset | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Section open states
  const [visionOpen, setVisionOpen] = useState(true);
  const [focusOpen, setFocusOpen] = useState(false);
  const [okrOpen, setOkrOpen] = useState(false);
  const [guardrailOpen, setGuardrailOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [temporalOpen, setTemporalOpen] = useState(false);

  const fetchPreset = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("governance_presets")
        .select("*")
        .eq("business_unit_id", businessUnitId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      
      if (data) {
        setPreset(data as GovernancePreset);
      } else {
        // Create default preset if none exists
        const { data: newData, error: insertError } = await supabase
          .from("governance_presets")
          .insert({ business_unit_id: businessUnitId })
          .select()
          .single();
        
        if (insertError) throw insertError;
        setPreset(newData as GovernancePreset);
      }
    } catch (error: any) {
      console.error("Error fetching preset:", error);
      toast.error("Errore nel caricamento del preset");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPreset();
    }
  }, [isOpen, businessUnitId]);

  const handleSave = async () => {
    if (!preset) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("governance_presets")
        .update({
          name: preset.name,
          philosophy: preset.philosophy,
          vision_max_active: preset.vision_max_active,
          vision_min_duration_months: preset.vision_min_duration_months,
          vision_max_duration_months: preset.vision_max_duration_months,
          vision_required_for_focus: preset.vision_required_for_focus,
          vision_kpi_observation: preset.vision_kpi_observation,
          focus_max_active: preset.focus_max_active,
          focus_min_duration_months: preset.focus_min_duration_months,
          focus_max_duration_months: preset.focus_max_duration_months,
          focus_required_for_okr: preset.focus_required_for_okr,
          focus_max_okr_cycles: preset.focus_max_okr_cycles,
          objective_max_active: preset.objective_max_active,
          objective_default_duration_days: preset.objective_default_duration_days,
          objective_max_duration_days: preset.objective_max_duration_days,
          objective_scope_required: preset.objective_scope_required,
          objective_focus_required: preset.objective_focus_required,
          kr_min_per_objective: preset.kr_min_per_objective,
          kr_max_per_objective: preset.kr_max_per_objective,
          kr_baseline_required: preset.kr_baseline_required,
          kr_target_required: preset.kr_target_required,
          kr_owner_required: preset.kr_owner_required,
          kr_metric_erp_required: preset.kr_metric_erp_required,
          task_linked_to_kr: preset.task_linked_to_kr,
          task_without_kr_allowed: preset.task_without_kr_allowed,
          task_cross_kr: preset.task_cross_kr,
          task_effort_required: preset.task_effort_required,
          guardrail_margin_min: preset.guardrail_margin_min,
          guardrail_cash_buffer: preset.guardrail_cash_buffer,
          guardrail_team_load_max: preset.guardrail_team_load_max,
          guardrail_violation_action: preset.guardrail_violation_action,
          guardrail_override_role: preset.guardrail_override_role,
          ai_suggest_vision: preset.ai_suggest_vision,
          ai_suggest_focus: preset.ai_suggest_focus,
          ai_propose_objective: preset.ai_propose_objective,
          ai_highlight_production_risks: preset.ai_highlight_production_risks,
          ai_highlight_bottlenecks: preset.ai_highlight_bottlenecks,
          ai_reject_non_measurable_kr: preset.ai_reject_non_measurable_kr,
          ai_warning_load_timeline: preset.ai_warning_load_timeline,
          ai_suggest_milestones: preset.ai_suggest_milestones,
          ai_validate_focus_okr_coherence: preset.ai_validate_focus_okr_coherence,
          ai_severity: preset.ai_severity,
          temporal_validation: preset.temporal_validation,
          temporal_auto_realign: preset.temporal_auto_realign,
        })
        .eq("id", preset.id);

      if (error) throw error;
      toast.success("Governance Preset salvato!");
    } catch (error: any) {
      toast.error("Errore nel salvataggio: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreset = (field: keyof GovernancePreset, value: any) => {
    if (!preset) return;
    setPreset({ ...preset, [field]: value });
  };

  const SectionHeader = ({ 
    icon: Icon, 
    title, 
    badge,
    isOpen, 
    onToggle,
    color
  }: { 
    icon: any; 
    title: string;
    badge?: string; 
    isOpen: boolean; 
    onToggle: () => void;
    color: string;
  }) => (
    <button
      onClick={onToggle}
      className={cn(
        "w-full flex items-center justify-between p-3 rounded-lg transition-colors",
        "hover:bg-muted/50 text-left"
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn("p-2 rounded-lg", color)}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <span className="font-medium">{title}</span>
          {badge && (
            <Badge variant="outline" className="ml-2 text-xs">{badge}</Badge>
          )}
        </div>
      </div>
      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
    </button>
  );

  const SettingRow = ({ 
    label, 
    description, 
    children 
  }: { 
    label: string; 
    description?: string; 
    children: React.ReactNode;
  }) => (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 pr-4">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">
        {children}
      </div>
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="icon">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Governance Preset
            <Badge className="ml-2">{businessUnitCode}</Badge>
          </DialogTitle>
          <DialogDescription>
            Regole operative per {businessUnitName}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="py-12 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
            <p className="text-muted-foreground mt-4">Caricamento...</p>
          </div>
        ) : preset ? (
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-2">
              {/* Header Info */}
              <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950 dark:to-purple-950 border">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome Preset</Label>
                    <Input
                      value={preset.name || ""}
                      onChange={(e) => updatePreset("name", e.target.value)}
                      placeholder="Es: ZAPPER MODE (Startup Industriale)"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Filosofia</Label>
                    <Textarea
                      value={preset.philosophy || ""}
                      onChange={(e) => updatePreset("philosophy", e.target.value)}
                      placeholder="Es: Velocità con disciplina. Sperimentazione con guardrail."
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* 1️⃣ Vision Section */}
              <Collapsible open={visionOpen} onOpenChange={setVisionOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Compass}
                      title="1️⃣ Vision"
                      badge="6-12 mesi"
                      isOpen={visionOpen}
                      onToggle={() => setVisionOpen(!visionOpen)}
                      color="bg-indigo-100 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-1 border-l-2 border-indigo-200 dark:border-indigo-800 pl-4 ml-4">
                    <SettingRow label="Visioni attive max">
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        value={preset.vision_max_active}
                        onChange={(e) => updatePreset("vision_max_active", parseInt(e.target.value) || 1)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Durata minima (mesi)">
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={preset.vision_min_duration_months}
                        onChange={(e) => updatePreset("vision_min_duration_months", parseInt(e.target.value) || 6)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Durata massima (mesi)">
                      <Input
                        type="number"
                        min={1}
                        max={36}
                        value={preset.vision_max_duration_months}
                        onChange={(e) => updatePreset("vision_max_duration_months", parseInt(e.target.value) || 12)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Vision obbligatoria per Focus">
                      <Switch
                        checked={preset.vision_required_for_focus}
                        onCheckedChange={(v) => updatePreset("vision_required_for_focus", v)}
                      />
                    </SettingRow>
                    <SettingRow label="KPI di osservazione">
                      <Switch
                        checked={preset.vision_kpi_observation}
                        onCheckedChange={(v) => updatePreset("vision_kpi_observation", v)}
                      />
                    </SettingRow>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 2️⃣ Focus Section */}
              <Collapsible open={focusOpen} onOpenChange={setFocusOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Focus}
                      title="2️⃣ Focus Strategico"
                      badge="3-6 mesi"
                      isOpen={focusOpen}
                      onToggle={() => setFocusOpen(!focusOpen)}
                      color="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-1 border-l-2 border-purple-200 dark:border-purple-800 pl-4 ml-4">
                    <SettingRow label="Focus attivi max">
                      <Input
                        type="number"
                        min={1}
                        max={3}
                        value={preset.focus_max_active}
                        onChange={(e) => updatePreset("focus_max_active", parseInt(e.target.value) || 1)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Durata minima (mesi)">
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={preset.focus_min_duration_months}
                        onChange={(e) => updatePreset("focus_min_duration_months", parseInt(e.target.value) || 3)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Durata massima (mesi)">
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={preset.focus_max_duration_months}
                        onChange={(e) => updatePreset("focus_max_duration_months", parseInt(e.target.value) || 6)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                    <SettingRow label="Focus obbligatorio per OKR">
                      <Switch
                        checked={preset.focus_required_for_okr}
                        onCheckedChange={(v) => updatePreset("focus_required_for_okr", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Max cicli OKR sotto stesso Focus">
                      <Input
                        type="number"
                        min={1}
                        max={4}
                        value={preset.focus_max_okr_cycles}
                        onChange={(e) => updatePreset("focus_max_okr_cycles", parseInt(e.target.value) || 2)}
                        className="w-20 h-8"
                      />
                    </SettingRow>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 3️⃣ OKR Section */}
              <Collapsible open={okrOpen} onOpenChange={setOkrOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Target}
                      title="3️⃣ OKR"
                      badge="90 giorni"
                      isOpen={okrOpen}
                      onToggle={() => setOkrOpen(!okrOpen)}
                      color="bg-emerald-100 dark:bg-emerald-900 text-emerald-600 dark:text-emerald-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-4 border-l-2 border-emerald-200 dark:border-emerald-800 pl-4 ml-4">
                    {/* Objective */}
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-emerald-700 dark:text-emerald-300">Objective</h5>
                      <div className="space-y-1">
                        <SettingRow label="Objective attivi max">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={preset.objective_max_active}
                            onChange={(e) => updatePreset("objective_max_active", parseInt(e.target.value) || 1)}
                            className="w-20 h-8"
                          />
                        </SettingRow>
                        <SettingRow label="Durata default (giorni)">
                          <Input
                            type="number"
                            min={30}
                            max={180}
                            value={preset.objective_default_duration_days}
                            onChange={(e) => updatePreset("objective_default_duration_days", parseInt(e.target.value) || 90)}
                            className="w-20 h-8"
                          />
                        </SettingRow>
                        <SettingRow label="Durata massima (giorni)">
                          <Input
                            type="number"
                            min={30}
                            max={365}
                            value={preset.objective_max_duration_days}
                            onChange={(e) => updatePreset("objective_max_duration_days", parseInt(e.target.value) || 180)}
                            className="w-20 h-8"
                          />
                        </SettingRow>
                        <SettingRow label="Scope per area obbligatorio">
                          <Switch
                            checked={preset.objective_scope_required}
                            onCheckedChange={(v) => updatePreset("objective_scope_required", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Focus obbligatorio">
                          <Switch
                            checked={preset.objective_focus_required}
                            onCheckedChange={(v) => updatePreset("objective_focus_required", v)}
                          />
                        </SettingRow>
                      </div>
                    </div>

                    {/* Key Results */}
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-emerald-700 dark:text-emerald-300">Key Results</h5>
                      <div className="space-y-1">
                        <SettingRow label="KR minimo per Objective">
                          <Input
                            type="number"
                            min={1}
                            max={5}
                            value={preset.kr_min_per_objective}
                            onChange={(e) => updatePreset("kr_min_per_objective", parseInt(e.target.value) || 2)}
                            className="w-20 h-8"
                          />
                        </SettingRow>
                        <SettingRow label="KR massimo per Objective">
                          <Input
                            type="number"
                            min={2}
                            max={10}
                            value={preset.kr_max_per_objective}
                            onChange={(e) => updatePreset("kr_max_per_objective", parseInt(e.target.value) || 4)}
                            className="w-20 h-8"
                          />
                        </SettingRow>
                        <SettingRow label="Baseline obbligatoria">
                          <Switch
                            checked={preset.kr_baseline_required}
                            onCheckedChange={(v) => updatePreset("kr_baseline_required", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Target obbligatorio">
                          <Switch
                            checked={preset.kr_target_required}
                            onCheckedChange={(v) => updatePreset("kr_target_required", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Owner obbligatorio">
                          <Switch
                            checked={preset.kr_owner_required}
                            onCheckedChange={(v) => updatePreset("kr_owner_required", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Metrica ERP obbligatoria">
                          <Switch
                            checked={preset.kr_metric_erp_required}
                            onCheckedChange={(v) => updatePreset("kr_metric_erp_required", v)}
                          />
                        </SettingRow>
                      </div>
                    </div>

                    {/* Task */}
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-emerald-700 dark:text-emerald-300">Task</h5>
                      <div className="space-y-1">
                        <SettingRow label="Task collegate a KR">
                          <Switch
                            checked={preset.task_linked_to_kr}
                            onCheckedChange={(v) => updatePreset("task_linked_to_kr", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Task senza KR permesse">
                          <Switch
                            checked={preset.task_without_kr_allowed}
                            onCheckedChange={(v) => updatePreset("task_without_kr_allowed", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Task cross-KR">
                          <Switch
                            checked={preset.task_cross_kr}
                            onCheckedChange={(v) => updatePreset("task_cross_kr", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Stima effort obbligatoria">
                          <Switch
                            checked={preset.task_effort_required}
                            onCheckedChange={(v) => updatePreset("task_effort_required", v)}
                          />
                        </SettingRow>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 4️⃣ Guardrail Section */}
              <Collapsible open={guardrailOpen} onOpenChange={setGuardrailOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Shield}
                      title="4️⃣ Guardrail & Risk"
                      isOpen={guardrailOpen}
                      onToggle={() => setGuardrailOpen(!guardrailOpen)}
                      color="bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-1 border-l-2 border-amber-200 dark:border-amber-800 pl-4 ml-4">
                    <SettingRow label="Margine minimo">
                      <Switch
                        checked={preset.guardrail_margin_min}
                        onCheckedChange={(v) => updatePreset("guardrail_margin_min", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Cash buffer minimo">
                      <Switch
                        checked={preset.guardrail_cash_buffer}
                        onCheckedChange={(v) => updatePreset("guardrail_cash_buffer", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Carico team max">
                      <Switch
                        checked={preset.guardrail_team_load_max}
                        onCheckedChange={(v) => updatePreset("guardrail_team_load_max", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Violazione guardrail">
                      <Select
                        value={preset.guardrail_violation_action}
                        onValueChange={(v) => updatePreset("guardrail_violation_action", v)}
                      >
                        <SelectTrigger className="w-[140px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="warning">Warning</SelectItem>
                          <SelectItem value="warning_confirm">Warning + Conferma</SelectItem>
                          <SelectItem value="block">Blocco</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingRow>
                    <SettingRow label="Override consentito a">
                      <Select
                        value={preset.guardrail_override_role}
                        onValueChange={(v) => updatePreset("guardrail_override_role", v)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ceo">CEO</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="none">Nessuno</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingRow>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* 5️⃣ AI Section */}
              <Collapsible open={aiOpen} onOpenChange={setAiOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Bot}
                      title="5️⃣ AI Behavior"
                      isOpen={aiOpen}
                      onToggle={() => setAiOpen(!aiOpen)}
                      color="bg-violet-100 dark:bg-violet-900 text-violet-600 dark:text-violet-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-4 border-l-2 border-violet-200 dark:border-violet-800 pl-4 ml-4">
                    {/* Oracle */}
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-violet-700 dark:text-violet-300 flex items-center gap-2">
                        <Sparkles className="h-3 w-3" />
                        ORACLE
                      </h5>
                      <div className="space-y-1">
                        <SettingRow label="Suggerire Visioni">
                          <Switch
                            checked={preset.ai_suggest_vision}
                            onCheckedChange={(v) => updatePreset("ai_suggest_vision", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Suggerire Focus">
                          <Switch
                            checked={preset.ai_suggest_focus}
                            onCheckedChange={(v) => updatePreset("ai_suggest_focus", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Proporre Objective">
                          <Switch
                            checked={preset.ai_propose_objective}
                            onCheckedChange={(v) => updatePreset("ai_propose_objective", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Evidenziare rischi produttivi">
                          <Switch
                            checked={preset.ai_highlight_production_risks}
                            onCheckedChange={(v) => updatePreset("ai_highlight_production_risks", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Evidenziare colli di bottiglia">
                          <Switch
                            checked={preset.ai_highlight_bottlenecks}
                            onCheckedChange={(v) => updatePreset("ai_highlight_bottlenecks", v)}
                          />
                        </SettingRow>
                      </div>
                    </div>

                    {/* Wise */}
                    <div>
                      <h5 className="text-sm font-medium mb-2 text-violet-700 dark:text-violet-300 flex items-center gap-2">
                        <CheckCircle2 className="h-3 w-3" />
                        WISE
                      </h5>
                      <div className="space-y-1">
                        <SettingRow label="Bocciare KR non misurabili">
                          <Switch
                            checked={preset.ai_reject_non_measurable_kr}
                            onCheckedChange={(v) => updatePreset("ai_reject_non_measurable_kr", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Warning su carico e timeline">
                          <Switch
                            checked={preset.ai_warning_load_timeline}
                            onCheckedChange={(v) => updatePreset("ai_warning_load_timeline", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Suggerire milestone">
                          <Switch
                            checked={preset.ai_suggest_milestones}
                            onCheckedChange={(v) => updatePreset("ai_suggest_milestones", v)}
                          />
                        </SettingRow>
                        <SettingRow label="Validare coerenza Focus → OKR">
                          <Switch
                            checked={preset.ai_validate_focus_okr_coherence}
                            onCheckedChange={(v) => updatePreset("ai_validate_focus_okr_coherence", v)}
                          />
                        </SettingRow>
                      </div>
                    </div>

                    {/* Severity */}
                    <SettingRow label="Severità AI" description="Livello di intervento dell'AI">
                      <Select
                        value={preset.ai_severity}
                        onValueChange={(v) => updatePreset("ai_severity", v)}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </SettingRow>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* ⏱️ Temporal Section */}
              <Collapsible open={temporalOpen} onOpenChange={setTemporalOpen}>
                <CollapsibleTrigger asChild>
                  <div>
                    <SectionHeader
                      icon={Clock}
                      title="⏱️ Regole Temporali"
                      isOpen={temporalOpen}
                      onToggle={() => setTemporalOpen(!temporalOpen)}
                      color="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <div className="space-y-3 border-l-2 border-blue-200 dark:border-blue-800 pl-4 ml-4">
                    <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950 text-sm text-blue-800 dark:text-blue-200">
                      <strong>Gerarchia temporale:</strong>
                      <div className="mt-1 font-mono text-xs">
                        Vision (6-12 mesi) → Focus (3-6 mesi) → OKR (3-6 mesi)
                      </div>
                    </div>
                    <SettingRow label="Validazione temporale attiva" description="Verifica che le durate rispettino la gerarchia">
                      <Switch
                        checked={preset.temporal_validation}
                        onCheckedChange={(v) => updatePreset("temporal_validation", v)}
                      />
                    </SettingRow>
                    <SettingRow label="Riallineamento automatico" description="Proposta automatica in caso di violazioni">
                      <Switch
                        checked={preset.temporal_auto_realign}
                        onCheckedChange={(v) => updatePreset("temporal_auto_realign", v)}
                      />
                    </SettingRow>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          </ScrollArea>
        ) : null}

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving || !preset}>
            {isSaving ? (
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva Preset
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
