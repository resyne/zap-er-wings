import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "moderator" | "user" | null;

export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error("Error fetching user role:", error);
          setUserRole("user"); // Default role
        } else {
          setUserRole(data?.role || "user");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("user"); // Default role
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  const hasRole = (role: UserRole) => {
    if (role === "user") return true; // Everyone has user role
    if (role === "moderator") return userRole === "moderator" || userRole === "admin";
    if (role === "admin") return userRole === "admin";
    return false;
  };

  return {
    userRole,
    loading,
    hasRole,
    isAdmin: userRole === "admin",
    isModerator: userRole === "moderator" || userRole === "admin",
  };
}