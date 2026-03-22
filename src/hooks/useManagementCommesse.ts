import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useMemo } from "react";

export interface ManagementCommessa {
  id: string;
  codice_commessa: string;
  cliente: string;
  descrizione?: string;
  stato: "acquisita" | "in_corso" | "chiusa" | "annullata";
  data: string;
  ricavo: number;
  costo_diretto_stimato: number;
  margine_calcolato: number;
  note?: string;
  commessa_id?: string;
  service_report_id?: string;
  data_competenza?: string | null;
  data_fattura?: string | null;
  numero_fattura?: string | null;
  created_at: string;
  updated_at: string;
}

/** Get the reference period (YYYY-MM) for a management commessa */
export const getRiferimentoPeriodo = (c: ManagementCommessa): string => {
  const ref = c.data_fattura || c.data_competenza || c.created_at;
  if (!ref) return "";
  try {
    const d = new Date(ref);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return "";
  }
};

export const useManagementCommesse = () => {
  return useQuery({
    queryKey: ["management-commesse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("management_commesse")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ManagementCommessa[];
    },
  });
};

export const useCreateManagementCommessa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<ManagementCommessa, "id" | "margine_calcolato" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("management_commesse")
        .insert(input as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-commesse"] });
      toast.success("Commessa aggiunta");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

export const useUpdateManagementCommessa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<Omit<ManagementCommessa, "id" | "margine_calcolato" | "created_at" | "updated_at">>) => {
      const { data, error } = await supabase
        .from("management_commesse")
        .update(input as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-commesse"] });
      toast.success("Commessa aggiornata");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

export const useDeleteManagementCommessa = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("management_commesse").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-commesse"] });
      toast.success("Commessa eliminata");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

/** Upsert management data for a commessa or service report */
export const useUpsertManagementData = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      commessa_id?: string;
      service_report_id?: string;
      codice_commessa: string;
      cliente: string;
      ricavo: number;
      costo_diretto_stimato: number;
      existing_id?: string;
    }) => {
      const { existing_id, ...rest } = input;
      if (existing_id) {
        // Update existing
        const { error } = await supabase
          .from("management_commesse")
          .update({
            ricavo: rest.ricavo,
            costo_diretto_stimato: rest.costo_diretto_stimato,
          } as any)
          .eq("id", existing_id);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
          .from("management_commesse")
          .insert({
            ...rest,
            stato: "in_corso",
            data: new Date().toISOString().split("T")[0],
          } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-commesse"] });
      toast.success("Dati gestionali salvati");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

/** Returns totals for active commesse (excludes annullate) */
export const useCommesseTotals = (commesse: ManagementCommessa[]) => {
  return useMemo(() => {
    const active = commesse.filter(c => c.stato !== "annullata");
    const totaleRicavi = active.reduce((s, c) => s + Number(c.ricavo), 0);
    const totaleCostiDiretti = active.reduce((s, c) => s + Number(c.costo_diretto_stimato), 0);
    const totaleMargineLordo = totaleRicavi - totaleCostiDiretti;
    return { totaleRicavi, totaleCostiDiretti, totaleMargineLordo, count: active.length };
  }, [commesse]);
};

/** Build a lookup map from management_commesse by commessa_id and service_report_id */
export const useManagementDataMap = (commesse: ManagementCommessa[]) => {
  return useMemo(() => {
    const byCommessa: Record<string, ManagementCommessa> = {};
    const byReport: Record<string, ManagementCommessa> = {};
    commesse.forEach(c => {
      if (c.commessa_id) byCommessa[c.commessa_id] = c;
      if (c.service_report_id) byReport[c.service_report_id] = c;
    });
    return { byCommessa, byReport };
  }, [commesse]);
};
