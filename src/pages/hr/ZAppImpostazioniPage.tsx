import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationSettings } from "@/components/settings/NotificationSettings";

export default function ZAppImpostazioniPage() {
  const navigate = useNavigate();
  const { userRole } = useUserRole();
  const isAdmin = userRole === "admin";

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="bg-muted-foreground text-background px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-background hover:bg-background/20" onClick={() => navigate("/hr/z-app")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-bold">Impostazioni</h1>
          </div>
        </div>
        <div className="p-6 text-center text-muted-foreground">Solo gli amministratori possono accedere.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="bg-muted-foreground text-background px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-background hover:bg-background/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Impostazioni Notifiche</h1>
            <p className="text-muted text-xs">Gestisci destinatari per ogni evento</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <NotificationSettings />
      </div>
    </div>
  );
}
