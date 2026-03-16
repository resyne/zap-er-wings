import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { Header } from "./header";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserRole } from "@/hooks/useUserRole";
import FloatingAIChat from "@/components/ai/FloatingAIChat";

export function AppLayout() {
  const { user, session, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { userRole, isZAppOnly } = useUserRole();
  const location = useLocation();

  useEffect(() => {
    if (isZAppOnly && location.pathname !== '/hr/z-app' && !location.pathname.startsWith('/hr/z-app/') && location.pathname !== '/auth') {
      navigate('/hr/z-app', { replace: true });
    }
  }, [isZAppOnly, location.pathname, navigate]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of ZAPPER ERP",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (!user || !session) {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          <Header 
            user={{
              name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
              email: user.email || '',
              role: userRole || 'user'
            }}
            onLogout={handleLogout}
          />
          
          <main className="flex-1 p-3 md:p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
      
      <Toaster />
      <FloatingAIChat />
    </SidebarProvider>
  );
}