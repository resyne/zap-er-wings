import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Check, ChevronsUpDown, Download, Mail, Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { MaterialsLineItems, type MaterialItem } from "@/components/support/MaterialsLineItems";
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
  type: 'service' | 'production';
}

type Step = "form" | "signatures" | "done";

const stepLabels: Record<Step, string> = {
  form: "Dati Intervento",
  signatures: "Firme",
  done: "Completato",
};

export default function ZAppNewServiceReportPage() {
  const navigate = useNavigate();
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
  const [customerSignature, setCustomerSignature] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const s = customerSearch.toLowerCase();
    return customers.filter(c =>
      (c.name || '').toLowerCase().includes(s) ||
      (c.company_name || '').toLowerCase().includes(s) ||
      (c.email || '').toLowerCase().includes(s) ||
      (c.phone || '').toLowerCase().includes(s)
    );
  }, [customers, customerSearch]);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [customersRes, techniciansRes, serviceOrdersRes] = await Promise.all([
        supabase.from('customers')
          .select('id, name, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address')
          .order('company_name', { ascending: true, nullsFirst: false }).order('name'),
        supabase.from('technicians')
          .select('id, first_name, last_name, employee_code')
          .eq('active', true).order('first_name'),
        supabase.from('service_work_orders')
          .select('id, number, title, description, customer_id')
          .in('status', ['planned', 'in_progress'])
      ]);

      setCustomers(customersRes.data || []);
      setTechnicians(techniciansRes.data || []);
      setWorkOrders((serviceOrdersRes.data || []).map(wo => ({ ...wo, type: 'service' as const })));
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
        newData.total_amount = (amount + (amount * vatRate / 100)).toFixed(2);
      }
      return newData;
    });
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customers.find(c => c.id === customerId) || null);
    setCustomerSearchOpen(false);
  };

  const handleWorkOrderSelect = (workOrderId: string) => {
    const wo = workOrders.find(w => w.id === workOrderId);
    setSelectedWorkOrder(wo || null);
    if (wo) {
      setFormData(prev => ({
        ...prev,
        work_performed: wo.description || prev.work_performed,
        notes: wo.title || prev.notes
      }));
      if (wo.customer_id) {
        const c = customers.find(c => c.id === wo.customer_id);
        if (c) setSelectedCustomer(c);
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

      if (materialItems.length > 0) {
        const materialsToInsert = materialItems.filter(m => m.description.trim()).map(m => ({
          report_id: data.id,
          description: m.description,
          quantity: m.quantity,
          unit_price: m.unit_price,
          vat_rate: m.vat_rate
        }));
        if (materialsToInsert.length > 0) {
          await supabase.from('service_report_materials').insert(materialsToInsert);
        }
      }

      setSavedReportId(data.id);
      setStep("done");
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
      doc.setFont(undefined!, "bold");
      doc.text("Rapporto di Intervento", 105, 20, { align: "center" });
      y = 35;

      doc.setFontSize(12);
      doc.setFont(undefined!, "bold");
      doc.text("Cliente:", 20, y);
      doc.setFont(undefined!, "normal");
      y += 7;
      doc.text(selectedCustomer.name, 20, y);
      if (selectedCustomer.company_name) { y += 7; doc.text(selectedCustomer.company_name, 20, y); }
      if (selectedCustomer.email) { y += 7; doc.text(`Email: ${selectedCustomer.email}`, 20, y); }
      if (selectedCustomer.phone) { y += 7; doc.text(`Tel: ${selectedCustomer.phone}`, 20, y); }
      if (selectedCustomer.address) {
        y += 7;
        doc.text(`Indirizzo: ${[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}`, 20, y);
      }
      y += 10;

      doc.setFont(undefined!, "bold");
      doc.text("Dettagli Intervento:", 20, y);
      doc.setFont(undefined!, "normal");
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
        doc.setFont(undefined!, "bold");
        doc.text("Descrizione Problema:", 20, y);
        doc.setFont(undefined!, "normal");
        y += 7;
        const lines = doc.splitTextToSize(formData.description, 170);
        doc.text(lines, 20, y);
        y += lines.length * 7 + 3;
      }

      if (formData.work_performed) {
        doc.setFont(undefined!, "bold");
        doc.text("Lavori Eseguiti:", 20, y);
        doc.setFont(undefined!, "normal");
        y += 7;
        const lines = doc.splitTextToSize(formData.work_performed, 170);
        doc.text(lines, 20, y);
        y += lines.length * 7 + 3;
      }

      if (formData.amount) {
        if (y > 220) { doc.addPage(); y = 20; }
        y += 10;
        doc.setFont(undefined!, "bold");
        doc.text("Dettagli Economici:", 20, y);
        doc.setFont(undefined!, "normal");
        y += 7;
        doc.text(`Importo: €${parseFloat(formData.amount).toFixed(2)}`, 20, y);
        y += 7;
        doc.text(`IVA: ${parseFloat(formData.vat_rate).toFixed(2)}%`, 20, y);
        y += 7;
        doc.setFont(undefined!, "bold");
        doc.text(`Totale: €${parseFloat(formData.total_amount).toFixed(2)}`, 20, y);
        y += 10;
      }

      if (y > 220) { doc.addPage(); y = 20; }
      y += 10;
      doc.setFont(undefined!, "bold");
      doc.text("Firma Cliente:", 20, y);
      doc.text("Firma Tecnico:", 110, y);
      if (customerSignature) doc.addImage(customerSignature, "PNG", 20, y + 5, 70, 30);
      if (technicianSignature) doc.addImage(technicianSignature, "PNG", 110, y + 5, 70, 30);

      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8);
      doc.setFont(undefined!, "normal");
      doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
      doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
      doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });

      const fileName = `rapporto_${formData.intervention_date}_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      toast.success("PDF scaricato");
    };
  };

  const sendEmail = async () => {
    if (!selectedCustomer?.email) {
      toast.error("Il cliente non ha un indirizzo email");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-customer-emails', {
        body: {
          to: selectedCustomer.email,
          subject: `Rapporto di Intervento - ${formData.intervention_date}`,
          recipientName: selectedCustomer.name,
          message: `Gentile ${selectedCustomer.name},\n\nin allegato trovi il rapporto di intervento del ${formData.intervention_date}.\n\nTipo intervento: ${formData.intervention_type}\nTecnico: ${selectedTechnician?.first_name} ${selectedTechnician?.last_name}\n\n${formData.work_performed ? `Lavori eseguiti:\n${formData.work_performed}\n\n` : ''}Cordiali saluti`,
          reportData: {
            customer: selectedCustomer,
            technician: selectedTechnician,
            formData,
            customerSignature,
            technicianSignature,
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

  const steps: Step[] = ["form", "signatures", "done"];
  const currentIdx = steps.indexOf(step);

  return (
    <div className="flex flex-col min-h-screen bg-muted/30">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-blue-600 text-white safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 shrink-0 h-9 w-9"
            onClick={() => {
              if (step === "signatures") setStep("form");
              else navigate("/hr/z-app/rapporti");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">{stepLabels[step]}</h1>
            <p className="text-blue-200 text-xs">Nuovo Rapporto di Intervento</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="px-4 pb-3 flex gap-2">
          {steps.filter(s => s !== "done").map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= currentIdx ? "bg-white" : "bg-white/30"
              )}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-4 py-4 pb-28">
        {step === "form" && (
          <div className="space-y-5">
            {/* Work Order */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Commessa (opzionale)</Label>
              <Select onValueChange={handleWorkOrderSelect}>
                <SelectTrigger><SelectValue placeholder="Seleziona commessa..." /></SelectTrigger>
                <SelectContent>
                  {workOrders.map(wo => (
                    <SelectItem key={wo.id} value={wo.id}>{wo.number} - {wo.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cliente *</Label>
              <div className="flex gap-2">
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="flex-1 justify-between h-10 text-sm">
                      {selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : "Cerca cliente..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[calc(100vw-4rem)] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Cerca cliente..." value={customerSearch} onValueChange={setCustomerSearch} />
                      <CommandList>
                        <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                        <CommandGroup className="max-h-60 overflow-auto">
                          {filteredCustomers.map(c => (
                            <CommandItem key={c.id} value={c.id} onSelect={() => handleCustomerSelect(c.id)}>
                              <Check className={cn("mr-2 h-4 w-4", selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span className="font-medium text-sm">{c.company_name || c.name}</span>
                                {c.company_name && <span className="text-xs text-muted-foreground">{c.name}</span>}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={() => setShowCreateCustomer(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Technician */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tecnico *</Label>
              <Select onValueChange={(id) => setSelectedTechnician(technicians.find(t => t.id === id) || null)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Seleziona tecnico..." /></SelectTrigger>
                <SelectContent>
                  {technicians.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.first_name} {t.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Intervention Type */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo Intervento *</Label>
              <Select onValueChange={(v) => handleInputChange('intervention_type', v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Seleziona tipo..." /></SelectTrigger>
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Data</Label>
                <Input type="date" className="h-10" value={formData.intervention_date} onChange={(e) => handleInputChange('intervention_date', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ora Inizio</Label>
                <Input type="time" className="h-10" value={formData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Ora Fine</Label>
                <Input type="time" className="h-10" value={formData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrizione Problema</Label>
              <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Descrivi il problema..." rows={2} />
            </div>

            {/* Work Performed */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Lavori Eseguiti</Label>
              <Textarea value={formData.work_performed} onChange={(e) => handleInputChange('work_performed', e.target.value)} placeholder="Descrivi i lavori eseguiti..." rows={3} />
            </div>

            {/* Materials */}
            <MaterialsLineItems items={materialItems} onChange={setMaterialItems} />

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Note</Label>
              <Textarea value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Note aggiuntive..." rows={2} />
            </div>

            {/* Economic */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Importo (€)</Label>
                <Input type="number" step="0.01" className="h-10" value={formData.amount} onChange={(e) => handleInputChange('amount', e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">IVA (%)</Label>
                <Select value={formData.vat_rate} onValueChange={(v) => handleInputChange('vat_rate', v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="4">4%</SelectItem>
                    <SelectItem value="10">10%</SelectItem>
                    <SelectItem value="22">22%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Totale (€)</Label>
                <Input type="text" className="h-10 bg-muted" value={formData.total_amount} readOnly />
              </div>
            </div>
          </div>
        )}

        {step === "signatures" && (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Firma Cliente</Label>
              <SignatureCanvas onSignatureChange={setCustomerSignature} placeholder="Firma del cliente" />
            </div>
            <div className="space-y-3">
              <Label className="text-base font-semibold">Firma Tecnico</Label>
              <SignatureCanvas onSignatureChange={setTechnicianSignature} placeholder="Firma del tecnico" />
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground">Rapporto Salvato!</h2>
              <p className="text-sm text-muted-foreground mt-1">Cosa vuoi fare ora?</p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <Button onClick={generatePDF} variant="outline" className="w-full h-12 text-base" disabled={loading}>
                <Download className="h-5 w-5 mr-2" />
                Scarica PDF
              </Button>
              <Button
                onClick={sendEmail}
                variant="outline"
                className="w-full h-12 text-base"
                disabled={loading || !selectedCustomer?.email}
              >
                {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Mail className="h-5 w-5 mr-2" />}
                Invia Email
              </Button>
              <Button onClick={() => navigate("/hr/z-app/rapporti")} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700">
                Torna ai Rapporti
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      {step !== "done" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border p-4 safe-area-bottom z-20">
          {step === "form" && (
            <Button onClick={goToSignatures} className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700">
              Avanti — Firme
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
          {step === "signatures" && (
            <Button
              onClick={saveReport}
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700"
              disabled={loading || !customerSignature || !technicianSignature}
            >
              {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Check className="h-5 w-5 mr-2" />}
              Salva Rapporto
            </Button>
          )}
        </div>
      )}

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />
    </div>
  );
}
