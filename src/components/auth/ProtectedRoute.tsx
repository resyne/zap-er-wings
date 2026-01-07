import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      // Save the current path so we can redirect back after login
      navigate("/auth", { state: { from: location.pathname + location.search } });
    }
  }, [user, loading, navigate, location]);

  // Check if user has ERP domain access
  const hasERPAccess = user?.email?.endsWith('@abbattitorizapper.it');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // If user doesn't have ERP domain, show access denied
  if (!hasERPAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-xl">Accesso Negato</CardTitle>
            <CardDescription>
              L'accesso all'ERP è riservato esclusivamente agli utenti con dominio @abbattitorizapper.it
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Il tuo account: <strong>{user.email}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              Per accedere all'ERP devi utilizzare un account con dominio aziendale.
            </p>
            <Button 
              onClick={() => {
                navigate("/auth");
              }}
              className="w-full"
            >
              Torna al Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}