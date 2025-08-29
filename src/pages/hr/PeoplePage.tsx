import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Search, User, Wrench, Building2, Phone, Mail, Calendar, Activity } from "lucide-react";

interface Employee {
  id: string;
  fluida_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  status: string;
  salary?: number;
  synced_at?: string;
}

interface Technician {
  id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
  address?: string;
  hire_date?: string;
  position?: string;
  specializations?: string[];
  certification_level?: string;
  hourly_rate?: number;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  active: boolean;
  notes?: string;
  created_at: string;
}

export default function PeoplePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTermTech, setSearchTermTech] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load employees from HR
      const { data: employeesData, error: employeesError } = await supabase
        .from('hr_employees')
        .select('*')
        .order('first_name');

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Load technicians
      const { data: techniciansData, error: techniciansError } = await supabase
        .from('technicians')
        .select('*')
        .order('first_name');

      if (techniciansError) throw techniciansError;
      setTechnicians(techniciansData || []);

    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati del personale: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string, active?: boolean) => {
    if (active !== undefined) {
      return (
        <Badge variant={active ? "default" : "secondary"}>
          {active ? "Attivo" : "Inattivo"}
        </Badge>
      );
    }
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      'active': 'default',
      'inactive': 'secondary',
      'pending': 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  const filteredEmployees = employees.filter(emp =>
    `${emp.first_name} ${emp.last_name} ${emp.email || ""} ${emp.department || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const filteredTechnicians = technicians.filter(tech =>
    `${tech.first_name} ${tech.last_name} ${tech.employee_code} ${tech.position || ""}`
      .toLowerCase()
      .includes(searchTermTech.toLowerCase())
  );

  const activeEmployees = employees.filter(emp => emp.status === 'active');
  const activeTechnicians = technicians.filter(tech => tech.active);
  const totalPersonnel = employees.length + technicians.length;
  const totalActive = activeEmployees.length + activeTechnicians.length;

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento personale...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Personale</h1>
          <p className="text-muted-foreground">Overview completa di tutto il personale aziendale</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center">
              <Users className="w-4 h-4 mr-2" />
              Totale Personale
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPersonnel}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center">
              <Activity className="w-4 h-4 mr-2" />
              Personale Attivo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalActive}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Dipendenti HR
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
            <p className="text-xs text-muted-foreground">Attivi: {activeEmployees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center">
              <Wrench className="w-4 h-4 mr-2" />
              Tecnici
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{technicians.length}</div>
            <p className="text-xs text-muted-foreground">Attivi: {activeTechnicians.length}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="employees">Dipendenti HR</TabsTrigger>
          <TabsTrigger value="technicians">Tecnici</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dipendenti HR ({filteredEmployees.length})</CardTitle>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Cerca dipendenti..."
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
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Contatto</TableHead>
                    <TableHead>Dipartimento</TableHead>
                    <TableHead>Posizione</TableHead>
                    <TableHead>Data Assunzione</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2" />
                          <div>
                            <span className="font-medium">
                              {employee.first_name} {employee.last_name}
                            </span>
                            <div className="text-sm text-muted-foreground">
                              ID: {employee.fluida_id}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {employee.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {employee.email}
                            </div>
                          )}
                          {employee.phone && (
                            <div className="flex items-center text-sm">
                              <Phone className="w-3 h-3 mr-1" />
                              {employee.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.department && (
                          <Badge variant="outline">{employee.department}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.position && (
                          <Badge variant="secondary">{employee.position}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {employee.hire_date && (
                          <div className="flex items-center text-sm">
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(employee.hire_date).toLocaleDateString('it-IT')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(employee.status)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredEmployees.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Users className="w-8 h-8 text-muted-foreground" />
                          <span className="text-muted-foreground">Nessun dipendente trovato</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="technicians">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tecnici ({filteredTechnicians.length})</CardTitle>
                <div className="relative w-80">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Cerca tecnici..."
                    value={searchTermTech}
                    onChange={(e) => setSearchTermTech(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tecnico</TableHead>
                    <TableHead>Contatto</TableHead>
                    <TableHead>Posizione</TableHead>
                    <TableHead>Specializzazioni</TableHead>
                    <TableHead>Livello</TableHead>
                    <TableHead>Tariffa/h</TableHead>
                    <TableHead>Stato</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTechnicians.map((technician) => (
                    <TableRow key={technician.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <Wrench className="w-4 h-4 mr-2" />
                          <div>
                            <span className="font-medium">
                              {technician.first_name} {technician.last_name}
                            </span>
                            <div className="text-sm text-muted-foreground">
                              {technician.employee_code}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {technician.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {technician.email}
                            </div>
                          )}
                          {(technician.phone || technician.mobile) && (
                            <div className="flex items-center text-sm">
                              <Phone className="w-3 h-3 mr-1" />
                              {technician.mobile || technician.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {technician.position && (
                          <Badge variant="outline">{technician.position}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(technician.specializations || []).slice(0, 2).map((spec, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {spec}
                            </Badge>
                          ))}
                          {(technician.specializations || []).length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{(technician.specializations || []).length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {technician.certification_level && (
                          <Badge variant={
                            technician.certification_level === 'expert' || technician.certification_level === 'specialist' 
                              ? 'default' 
                              : 'secondary'
                          }>
                            {technician.certification_level}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {technician.hourly_rate && (
                          <span className="font-medium">€{technician.hourly_rate.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge("", technician.active)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredTechnicians.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">
                        <div className="flex flex-col items-center space-y-2">
                          <Wrench className="w-8 h-8 text-muted-foreground" />
                          <span className="text-muted-foreground">Nessun tecnico trovato</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}