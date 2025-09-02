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
import { ResellerKanban } from "@/components/partnerships/ResellerKanban";
import { PartnerPriceLists } from "@/components/partnerships/PartnerPriceLists";

interface Reseller {
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

export default function ResellersPage() {
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchResellers();
  }, []);

  const fetchResellers = async () => {
    try {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .eq('partner_type', 'rivenditore')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setResellers(data || []);
    } catch (error) {
      console.error('Error fetching resellers:', error);
      toast({
        title: "Error",
        description: "Failed to load resellers",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResellerAdded = (newReseller: Reseller) => {
    setResellers(prev => [newReseller, ...prev]);
    setIsAddDialogOpen(false);
    toast({
      title: "Success",
      description: "Reseller added successfully",
    });
  };

  const handleResellerUpdated = (updatedReseller: Reseller) => {
    setResellers(prev => prev.map(p => p.id === updatedReseller.id ? updatedReseller : p));
    toast({
      title: "Success",
      description: "Reseller updated successfully",
    });
  };

  const handleResellerDeleted = (resellerId: string) => {
    setResellers(prev => prev.filter(p => p.id !== resellerId));
  };

  const handleSendEmail = async () => {
    try {
      setIsEmailDialogOpen(false);
      
      const { data, error } = await supabase.functions.invoke('send-partner-emails', {
        body: {
          partner_type: 'rivenditore',
          region: selectedRegion === "all" ? undefined : selectedRegion,
          subject: emailSubject,
          message: emailMessage,
          is_cronjob: false
        }
      });

      if (error) throw error;

      toast({
        title: "Successo",
        description: `Email inviata a ${data.emails_sent} rivenditori`,
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

  const resellersWithLocation = resellers.filter(p => p.latitude && p.longitude);
  const activeResellers = resellers.filter(r => r.acquisition_status === 'attivo' || !r.acquisition_status);
  const regions = [...new Set(resellers.map(r => r.region).filter(Boolean))];
  
  const getResellersByRegion = () => {
    const regionGroups: Record<string, Reseller[]> = {};
    
    resellers.forEach(reseller => {
      const region = reseller.region || 'No Region';
      if (!regionGroups[region]) {
        regionGroups[region] = [];
      }
      regionGroups[region].push(reseller);
    });
    
    return regionGroups;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Resellers</h1>
          <p className="text-muted-foreground">
            Manage your network of authorized resellers and retail partners
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Send Email to Resellers</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Region</label>
                  <select 
                    value={selectedRegion} 
                    onChange={(e) => setSelectedRegion(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
                  >
                    <option value="all">All Regions</option>
                    {regions.map(region => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <input
                    type="text"
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border border-input rounded-md bg-background"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Message</label>
                  <Textarea
                    value={emailMessage}
                    onChange={(e) => setEmailMessage(e.target.value)}
                    className="w-full mt-1 min-h-32"
                    placeholder="Write your message here..."
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEmailDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSendEmail} disabled={!emailSubject || !emailMessage}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Email
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Aggiungi Rivenditore
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Aggiungi Nuovo Rivenditore</DialogTitle>
              </DialogHeader>
              <AddPartnerForm onPartnerAdded={handleResellerAdded} defaultPartnerType="rivenditore" />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Resellers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resellers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Resellers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeResellers.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="pipeline" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="regions">By Region</TabsTrigger>
          <TabsTrigger value="map">Resellers Map</TabsTrigger>
          <TabsTrigger value="pricelists">Price Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <ResellerKanban />
        </TabsContent>

        <TabsContent value="regions">
          <div className="space-y-6">
            {loading ? (
              <div className="text-center py-4">Loading resellers...</div>
            ) : resellers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No resellers found. Add your first reseller to get started.
              </div>
            ) : (
              Object.entries(getResellersByRegion()).map(([region, regionResellers]) => (
                <Card key={region}>
                  <CardHeader>
                    <CardTitle>{region} ({regionResellers.length})</CardTitle>
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
                        {regionResellers.map((reseller) => (
                          <TableRow key={reseller.id}>
                            <TableCell>
                              {reseller.first_name} {reseller.last_name}
                            </TableCell>
                            <TableCell>
                              {reseller.company_name}
                            </TableCell>
                            <TableCell>
                              {reseller.email || '-'}
                            </TableCell>
                            <TableCell>
                              {reseller.phone || '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {reseller.address}
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
              <CardTitle>Resellers Map</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-96 w-full">
                <PartnerMap partners={resellersWithLocation} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pricelists">
          <div className="space-y-6">
            {resellers.map((reseller) => (
              <div key={reseller.id}>
                <PartnerPriceLists
                  partnerId={reseller.id}
                  partnerName={`${reseller.first_name} ${reseller.last_name} - ${reseller.company_name}`}
                  priceLists={Array.isArray(reseller.price_lists) ? reseller.price_lists : []}
                  pricingNotes={reseller.pricing_notes || ""}
                  onUpdate={fetchResellers}
                />
              </div>
            ))}
            {resellers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No resellers found. Add your first reseller to get started.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}