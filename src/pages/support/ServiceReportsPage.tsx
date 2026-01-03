import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, User, Wrench, ClipboardList, Download, Mail, Check, ChevronsUpDown, Search } from "lucide-react";
import { CreateContactDialog } from "@/components/support/CreateContactDialog";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";
import { ReportDetailsDialog } from "@/components/support/ReportDetailsDialog";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";

interface Customer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company_name?: string;
  address?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  pec?: string;
  sdi_code?: string;
  shipping_address?: string;
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
  customers?: Customer;
  technicians?: Technician;
  work_orders?: WorkOrder;
  service_work_orders?: WorkOrder;
}

export default function ServiceReportsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contactSearchOpen, setContactSearchOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
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

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!contactSearch.trim()) return customers;
    const searchLower = contactSearch.toLowerCase();
    return customers.filter(customer => {
      const name = (customer.name || '').toLowerCase();
      const companyName = (customer.company_name || '').toLowerCase();
      const email = (customer.email || '').toLowerCase();
      const phone = (customer.phone || '').toLowerCase();
      return name.includes(searchLower) || 
             companyName.includes(searchLower) ||
             email.includes(searchLower) ||
             phone.includes(searchLower);
    });
  }, [customers, contactSearch]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Load customers from customers table (CRM customers)
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('id, name, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address')
        .order('company_name', { ascending: true, nullsFirst: false })
        .order('name');

      if (customersError) throw customersError;
      setCustomers(customersData || []);

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
          customers (
            id,
            name,
            company_name,
            email,
            phone,
            address,
            city
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

  const handleCustomerSelect = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    setSelectedCustomer(customer || null);
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

      // Auto-select customer if work order has customer_id
      if (workOrder.customer_id) {
        const customer = customers.find(c => c.id === workOrder.customer_id);
        if (customer) {
          setSelectedCustomer(customer);
        }
      }
    }
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
    setSelectedCustomer(newCustomer);
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
    setContactSearch("");
    setCustomerSignature('');
    setTechnicianSignature('');
    setShowSignatures(false);
    setShowActions(false);
    setSavedReportId(null);
    setShowCreateForm(false);
    loadInitialData();
  };

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Header - Mobile optimized */}
      <div className="mb-4 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold text-foreground">Rapporti di Intervento</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Crea e gestisci rapporti di intervento
          </p>
        </div>
        {!showCreateForm && !showActions && (
          <Button 
            onClick={() => setShowCreateForm(true)} 
            className="w-full sm:w-auto flex items-center justify-center gap-2"
            size="lg"
          >
            <Plus className="w-5 h-5" />
            Nuovo Rapporto
          </Button>
        )}
      </div>

      {!showCreateForm && !showActions ? (
        <Card className="border-0 sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-0 sm:px-6">
            <CardTitle className="text-lg sm:text-xl">Rapporti Esistenti</CardTitle>
            <CardDescription className="text-sm">
              Elenco rapporti di intervento
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6">
            {reports.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">Nessun rapporto trovato</p>
                <Button onClick={() => setShowCreateForm(true)} className="flex items-center gap-2 mx-auto" size="lg">
                  <Plus className="w-5 h-5" />
                  Crea il Primo Rapporto
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div 
                    key={report.id} 
                    className="p-3 sm:p-4 border rounded-lg hover:bg-accent/50 active:bg-accent/70 transition-colors cursor-pointer touch-manipulation"
                    onClick={() => {
                      setSelectedReport(report);
                      setShowReportDetails(true);
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      {/* Nome cliente e azienda */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <h3 className="font-semibold text-base sm:text-lg">
                          {report.crm_contacts?.first_name} {report.crm_contacts?.last_name}
                        </h3>
                        {report.crm_contacts?.company_name && (
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {report.crm_contacts.company_name}
                          </span>
                        )}
                      </div>
                      
                      {/* Info grid - mobile 2 cols, desktop 4 cols */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
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
                      
                      {/* Descrizione e totale */}
                      {report.work_performed && (
                        <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                          {report.work_performed}
                        </p>
                      )}
                      {report.total_amount && (
                        <p className="text-sm font-semibold text-primary">
                          Totale: €{report.total_amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : showActions ? (
        <Card className="border-0 sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-0 sm:px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <FileText className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-lg sm:text-xl">Rapporto Completato</CardTitle>
            <CardDescription className="text-sm">
              Salvato con successo. Scegli cosa fare.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 px-0 sm:px-6">
            <Button 
              onClick={generatePDF} 
              className="w-full flex items-center justify-center gap-2 h-12"
              size="lg"
            >
              <Download className="w-5 h-5" />
              Scarica PDF
            </Button>
            <Button 
              onClick={sendEmail} 
              variant="outline"
              className="w-full flex items-center justify-center gap-2 h-12"
              size="lg"
              disabled={loading || !selectedContact?.email}
            >
              <Mail className="w-5 h-5" />
              {loading ? "Invio in corso..." : "Invia Email"}
            </Button>

            <Separator className="my-4" />

            <Button 
              onClick={resetForm}
              variant="secondary"
              className="w-full h-12"
              size="lg"
            >
              Crea Nuovo Rapporto
            </Button>
            
            <Button 
              onClick={() => {
                setShowActions(false);
                setShowCreateForm(false);
                setSavedReportId(null);
              }}
              variant="ghost"
              className="w-full h-12"
              size="lg"
            >
              Torna all'Elenco
            </Button>
          </CardContent>
        </Card>
      ) : !showSignatures ? (
        <div className="space-y-4 sm:space-y-6">
          {/* Back button */}
          <Button
            variant="ghost"
            onClick={() => setShowCreateForm(false)}
            className="flex items-center gap-2 -ml-2 sm:ml-0"
            size="sm"
          >
            ← Torna all'Elenco
          </Button>

          {/* Ordine di Lavoro (Optional) */}
          <Card className="border-0 sm:border shadow-none sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ClipboardList className="w-5 h-5" />
                Commessa (Opzionale)
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Collega a una commessa esistente
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 sm:px-6 space-y-3">
              <Select onValueChange={handleWorkOrderSelect}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Seleziona commessa..." />
                </SelectTrigger>
                <SelectContent>
                  {workOrders.map((workOrder) => (
                    <SelectItem key={workOrder.id} value={workOrder.id} className="py-3">
                      {workOrder.number} - {workOrder.title} ({workOrder.type === 'service' ? 'CdL' : 'CdP'})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedWorkOrder && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <h4 className="font-medium mb-1">{selectedWorkOrder.number} - {selectedWorkOrder.title}</h4>
                  <p className="text-muted-foreground text-xs">
                    {selectedWorkOrder.type === 'service' ? 'CdL' : 'CdP'}
                    {selectedWorkOrder.location && ` • ${selectedWorkOrder.location}`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selezione Cliente */}
          <Card className="border-0 sm:border shadow-none sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <User className="w-5 h-5" />
                Cliente *
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactSearchOpen}
                      className="flex-1 h-12 justify-between text-base font-normal"
                    >
                      {selectedContact ? (
                        <span className="truncate">
                          {selectedContact.first_name} {selectedContact.last_name}
                          {selectedContact.company_name && ` - ${selectedContact.company_name}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Cerca cliente...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-24px)] sm:w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Cerca per nome, azienda, email..." 
                        value={contactSearch}
                        onValueChange={setContactSearch}
                        className="h-12"
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-6 text-center text-sm">
                          <p className="text-muted-foreground mb-2">Nessun cliente trovato</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setContactSearchOpen(false);
                              setShowCreateContact(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Crea nuovo cliente
                          </Button>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredContacts.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={contact.id}
                              onSelect={() => {
                                handleContactSelect(contact.id);
                                setContactSearchOpen(false);
                                setContactSearch("");
                              }}
                              className="py-3 cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedContact?.id === contact.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {contact.first_name} {contact.last_name}
                                </p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {contact.company_name && <span className="truncate">{contact.company_name}</span>}
                                  {contact.email && <span className="truncate">• {contact.email}</span>}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateContact(true)}
                  className="h-12 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo
                </Button>
              </div>

              {selectedContact && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{selectedContact.first_name} {selectedContact.last_name}</p>
                  {selectedContact.company_name && <p className="text-muted-foreground">{selectedContact.company_name}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {selectedContact.email && <span>{selectedContact.email}</span>}
                    {selectedContact.phone && <span>{selectedContact.phone}</span>}
                    {selectedContact.address && <span className="w-full mt-1">{selectedContact.address}</span>}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dettagli Intervento */}
          <Card className="border-0 sm:border shadow-none sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Wrench className="w-5 h-5" />
                Dettagli Intervento
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6 space-y-4">
              {/* Data e Tecnico - stack su mobile */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="intervention_date" className="text-sm font-medium">Data Intervento *</Label>
                  <Input
                    id="intervention_date"
                    type="date"
                    value={formData.intervention_date}
                    onChange={(e) => handleInputChange('intervention_date', e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="technician" className="text-sm font-medium">Tecnico *</Label>
                  <Select onValueChange={handleTechnicianSelect}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Seleziona tecnico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.map((technician) => (
                        <SelectItem key={technician.id} value={technician.id} className="py-3">
                          {technician.first_name} {technician.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ora inizio/fine */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_time" className="text-sm font-medium">Ora Inizio</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_time" className="text-sm font-medium">Ora Fine</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                    className="h-12 text-base"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervention_type" className="text-sm font-medium">Tipo Intervento *</Label>
                <Select onValueChange={(value) => handleInputChange('intervention_type', value)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Seleziona tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manutenzione" className="py-3">Manutenzione</SelectItem>
                    <SelectItem value="riparazione" className="py-3">Riparazione</SelectItem>
                    <SelectItem value="installazione" className="py-3">Installazione</SelectItem>
                    <SelectItem value="collaudo" className="py-3">Collaudo</SelectItem>
                    <SelectItem value="consulenza" className="py-3">Consulenza</SelectItem>
                    <SelectItem value="altro" className="py-3">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">Descrizione Problema</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrivi il problema..."
                  rows={3}
                  className="text-base resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="work_performed" className="text-sm font-medium">Lavori Eseguiti</Label>
                <Textarea
                  id="work_performed"
                  value={formData.work_performed}
                  onChange={(e) => handleInputChange('work_performed', e.target.value)}
                  placeholder="Descrivi i lavori eseguiti..."
                  rows={3}
                  className="text-base resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="materials_used" className="text-sm font-medium">Materiali Utilizzati</Label>
                <Textarea
                  id="materials_used"
                  value={formData.materials_used}
                  onChange={(e) => handleInputChange('materials_used', e.target.value)}
                  placeholder="Elenca i materiali..."
                  rows={2}
                  className="text-base resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-sm font-medium">Note Aggiuntive</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Note..."
                  rows={2}
                  className="text-base resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Dettagli Economici */}
          <Card className="border-0 sm:border shadow-none sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6 pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="w-5 h-5" />
                Dettagli Economici
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 sm:px-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-sm font-medium">Importo (€)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="0.00"
                    className="h-12 text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_rate" className="text-sm font-medium">IVA (%)</Label>
                  <Select value={formData.vat_rate} onValueChange={(value) => handleInputChange('vat_rate', value)}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="IVA" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="py-3">0%</SelectItem>
                      <SelectItem value="4" className="py-3">4%</SelectItem>
                      <SelectItem value="10" className="py-3">10%</SelectItem>
                      <SelectItem value="22" className="py-3">22%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="total_amount" className="text-sm font-medium">Totale (€)</Label>
                  <Input
                    id="total_amount"
                    type="text"
                    value={formData.total_amount}
                    readOnly
                    className="h-12 text-base bg-muted font-semibold"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bottom CTA */}
          <div className="sticky bottom-0 bg-background py-4 border-t sm:border-0 sm:static sm:py-0 -mx-3 px-3 sm:mx-0 sm:px-0">
            <Button 
              onClick={generateReport} 
              className="w-full h-14 text-base flex items-center justify-center gap-2"
              size="lg"
            >
              <FileText className="w-5 h-5" />
              Genera Rapporto
            </Button>
          </div>
        </div>
      ) : (
        <Card className="border-0 sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-0 sm:px-6 text-center">
            <CardTitle className="text-lg sm:text-xl">Firme Digitali</CardTitle>
            <CardDescription className="text-sm">
              Firma cliente e tecnico per completare
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 px-0 sm:px-6">
            <div>
              <h3 className="text-base font-medium mb-3">Firma Cliente</h3>
              <SignatureCanvas
                onSignatureChange={setCustomerSignature}
                placeholder="Il cliente deve firmare qui"
              />
            </div>

            <Separator />

            <div>
              <h3 className="text-base font-medium mb-3">Firma Tecnico</h3>
              <SignatureCanvas
                onSignatureChange={setTechnicianSignature}
                placeholder="Il tecnico deve firmare qui"
              />
            </div>

            <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSignatures(false)}
                className="h-12 order-2 sm:order-1"
                size="lg"
              >
                Indietro
              </Button>
              <Button
                onClick={saveReport}
                disabled={loading || !customerSignature || !technicianSignature}
                className="h-12 order-1 sm:order-2"
                size="lg"
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
