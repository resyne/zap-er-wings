import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, User, Wrench, ClipboardList, Download, Mail } from "lucide-react";
import { CreateContactDialog } from "@/components/support/CreateContactDialog";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";
import { ReportDetailsDialog } from "@/components/support/ReportDetailsDialog";
import jsPDF from "jspdf";

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
}

interface Technician {
  id: string;
  first_name: string;
  last_name: string;
  employee_code: string;
}

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  customer_id?: string;
  contact_id?: string;
  location?: string;
  type: 'service' | 'production';
}

interface ServiceReport {
  id: string;
  intervention_date: string;
  intervention_type: string;
  work_performed: string;
  status: string;
  contact_id: string;
  technician_id: string;
  created_at: string;
  amount?: number;
  vat_rate?: number;
  total_amount?: number;
  customer_signature?: string;
  technician_signature?: string;
  description?: string;
  materials_used?: string;
  notes?: string;
  start_time?: string;
  end_time?: string;
  crm_contacts?: Contact;
  technicians?: Technician;
  work_orders?: WorkOrder;
  service_work_orders?: WorkOrder;
}

export default function ServiceReportsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ServiceReport | null>(null);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [formData, setFormData] = useState({
    intervention_type: '',
    description: '',
    work_performed: '',
    materials_used: '',
    notes: '',
    intervention_date: new Date().toISOString().split('T')[0],
    start_time: '',
    end_time: '',
    amount: '',
    vat_rate: '22',
    total_amount: ''
  });
  const [customerSignature, setCustomerSignature] = useState<string>('');
  const [technicianSignature, setTechnicianSignature] = useState<string>('');
  const { toast } = useToast();

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load contacts
      const { data: contactsData, error: contactsError } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, email, phone, company_name, address')
        .order('first_name');

      if (contactsError) throw contactsError;
      setContacts(contactsData || []);

      // Load technicians
      const { data: techniciansData, error: techniciansError } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      if (techniciansError) throw techniciansError;
      setTechnicians(techniciansData || []);

      // Load work orders (both service and production)
      const [serviceOrdersRes, productionOrdersRes] = await Promise.all([
        supabase
          .from('service_work_orders')
          .select('id, number, title, description, customer_id, contact_id, location')
          .in('status', ['planned', 'in_progress']),
        supabase
          .from('work_orders')
          .select('id, number, title, description, customer_id, location')
          .in('status', ['planned', 'in_progress'])
      ]);

      if (serviceOrdersRes.error) throw serviceOrdersRes.error;
      if (productionOrdersRes.error) throw productionOrdersRes.error;

      const serviceOrders: WorkOrder[] = (serviceOrdersRes.data || []).map(wo => ({ ...wo, type: 'service' as const }));
      const productionOrders: WorkOrder[] = (productionOrdersRes.data || []).map(wo => ({ ...wo, type: 'production' as const }));
      
      setWorkOrders([...serviceOrders, ...productionOrders]);

      // Load existing reports
      const { data: reportsData, error: reportsError } = await supabase
        .from('service_reports')
        .select(`
          id,
          intervention_date,
          intervention_type,
          work_performed,
          status,
          contact_id,
          technician_id,
          created_at,
          description,
          materials_used,
          notes,
          start_time,
          end_time,
          amount,
          vat_rate,
          total_amount,
          customer_signature,
          technician_signature,
          crm_contacts (
            id,
            first_name,
            last_name,
            company_name,
            email,
            phone,
            address
          ),
          technicians (
            id,
            first_name,
            last_name,
            employee_code
          )
        `)
        .order('created_at', { ascending: false });

      if (reportsError) throw reportsError;
      setReports(reportsData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-calculate total when amount or vat changes
      if (field === 'amount' || field === 'vat_rate') {
        const amount = parseFloat(field === 'amount' ? value : newData.amount) || 0;
        const vatRate = parseFloat(field === 'vat_rate' ? value : newData.vat_rate) || 0;
        const total = amount + (amount * vatRate / 100);
        newData.total_amount = total.toFixed(2);
      }
      
      return newData;
    });
  };

  const handleContactSelect = (contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    setSelectedContact(contact || null);
  };

  const handleTechnicianSelect = (technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId);
    setSelectedTechnician(technician || null);
  };

  const handleWorkOrderSelect = (workOrderId: string) => {
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    setSelectedWorkOrder(workOrder || null);
    
    // Auto-fill fields with work order data
    if (workOrder) {
      setFormData(prev => ({
        ...prev,
        work_performed: workOrder.description || prev.work_performed,
        notes: workOrder.title || prev.notes
      }));

      // Auto-select contact if available
      if (workOrder.contact_id) {
        const contact = contacts.find(c => c.id === workOrder.contact_id);
        if (contact) {
          setSelectedContact(contact);
        }
      }
    }
  };

  const handleContactCreated = (newContact: Contact) => {
    setContacts(prev => [...prev, newContact]);
    setSelectedContact(newContact);
    setShowCreateContact(false);
  };

  const generateReport = () => {
    if (!selectedContact || !formData.intervention_type || !selectedTechnician) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Seleziona almeno cliente, tipo intervento e tecnico",
        variant: "destructive",
      });
      return;
    }
    setShowSignatures(true);
  };

  const saveReport = async () => {
    if (!customerSignature || !technicianSignature) {
      toast({
        title: "Firme mancanti",
        description: "Entrambe le firme sono obbligatorie",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_reports')
        .insert({
          contact_id: selectedContact?.id,
          technician_id: selectedTechnician?.id,
          work_order_id: selectedWorkOrder?.type === 'service' ? selectedWorkOrder.id : null,
          production_work_order_id: selectedWorkOrder?.type === 'production' ? selectedWorkOrder.id : null,
          intervention_type: formData.intervention_type,
          description: formData.description || null,
          work_performed: formData.work_performed,
          materials_used: formData.materials_used,
          notes: formData.notes,
          technician_name: selectedTechnician ? `${selectedTechnician.first_name} ${selectedTechnician.last_name}` : '',
          intervention_date: formData.intervention_date,
          start_time: formData.start_time,
          end_time: formData.end_time,
          amount: formData.amount ? parseFloat(formData.amount) : null,
          vat_rate: formData.vat_rate ? parseFloat(formData.vat_rate) : null,
          total_amount: formData.total_amount ? parseFloat(formData.total_amount) : null,
          customer_signature: customerSignature,
          technician_signature: technicianSignature,
          status: 'completed'
        })
        .select()
        .single();

      if (error) throw error;

      setSavedReportId(data.id);
      setShowSignatures(false);
      setShowActions(true);

      toast({
        title: "Rapporto salvato",
        description: "Il rapporto di intervento è stato salvato con successo",
      });
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvare il rapporto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!selectedContact || !selectedTechnician) return;

    const doc = new jsPDF();
    let y = 20;

    // Logo aziendale
    const logoImg = new Image();
    logoImg.src = '/images/logo-zapper.png';
    logoImg.onload = () => {
      doc.addImage(logoImg, 'PNG', 15, 10, 40, 15);
      
      // Intestazione
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("Rapporto di Intervento", 105, 20, { align: "center" });
      y = 35;

      // Informazioni cliente
      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Cliente:", 20, y);
      doc.setFont(undefined, "normal");
      y += 7;
      doc.text(`${selectedContact.first_name} ${selectedContact.last_name}`, 20, y);
      if (selectedContact.company_name) {
        y += 7;
        doc.text(selectedContact.company_name, 20, y);
      }
      if (selectedContact.email) {
        y += 7;
        doc.text(`Email: ${selectedContact.email}`, 20, y);
      }
      if (selectedContact.phone) {
        y += 7;
        doc.text(`Tel: ${selectedContact.phone}`, 20, y);
      }
      if (selectedContact.address) {
        y += 7;
        doc.text(`Indirizzo: ${selectedContact.address}`, 20, y);
      }
      y += 10;

      // Commessa di lavoro
      if (selectedWorkOrder) {
        doc.setFont(undefined, "bold");
        doc.text("Commessa di Lavoro:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        doc.text(`${selectedWorkOrder.number} - ${selectedWorkOrder.title}`, 20, y);
        y += 10;
      }

      // Dettagli intervento
      doc.setFont(undefined, "bold");
      doc.text("Dettagli Intervento:", 20, y);
      doc.setFont(undefined, "normal");
      y += 7;
      doc.text(`Data: ${formData.intervention_date}`, 20, y);
      y += 7;
      if (formData.start_time && formData.end_time) {
        doc.text(`Orario: ${formData.start_time} - ${formData.end_time}`, 20, y);
        y += 7;
      }
      doc.text(`Tipo: ${formData.intervention_type}`, 20, y);
      y += 7;
      doc.text(`Tecnico: ${selectedTechnician.first_name} ${selectedTechnician.last_name}`, 20, y);
      y += 10;

      if (formData.description) {
        doc.setFont(undefined, "bold");
        doc.text("Descrizione Problema:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        const descLines = doc.splitTextToSize(formData.description, 170);
        doc.text(descLines, 20, y);
        y += descLines.length * 7 + 3;
      }

      if (formData.work_performed) {
        doc.setFont(undefined, "bold");
        doc.text("Lavori Eseguiti:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        const workLines = doc.splitTextToSize(formData.work_performed, 170);
        doc.text(workLines, 20, y);
        y += workLines.length * 7 + 3;
      }

      if (formData.materials_used) {
        doc.setFont(undefined, "bold");
        doc.text("Materiali Utilizzati:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        const matLines = doc.splitTextToSize(formData.materials_used, 170);
        doc.text(matLines, 20, y);
        y += matLines.length * 7 + 3;
      }

      if (formData.notes) {
        doc.setFont(undefined, "bold");
        doc.text("Note:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        const noteLines = doc.splitTextToSize(formData.notes, 170);
        doc.text(noteLines, 20, y);
        y += noteLines.length * 7 + 3;
      }

      // Dettagli economici
      if (formData.amount) {
        if (y > 220) {
          doc.addPage();
          y = 20;
        }
        y += 10;
        doc.setFont(undefined, "bold");
        doc.text("Dettagli Economici:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        doc.text(`Importo: €${parseFloat(formData.amount).toFixed(2)}`, 20, y);
        y += 7;
        doc.text(`IVA: ${parseFloat(formData.vat_rate).toFixed(2)}%`, 20, y);
        y += 7;
        doc.setFont(undefined, "bold");
        doc.text(`Totale: €${parseFloat(formData.total_amount).toFixed(2)}`, 20, y);
        doc.setFont(undefined, "normal");
        y += 10;
      }

      // Firme
      if (y > 220) {
        doc.addPage();
        y = 20;
      }
      y += 10;

      doc.setFont(undefined, "bold");
      doc.text("Firma Cliente:", 20, y);
      if (customerSignature) {
        doc.addImage(customerSignature, "PNG", 20, y + 5, 70, 30);
      }

      doc.text("Firma Tecnico:", 110, y);
      if (technicianSignature) {
        doc.addImage(technicianSignature, "PNG", 110, y + 5, 70, 30);
      }

      // Footer con contatti aziendali
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
      doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
      doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });
      doc.text("www.abbattitorizapper.it  08119968436", 105, pageHeight - 8, { align: "center" });

      const fileName = `rapporto_intervento_${formData.intervention_date}_${selectedContact.last_name}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Scaricato",
        description: "Il rapporto è stato scaricato in formato PDF",
      });
    };
  };

  const sendEmail = async () => {
    if (!selectedContact?.email) {
      toast({
        title: "Email mancante",
        description: "Il cliente non ha un indirizzo email registrato",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-customer-emails', {
        body: {
          to: selectedContact.email,
          subject: `Rapporto di Intervento - ${formData.intervention_date}`,
          recipientName: `${selectedContact.first_name} ${selectedContact.last_name}`,
          message: `Gentile ${selectedContact.first_name} ${selectedContact.last_name},\n\nin allegato trovi il rapporto di intervento del ${formData.intervention_date}.\n\nTipo intervento: ${formData.intervention_type}\nTecnico: ${selectedTechnician?.first_name} ${selectedTechnician?.last_name}\n\n${formData.work_performed ? `Lavori eseguiti:\n${formData.work_performed}\n\n` : ''}Grazie per averci scelto.\n\nCordiali saluti`,
          reportData: {
            customer: selectedContact,
            technician: selectedTechnician,
            formData: formData,
            customerSignature: customerSignature,
            technicianSignature: technicianSignature,
            workOrder: selectedWorkOrder
          }
        }
      });

      if (error) throw error;

      toast({
        title: "Email Inviata",
        description: `Il rapporto è stato inviato a ${selectedContact.email}`,
      });
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: "Errore",
        description: "Errore nell'invio dell'email",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      intervention_type: '',
      description: '',
      work_performed: '',
      materials_used: '',
      notes: '',
      intervention_date: new Date().toISOString().split('T')[0],
      start_time: '',
      end_time: '',
      amount: '',
      vat_rate: '22',
      total_amount: ''
    });
    setSelectedContact(null);
    setSelectedTechnician(null);
    setSelectedWorkOrder(null);
    setCustomerSignature('');
    setTechnicianSignature('');
    setShowSignatures(false);
    setShowActions(false);
    setSavedReportId(null);
    setShowCreateForm(false);
    loadInitialData();
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Rapporti di Intervento</h1>
          <p className="text-muted-foreground">
            Crea e gestisci rapporti di intervento tecnico con firma digitale
          </p>
        </div>
        {!showCreateForm && !showActions && (
          <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nuovo Rapporto di Intervento
          </Button>
        )}
      </div>

      {!showCreateForm && !showActions ? (
        <Card>
          <CardHeader>
            <CardTitle>Rapporti Esistenti</CardTitle>
            <CardDescription>
              Elenco di tutti i rapporti di intervento generati
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reports.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4">Nessun rapporto di intervento trovato</p>
                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 mx-auto">
                  <Plus className="w-4 h-4" />
                  Crea il Primo Rapporto
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {reports.map((report) => (
                  <div 
                    key={report.id} 
                    className="p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedReport(report);
                      setShowReportDetails(true);
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg">
                            {report.crm_contacts?.first_name} {report.crm_contacts?.last_name}
                          </h3>
                          {report.crm_contacts?.company_name && (
                            <span className="text-sm text-muted-foreground">
                              ({report.crm_contacts.company_name})
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Data:</span>
                            <p className="font-medium">
                              {new Date(report.intervention_date).toLocaleDateString('it-IT')}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tipo:</span>
                            <p className="font-medium capitalize">{report.intervention_type}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tecnico:</span>
                            <p className="font-medium">
                              {report.technicians?.first_name} {report.technicians?.last_name}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Stato:</span>
                            <p className="font-medium capitalize">{report.status}</p>
                          </div>
                        </div>
                        {report.work_performed && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {report.work_performed}
                          </p>
                        )}
                        {report.total_amount && (
                          <p className="text-sm font-semibold text-primary mt-2">
                            Totale: €{report.total_amount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : showActions ? (
        <Card>
          <CardHeader>
            <CardTitle>Rapporto Completato</CardTitle>
            <CardDescription>
              Il rapporto è stato salvato con successo. Scegli cosa fare ora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3">
              <Button onClick={generatePDF} className="w-full flex items-center justify-center gap-2">
                <Download className="w-4 h-4" />
                Scarica PDF
              </Button>
              <Button 
                onClick={sendEmail} 
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                disabled={loading || !selectedContact?.email}
              >
                <Mail className="w-4 h-4" />
                {loading ? "Invio in corso..." : "Invia Email al Cliente"}
              </Button>
            </div>

            <Separator />

            <Button 
              onClick={resetForm}
              variant="secondary"
              className="w-full"
            >
              Crea Nuovo Rapporto
            </Button>
            
            <Button 
              onClick={() => {
                setShowActions(false);
                setShowCreateForm(false);
                setSavedReportId(null);
              }}
              variant="outline"
              className="w-full"
            >
              Torna all'Elenco
            </Button>
          </CardContent>
        </Card>
      ) : !showSignatures ? (
        <div>
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={() => setShowCreateForm(false)}
              className="flex items-center gap-2"
            >
              ← Torna all'Elenco
            </Button>
          </div>
        <div className="space-y-6">
          {/* Ordine di Lavoro (Optional) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Commessa di Lavoro (Opzionale)
              </CardTitle>
              <CardDescription>
                Collega il rapporto a una commessa di lavoro esistente per automaticamente inserire i dati
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select onValueChange={handleWorkOrderSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona una commessa di lavoro..." />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((workOrder) => (
                    <SelectItem key={workOrder.id} value={workOrder.id}>
                      {workOrder.number} - {workOrder.title} ({workOrder.type === 'service' ? 'OdL' : 'OdP'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedWorkOrder && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Ordine selezionato:</h4>
                  <p><strong>{selectedWorkOrder.number}</strong> - {selectedWorkOrder.title}</p>
                  <p>Tipo: {selectedWorkOrder.type === 'service' ? 'Commessa di Lavoro (OdL)' : 'Commessa di Produzione (OdP)'}</p>
                  {selectedWorkOrder.description && <p>Descrizione: {selectedWorkOrder.description}</p>}
                  {selectedWorkOrder.location && <p>Località: {selectedWorkOrder.location}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selezione Cliente */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Cliente *
              </CardTitle>
              <CardDescription>
                Seleziona un cliente esistente o creane uno nuovo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Select onValueChange={handleContactSelect} value={selectedContact?.id || ""}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Seleziona un cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.first_name} {contact.last_name} 
                        {contact.company_name && ` - ${contact.company_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateContact(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo Cliente
                </Button>
              </div>

              {selectedContact && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Cliente selezionato:</h4>
                  <p>{selectedContact.first_name} {selectedContact.last_name}</p>
                  {selectedContact.company_name && <p>{selectedContact.company_name}</p>}
                  {selectedContact.email && <p>Email: {selectedContact.email}</p>}
                  {selectedContact.phone && <p>Tel: {selectedContact.phone}</p>}
                  {selectedContact.address && <p>Indirizzo: {selectedContact.address}</p>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dettagli Intervento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Dettagli Intervento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervention_date">Data Intervento *</Label>
                  <Input
                    id="intervention_date"
                    type="date"
                    value={formData.intervention_date}
                    onChange={(e) => handleInputChange('intervention_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technician">Tecnico Operatore *</Label>
                  <Select onValueChange={handleTechnicianSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona un tecnico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((technician) => (
                        <SelectItem key={technician.id} value={technician.id}>
                          {technician.first_name} {technician.last_name} ({technician.employee_code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time">Ora Inizio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time">Ora Fine</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervention_type">Tipo Intervento *</Label>
                <Select onValueChange={(value) => handleInputChange('intervention_type', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo di intervento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutenzione">Manutenzione</SelectItem>
                    <SelectItem value="riparazione">Riparazione</SelectItem>
                    <SelectItem value="installazione">Installazione</SelectItem>
                    <SelectItem value="collaudo">Collaudo</SelectItem>
                    <SelectItem value="consulenza">Consulenza</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrizione Problema</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrivi il problema riscontrato (opzionale)..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_performed">Lavori Eseguiti</Label>
                <Textarea
                  id="work_performed"
                  value={formData.work_performed}
                  onChange={(e) => handleInputChange('work_performed', e.target.value)}
                  placeholder="Descrivi i lavori eseguiti..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materials_used">Materiali Utilizzati</Label>
                <Textarea
                  id="materials_used"
                  value={formData.materials_used}
                  onChange={(e) => handleInputChange('materials_used', e.target.value)}
                  placeholder="Elenca i materiali utilizzati..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Note Aggiuntive</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Dettagli Economici */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Dettagli Economici
              </CardTitle>
              <CardDescription>
                Inserisci l'importo dell'intervento e l'IVA applicata
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Importo (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_rate">IVA (%)</Label>
                  <Select value={formData.vat_rate} onValueChange={(value) => handleInputChange('vat_rate', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona IVA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0%</SelectItem>
                      <SelectItem value="4">4%</SelectItem>
                      <SelectItem value="10">10%</SelectItem>
                      <SelectItem value="22">22%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_amount">Totale (€)</Label>
                  <Input
                    id="total_amount"
                    type="text"
                    value={formData.total_amount}
                    readOnly
                    className="bg-muted font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={generateReport} className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Genera Rapporto
            </Button>
          </div>
        </div>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Firme Digitali</CardTitle>
            <CardDescription>
              Richiedi la firma del cliente e inserisci la tua firma per completare il rapporto
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Firma Cliente</h3>
              <SignatureCanvas
                onSignatureChange={setCustomerSignature}
                placeholder="Il cliente deve firmare qui"
              />
            </div>

            <Separator />

            <div>
              <h3 className="text-lg font-medium mb-4">Firma Tecnico</h3>
              <SignatureCanvas
                onSignatureChange={setTechnicianSignature}
                placeholder="Il tecnico deve firmare qui"
              />
            </div>

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setShowSignatures(false)}
              >
                Indietro
              </Button>
              <Button
                onClick={saveReport}
                disabled={loading || !customerSignature || !technicianSignature}
              >
                {loading ? "Salvando..." : "Salva Rapporto"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateContactDialog
        open={showCreateContact}
        onOpenChange={setShowCreateContact}
        onContactCreated={handleContactCreated}
      />

      <ReportDetailsDialog
        open={showReportDetails}
        onOpenChange={setShowReportDetails}
        report={selectedReport}
        onDownloadPDF={() => {
          if (selectedReport) {
            const doc = new jsPDF();
            let y = 20;
            const contact = selectedReport.crm_contacts;
            const technician = selectedReport.technicians;

            // Logo aziendale
            const logoImg = new Image();
            logoImg.src = '/images/logo-zapper.png';
            logoImg.onload = () => {
              doc.addImage(logoImg, 'PNG', 15, 10, 40, 15);
              
              // Intestazione
              doc.setFontSize(18);
              doc.setFont(undefined, "bold");
              doc.text("Rapporto di Intervento", 105, 20, { align: "center" });
              y = 35;

              // Informazioni cliente
              doc.setFontSize(12);
              doc.setFont(undefined, "bold");
              doc.text("Cliente:", 20, y);
              doc.setFont(undefined, "normal");
              y += 7;
              doc.text(`${contact?.first_name} ${contact?.last_name}`, 20, y);
              if (contact?.company_name) {
                y += 7;
                doc.text(contact.company_name, 20, y);
              }
              if (contact?.email) {
                y += 7;
                doc.text(`Email: ${contact.email}`, 20, y);
              }
              if (contact?.phone) {
                y += 7;
                doc.text(`Tel: ${contact.phone}`, 20, y);
              }
              if (contact?.address) {
                y += 7;
                doc.text(`Indirizzo: ${contact.address}`, 20, y);
              }
              y += 10;

              // Dettagli intervento
              doc.setFont(undefined, "bold");
              doc.text("Dettagli Intervento:", 20, y);
              doc.setFont(undefined, "normal");
              y += 7;
              doc.text(`Data: ${new Date(selectedReport.intervention_date).toLocaleDateString('it-IT')}`, 20, y);
              y += 7;
              if (selectedReport.start_time && selectedReport.end_time) {
                doc.text(`Orario: ${selectedReport.start_time} - ${selectedReport.end_time}`, 20, y);
                y += 7;
              }
              doc.text(`Tipo: ${selectedReport.intervention_type}`, 20, y);
              y += 7;
              doc.text(`Tecnico: ${technician?.first_name} ${technician?.last_name}`, 20, y);
              y += 10;

              if (selectedReport.description) {
                doc.setFont(undefined, "bold");
                doc.text("Descrizione Problema:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;
                const descLines = doc.splitTextToSize(selectedReport.description, 170);
                doc.text(descLines, 20, y);
                y += descLines.length * 7 + 3;
              }

              if (selectedReport.work_performed) {
                doc.setFont(undefined, "bold");
                doc.text("Lavori Eseguiti:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;
                const workLines = doc.splitTextToSize(selectedReport.work_performed, 170);
                doc.text(workLines, 20, y);
                y += workLines.length * 7 + 3;
              }

              if (selectedReport.materials_used) {
                doc.setFont(undefined, "bold");
                doc.text("Materiali Utilizzati:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;
                const matLines = doc.splitTextToSize(selectedReport.materials_used, 170);
                doc.text(matLines, 20, y);
                y += matLines.length * 7 + 3;
              }

              if (selectedReport.notes) {
                doc.setFont(undefined, "bold");
                doc.text("Note:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;
                const noteLines = doc.splitTextToSize(selectedReport.notes, 170);
                doc.text(noteLines, 20, y);
                y += noteLines.length * 7 + 3;
              }

              // Dettagli economici
              if (selectedReport.amount) {
                if (y > 220) {
                  doc.addPage();
                  y = 20;
                }
                y += 10;
                doc.setFont(undefined, "bold");
                doc.text("Dettagli Economici:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;
                doc.text(`Importo: €${selectedReport.amount.toFixed(2)}`, 20, y);
                y += 7;
                if (selectedReport.vat_rate) {
                  doc.text(`IVA: ${selectedReport.vat_rate.toFixed(2)}%`, 20, y);
                  y += 7;
                }
                if (selectedReport.total_amount) {
                  doc.setFont(undefined, "bold");
                  doc.text(`Totale: €${selectedReport.total_amount.toFixed(2)}`, 20, y);
                  doc.setFont(undefined, "normal");
                  y += 10;
                }
              }

              // Firme
              if (y > 220) {
                doc.addPage();
                y = 20;
              }
              y += 10;

              doc.setFont(undefined, "bold");
              doc.text("Firma Cliente:", 20, y);
              if (selectedReport.customer_signature) {
                doc.addImage(selectedReport.customer_signature, "PNG", 20, y + 5, 70, 30);
              }

              doc.text("Firma Tecnico:", 110, y);
              if (selectedReport.technician_signature) {
                doc.addImage(selectedReport.technician_signature, "PNG", 110, y + 5, 70, 30);
              }

              // Footer con contatti aziendali
              const pageHeight = doc.internal.pageSize.height;
              doc.setFontSize(8);
              doc.setFont(undefined, "normal");
              doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
              doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
              doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });
              doc.text("www.abbattitorizapper.it  08119968436", 105, pageHeight - 8, { align: "center" });

              const fileName = `rapporto_intervento_${selectedReport.intervention_date}_${contact?.last_name || 'report'}.pdf`;
              doc.save(fileName);

              toast({
                title: "PDF Scaricato",
                description: "Il rapporto è stato scaricato in formato PDF",
              });
            };
          }
        }}
        onSendEmail={async () => {
          if (!selectedReport) return;
          
          const contact = selectedReport.crm_contacts;
          const technician = selectedReport.technicians;

          if (!contact?.email) {
            toast({
              title: "Email mancante",
              description: "Il cliente non ha un indirizzo email registrato",
              variant: "destructive",
            });
            return;
          }

          setLoading(true);
          try {
            const { error } = await supabase.functions.invoke('send-customer-emails', {
              body: {
                to: contact.email,
                subject: `Rapporto di Intervento - ${new Date(selectedReport.intervention_date).toLocaleDateString('it-IT')}`,
                recipientName: `${contact.first_name} ${contact.last_name}`,
                message: `Gentile ${contact.first_name} ${contact.last_name},\n\nin allegato trovi il rapporto di intervento del ${new Date(selectedReport.intervention_date).toLocaleDateString('it-IT')}.\n\nTipo intervento: ${selectedReport.intervention_type}\nTecnico: ${technician?.first_name} ${technician?.last_name}\n\n${selectedReport.work_performed ? `Lavori eseguiti:\n${selectedReport.work_performed}\n\n` : ''}Grazie per averci scelto.\n\nCordiali saluti`,
                reportData: selectedReport
              }
            });

            if (error) throw error;

            toast({
              title: "Email Inviata",
              description: `Il rapporto è stato inviato a ${contact.email}`,
            });
          } catch (error) {
            console.error('Error sending email:', error);
            toast({
              title: "Errore",
              description: "Errore nell'invio dell'email",
              variant: "destructive",
            });
          } finally {
            setLoading(false);
          }
        }}
      />
    </div>
  );
}
