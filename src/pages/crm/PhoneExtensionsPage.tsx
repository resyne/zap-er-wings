import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Phone, Plus, Pencil, Trash2, User } from "lucide-react";

interface PhoneExtension {
  id: string;
  extension_number: string;
  user_id: string | null;
  operator_name: string;
  operator_email: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export default function PhoneExtensionsPage() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingExtension, setEditingExtension] = useState<PhoneExtension | null>(null);
  const [formData, setFormData] = useState({
    extension_number: '',
    user_id: '',
    operator_name: '',
    operator_email: '',
    department: '',
    is_active: true
  });

  // Fetch phone extensions
  const { data: extensions, isLoading } = useQuery({
    queryKey: ['phone-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('phone_extensions')
        .select('*')
        .order('extension_number');
      if (error) throw error;
      return data as PhoneExtension[];
    }
  });

  // Fetch users/profiles for dropdown
  const { data: profiles } = useQuery({
    queryKey: ['profiles-for-extensions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name')
        .order('first_name');
      if (error) throw error;
      return data as Profile[];
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        extension_number: data.extension_number,
        user_id: data.user_id || null,
        operator_name: data.operator_name,
        operator_email: data.operator_email || null,
        department: data.department || null,
        is_active: data.is_active
      };

      if (editingExtension) {
        const { error } = await supabase
          .from('phone_extensions')
          .update(payload)
          .eq('id', editingExtension.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('phone_extensions')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-extensions'] });
      toast.success(editingExtension ? 'Interno aggiornato' : 'Interno aggiunto');
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('phone_extensions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phone-extensions'] });
      toast.success('Interno eliminato');
    },
    onError: (error: any) => {
      toast.error(`Errore: ${error.message}`);
    }
  });

  const handleOpenDialog = (extension?: PhoneExtension) => {
    if (extension) {
      setEditingExtension(extension);
      setFormData({
        extension_number: extension.extension_number,
        user_id: extension.user_id || '',
        operator_name: extension.operator_name,
        operator_email: extension.operator_email || '',
        department: extension.department || '',
        is_active: extension.is_active
      });
    } else {
      setEditingExtension(null);
      setFormData({
        extension_number: '',
        user_id: '',
        operator_name: '',
        operator_email: '',
        department: '',
        is_active: true
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingExtension(null);
  };

  const handleUserSelect = (userId: string) => {
    const profile = profiles?.find(p => p.id === userId);
    if (profile) {
      setFormData(prev => ({
        ...prev,
        user_id: userId,
        operator_name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
        operator_email: profile.email
      }));
    } else {
      setFormData(prev => ({ ...prev, user_id: userId }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.extension_number || !formData.operator_name) {
      toast.error('Numero interno e nome operatore sono obbligatori');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Phone className="h-8 w-8" />
            Mappatura Interni Telefonici
          </h1>
          <p className="text-muted-foreground mt-1">
            Configura la corrispondenza tra interni telefonici e operatori per il tracciamento delle chiamate
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Aggiungi Interno
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingExtension ? 'Modifica Interno' : 'Nuovo Interno'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="extension_number">Numero Interno *</Label>
                <Input
                  id="extension_number"
                  value={formData.extension_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, extension_number: e.target.value }))}
                  placeholder="Es: 101, 102, 201..."
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user_id">Utente Sistema (opzionale)</Label>
                <Select 
                  value={formData.user_id} 
                  onValueChange={handleUserSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona un utente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nessun utente</SelectItem>
                    {profiles?.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.first_name || profile.last_name 
                          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                          : profile.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="operator_name">Nome Operatore *</Label>
                <Input
                  id="operator_name"
                  value={formData.operator_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, operator_name: e.target.value }))}
                  placeholder="Nome e cognome"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="operator_email">Email Operatore</Label>
                <Input
                  id="operator_email"
                  type="email"
                  value={formData.operator_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, operator_email: e.target.value }))}
                  placeholder="email@azienda.it"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Reparto</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                  placeholder="Es: Commerciale, Assistenza, Amministrazione..."
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Attivo</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Annulla
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? 'Salvataggio...' : 'Salva'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Interni Configurati</CardTitle>
          <CardDescription>
            Elenco degli interni telefonici associati agli operatori
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Caricamento...</div>
          ) : extensions && extensions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Interno</TableHead>
                  <TableHead>Operatore</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Reparto</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extensions.map((ext) => (
                  <TableRow key={ext.id}>
                    <TableCell className="font-mono font-bold">
                      {ext.extension_number}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {ext.operator_name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ext.operator_email || '-'}
                    </TableCell>
                    <TableCell>{ext.department || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={ext.is_active ? 'default' : 'secondary'}>
                        {ext.is_active ? 'Attivo' : 'Disattivato'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenDialog(ext)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm('Eliminare questo interno?')) {
                              deleteMutation.mutate(ext.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Phone className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nessun interno configurato</p>
              <p className="text-sm">Aggiungi la mappatura degli interni per tracciare chi risponde alle chiamate</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
