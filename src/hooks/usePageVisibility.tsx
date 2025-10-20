import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PageVisibility {
  page_url: string;
  is_visible: boolean;
}

export function usePageVisibility(userId?: string) {
  const [pageVisibility, setPageVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchPageVisibility();
  }, [userId]);

  const fetchPageVisibility = async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("user_page_visibility")
        .select("page_url, is_visible")
        .eq("user_id", userId);

      if (error) throw error;

      const visibilityMap: Record<string, boolean> = {};
      data?.forEach(item => {
        visibilityMap[item.page_url] = item.is_visible;
      });

      setPageVisibility(visibilityMap);
    } catch (error) {
      console.error("Error fetching page visibility:", error);
    } finally {
      setLoading(false);
    }
  };

  const updatePageVisibility = async (pageUrl: string, isVisible: boolean) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("user_page_visibility")
        .upsert(
          { user_id: userId, page_url: pageUrl, is_visible: isVisible },
          { onConflict: "user_id,page_url" }
        );

      if (error) throw error;

      setPageVisibility(prev => ({
        ...prev,
        [pageUrl]: isVisible
      }));
    } catch (error) {
      console.error("Error updating page visibility:", error);
      throw error;
    }
  };

  const isPageVisible = (pageUrl: string): boolean => {
    // Default to visible if not explicitly set to false
    return pageVisibility[pageUrl] !== false;
  };

  return {
    pageVisibility,
    loading,
    isPageVisible,
    updatePageVisibility,
    refreshPageVisibility: fetchPageVisibility
  };
}
