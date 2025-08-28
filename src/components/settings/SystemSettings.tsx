import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Settings, 
  Database, 
  Mail, 
  Bell, 
  Shield, 
  Clock,
  Globe,
  Palette,
  Save
} from "lucide-react";

interface SystemConfig {
  // General Settings
  companyName: string;
  companyEmail: string;
  timezone: string;
  language: string;
  
  // Email Settings
  emailEnabled: boolean;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  
  // Notification Settings
  emailNotifications: boolean;
  pushNotifications: boolean;
  maintenanceMode: boolean;
  
  // Security Settings
  sessionTimeout: number;
  requireStrongPasswords: boolean;
  enableTwoFactor: boolean;
  
  // System Settings
  maxFileSize: number;
  autoBackup: boolean;
  debugMode: boolean;
}

const defaultConfig: SystemConfig = {
  companyName: "ZAPPER ERP",
  companyEmail: "admin@zapper.com",
  timezone: "Europe/Rome",
  language: "it",
  emailEnabled: true,
  smtpHost: "smtp.resend.com",
  smtpPort: "587",
  smtpUser: "",
  emailNotifications: true,
  pushNotifications: false,
  maintenanceMode: false,
  sessionTimeout: 24,
  requireStrongPasswords: true,
  enableTwoFactor: false,
  maxFileSize: 10,
  autoBackup: true,
  debugMode: false,
};

export function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      // Here you would save to your backend/database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      
      toast({
        title: "Successo",
        description: "Impostazioni salvate con successo",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile salvare le impostazioni",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: keyof SystemConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Impostazioni Generali
          </CardTitle>
          <CardDescription>
            Configurazioni base del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="companyName">Nome Azienda</Label>
            <Input
              id="companyName"
              value={config.companyName}
              onChange={(e) => updateConfig("companyName", e.target.value)}
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="companyEmail">Email Aziendale</Label>
            <Input
              id="companyEmail"
              type="email"
              value={config.companyEmail}
              onChange={(e) => updateConfig("companyEmail", e.target.value)}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="timezone">Fuso Orario</Label>
              <Input
                id="timezone"
                value={config.timezone}
                onChange={(e) => updateConfig("timezone", e.target.value)}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="language">Lingua</Label>
              <Input
                id="language"
                value={config.language}
                onChange={(e) => updateConfig("language", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Email Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Impostazioni Email
          </CardTitle>
          <CardDescription>
            Configurazioni per l'invio email
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailEnabled">Email Abilitate</Label>
              <p className="text-sm text-muted-foreground">
                Abilita l'invio di email dal sistema
              </p>
            </div>
            <Switch
              id="emailEnabled"
              checked={config.emailEnabled}
              onCheckedChange={(checked) => updateConfig("emailEnabled", checked)}
            />
          </div>
          
          {config.emailEnabled && (
            <>
              <Separator />
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="smtpHost">SMTP Host</Label>
                  <Input
                    id="smtpHost"
                    value={config.smtpHost}
                    onChange={(e) => updateConfig("smtpHost", e.target.value)}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="smtpPort">SMTP Port</Label>
                    <Input
                      id="smtpPort"
                      value={config.smtpPort}
                      onChange={(e) => updateConfig("smtpPort", e.target.value)}
                    />
                  </div>
                  
                  <div className="grid gap-2">
                    <Label htmlFor="smtpUser">SMTP User</Label>
                    <Input
                      id="smtpUser"
                      value={config.smtpUser}
                      onChange={(e) => updateConfig("smtpUser", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Impostazioni Sicurezza
          </CardTitle>
          <CardDescription>
            Configurazioni di sicurezza del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sessionTimeout">Timeout Sessione (ore)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              value={config.sessionTimeout}
              onChange={(e) => updateConfig("sessionTimeout", parseInt(e.target.value))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requireStrongPasswords">Password Sicure Obbligatorie</Label>
              <p className="text-sm text-muted-foreground">
                Richiedi password complesse per tutti gli utenti
              </p>
            </div>
            <Switch
              id="requireStrongPasswords"
              checked={config.requireStrongPasswords}
              onCheckedChange={(checked) => updateConfig("requireStrongPasswords", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enableTwoFactor">Autenticazione a Due Fattori</Label>
              <p className="text-sm text-muted-foreground">
                Abilita 2FA per gli amministratori
              </p>
            </div>
            <Switch
              id="enableTwoFactor"
              checked={config.enableTwoFactor}
              onCheckedChange={(checked) => updateConfig("enableTwoFactor", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Impostazioni Notifiche
          </CardTitle>
          <CardDescription>
            Configurazioni per le notifiche di sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailNotifications">Notifiche Email</Label>
              <p className="text-sm text-muted-foreground">
                Invia notifiche via email agli utenti
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={config.emailNotifications}
              onCheckedChange={(checked) => updateConfig("emailNotifications", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="pushNotifications">Notifiche Push</Label>
              <p className="text-sm text-muted-foreground">
                Abilita notifiche push nel browser
              </p>
            </div>
            <Switch
              id="pushNotifications"
              checked={config.pushNotifications}
              onCheckedChange={(checked) => updateConfig("pushNotifications", checked)}
            />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="maintenanceMode">Modalità Manutenzione</Label>
              <p className="text-sm text-muted-foreground">
                Attiva la modalità manutenzione per il sistema
              </p>
            </div>
            <div className="flex items-center gap-2">
              {config.maintenanceMode && (
                <Badge variant="destructive">Attiva</Badge>
              )}
              <Switch
                id="maintenanceMode"
                checked={config.maintenanceMode}
                onCheckedChange={(checked) => updateConfig("maintenanceMode", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Prestazioni Sistema
          </CardTitle>
          <CardDescription>
            Configurazioni per le prestazioni del sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="maxFileSize">Dimensione Max File (MB)</Label>
            <Input
              id="maxFileSize"
              type="number"
              value={config.maxFileSize}
              onChange={(e) => updateConfig("maxFileSize", parseInt(e.target.value))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoBackup">Backup Automatico</Label>
              <p className="text-sm text-muted-foreground">
                Abilita backup automatici giornalieri
              </p>
            </div>
            <Switch
              id="autoBackup"
              checked={config.autoBackup}
              onCheckedChange={(checked) => updateConfig("autoBackup", checked)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="debugMode">Modalità Debug</Label>
              <p className="text-sm text-muted-foreground">
                Abilita logging dettagliato per debug
              </p>
            </div>
            <Switch
              id="debugMode"
              checked={config.debugMode}
              onCheckedChange={(checked) => updateConfig("debugMode", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="min-w-32">
          {saving ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salva Impostazioni
            </>
          )}
        </Button>
      </div>
    </div>
  );
}