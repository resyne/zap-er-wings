import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileText, User, Wrench, ClipboardList, Download, Mail, Check, ChevronsUpDown, Settings, Car, Users } from "lucide-react";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { SignatureCanvas } from "@/components/support/SignatureCanvas";
import { ReportDetailsDialog } from "@/components/support/ReportDetailsDialog";
import { MaterialsLineItems, type MaterialItem } from "@/components/support/MaterialsLineItems";
import { CustomerStatementDialog } from "@/components/support/CustomerStatementDialog";
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
  customer_id?: string;
  contact_id?: string;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [workOrderSearchOpen, setWorkOrderSearchOpen] = useState(false);
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [showSignatures, setShowSignatures] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ServiceReport | null>(null);
  const [showReportDetails, setShowReportDetails] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
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
    total_amount: '',
    kilometers: '0'
  });
  
  // Technicians list - dynamic adding
  const [techniciansList, setTechniciansList] = useState<Array<{ type: 'head' | 'specialized'; id: string }>>([]);
  
  // Pricing settings
  const [pricingSettings, setPricingSettings] = useState({
    specialized_technician_hourly_rate: 40,
    specialized_technician_km_rate: 0.40,
    head_technician_hourly_rate: 60,
    head_technician_km_rate: 0.60
  });
  const [showSettings, setShowSettings] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [customerSignature, setCustomerSignature] = useState<string>('');
  const [technicianSignature, setTechnicianSignature] = useState<string>('');
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [showStatement, setShowStatement] = useState(false);
  const { toast } = useToast();

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

  // Filtered work orders for search
  const filteredWorkOrders = useMemo(() => {
    if (!workOrderSearch.trim()) return workOrders;
    const searchLower = workOrderSearch.toLowerCase();
    return workOrders.filter(wo => {
      const number = (wo.number || '').toLowerCase();
      const title = (wo.title || '').toLowerCase();
      const description = (wo.description || '').toLowerCase();
      return number.includes(searchLower) || 
             title.includes(searchLower) ||
             description.includes(searchLower);
    });
  }, [workOrders, workOrderSearch]);

  useEffect(() => {
    loadInitialData();
    // Check if we should open the create form from URL param
    if (searchParams.get('new') === 'true') {
      setShowCreateForm(true);
      // Remove the param from URL
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
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

      // Load service work orders (Commesse di Lavoro, not completed)
      const { data: serviceOrdersData, error: serviceOrdersError } = await supabase
        .from('service_work_orders')
        .select('id, number, title, description, customer_id, contact_id, location')
        .neq('status', 'completata')
        .order('number', { ascending: false });

      if (serviceOrdersError) throw serviceOrdersError;

      const serviceOrders: WorkOrder[] = (serviceOrdersData || []).map(wo => ({ ...wo, type: 'service' as const }));
      
      setWorkOrders(serviceOrders);

      // Load existing reports with customers relation
      const { data: reportsData, error: reportsError } = await supabase
        .from('service_reports')
        .select(`
          id,
          intervention_date,
          intervention_type,
          work_performed,
          status,
          customer_id,
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
      setReports((reportsData as unknown as ServiceReport[]) || []);

      // Load pricing settings
      const { data: settingsData } = await supabase
        .from('service_report_settings')
        .select('setting_key, setting_value');

      if (settingsData) {
        const newSettings: Record<string, number> = {};
        settingsData.forEach((s: { setting_key: string; setting_value: number }) => {
          newSettings[s.setting_key] = s.setting_value;
        });
        setPricingSettings(prev => ({ ...prev, ...newSettings }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    }
  };

  // Calculate hours from start and end time (minimum 1 hour, rounded up)
  const calculateHoursFromTime = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes <= 0) return 1; // Minimum 1 hour
    
    // Round up to the next hour
    const hours = Math.ceil(diffMinutes / 60);
    return Math.max(1, hours); // Minimum 1 hour
  };

  // Calculate material items net total
  const materialsTotalNetto = materialItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  // Calculate amount based on technicians list, time, km and materials
  const calculateAmount = (techs: typeof techniciansList, startTime: string, endTime: string, km: number, matTotal: number = materialsTotalNetto) => {
    const hours = calculateHoursFromTime(startTime, endTime);
    const headCount = techs.filter(t => t.type === 'head').length;
    const specCount = techs.filter(t => t.type === 'specialized').length;
    
    const headCost = hours * headCount * pricingSettings.head_technician_hourly_rate;
    const specCost = hours * specCount * pricingSettings.specialized_technician_hourly_rate;
    const kmCost = km * pricingSettings.head_technician_km_rate;
    
    return headCost + specCost + kmCost + matTotal;
  };

  // Recalculate amount when materialItems change
  useEffect(() => {
    const km = parseFloat(formData.kilometers) || 0;
    const calculatedAmount = calculateAmount(techniciansList, formData.start_time, formData.end_time, km, materialsTotalNetto);
    setFormData(prev => {
      const vatRate = parseFloat(prev.vat_rate) || 0;
      const total = calculatedAmount + (calculatedAmount * vatRate / 100);
      return { ...prev, amount: calculatedAmount.toFixed(2), total_amount: total.toFixed(2) };
    });
  }, [materialsTotalNetto]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-calculate amount based on technicians and time
      if (['kilometers', 'start_time', 'end_time'].includes(field) || field === 'amount' || field === 'vat_rate') {
        const km = parseFloat(field === 'kilometers' ? value : newData.kilometers) || 0;
        const startTime = field === 'start_time' ? value : newData.start_time;
        const endTime = field === 'end_time' ? value : newData.end_time;
        
        const calculatedAmount = calculateAmount(techniciansList, startTime, endTime, km);
        
        if (!prev.amount || ['kilometers', 'start_time', 'end_time'].includes(field)) {
          newData.amount = calculatedAmount.toFixed(2);
        }
      }
      
      // Auto-calculate total when amount or vat changes
      const amount = parseFloat(newData.amount) || 0;
      const vatRate = parseFloat(newData.vat_rate) || 0;
      const total = amount + (amount * vatRate / 100);
      newData.total_amount = total.toFixed(2);
      
      return newData;
    });
  };

  // Add technician to the list
  const addTechnician = (type: 'head' | 'specialized') => {
    const newTech = { type, id: crypto.randomUUID() };
    const newList = [...techniciansList, newTech];
    setTechniciansList(newList);
    
    // Recalculate amount
    const km = parseFloat(formData.kilometers) || 0;
    const calculatedAmount = calculateAmount(newList, formData.start_time, formData.end_time, km);
    setFormData(prev => {
      const amount = calculatedAmount;
      const vatRate = parseFloat(prev.vat_rate) || 0;
      const total = amount + (amount * vatRate / 100);
      return { ...prev, amount: amount.toFixed(2), total_amount: total.toFixed(2) };
    });
  };

  // Remove technician from the list
  const removeTechnician = (id: string) => {
    const newList = techniciansList.filter(t => t.id !== id);
    setTechniciansList(newList);
    
    // Recalculate amount
    const km = parseFloat(formData.kilometers) || 0;
    const calculatedAmount = calculateAmount(newList, formData.start_time, formData.end_time, km);
    setFormData(prev => {
      const amount = calculatedAmount;
      const vatRate = parseFloat(prev.vat_rate) || 0;
      const total = amount + (amount * vatRate / 100);
      return { ...prev, amount: amount.toFixed(2), total_amount: total.toFixed(2) };
    });
  };

  const saveSettings = async () => {
    setSettingsLoading(true);
    try {
      const updates = Object.entries(pricingSettings).map(([key, value]) => ({
        setting_key: key,
        setting_value: value
      }));

      for (const update of updates) {
        await supabase
          .from('service_report_settings')
          .update({ setting_value: update.setting_value })
          .eq('setting_key', update.setting_key);
      }

      toast({
        title: "Impostazioni salvate",
        description: "I prezzi listino sono stati aggiornati",
      });
      setShowSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvare le impostazioni",
        variant: "destructive",
      });
    } finally {
      setSettingsLoading(false);
    }
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
    setShowCreateCustomer(false);
  };

  const generateReport = () => {
    if (!selectedCustomer || !formData.intervention_type || !selectedTechnician) {
      toast({
        title: "Campi obbligatori mancanti",
        description: "Seleziona almeno cliente, tipo intervento e tecnico",
        variant: "destructive",
      });
      return;
    }
    // If editing and signatures already exist, save directly
    if (editingReportId && customerSignature && technicianSignature) {
      saveReport();
    } else {
      setShowSignatures(true);
    }
  };

  const saveReport = async () => {
    if (!editingReportId && (!customerSignature || !technicianSignature)) {
      toast({
        title: "Firme mancanti",
        description: "Entrambe le firme sono obbligatorie",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const reportPayload = {
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
        customer_signature: customerSignature || undefined,
        technician_signature: technicianSignature || undefined,
        status: 'completed' as const,
        technicians_count: techniciansList.length || 1,
        kilometers: parseFloat(formData.kilometers) || 0,
        head_technician_hours: calculateHoursFromTime(formData.start_time, formData.end_time) * techniciansList.filter(t => t.type === 'head').length,
        specialized_technician_hours: calculateHoursFromTime(formData.start_time, formData.end_time) * techniciansList.filter(t => t.type === 'specialized').length
      };

      let reportId: string;

      if (editingReportId) {
        // Update existing report
        const { error } = await supabase
          .from('service_reports')
          .update(reportPayload)
          .eq('id', editingReportId);
        if (error) throw error;
        reportId = editingReportId;

        // Replace materials: delete old, insert new
        await supabase.from('service_report_materials').delete().eq('report_id', editingReportId);
      } else {
        // Insert new report
        const { data, error } = await supabase
          .from('service_reports')
          .insert(reportPayload)
          .select()
          .single();
        if (error) throw error;
        reportId = data.id;
      }

      // Save material items
      if (materialItems.length > 0) {
        const materialsToInsert = materialItems.filter(m => m.description.trim()).map(m => ({
          report_id: reportId,
          description: m.description,
          quantity: m.quantity,
          unit_price: m.unit_price,
          vat_rate: m.vat_rate
        }));
        if (materialsToInsert.length > 0) {
          await supabase.from('service_report_materials').insert(materialsToInsert);
        }
      }

      setSavedReportId(reportId);
      setShowSignatures(false);
      setShowActions(true);

      toast({
        title: editingReportId ? "Rapporto aggiornato" : "Rapporto salvato",
        description: editingReportId ? "Il rapporto è stato aggiornato con successo" : "Il rapporto di intervento è stato salvato con successo",
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
    if (!selectedCustomer || !selectedTechnician) return;

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
      y += 7;
      const techCount = techniciansList.length || 1;
      doc.text(`N. Tecnici presenti: ${techCount}`, 20, y);
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

      // Materiali come tabella
      if (materialItems.length > 0 && materialItems.some(m => m.description.trim())) {
        if (y > 200) { doc.addPage(); y = 20; }
        doc.setFont(undefined, "bold");
        doc.text("Materiali Utilizzati:", 20, y);
        y += 7;
        doc.setFontSize(9);
        // Header
        doc.setFont(undefined, "bold");
        doc.text("Descrizione", 20, y);
        doc.text("Qtà", 120, y);
        doc.text("Prezzo", 140, y);
        doc.text("IVA", 165, y);
        doc.text("Totale", 180, y);
        y += 5;
        doc.line(20, y, 195, y);
        y += 3;
        doc.setFont(undefined, "normal");
        let matNettoTotal = 0;
        let matIvaTotal = 0;
        materialItems.filter(m => m.description.trim()).forEach(item => {
          if (y > 270) { doc.addPage(); y = 20; }
          const netto = item.quantity * item.unit_price;
          const iva = netto * item.vat_rate / 100;
          matNettoTotal += netto;
          matIvaTotal += iva;
          const descText = doc.splitTextToSize(item.description, 95);
          doc.text(descText, 20, y);
          doc.text(String(item.quantity), 120, y);
          doc.text(item.unit_price > 0 ? `€${item.unit_price.toFixed(2)}` : '-', 140, y);
          doc.text(`${item.vat_rate}%`, 165, y);
          doc.text(item.unit_price > 0 ? `€${(netto + iva).toFixed(2)}` : '-', 180, y);
          y += descText.length * 5 + 2;
        });
        if (matNettoTotal > 0) {
          y += 2;
          doc.line(20, y, 195, y);
          y += 5;
          doc.setFont(undefined, "bold");
          doc.text(`Netto: €${matNettoTotal.toFixed(2)}  |  IVA: €${matIvaTotal.toFixed(2)}  |  Totale: €${(matNettoTotal + matIvaTotal).toFixed(2)}`, 20, y);
          y += 5;
        }
        doc.setFontSize(12);
        doc.setFont(undefined, "normal");
        y += 5;
      } else if (formData.materials_used) {
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
      if (parseFloat(formData.amount) > 0 || materialsTotalNetto > 0) {
        if (y > 200) { doc.addPage(); y = 20; }
        y += 10;
        doc.setFont(undefined, "bold");
        doc.text("Dettagli Economici:", 20, y);
        doc.setFont(undefined, "normal");
        y += 7;

        const hours = calculateHoursFromTime(formData.start_time, formData.end_time);
        const headCount = techniciansList.filter(t => t.type === 'head').length;
        const specCount = techniciansList.filter(t => t.type === 'specialized').length;
        const laborCost = hours * headCount * pricingSettings.head_technician_hourly_rate + hours * specCount * pricingSettings.specialized_technician_hourly_rate;
        const km = parseFloat(formData.kilometers) || 0;
        const kmCost = km * pricingSettings.head_technician_km_rate;

        if (laborCost > 0) {
          doc.text(`Manodopera (${hours}h x ${headCount + specCount} tecnici): €${laborCost.toFixed(2)}`, 20, y); y += 7;
        }
        if (kmCost > 0) {
          doc.text(`Rimborso Chilometrico (${km} km): €${kmCost.toFixed(2)}`, 20, y); y += 7;
        }
        if (materialsTotalNetto > 0) {
          doc.text(`Materiali: €${materialsTotalNetto.toFixed(2)}`, 20, y); y += 7;
        }

        const netTotal = parseFloat(formData.amount) || 0;
        doc.text(`Importo Netto Totale: €${netTotal.toFixed(2)}`, 20, y); y += 7;

        if (formData.vat_rate) { doc.text(`IVA: ${parseFloat(formData.vat_rate).toFixed(2)}%`, 20, y); y += 7; }
        if (formData.total_amount) {
          doc.setFont(undefined, "bold");
          doc.text(`Totale Complessivo: €${parseFloat(formData.total_amount).toFixed(2)}`, 20, y);
          doc.setFont(undefined, "normal");
          y += 10;
        }
      }

      // Listino Prezzi
      if (y > 180) { doc.addPage(); y = 20; }
      y += 5;
      doc.setFontSize(9);
      doc.setFont(undefined, "bold");
      doc.text("LISTINO PREZZI INTERVENTI FUORI CONTRATTO - 2026", 105, y, { align: "center" });
      y += 6;
      doc.setFontSize(8);
      doc.setFont(undefined, "normal");
      const listinoIntro = doc.splitTextToSize("Gli interventi tecnici richiesti al di fuori di un contratto di manutenzione programmata verranno gestiti secondo le seguenti condizioni:", 170);
      doc.text(listinoIntro, 20, y);
      y += listinoIntro.length * 4 + 3;

      doc.setFont(undefined, "bold");
      doc.text("Costo di chiamata: ", 20, y);
      doc.setFont(undefined, "normal");
      doc.text("€ 50,00+iva", 20 + doc.getTextWidth("Costo di chiamata: "), y);
      y += 4;
      doc.setFontSize(7);
      doc.text("*L'amministrazione si riserva la facoltà di azzerare il costo di chiamata", 20, y);
      y += 5;
      doc.setFontSize(8);

      doc.setFont(undefined, "bold");
      doc.text("Rimborso chilometrico: ", 20, y);
      doc.setFont(undefined, "normal");
      doc.text("€ 0,40+iva / km", 20 + doc.getTextWidth("Rimborso chilometrico: "), y);
      y += 4;
      const kmDesc = doc.splitTextToSize("calcolato sulla percorrenza andata e ritorno dal punto di partenza del tecnico.", 170);
      doc.text(kmDesc, 20, y);
      y += kmDesc.length * 4;
      doc.setFontSize(7);
      doc.text("*L'amministrazione si riserva la facoltà di azzerare il rimborso chilometrico", 20, y);
      y += 5;
      doc.setFontSize(8);

      doc.setFont(undefined, "bold");
      doc.text("Costo dell'intervento: ", 20, y);
      doc.setFont(undefined, "normal");
      doc.text("€ 40,00+iva / ora per singolo tecnico", 20 + doc.getTextWidth("Costo dell'intervento: "), y);
      y += 5;

      doc.setFont(undefined, "bold");
      doc.text("Materiali utilizzati: ", 20, y);
      doc.setFont(undefined, "normal");
      doc.text("addebitati in base alle quantità impiegate", 20 + doc.getTextWidth("Materiali utilizzati: "), y);
      y += 6;

      const closingLines = doc.splitTextToSize("Al termine dell'intervento verrà rilasciato un rapporto di intervento riepilogativo delle attività svolte. Se non comunicato a termine lavoro, il corrispettivo verrà indicato nella fattura emessa successivamente all'intervento.", 170);
      doc.text(closingLines, 20, y);
      y += closingLines.length * 4 + 2;
      doc.setFontSize(12);

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

      const fileName = `rapporto_intervento_${formData.intervention_date}_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);

      toast({
        title: "PDF Scaricato",
        description: "Il rapporto è stato scaricato in formato PDF",
      });
    };
  };

  const sendEmail = async () => {
    if (!selectedCustomer?.email) {
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

      toast({
        title: "Email Inviata",
        description: `Il rapporto è stato inviato a ${selectedCustomer.email}`,
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
      total_amount: '',
      kilometers: '0'
    });
    setTechniciansList([]);
    setMaterialItems([]);
    setSelectedCustomer(null);
    setSelectedTechnician(null);
    setSelectedWorkOrder(null);
    setCustomerSearch("");
    setCustomerSignature('');
    setTechnicianSignature('');
    setShowSignatures(false);
    setShowActions(false);
    setSavedReportId(null);
    setEditingReportId(null);
    setShowCreateForm(false);
    loadInitialData();
  };

  const startEditReport = async (report: ServiceReport) => {
    // Load materials for this report
    const { data: reportMaterials } = await supabase
      .from('service_report_materials')
      .select('*')
      .eq('report_id', report.id);

    // Populate form
    setFormData({
      intervention_type: report.intervention_type || '',
      description: report.description || '',
      work_performed: report.work_performed || '',
      materials_used: report.materials_used || '',
      notes: report.notes || '',
      intervention_date: report.intervention_date || new Date().toISOString().split('T')[0],
      start_time: report.start_time || '',
      end_time: report.end_time || '',
      amount: report.amount?.toString() || '',
      vat_rate: report.vat_rate?.toString() || '22',
      total_amount: report.total_amount?.toString() || '',
      kilometers: (report as any).kilometers?.toString() || '0'
    });

    // Set customer and technician
    if (report.customers) setSelectedCustomer(report.customers);
    if (report.technicians) setSelectedTechnician(report.technicians);

    // Set materials
    if (reportMaterials && reportMaterials.length > 0) {
      setMaterialItems(reportMaterials.map((m: any) => ({
        id: m.id,
        description: m.description,
        quantity: Number(m.quantity),
        unit_price: Number(m.unit_price),
        vat_rate: Number(m.vat_rate)
      })));
    } else {
      setMaterialItems([]);
    }

    // Set signatures
    setCustomerSignature(report.customer_signature || '');
    setTechnicianSignature(report.technician_signature || '');

    // Set technicians count
    const techCount = (report as any).technicians_count || 1;
    const headHours = (report as any).head_technician_hours || 0;
    const specHours = (report as any).specialized_technician_hours || 0;
    const totalHours = calculateHoursFromTime(report.start_time || '', report.end_time || '') || 1;
    const headCount = totalHours > 0 ? Math.round(headHours / totalHours) : 0;
    const specCount = totalHours > 0 ? Math.round(specHours / totalHours) : 0;
    const techList: Array<{ type: 'head' | 'specialized'; id: string }> = [];
    for (let i = 0; i < headCount; i++) techList.push({ type: 'head', id: crypto.randomUUID() });
    for (let i = 0; i < specCount; i++) techList.push({ type: 'specialized', id: crypto.randomUUID() });
    if (techList.length === 0 && techCount > 0) {
      for (let i = 0; i < techCount; i++) techList.push({ type: 'specialized', id: crypto.randomUUID() });
    }
    setTechniciansList(techList);

    setEditingReportId(report.id);
    setShowReportDetails(false);
    setShowCreateForm(true);
    setShowSignatures(false);
    setShowActions(false);
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
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button 
              variant="outline"
              onClick={() => setShowStatement(true)} 
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Estratto Conto
            </Button>
            <Button 
              variant="outline"
              onClick={() => setShowSettings(true)} 
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Settings className="w-4 h-4" />
              Prezzi Listino
            </Button>
            <Button 
              onClick={() => setShowCreateForm(true)} 
              className="w-full sm:w-auto flex items-center justify-center gap-2"
              size="lg"
            >
              <Plus className="w-5 h-5" />
              Nuovo Rapporto
            </Button>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      {showSettings && (
        <Card className="mb-6 border-0 sm:border shadow-none sm:shadow-sm">
          <CardHeader className="px-0 sm:px-6">
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Settings className="w-5 h-5" />
              Impostazioni Prezzi Listino
            </CardTitle>
            <CardDescription className="text-sm">
              Configura le tariffe per tecnici e chilometraggio
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 sm:px-6 space-y-6">
            {/* Tecnico Specializzato */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Tecnico Specializzato</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="spec_hourly">Tariffa Oraria (€/ora)</Label>
                  <Input
                    id="spec_hourly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.specialized_technician_hourly_rate}
                    onChange={(e) => setPricingSettings(prev => ({
                      ...prev,
                      specialized_technician_hourly_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="spec_km">Tariffa Km (€/km)</Label>
                  <Input
                    id="spec_km"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.specialized_technician_km_rate}
                    onChange={(e) => setPricingSettings(prev => ({
                      ...prev,
                      specialized_technician_km_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="h-12"
                  />
                </div>
              </div>
            </div>

            {/* Capo Tecnico */}
            <div className="space-y-4">
              <h3 className="font-semibold text-sm">Capo Tecnico</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="head_hourly">Tariffa Oraria (€/ora)</Label>
                  <Input
                    id="head_hourly"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.head_technician_hourly_rate}
                    onChange={(e) => setPricingSettings(prev => ({
                      ...prev,
                      head_technician_hourly_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="head_km">Tariffa Km (€/km)</Label>
                  <Input
                    id="head_km"
                    type="number"
                    step="0.01"
                    min="0"
                    value={pricingSettings.head_technician_km_rate}
                    onChange={(e) => setPricingSettings(prev => ({
                      ...prev,
                      head_technician_km_rate: parseFloat(e.target.value) || 0
                    }))}
                    className="h-12"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowSettings(false)}
                className="w-full sm:w-auto"
              >
                Annulla
              </Button>
              <Button
                onClick={saveSettings}
                disabled={settingsLoading}
                className="w-full sm:w-auto"
              >
                {settingsLoading ? "Salvando..." : "Salva Impostazioni"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                          {report.customers?.name || 'Cliente non specificato'}
                        </h3>
                        {report.customers?.company_name && (
                          <span className="text-xs sm:text-sm text-muted-foreground">
                            {report.customers.company_name}
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
              disabled={loading || !selectedCustomer?.email}
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
              <Popover open={workOrderSearchOpen} onOpenChange={setWorkOrderSearchOpen} modal={false}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={workOrderSearchOpen}
                    className="w-full h-12 justify-between text-base font-normal"
                  >
                    {selectedWorkOrder ? (
                      <span className="truncate">
                        {selectedWorkOrder.number} - {selectedWorkOrder.title} (CdL)
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Seleziona commessa...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[calc(100vw-24px)] sm:w-[500px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Cerca per numero o titolo..." 
                      value={workOrderSearch}
                      onValueChange={setWorkOrderSearch}
                    />
                    <CommandList>
                      <CommandEmpty>Nessuna commessa trovata</CommandEmpty>
                      <CommandGroup>
                        {filteredWorkOrders.map((workOrder) => (
                          <CommandItem
                            key={workOrder.id}
                            value={workOrder.id}
                            onSelect={() => {
                              handleWorkOrderSelect(workOrder.id);
                              setWorkOrderSearchOpen(false);
                              setWorkOrderSearch("");
                            }}
                            className="py-3"
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedWorkOrder?.id === workOrder.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">{workOrder.number} - {workOrder.title}</span>
                              <span className="text-xs text-muted-foreground">CdL</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedWorkOrder && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <h4 className="font-medium mb-1">{selectedWorkOrder.number} - {selectedWorkOrder.title}</h4>
                  <p className="text-muted-foreground text-xs">
                    Commessa di Lavoro
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
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen} modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={customerSearchOpen}
                      className="flex-1 h-12 justify-between text-base font-normal"
                    >
                      {selectedCustomer ? (
                        <span className="truncate">
                          {selectedCustomer.name}
                          {selectedCustomer.company_name && ` - ${selectedCustomer.company_name}`}
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
                        value={customerSearch}
                        onValueChange={setCustomerSearch}
                        className="h-12"
                      />
                      <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-6 text-center text-sm">
                          <p className="text-muted-foreground mb-2">Nessun cliente trovato</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCustomerSearchOpen(false);
                              setShowCreateCustomer(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Crea nuovo cliente
                          </Button>
                        </CommandEmpty>
                        <CommandGroup>
                          {filteredCustomers.map((customer) => (
                            <CommandItem
                              key={customer.id}
                              value={customer.id}
                              onSelect={() => {
                                handleCustomerSelect(customer.id);
                                setCustomerSearchOpen(false);
                                setCustomerSearch("");
                              }}
                              className="py-3 cursor-pointer"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedCustomer?.id === customer.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {customer.name}
                                </p>
                                <div className="flex gap-2 text-xs text-muted-foreground">
                                  {customer.company_name && <span className="truncate">{customer.company_name}</span>}
                                  {customer.email && <span className="truncate">• {customer.email}</span>}
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
                  onClick={() => setShowCreateCustomer(true)}
                  className="h-12 w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Nuovo
                </Button>
              </div>

              {selectedCustomer && (
                <div className="p-3 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{selectedCustomer.name}</p>
                  {selectedCustomer.company_name && <p className="text-muted-foreground">{selectedCustomer.company_name}</p>}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                    {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                    {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                    {selectedCustomer.address && <span className="w-full mt-1">{[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}</span>}
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
                  <Select value={selectedTechnician?.id || ""} onValueChange={handleTechnicianSelect}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Seleziona tecnico..." />
                    </SelectTrigger>
                    <SelectContent>
                      {technicians.length > 0 ? (
                        technicians.map((technician) => (
                          <SelectItem key={technician.id} value={technician.id} className="py-3">
                            {technician.first_name} {technician.last_name}
                          </SelectItem>
                        ))
                      ) : (
                        <div className="py-3 px-2 text-sm text-muted-foreground">Nessun tecnico trovato</div>
                      )}
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

              {/* Chilometri */}
              <div className="space-y-2">
                <Label htmlFor="kilometers" className="text-sm font-medium flex items-center gap-2">
                  <Car className="w-4 h-4" />
                  Chilometri
                </Label>
                <Input
                  id="kilometers"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.kilometers}
                  onChange={(e) => handleInputChange('kilometers', e.target.value)}
                  placeholder="0"
                  className="h-12 text-base"
                />
              </div>

              {/* Tecnici - Multiple */}
              <div className="space-y-3">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Tecnici Coinvolti
                </Label>
                
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTechnician('head')}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Capo Tecnico
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addTechnician('specialized')}
                    className="flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Tecnico Spec.
                  </Button>
                </div>

                {techniciansList.length > 0 && (
                  <div className="space-y-2">
                    {techniciansList.map((tech) => (
                      <div
                        key={tech.id}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <span className="text-sm font-medium">
                          {tech.type === 'head' ? '👷 Capo Tecnico' : '🔧 Tecnico Specializzato'}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTechnician(tech.id)}
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Riepilogo Costi */}
                {(formData.start_time && formData.end_time && techniciansList.length > 0) && (
                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">Riepilogo Costi Automatico</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>Ore: <span className="font-medium">{calculateHoursFromTime(formData.start_time, formData.end_time)}</span></div>
                      <div>Km: <span className="font-medium">{formData.kilometers}</span></div>
                      <div>Capi Tecnico: <span className="font-medium">{techniciansList.filter(t => t.type === 'head').length}</span></div>
                      <div>Tecnici Spec.: <span className="font-medium">{techniciansList.filter(t => t.type === 'specialized').length}</span></div>
                    </div>
                    <div className="mt-2 pt-2 border-t text-sm">
                      <span className="font-semibold">Totale Stimato: €{formData.amount || '0.00'}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="intervention_type" className="text-sm font-medium">Tipo Intervento *</Label>
                <Select value={formData.intervention_type || ""} onValueChange={(value) => handleInputChange('intervention_type', value)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Seleziona tipo..." />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-50">
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

              <MaterialsLineItems items={materialItems} onChange={setMaterialItems} />

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

          {/* Nota Fatturazione */}
          <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-muted/30">
            <CardContent className="px-0 sm:px-6 py-4">
              <p className="text-sm text-muted-foreground italic text-center">
                Seguirà fattura secondo listino intervento fuori contratto di manutenzione programmata
              </p>
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
              {editingReportId ? "Aggiorna Rapporto" : "Genera Rapporto"}
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

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground italic text-center">
                Seguirà fattura secondo listino intervento fuori contratto di manutenzione programmata
              </p>
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
                disabled={loading || (!editingReportId && (!customerSignature || !technicianSignature))}
                className="h-12 order-1 sm:order-2"
                size="lg"
              >
                {loading ? "Salvando..." : editingReportId ? "Aggiorna Rapporto" : "Salva Rapporto"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />

      <ReportDetailsDialog
        open={showReportDetails}
        onOpenChange={setShowReportDetails}
        report={selectedReport}
        onEdit={() => {
          if (selectedReport) startEditReport(selectedReport);
        }}
        onDelete={async () => {
          if (!selectedReport) return;
          if (!confirm('Sei sicuro di voler eliminare questo rapporto?')) return;
          try {
            await supabase.from('service_report_materials').delete().eq('report_id', selectedReport.id);
            await supabase.from('service_reports').delete().eq('id', selectedReport.id);
            setShowReportDetails(false);
            setSelectedReport(null);
            loadInitialData();
            toast({ title: "Rapporto eliminato", description: "Il rapporto è stato eliminato con successo" });
          } catch (error) {
            console.error('Error deleting report:', error);
            toast({ title: "Errore", description: "Errore nell'eliminazione del rapporto", variant: "destructive" });
          }
        }}
        onDownloadPDF={async () => {
          if (selectedReport) {
            // Load materials for this report
            const { data: reportMaterials } = await supabase
              .from('service_report_materials')
              .select('*')
              .eq('report_id', selectedReport.id);

            const doc = new jsPDF();
            let y = 20;
            const customer = selectedReport.customers;
            const technician = selectedReport.technicians;

            const logoImg = new Image();
            logoImg.src = '/images/logo-zapper.png';
            logoImg.onload = () => {
              doc.addImage(logoImg, 'PNG', 15, 10, 40, 15);
              
              doc.setFontSize(18);
              doc.setFont(undefined, "bold");
              doc.text("Rapporto di Intervento", 105, 20, { align: "center" });
              y = 35;

              // Report number
              if ((selectedReport as any).report_number) {
                doc.setFontSize(10);
                doc.setFont(undefined, "normal");
                doc.text(`N. ${(selectedReport as any).report_number}`, 195, 28, { align: "right" });
                doc.setFontSize(12);
              }

              doc.setFont(undefined, "bold");
              doc.text("Cliente:", 20, y);
              doc.setFont(undefined, "normal");
              y += 7;
              doc.text(customer?.name || 'N/A', 20, y);
              if (customer?.company_name) { y += 7; doc.text(customer.company_name, 20, y); }
              if (customer?.email) { y += 7; doc.text(`Email: ${customer.email}`, 20, y); }
              if (customer?.phone) { y += 7; doc.text(`Tel: ${customer.phone}`, 20, y); }
              if (customer?.address) { y += 7; doc.text(`Indirizzo: ${customer.address}`, 20, y); }
              y += 10;

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
              y += 7;
              const techCount = (selectedReport as any).technicians_count || 1;
              doc.text(`N. Tecnici presenti: ${techCount}`, 20, y);
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

              // Materiali da DB
              let matNettoTotal = 0;
              let matIvaTotal = 0;
              if (reportMaterials && reportMaterials.length > 0) {
                if (y > 200) { doc.addPage(); y = 20; }
                doc.setFont(undefined, "bold");
                doc.text("Materiali Utilizzati:", 20, y);
                y += 7;
                doc.setFontSize(9);
                doc.setFont(undefined, "bold");
                doc.text("Descrizione", 20, y);
                doc.text("Qtà", 120, y);
                doc.text("Prezzo", 140, y);
                doc.text("IVA", 165, y);
                doc.text("Totale", 180, y);
                y += 5;
                doc.line(20, y, 195, y);
                y += 3;
                doc.setFont(undefined, "normal");
                reportMaterials.forEach((item: any) => {
                  if (y > 270) { doc.addPage(); y = 20; }
                  const netto = item.quantity * item.unit_price;
                  const iva = netto * item.vat_rate / 100;
                  matNettoTotal += netto;
                  matIvaTotal += iva;
                  const descText = doc.splitTextToSize(item.description, 95);
                  doc.text(descText, 20, y);
                  doc.text(String(item.quantity), 120, y);
                  doc.text(item.unit_price > 0 ? `€${Number(item.unit_price).toFixed(2)}` : '-', 140, y);
                  doc.text(`${item.vat_rate}%`, 165, y);
                  doc.text(item.unit_price > 0 ? `€${(netto + iva).toFixed(2)}` : '-', 180, y);
                  y += descText.length * 5 + 2;
                });
                if (matNettoTotal > 0) {
                  y += 2;
                  doc.line(20, y, 195, y);
                  y += 5;
                  doc.setFont(undefined, "bold");
                  doc.text(`Netto: €${matNettoTotal.toFixed(2)}  |  IVA: €${matIvaTotal.toFixed(2)}  |  Totale: €${(matNettoTotal + matIvaTotal).toFixed(2)}`, 20, y);
                  y += 5;
                }
                doc.setFontSize(12);
                doc.setFont(undefined, "normal");
                y += 5;
              } else if (selectedReport.materials_used) {
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
              const netAmount = Number(selectedReport.amount) || 0;
              if (netAmount > 0 || matNettoTotal > 0) {
                if (y > 200) { doc.addPage(); y = 20; }
                y += 10;
                doc.setFont(undefined, "bold");
                doc.text("Dettagli Economici:", 20, y);
                doc.setFont(undefined, "normal");
                y += 7;

                const reportKm = (selectedReport as any).kilometers || 0;
                const headHours = (selectedReport as any).head_technician_hours || 0;
                const specHours = (selectedReport as any).specialized_technician_hours || 0;
                const laborCost = netAmount - matNettoTotal - (reportKm * pricingSettings.head_technician_km_rate);
                const kmCost = reportKm * pricingSettings.head_technician_km_rate;

                if (laborCost > 0) {
                  doc.text(`Manodopera: €${laborCost.toFixed(2)}`, 20, y); y += 7;
                }
                if (kmCost > 0) {
                  doc.text(`Rimborso Chilometrico (${reportKm} km): €${kmCost.toFixed(2)}`, 20, y); y += 7;
                }
                if (matNettoTotal > 0) {
                  doc.text(`Materiali: €${matNettoTotal.toFixed(2)}`, 20, y); y += 7;
                }

                doc.text(`Importo Netto Totale: €${netAmount.toFixed(2)}`, 20, y); y += 7;

                if (selectedReport.vat_rate) { doc.text(`IVA: ${Number(selectedReport.vat_rate).toFixed(2)}%`, 20, y); y += 7; }
                if (selectedReport.total_amount) {
                  doc.setFont(undefined, "bold");
                  doc.text(`Totale Complessivo: €${Number(selectedReport.total_amount).toFixed(2)}`, 20, y);
                  doc.setFont(undefined, "normal");
                  y += 10;
                }
              }

              // Listino Prezzi
              if (y > 180) { doc.addPage(); y = 20; }
              y += 5;
              doc.setFontSize(9);
              doc.setFont(undefined, "bold");
              doc.text("LISTINO PREZZI INTERVENTI FUORI CONTRATTO - 2026", 105, y, { align: "center" });
              y += 6;
              doc.setFontSize(8);
              doc.setFont(undefined, "normal");
              const listinoIntro2 = doc.splitTextToSize("Gli interventi tecnici richiesti al di fuori di un contratto di manutenzione programmata verranno gestiti secondo le seguenti condizioni:", 170);
              doc.text(listinoIntro2, 20, y);
              y += listinoIntro2.length * 4 + 3;

              doc.setFont(undefined, "bold");
              doc.text("Costo di chiamata: ", 20, y);
              doc.setFont(undefined, "normal");
              doc.text("€ 50,00+iva", 20 + doc.getTextWidth("Costo di chiamata: "), y);
              y += 4;
              doc.setFontSize(7);
              doc.text("*L'amministrazione si riserva la facoltà di azzerare il costo di chiamata", 20, y);
              y += 5;
              doc.setFontSize(8);

              doc.setFont(undefined, "bold");
              doc.text("Rimborso chilometrico: ", 20, y);
              doc.setFont(undefined, "normal");
              doc.text("€ 0,40+iva / km", 20 + doc.getTextWidth("Rimborso chilometrico: "), y);
              y += 4;
              const kmDesc2 = doc.splitTextToSize("calcolato sulla percorrenza andata e ritorno dal punto di partenza del tecnico.", 170);
              doc.text(kmDesc2, 20, y);
              y += kmDesc2.length * 4;
              doc.setFontSize(7);
              doc.text("*L'amministrazione si riserva la facoltà di azzerare il rimborso chilometrico", 20, y);
              y += 5;
              doc.setFontSize(8);

              doc.setFont(undefined, "bold");
              doc.text("Costo dell'intervento: ", 20, y);
              doc.setFont(undefined, "normal");
              doc.text("€ 40,00+iva / ora per singolo tecnico", 20 + doc.getTextWidth("Costo dell'intervento: "), y);
              y += 5;

              doc.setFont(undefined, "bold");
              doc.text("Materiali utilizzati: ", 20, y);
              doc.setFont(undefined, "normal");
              doc.text("addebitati in base alle quantità impiegate", 20 + doc.getTextWidth("Materiali utilizzati: "), y);
              y += 6;

              const closingLines2 = doc.splitTextToSize("Al termine dell'intervento verrà rilasciato un rapporto di intervento riepilogativo delle attività svolte. Se non comunicato a termine lavoro, il corrispettivo verrà indicato nella fattura emessa successivamente all'intervento.", 170);
              doc.text(closingLines2, 20, y);
              y += closingLines2.length * 4 + 2;
              doc.setFontSize(12);

              // Firme
              if (y > 220) { doc.addPage(); y = 20; }
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

              const pageHeight = doc.internal.pageSize.height;
              doc.setFontSize(8);
              doc.setFont(undefined, "normal");
              doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
              doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
              doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });
              doc.text("www.abbattitorizapper.it  08119968436", 105, pageHeight - 8, { align: "center" });

              const fileName = `rapporto_intervento_${selectedReport.intervention_date}_${customer?.name?.replace(/\s+/g, '_') || 'report'}.pdf`;
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
          
          const customer = selectedReport.customers;
          const technician = selectedReport.technicians;

          if (!customer?.email) {
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
                to: customer.email,
                subject: `Rapporto di Intervento - ${new Date(selectedReport.intervention_date).toLocaleDateString('it-IT')}`,
                recipientName: customer.name,
                message: `Gentile ${customer.name},\n\nin allegato trovi il rapporto di intervento del ${new Date(selectedReport.intervention_date).toLocaleDateString('it-IT')}.\n\nTipo intervento: ${selectedReport.intervention_type}\nTecnico: ${technician?.first_name} ${technician?.last_name}\n\n${selectedReport.work_performed ? `Lavori eseguiti:\n${selectedReport.work_performed}\n\n` : ''}Grazie per averci scelto.\n\nCordiali saluti`,
                reportData: selectedReport
              }
            });

            if (error) throw error;

            toast({
              title: "Email Inviata",
              description: `Il rapporto è stato inviato a ${customer.email}`,
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

      <CustomerStatementDialog
        open={showStatement}
        onOpenChange={setShowStatement}
        customers={customers}
      />
    </div>
  );
}
