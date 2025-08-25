import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Building2, Phone, Mail, MapPin, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Supplier {
  id: string;
  code: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  taxId: string;
  paymentTerms: number;
  active: boolean;
}

const SuppliersPage = () => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Mock data
  const suppliers: Supplier[] = [
    {
      id: "1",
      code: "SUP001",
      name: "Acme Corporation",
      email: "orders@acme.com",
      phone: "+39 02 1234567",
      address: "Via Milano 123",
      city: "Milano",
      country: "Italia",
      taxId: "IT12345678901",
      paymentTerms: 30,
      active: true
    },
    {
      id: "2",
      code: "SUP002",
      name: "Tech Solutions Ltd",
      email: "procurement@techsol.com",
      phone: "+39 06 9876543",
      address: "Via Roma 456",
      city: "Roma",
      country: "Italia",
      taxId: "IT98765432109",
      paymentTerms: 60,
      active: true
    },
    {
      id: "3",
      code: "SUP003",
      name: "Global Supplies Inc",
      email: "sales@globalsupplies.com",
      phone: "+39 011 5554433",
      address: "Corso Torino 789",
      city: "Torino",
      country: "Italia",
      taxId: "IT11223344556",
      paymentTerms: 45,
      active: false
    }
  ];

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddSupplier = () => {
    toast({
      title: "Funzione non implementata",
      description: "La creazione di nuovi fornitori sarà implementata presto.",
    });
    setIsDialogOpen(false);
  };

  const handleEditSupplier = (supplier: Supplier) => {
    toast({
      title: "Funzione non implementata",
      description: `Modifica fornitore ${supplier.name} sarà implementata presto.`,
    });
  };

  const handleDeleteSupplier = (supplier: Supplier) => {
    toast({
      title: "Funzione non implementata",
      description: `Eliminazione fornitore ${supplier.name} sarà implementata presto.`,
      variant: "destructive",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Fornitori</h1>
          <p className="text-muted-foreground">
            Gestisci l'anagrafica dei tuoi fornitori
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuovo Fornitore
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Fornitore</DialogTitle>
              <DialogDescription>
                Inserisci i dati del nuovo fornitore qui sotto.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Form di creazione fornitore in fase di implementazione...
              </p>
              <Button onClick={handleAddSupplier} className="w-full">
                Salva Fornitore
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornitori Attivi</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.filter(s => s.active).length}</div>
            <p className="text-xs text-muted-foreground">
              +2 dal mese scorso
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totale Fornitori</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.length}</div>
            <p className="text-xs text-muted-foreground">
              Nel database
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pagamento Medio</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(suppliers.reduce((acc, s) => acc + s.paymentTerms, 0) / suppliers.length)} gg
            </div>
            <p className="text-xs text-muted-foreground">
              Giorni di pagamento
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fornitori Inattivi</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{suppliers.filter(s => !s.active).length}</div>
            <p className="text-xs text-muted-foreground">
              Da riattivare
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco Fornitori</CardTitle>
          <CardDescription>
            Visualizza e gestisci tutti i tuoi fornitori
          </CardDescription>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cerca fornitori..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codice</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Contatti</TableHead>
                <TableHead>Indirizzo</TableHead>
                <TableHead>Pagamento</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSuppliers.map((supplier) => (
                <TableRow key={supplier.id}>
                  <TableCell className="font-medium">{supplier.code}</TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{supplier.name}</div>
                      <div className="text-sm text-muted-foreground">{supplier.taxId}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex items-center text-sm">
                        <Mail className="mr-1 h-3 w-3" />
                        {supplier.email}
                      </div>
                      <div className="flex items-center text-sm">
                        <Phone className="mr-1 h-3 w-3" />
                        {supplier.phone}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <MapPin className="mr-1 h-3 w-3" />
                      <div>
                        <div>{supplier.address}</div>
                        <div className="text-muted-foreground">{supplier.city}, {supplier.country}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{supplier.paymentTerms} giorni</TableCell>
                  <TableCell>
                    <Badge variant={supplier.active ? "default" : "secondary"}>
                      {supplier.active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditSupplier(supplier)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteSupplier(supplier)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuppliersPage;