import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Users, CheckCircle2, Mail, Send, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PartnerMap } from "@/components/partnerships/PartnerMap";
import { AddPartnerForm } from "@/components/partnerships/AddPartnerForm";
import { ImporterKanban } from "@/components/partnerships/ImporterKanban";
import { EmailComposer } from "@/components/partnerships/EmailComposer";
import { PartnerPriceLists } from "@/components/partnerships/PartnerPriceLists";
interface Importer {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  company_name: string;
  address: string;
  website?: string;
  notes?: string;
  price_lists?: any;
  pricing_notes?: string;
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
export default function ImportersPage() {
  const [importers, setImporters] = useState<Importer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchImporters();
  }, []);
  const fetchImporters = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('partners').select('*').eq('partner_type', 'importatore').order('created_at', {
        ascending: false
      });
      if (error) throw error;
      setImporters(data || []);
    } catch (error) {
      console.error('Error fetching importers:', error);
      toast({
        title: "Error",
        description: "Failed to load importers",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const handleImporterAdded = (newImporter: Importer) => {
    setImporters(prev => [newImporter, ...prev]);
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Importer added successfully"
    });
  };
  const handleImporterUpdated = (updatedImporter: Importer) => {
    setImporters(prev => prev.map(p => p.id === updatedImporter.id ? updatedImporter : p));
    toast({
      title: "Success",
      description: "Importer updated successfully"
    });
  };
  const handleImporterDeleted = (importerId: string) => {
    setImporters(prev => prev.filter(p => p.id !== importerId));
  };
  const handleSendEmail = async () => {
    try {
      setIsEmailDialogOpen(false);
      const {
        data,
        error
      } = await supabase.functions.invoke('send-partner-emails', {
        body: {
          partner_type: 'importatore',
          region: selectedRegion === "all" ? undefined : selectedRegion,
          subject: emailSubject,
          message: emailMessage,
          is_cronjob: false
        }
      });
      if (error) throw error;
      toast({
        title: "Successo",
        description: `Email inviata a ${data.emails_sent} importatori`
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
        variant: "destructive"
      });
    }
  };
  const filteredImporters = importers.filter(importer => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      importer.first_name?.toLowerCase().includes(search) ||
      importer.last_name?.toLowerCase().includes(search) ||
      importer.company_name?.toLowerCase().includes(search) ||
      importer.email?.toLowerCase().includes(search) ||
      importer.phone?.toLowerCase().includes(search) ||
      importer.region?.toLowerCase().includes(search)
    );
  });

  const importersWithLocation = filteredImporters.filter(p => p.latitude && p.longitude);
  const activeImporters = filteredImporters.filter(i => i.acquisition_status === 'attivo' || !i.acquisition_status);
  const regions = [...new Set(filteredImporters.map(i => i.region).filter(Boolean))];
  const getImportersByRegion = () => {
    const regionGroups: Record<string, Importer[]> = {};
    filteredImporters.forEach(importer => {
      const region = importer.region || 'No Region';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(importer);
    });
    return regionGroups;
  };
  return <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Importers</h1>
          <p className="text-muted-foreground">
            Manage your network of certified importers and distribution partners
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
                Aggiungi Importatore
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Aggiungi Nuovo Importatore</DialogTitle>
              </DialogHeader>
              <AddPartnerForm onPartnerAdded={handleImporterAdded} defaultPartnerType="importatore" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, azienda, email, telefono o regione..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Selected Importers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredImporters.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Importers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeImporters.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="regions">By Region</TabsTrigger>
          <TabsTrigger value="map">Importers Map</TabsTrigger>
          <TabsTrigger value="pricelists">Price Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <ImporterKanban />
        </TabsContent>

        <TabsContent value="regions">
          <div className="space-y-6">
            {loading ? <div className="text-center py-4">Loading importers...</div> : filteredImporters.length === 0 ? <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Nessun importatore trovato per questa ricerca." : "No importers found. Add your first importer to get started."}
              </div> : Object.entries(getImportersByRegion()).map(([region, regionImporters]) => <Card key={region}>
                  <CardHeader>
                    <CardTitle>{region} ({regionImporters.length})</CardTitle>
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
                        {regionImporters.map(importer => <TableRow key={importer.id}>
                            <TableCell>
                              {importer.first_name} {importer.last_name}
                            </TableCell>
                            <TableCell>
                              {importer.company_name}
                            </TableCell>
                            <TableCell>
                              {importer.email || '-'}
                            </TableCell>
                            <TableCell>
                              {importer.phone || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {importer.address}
                            </TableCell>
                          </TableRow>)}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>)}
          </div>
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Importers Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <PartnerMap partners={importersWithLocation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricelists">
          <div className="space-y-6">
            {filteredImporters.map((importer) => (
              <div key={importer.id}>
                <PartnerPriceLists
                  partnerId={importer.id}
                  partnerName={`${importer.first_name} ${importer.last_name} - ${importer.company_name}`}
                  priceLists={Array.isArray(importer.price_lists) ? importer.price_lists : []}
                  pricingNotes={importer.pricing_notes || ""}
                  onUpdate={fetchImporters}
                />
              </div>
            ))}
            {filteredImporters.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {searchQuery ? "Nessun importatore trovato per questa ricerca." : "No importers found. Add your first importer to get started."}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>;
}