import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AddTrainingDialog } from "@/components/hr/AddTrainingDialog";
import { AddDocumentDialog } from "@/components/hr/AddDocumentDialog";
import { AddAppointmentDialog } from "@/components/hr/AddAppointmentDialog";
import { AddMedicalCheckupDialog } from "@/components/hr/AddMedicalCheckupDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarIcon, FileText, Shield, AlertTriangle, UserCheck, Upload, Plus, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SafetyPage = () => {
  const [selectedTab, setSelectedTab] = useState("training");
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [medicalDialogOpen, setMedicalDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all data
  const { data: trainingRecords = [] } = useQuery({
    queryKey: ["safety-training"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_training_records")
        .select(`
          *,
          profiles:employee_id (
            full_name,
            email
          )
        `)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["safety-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_documents")
        .select("*")
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["safety-appointments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_appointments")
        .select(`
          *,
          profiles:employee_id (
            full_name,
            email
          )
        `)
        .order("appointment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: medicalCheckups = [] } = useQuery({
    queryKey: ["medical-checkups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("medical_checkups")
        .select(`
          *,
          profiles:employee_id (
            full_name,
            email
          )
        `)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("email");
      if (error) throw error;
      return data.map(profile => ({
        id: profile.id,
        full_name: profile.email || profile.id
      }));
    },
  });

  // Helper function to check if a date is expiring soon (within 30 days)
  const isExpiringSoon = (date: string) => {
    const today = new Date();
    const expiryDate = new Date(date);
    const daysUntilExpiry = differenceInDays(expiryDate, today);
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (date: string) => {
    return new Date(date) < new Date();
  };

  const getExpiryBadge = (date: string) => {
    if (isExpired(date)) {
      return <Badge variant="destructive">Scaduto</Badge>;
    } else if (isExpiringSoon(date)) {
      return <Badge variant="outline" className="border-orange-500 text-orange-600">In scadenza</Badge>;
    } else {
      return <Badge variant="outline" className="border-green-500 text-green-600">Valido</Badge>;
    }
  };

  const getTrainingLabel = (type: string) => {
    const labels: Record<string, string> = {
      generale: "Formazione Generale",
      alto_rischio: "Formazione Alto Rischio",
      pav_base: "Formazione PAV (Base)",
      pes_esperto: "Formazione PES (Esperto)",
      rspp: "Formazione RSPP",
      antincendio: "Antincendio",
      primo_soccorso: "Primo Soccorso",
      preposto: "Preposto",
    };
    return labels[type] || type;
  };

  const getAppointmentLabel = (type: string) => {
    const labels: Record<string, string> = {
      rspp: "RSPP",
      antincendio: "Addetto Antincendio",
      primo_soccorso: "Addetto Primo Soccorso",
    };
    return labels[type] || type;
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["safety-training"] });
    queryClient.invalidateQueries({ queryKey: ["safety-documents"] });
    queryClient.invalidateQueries({ queryKey: ["safety-appointments"] });
    queryClient.invalidateQueries({ queryKey: ["medical-checkups"] });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sicurezza sul Lavoro</h1>
          <p className="text-muted-foreground mt-2">
            Gestione formazione, documenti e certificazioni per la sicurezza aziendale
          </p>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="training">
            <Shield className="w-4 h-4 mr-2" />
            Formazione
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Documenti
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <UserCheck className="w-4 h-4 mr-2" />
            Nomine
          </TabsTrigger>
          <TabsTrigger value="medical">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Visite Mediche
          </TabsTrigger>
        </TabsList>

        {/* Training Tab */}
        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attestati di Formazione</CardTitle>
                <CardDescription>
                  Tracciamento delle formazioni e relative scadenze
                </CardDescription>
              </div>
              <Button onClick={() => setTrainingDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Formazione
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Tipo Formazione</TableHead>
                    <TableHead>Data Formazione</TableHead>
                    <TableHead>Data Scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trainingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessun record di formazione presente
                      </TableCell>
                    </TableRow>
                  ) : (
                    trainingRecords.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {record.profiles?.full_name || "N/A"}
                        </TableCell>
                        <TableCell>{getTrainingLabel(record.training_type)}</TableCell>
                        <TableCell>
                          {format(new Date(record.training_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(record.expiry_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>{getExpiryBadge(record.expiry_date)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documenti di Sicurezza</CardTitle>
                <CardDescription>
                  DUVRI, procedure e altra documentazione
                </CardDescription>
              </div>
              <Button onClick={() => setDocumentDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Carica Documento
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo Documento</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data Caricamento</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessun documento presente
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc: any) => (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium">{doc.document_type}</TableCell>
                        <TableCell>{doc.document_name}</TableCell>
                        <TableCell>
                          {format(new Date(doc.upload_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {doc.expiry_date ? format(new Date(doc.expiry_date), "dd MMM yyyy", { locale: it }) : "N/A"}
                        </TableCell>
                        <TableCell>
                          {doc.expiry_date ? getExpiryBadge(doc.expiry_date) : <Badge variant="outline">N/A</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appointments Tab */}
        <TabsContent value="appointments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nomine Sicurezza</CardTitle>
                <CardDescription>
                  RSPP, Addetti Antincendio e Primo Soccorso
                </CardDescription>
              </div>
              <Button onClick={() => setAppointmentDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Aggiungi Nomina
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo Nomina</TableHead>
                    <TableHead>Nominato</TableHead>
                    <TableHead>Data Nomina</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nessuna nomina presente
                      </TableCell>
                    </TableRow>
                  ) : (
                    appointments.map((appointment: any) => (
                      <TableRow key={appointment.id}>
                        <TableCell className="font-medium">
                          {getAppointmentLabel(appointment.appointment_type)}
                        </TableCell>
                        <TableCell>{appointment.employee_name}</TableCell>
                        <TableCell>
                          {format(new Date(appointment.appointment_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {appointment.expiry_date
                            ? format(new Date(appointment.expiry_date), "dd MMM yyyy", { locale: it })
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          {appointment.is_active ? (
                            appointment.expiry_date ? (
                              getExpiryBadge(appointment.expiry_date)
                            ) : (
                              <Badge variant="outline" className="border-green-500 text-green-600">Attivo</Badge>
                            )
                          ) : (
                            <Badge variant="outline">Inattivo</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Tab */}
        <TabsContent value="medical" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Visite Mediche</CardTitle>
                <CardDescription>
                  Tracciamento visite mediche dal medico competente
                </CardDescription>
              </div>
              <Button onClick={() => setMedicalDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Registra Visita
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dipendente</TableHead>
                    <TableHead>Data Visita</TableHead>
                    <TableHead>Scadenza</TableHead>
                    <TableHead>Medico</TableHead>
                    <TableHead>Esito</TableHead>
                    <TableHead>Stato</TableHead>
                    <TableHead>Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {medicalCheckups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        Nessuna visita medica registrata
                      </TableCell>
                    </TableRow>
                  ) : (
                    medicalCheckups.map((checkup: any) => (
                      <TableRow key={checkup.id}>
                        <TableCell className="font-medium">
                          {checkup.profiles?.full_name || "N/A"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(checkup.checkup_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(checkup.expiry_date), "dd MMM yyyy", { locale: it })}
                        </TableCell>
                        <TableCell>{checkup.doctor_name || "N/A"}</TableCell>
                        <TableCell>{checkup.result || "N/A"}</TableCell>
                        <TableCell>{getExpiryBadge(checkup.expiry_date)}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AddTrainingDialog
        open={trainingDialogOpen}
        onOpenChange={setTrainingDialogOpen}
        employees={employees}
        onSuccess={handleRefresh}
      />

      <AddDocumentDialog
        open={documentDialogOpen}
        onOpenChange={setDocumentDialogOpen}
        onSuccess={handleRefresh}
      />

      <AddAppointmentDialog
        open={appointmentDialogOpen}
        onOpenChange={setAppointmentDialogOpen}
        employees={employees}
        onSuccess={handleRefresh}
      />

      <AddMedicalCheckupDialog
        open={medicalDialogOpen}
        onOpenChange={setMedicalDialogOpen}
        employees={employees}
        onSuccess={handleRefresh}
      />
    </div>
  );
};

export default SafetyPage;