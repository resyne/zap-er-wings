import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

type UserRole = "admin" | "moderator" | "user" | null;

export function useUserRole() {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [isZAppOnly, setIsZAppOnly] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setUserRole(null);
      setIsZAppOnly(false);
      setLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const [roleResult, profileResult] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
          supabase.from("profiles").select("z_app_only").eq("id", user.id).single()
        ]);

        const { data: roleData, error: roleError } = roleResult;
        const { data: profileData } = profileResult;

        if (roleError && roleError.code !== 'PGRST116') {
          console.error("Error fetching user role:", roleError);
          setUserRole("user"); // Default role
        } else {
          setUserRole(roleData?.role || "user");
        }
        
        setIsZAppOnly(profileData?.z_app_only || false);
      } catch (error) {
        console.error("Error fetching user role:", error);
        setUserRole("user"); // Default role
        setIsZAppOnly(false);
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
    isZAppOnly,
    loading,
    hasRole,
    isAdmin: userRole === "admin",
    isModerator: userRole === "moderator" || userRole === "admin",
  };
}