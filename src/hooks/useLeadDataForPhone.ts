import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadData {
  leadId?: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  country?: string;
}

type LeadRow = {
  id: string;
  contact_name: string | null;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  country: string | null;
  pipeline: string | null;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");

const lastNDigits = (digits: string, n: number) => (digits.length > n ? digits.slice(-n) : digits);

const normalizeLast8 = (phone: string | null | undefined) => {
  const digits = digitsOnly(phone ?? "");
  return lastNDigits(digits, 8);
};

const getRpcSearchPattern = (phone: string): string | null => {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  // Allineato alla logica call-records: preferisci ultimi 9 digit, fallback a 8.
  return digits.length >= 9 ? digits.slice(-9) : digits.slice(-8);
};

const mapLeadRowToLeadData = (lead: LeadRow): LeadData => ({
  leadId: lead.id,
  name: lead.contact_name ?? undefined,
  company: lead.company_name ?? undefined,
  email: lead.email ?? undefined,
  phone: lead.phone ?? undefined,
  country: lead.country ?? undefined,
});

export function useLeadDataForPhone(params: {
  phone?: string | null;
  leadId?: string | null;
  pipeline?: string | null;
  enabled?: boolean;
}) {
  const { phone, leadId, pipeline, enabled = true } = params;

  return useQuery({
    queryKey: ["lead-by-phone", { phone, leadId, pipeline }],
    enabled: enabled && (!!phone || !!leadId),
    staleTime: 60_000,
    queryFn: async (): Promise<LeadData | null> => {
      // 1) Se abbiamo già lead_id sulla conversazione, usalo (più affidabile)
      if (leadId) {
        let q = supabase
          .from("leads")
          .select("id, contact_name, company_name, phone, email, country, pipeline")
          .eq("id", leadId);

        if (pipeline) q = q.eq("pipeline", pipeline);

        const { data, error } = await q.maybeSingle();
        if (error) throw error;
        if (!data) return null;
        return mapLeadRowToLeadData(data as unknown as LeadRow);
      }

      // 2) Altrimenti, prova a risolvere dal telefono normalizzato via RPC
      if (!phone) return null;
      const rpcPattern = getRpcSearchPattern(phone);
      if (!rpcPattern) return null;

      const { data: candidates, error: rpcError } = await supabase.rpc(
        "find_lead_by_normalized_phone",
        { search_pattern: rpcPattern }
      );
      if (rpcError) throw rpcError;

      const ids = (candidates ?? [])
        .map((c: any) => c?.id as string | undefined)
        .filter((id): id is string => !!id);

      if (!ids.length) return null;

      let q = supabase
        .from("leads")
        .select("id, contact_name, company_name, phone, email, country, pipeline")
        .in("id", ids);

      if (pipeline) q = q.eq("pipeline", pipeline);

      const { data: leads, error: leadsError } = await q;
      if (leadsError) throw leadsError;
      if (!leads || leads.length === 0) return null;

      // Preferisci il match esatto sugli ultimi 8 digit (riduce falsi positivi)
      const targetLast8 = normalizeLast8(phone);
      const best =
        (leads as unknown as LeadRow[]).find((l) => normalizeLast8(l.phone) === targetLast8) ??
        ((leads as unknown as LeadRow[])[0] as LeadRow);

      return mapLeadRowToLeadData(best);
    },
  });
}
