import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, MapPin, Users, Building2, Store, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PartnerMap } from "@/components/partnerships/PartnerMap";
import { AddPartnerForm } from "@/components/partnerships/AddPartnerForm";
import { PartnerActions } from "@/components/partnerships/PartnerActions";
import { ImporterKanban } from "@/components/partnerships/ImporterKanban";

interface Partner {
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

export default function PartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'importatore')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPartners(data || []);
    } catch (error) {
      console.error('Error fetching partners:', error);
      toast({
        title: "Error",
        description: "Failed to load partners",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePartnerAdded = (newPartner: Partner) => {
    setPartners(prev => [newPartner, ...prev]);
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Partner added successfully",
    });
  };

  const handlePartnerUpdated = (updatedPartner: Partner) => {
    setPartners(prev => prev.map(p => p.id === updatedPartner.id ? updatedPartner : p));
    toast({
      title: "Success",
      description: "Partner updated successfully",
    });
  };

  const handlePartnerDeleted = (partnerId: string) => {
    setPartners(prev => prev.filter(p => p.id !== partnerId));
  };

  const partnersWithLocation = partners.filter(p => p.latitude && p.longitude);
  const importers = partners.filter(p => p.partner_type === 'importatore');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Partners</h1>
          <p className="text-muted-foreground">
            Manage your global importer network and acquisition pipeline
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Partner
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Partner</DialogTitle>
            </DialogHeader>
            <AddPartnerForm onPartnerAdded={handlePartnerAdded} defaultPartnerType="importatore" />
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Partners</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{importers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Partners</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {importers.filter(i => i.acquisition_status === 'attivo').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="acquisition" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="acquisition">Importer Pipeline</TabsTrigger>
          <TabsTrigger value="map">Partners Map</TabsTrigger>
          <TabsTrigger value="importers">Importers List</TabsTrigger>
        </TabsList>

        <TabsContent value="acquisition">
          <ImporterKanban />
        </TabsContent>

        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>Importers Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <PartnerMap partners={importers.filter(p => p.latitude && p.longitude)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importers">
          <Card>
            <CardHeader>
              <CardTitle>Importers ({importers.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-4">Loading partners...</div>
              ) : importers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No importers found. Add your first importer to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead className="w-16">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importers.map((partner) => (
                      <TableRow key={partner.id}>
                        <TableCell>
                          {partner.first_name} {partner.last_name}
                        </TableCell>
                        <TableCell>{partner.company_name}</TableCell>
                        <TableCell>{partner.country || "N/A"}</TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {partner.email && (
                              <div className="text-sm">{partner.email}</div>
                            )}
                            {partner.phone && (
                              <div className="text-sm text-muted-foreground">{partner.phone}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={partner.acquisition_status === 'attivo' ? 'default' : 'secondary'}>
                            {partner.acquisition_status || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={partner.priority === 'high' ? 'destructive' : 
                                   partner.priority === 'medium' ? 'default' : 'secondary'}
                          >
                            {partner.priority || 'medium'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <PartnerActions
                            partner={partner}
                            onPartnerUpdated={handlePartnerUpdated}
                            onPartnerDeleted={handlePartnerDeleted}
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
      </Tabs>
    </div>
  );
}