import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Mail, Phone, User, Settings, CheckCircle, XCircle, Clock } from "lucide-react";

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

export default function TechniciansPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  const [newTechnician, setNewTechnician] = useState({
    employee_code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    mobile: "",
    address: "",
    hire_date: "",
    position: "",
    specializations: [] as string[],
    certification_level: "",
    hourly_rate: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadTechnicians();
  }, []);

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from("technicians")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile caricare i tecnici: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTechnician = async () => {
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("technicians")
        .insert([{
          ...newTechnician,
          hourly_rate: newTechnician.hourly_rate ? parseFloat(newTechnician.hourly_rate) : null,
          hire_date: newTechnician.hire_date || null,
          specializations: newTechnician.specializations.length > 0 ? newTechnician.specializations : null,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Tecnico creato",
        description: "Il tecnico è stato aggiunto con successo",
      });

      setIsDialogOpen(false);
      setNewTechnician({
        employee_code: "",
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        mobile: "",
        address: "",
        hire_date: "",
        position: "",
        specializations: [],
        certification_level: "",
        hourly_rate: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        notes: "",
      });
      await loadTechnicians();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il tecnico: " + error.message,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSpecializationChange = (specialization: string) => {
    const current = newTechnician.specializations;
    if (current.includes(specialization)) {
      setNewTechnician({
        ...newTechnician,
        specializations: current.filter(s => s !== specialization)
      });
    } else {
      setNewTechnician({
        ...newTechnician,
        specializations: [...current, specialization]
      });
    }
  };

  const toggleTechnicianStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("technicians")
        .update({ active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: `Tecnico ${!currentStatus ? "attivato" : "disattivato"} con successo`,
      });

      await loadTechnicians();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato: " + error.message,
        variant: "destructive",
      });
    }
  };

  const filteredTechnicians = technicians.filter(tech =>
    `${tech.first_name} ${tech.last_name} ${tech.employee_code} ${tech.position || ""}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const activeTechnicians = filteredTechnicians.filter(tech => tech.active);
  const avgHourlyRate = activeTechnicians.reduce((sum, tech) => sum + (tech.hourly_rate || 0), 0) / activeTechnicians.length || 0;

  const availableSpecializations = [
    "Installazione",
    "Manutenzione",
    "Riparazione",
    "Calibrazione",
    "Diagnostica",
    "Elettronica",
    "Meccanica",
    "Idraulica",
    "Pneumatica",
    "Software",
    "Sicurezza",
    "Certificazioni"
  ];

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <div className="text-lg">Caricamento tecnici...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gestione Tecnici</h1>
          <p className="text-muted-foreground">Gestisci il team tecnico e le loro competenze</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nuovo Tecnico
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Aggiungi Nuovo Tecnico</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* Dati Anagrafici */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Dati Anagrafici</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="employee_code">Codice Dipendente *</Label>
                    <Input
                      id="employee_code"
                      value={newTechnician.employee_code}
                      onChange={(e) => setNewTechnician({...newTechnician, employee_code: e.target.value})}
                      placeholder="T001"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="hire_date">Data Assunzione</Label>
                    <Input
                      id="hire_date"
                      type="date"
                      value={newTechnician.hire_date}
                      onChange={(e) => setNewTechnician({...newTechnician, hire_date: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="first_name">Nome *</Label>
                    <Input
                      id="first_name"
                      value={newTechnician.first_name}
                      onChange={(e) => setNewTechnician({...newTechnician, first_name: e.target.value})}
                      placeholder="Mario"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Cognome *</Label>
                    <Input
                      id="last_name"
                      value={newTechnician.last_name}
                      onChange={(e) => setNewTechnician({...newTechnician, last_name: e.target.value})}
                      placeholder="Rossi"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Contatti */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Contatti</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newTechnician.email}
                      onChange={(e) => setNewTechnician({...newTechnician, email: e.target.value})}
                      placeholder="mario.rossi@azienda.it"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telefono</Label>
                    <Input
                      id="phone"
                      value={newTechnician.phone}
                      onChange={(e) => setNewTechnician({...newTechnician, phone: e.target.value})}
                      placeholder="+39 123 456 7890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mobile">Cellulare</Label>
                    <Input
                      id="mobile"
                      value={newTechnician.mobile}
                      onChange={(e) => setNewTechnician({...newTechnician, mobile: e.target.value})}
                      placeholder="+39 123 456 7890"
                    />
                  </div>
                  <div>
                    <Label htmlFor="address">Indirizzo</Label>
                    <Input
                      id="address"
                      value={newTechnician.address}
                      onChange={(e) => setNewTechnician({...newTechnician, address: e.target.value})}
                      placeholder="Via Roma 123, Milano"
                    />
                  </div>
                </div>
              </div>

              {/* Competenze Tecniche */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Competenze Tecniche</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="position">Posizione</Label>
                    <Input
                      id="position"
                      value={newTechnician.position}
                      onChange={(e) => setNewTechnician({...newTechnician, position: e.target.value})}
                      placeholder="Tecnico Senior, Specialista..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="certification_level">Livello Certificazione</Label>
                    <Select value={newTechnician.certification_level} onValueChange={(value) => setNewTechnician({...newTechnician, certification_level: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona livello" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="junior">Junior</SelectItem>
                        <SelectItem value="senior">Senior</SelectItem>
                        <SelectItem value="expert">Expert</SelectItem>
                        <SelectItem value="specialist">Specialist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="hourly_rate">Tariffa Oraria (€)</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      step="0.01"
                      value={newTechnician.hourly_rate}
                      onChange={(e) => setNewTechnician({...newTechnician, hourly_rate: e.target.value})}
                      placeholder="25.00"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Specializzazioni</Label>
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {availableSpecializations.map(spec => (
                        <label key={spec} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={newTechnician.specializations.includes(spec)}
                            onChange={() => handleSpecializationChange(spec)}
                            className="rounded"
                          />
                          <span className="text-sm">{spec}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Contatto Emergenza */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Contatto di Emergenza</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="emergency_contact_name">Nome Contatto</Label>
                    <Input
                      id="emergency_contact_name"
                      value={newTechnician.emergency_contact_name}
                      onChange={(e) => setNewTechnician({...newTechnician, emergency_contact_name: e.target.value})}
                      placeholder="Nome e cognome"
                    />
                  </div>
                  <div>
                    <Label htmlFor="emergency_contact_phone">Telefono Emergenza</Label>
                    <Input
                      id="emergency_contact_phone"
                      value={newTechnician.emergency_contact_phone}
                      onChange={(e) => setNewTechnician({...newTechnician, emergency_contact_phone: e.target.value})}
                      placeholder="+39 123 456 7890"
                    />
                  </div>
                </div>
              </div>

              {/* Note */}
              <div>
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={newTechnician.notes}
                  onChange={(e) => setNewTechnician({...newTechnician, notes: e.target.value})}
                  placeholder="Note aggiuntive sul tecnico..."
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annulla
              </Button>
              <Button onClick={handleCreateTechnician} disabled={creating}>
                {creating ? "Creando..." : "Crea Tecnico"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tecnici Totali</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTechnicians.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tecnici Attivi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{activeTechnicians.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Tariffa Media/h</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{avgHourlyRate.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Lista Tecnici ({filteredTechnicians.length})</CardTitle>
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Cerca tecnici..."
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
                <TableHead>Tecnico</TableHead>
                <TableHead>Contatto</TableHead>
                <TableHead>Posizione</TableHead>
                <TableHead>Specializzazioni</TableHead>
                <TableHead>Livello</TableHead>
                <TableHead>Tariffa/h</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTechnicians.map((technician) => (
                <TableRow key={technician.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
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
                    <Badge variant={technician.active ? "default" : "secondary"}>
                      {technician.active ? (
                        <CheckCircle className="w-3 h-3 mr-1" />
                      ) : (
                        <XCircle className="w-3 h-3 mr-1" />
                      )}
                      {technician.active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTechnicianStatus(technician.id, technician.active)}
                    >
                      {technician.active ? "Disattiva" : "Attiva"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredTechnicians.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center space-y-2">
                      <Clock className="w-8 h-8 text-muted-foreground" />
                      <span className="text-muted-foreground">Nessun tecnico trovato</span>
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