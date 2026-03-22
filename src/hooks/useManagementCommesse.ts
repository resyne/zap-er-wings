import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  created_at: string;
  updated_at: string;
}

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

/** Returns totals for active commesse (excludes annullate) */
export const useCommesseTotals = (commesse: ManagementCommessa[]) => {
  const active = commesse.filter(c => c.stato !== "annullata");
  const totaleRicavi = active.reduce((s, c) => s + Number(c.ricavo), 0);
  const totaleCostiDiretti = active.reduce((s, c) => s + Number(c.costo_diretto_stimato), 0);
  const totaleMargineLordo = totaleRicavi - totaleCostiDiretti;
  return { totaleRicavi, totaleCostiDiretti, totaleMargineLordo, count: active.length };
};
