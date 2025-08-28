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
import { Plus, Edit, Trash2, Search } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role?: "admin" | "moderator" | "user";
  created_at: string;
}

export function UserManagement() {
  const { user: currentUser } = useAuth();
  const { isAdmin } = useUserRole();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      // Start with user roles to get all users with roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch profiles for all users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select(`
          id,
          email,
          first_name,
          last_name,
          created_at
        `);

      if (profilesError) throw profilesError;

      // Combine data - start with roles and add profile info where available
      const usersWithRoles = roles?.map(roleRecord => {
        const profile = profiles?.find(p => p.id === roleRecord.user_id);
        return {
          id: roleRecord.user_id,
          email: profile?.email || "Email non disponibile",
          first_name: profile?.first_name || "",
          last_name: profile?.last_name || "",
          role: roleRecord.role as "admin" | "moderator" | "user",
          created_at: profile?.created_at || new Date().toISOString()
        };
      }) || [];

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

  const deleteUser = async (userId: string) => {
    try {
      // Note: In a real app, you might want to deactivate rather than delete
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Utente rimosso con successo",
      });

      fetchUsers();
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Errore",
        description: "Impossibile rimuovere l'utente",
        variant: "destructive",
      });
    }
  };

  const createUser = async () => {
    try {
      setLoading(true);
      
      // Create user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUserForm.email,
        password: newUserForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            first_name: newUserForm.firstName,
            last_name: newUserForm.lastName,
          }
        }
      });

      if (authError) {
        if (authError.message.includes("User already registered")) {
          toast({
            title: "Errore",
            description: "Un utente con questa email esiste già",
            variant: "destructive",
          });
        } else {
          throw authError;
        }
        return;
      }

      if (authData.user) {
        // Add user role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ 
            user_id: authData.user.id, 
            role: newUserForm.role as any 
          });

        if (roleError) throw roleError;

        toast({
          title: "Successo",
          description: "Nuovo utente creato con successo",
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
      }
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Errore",
        description: "Impossibile creare il nuovo utente",
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
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin": return "destructive";
      case "moderator": return "default";
      default: return "secondary";
    }
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
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Utenti ({filteredUsers.length})</CardTitle>
              <CardDescription>
                Gestisci gli utenti e i loro ruoli nel sistema
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
                <DialogContent className="sm:max-w-[425px]">
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
                <TableHead>Ruolo</TableHead>
                <TableHead>Data Registrazione</TableHead>
                {isAdmin && <TableHead>Azioni</TableHead>}
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
                    <Badge variant={getRoleBadgeVariant(user.role || "user")}>
                      {user.role || "user"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString('it-IT')}
                  </TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Select
                          value={user.role || "user"}
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
    </div>
  );
}