import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Smartphone, Users, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserRole } from "@/hooks/useUserRole";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { ZAppVisibilityDialog } from "@/components/settings/ZAppVisibilityDialog";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface UserProfile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export default function ZAppImpostazioniPage() {
  const navigate = useNavigate();
  const { userRole } = useUserRole();
  const isAdmin = userRole === "admin";
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .order("first_name");
      if (error) throw error;
      setUsers(data || []);
    } catch (e) {
      console.error("Error fetching users:", e);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (u: UserProfile) => {
    if (u.first_name || u.last_name) return `${u.first_name || ""} ${u.last_name || ""}`.trim();
    return u.email;
  };

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
            <h1 className="text-lg font-bold">Impostazioni Z-APP</h1>
            <p className="text-muted text-xs">Notifiche e visibilità pagine</p>
          </div>
        </div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        <Tabs defaultValue="visibility" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="visibility" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Pagine Z-APP
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifiche
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visibility">
            <div className="bg-background rounded-xl border shadow-sm">
              <div className="p-4 border-b">
                <h2 className="font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Visibilità pagine per utente
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Scegli quali pagine Z-APP può vedere ogni utente
                </p>
              </div>
              <div className="divide-y">
                {loading ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Caricamento utenti...</div>
                ) : users.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Nessun utente trovato</div>
                ) : (
                  users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => { setSelectedUser(user); setDialogOpen(true); }}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div>
                        <p className="font-medium text-sm">{getUserName(user)}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationSettings />
          </TabsContent>
        </Tabs>
      </div>

      {selectedUser && (
        <ZAppVisibilityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          userId={selectedUser.id}
          userName={getUserName(selectedUser)}
        />
      )}
    </div>
  );
}
