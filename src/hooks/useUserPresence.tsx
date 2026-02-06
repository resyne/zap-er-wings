import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const VISIBILITY_DEBOUNCE = 2000; // 2 seconds debounce for visibility changes

export function useUserPresence() {
  const { user } = useAuth();
  const heartbeatInterval = useRef<number | null>(null);
  const visibilityTimeout = useRef<number | null>(null);
  const lastStatus = useRef<boolean | null>(null);

  const updatePresence = useCallback(async (isOnline: boolean) => {
    if (!user?.id) return;
    
    // Avoid redundant updates
    if (lastStatus.current === isOnline) return;
    lastStatus.current = isOnline;
    
    try {
      const { error } = await supabase.rpc("upsert_user_presence", {
        p_user_id: user.id,
        p_is_online: isOnline,
      });
      
      if (error) {
        console.error("Error updating presence:", error);
        lastStatus.current = null; // Reset to allow retry
      }
    } catch (err) {
      console.error("Error updating presence:", err);
      lastStatus.current = null;
    }
  }, [user?.id]);

  const setOnline = useCallback(() => {
    updatePresence(true);
  }, [updatePresence]);

  const setOffline = useCallback(() => {
    updatePresence(false);
  }, [updatePresence]);

  useEffect(() => {
    if (!user?.id) return;

    // Set online immediately
    setOnline();

    // Start heartbeat
    heartbeatInterval.current = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        updatePresence(true);
      }
    }, HEARTBEAT_INTERVAL);

    // Handle visibility changes with debounce
    const handleVisibilityChange = () => {
      if (visibilityTimeout.current) {
        clearTimeout(visibilityTimeout.current);
      }

      if (document.visibilityState === "visible") {
        // Set online immediately when tab becomes visible
        setOnline();
      } else {
        // Debounce going offline to avoid flicker on quick tab switches
        visibilityTimeout.current = window.setTimeout(() => {
          setOffline();
        }, VISIBILITY_DEBOUNCE);
      }
    };

    // Handle window focus/blur
    const handleFocus = () => setOnline();
    const handleBlur = () => {
      if (visibilityTimeout.current) {
        clearTimeout(visibilityTimeout.current);
      }
      visibilityTimeout.current = window.setTimeout(() => {
        setOffline();
      }, VISIBILITY_DEBOUNCE);
    };

    // Handle before unload
    const handleBeforeUnload = () => {
      // Synchronous update - best effort
      navigator.sendBeacon && navigator.sendBeacon(
        `https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/update-presence`,
        JSON.stringify({ user_id: user.id, is_online: false })
      );
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (visibilityTimeout.current) {
        clearTimeout(visibilityTimeout.current);
      }
      
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      // Set offline on unmount
      setOffline();
    };
  }, [user?.id, setOnline, setOffline, updatePresence]);

  return { setOnline, setOffline };
}
