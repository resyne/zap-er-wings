import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user should hide amounts
 */
export function useHideAmounts() {
  const { user } = useAuth();
  const [hideAmounts, setHideAmounts] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHideAmounts(false);
      setLoading(false);
      return;
    }

    fetchHideAmountsSetting();
  }, [user]);

  const fetchHideAmountsSetting = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("hide_amounts")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching hide_amounts setting:", error);
        setHideAmounts(false);
      } else {
        setHideAmounts(data?.hide_amounts || false);
      }
    } catch (error) {
      console.error("Error fetching hide_amounts setting:", error);
      setHideAmounts(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    hideAmounts,
    loading,
    refresh: fetchHideAmountsSetting
  };
}
