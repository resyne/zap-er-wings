
-- Create governance_presets table
CREATE TABLE public.governance_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_unit_id UUID NOT NULL REFERENCES public.business_units(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL DEFAULT 'Default Preset',
  philosophy TEXT,
  
  -- Vision rules
  vision_max_active INTEGER DEFAULT 1,
  vision_min_duration_months INTEGER DEFAULT 6,
  vision_max_duration_months INTEGER DEFAULT 12,
  vision_required_for_focus BOOLEAN DEFAULT true,
  vision_kpi_observation BOOLEAN DEFAULT true,
  
  -- Focus rules
  focus_max_active INTEGER DEFAULT 1,
  focus_min_duration_months INTEGER DEFAULT 3,
  focus_max_duration_months INTEGER DEFAULT 6,
  focus_required_for_okr BOOLEAN DEFAULT true,
  focus_max_okr_cycles INTEGER DEFAULT 2,
  
  -- Objective rules
  objective_max_active INTEGER DEFAULT 1,
  objective_default_duration_days INTEGER DEFAULT 90,
  objective_max_duration_days INTEGER DEFAULT 180,
  objective_scope_required BOOLEAN DEFAULT true,
  objective_focus_required BOOLEAN DEFAULT true,
  
  -- Key Results rules
  kr_min_per_objective INTEGER DEFAULT 2,
  kr_max_per_objective INTEGER DEFAULT 4,
  kr_baseline_required BOOLEAN DEFAULT true,
  kr_target_required BOOLEAN DEFAULT true,
  kr_owner_required BOOLEAN DEFAULT true,
  kr_metric_erp_required BOOLEAN DEFAULT true,
  
  -- Task rules
  task_linked_to_kr BOOLEAN DEFAULT true,
  task_without_kr_allowed BOOLEAN DEFAULT false,
  task_cross_kr BOOLEAN DEFAULT true,
  task_effort_required BOOLEAN DEFAULT true,
  
  -- Guardrail rules
  guardrail_margin_min BOOLEAN DEFAULT true,
  guardrail_cash_buffer BOOLEAN DEFAULT true,
  guardrail_team_load_max BOOLEAN DEFAULT true,
  guardrail_violation_action VARCHAR(50) DEFAULT 'warning_confirm',
  guardrail_override_role VARCHAR(50) DEFAULT 'ceo',
  
  -- AI Behavior - Oracle
  ai_suggest_vision BOOLEAN DEFAULT true,
  ai_suggest_focus BOOLEAN DEFAULT true,
  ai_propose_objective BOOLEAN DEFAULT true,
  ai_highlight_production_risks BOOLEAN DEFAULT true,
  ai_highlight_bottlenecks BOOLEAN DEFAULT true,
  
  -- AI Behavior - Wise
  ai_reject_non_measurable_kr BOOLEAN DEFAULT true,
  ai_warning_load_timeline BOOLEAN DEFAULT true,
  ai_suggest_milestones BOOLEAN DEFAULT true,
  ai_validate_focus_okr_coherence BOOLEAN DEFAULT true,
  ai_severity VARCHAR(20) DEFAULT 'medium',
  
  -- Temporal rules
  temporal_validation BOOLEAN DEFAULT true,
  temporal_auto_realign BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(business_unit_id)
);

-- Enable RLS
ALTER TABLE public.governance_presets ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view governance presets" ON public.governance_presets FOR SELECT USING (true);
CREATE POLICY "Users can insert governance presets" ON public.governance_presets FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update governance presets" ON public.governance_presets FOR UPDATE USING (true);
CREATE POLICY "Users can delete governance presets" ON public.governance_presets FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_governance_presets_updated_at
  BEFORE UPDATE ON public.governance_presets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default preset for ZAPPER
INSERT INTO public.governance_presets (
  business_unit_id,
  name,
  philosophy,
  vision_max_active, vision_min_duration_months, vision_max_duration_months, vision_required_for_focus, vision_kpi_observation,
  focus_max_active, focus_min_duration_months, focus_max_duration_months, focus_required_for_okr, focus_max_okr_cycles,
  objective_max_active, objective_default_duration_days, objective_max_duration_days, objective_scope_required, objective_focus_required,
  kr_min_per_objective, kr_max_per_objective, kr_baseline_required, kr_target_required, kr_owner_required, kr_metric_erp_required,
  task_linked_to_kr, task_without_kr_allowed, task_cross_kr, task_effort_required,
  guardrail_margin_min, guardrail_cash_buffer, guardrail_team_load_max, guardrail_violation_action, guardrail_override_role,
  ai_suggest_vision, ai_suggest_focus, ai_propose_objective, ai_highlight_production_risks, ai_highlight_bottlenecks,
  ai_reject_non_measurable_kr, ai_warning_load_timeline, ai_suggest_milestones, ai_validate_focus_okr_coherence, ai_severity,
  temporal_validation, temporal_auto_realign
)
SELECT 
  id,
  'ZAPPER MODE (Startup Industriale)',
  'Velocità con disciplina. Sperimentazione con guardrail. Crescita senza rompere il sistema.',
  1, 6, 12, true, true,
  1, 3, 6, true, 2,
  1, 90, 180, true, true,
  2, 4, true, true, true, true,
  true, false, true, true,
  true, true, true, 'warning_confirm', 'ceo',
  true, true, true, true, true,
  true, true, true, true, 'medium',
  true, true
FROM public.business_units WHERE code = 'ZAPPER';

-- Insert default preset for VESUVIANO
INSERT INTO public.governance_presets (
  business_unit_id,
  name,
  philosophy
)
SELECT 
  id,
  'VESUVIANO MODE',
  'Da configurare'
FROM public.business_units WHERE code = 'VESUVIANO';
