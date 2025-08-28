import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Users, 
  Wrench, 
  Package, 
  FileText, 
  DollarSign, 
  Settings, 
  BarChart3, 
  ShoppingCart 
} from "lucide-react";

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface RolePermissions {
  [role: string]: {
    [permissionId: string]: boolean;
  };
}

const permissions: Permission[] = [
  // Dashboard & Analytics
  { id: "dashboard.view", name: "Visualizzare Dashboard", description: "Accesso alla dashboard principale", category: "dashboard" },
  { id: "analytics.view", name: "Visualizzare Analytics", description: "Accesso ai report e analytics", category: "dashboard" },
  
  // CRM
  { id: "crm.view", name: "Visualizzare CRM", description: "Accesso al modulo CRM", category: "crm" },
  { id: "crm.create", name: "Creare record CRM", description: "Creare contatti, aziende, opportunità", category: "crm" },
  { id: "crm.edit", name: "Modificare CRM", description: "Modificare record CRM esistenti", category: "crm" },
  { id: "crm.delete", name: "Eliminare CRM", description: "Eliminare record CRM", category: "crm" },
  
  // Production
  { id: "production.view", name: "Visualizzare Produzione", description: "Accesso al modulo produzione", category: "production" },
  { id: "production.create", name: "Creare Ordini Produzione", description: "Creare ordini di produzione", category: "production" },
  { id: "production.edit", name: "Modificare Produzione", description: "Modificare ordini di produzione", category: "production" },
  { id: "production.execute", name: "Eseguire Produzione", description: "Registrare esecuzioni produzione", category: "production" },
  
  // Warehouse
  { id: "warehouse.view", name: "Visualizzare Magazzino", description: "Accesso al modulo magazzino", category: "warehouse" },
  { id: "warehouse.movements", name: "Gestire Movimenti", description: "Registrare movimenti di magazzino", category: "warehouse" },
  { id: "warehouse.inventory", name: "Gestire Inventario", description: "Gestire inventario e scorte", category: "warehouse" },
  
  // Procurement
  { id: "procurement.view", name: "Visualizzare Acquisti", description: "Accesso al modulo acquisti", category: "procurement" },
  { id: "procurement.create", name: "Creare Ordini Acquisto", description: "Creare ordini di acquisto", category: "procurement" },
  { id: "procurement.approve", name: "Approvare Acquisti", description: "Approvare ordini di acquisto", category: "procurement" },
  
  // Finance
  { id: "finance.view", name: "Visualizzare Finanza", description: "Accesso al modulo finanza", category: "finance" },
  { id: "finance.create", name: "Creare Record Finanziari", description: "Creare fatture e prima nota", category: "finance" },
  { id: "finance.reports", name: "Report Finanziari", description: "Accesso ai report finanziari", category: "finance" },
  
  // Partnerships
  { id: "partnerships.view", name: "Visualizzare Partnership", description: "Accesso al modulo partnership", category: "partnerships" },
  { id: "partnerships.manage", name: "Gestire Partnership", description: "Gestire partner e comunicazioni", category: "partnerships" },
  
  // System
  { id: "system.settings", name: "Impostazioni Sistema", description: "Accesso alle impostazioni di sistema", category: "system" },
  { id: "system.users", name: "Gestire Utenti", description: "Gestire utenti e ruoli", category: "system" },
];

const defaultRolePermissions: RolePermissions = {
  user: {
    "dashboard.view": true,
    "crm.view": true,
    "production.view": true,
    "warehouse.view": true,
    "procurement.view": true,
    "finance.view": true,
    "partnerships.view": true,
  },
  moderator: {
    "dashboard.view": true,
    "analytics.view": true,
    "crm.view": true,
    "crm.create": true,
    "crm.edit": true,
    "production.view": true,
    "production.create": true,
    "production.edit": true,
    "production.execute": true,
    "warehouse.view": true,
    "warehouse.movements": true,
    "warehouse.inventory": true,
    "procurement.view": true,
    "procurement.create": true,
    "finance.view": true,
    "finance.create": true,
    "partnerships.view": true,
    "partnerships.manage": true,
  },
  admin: Object.fromEntries(permissions.map(p => [p.id, true])),
};

const categoryIcons = {
  dashboard: BarChart3,
  crm: Users,
  production: Wrench,
  warehouse: Package,
  procurement: ShoppingCart,
  finance: DollarSign,
  partnerships: Users,
  system: Settings,
};

const categoryNames = {
  dashboard: "Dashboard & Analytics",
  crm: "CRM",
  production: "Produzione", 
  warehouse: "Magazzino",
  procurement: "Acquisti",
  finance: "Finanza",
  partnerships: "Partnership",
  system: "Sistema",
};

export function RolePermissions() {
  const [rolePermissions, setRolePermissions] = useState<RolePermissions>(defaultRolePermissions);
  const [selectedRole, setSelectedRole] = useState("user");

  const togglePermission = (role: string, permissionId: string) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [permissionId]: !prev[role]?.[permissionId],
      },
    }));
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        <div>
          <h3 className="text-lg font-semibold">Configurazione Ruoli e Permessi</h3>
          <p className="text-sm text-muted-foreground">
            Gestisci i permessi per ogni ruolo del sistema
          </p>
        </div>
        
        <Tabs value={selectedRole} onValueChange={setSelectedRole}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="user" className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant("user")}>User</Badge>
            </TabsTrigger>
            <TabsTrigger value="moderator" className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant("moderator")}>Moderator</Badge>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center gap-2">
              <Badge variant={getRoleBadgeVariant("admin")}>Admin</Badge>
            </TabsTrigger>
          </TabsList>

          {Object.keys(defaultRolePermissions).map((role) => (
            <TabsContent key={role} value={role} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Permessi per {role}
                  </CardTitle>
                  <CardDescription>
                    Configura i permessi specifici per il ruolo {role}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => {
                    const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
                    return (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2 pb-2">
                          <IconComponent className="h-4 w-4" />
                          <h4 className="font-medium">{categoryNames[category as keyof typeof categoryNames]}</h4>
                        </div>
                        
                        <div className="grid gap-3 pl-6">
                          {categoryPermissions.map((permission) => (
                            <div key={permission.id} className="flex items-center justify-between space-x-2">
                              <div className="space-y-0.5">
                                <Label htmlFor={`${role}-${permission.id}`} className="text-sm font-medium">
                                  {permission.name}
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                              <Switch
                                id={`${role}-${permission.id}`}
                                checked={rolePermissions[role]?.[permission.id] || false}
                                onCheckedChange={() => togglePermission(role, permission.id)}
                              />
                            </div>
                          ))}
                        </div>
                        
                        {Object.keys(groupedPermissions).indexOf(category) < Object.keys(groupedPermissions).length - 1 && (
                          <Separator />
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}