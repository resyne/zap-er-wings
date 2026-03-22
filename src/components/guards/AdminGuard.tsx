import { useUserRole } from "@/hooks/useUserRole";
import { ShieldAlert, Loader2 } from "lucide-react";

interface AdminGuardProps {
  children: React.ReactNode;
  section?: string;
}

export function AdminGuard({ children, section = "questa sezione" }: AdminGuardProps) {
  const { isAdmin, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold">Accesso Riservato</h2>
          <p className="text-muted-foreground">
            L'accesso a {section} è riservato esclusivamente agli amministratori.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
