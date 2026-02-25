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
import { 
  ArrowLeft, Plus, Check, ChevronsUpDown, Download, Mail, Loader2, 
  ChevronRight, CheckCircle2, Trash2, Clock, MapPin, 
  Wrench, FileText, Users, Euro, ChevronDown, Building2, Pencil, Save
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  customer_name?: string;
  type: 'service' | 'production';
}

type Step = "form" | "signatures" | "done";

function MobileSection({ 
  title, icon: Icon, children, defaultOpen = true, badge 
}: { 
  title: string; 
  icon: React.ElementType; 
  children: React.ReactNode; 
  defaultOpen?: boolean;
  badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-muted/50 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <span className="font-semibold text-sm flex-1">{title}</span>
        {badge && (
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{badge}</span>
        )}
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

export default function ZAppNewServiceReportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("form");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editCustomerData, setEditCustomerData] = useState<Partial<Customer>>({});
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savedReportId, setSavedReportId] = useState<string | null>(null);
  const [techniciansList, setTechniciansList] = useState<Array<{ type: 'head' | 'specialized'; id: string; technicianId: string }>>([]);
  const [showAddTechnician, setShowAddTechnician] = useState(false);
  const [addTechType, setAddTechType] = useState<'head' | 'specialized'>('specialized');

  // Derive "main" technician from the first in the list
  const selectedTechnician = techniciansList.length > 0
    ? technicians.find(t => t.id === techniciansList[0].technicianId) || null
    : null;
  const [pricingSettings, setPricingSettings] = useState({
    specialized_technician_hourly_rate: 40,
    specialized_technician_km_rate: 0.40,
    head_technician_hourly_rate: 60,
    head_technician_km_rate: 0.60
  });
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
  const [customerSignature, setCustomerSignature] = useState('');
  const [technicianSignature, setTechnicianSignature] = useState('');
  const [materialItems, setMaterialItems] = useState<MaterialItem[]>([]);
  const [isQuotedOrder, setIsQuotedOrder] = useState(false);
  const [isWarranty, setIsWarranty] = useState(false);
  const [isMaintenanceContract, setIsMaintenanceContract] = useState(false);
  const [departureCity, setDepartureCity] = useState('Scafati (SA)');
  const [destinationCity, setDestinationCity] = useState('');
  const [calculatingKm, setCalculatingKm] = useState(false);
  const [kmAutoCalculated, setKmAutoCalculated] = useState(false);

  // Auto-calculate km when cities change
  useEffect(() => {
    if (!departureCity.trim() || !destinationCity.trim()) return;
    const timer = setTimeout(async () => {
      setCalculatingKm(true);
      try {
        // Geocode cities with resilient fallbacks (Nominatim -> Photon)
        const normalizeCity = (city: string) => {
          // Just use the city name without province code for better geocoding
          const cleanCity = city.replace(/\s*\([^)]*\)\s*/g, '').trim();
          return `${cleanCity}, Italia`;
        };

        const geocode = async (city: string) => {
          const searchQuery = normalizeCity(city);
          const rawQuery = city.trim();

          // 1) Nominatim with User-Agent
          for (const q of [searchQuery, rawQuery]) {
            try {
              const res = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&countrycodes=it`,
                { headers: { 'Accept': 'application/json' } }
              );
              if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                  const best = data.find((r: any) => ['city', 'town', 'village', 'municipality'].includes(r.type)) || data[0];
                  return { lat: parseFloat(best.lat), lon: parseFloat(best.lon), name: best.display_name };
                }
              }
            } catch {
              // try next
            }
          }

          // 2) Photon (komoot) fallback
          for (const q of [searchQuery, rawQuery]) {
            try {
              const photonRes = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5&lang=it`);
              if (photonRes.ok) {
                const photonData = await photonRes.json();
                const feature = photonData?.features?.[0];
                if (feature?.geometry?.coordinates?.length >= 2) {
                  const [lon, lat] = feature.geometry.coordinates;
                  return { lat: Number(lat), lon: Number(lon), name: feature?.properties?.name || city };
                }
              }
            } catch {
              // try next
            }
          }

          // 3) Well-known Italian cities hardcoded fallback
          const knownCities: Record<string, { lat: number; lon: number }> = {
            'scafati': { lat: 40.7537, lon: 14.5282 },
            'roma': { lat: 41.9028, lon: 12.4964 },
            'milano': { lat: 45.4642, lon: 9.1900 },
            'napoli': { lat: 40.8518, lon: 14.2681 },
            'torino': { lat: 45.0703, lon: 7.6869 },
            'palermo': { lat: 38.1157, lon: 13.3615 },
            'firenze': { lat: 43.7696, lon: 11.2558 },
            'bologna': { lat: 44.4949, lon: 11.3426 },
            'bari': { lat: 41.1171, lon: 16.8719 },
            'salerno': { lat: 40.6824, lon: 14.7681 },
            'angri': { lat: 40.7382, lon: 14.5694 },
            'pompei': { lat: 40.7462, lon: 14.5006 },
            'castellammare di stabia': { lat: 40.6946, lon: 14.4831 },
            'nocera inferiore': { lat: 40.7460, lon: 14.6369 },
            'pagani': { lat: 40.7428, lon: 14.6153 },
            'sarno': { lat: 40.8109, lon: 14.6196 },
            'cava de tirreni': { lat: 40.7015, lon: 14.7063 },
          };
          const cityLower = rawQuery.replace(/\s*\([^)]*\)\s*/g, '').trim().toLowerCase();
          const known = knownCities[cityLower];
          if (known) {
            return { lat: known.lat, lon: known.lon, name: rawQuery };
          }

          throw new Error(`Impossibile geolocalizzare "${city}"`);
        };

        const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
          const toRad = (v: number) => (v * Math.PI) / 180;
          const R = 6371;
          const dLat = toRad(lat2 - lat1);
          const dLon = toRad(lon2 - lon1);
          const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        const [from, to] = await Promise.all([geocode(departureCity), geocode(destinationCity)]);

        // Prefer route distance, fallback to straight-line distance
        try {
          const routeRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`);
          const routeData = await routeRes.json();
          if (routeData.code === 'Ok' && routeData.routes.length > 0) {
            const oneWayKm = Math.round(routeData.routes[0].distance / 1000);
            const roundTripKm = oneWayKm * 2;
            handleInputChange('kilometers', roundTripKm.toString());
            setKmAutoCalculated(true);
          } else {
            throw new Error('Route API non disponibile');
          }
        } catch {
          const oneWayKmApprox = Math.max(1, Math.round(haversineKm(from.lat, from.lon, to.lat, to.lon) * 1.25));
          const roundTripKmApprox = oneWayKmApprox * 2;
          handleInputChange('kilometers', roundTripKmApprox.toString());
          setKmAutoCalculated(true);
          toast.warning('Calcolo km approssimato (servizio mappe temporaneamente non disponibile)');
        }
      } catch (err: any) {
        console.error("Km calc error:", err);
        toast.error(err.message || "Errore nel calcolo km");
      } finally {
        setCalculatingKm(false);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [departureCity, destinationCity]);

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
      const [customersRes, techniciansRes, serviceOrdersRes, productionOrdersRes, settingsRes] = await Promise.all([
        supabase.from('customers')
          .select('id, name, email, phone, company_name, address, city, province, postal_code, country, tax_id, pec, sdi_code, shipping_address')
          .order('company_name', { ascending: true, nullsFirst: false }).order('name'),
        supabase.from('technicians')
          .select('id, first_name, last_name, employee_code')
          .eq('active', true).order('first_name'),
        supabase.from('service_work_orders')
          .select('id, number, title, description, customer_id, customers(name, company_name)')
          .eq('archived', false)
          .not('status', 'in', '("completata","archiviata","annullata")')
          .order('number', { ascending: false }),
        supabase.from('work_orders')
          .select('id, number, title, description, customer_id, customers(name, company_name)')
          .eq('archived', false)
          .order('number', { ascending: false }),
        supabase.from('service_report_settings')
          .select('setting_key, setting_value')
      ]);
      setCustomers(customersRes.data || []);
      setTechnicians(techniciansRes.data || []);

      const serviceOrders: WorkOrder[] = (serviceOrdersRes.data || []).map((wo: any) => ({
        id: wo.id,
        number: wo.number,
        title: wo.title,
        description: wo.description,
        customer_id: wo.customer_id,
        customer_name: wo.customers?.company_name || wo.customers?.name || '',
        type: 'service' as const,
      }));

      const productionOrders: WorkOrder[] = (productionOrdersRes.data || []).map((wo: any) => ({
        id: wo.id,
        number: wo.number,
        title: wo.title,
        description: wo.description,
        customer_id: wo.customer_id,
        customer_name: wo.customers?.company_name || wo.customers?.name || '',
        type: 'production' as const,
      }));

      setWorkOrders([...serviceOrders, ...productionOrders]);
      if (settingsRes.data) {
        const newSettings: Record<string, number> = {};
        settingsRes.data.forEach((s: { setting_key: string; setting_value: number }) => {
          newSettings[s.setting_key] = s.setting_value;
        });
        setPricingSettings(prev => ({ ...prev, ...newSettings }));
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error("Errore nel caricamento dei dati");
    }
  };

  const calculateHoursFromTime = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    let diffMinutes = endMinutes - startMinutes;
    if (diffMinutes <= 0) return 1;
    return Math.max(1, Math.ceil(diffMinutes / 60));
  };

  const materialsTotalNetto = materialItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  const getTechRate = (technicianId: string): number => {
    const t = technicians.find(tc => tc.id === technicianId);
    if (t && t.first_name.toLowerCase() === 'pasquale') return 60;
    return 40;
  };

  const KM_RATE = 0.40; // €/km + IVA
  const CALLOUT_FEE = 40.00; // € + IVA
  const LOCAL_AREA_ONE_WAY_KM = 15;

  const isLocalArea = (totalKmRoundTrip: number) => (totalKmRoundTrip / 2) <= LOCAL_AREA_ONE_WAY_KM;

  const calculateAmount = (techs: typeof techniciansList, startTime: string, endTime: string, km: number, matTotal: number = materialsTotalNetto) => {
    const hours = calculateHoursFromTime(startTime, endTime);
    const techCost = techs.reduce((sum, t) => sum + hours * getTechRate(t.technicianId), 0);
    const kmCost = km * KM_RATE;
    const calloutCost = isLocalArea(km) ? 0 : CALLOUT_FEE;
    return techCost + kmCost + calloutCost + matTotal;
  };

  useEffect(() => {
    if (isQuotedOrder) return;
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
      if (!isQuotedOrder && (['kilometers', 'start_time', 'end_time'].includes(field) || field === 'amount' || field === 'vat_rate')) {
        const km = parseFloat(field === 'kilometers' ? value : newData.kilometers) || 0;
        const startTime = field === 'start_time' ? value : newData.start_time;
        const endTime = field === 'end_time' ? value : newData.end_time;
        const calculatedAmount = calculateAmount(techniciansList, startTime, endTime, km);
        if (!prev.amount || ['kilometers', 'start_time', 'end_time'].includes(field)) {
          newData.amount = calculatedAmount.toFixed(2);
        }
      }
      const amount = parseFloat(newData.amount) || 0;
      const vatRate = parseFloat(newData.vat_rate) || 0;
      newData.total_amount = (amount + (amount * vatRate / 100)).toFixed(2);
      return newData;
    });
  };

  const addTechnicianToList = (technicianId: string) => {
    const newTech = { type: 'specialized' as const, id: crypto.randomUUID(), technicianId };
    const newList = [...techniciansList, newTech];
    setTechniciansList(newList);
    if (!isQuotedOrder) {
      const km = parseFloat(formData.kilometers) || 0;
      const calculatedAmount = calculateAmount(newList, formData.start_time, formData.end_time, km);
      setFormData(prev => {
        const vatRate = parseFloat(prev.vat_rate) || 0;
        const total = calculatedAmount + (calculatedAmount * vatRate / 100);
        return { ...prev, amount: calculatedAmount.toFixed(2), total_amount: total.toFixed(2) };
      });
    }
  };

  const removeTechnician = (id: string) => {
    const newList = techniciansList.filter(t => t.id !== id);
    setTechniciansList(newList);
    if (!isQuotedOrder) {
      const km = parseFloat(formData.kilometers) || 0;
      const calculatedAmount = calculateAmount(newList, formData.start_time, formData.end_time, km);
      setFormData(prev => {
        const vatRate = parseFloat(prev.vat_rate) || 0;
        const total = calculatedAmount + (calculatedAmount * vatRate / 100);
        return { ...prev, amount: calculatedAmount.toFixed(2), total_amount: total.toFixed(2) };
      });
    }
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomer(customers.find(c => c.id === customerId) || null);
    setCustomerSearchOpen(false);
  };

  const handleWorkOrderSelect = (workOrderId: string) => {
    const wo = workOrders.find(w => w.id === workOrderId);
    setSelectedWorkOrder(wo || null);
    if (wo) {
      setFormData(prev => ({ ...prev, work_performed: wo.description || prev.work_performed, notes: wo.title || prev.notes }));
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

  const openEditCustomer = () => {
    if (!selectedCustomer) return;
    setEditCustomerData({ ...selectedCustomer });
    setShowEditCustomer(true);
  };

  const handleSaveCustomer = async () => {
    if (!selectedCustomer || !editCustomerData.name?.trim()) {
      toast.error("Il nome è obbligatorio");
      return;
    }
    setSavingCustomer(true);
    try {
      const updatePayload: Record<string, any> = {};
      const fields: (keyof Customer)[] = ['name', 'company_name', 'email', 'phone', 'address', 'city', 'province', 'postal_code', 'country', 'tax_id', 'pec', 'sdi_code', 'shipping_address'];
      fields.forEach(f => { updatePayload[f] = editCustomerData[f] || null; });

      const { error } = await supabase.from('customers').update(updatePayload).eq('id', selectedCustomer.id);
      if (error) throw error;

      const updatedCustomer = { ...selectedCustomer, ...updatePayload } as Customer;
      setSelectedCustomer(updatedCustomer);
      setCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      setShowEditCustomer(false);
      toast.success("Cliente aggiornato");
    } catch (error) {
      console.error('Error updating customer:', error);
      toast.error("Errore nell'aggiornamento del cliente");
    } finally {
      setSavingCustomer(false);
    }
  };

  const goToSignatures = () => {
    if (!selectedCustomer || !formData.intervention_type || techniciansList.length === 0) {
      toast.error("Seleziona almeno cliente, tipo intervento e un tecnico");
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
      const reportPayload = {
        customer_id: selectedCustomer?.id,
        technician_id: selectedTechnician?.id,
        work_order_id: selectedWorkOrder?.type === 'service' ? selectedWorkOrder.id : null,
        production_work_order_id: selectedWorkOrder?.type === 'production' ? selectedWorkOrder.id : null,
        intervention_type: formData.intervention_type,
        description: formData.description || null,
        work_performed: formData.work_performed,
        materials_used: formData.materials_used,
        notes: isQuotedOrder ? `[COMMESSA GIÀ QUOTATA] ${formData.notes || ''}`.trim() : formData.notes,
        technician_name: selectedTechnician ? `${selectedTechnician.first_name} ${selectedTechnician.last_name}` : '',
        intervention_date: formData.intervention_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        amount: isQuotedOrder ? 0 : (formData.amount ? parseFloat(formData.amount) : null),
        vat_rate: isQuotedOrder ? 0 : (formData.vat_rate ? parseFloat(formData.vat_rate) : null),
        total_amount: isQuotedOrder ? 0 : (formData.total_amount ? parseFloat(formData.total_amount) : null),
        customer_signature: customerSignature,
        technician_signature: technicianSignature,
        status: 'completed' as const,
        technicians_count: techniciansList.length || 1,
        kilometers: parseFloat(formData.kilometers) || 0,
        head_technician_hours: calculateHoursFromTime(formData.start_time, formData.end_time) * techniciansList.filter(t => { const tc = technicians.find(x => x.id === t.technicianId); return tc && tc.first_name.toLowerCase() === 'pasquale'; }).length,
        specialized_technician_hours: calculateHoursFromTime(formData.start_time, formData.end_time) * techniciansList.filter(t => { const tc = technicians.find(x => x.id === t.technicianId); return !tc || tc.first_name.toLowerCase() !== 'pasquale'; }).length,
        is_warranty: isWarranty,
        is_maintenance_contract: isMaintenanceContract
      };

      const { data, error } = await supabase.from('service_reports').insert(reportPayload).select().single();
      if (error) throw error;

      if (materialItems.length > 0) {
        const materialsToInsert = materialItems.filter(m => m.description.trim()).map(m => ({
          report_id: data.id, description: m.description, quantity: m.quantity, unit_price: m.unit_price, vat_rate: m.vat_rate
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
      if (selectedCustomer.address) { y += 7; doc.text(`Indirizzo: ${[selectedCustomer.address, selectedCustomer.city].filter(Boolean).join(', ')}`, 20, y); }
      y += 10;
      if (selectedWorkOrder) {
        doc.setFont(undefined!, "bold");
        doc.text("Commessa di Lavoro:", 20, y);
        doc.setFont(undefined!, "normal");
        y += 7;
        doc.text(`${selectedWorkOrder.number} - ${selectedWorkOrder.title}`, 20, y);
        y += 10;
      }
      doc.setFont(undefined!, "bold");
      doc.text("Dettagli Intervento:", 20, y);
      doc.setFont(undefined!, "normal");
      y += 7;
      doc.text(`Data: ${formData.intervention_date}`, 20, y); y += 7;
      if (formData.start_time && formData.end_time) { doc.text(`Orario: ${formData.start_time} - ${formData.end_time}`, 20, y); y += 7; }
      doc.text(`Tipo: ${formData.intervention_type}`, 20, y); y += 7;
      doc.text(`Tecnico: ${selectedTechnician.first_name} ${selectedTechnician.last_name}`, 20, y); y += 7;
      doc.text(`N. Tecnici presenti: ${techniciansList.length || 1}`, 20, y); y += 7;
      if (parseFloat(formData.kilometers) > 0) { doc.text(`Km percorsi: ${formData.kilometers}`, 20, y); y += 7; }
      y += 3;
      if (formData.description) {
        doc.setFont(undefined!, "bold"); doc.text("Descrizione Problema:", 20, y); doc.setFont(undefined!, "normal"); y += 7;
        const lines = doc.splitTextToSize(formData.description, 170); doc.text(lines, 20, y); y += lines.length * 7 + 3;
      }
      if (formData.work_performed) {
        doc.setFont(undefined!, "bold"); doc.text("Lavori Eseguiti:", 20, y); doc.setFont(undefined!, "normal"); y += 7;
        const lines = doc.splitTextToSize(formData.work_performed, 170); doc.text(lines, 20, y); y += lines.length * 7 + 3;
      }
      if (materialItems.length > 0 && materialItems.some(m => m.description.trim())) {
        if (y > 200) { doc.addPage(); y = 20; }
        doc.setFont(undefined!, "bold"); doc.text("Materiali Utilizzati:", 20, y); y += 7;
        doc.setFontSize(9); doc.setFont(undefined!, "bold");
        doc.text("Descrizione", 20, y); doc.text("Qtà", 120, y); doc.text("Prezzo", 140, y); doc.text("IVA", 165, y); doc.text("Totale", 180, y);
        y += 5; doc.line(20, y, 195, y); y += 3; doc.setFont(undefined!, "normal");
        let matNettoTotal = 0; let matIvaTotal = 0;
        materialItems.filter(m => m.description.trim()).forEach(item => {
          if (y > 270) { doc.addPage(); y = 20; }
          const netto = item.quantity * item.unit_price; const iva = netto * item.vat_rate / 100;
          matNettoTotal += netto; matIvaTotal += iva;
          const descText = doc.splitTextToSize(item.description, 95);
          doc.text(descText, 20, y); doc.text(String(item.quantity), 120, y);
          doc.text(item.unit_price > 0 ? `€${item.unit_price.toFixed(2)}` : '-', 140, y);
          doc.text(`${item.vat_rate}%`, 165, y);
          doc.text(item.unit_price > 0 ? `€${(netto + iva).toFixed(2)}` : '-', 180, y);
          y += descText.length * 5 + 2;
        });
        if (matNettoTotal > 0) {
          y += 2; doc.line(20, y, 195, y); y += 5; doc.setFont(undefined!, "bold");
          doc.text(`Netto: €${matNettoTotal.toFixed(2)}  |  IVA: €${matIvaTotal.toFixed(2)}  |  Totale: €${(matNettoTotal + matIvaTotal).toFixed(2)}`, 20, y);
          y += 5;
        }
        doc.setFontSize(12); doc.setFont(undefined!, "normal"); y += 5;
      }
      if (formData.notes) {
        doc.setFont(undefined!, "bold"); doc.text("Note:", 20, y); doc.setFont(undefined!, "normal"); y += 7;
        const lines = doc.splitTextToSize(formData.notes, 170); doc.text(lines, 20, y); y += lines.length * 7 + 3;
      }
      if (formData.amount) {
        if (y > 220) { doc.addPage(); y = 20; }
        y += 10; doc.setFont(undefined!, "bold"); doc.text("Dettagli Economici:", 20, y); doc.setFont(undefined!, "normal"); y += 7;
        doc.text(`Importo: €${parseFloat(formData.amount).toFixed(2)}`, 20, y); y += 7;
        doc.text(`IVA: ${parseFloat(formData.vat_rate).toFixed(2)}%`, 20, y); y += 7;
        doc.setFont(undefined!, "bold"); doc.text(`Totale: €${parseFloat(formData.total_amount).toFixed(2)}`, 20, y); y += 10;
      }
      if (y > 210) { doc.addPage(); y = 20; }
      y += 5; doc.setFontSize(8); doc.setFont(undefined!, "bold"); doc.text("TERMINI E CONDIZIONI", 20, y); y += 5; doc.setFont(undefined!, "normal");
      const tcLines = [
        "1. Costo manodopera: le tariffe orarie sono calcolate secondo il listino vigente, con minimo di 1 ora per intervento.",
        "2. Costi chilometrici: il rimborso chilometrico viene calcolato dalla sede operativa al luogo dell'intervento (andata e ritorno).",
        "3. Diritto di chiamata: ogni intervento prevede un diritto fisso di chiamata come da listino.",
        "4. Materiali: i materiali utilizzati vengono fatturati separatamente secondo listino, salvo diverso accordo scritto.",
        "5. Orari straordinari: interventi in orario notturno, festivo o prefestivo prevedono una maggiorazione secondo listino.",
        "6. Pagamento: salvo diversi accordi, il pagamento è da effettuarsi entro 30 giorni dalla data di emissione della fattura.",
        "7. Garanzia lavori: i lavori eseguiti sono garantiti per 12 mesi dalla data dell'intervento, salvo usura normale.",
      ];
      tcLines.forEach(line => {
        if (y > 275) { doc.addPage(); y = 20; }
        const wrapped = doc.splitTextToSize(line, 170); doc.text(wrapped, 20, y); y += wrapped.length * 4 + 1;
      });
      doc.setFontSize(12);
      if (y > 220) { doc.addPage(); y = 20; }
      y += 10; doc.setFont(undefined!, "bold");
      doc.text("Firma Cliente:", 20, y); doc.text("Firma Tecnico:", 110, y);
      if (customerSignature) doc.addImage(customerSignature, "PNG", 20, y + 5, 70, 30);
      if (technicianSignature) doc.addImage(technicianSignature, "PNG", 110, y + 5, 70, 30);
      const pageHeight = doc.internal.pageSize.height;
      doc.setFontSize(8); doc.setFont(undefined!, "normal");
      doc.text("CLIMATEL DI ELEFANTE Pasquale", 105, pageHeight - 20, { align: "center" });
      doc.text("Via G. Ferraris n° 24 - 84018 SCAFATI (SA) - Italia", 105, pageHeight - 16, { align: "center" });
      doc.text("C.F. LFNPQL67L02I483U P.Iva 03895390650", 105, pageHeight - 12, { align: "center" });
      doc.text("www.abbattitorizapper.it  08119968436", 105, pageHeight - 8, { align: "center" });
      const fileName = `rapporto_${formData.intervention_date}_${selectedCustomer.name.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      toast.success("PDF scaricato");
    };
  };

  const [overrideEmail, setOverrideEmail] = useState('');

  const sendEmail = async () => {
    const emailToUse = overrideEmail.trim() || selectedCustomer?.email;
    if (!emailToUse) { toast.error("Inserisci un indirizzo email"); return; }
    setLoading(true);
    try {
      // If user provided a new email, update the customer record
      if (overrideEmail.trim() && selectedCustomer && overrideEmail.trim() !== selectedCustomer.email) {
        await supabase.from('customers').update({ email: overrideEmail.trim() }).eq('id', selectedCustomer.id);
      }
      const { error } = await supabase.functions.invoke('send-customer-emails', {
        body: {
          to: emailToUse,
          subject: `Rapporto di Intervento - ${formData.intervention_date}`,
          recipientName: selectedCustomer.name,
          message: `Gentile ${selectedCustomer.name},\n\nin allegato trovi il rapporto di intervento del ${formData.intervention_date}.\n\nTipo intervento: ${formData.intervention_type}\nTecnico: ${selectedTechnician?.first_name} ${selectedTechnician?.last_name}\n\n${formData.work_performed ? `Lavori eseguiti:\n${formData.work_performed}\n\n` : ''}Cordiali saluti`,
          reportData: { customer: selectedCustomer, technician: selectedTechnician, formData, customerSignature, technicianSignature, workOrder: selectedWorkOrder }
        }
      });
      if (error) throw error;
      toast.success(`Email inviata a ${emailToUse}`);
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error("Errore nell'invio dell'email");
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = ["form", "signatures", "done"];
  const currentIdx = steps.indexOf(step);

  const interventionTypes = [
    { value: 'installazione', label: 'Installazione', icon: '🔧' },
    { value: 'manutenzione', label: 'Manutenzione', icon: '⚙️' },
    { value: 'riparazione', label: 'Riparazione', icon: '🔩' },
    { value: 'sopralluogo', label: 'Sopralluogo', icon: '👁️' },
    { value: 'collaudo', label: 'Collaudo', icon: '✅' },
    { value: 'formazione', label: 'Formazione', icon: '📚' },
    { value: 'altro', label: 'Altro', icon: '📋' },
  ];

  const calculatedHours = calculateHoursFromTime(formData.start_time, formData.end_time);

  return (
    <div className="flex flex-col min-h-screen bg-muted/40">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-blue-600 text-white safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 shrink-0 h-10 w-10 rounded-xl"
            onClick={() => {
              if (step === "signatures") setStep("form");
              else navigate("/hr/z-app/rapporti");
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Nuovo Rapporto</h1>
            <div className="flex items-center gap-2 mt-0.5">
              {steps.filter(s => s !== "done").map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    i < currentIdx ? "bg-white text-blue-600" :
                    i === currentIdx ? "bg-white text-blue-600 ring-2 ring-white/50 ring-offset-1 ring-offset-blue-600" :
                    "bg-white/30 text-white/70"
                  )}>
                    {i < currentIdx ? <Check className="h-3 w-3" /> : i + 1}
                  </div>
                  <span className={cn("text-[10px] font-medium", i === currentIdx ? "text-white" : "text-white/60")}>
                    {s === "form" ? "Dati" : "Firme"}
                  </span>
                  {i < 1 && <div className={cn("w-6 h-[2px] mx-1", i < currentIdx ? "bg-white" : "bg-white/30")} />}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-3 py-4 pb-28 space-y-3">
        {step === "form" && (
          <>
            {/* Intervention Type - tap cards */}
            <div className="bg-background rounded-xl border shadow-sm p-4">
              <Label className="text-xs font-medium text-muted-foreground mb-2 block">Tipo Intervento *</Label>
              <div className="grid grid-cols-4 gap-2">
                {interventionTypes.slice(0, 4).map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleInputChange('intervention_type', t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center active:scale-95",
                      formData.intervention_type === t.value
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-transparent bg-muted/50"
                    )}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {interventionTypes.slice(4).map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleInputChange('intervention_type', t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all text-center active:scale-95",
                      formData.intervention_type === t.value
                        ? "border-blue-500 bg-blue-50 shadow-sm"
                        : "border-transparent bg-muted/50"
                    )}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className="text-[10px] font-medium leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Checkbox commessa già quotata */}
              {formData.intervention_type && (
                <div className="mt-3 flex items-start gap-3 p-3 rounded-xl bg-muted/50 border">
                  <input
                    type="checkbox"
                    id="isQuotedOrder"
                    checked={isQuotedOrder}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIsQuotedOrder(checked);
                      if (checked) {
                        setFormData(prev => ({ ...prev, amount: '0', total_amount: '0' }));
                      } else {
                        const km = parseFloat(formData.kilometers) || 0;
                        const calc = calculateAmount(techniciansList, formData.start_time, formData.end_time, km);
                        const vatRate = parseFloat(formData.vat_rate) || 0;
                        setFormData(prev => ({ ...prev, amount: calc.toFixed(2), total_amount: (calc + calc * vatRate / 100).toFixed(2) }));
                      }
                    }}
                    className="mt-0.5 h-5 w-5 rounded border-primary text-primary accent-primary shrink-0"
                  />
                  <label htmlFor="isQuotedOrder" className="text-xs leading-snug">
                    <span className="font-semibold">Oggetto di commessa già quotata</span>
                    <br />
                    <span className="text-muted-foreground">L'intervento è compreso in una commessa con importi già definiti. Non verranno generati importi aggiuntivi.</span>
                  </label>
                </div>
              )}

              {/* Checkbox garanzia e contratto manutenzione - solo per manutenzione/riparazione */}
              {(formData.intervention_type === 'manutenzione' || formData.intervention_type === 'riparazione') && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border">
                    <input
                      type="checkbox"
                      id="isWarranty"
                      checked={isWarranty}
                      onChange={(e) => setIsWarranty(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-primary text-primary accent-primary shrink-0"
                    />
                    <label htmlFor="isWarranty" className="text-xs leading-snug">
                      <span className="font-semibold">🛡️ In garanzia</span>
                      <br />
                      <span className="text-muted-foreground">L'intervento è coperto dalla garanzia del prodotto.</span>
                    </label>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 border">
                    <input
                      type="checkbox"
                      id="isMaintenanceContract"
                      checked={isMaintenanceContract}
                      onChange={(e) => setIsMaintenanceContract(e.target.checked)}
                      className="mt-0.5 h-5 w-5 rounded border-primary text-primary accent-primary shrink-0"
                    />
                    <label htmlFor="isMaintenanceContract" className="text-xs leading-snug">
                      <span className="font-semibold">📋 Contratto di manutenzione</span>
                      <br />
                      <span className="text-muted-foreground">L'intervento rientra in un contratto di manutenzione attivo.</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Customer & Work Order */}
            <MobileSection title="Cliente & Commessa" icon={Building2} badge={selectedCustomer ? "✓" : undefined}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Commessa (opzionale)</Label>
                <Select onValueChange={handleWorkOrderSelect}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Seleziona commessa..." /></SelectTrigger>
                  <SelectContent>
                    {workOrders.map(wo => (
                      <SelectItem key={wo.id} value={wo.id}>
                        {wo.customer_name ? `${wo.customer_name} - ` : ''}{wo.title || wo.number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Cliente *</Label>
                <div className="flex gap-2">
                  <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className={cn("flex-1 justify-between h-11 rounded-xl text-sm", selectedCustomer && "border-blue-300 bg-blue-50/50")}
                      >
                        <span className="truncate">{selectedCustomer ? (selectedCustomer.company_name || selectedCustomer.name) : "Cerca cliente..."}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-3rem)] p-0 z-[200]" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Cerca per nome, azienda, email, telefono..." value={customerSearch} onValueChange={setCustomerSearch} className="h-12" />
                        <CommandList>
                          <CommandEmpty>Nessun cliente trovato</CommandEmpty>
                          <CommandGroup className="max-h-60 overflow-auto">
                            {filteredCustomers.map(c => (
                              <CommandItem 
                                key={c.id} 
                                value={c.id} 
                                onSelect={() => handleCustomerSelect(c.id)} 
                                className="py-3"
                              >
                                <Check className={cn("mr-2 h-4 w-4 shrink-0", selectedCustomer?.id === c.id ? "opacity-100" : "opacity-0")} />
                                <div className="flex flex-col min-w-0">
                                  <span className="font-medium truncate">{c.company_name || c.name}</span>
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                                    {c.company_name && <span>{c.name}</span>}
                                    {c.email && <span>✉️ {c.email}</span>}
                                    {c.phone && <span>📞 {c.phone}</span>}
                                    {c.city && <span>📍 {c.city}</span>}
                                  </div>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 rounded-xl" onClick={() => setShowCreateCustomer(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {selectedCustomer && (
                  <div className="bg-muted/50 rounded-xl p-3 text-xs space-y-1.5 border">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-foreground truncate">{selectedCustomer.company_name || selectedCustomer.name}</p>
                        {selectedCustomer.company_name && <p className="text-muted-foreground">{selectedCustomer.name}</p>}
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 px-2 rounded-lg text-primary" onClick={openEditCustomer}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        <span className="text-[11px]">Modifica</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 gap-1 pt-1 border-t border-border/50">
                      {selectedCustomer.address && (
                        <p className="text-muted-foreground">📍 {selectedCustomer.address}{selectedCustomer.city ? `, ${selectedCustomer.city}` : ''}{selectedCustomer.province ? ` (${selectedCustomer.province})` : ''}{selectedCustomer.postal_code ? ` - ${selectedCustomer.postal_code}` : ''}</p>
                      )}
                      {selectedCustomer.phone && <p className="text-muted-foreground">📞 {selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p className="text-muted-foreground">✉️ {selectedCustomer.email}</p>}
                      {selectedCustomer.pec && <p className="text-muted-foreground">📧 PEC: {selectedCustomer.pec}</p>}
                      {selectedCustomer.tax_id && <p className="text-muted-foreground">🏷️ P.IVA/CF: {selectedCustomer.tax_id}</p>}
                      {selectedCustomer.sdi_code && <p className="text-muted-foreground">📋 SDI: {selectedCustomer.sdi_code}</p>}
                      {selectedCustomer.shipping_address && (
                        <p className="text-muted-foreground">🚚 Spedizione: {selectedCustomer.shipping_address}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </MobileSection>

            {/* Technicians */}
            <MobileSection title="Tecnici" icon={Users} badge={techniciansList.length > 0 ? `${techniciansList.length}` : undefined}>
              {techniciansList.length > 0 && (
                <div className="space-y-1.5">
                  {techniciansList.map((tech, idx) => {
                    const t = technicians.find(tc => tc.id === tech.technicianId);
                    const rate = getTechRate(tech.technicianId);
                    return (
                      <div key={tech.id} className="flex items-center gap-2 bg-muted/50 p-2.5 rounded-xl">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                          {t ? t.first_name.charAt(0) : idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium block truncate">{t ? `${t.first_name} ${t.last_name}` : 'Tecnico'}</span>
                          <span className="text-[10px] text-muted-foreground">€{rate}/h</span>
                        </div>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive rounded-full" onClick={() => removeTechnician(tech.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {techniciansList.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nessun tecnico aggiunto. Aggiungi almeno un tecnico.</p>
              )}

              {/* Add technician - show available ones directly */}
              {technicians.filter(t => !techniciansList.some(tl => tl.technicianId === t.id)).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {technicians
                    .filter(t => !techniciansList.some(tl => tl.technicianId === t.id))
                    .map(t => (
                      <Button
                        key={t.id}
                        variant="outline"
                        size="sm"
                        className="h-10 text-xs rounded-xl active:scale-95 transition-transform"
                        onClick={() => addTechnicianToList(t.id)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> {t.first_name}
                      </Button>
                    ))}
                </div>
              )}
            </MobileSection>

            {/* Date & Time */}
            <MobileSection title="Data & Orario" icon={Clock} badge={formData.start_time && formData.end_time ? `${calculatedHours}h` : undefined}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Data Intervento</Label>
                <Input type="date" className="h-11 rounded-xl text-base" value={formData.intervention_date} onChange={(e) => handleInputChange('intervention_date', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ora Inizio Intervento</Label>
                  <Input type="time" className="h-11 rounded-xl text-base" value={formData.start_time} onChange={(e) => handleInputChange('start_time', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ora Fine Intervento</Label>
                  <Input type="time" className="h-11 rounded-xl text-base" value={formData.end_time} onChange={(e) => handleInputChange('end_time', e.target.value)} />
                </div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2.5 flex items-start gap-2 border border-amber-200">
                <span className="text-amber-600 text-sm mt-0.5">⚠️</span>
                <span className="text-[11px] text-amber-800 leading-snug">
                  <strong>Indicare solo il tempo effettivo dell'intervento</strong>, escluso il tragitto.
                </span>
              </div>
              {calculatedHours > 0 && (
                <div className="bg-blue-50 rounded-xl p-2.5 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-xs font-medium text-blue-700">Durata effettiva intervento: {calculatedHours} {calculatedHours === 1 ? 'ora' : 'ore'}</span>
                </div>
              )}
              {/* Smart Km Calculator */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Calcolo Chilometri (A/R)</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Partenza</Label>
                    <Input className="h-11 rounded-xl text-sm" value={departureCity} onChange={(e) => { setDepartureCity(e.target.value); setKmAutoCalculated(false); }} placeholder="Scafati (SA)" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Destinazione</Label>
                    <Input className="h-11 rounded-xl text-sm" value={destinationCity} onChange={(e) => { setDestinationCity(e.target.value); setKmAutoCalculated(false); }} placeholder="Es. Napoli" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Km Totali (A/R)</Label>
                    <div className="relative">
                      <Input type="number" className="h-11 rounded-xl text-base" value={formData.kilometers} onChange={(e) => { handleInputChange('kilometers', e.target.value); setKmAutoCalculated(false); }} placeholder="0" inputMode="numeric" />
                      {calculatingKm && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </div>
                </div>
                {kmAutoCalculated && parseFloat(formData.kilometers) > 0 && (
                  <div className={cn(
                    "rounded-xl p-2 flex items-center gap-2 border",
                    isLocalArea(parseFloat(formData.kilometers))
                      ? "bg-green-50 border-green-200"
                      : "bg-orange-50 border-orange-200"
                  )}>
                    <CheckCircle2 className={cn("h-3.5 w-3.5 shrink-0", isLocalArea(parseFloat(formData.kilometers)) ? "text-green-600" : "text-orange-600")} />
                    <span className={cn("text-[11px]", isLocalArea(parseFloat(formData.kilometers)) ? "text-green-700" : "text-orange-700")}>
                      <strong>{formData.kilometers} km A/R</strong> — {isLocalArea(parseFloat(formData.kilometers))
                        ? "📍 Area locale (nessun costo chiamata)"
                        : `🔧 Fuori zona — costo chiamata €${CALLOUT_FEE.toFixed(2)} + IVA`}
                    </span>
                  </div>
                )}
              </div>
            </MobileSection>

            {/* Work Details */}
            <MobileSection title="Dettagli Lavoro" icon={Wrench}>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Descrizione Problema</Label>
                <Textarea value={formData.description} onChange={(e) => handleInputChange('description', e.target.value)} placeholder="Descrivi il problema riscontrato..." rows={3} className="rounded-xl text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Lavori Eseguiti</Label>
                <Textarea value={formData.work_performed} onChange={(e) => handleInputChange('work_performed', e.target.value)} placeholder="Descrivi i lavori eseguiti..." rows={3} className="rounded-xl text-sm resize-none" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Note</Label>
                <Textarea value={formData.notes} onChange={(e) => handleInputChange('notes', e.target.value)} placeholder="Note aggiuntive..." rows={2} className="rounded-xl text-sm resize-none" />
              </div>
            </MobileSection>

            {/* Materials */}
            <MobileSection title="Materiali" icon={FileText} defaultOpen={materialItems.length > 0} badge={materialItems.length > 0 ? `${materialItems.length}` : undefined}>
              <MaterialsLineItems items={materialItems} onChange={setMaterialItems} />
              <div className="mt-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-snug">
                <strong>Nota:</strong> I materiali non inclusi nel presente rapporto saranno quotati e fatturati separatamente secondo listino vigente.
              </div>
            </MobileSection>

            {/* Economics */}
            <MobileSection title="Riepilogo Economico" icon={Euro}>
              {isQuotedOrder ? (
                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-center space-y-1">
                  <CheckCircle2 className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-semibold">Commessa già quotata</p>
                  <p className="text-xs text-muted-foreground">Nessun importo verrà generato per questo intervento. Gli importi sono già inclusi nella commessa di riferimento.</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Importo (€)</Label>
                      <Input type="number" step="0.01" className="h-11 rounded-xl text-base" value={formData.amount} onChange={(e) => handleInputChange('amount', e.target.value)} placeholder="0.00" inputMode="decimal" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">IVA (%)</Label>
                      <Select value={formData.vat_rate} onValueChange={(v) => handleInputChange('vat_rate', v)}>
                        <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">0%</SelectItem>
                          <SelectItem value="4">4%</SelectItem>
                          <SelectItem value="10">10%</SelectItem>
                          <SelectItem value="22">22%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Totale (€)</Label>
                      <div className="h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <span className="text-base font-bold text-blue-700">€{formData.total_amount || '0.00'}</span>
                      </div>
                    </div>
                  </div>
                  {(calculatedHours > 0 || parseFloat(formData.kilometers) > 0) && (
                    <div className="bg-muted/50 rounded-xl p-3 space-y-1 text-xs text-muted-foreground">
                      {techniciansList.filter(t => t.type === 'head').length > 0 && (
                        <div className="flex justify-between">
                          <span>Capi Tecnici ({techniciansList.filter(t => t.type === 'head').length}x {calculatedHours}h)</span>
                          <span className="font-medium text-foreground">€{(calculatedHours * techniciansList.filter(t => t.type === 'head').length * pricingSettings.head_technician_hourly_rate).toFixed(2)}</span>
                        </div>
                      )}
                      {techniciansList.filter(t => t.type === 'specialized').length > 0 && (
                        <div className="flex justify-between">
                          <span>Specializzati ({techniciansList.filter(t => t.type === 'specialized').length}x {calculatedHours}h)</span>
                          <span className="font-medium text-foreground">€{(calculatedHours * techniciansList.filter(t => t.type === 'specialized').length * pricingSettings.specialized_technician_hourly_rate).toFixed(2)}</span>
                        </div>
                      )}
                      {parseFloat(formData.kilometers) > 0 && (
                        <>
                          <div className="flex justify-between">
                            <span>Km ({formData.kilometers} km × €{KM_RATE.toFixed(2)})</span>
                            <span className="font-medium text-foreground">€{(parseFloat(formData.kilometers) * KM_RATE).toFixed(2)}</span>
                          </div>
                          {!isLocalArea(parseFloat(formData.kilometers)) && (
                            <div className="flex justify-between">
                              <span>Costo chiamata (oltre {LOCAL_AREA_ONE_WAY_KM} km)</span>
                              <span className="font-medium text-foreground">€{CALLOUT_FEE.toFixed(2)}</span>
                            </div>
                          )}
                        </>
                      )}
                      {materialsTotalNetto > 0 && (
                        <div className="flex justify-between">
                          <span>Materiali (netto)</span>
                          <span className="font-medium text-foreground">€{materialsTotalNetto.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </MobileSection>
          </>
        )}

        {step === "signatures" && (
          <div className="space-y-4">
            <div className="bg-background rounded-xl border shadow-sm p-4 space-y-2">
              <h3 className="text-sm font-semibold">Riepilogo prima della firma</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground block">Cliente</span>
                  <span className="font-medium">{selectedCustomer?.company_name || selectedCustomer?.name}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground block">Tipo</span>
                  <span className="font-medium capitalize">{formData.intervention_type}</span>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <span className="text-muted-foreground block">Data</span>
                  <span className="font-medium">{formData.intervention_date}</span>
                </div>
                <div className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                  <span className="text-blue-600 block">Totale</span>
                  <span className="font-bold text-blue-700">€{formData.total_amount || '0.00'}</span>
                </div>
              </div>
            </div>

            <div className="bg-background rounded-xl border shadow-sm p-4 space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">✍️ Firma Cliente</Label>
              <SignatureCanvas onSignatureChange={setCustomerSignature} placeholder="Il cliente firma qui" />
              {customerSignature && (
                <div className="flex items-center gap-1.5 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Firma acquisita</div>
              )}
            </div>

            <div className="bg-background rounded-xl border shadow-sm p-4 space-y-3">
              <Label className="text-base font-semibold flex items-center gap-2">✍️ Firma Tecnico</Label>
              <SignatureCanvas onSignatureChange={setTechnicianSignature} placeholder="Il tecnico firma qui" />
              {technicianSignature && (
                <div className="flex items-center gap-1.5 text-xs text-green-600"><CheckCircle2 className="h-3.5 w-3.5" /> Firma acquisita</div>
              )}
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <div className="h-24 w-24 rounded-full bg-green-100 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-foreground">Rapporto Salvato!</h2>
              <p className="text-sm text-muted-foreground">Il rapporto è stato registrato con successo</p>
            </div>
            <div className="w-full max-w-sm space-y-3 px-4">
              <Button onClick={generatePDF} variant="outline" className="w-full h-14 text-base rounded-xl active:scale-95 transition-transform" disabled={loading}>
                <Download className="h-5 w-5 mr-3" /> Scarica PDF
              </Button>
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder={selectedCustomer?.email || "Email del cliente..."}
                    value={overrideEmail}
                    onChange={e => setOverrideEmail(e.target.value)}
                    className="h-12 pl-10 rounded-xl text-sm"
                  />
                  {!selectedCustomer?.email && !overrideEmail && (
                    <p className="text-xs text-amber-600 mt-1 px-1">⚠️ Nessuna email in anagrafica — inseriscine una</p>
                  )}
                  {overrideEmail && selectedCustomer?.email && overrideEmail.trim() !== selectedCustomer.email && (
                    <p className="text-xs text-blue-600 mt-1 px-1">L'anagrafica cliente verrà aggiornata</p>
                  )}
                </div>
                <Button onClick={sendEmail} variant="outline" className="w-full h-14 text-base rounded-xl active:scale-95 transition-transform" disabled={loading || (!selectedCustomer?.email && !overrideEmail.trim())}>
                  {loading ? <Loader2 className="h-5 w-5 mr-3 animate-spin" /> : <Mail className="h-5 w-5 mr-3" />} Invia Email al Cliente
                </Button>
              </div>
              <Button onClick={() => navigate("/hr/z-app/rapporti")} className="w-full h-14 text-base bg-blue-600 hover:bg-blue-700 rounded-xl active:scale-95 transition-transform">
                Torna ai Rapporti
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      {step !== "done" && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border p-4 safe-area-bottom z-30">
          {step === "form" && (
            <Button onClick={goToSignatures} className="w-full h-14 text-base font-semibold bg-blue-600 hover:bg-blue-700 rounded-xl active:scale-[0.98] transition-transform shadow-lg shadow-blue-600/20">
              Avanti — Firme <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
          {step === "signatures" && (
            <div className="space-y-2">
              <Button onClick={saveReport} className="w-full h-14 text-base font-semibold bg-green-600 hover:bg-green-700 rounded-xl active:scale-[0.98] transition-transform shadow-lg shadow-green-600/20" disabled={loading || !customerSignature || !technicianSignature}>
                {loading ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Check className="h-5 w-5 mr-2" />} Salva Rapporto
              </Button>
              {(!customerSignature || !technicianSignature) && (
                <p className="text-center text-xs text-muted-foreground">
                  {!customerSignature && !technicianSignature ? "Entrambe le firme sono richieste" : !customerSignature ? "Manca la firma del cliente" : "Manca la firma del tecnico"}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      <CreateCustomerDialog open={showCreateCustomer} onOpenChange={setShowCreateCustomer} onCustomerCreated={handleCustomerCreated} />

      {/* Edit Customer Dialog */}
      <Dialog open={showEditCustomer} onOpenChange={setShowEditCustomer}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="text-base">Modifica Cliente</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] px-4">
            <div className="space-y-3 pb-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Nome *</Label>
                  <Input value={editCustomerData.name || ''} onChange={e => setEditCustomerData(p => ({ ...p, name: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-muted-foreground">Ragione Sociale</Label>
                  <Input value={editCustomerData.company_name || ''} onChange={e => setEditCustomerData(p => ({ ...p, company_name: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input type="email" value={editCustomerData.email || ''} onChange={e => setEditCustomerData(p => ({ ...p, email: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Telefono</Label>
                  <Input value={editCustomerData.phone || ''} onChange={e => setEditCustomerData(p => ({ ...p, phone: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PEC</Label>
                  <Input type="email" value={editCustomerData.pec || ''} onChange={e => setEditCustomerData(p => ({ ...p, pec: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">P.IVA / C.F.</Label>
                  <Input value={editCustomerData.tax_id || ''} onChange={e => setEditCustomerData(p => ({ ...p, tax_id: e.target.value }))} className="h-10 rounded-lg" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Codice SDI</Label>
                  <Input value={editCustomerData.sdi_code || ''} onChange={e => setEditCustomerData(p => ({ ...p, sdi_code: e.target.value }))} className="h-10 rounded-lg" />
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">📍 Indirizzo</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs text-muted-foreground">Indirizzo</Label>
                    <Input value={editCustomerData.address || ''} onChange={e => setEditCustomerData(p => ({ ...p, address: e.target.value }))} className="h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Città</Label>
                    <Input value={editCustomerData.city || ''} onChange={e => setEditCustomerData(p => ({ ...p, city: e.target.value }))} className="h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Provincia</Label>
                    <Input value={editCustomerData.province || ''} onChange={e => setEditCustomerData(p => ({ ...p, province: e.target.value }))} className="h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">CAP</Label>
                    <Input value={editCustomerData.postal_code || ''} onChange={e => setEditCustomerData(p => ({ ...p, postal_code: e.target.value }))} className="h-10 rounded-lg" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Paese</Label>
                    <Input value={editCustomerData.country || ''} onChange={e => setEditCustomerData(p => ({ ...p, country: e.target.value }))} className="h-10 rounded-lg" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-2">🚚 Indirizzo di Spedizione</p>
                <div>
                  <Label className="text-xs text-muted-foreground">Indirizzo spedizione</Label>
                  <Input value={editCustomerData.shipping_address || ''} onChange={e => setEditCustomerData(p => ({ ...p, shipping_address: e.target.value }))} className="h-10 rounded-lg" />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="px-4 pb-4 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowEditCustomer(false)} className="rounded-lg">Annulla</Button>
            <Button onClick={handleSaveCustomer} disabled={savingCustomer} className="rounded-lg">
              {savingCustomer ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
