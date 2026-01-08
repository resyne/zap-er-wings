import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Check, ChevronsUpDown, Download, Mail, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
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

interface ServiceReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "form" | "signatures" | "actions";

export function ServiceReportDialog({ open, onOpenChange }: ServiceReportDialogProps) {
  const [step, setStep] = useState<Step>("form");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
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

  // Filtered customers for search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const searchLower = customerSearch.toLowerCase();
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
  }, [customers, customerSearch]);

  useEffect(() => {
    if (open) {
      loadInitialData();
    }
  }, [open]);

  const loadInitialData = async () => {
    try {
      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address')
        .order('company_name', { ascending: true, nullsFirst: false })
        .order('name');

      setCustomers(customersData || []);

      const { data: techniciansData } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      setTechnicians(techniciansData || []);

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

      const serviceOrders: WorkOrder[] = (serviceOrdersRes.data || []).map(wo => ({ ...wo, type: 'service' as const }));
      const productionOrders: WorkOrder[] = (productionOrdersRes.data || []).map(wo => ({ ...wo, type: 'production' as const }));
      
      setWorkOrders([...serviceOrders, ...productionOrders]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Errore nel caricamento dei dati");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
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
    setCustomerSearchOpen(false);
  };

  const handleTechnicianSelect = (technicianId: string) => {
    const technician = technicians.find(t => t.id === technicianId);
    setSelectedTechnician(technician || null);
  };

  const handleWorkOrderSelect = (workOrderId: string) => {
    const workOrder = workOrders.find(wo => wo.id === workOrderId);
    setSelectedWorkOrder(workOrder || null);
    
    if (workOrder) {
      setFormData(prev => ({
        ...prev,
        work_performed: workOrder.description || prev.work_performed,
        notes: workOrder.title || prev.notes
      }));

      if (workOrder.customer_id) {
        const customer = customers.find(c => c.id === workOrder.customer_id);
        if (customer) setSelectedCustomer(customer);
      }
    }
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    setCustomers(prev => [...prev, newCustomer]);
    setSelectedCustomer(newCustomer);
    setShowCreateCustomer(false);
  };

  const goToSignatures = () => {
    if (!selectedCustomer || !formData.intervention_type || !selectedTechnician) {
      toast.error("Seleziona almeno cliente, tipo intervento e tecnico");
      return;
    }
    setStep("signatures");
  };

  const saveReport = async () => {
    if (!customerSignature || !technicianSignature) {
      toast.error("Entrambe le firme sono obbligatorie");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_reports')
        .insert({
          customer_id: selectedCustomer?.id,
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
          start_time: formData.start_time || null,
          end_time: formData.end_time || null,
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
      setStep("actions");
      toast.success("Rapporto salvato con successo");
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error("Errore nel salvare il rapporto");
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!selectedCustomer || !selectedTechnician) return;

    const doc = new jsPDF();
    let y = 20;

    const logoImg = new Image();
    logoImg.src = '/images/logo-zapper.png';
    logoImg.onload = () => {
      doc.addImage(logoImg, 'PNG', 15, 10, 40, 15);
      
      doc.setFontSize(18);
      doc.setFont(undefined, "bold");
      doc.text("Rapporto di Intervento", 105, 20, { align: "center" });
      y = 35;

      doc.setFontSize(12);
      doc.setFont(undefined, "bold");
      doc.text("Cliente:", 20, y);
      doc.setFont(undefined, "normal");
      y += 7;
      doc.text(selectedCustomer.name, 20, y);
      if (selectedCustomer.company_name) {
        y += 7;
        doc.text(selectedCustomer.company_name, 20, y);
      }
      if (selectedCustomer.email) {
        y += 7;
        doc.text(`Email: ${selectedCustomer.email}`, 20, y);
      }
      if (selectedCustomer.phone) {
        y += 7;
        doc.text(`Tel: ${selectedCustomer.phone}`, 20, y);
      }
      if (selectedCustomer.address) {
        y += 7;
        const fullAddress = [selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ');
        doc.text(`Indirizzo: ${fullAddress}`, 20, y);
      }
      y += 10;

      if (selectedWorkOrder) {
        doc.setFont(undefined, "bold");
        doc.text("Commessa di Lavoro:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;
        doc.text(`${selectedWorkOrder.number} - ${selectedWorkOrder.title}`, 20, y);
        y += 10;
      }

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

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
      doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
      doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });
      doc.text("www.abbattitorizapper.it  08119968436", 105, pageHeight - 8, { align: "center" });

      const fileName = `rapporto_intervento_${formData.intervention_date}_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);

      toast.success("PDF scaricato");
    };
  };

  const sendEmail = async () => {
    if (!selectedCustomer?.email) {
      toast.error("Il cliente non ha un indirizzo email registrato");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-customer-emails', {
        body: {
          to: selectedCustomer.email,
          subject: `Rapporto di Intervento - ${formData.intervention_date}`,
          recipientName: selectedCustomer.name,
          message: `Gentile ${selectedCustomer.name},\n\nin allegato trovi il rapporto di intervento del ${formData.intervention_date}.\n\nTipo intervento: ${formData.intervention_type}\nTecnico: ${selectedTechnician?.first_name} ${selectedTechnician?.last_name}\n\n${formData.work_performed ? `Lavori eseguiti:\n${formData.work_performed}\n\n` : ''}Grazie per averci scelto.\n\nCordiali saluti`,
          reportData: {
            customer: selectedCustomer,
            technician: selectedTechnician,
            formData: formData,
            customerSignature: customerSignature,
            technicianSignature: technicianSignature,
            workOrder: selectedWorkOrder
          }
        }
      });

      if (error) throw error;

      toast.success(`Email inviata a ${selectedCustomer.email}`);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Errore nell'invio dell'email");
    } finally {
      setLoading(false);
    }
  };

  const resetAndClose = () => {
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
    setSelectedCustomer(null);
    setSelectedTechnician(null);
    setSelectedWorkOrder(null);
    setCustomerSearch("");
    setCustomerSignature('');
    setTechnicianSignature('');
    setSavedReportId(null);
    setStep("form");
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) resetAndClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === "form" && "Nuovo Rapporto di Intervento"}
              {step === "signatures" && "Raccolta Firme"}
              {step === "actions" && "Rapporto Completato"}
            </DialogTitle>
          </DialogHeader>

          {step === "form" && (
            <div className="space-y-4">
              {/* Work Order Selection */}
              <div className="space-y-2">
                <Label>Commessa di Lavoro (opzionale)</Label>
                <Select onValueChange={handleWorkOrderSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona commessa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id}>
                        {wo.number} - {wo.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Selection */}
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <div className="flex gap-2">
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="flex-1 justify-between"
                      >
                        {selectedCustomer 
                          ? (selectedCustomer.company_name || selectedCustomer.name)
                          : "Cerca cliente..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput 
                          placeholder="Cerca cliente..." 
                          value={customerSearch}
                          onValueChange={setCustomerSearch}
                        />
                        <CommandList>
                          <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredCustomers.map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={customer.id}
                                onSelect={() => handleCustomerSelect(customer.id)}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <div className="flex flex-col">
                                  <span className="font-medium">{customer.company_name || customer.name}</span>
                                  {customer.company_name && (
                                    <span className="text-xs text-muted-foreground">{customer.name}</span>
                                  )}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" onClick={() => setShowCreateCustomer(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Technician Selection */}
              <div className="space-y-2">
                <Label>Tecnico *</Label>
                <Select onValueChange={handleTechnicianSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tecnico..." />
                  </SelectTrigger>
                  <SelectContent>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>
                        {tech.first_name} {tech.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Intervention Type */}
              <div className="space-y-2">
                <Label>Tipo Intervento *</Label>
                <Select onValueChange={(v) => handleInputChange('intervention_type', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tipo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="installazione">Installazione</SelectItem>
                    <SelectItem value="manutenzione">Manutenzione</SelectItem>
                    <SelectItem value="riparazione">Riparazione</SelectItem>
                    <SelectItem value="sopralluogo">Sopralluogo</SelectItem>
                    <SelectItem value="collaudo">Collaudo</SelectItem>
                    <SelectItem value="formazione">Formazione</SelectItem>
                    <SelectItem value="altro">Altro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date and Time */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input 
                    type="date" 
                    value={formData.intervention_date}
                    onChange={(e) => handleInputChange('intervention_date', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ora Inizio</Label>
                  <Input 
                    type="time" 
                    value={formData.start_time}
                    onChange={(e) => handleInputChange('start_time', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ora Fine</Label>
                  <Input 
                    type="time" 
                    value={formData.end_time}
                    onChange={(e) => handleInputChange('end_time', e.target.value)}
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label>Descrizione Problema</Label>
                <Textarea 
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descrivi il problema riscontrato..."
                  rows={2}
                />
              </div>

              {/* Work Performed */}
              <div className="space-y-2">
                <Label>Lavori Eseguiti</Label>
                <Textarea 
                  value={formData.work_performed}
                  onChange={(e) => handleInputChange('work_performed', e.target.value)}
                  placeholder="Descrivi i lavori eseguiti..."
                  rows={3}
                />
              </div>

              {/* Materials Used */}
              <div className="space-y-2">
                <Label>Materiali Utilizzati</Label>
                <Textarea 
                  value={formData.materials_used}
                  onChange={(e) => handleInputChange('materials_used', e.target.value)}
                  placeholder="Elenco materiali..."
                  rows={2}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Note</Label>
                <Textarea 
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Note aggiuntive..."
                  rows={2}
                />
              </div>

              {/* Economic Details */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Importo (€)</Label>
                  <Input 
                    type="number" 
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IVA (%)</Label>
                  <Select value={formData.vat_rate} onValueChange={(v) => handleInputChange('vat_rate', v)}>
                    <SelectTrigger>
                      <SelectValue />
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
                  <Label>Totale (€)</Label>
                  <Input 
                    type="text"
                    value={formData.total_amount}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
            </div>
          )}

          {step === "signatures" && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Firma Cliente</Label>
                <SignatureCanvas 
                  onSignatureChange={setCustomerSignature}
                  placeholder="Firma del cliente"
                />
              </div>
              <div className="space-y-3">
                <Label className="text-base font-medium">Firma Tecnico</Label>
                <SignatureCanvas 
                  onSignatureChange={setTechnicianSignature}
                  placeholder="Firma del tecnico"
                />
              </div>
            </div>
          )}

          {step === "actions" && (
            <div className="space-y-4 py-4">
              <div className="text-center mb-6">
                <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <p className="text-lg font-medium">Rapporto salvato con successo!</p>
                <p className="text-sm text-muted-foreground">Cosa vuoi fare ora?</p>
              </div>
              <div className="flex flex-col gap-3">
                <Button onClick={generatePDF} variant="outline" className="w-full" disabled={loading}>
                  <Download className="h-4 w-4 mr-2" />
                  Scarica PDF
                </Button>
                <Button 
                  onClick={sendEmail} 
                  variant="outline" 
                  className="w-full"
                  disabled={loading || !selectedCustomer?.email}
                >
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Invia via Email
                </Button>
                <Button onClick={resetAndClose} className="w-full">
                  Chiudi
                </Button>
              </div>
            </div>
          )}

          {step !== "actions" && (
            <DialogFooter className="flex-row gap-2">
              {step === "signatures" && (
                <Button variant="outline" onClick={() => setStep("form")}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Indietro
                </Button>
              )}
              <Button variant="outline" onClick={resetAndClose}>
                Annulla
              </Button>
              {step === "form" && (
                <Button onClick={goToSignatures}>
                  Avanti
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
              {step === "signatures" && (
                <Button onClick={saveReport} disabled={loading || !customerSignature || !technicianSignature}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Salva Rapporto
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />
    </>
  );
}
