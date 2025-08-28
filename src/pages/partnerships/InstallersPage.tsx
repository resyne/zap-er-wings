import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Users, Building2, Wrench, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PartnerMap } from "@/components/partnerships/PartnerMap";
import { AddPartnerForm } from "@/components/partnerships/AddPartnerForm";
import { PartnerActions } from "@/components/partnerships/PartnerActions";

interface Installer {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  company_name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  partner_type?: string;
  country?: string;
  acquisition_status?: string;
  acquisition_notes?: string;
  priority?: string;
  created_at: string;
}

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchInstallers();
  }, []);

  const fetchInstallers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'rivenditore')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInstallers(data || []);
    } catch (error) {
      console.error('Error fetching installers:', error);
      toast({
        title: "Error",
        description: "Failed to load installers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInstallerAdded = (newInstaller: Installer) => {
    setInstallers(prev => [newInstaller, ...prev]);
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Installer added successfully",
    });
  };

  const handleInstallerUpdated = (updatedInstaller: Installer) => {
    setInstallers(prev => prev.map(p => p.id === updatedInstaller.id ? updatedInstaller : p));
    toast({
      title: "Success",
      description: "Installer updated successfully",
    });
  };

  const handleInstallerDeleted = (installerId: string) => {
    setInstallers(prev => prev.filter(p => p.id !== installerId));
  };

  const installersWithLocation = installers.filter(p => p.latitude && p.longitude);
  const activeInstallers = installers.filter(i => i.acquisition_status === 'attivo' || !i.acquisition_status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Installers</h1>
          <p className="text-muted-foreground">
            Manage your network of certified installers and service providers
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Installer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Installer</DialogTitle>
            </DialogHeader>
            <AddPartnerForm onPartnerAdded={handleInstallerAdded} defaultPartnerType="rivenditore" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Installers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Installers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeInstallers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Location</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{installersWithLocation.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(installers.map(p => p.company_name)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Installers List</TabsTrigger>
          <TabsTrigger value="map">Installers Map</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle>Installers ({installers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading installers...</div>
              ) : installers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No installers found. Add your first installer to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {installers.map((installer) => (
                      <TableRow key={installer.id}>
                        <TableCell>
                          {installer.first_name} {installer.last_name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-muted-foreground" />
                            {installer.company_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {installer.email && (
                              <div className="text-sm">{installer.email}</div>
                            )}
                            {installer.phone && (
                              <div className="text-sm text-muted-foreground">{installer.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {installer.address}
                        </TableCell>
                        <TableCell>
                          <Badge variant={installer.latitude && installer.longitude ? "default" : "secondary"}>
                            {installer.latitude && installer.longitude ? "Located" : "No Location"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PartnerActions
                            partner={installer}
                            onPartnerUpdated={handleInstallerUpdated}
                            onPartnerDeleted={handleInstallerDeleted}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Installers Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <PartnerMap partners={installersWithLocation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}