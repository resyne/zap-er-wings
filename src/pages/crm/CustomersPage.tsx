import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, Building2, Mail, Phone, MapPin, Plus, Edit, Send, AlertTriangle, X } from "lucide-react";
import { CreateCustomerDialog } from "@/components/crm/CreateCustomerDialog";
import { EditCustomerDialog } from "@/components/crm/EditCustomerDialog";
import { CustomerEmailComposer } from "@/components/crm/CustomerEmailComposer";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i clienti: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = customers.filter(customer =>
    `${customer.name} ${customer.company_name || ""} ${customer.email || ""} ${customer.city || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const totalCustomers = filteredCustomers.length;
  const activeCustomers = filteredCustomers.filter(customer => customer.active);

  // Function to check if customer profile is incomplete (excluding shipping_address)
  const isProfileIncomplete = (customer: any) => {
    const requiredFields = ['name', 'email', 'phone', 'address', 'city', 'country', 'tax_id'];
    const missingFields = requiredFields.filter(field => !customer[field] || customer[field].trim() === '');
    return missingFields.length > 0 && !dismissedAlerts.has(customer.id);
  };

  const dismissAlert = (customerId: string) => {
    setDismissedAlerts(prev => new Set([...prev, customerId]));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Clienti</h1>
          <p className="text-muted-foreground">Gestisci i tuoi clienti e le loro informazioni</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setEmailComposerOpen(true)}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Invia Email
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nuovo Cliente
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Clienti Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCustomers}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Clienti Attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCustomers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Con Azienda Specificata</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredCustomers.filter(c => c.company_name).length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Clienti ({filteredCustomers.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca clienti..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Azienda</TableHead>
                <TableHead>Contatto</TableHead>
                <TableHead>Località</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <Building2 className="w-4 h-4 mr-2" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{customer.name}</span>
                          {isProfileIncomplete(customer) && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 rounded-md text-amber-700">
                              <AlertTriangle className="w-3 h-3" />
                              <span className="text-xs font-medium">Anagrafica da completare</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissAlert(customer.id);
                                }}
                                className="ml-1 hover:bg-amber-100 rounded-sm p-0.5"
                                title="Nascondi avviso"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Codice: {customer.code}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {customer.company_name && (
                      <span className="text-sm font-medium">{customer.company_name}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {customer.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="w-3 h-3 mr-1" />
                          {customer.email}
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 mr-1" />
                          {customer.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {(customer.city || customer.country) && (
                      <div className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        <span className="text-sm">
                          {customer.city}{customer.city && customer.country && ", "}{customer.country}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={customer.active ? "default" : "secondary"}>
                      {customer.active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateCustomerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCustomerCreated={() => {
          loadCustomers();
          toast({
            title: "Successo",
            description: "Cliente creato con successo",
          });
        }}
      />

      <EditCustomerDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        customer={selectedCustomer}
        onCustomerUpdated={() => {
          loadCustomers();
          setSelectedCustomer(null);
          toast({
            title: "Successo",
            description: "Cliente aggiornato con successo",
          });
        }}
      />

      {emailComposerOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <CustomerEmailComposer 
            onClose={() => setEmailComposerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}