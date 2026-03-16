import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Fetches all Becca authorized user phone numbers.
 * Used to filter internal Becca conversations from WhatsApp views.
 */
export function useBeccaPhoneNumbers() {
  return useQuery({
    queryKey: ["becca-authorized-phones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("becca_authorized_users" as any)
        .select("phone_number")
        .eq("is_active", true);
      if (error) throw error;
      return (data || []).map((u: any) => u.phone_number as string);
    },
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Normalizes a phone number to last 9 digits for fuzzy matching.
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "").slice(-9);
}

/**
 * Checks if a customer phone matches any Becca authorized user phone.
 * Uses fuzzy matching (last 9 digits) consistent with the WhatsApp system.
 */
export function isBeccaPhone(customerPhone: string, beccaPhones: string[]): boolean {
  const normalized = normalizePhone(customerPhone);
  return beccaPhones.some((bp) => normalizePhone(bp) === normalized);
}
