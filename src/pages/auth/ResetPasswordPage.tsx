import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, KeyRound, ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionOk, setSessionOk] = useState(false);

  const hashParams = useMemo(() => {
    const raw = location.hash?.startsWith("#") ? location.hash.slice(1) : location.hash;
    return new URLSearchParams(raw || "");
  }, [location.hash]);

  const queryParams = useMemo(() => new URLSearchParams(location.search), [location.search]);

  // PKCE flow uses ?code= query param; implicit flow uses #type=recovery
  const isRecoveryLink = hashParams.get("type") === "recovery" || queryParams.has("code");

  useEffect(() => {
    // Se il link contiene il token di recovery, Supabase (detectSessionInUrl=true)
    // dovrebbe creare automaticamente una sessione. Qui la verifichiamo.
    let alive = true;

    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (!alive) return;
        setSessionOk(!!data.session);
      } catch {
        if (!alive) return;
        setSessionOk(false);
      } finally {
        if (alive) setCheckingSession(false);
      }
    };

    // Esegui subito e ascolta eventuale exchange del token.
    check();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      if (session) {
        setSessionOk(true);
        setCheckingSession(false);
      }
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sessionOk) {
      toast({
        title: "Link non valido",
        description: "Richiedi un nuovo link di recupero password.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Errore",
        description: "Le password non corrispondono",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Errore",
        description: "La password deve essere di almeno 6 caratteri",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({
        title: "Password aggiornata",
        description: "Ora puoi accedere con la nuova password.",
      });

      // Per sicurezza, rimandiamo alla login.
      navigate("/auth", { replace: true });
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error?.message || "Errore durante l'aggiornamento della password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isRecoveryLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna al login
            </Link>
            <h1 className="text-3xl font-bold">Reset Password</h1>
            <p className="text-muted-foreground">Il link non è un link di recupero valido.</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Link non valido</CardTitle>
              <CardDescription>
                Richiedi un nuovo link di recupero dalla schermata di accesso.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" onClick={() => navigate("/auth", { replace: true })}>
                Vai al login
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Torna al login
          </Link>
          <h1 className="text-3xl font-bold">Imposta una nuova password</h1>
          <p className="text-muted-foreground">Scegli una nuova password per il tuo account.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Nuova Password
            </CardTitle>
            <CardDescription>
              {checkingSession
                ? "Verifica del link in corso..."
                : sessionOk
                  ? "Inserisci e conferma la nuova password."
                  : "Il link sembra scaduto o già usato. Richiedine uno nuovo."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Nuova password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Inserisci la nuova password"
                    required
                    minLength={6}
                    disabled={checkingSession || !sessionOk}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword((v) => !v)}
                    disabled={checkingSession || !sessionOk}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Conferma nuova password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Conferma la nuova password"
                    required
                    minLength={6}
                    disabled={checkingSession || !sessionOk}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    disabled={checkingSession || !sessionOk}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || checkingSession || !sessionOk}
              >
                {isLoading ? "Aggiornamento..." : "Aggiorna password"}
              </Button>

              {!checkingSession && !sessionOk && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={() => navigate("/auth", { replace: true })}
                >
                  Richiedi un nuovo link
                </Button>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
