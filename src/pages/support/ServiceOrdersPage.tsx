import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Calendar as CalendarIcon, User, Wrench, Eye, Edit, Factory, Trash2, ExternalLink, Archive, FileText, CalendarCheck, UserPlus, TableIcon, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Link } from "react-router-dom";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { ScheduleInstallationDialog } from "@/components/support/ScheduleInstallationDialog";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { it } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  description?: string;
  status: string;
  customer_id?: string;
  contact_id?: string;
  assigned_to?: string;
  priority?: string;
  scheduled_date?: string;
  estimated_hours?: number;
  location?: string;
  equipment_needed?: string;
  created_at: string;
  updated_at: string;
  notes?: string;
  article?: string;
  production_work_order_id?: string;
  sales_order_id?: string;
  lead_id?: string;
  archived?: boolean;
  customers?: {
    name: string;
    code: string;
  };
  crm_contacts?: {
    first_name: string;
    last_name: string;
    company_name?: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  production_work_order?: {
    id: string;
    number: string;
    status: string;
  };
  sales_orders?: {
    number: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
}

const statusColors = {
  da_programmare: "bg-blue-100 text-blue-800 border-blue-200",
  programmata: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completata: "bg-green-100 text-green-800 border-green-200"
};

const statusLabels = {
  da_programmare: "Da Programmare",
  programmata: "Programmata",
  completata: "Completata"
};

export default function WorkOrdersServicePage() {
  const [serviceWorkOrders, setServiceWorkOrders] = useState<ServiceWorkOrder[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<ServiceWorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [workOrderToSchedule, setWorkOrderToSchedule] = useState<ServiceWorkOrder | null>(null);
  const [viewMode, setViewMode] = useState<"table" | "calendar">("table");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    customer_id: "",
    assigned_to: "",
    priority: "medium",
    scheduled_date: "",
    estimated_hours: "",
    location: "",
    equipment_needed: "",
    notes: ""
  });
  const { toast } = useToast();
  const { executeWithUndo } = useUndoableAction();

  useEffect(() => {
    loadServiceWorkOrders();
    loadCustomers();
    loadContacts();
    loadTechnicians();
  }, [showArchivedOrders]);

  const loadServiceWorkOrders = async () => {
    try {
      let query = supabase
        .from('service_work_orders')
        .select(`
          *,
          customers (
            name,
            code
          ),
          crm_contacts (
            first_name,
            last_name,
            company_name
          ),
          production_work_orders:production_work_order_id (
            id,
            number,
            status
          ),
          sales_orders (
            number
          ),
          leads (
            id,
            company_name
          )
        `)
        .order('created_at', { ascending: false });
      
      // Applica il filtro archiviati
      if (showArchivedOrders) {
        query = query.eq('archived', true);
      } else {
        query = query.eq('archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Manually join technician and production work order data
      const workOrdersWithRelations = await Promise.all(
        (data || []).map(async (wo: any) => {
          let result: any = { ...wo };
          
          // Load technician data
          if (wo.assigned_to) {
            const { data: techData } = await supabase
              .from('technicians')
              .select('id, first_name, last_name, employee_code')
              .eq('id', wo.assigned_to)
              .single();
            
            if (techData) result.technician = techData;
          }
          
          // Load production work order data
          if (wo.production_work_order_id) {
            const { data: prodData } = await supabase
              .from('work_orders')
              .select('id, number, status')
              .eq('id', wo.production_work_order_id)
              .single();
            
            if (prodData) result.production_work_order = prodData;
          }
          
          return result;
        })
      );

      setServiceWorkOrders(workOrdersWithRelations);
    } catch (error) {
      console.error('Error loading service work orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle commesse di lavoro",
        variant: "destructive",
      });
    }
  };

  const loadContacts = async () => {
    try {
      const { data, error } = await supabase
        .from('crm_contacts')
        .select('id, first_name, last_name, company_name, email, phone')
        .order('first_name');

      if (error) throw error;
      setContacts(data || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const loadTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error) {
      console.error('Error loading technicians:', error);
    }
  };

  const handleCustomerCreated = (newCustomer: { id: string; name: string; code: string }) => {
    setCustomers(prev => [...prev, newCustomer]);
    setFormData(prev => ({ ...prev, customer_id: newCustomer.id }));
    setShowCreateCustomer(false);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleCreateWorkOrder = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const insertData: any = {
        number: '', // Will be auto-generated by trigger
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        location: formData.location || null,
        equipment_needed: formData.equipment_needed || null,
        notes: formData.notes || null,
        status: 'da_programmare'
      };

      // Remove empty string values, replace with null
      Object.keys(insertData).forEach(key => {
        if (insertData[key] === '') {
          insertData[key] = null;
        }
      });

      const { error } = await supabase
        .from('service_work_orders')
        .insert(insertData);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro creata con successo",
      });

      setFormData({
        title: "",
        description: "",
        customer_id: "",
        assigned_to: "",
        priority: "medium",
        scheduled_date: "",
        estimated_hours: "",
        location: "",
        equipment_needed: "",
        notes: ""
      });
      setShowCreateDialog(false);
      loadServiceWorkOrders();
    } catch (error) {
      console.error('Error creating work order:', error);
      toast({
        title: "Errore",
        description: "Errore nella creazione dell'ordine di lavoro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditWorkOrder = async () => {
    if (!selectedWorkOrder || !formData.title.trim()) {
      toast({
        title: "Errore",
        description: "Il titolo è obbligatorio",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const updateData: any = {
        title: formData.title,
        description: formData.description || null,
        customer_id: formData.customer_id || null,
        assigned_to: formData.assigned_to || null,
        priority: formData.priority,
        scheduled_date: formData.scheduled_date || null,
        estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
        location: formData.location || null,
        equipment_needed: formData.equipment_needed || null,
        notes: formData.notes || null
      };

      // Remove empty string values, replace with null
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === '') {
          updateData[key] = null;
        }
      });

      const { error } = await supabase
        .from('service_work_orders')
        .update(updateData)
        .eq('id', selectedWorkOrder.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro aggiornata con successo",
      });

      setShowEditDialog(false);
      loadServiceWorkOrders();
    } catch (error) {
      console.error('Error updating work order:', error);
      toast({
        title: "Errore",
        description: "Errore nell'aggiornamento della commessa di lavoro",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateWorkOrderStatus = async (workOrderId: string, newStatus: string) => {
    const workOrder = serviceWorkOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const previousStatus = workOrder.status;

    await executeWithUndo(
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ status: newStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ status: previousStatus as any })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      {
        duration: 10000,
        successMessage: "Stato aggiornato",
        errorMessage: "Errore nell'aggiornamento dello stato"
      }
    );
  };

  const handleArchive = async (workOrderId: string) => {
    const workOrder = serviceWorkOrders.find(wo => wo.id === workOrderId);
    if (!workOrder) return;

    const newArchivedStatus = !workOrder.archived;

    await executeWithUndo(
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ archived: newArchivedStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      async () => {
        const { error } = await supabase
          .from('service_work_orders')
          .update({ archived: !newArchivedStatus })
          .eq('id', workOrderId);

        if (error) throw error;
        await loadServiceWorkOrders();
      },
      {
        duration: 10000,
        successMessage: newArchivedStatus ? "Ordine archiviato" : "Ordine ripristinato",
        errorMessage: newArchivedStatus ? "Errore nell'archiviazione" : "Errore nel ripristino"
      }
    );
  };

  const handleDeleteWorkOrder = async (workOrderId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa commessa di lavoro? Questa azione non può essere annullata.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from('service_work_orders')
        .delete()
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di lavoro eliminata con successo",
      });

      loadServiceWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile eliminare la commessa di lavoro: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadReport = async () => {
    const doc = new jsPDF();
    
    // Titolo
    doc.setFontSize(18);
    doc.text("Report Commesse di Lavoro", 14, 20);
    
    // Data e ora
    doc.setFontSize(10);
    doc.text(`Generato il: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })}`, 14, 28);
    
    // Filtra ordini in base allo stato selezionato
    const ordersToExport = filteredWorkOrders;
    
    let yPosition = 35;
    
    // Per ogni commessa, crea un esploso dettagliato
    for (let i = 0; i < ordersToExport.length; i++) {
      const wo = ordersToExport[i];
      
      // Aggiungi una nuova pagina se non è la prima commessa
      if (i > 0) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Titolo commessa
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`Commessa ${wo.number}: ${wo.title}`, 14, yPosition);
      yPosition += 8;
      
      // Informazioni base
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      const basicInfo = [
        ["Cliente", wo.customers?.name || "-"],
        ["Stato", statusLabels[wo.status as keyof typeof statusLabels] || wo.status],
        ["Priorità", wo.priority === "high" ? "Alta" : wo.priority === "medium" ? "Media" : "Bassa"],
        ["Tecnico Assegnato", wo.technician ? `${wo.technician.first_name} ${wo.technician.last_name}` : "-"],
        ["Data Programmata", wo.scheduled_date ? format(new Date(wo.scheduled_date), "dd/MM/yyyy HH:mm", { locale: it }) : "-"],
        ["Ore Stimate", wo.estimated_hours ? `${wo.estimated_hours}h` : "-"],
        ["Luogo", wo.location || "-"],
        ["Attrezzatura Necessaria", wo.equipment_needed || "-"],
      ];
      
      autoTable(doc, {
        body: basicInfo,
        startY: yPosition,
        theme: 'plain',
        styles: { fontSize: 9, cellPadding: 2 },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 50 },
          1: { cellWidth: 130 }
        }
      });
      
      yPosition = (doc as any).lastAutoTable.finalY + 5;
      
      // Descrizione
      if (wo.description) {
        doc.setFont("helvetica", "bold");
        doc.text("Descrizione:", 14, yPosition);
        yPosition += 5;
        doc.setFont("helvetica", "normal");
        const descLines = doc.splitTextToSize(wo.description, 180);
        doc.text(descLines, 14, yPosition);
        yPosition += descLines.length * 5 + 5;
      }
      
      // Note
      if (wo.notes) {
        doc.setFont("helvetica", "bold");
        doc.text("Note:", 14, yPosition);
        yPosition += 5;
        doc.setFont("helvetica", "normal");
        const noteLines = doc.splitTextToSize(wo.notes, 180);
        doc.text(noteLines, 14, yPosition);
        yPosition += noteLines.length * 5 + 5;
      }
      
      // Carica e mostra commenti
      try {
        const { data: comments } = await supabase
          .from('service_work_order_comments')
          .select('*, profiles(first_name, last_name)')
          .eq('service_work_order_id', wo.id)
          .order('created_at', { ascending: true });
        
        if (comments && comments.length > 0) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Commenti:", 14, yPosition);
          yPosition += 5;
          
          const commentData = comments.map((c: any) => [
            format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: it }),
            c.profiles ? `${c.profiles.first_name} ${c.profiles.last_name}` : "Utente",
            c.comment
          ]);
          
          autoTable(doc, {
            head: [["Data", "Utente", "Commento"]],
            body: commentData,
            startY: yPosition,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 30 },
              1: { cellWidth: 35 },
              2: { cellWidth: 115 }
            }
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 5;
        }
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
      
      // Carica e mostra attività
      try {
        const { data: activities } = await (supabase as any)
          .from('service_work_order_activities')
          .select('*, profiles(first_name, last_name)')
          .eq('service_work_order_id', wo.id)
          .order('created_at', { ascending: false })
          .limit(10);
        
        if (activities && activities.length > 0) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Attività Recenti:", 14, yPosition);
          yPosition += 5;
          
          const activityData = activities.map((a: any) => [
            format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: it }),
            a.profiles ? `${a.profiles.first_name} ${a.profiles.last_name}` : "Sistema",
            a.activity_type,
            a.description || "-"
          ]);
          
          autoTable(doc, {
            head: [["Data", "Utente", "Tipo", "Descrizione"]],
            body: activityData,
            startY: yPosition,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 30 },
              1: { cellWidth: 30 },
              2: { cellWidth: 30 },
              3: { cellWidth: 90 }
            }
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 5;
        }
      } catch (error) {
        console.error('Error fetching activities:', error);
      }
      
      // Collegamenti
      const links: string[] = [];
      if (wo.production_work_order) {
        links.push(`Commessa Produzione: ${wo.production_work_order.number}`);
      }
      if (wo.sales_orders) {
        links.push(`Ordine Vendita: ${wo.sales_orders.number}`);
      }
      if (wo.leads) {
        links.push(`Lead: ${wo.leads.company_name}`);
      }
      
      if (links.length > 0) {
        if (yPosition > 270) {
          doc.addPage();
          yPosition = 20;
        }
        doc.setFont("helvetica", "bold");
        doc.text("Collegamenti:", 14, yPosition);
        yPosition += 5;
        doc.setFont("helvetica", "normal");
        links.forEach(link => {
          doc.text(`• ${link}`, 14, yPosition);
          yPosition += 5;
        });
      }
    }
    
    // Salva il PDF
    doc.save(`report-commesse-lavoro-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
    
    toast({
      title: "Report scaricato",
      description: "Il report PDF è stato generato con successo",
    });
  };

  const handleScheduleInstallation = async (date: Date) => {
    if (!workOrderToSchedule) return;

    try {
      const { error } = await supabase
        .from('service_work_orders')
        .update({ 
          scheduled_date: date.toISOString(),
          status: 'programmata'
        })
        .eq('id', workOrderToSchedule.id);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Installazione programmata con successo",
      });

      setWorkOrderToSchedule(null);
      loadServiceWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile programmare l'installazione: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleGenerateReport = async (workOrder: ServiceWorkOrder) => {
    try {
      // Verifica che la commessa abbia i dati necessari
      if (!workOrder.scheduled_date || !workOrder.assigned_to) {
        toast({
          title: "Dati mancanti",
          description: "La commessa deve avere una data programmata e un tecnico assegnato",
          variant: "destructive",
        });
        return;
      }

      // Crea il rapporto di intervento in bozza
      const { data: report, error } = await supabase
        .from('service_reports')
        .insert({
          contact_id: workOrder.contact_id,
          technician_id: workOrder.assigned_to,
          work_order_id: workOrder.id,
          intervention_type: 'Installazione',
          work_performed: workOrder.title,
          description: workOrder.description || null,
          notes: workOrder.notes || null,
          technician_name: workOrder.technician 
            ? `${workOrder.technician.first_name} ${workOrder.technician.last_name}` 
            : null,
          intervention_date: new Date(workOrder.scheduled_date).toISOString().split('T')[0],
          status: 'in_progress',
          customer_signature: null,
          technician_signature: null
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Rapporto creato",
        description: "Il rapporto di intervento è stato creato. Vai alla sezione Rapporti per completarlo.",
      });

      // Aggiorna lo stato della commessa a completata
      const { error: updateError } = await supabase
        .from('service_work_orders')
        .update({ status: 'completata' })
        .eq('id', workOrder.id);

      if (updateError) throw updateError;

      // Ricarica i dati
      loadServiceWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile creare il rapporto: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleTakeOwnership = async (workOrderId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Errore",
          description: "Devi essere autenticato per assegnarti questa commessa",
          variant: "destructive",
        });
        return;
      }

      // Trova il tecnico tramite email dell'utente corrente
      const { data: technicianData, error: techError } = await supabase
        .from('technicians')
        .select('id')
        .eq('email', user.email)
        .single();

      if (techError || !technicianData) {
        toast({
          title: "Errore",
          description: "Non sei registrato come tecnico nel sistema. Contatta l'amministratore.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('service_work_orders')
        .update({ assigned_to: technicianData.id })
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ti sei assegnato questa commessa con successo",
      });

      loadServiceWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredWorkOrders = serviceWorkOrders.filter(wo => {
    const matchesSearch = wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         wo.customers?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (wo.crm_contacts && 
                          `${wo.crm_contacts.first_name} ${wo.crm_contacts.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === "all" || wo.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calendar view helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getWorkOrdersForDay = (day: Date) => {
    return filteredWorkOrders.filter(wo => 
      wo.scheduled_date && isSameDay(new Date(wo.scheduled_date), day)
    );
  };

  const goToPreviousMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const handleCalendarDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    const woId = draggableId;

    try {
      // Check if dropping from unprogrammed to calendar
      if (source.droppableId === 'unprogrammed' && destination.droppableId.startsWith('calendar-')) {
        // Extract date from droppableId (format: calendar-YYYY-MM-DD)
        const dateStr = destination.droppableId.replace('calendar-', '');
        
        const { error } = await supabase
          .from("service_work_orders")
          .update({ scheduled_date: dateStr, status: 'programmata' })
          .eq("id", woId);

        if (error) throw error;

        toast({
          title: "Commessa programmata",
          description: `La commessa è stata programmata per il ${new Date(dateStr).toLocaleDateString('it-IT')}`,
        });

        loadServiceWorkOrders();
      } else if (destination.droppableId.startsWith('calendar-')) {
        // Moving between calendar days
        const dateStr = destination.droppableId.replace('calendar-', '');
        
        const { error } = await supabase
          .from("service_work_orders")
          .update({ scheduled_date: dateStr })
          .eq("id", woId);

        if (error) throw error;

        toast({
          title: "Data aggiornata",
          description: `La commessa è stata spostata al ${new Date(dateStr).toLocaleDateString('it-IT')}`,
        });

        loadServiceWorkOrders();
      } else if (destination.droppableId === 'unprogrammed') {
        // Moving back to unprogrammed
        const { error } = await supabase
          .from("service_work_orders")
          .update({ scheduled_date: null, status: 'da_programmare' })
          .eq("id", woId);

        if (error) throw error;

        toast({
          title: "Commessa deprogrammata",
          description: "La commessa è stata rimossa dal calendario",
        });

        loadServiceWorkOrders();
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare la data della commessa",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Commesse di Lavoro (CdL)</h1>
        <p className="text-muted-foreground">
          Pianifica e monitora le commesse di lavoro per l'assistenza tecnica. Per creare una nuova commessa, utilizza la sezione Ordini.
        </p>
      </div>

      {/* Filtri e Azioni */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Cerca commesse di lavoro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtra per stato" />
          </SelectTrigger>
        <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="da_programmare">Da Programmare</SelectItem>
            <SelectItem value="programmata">Programmata</SelectItem>
            <SelectItem value="completata">Completata</SelectItem>
          </SelectContent>
        </Select>
        <Button 
          variant={showArchivedOrders ? "default" : "outline"} 
          size="sm" 
          onClick={() => setShowArchivedOrders(!showArchivedOrders)}
        >
          {showArchivedOrders ? "Nascondi Archiviati" : "Mostra Archiviati"}
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleDownloadReport}
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Scarica Report PDF
        </Button>
      </div>

      {/* Tabs per Vista Tabella/Calendario */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "calendar")} className="mb-6">
        <TabsList>
          <TabsTrigger value="table" className="gap-2">
            <TableIcon className="w-4 h-4" />
            Tabella
          </TabsTrigger>
          <TabsTrigger value="calendar" className="gap-2">
            <CalendarIcon className="w-4 h-4" />
            Calendario
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Vista Tabella */}
      {viewMode === "table" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Commesse di Lavoro ({filteredWorkOrders.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numero</TableHead>
                <TableHead>Titolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Tecnico</TableHead>
                <TableHead>Priorità</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Data Programmata</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nessuna commessa di lavoro trovata
                  </TableCell>
                </TableRow>
              ) : (
                filteredWorkOrders.map((workOrder: any) => (
                  <TableRow 
                    key={workOrder.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedWorkOrder(workOrder);
                      setShowDetailsDialog(true);
                    }}
                  >
                     <TableCell>
                       <div className="font-mono text-sm font-medium">
                         {workOrder.number}
                       </div>
                     </TableCell>
                     <TableCell>
                       <div className="font-medium text-sm leading-tight">
                         {workOrder.title}
                       </div>
                     </TableCell>
                     <TableCell>
                       {workOrder.customers ? (
                         <div className="text-sm">
                           <div className="font-medium">{workOrder.customers.name}</div>
                           <div className="text-xs text-muted-foreground">({workOrder.customers.code})</div>
                         </div>
                       ) : (
                         <span className="text-muted-foreground text-sm">—</span>
                       )}
                     </TableCell>
                     <TableCell>
                       {workOrder.technician ? (
                         <div className="text-sm font-medium">
                           {workOrder.technician.first_name} {workOrder.technician.last_name}
                         </div>
                       ) : (
                         <Button
                           size="sm"
                           variant="outline"
                           onClick={() => handleTakeOwnership(workOrder.id)}
                           className="gap-2"
                         >
                           <UserPlus className="w-4 h-4" />
                           Prendi in carico
                         </Button>
                       )}
                     </TableCell>
                   <TableCell>
                     <Badge variant={workOrder.priority === 'urgent' ? 'destructive' : 
                                  workOrder.priority === 'high' ? 'default' :
                                  workOrder.priority === 'medium' ? 'secondary' : 'outline'}>
                       {workOrder.priority === 'urgent' ? 'Urgente' :
                        workOrder.priority === 'high' ? 'Alta' :
                        workOrder.priority === 'medium' ? 'Media' : 'Bassa'}
                     </Badge>
                   </TableCell>
                     <TableCell>
                       <Badge className={statusColors[workOrder.status as keyof typeof statusColors]}>
                         {statusLabels[workOrder.status as keyof typeof statusLabels]}
                       </Badge>
                     </TableCell>
                     <TableCell>
                       <div className="space-y-2">
                         {workOrder.scheduled_date ? (
                           <>
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <CalendarIcon className="w-3 h-3" />
                                <div>
                                 <div>{new Date(workOrder.scheduled_date).toLocaleDateString('it-IT')}</div>
                                 <div className="text-xs">
                                   {new Date(workOrder.scheduled_date).toLocaleTimeString('it-IT', { 
                                     hour: '2-digit', 
                                     minute: '2-digit' 
                                   })}
                                 </div>
                               </div>
                             </div>
                             <Button
                               size="sm"
                               variant="default"
                               onClick={() => handleGenerateReport(workOrder)}
                               className="gap-2 w-full"
                             >
                               <FileText className="w-4 h-4" />
                               Genera Rapporto
                             </Button>
                           </>
                         ) : (
                           <Button
                             size="sm"
                             variant="default"
                             onClick={() => {
                               setWorkOrderToSchedule(workOrder);
                               setShowScheduleDialog(true);
                             }}
                             className="gap-2 w-full"
                           >
                             <CalendarCheck className="w-4 h-4" />
                             Programma Installazione
                           </Button>
                         )}
                       </div>
                     </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedWorkOrder(workOrder);
                            setShowDetailsDialog(true);
                          }}
                          title="Visualizza dettagli"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Vista Calendario */}
      {viewMode === "calendar" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5" />
                Calendario Lavori Programmati
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToPreviousMonth}>
                  Mese Precedente
                </Button>
                <Button variant="outline" size="sm" onClick={goToToday}>
                  Oggi
                </Button>
                <Button variant="outline" size="sm" onClick={goToNextMonth}>
                  Mese Successivo
                </Button>
              </div>
            </div>
            <CardDescription>
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DragDropContext onDragEnd={handleCalendarDragEnd}>
              <div className="flex gap-4">
                {/* Unprogrammed Orders Sidebar */}
                <div className="w-64 flex-shrink-0 space-y-2">
                  <div className="sticky top-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">Non Programmate</CardTitle>
                        <CardDescription className="text-xs">
                          Trascina nel calendario per programmare
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Droppable droppableId="unprogrammed">
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`space-y-2 min-h-[200px] p-2 rounded-lg transition-colors ${
                                snapshot.isDraggingOver ? 'bg-muted/50' : 'bg-background'
                              }`}
                            >
                              {filteredWorkOrders
                                .filter(wo => !wo.scheduled_date)
                                .map((wo, index) => (
                                  <Draggable key={wo.id} draggableId={wo.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        className={`p-2 bg-card border rounded-lg cursor-move hover:shadow-md transition-all ${
                                          snapshot.isDragging ? 'shadow-lg opacity-80' : ''
                                        }`}
                                        onClick={() => {
                                          setSelectedWorkOrder(wo);
                                          setShowDetailsDialog(true);
                                        }}
                                      >
                                        <div className="text-xs font-medium truncate">{wo.number}</div>
                                        <div className="text-[10px] text-muted-foreground truncate">
                                          {wo.customers?.name || 'Nessun cliente'}
                                        </div>
                                        {wo.priority && (
                                          <Badge variant={wo.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-[9px] mt-1 h-4">
                                            {wo.priority}
                                          </Badge>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                              {provided.placeholder}
                              {filteredWorkOrders.filter(wo => !wo.scheduled_date).length === 0 && (
                                <div className="text-xs text-muted-foreground text-center py-4">
                                  Nessuna commessa da programmare
                                </div>
                              )}
                            </div>
                          )}
                        </Droppable>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-7 gap-2">
                    {/* Header giorni della settimana */}
                    {["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"].map((day) => (
                      <div key={day} className="text-center font-semibold text-sm text-muted-foreground p-2">
                        {day}
                      </div>
                    ))}
                    
                    {/* Celle del calendario */}
                    {calendarDays.map((day, idx) => {
                      const workOrders = getWorkOrdersForDay(day);
                      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                      const isToday = isSameDay(day, new Date());
                      const dateStr = format(day, 'yyyy-MM-dd');
                      
                      return (
                        <Droppable key={idx} droppableId={`calendar-${dateStr}`}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`min-h-32 border rounded-lg p-2 transition-colors ${
                                !isCurrentMonth ? "bg-muted/30" : ""
                              } ${isToday ? "ring-2 ring-primary" : ""} ${
                                snapshot.isDraggingOver ? 'bg-primary/10 border-primary' : ''
                              }`}
                            >
                              <div className={`text-sm font-medium mb-2 ${
                                !isCurrentMonth ? "text-muted-foreground" : ""
                              } ${isToday ? "text-primary font-bold" : ""}`}>
                                {format(day, "d")}
                              </div>
                              <div className="space-y-2">
                                {workOrders.map((wo, index) => (
                                  <Draggable key={wo.id} draggableId={wo.id} index={index}>
                                    {(provided, snapshot) => (
                                      <div
                                        ref={provided.innerRef}
                                        {...provided.draggableProps}
                                        {...provided.dragHandleProps}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedWorkOrder(wo);
                                          setShowDetailsDialog(true);
                                        }}
                                        className={`cursor-pointer bg-card hover:bg-accent border-2 border-primary/40 rounded-md p-2.5 transition-all ${
                                          snapshot.isDragging ? 'opacity-50 shadow-lg' : 'shadow-sm hover:shadow-md'
                                        }`}
                                      >
                                        <div className="space-y-1.5">
                                          <div className="font-semibold text-sm leading-tight line-clamp-2" title={wo.title}>
                                            {wo.title}
                                          </div>
                                          <div className="text-xs text-muted-foreground truncate" title={wo.customers?.name}>
                                            {wo.customers?.name || 'Nessun cliente'}
                                          </div>
                                          {wo.scheduled_date && (
                                            <div className="text-xs font-medium text-primary">
                                              {format(new Date(wo.scheduled_date), "HH:mm")}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))}
                                {provided.placeholder}
                              </div>
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>
                </div>
              </div>
            </DragDropContext>
          </CardContent>
        </Card>
      )}

      {/* Dialog Dettagli */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dettagli Commessa di Lavoro</DialogTitle>
            <DialogDescription>
              {selectedWorkOrder?.number}
            </DialogDescription>
          </DialogHeader>
          {selectedWorkOrder && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Titolo</Label>
                <p className="text-base">{selectedWorkOrder.title}</p>
              </div>
              {selectedWorkOrder.description && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Descrizione</Label>
                  <p className="text-base">{selectedWorkOrder.description}</p>
                </div>
              )}
              {selectedWorkOrder.customers && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Cliente</Label>
                  <p className="text-base">{selectedWorkOrder.customers.name} ({selectedWorkOrder.customers.code})</p>
                </div>
              )}
              {selectedWorkOrder.leads && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Lead</Label>
                  <Link 
                    to={`/crm/leads?lead=${selectedWorkOrder.lead_id}`}
                    className="text-base text-primary hover:underline flex items-center gap-1 w-fit"
                  >
                    {selectedWorkOrder.leads.company_name}
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              )}
              <div>
                <Label className="text-sm font-medium text-muted-foreground">Stato</Label>
                <div className="mt-1">
                  <Badge className={statusColors[selectedWorkOrder.status as keyof typeof statusColors]}>
                    {statusLabels[selectedWorkOrder.status as keyof typeof statusLabels]}
                  </Badge>
                </div>
              </div>
              
              {/* Articles */}
              {selectedWorkOrder.article && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Articoli</Label>
                  <div className="bg-muted/50 p-3 rounded-lg mt-1">
                    <p className="text-sm whitespace-pre-wrap">{selectedWorkOrder.article}</p>
                  </div>
                </div>
              )}
              
              {selectedWorkOrder.notes && (
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Note</Label>
                  <p className="text-base">{selectedWorkOrder.notes}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data Creazione</Label>
                  <p className="text-base">{new Date(selectedWorkOrder.created_at).toLocaleDateString('it-IT')}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Ultimo Aggiornamento</Label>
                  <p className="text-base">{new Date(selectedWorkOrder.updated_at).toLocaleDateString('it-IT')}</p>
                </div>
              </div>
              
              {/* Azioni */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setFormData({
                      title: selectedWorkOrder.title,
                      description: selectedWorkOrder.description || "",
                      customer_id: selectedWorkOrder.customer_id || "",
                      assigned_to: selectedWorkOrder.assigned_to || "",
                      priority: selectedWorkOrder.priority || "medium",
                      scheduled_date: selectedWorkOrder.scheduled_date || "",
                      estimated_hours: selectedWorkOrder.estimated_hours?.toString() || "",
                      location: selectedWorkOrder.location || "",
                      equipment_needed: selectedWorkOrder.equipment_needed || "",
                      notes: selectedWorkOrder.notes || ""
                    });
                    setShowDetailsDialog(false);
                    setShowEditDialog(true);
                  }}
                  className="gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Modifica
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    handleArchive(selectedWorkOrder.id);
                    setShowDetailsDialog(false);
                  }}
                  className="gap-2"
                >
                  <Archive className="w-4 h-4" />
                  {selectedWorkOrder.archived ? "Ripristina" : "Archivia"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    handleDeleteWorkOrder(selectedWorkOrder.id);
                    setShowDetailsDialog(false);
                  }}
                  className="gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog Modifica */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifica Commessa di Lavoro</DialogTitle>
            <DialogDescription>
              {selectedWorkOrder?.number} - Modifica i dettagli della commessa di lavoro
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-2">
              <Label htmlFor="edit_title">Titolo *</Label>
              <Input
                id="edit_title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Titolo della commessa di lavoro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_customer">Cliente</Label>
              <Select value={formData.customer_id} onValueChange={(value) => handleInputChange('customer_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} ({customer.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit_assigned_to">Assegnato a</Label>
              <Select value={formData.assigned_to} onValueChange={(value) => handleInputChange('assigned_to', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tecnico..." />
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_priority">Priorità</Label>
                <Select value={formData.priority} onValueChange={(value) => handleInputChange('priority', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona priorità" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_estimated_hours">Ore Stimate</Label>
                <Input
                  id="edit_estimated_hours"
                  type="number"
                  step="0.5"
                  value={formData.estimated_hours}
                  onChange={(e) => handleInputChange('estimated_hours', e.target.value)}
                  placeholder="8.0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit_scheduled_date">Data Programmata Intervento</Label>
                <Input
                  id="edit_scheduled_date"
                  type="datetime-local"
                  value={formData.scheduled_date}
                  onChange={(e) => handleInputChange('scheduled_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_location">Ubicazione</Label>
                <Input
                  id="edit_location"
                  value={formData.location}
                  onChange={(e) => handleInputChange('location', e.target.value)}
                  placeholder="Indirizzo o ubicazione dell'intervento"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_equipment_needed">Attrezzatura Necessaria</Label>
              <Textarea
                id="edit_equipment_needed"
                value={formData.equipment_needed}
                onChange={(e) => handleInputChange('equipment_needed', e.target.value)}
                placeholder="Strumenti e attrezzature necessarie..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_description">Descrizione</Label>
              <Textarea
                id="edit_description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descrizione del lavoro da eseguire..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_notes">Note</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                placeholder="Note aggiuntive..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Annulla
              </Button>
              <Button onClick={handleEditWorkOrder} disabled={loading}>
                {loading ? "Salvando..." : "Salva Modifiche"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateCustomerDialog
        open={showCreateCustomer}
        onOpenChange={setShowCreateCustomer}
        onCustomerCreated={handleCustomerCreated}
      />
      
      <ScheduleInstallationDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        onSchedule={handleScheduleInstallation}
        workOrderNumber={workOrderToSchedule?.number}
      />
    </div>
  );
}