import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserManagement } from "@/components/settings/UserManagement";
import { RolePermissions } from "@/components/settings/RolePermissions";
import { SystemSettings } from "@/components/settings/SystemSettings";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { PasswordChange } from "@/components/settings/PasswordChange";
import { ProfileEdit } from "@/components/settings/ProfileEdit";
import { ERPDocumentationMap } from "@/components/settings/ERPDocumentationMap";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Users, Shield, Settings, AlertCircle, Lock, Zap, BookOpen } from "lucide-react";

export function SettingsPage() {
  const { user } = useAuth();
  const { userRole, loading } = useUserRole();
  const [activeTab, setActiveTab] = useState("users");

  const isAdmin = userRole === "admin";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Caricamento...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Impostazioni Sistema</h1>
          <p className="text-muted-foreground">
            Gestisci utenti, ruoli e configurazioni del sistema
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isAdmin ? "default" : "secondary"}>
            {userRole || "user"}
          </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Profilo</span>
          </TabsTrigger>
          <TabsTrigger value="password" className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            <span className="hidden sm:inline">Password</span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="flex items-center gap-2" disabled={!isAdmin}>
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Ruoli</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2" disabled={!isAdmin}>
            <Zap className="h-4 w-4" />
            <span className="hidden sm:inline">Integrazioni</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-2" disabled={!isAdmin}>
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Sistema</span>
          </TabsTrigger>
          <TabsTrigger value="docs" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Mappa ERP</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <ProfileEdit />
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Gestione Utenti
                </CardTitle>
                <CardDescription>
                  Gestisci gli utenti del sistema e i loro ruoli
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UserManagement />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="password" className="space-y-4">
          <PasswordChange />
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          {!isAdmin ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Solo gli amministratori possono gestire ruoli e permessi
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Ruoli e Permessi
                </CardTitle>
                <CardDescription>
                  Configura i permessi per ogni ruolo del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RolePermissions />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="integrations" className="space-y-4">
          {!isAdmin ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Solo gli amministratori possono gestire le integrazioni
                </p>
              </CardContent>
            </Card>
          ) : (
            <IntegrationsSettings />
          )}
        </TabsContent>

        <TabsContent value="system" className="space-y-4">
          {!isAdmin ? (
            <Card>
              <CardContent className="flex items-center gap-3 p-6">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Solo gli amministratori possono accedere alle impostazioni di sistema
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Impostazioni Sistema
                </CardTitle>
                <CardDescription>
                  Configura le impostazioni generali del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SystemSettings />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="docs" className="space-y-4">
          <ERPDocumentationMap />
        </TabsContent>
      </Tabs>
    </div>
  );
}