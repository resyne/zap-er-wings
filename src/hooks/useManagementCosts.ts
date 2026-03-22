import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ManagementCost {
  id: string;
  date: string;
  description: string;
  supplier_id?: string;
  supplier_name?: string;
  category_id?: string;
  category_name?: string;
  cost_type: 'fixed' | 'variable';
  cost_nature: 'direct' | 'indirect';
  amount: number;
  vat_rate?: number;
  vat_amount?: number;
  net_amount?: number;
  frequency: 'one_time' | 'monthly' | 'quarterly' | 'annual';
  cost_center_id?: string;
  business_unit_id?: string;
  commessa_id?: string;
  sales_order_id?: string;
  customer_id?: string;
  product_id?: string;
  payment_method?: string;
  notes?: string;
  status: 'active' | 'archived';
  source?: string;
  source_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CostCategory {
  id: string;
  name: string;
  description?: string;
  cost_type: 'fixed' | 'variable';
  is_active: boolean;
  sort_order: number;
}

export const useCostCategories = () => {
  return useQuery({
    queryKey: ["cost-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cost_categories" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data || []) as unknown as CostCategory[];
    },
  });
};

export const useManagementCosts = (filters?: {
  status?: string;
  cost_type?: string;
  category_id?: string;
  cost_center_id?: string;
  business_unit_id?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  return useQuery({
    queryKey: ["management-costs", filters],
    queryFn: async () => {
      let query = supabase.from("management_costs" as any).select("*").order("date", { ascending: false });
      if (filters?.status) query = query.eq("status", filters.status);
      if (filters?.cost_type) query = query.eq("cost_type", filters.cost_type);
      if (filters?.category_id) query = query.eq("category_id", filters.category_id);
      if (filters?.cost_center_id) query = query.eq("cost_center_id", filters.cost_center_id);
      if (filters?.business_unit_id) query = query.eq("business_unit_id", filters.business_unit_id);
      if (filters?.dateFrom) query = query.gte("date", filters.dateFrom);
      if (filters?.dateTo) query = query.lte("date", filters.dateTo);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ManagementCost[];
    },
  });
};

export const useCreateCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cost: Partial<ManagementCost>) => {
      const { data, error } = await supabase.from("management_costs" as any).insert(cost as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-costs"] });
      toast.success("Costo creato con successo");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

export const useUpdateCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ManagementCost> & { id: string }) => {
      const { data, error } = await supabase.from("management_costs" as any).update(updates as any).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-costs"] });
      toast.success("Costo aggiornato");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

export const useDeleteCost = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("management_costs" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["management-costs"] });
      toast.success("Costo eliminato");
    },
    onError: (e: any) => toast.error("Errore: " + e.message),
  });
};

export const useManagementSettings = () => {
  return useQuery({
    queryKey: ["management-control-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("management_control_settings" as any).select("*");
      if (error) throw error;
      const settings: Record<string, any> = {};
      (data || []).forEach((s: any) => { settings[s.setting_key] = s.setting_value; });
      return settings;
    },
  });
};

// Revenue data from invoice_registry (fatture emesse)
export const useRevenueData = (dateFrom?: string, dateTo?: string) => {
  return useQuery({
    queryKey: ["revenue-data", dateFrom, dateTo],
    queryFn: async () => {
      let query = supabase
        .from("invoice_registry")
        .select("*")
        .eq("document_type", "vendita");
      if (dateFrom) query = query.gte("document_date", dateFrom);
      if (dateTo) query = query.lte("document_date", dateTo);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });
};
