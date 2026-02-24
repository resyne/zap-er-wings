import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Search, Eye, EyeOff, Smartphone } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPageVisibilityDialog } from "./UserPageVisibilityDialog";
import { Switch } from "@/components/ui/switch";

interface UserWithRole {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: "admin" | "moderator" | "user";
  user_type: "erp" | "website";
  created_at: string;
  hide_amounts?: boolean;
  z_app_only?: boolean;
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedUserType, setSelectedUserType] = useState("erp"); // Default to ERP users only
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [visibilityDialogOpen, setVisibilityDialogOpen] = useState(false);
  const [selectedUserForVisibility, setSelectedUserForVisibility] = useState<UserWithRole | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    role: "user" as "admin" | "moderator" | "user"
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name, user_type, created_at, hide_amounts, z_app_only");

      if (profilesError) throw profilesError;

      // Fetch user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Combine profiles with their roles
      const usersWithRoles = profiles?.map(profile => ({
        id: profile.id,
        email: profile.email,
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        user_type: (profile.user_type as "erp" | "website") || "website",
        role: (roles?.find(r => r.user_id === profile.id)?.role || "user") as "admin" | "moderator" | "user",
        created_at: profile.created_at,
        hide_amounts: profile.hide_amounts || false,
        z_app_only: profile.z_app_only || false
      })) || [];

      setUsers(usersWithRoles);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Errore",
        description: "Impossibile caricare gli utenti",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      // Check if role exists
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .single();

      if (existingRole) {
        // Update existing role
        const { error } = await supabase
          .from("user_roles")
          .update({ role: newRole as any })
          .eq("user_id", userId);

        if (error) throw error;
      } else {
        // Insert new role
        const { error } = await supabase
          .from("user_roles")
          .insert({ user_id: userId, role: newRole as any });

        if (error) throw error;
      }

      toast({
        title: "Successo",
        description: "Ruolo utente aggiornato con successo",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error updating user role:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare il ruolo utente",
        variant: "destructive",
      });
    }
  };

  const toggleHideAmounts = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ hide_amounts: !currentValue })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Importi ${!currentValue ? 'nascosti' : 'visibili'} per questo utente`,
      });

      fetchUsers();
    } catch (error) {
      console.error("Error updating hide_amounts:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare le impostazioni",
        variant: "destructive",
      });
    }
  };

  const toggleZAppOnly = async (userId: string, currentValue: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ z_app_only: !currentValue })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Accesso Z-APP ${!currentValue ? 'attivato' : 'disattivato'} per questo utente`,
      });

      fetchUsers();
    } catch (error) {
      console.error("Error updating z_app_only:", error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare le impostazioni",
        variant: "destructive",
      });
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      // First delete user role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (roleError) throw roleError;

      // Then delete from auth.users (this will cascade to profiles)
      const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);

      if (deleteError) throw deleteError;

      toast({
        title: "Successo",
        description: "Utente eliminato con successo",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Errore",
        description: "Impossibile eliminare l'utente. Verifica i permessi.",
        variant: "destructive",
      });
    }
  };

  const createUser = async () => {
    try {
      setLoading(true);
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Errore",
          description: "Sessione non valida. Effettua nuovamente il login.",
          variant: "destructive",
        });
        return;
      }

      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: newUserForm.email,
          password: newUserForm.password,
          firstName: newUserForm.firstName,
          lastName: newUserForm.lastName,
          role: newUserForm.role
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        toast({
          title: "Errore",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Successo",
        description: "Nuovo utente ERP creato con successo",
      });

      // Reset form and close dialog
      setNewUserForm({
        email: "",
        password: "",
        firstName: "",
        lastName: "",
        role: "user"
      });
      setIsDialogOpen(false);
      
      // Refresh users list
      fetchUsers();
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare il nuovo utente. Verifica di avere i permessi di amministratore.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchTerm || 
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = selectedRole === "all" || user.role === selectedRole;
    const matchesUserType = selectedUserType === "all" || user.user_type === selectedUserType;
    
    return matchesSearch && matchesRole && matchesUserType;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
  };

  const getUserTypeBadgeVariant = (userType: string) => {
    return userType === "erp" ? "default" : "outline";
  };

  if (loading) {
    return <div className="text-center py-4">Caricamento utenti...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <Label htmlFor="search">Cerca utenti</Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              id="search"
              placeholder="Cerca per email o nome..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <div>
          <Label htmlFor="role-filter">Filtra per ruolo</Label>
          <Select value={selectedRole} onValueChange={setSelectedRole}>
            <SelectTrigger id="role-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i ruoli</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="user">User</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="usertype-filter">Filtra per tipo</Label>
          <Select value={selectedUserType} onValueChange={setSelectedUserType}>
            <SelectTrigger id="usertype-filter" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              <SelectItem value="erp">ERP (@abbattitorizapper.it)</SelectItem>
              <SelectItem value="website">Siti Web (zkor/pro)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utenti ERP ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Gestisci gli utenti dell'ERP (@abbattitorizapper.it)
              </CardDescription>
            </div>
            {isAdmin && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Aggiungi Utente
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crea Nuovo Utente</DialogTitle>
                    <DialogDescription>
                      Aggiungi un nuovo utente al sistema con email e password.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="new-email">Email</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="utente@esempio.it"
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-password">Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                        minLength={6}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid gap-2">
                        <Label htmlFor="new-firstName">Nome</Label>
                        <Input
                          id="new-firstName"
                          value={newUserForm.firstName}
                          onChange={(e) => setNewUserForm(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="Mario"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="new-lastName">Cognome</Label>
                        <Input
                          id="new-lastName"
                          value={newUserForm.lastName}
                          onChange={(e) => setNewUserForm(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Rossi"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="new-role">Ruolo</Label>
                      <Select 
                        value={newUserForm.role} 
                        onValueChange={(value) => setNewUserForm(prev => ({ ...prev, role: value as any }))}
                      >
                        <SelectTrigger id="new-role">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Annulla
                    </Button>
                    <Button 
                      onClick={createUser}
                      disabled={!newUserForm.email || !newUserForm.password || loading}
                    >
                      {loading ? "Creazione..." : "Crea Utente"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ruolo</TableHead>
                <TableHead>Nascondi Importi</TableHead>
                <TableHead>Solo Z-APP</TableHead>
                <TableHead>Data Registrazione</TableHead>
                {isAdmin && <TableHead className="text-right">Azioni</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    {user.first_name && user.last_name 
                      ? `${user.first_name} ${user.last_name}`
                      : "Non specificato"
                    }
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                   <TableCell>
                    <Badge variant={getUserTypeBadgeVariant(user.user_type)}>
                      {user.user_type === "erp" ? "ERP" : "Web"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(user.role)}>
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.hide_amounts || false}
                        onCheckedChange={() => toggleHideAmounts(user.id, user.hide_amounts || false)}
                        disabled={!isAdmin || user.id === currentUser?.id}
                      />
                      {user.hide_amounts ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={user.z_app_only || false}
                        onCheckedChange={() => toggleZAppOnly(user.id, user.z_app_only || false)}
                        disabled={!isAdmin || user.id === currentUser?.id}
                      />
                      <Smartphone className={`h-4 w-4 ${user.z_app_only ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('it-IT')}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                       <div className="flex items-center justify-end gap-2">
                        <Select
                          value={user.role}
                          onValueChange={(newRole) => updateUserRole(user.id, newRole)}
                          disabled={user.id === currentUser?.id}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="moderator">Moderator</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedUserForVisibility(user);
                            setVisibilityDialogOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        
                        {user.id !== currentUser?.id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Rimuovi utente</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Sei sicuro di voler rimuovere questo utente? 
                                  Questa azione rimuoverà i suoi ruoli ma non cancellerà l'account.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annulla</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteUser(user.id)}>
                                  Rimuovi
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedUserForVisibility && (
        <UserPageVisibilityDialog
          open={visibilityDialogOpen}
          onOpenChange={setVisibilityDialogOpen}
          userId={selectedUserForVisibility.id}
          userName={`${selectedUserForVisibility.first_name} ${selectedUserForVisibility.last_name}` || selectedUserForVisibility.email}
        />
      )}
    </div>
  );
}