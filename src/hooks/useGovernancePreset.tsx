import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { differenceInMonths, differenceInDays, parseISO } from "date-fns";

export interface GovernancePreset {
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

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface VisionData {
  title: string;
  start_date: string;
  end_date?: string;
}

interface FocusData {
  title: string;
  start_date: string;
  end_date?: string;
}

interface ObjectiveData {
  title: string;
  scope_included?: string[];
  target_date?: string;
}

interface KeyResultData {
  title: string;
  target_value?: number;
  baseline_value?: number;
  owner_id?: string;
  metric_source?: string;
}

export function useGovernancePreset(businessUnitId: string | null) {
  const [preset, setPreset] = useState<GovernancePreset | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchPreset = useCallback(async () => {
    if (!businessUnitId) {
      setPreset(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("governance_presets")
        .select("*")
        .eq("business_unit_id", businessUnitId)
        .maybeSingle();

      if (error) throw error;
      setPreset(data);
    } catch (error) {
      console.error("Error fetching governance preset:", error);
      setPreset(null);
    } finally {
      setIsLoading(false);
    }
  }, [businessUnitId]);

  useEffect(() => {
    fetchPreset();
  }, [fetchPreset]);

  // ==================== VALIDATION FUNCTIONS ====================

  const validateVision = useCallback((
    data: VisionData,
    existingActiveVision: boolean
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preset) {
      return { valid: true, errors: [], warnings: ["⚠️ WiseRule: Nessun preset configurato"] };
    }

    // Check max active visions
    if (existingActiveVision && preset.vision_max_active <= 1) {
      errors.push(`🚫 WiseRule: È consentita solo ${preset.vision_max_active} Vision attiva. Archivia quella esistente.`);
    }

    // Check duration
    if (data.start_date && data.end_date) {
      const startDate = parseISO(data.start_date);
      const endDate = parseISO(data.end_date);
      const durationMonths = differenceInMonths(endDate, startDate);

      if (durationMonths < preset.vision_min_duration_months) {
        if (preset.ai_severity === "high") {
          errors.push(`🚫 WiseRule: Durata Vision troppo breve. Minimo ${preset.vision_min_duration_months} mesi (hai ${durationMonths} mesi).`);
        } else {
          warnings.push(`⚠️ WiseRule: Durata Vision breve (${durationMonths} mesi). Consigliato minimo ${preset.vision_min_duration_months} mesi.`);
        }
      }

      if (durationMonths > preset.vision_max_duration_months) {
        if (preset.ai_severity === "high") {
          errors.push(`🚫 WiseRule: Durata Vision troppo lunga. Massimo ${preset.vision_max_duration_months} mesi (hai ${durationMonths} mesi).`);
        } else {
          warnings.push(`⚠️ WiseRule: Durata Vision lunga (${durationMonths} mesi). Consigliato massimo ${preset.vision_max_duration_months} mesi.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [preset]);

  const validateFocus = useCallback((
    data: FocusData,
    hasActiveVision: boolean,
    existingActiveFocus: boolean
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preset) {
      return { valid: true, errors: [], warnings: ["⚠️ WiseRule: Nessun preset configurato"] };
    }

    // Check vision requirement
    if (preset.vision_required_for_focus && !hasActiveVision) {
      errors.push("🚫 WiseRule: È richiesta una Vision attiva per creare un Focus Strategico.");
    }

    // Check max active focus
    if (existingActiveFocus && preset.focus_max_active <= 1) {
      errors.push(`🚫 WiseRule: È consentito solo ${preset.focus_max_active} Focus attivo. Archivia quello esistente.`);
    }

    // Check duration
    if (data.start_date && data.end_date) {
      const startDate = parseISO(data.start_date);
      const endDate = parseISO(data.end_date);
      const durationMonths = differenceInMonths(endDate, startDate);

      if (durationMonths < preset.focus_min_duration_months) {
        if (preset.ai_severity === "high") {
          errors.push(`🚫 WiseRule: Durata Focus troppo breve. Minimo ${preset.focus_min_duration_months} mesi.`);
        } else {
          warnings.push(`⚠️ WiseRule: Durata Focus breve (${durationMonths} mesi). Consigliato minimo ${preset.focus_min_duration_months} mesi.`);
        }
      }

      if (durationMonths > preset.focus_max_duration_months) {
        if (preset.ai_severity === "high") {
          errors.push(`🚫 WiseRule: Durata Focus troppo lunga. Massimo ${preset.focus_max_duration_months} mesi.`);
        } else {
          warnings.push(`⚠️ WiseRule: Durata Focus lunga (${durationMonths} mesi). Consigliato massimo ${preset.focus_max_duration_months} mesi.`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [preset]);

  const validateObjective = useCallback((
    data: ObjectiveData,
    hasActiveFocus: boolean,
    activeObjectivesCount: number
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preset) {
      return { valid: true, errors: [], warnings: ["⚠️ WiseRule: Nessun preset configurato"] };
    }

    // Check focus requirement
    if (preset.objective_focus_required && !hasActiveFocus) {
      errors.push("🚫 WiseRule: È richiesto un Focus attivo per creare un Obiettivo.");
    }

    // Check max active objectives
    if (activeObjectivesCount >= preset.objective_max_active) {
      if (preset.ai_severity === "high") {
        errors.push(`🚫 WiseRule: Hai già ${activeObjectivesCount} obiettivi attivi. Massimo consentito: ${preset.objective_max_active}.`);
      } else {
        warnings.push(`⚠️ WiseRule: Hai già ${activeObjectivesCount} obiettivi attivi. Consigliato massimo ${preset.objective_max_active}.`);
      }
    }

    // Check scope requirement
    if (preset.objective_scope_required && (!data.scope_included || data.scope_included.length === 0)) {
      errors.push("🚫 WiseRule: È obbligatorio definire le aree coinvolte (scope) per l'obiettivo.");
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [preset]);

  const validateKeyResult = useCallback((
    data: KeyResultData,
    objectiveKRCount: number
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preset) {
      return { valid: true, errors: [], warnings: ["⚠️ WiseRule: Nessun preset configurato"] };
    }

    // Check max KRs per objective
    if (objectiveKRCount >= preset.kr_max_per_objective) {
      errors.push(`🚫 WiseRule: Questo obiettivo ha già ${objectiveKRCount} Key Results. Massimo consentito: ${preset.kr_max_per_objective}.`);
    }

    // Check target required
    if (preset.kr_target_required && (data.target_value === undefined || data.target_value === null)) {
      errors.push("🚫 WiseRule: È obbligatorio definire un target per il Key Result.");
    }

    // Check baseline required
    if (preset.kr_baseline_required && (data.baseline_value === undefined || data.baseline_value === null)) {
      warnings.push("⚠️ WiseRule: È consigliato definire una baseline per il Key Result.");
    }

    // Check owner required
    if (preset.kr_owner_required && !data.owner_id) {
      if (preset.ai_severity === "high") {
        errors.push("🚫 WiseRule: È obbligatorio assegnare un owner al Key Result.");
      } else {
        warnings.push("⚠️ WiseRule: È consigliato assegnare un owner al Key Result.");
      }
    }

    // Check metric ERP required
    if (preset.kr_metric_erp_required && !data.metric_source) {
      if (preset.ai_severity === "high") {
        errors.push("🚫 WiseRule: È obbligatorio collegare una metrica ERP (CRM/Produzione/Assistenza) al Key Result.");
      } else {
        warnings.push("⚠️ WiseRule: È consigliato collegare una metrica ERP al Key Result.");
      }
    }

    // AI check for non-measurable KR
    if (preset.ai_reject_non_measurable_kr) {
      const title = data.title.toLowerCase();
      const vagueTerms = ["migliorare", "aumentare", "ottimizzare", "potenziare", "sviluppare"];
      const hasVagueTerm = vagueTerms.some(term => title.includes(term));
      const hasNumber = /\d/.test(data.title);
      
      if (hasVagueTerm && !hasNumber && data.target_value === undefined) {
        if (preset.ai_severity === "high") {
          errors.push("🚫 WiseRule: Key Result non misurabile. Usa termini specifici con numeri (es: 'Ridurre tempo ciclo da 10 a 7 giorni').");
        } else {
          warnings.push("⚠️ WiseRule: Key Result potenzialmente vago. Considera di aggiungere metriche specifiche.");
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [preset]);

  const validateTemporalHierarchy = useCallback((
    visionEndDate: string | undefined,
    focusEndDate: string | undefined,
    objectiveTargetDate: string | undefined
  ): ValidationResult => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!preset || !preset.temporal_validation) {
      return { valid: true, errors: [], warnings: [] };
    }

    // Vision > Focus > OKR temporal hierarchy
    if (visionEndDate && focusEndDate) {
      const vEnd = parseISO(visionEndDate);
      const fEnd = parseISO(focusEndDate);
      
      if (fEnd > vEnd) {
        warnings.push("⚠️ WiseRule: La data di fine Focus supera quella della Vision. Verifica l'allineamento temporale.");
      }
    }

    if (focusEndDate && objectiveTargetDate) {
      const fEnd = parseISO(focusEndDate);
      const oEnd = parseISO(objectiveTargetDate);
      
      if (oEnd > fEnd) {
        warnings.push("⚠️ WiseRule: La data target dell'Obiettivo supera quella del Focus. Verifica l'allineamento temporale.");
      }
    }

    if (visionEndDate && objectiveTargetDate) {
      const vEnd = parseISO(visionEndDate);
      const oEnd = parseISO(objectiveTargetDate);
      
      if (oEnd > vEnd) {
        warnings.push("⚠️ WiseRule: La data target dell'Obiettivo supera quella della Vision. Verifica l'allineamento temporale.");
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }, [preset]);

  return {
    preset,
    isLoading,
    refetchPreset: fetchPreset,
    validateVision,
    validateFocus,
    validateObjective,
    validateKeyResult,
    validateTemporalHierarchy,
  };
}
