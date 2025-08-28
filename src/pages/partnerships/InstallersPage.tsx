import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, CheckCircle2, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PartnerMap } from "@/components/partnerships/PartnerMap";
import { AddPartnerForm } from "@/components/partnerships/AddPartnerForm";
import { InstallerKanban } from "@/components/partnerships/InstallerKanban";
import { EmailComposer } from "@/components/partnerships/EmailComposer";

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
  region?: string;
  acquisition_status?: string;
  acquisition_notes?: string;
  priority?: string;
  created_at: string;
}

export default function InstallersPage() {
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchInstallers();
  }, []);

  const fetchInstallers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'installatore')
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

  const handleSendEmail = async () => {
    try {
      setIsEmailDialogOpen(false);
      
      const { data, error } = await supabase.functions.invoke('send-partner-emails', {
        body: {
          partner_type: 'installatore',
          region: selectedRegion === "all" ? undefined : selectedRegion,
          subject: emailSubject,
          message: emailMessage,
          is_cronjob: false
        }
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Email inviata a ${data.emails_sent} installatori`,
      });
      
      // Reset form
      setEmailSubject('');
      setEmailMessage('');
      setSelectedRegion('all');
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Errore",
        description: "Errore nell'invio delle email",
        variant: "destructive",
      });
    }
  };

  const installersWithLocation = installers.filter(p => p.latitude && p.longitude);
  const activeInstallers = installers.filter(i => i.acquisition_status === 'attivo' || !i.acquisition_status);
  const regions = [...new Set(installers.map(i => i.region).filter(Boolean))];
  
  const getInstallersByRegion = () => {
    const regionGroups: Record<string, Installer[]> = {};
    
    installers.forEach(installer => {
      const region = installer.region || 'No Region';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(installer);
    });
    
    return regionGroups;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Installers</h1>
          <p className="text-muted-foreground">
            Manage your network of certified installers and service partners
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Mail className="mr-2 h-4 w-4" />
                Send Email
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <EmailComposer onClose={() => setIsEmailDialogOpen(false)} />
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Installatore
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Aggiungi Nuovo Installatore</DialogTitle>
              </DialogHeader>
              <AddPartnerForm onPartnerAdded={handleInstallerAdded} defaultPartnerType="installatore" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="regions">By Region</TabsTrigger>
          <TabsTrigger value="map">Installers Map</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <InstallerKanban />
        </TabsContent>

        <TabsContent value="regions">
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-4">Loading installers...</div>
            ) : installers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No installers found. Add your first installer to get started.
              </div>
            ) : (
              Object.entries(getInstallersByRegion()).map(([region, regionInstallers]) => (
                <Card key={region}>
                  <CardHeader>
                    <CardTitle>{region} ({regionInstallers.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Company</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {regionInstallers.map((installer) => (
                          <TableRow key={installer.id}>
                            <TableCell>
                              {installer.first_name} {installer.last_name}
                            </TableCell>
                            <TableCell>
                              {installer.company_name}
                            </TableCell>
                            <TableCell>
                              {installer.email || '-'}
                            </TableCell>
                            <TableCell>
                              {installer.phone || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {installer.address}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
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