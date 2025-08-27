import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, RefreshCw, Globe, Mail, Phone, Building2 } from "lucide-react";

interface Company {
  id: string;
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  industry?: string;
  employees_count?: number;
  annual_revenue?: number;
  billing_address?: string;
  shipping_address?: string;
  created_at: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newCompany, setNewCompany] = useState({
    name: "",
    website: "",
    phone: "",
    email: "",
    industry: "",
    employees_count: "",
    annual_revenue: "",
    billing_address: "",
    shipping_address: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from("crm_companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare le aziende: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const handleCreateCompany = async () => {
    try {
      const companyData = {
        ...newCompany,
        employees_count: newCompany.employees_count ? parseInt(newCompany.employees_count) : null,
        annual_revenue: newCompany.annual_revenue ? parseFloat(newCompany.annual_revenue) : null,
      };

      const { error } = await supabase
        .from("crm_companies")
        .insert([companyData]);

      if (error) throw error;

      toast({
        title: "Azienda creata",
        description: "L'azienda è stata creata con successo",
      });

      setIsDialogOpen(false);
      setNewCompany({
        name: "",
        website: "",
        phone: "",
        email: "",
        industry: "",
        employees_count: "",
        annual_revenue: "",
        billing_address: "",
        shipping_address: "",
      });
      await loadCompanies();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare l'azienda: " + error.message,
        variant: "destructive",
      });
    }
  };

  const filteredCompanies = companies.filter(company =>
    `${company.name} ${company.email} ${company.industry || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento aziende...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Aziende</h1>
          <p className="text-muted-foreground">Gestisci le tue aziende</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nuova Azienda
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Crea Nuova Azienda</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="name">Nome Azienda *</Label>
                  <Input
                    id="name"
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({...newCompany, name: e.target.value})}
                    placeholder="Nome azienda"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="website">Sito Web</Label>
                  <Input
                    id="website"
                    value={newCompany.website}
                    onChange={(e) => setNewCompany({...newCompany, website: e.target.value})}
                    placeholder="https://www.esempio.com"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({...newCompany, email: e.target.value})}
                    placeholder="info@azienda.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefono</Label>
                  <Input
                    id="phone"
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({...newCompany, phone: e.target.value})}
                    placeholder="+39 123 456 7890"
                  />
                </div>
                <div>
                  <Label htmlFor="industry">Settore</Label>
                  <Input
                    id="industry"
                    value={newCompany.industry}
                    onChange={(e) => setNewCompany({...newCompany, industry: e.target.value})}
                    placeholder="Tecnologia, Manifatturiero..."
                  />
                </div>
                <div>
                  <Label htmlFor="employees_count">Dipendenti</Label>
                  <Input
                    id="employees_count"
                    type="number"
                    value={newCompany.employees_count}
                    onChange={(e) => setNewCompany({...newCompany, employees_count: e.target.value})}
                    placeholder="50"
                  />
                </div>
                <div>
                  <Label htmlFor="annual_revenue">Fatturato Annuo (€)</Label>
                  <Input
                    id="annual_revenue"
                    type="number"
                    value={newCompany.annual_revenue}
                    onChange={(e) => setNewCompany({...newCompany, annual_revenue: e.target.value})}
                    placeholder="1000000"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="billing_address">Indirizzo di Fatturazione</Label>
                  <Input
                    id="billing_address"
                    value={newCompany.billing_address}
                    onChange={(e) => setNewCompany({...newCompany, billing_address: e.target.value})}
                    placeholder="Via Roma 123, 00100 Roma, Italia"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Annulla
                </Button>
                <Button onClick={handleCreateCompany} disabled={!newCompany.name}>
                  Crea Azienda
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Aziende ({filteredCompanies.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca aziende..."
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
                <TableHead>Azienda</TableHead>
                <TableHead>Contatto</TableHead>
                <TableHead>Settore</TableHead>
                <TableHead>Dipendenti</TableHead>
                <TableHead>Fatturato</TableHead>
                
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center">
                        <Building2 className="w-4 h-4 mr-2 text-muted-foreground" />
                        <span className="font-medium">{company.name}</span>
                      </div>
                      {company.website && (
                        <div className="flex items-center text-sm text-muted-foreground mt-1">
                          <Globe className="w-3 h-3 mr-1" />
                          <a 
                            href={company.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {company.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {company.email && (
                        <div className="flex items-center text-sm">
                          <Mail className="w-3 h-3 mr-1" />
                          {company.email}
                        </div>
                      )}
                      {company.phone && (
                        <div className="flex items-center text-sm">
                          <Phone className="w-3 h-3 mr-1" />
                          {company.phone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {company.industry && (
                      <Badge variant="secondary">{company.industry}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.employees_count && (
                      <span className="text-sm">{company.employees_count.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.annual_revenue && (
                      <span className="text-sm">€{company.annual_revenue.toLocaleString()}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredCompanies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchTerm ? "Nessuna azienda trovata" : "Nessuna azienda presente"}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}