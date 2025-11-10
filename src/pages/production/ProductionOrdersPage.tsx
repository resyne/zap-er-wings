import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search, Filter, Download, Eye, Edit, Wrench, Trash2, LayoutGrid, List, ExternalLink, Calendar as CalendarIcon, Archive, UserPlus, FileDown } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CreateCustomerDialog } from "@/components/support/CreateCustomerDialog";
import { OrderComments } from "@/components/orders/OrderComments";
import { BomComposition } from "@/components/production/BomComposition";
import { useUndoableAction } from "@/hooks/useUndoableAction";
import { OrderFileManager } from "@/components/orders/OrderFileManager";
import { WorkOrderComments } from "@/components/production/WorkOrderComments";
import { WorkOrderArticles } from "@/components/production/WorkOrderArticles";
import { WorkOrderActivityLog } from "@/components/production/WorkOrderActivityLog";
import { useIsMobile } from "@/hooks/use-mobile";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  planned_start_date?: string;
  planned_end_date?: string;
  assigned_to?: string;
  back_office_manager?: string;
  customer_id?: string;
  contact_id?: string;
  priority?: string;
  notes?: string;
  article?: string;
  bom_id?: string;
  accessori_ids?: string[];
  sales_order_id?: string;
  lead_id?: string;
  offer_id?: string;
  archived?: boolean;
  attachments?: any[];
  boms?: {
    name: string;
    version: string;
  };
  customers?: {
    name: string;
    code: string;
  };
  technician?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
  back_office?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  sales_orders?: {
    number: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
  offers?: {
    number: string;
  };
}

export default function WorkOrdersPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]); // Per back office manager
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "calendar">("table");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parentOrderFiles, setParentOrderFiles] = useState<any[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const { toast } = useToast();
  const { executeWithUndo } = useUndoableAction();

  const [formData, setFormData] = useState({
    title: "",
    bom_id: "",
    accessori_ids: [] as string[],
    customer_id: "",
    assigned_to: "",
    back_office_manager: "",
    priority: "medium",
    planned_start_date: "",
    planned_end_date: "",
    notes: "",
    createServiceOrder: false,
    serviceOrderTitle: "",
    serviceOrderNotes: ""
  });

  useEffect(() => {
    fetchWorkOrders();
    fetchBoms();
    fetchCustomers();
    fetchUsers();
    fetchTechnicians();
  }, [showArchivedOrders]);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          boms(name, version),
          customers(name, code),
          sales_orders(number),
          leads(id, company_name),
          offers(number),
          service_work_orders!production_work_order_id(id, number, title)
        `)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Manually join assigned user data from profiles
      const workOrdersWithAssignedUsers = await Promise.all(
        (data || []).map(async (wo) => {
          if (wo.assigned_to) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('id, first_name, last_name, email')
              .eq('id', wo.assigned_to)
              .single();
            
            // Map to technician format for display compatibility
            const techData = userData ? {
              id: userData.id,
              first_name: userData.first_name,
              last_name: userData.last_name,
              employee_code: userData.email?.split('@')[0] || ''
            } : null;
            
            return { ...wo, technician: techData };
          }
          return wo;
        })
      );

      setWorkOrders(workOrdersWithAssignedUsers as any);
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBoms = async () => {
    try {
      const { data, error } = await supabase
        .from('boms')
        .select('id, name, version, level')
        .eq('level', 0) // Solo livello 0 (macchine complete)
        .order('name');

      if (error) throw error;
      
      setBoms(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento delle distinte base:", error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, code')
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento dei clienti:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email')
        .order('first_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento degli utenti:", error);
    }
  };

  const fetchTechnicians = async () => {
    try {
      const { data, error } = await supabase
        .from('technicians')
        .select('id, first_name, last_name, employee_code')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setTechnicians(data || []);
    } catch (error: any) {
      console.error("Errore durante il caricamento dei tecnici:", error);
    }
  };

  // Fast buttons function for setting planned dates
  const setPlannedDuration = (hours: number) => {
    const now = new Date();
    const startDate = now.toISOString().slice(0, 16); // Format for datetime-local
    const endDate = new Date(now.getTime() + (hours * 60 * 60 * 1000)).toISOString().slice(0, 16);
    
    setFormData(prev => ({
      ...prev,
      planned_start_date: startDate,
      planned_end_date: endDate
    }));
  };

  const handleCustomerCreated = (newCustomer: { id: string; name: string; code: string }) => {
    setCustomers(prev => [...prev, newCustomer]);
    setFormData(prev => ({ ...prev, customer_id: newCustomer.id }));
    setShowCreateCustomer(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedWO) {
        const { error } = await supabase
          .from('work_orders')
          .update({
            title: formData.title,
            bom_id: formData.bom_id || null,
            accessori_ids: formData.accessori_ids,
            customer_id: formData.customer_id || null,
            assigned_to: (formData.assigned_to && formData.assigned_to.trim() !== '' && formData.assigned_to !== 'none') ? formData.assigned_to : null,
            priority: formData.priority,
            planned_start_date: formData.planned_start_date || null,
            planned_end_date: formData.planned_end_date || null,
            notes: formData.notes
          })
          .eq('id', selectedWO.id);

        if (error) throw error;

        toast({
          title: "Successo",
          description: "Commessa di produzione aggiornata con successo",
        });
      } else {
        // Create production work order (number will be auto-generated)
        const { data: productionWO, error: productionError } = await supabase
          .from('work_orders')
          .insert([{ 
            number: '', // Will be auto-generated by trigger
            title: formData.title,
            bom_id: formData.bom_id || null,
            accessori_ids: formData.accessori_ids,
            customer_id: formData.customer_id || null,
            assigned_to: (formData.assigned_to && formData.assigned_to.trim() !== '' && formData.assigned_to !== 'none') ? formData.assigned_to : null,
            priority: formData.priority,
            planned_start_date: formData.planned_start_date || null,
            planned_end_date: formData.planned_end_date || null,
            notes: formData.notes,
            status: 'da_fare'
          }])
          .select()
          .single();

        if (productionError) throw productionError;

        // Create service work order if requested (number will be auto-generated)
        if (formData.createServiceOrder && productionWO) {
          const { error: serviceError } = await supabase
            .from('service_work_orders')
            .insert([{
              number: '', // Will be auto-generated by trigger
              title: formData.serviceOrderTitle || `CdL collegato a ${formData.title}`,
              description: formData.serviceOrderNotes || `Commessa di lavoro collegata alla commessa di produzione ${productionWO.number}`,
              production_work_order_id: productionWO.id,
              customer_id: formData.customer_id || null,
              contact_id: null,
              assigned_to: formData.assigned_to || null,
              priority: formData.priority,
              status: 'to_do',
              notes: formData.serviceOrderNotes
            }]);

          if (serviceError) {
            console.error('Errore creazione CdL:', serviceError);
            toast({
              title: "Attenzione",
              description: `Commessa di produzione creata ma errore nella creazione della CdL collegata: ${serviceError.message}`,
              variant: "destructive",
            });
          } else {
            toast({
              title: "Successo",
              description: `Commessa di produzione e CdL collegata creati con successo`,
            });
          }
        } else {
          toast({
            title: "Successo",
            description: "Commessa di produzione creata con successo",
          });
        }
      }

      setIsDialogOpen(false);
      setSelectedWO(null);
      setFormData({ 
        title: "", 
        bom_id: "", 
        accessori_ids: [],
        customer_id: "",
        assigned_to: "",
        back_office_manager: "",
        priority: "medium",
        planned_start_date: "", 
        planned_end_date: "", 
        notes: "",
        createServiceOrder: false,
        serviceOrderTitle: "",
        serviceOrderNotes: ""
      });
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (wo: WorkOrder) => {
    setSelectedWO(wo);
    // Find the BOM ID by matching the name and version
    const bomMatch = boms.find(bom => 
      bom.name === wo.boms?.name && bom.version === wo.boms?.version
    );
    
    setFormData({
      title: wo.title,
      bom_id: bomMatch?.id || "",
      accessori_ids: wo.accessori_ids || [],
      customer_id: wo.customer_id || "",
      assigned_to: wo.assigned_to || "",
      back_office_manager: wo.back_office_manager || "",
      priority: wo.priority || "medium",
      planned_start_date: wo.planned_start_date || "",
      planned_end_date: wo.planned_end_date || "",
      notes: wo.notes || "",
      createServiceOrder: false,
      serviceOrderTitle: "",
      serviceOrderNotes: ""
    });
    setIsDialogOpen(true);
  };

  const handleViewDetails = async (wo: WorkOrder) => {
    setSelectedWO(wo);
    setShowDetailsDialog(true);
    
    // No need to load files separately - they're already in wo.attachments
    setParentOrderFiles(Array.isArray(wo.attachments) ? wo.attachments : []);
  };

  const handleExport = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Numero,Titolo,Cliente,Tecnico,Priorità,Stato,Inizio Pianificato\n"
      + filteredWorkOrders.map(wo => 
          `${wo.number},"${wo.title}","${wo.customers?.name || ''}","${wo.technician ? `${wo.technician.first_name} ${wo.technician.last_name}` : ''}","${wo.priority}","${wo.status}","${wo.planned_start_date || ''}"`
        ).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "ordini_produzione.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleStatusChange = async (woId: string, newStatus: 'da_fare' | 'in_lavorazione' | 'in_test' | 'pronto' | 'completato' | 'standby' | 'bloccato') => {
    // Trova l'ordine corrente per salvare lo stato precedente
    const currentWO = workOrders.find(wo => wo.id === woId);
    if (!currentWO) return;
    
    const previousStatus = currentWO.status as string;
    
    // Funzione per cambiare lo stato
    const changeStatus = async () => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', woId);

      if (error) throw error;
      
      await fetchWorkOrders();
      return { woId, previousStatus, newStatus };
    };
    
    // Funzione per annullare il cambio di stato
    const undoStatusChange = async () => {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: previousStatus as any })
        .eq('id', woId);

      if (error) throw error;
      
      await fetchWorkOrders();
    };
    
    try {
      await executeWithUndo(
        changeStatus,
        undoStatusChange,
        {
          successMessage: `Stato aggiornato a: ${
            newStatus === 'da_fare' ? 'Da Fare' :
            newStatus === 'in_lavorazione' ? 'In Lavorazione' :
            newStatus === 'in_test' ? 'In Test' :
            newStatus === 'pronto' ? 'Pronto' :
            newStatus === 'completato' ? 'Completato' :
            newStatus === 'standby' ? 'Standby' :
            'Bloccato'
          }`,
          errorMessage: 'Impossibile aggiornare lo stato',
          duration: 10000 // 10 secondi
        }
      );
    } catch (error: any) {
      // Errore già gestito da executeWithUndo
      console.error('Error changing status:', error);
    }
  };

  const handleArchive = async (woId: string, currentArchived: boolean) => {
    const newArchived = !currentArchived;
    
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ archived: newArchived })
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: newArchived ? "Ordine archiviato" : "Ordine ripristinato",
      });
      
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
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

      const { error } = await supabase
        .from('work_orders')
        .update({ assigned_to: user.id })
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Ti sei assegnato questa commessa con successo",
      });

      fetchWorkOrders();
      if (selectedWO?.id === workOrderId) {
        setShowDetailsDialog(false);
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (woId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa commessa di produzione?")) {
      return;
    }

    try {
      // Prima controlla se ci sono service work orders collegati
      const { data: linkedServiceOrders, error: checkError } = await supabase
        .from('service_work_orders')
        .select('id')
        .eq('production_work_order_id', woId);

      if (checkError) throw checkError;

      if (linkedServiceOrders && linkedServiceOrders.length > 0) {
        const shouldProceed = confirm(
          `Questa commessa di produzione ha ${linkedServiceOrders.length} ordini di servizio collegati. Eliminandola, anche questi verranno scollegati. Vuoi continuare?`
        );
        
        if (!shouldProceed) return;

        // Scollega gli ordini di servizio impostando production_work_order_id a null
        const { error: unlinkError } = await supabase
          .from('service_work_orders')
          .update({ production_work_order_id: null })
          .eq('production_work_order_id', woId);

        if (unlinkError) throw unlinkError;
      }

      // Ora elimina la commessa di produzione
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', woId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Commessa di produzione eliminata con successo",
      });
      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDownloadReport = async () => {
    const doc = new jsPDF();
    
    // Titolo
    doc.setFontSize(18);
    doc.text("Report Commesse di Produzione", 14, 20);
    
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
      
      const statusLabel = wo.status === "da_fare" ? "Da Fare" :
        wo.status === "in_lavorazione" ? "In Lavorazione" :
        wo.status === "in_test" ? "In Test" :
        wo.status === "pronto" ? "Pronto" :
        wo.status === "completato" ? "Completato" :
        wo.status === "standby" ? "Standby" : "Bloccato";
      
      const basicInfo = [
        ["Cliente", wo.customers?.name || "-"],
        ["Stato", statusLabel],
        ["Priorità", wo.priority === "high" ? "Alta" : wo.priority === "medium" ? "Media" : "Bassa"],
        ["Assegnato A", wo.technician ? `${wo.technician.first_name} ${wo.technician.last_name}` : "-"],
        ["BOM", wo.boms ? `${wo.boms.name} v${wo.boms.version}` : "-"],
        ["Inizio Pianificato", wo.planned_start_date ? format(new Date(wo.planned_start_date), "dd/MM/yyyy HH:mm", { locale: it }) : "-"],
        ["Fine Pianificata", wo.planned_end_date ? format(new Date(wo.planned_end_date), "dd/MM/yyyy HH:mm", { locale: it }) : "-"],
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
      
      // Carica e mostra composizione BOM
      if (wo.bom_id) {
        try {
          const { data: bomItems } = await supabase
            .from('bom_inclusions')
            .select(`
              quantity,
              included_bom:included_bom_id(name, version, level)
            `)
            .eq('parent_bom_id', wo.bom_id)
            .order('included_bom_id');
          
          if (bomItems && bomItems.length > 0) {
            if (yPosition > 250) {
              doc.addPage();
              yPosition = 20;
            }
            
            doc.setFont("helvetica", "bold");
            doc.text("Composizione BOM:", 14, yPosition);
            yPosition += 5;
            
            const bomData = bomItems.map((item: any) => [
              item.included_bom?.name || "-",
              item.included_bom?.version || "-",
              `Livello ${item.included_bom?.level || "-"}`,
              item.quantity.toString()
            ]);
            
            autoTable(doc, {
              head: [["Componente", "Versione", "Livello", "Quantità"]],
              body: bomData,
              startY: yPosition,
              styles: { fontSize: 8, cellPadding: 2 },
              headStyles: { fillColor: [59, 130, 246] },
              columnStyles: {
                0: { cellWidth: 70 },
                1: { cellWidth: 30 },
                2: { cellWidth: 30 },
                3: { cellWidth: 30 }
              }
            });
            
            yPosition = (doc as any).lastAutoTable.finalY + 5;
          }
        } catch (error) {
          console.error('Error fetching BOM items:', error);
        }
      }
      
      // Carica e mostra articoli
      try {
        const { data: articles } = await (supabase as any)
          .from('work_order_articles')
          .select('*, materials(name, code)')
          .eq('work_order_id', wo.id)
          .order('created_at');
        
        if (articles && articles.length > 0) {
          if (yPosition > 240) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Articoli:", 14, yPosition);
          yPosition += 5;
          
          const articleData = articles.map((a: any) => [
            a.materials?.code || "-",
            a.materials?.name || a.article_name || "-",
            a.quantity.toString(),
            a.serial_number || "-",
            a.notes || "-"
          ]);
          
          autoTable(doc, {
            head: [["Codice", "Nome", "Quantità", "Seriale", "Note"]],
            body: articleData,
            startY: yPosition,
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 25 },
              1: { cellWidth: 50 },
              2: { cellWidth: 20 },
              3: { cellWidth: 30 },
              4: { cellWidth: 55 }
            }
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 5;
        }
      } catch (error) {
        console.error('Error fetching articles:', error);
      }
      
      // Carica e mostra commenti
      try {
        const { data: comments } = await supabase
          .from('work_order_comments')
          .select('*, profiles(first_name, last_name)')
          .eq('work_order_id', wo.id)
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
          .from('work_order_activities')
          .select('*, profiles(first_name, last_name)')
          .eq('work_order_id', wo.id)
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
      
      // Carica e mostra esecuzioni/fasi di lavoro
      try {
        const { data: executions } = await (supabase as any)
          .from('executions')
          .select('*, profiles(first_name, last_name)')
          .eq('work_order_id', wo.id)
          .order('start_time', { ascending: true });
        
        if (executions && executions.length > 0) {
          if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Fasi di Lavoro (Esecuzioni):", 14, yPosition);
          yPosition += 5;
          
          const executionData = executions.map((e: any) => {
            const duration = e.end_time 
              ? `${Math.round((new Date(e.end_time).getTime() - new Date(e.start_time).getTime()) / 60000)} min`
              : "In corso";
            
            return [
              e.step_name || "-",
              e.profiles ? `${e.profiles.first_name} ${e.profiles.last_name}` : "-",
              format(new Date(e.start_time), "dd/MM HH:mm", { locale: it }),
              e.end_time ? format(new Date(e.end_time), "dd/MM HH:mm", { locale: it }) : "In corso",
              duration,
              e.notes || "-"
            ];
          });
          
          autoTable(doc, {
            head: [["Fase", "Operatore", "Inizio", "Fine", "Durata", "Note"]],
            body: executionData,
            startY: yPosition,
            styles: { fontSize: 7, cellPadding: 1.5 },
            headStyles: { fillColor: [59, 130, 246] },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 25 },
              2: { cellWidth: 22 },
              3: { cellWidth: 22 },
              4: { cellWidth: 18 },
              5: { cellWidth: 58 }
            }
          });
          
          yPosition = (doc as any).lastAutoTable.finalY + 5;
        }
      } catch (error) {
        console.error('Error fetching executions:', error);
      }
      
      // Carica e mostra log delle modifiche
      try {
        const { data: logs } = await (supabase as any)
          .from('work_order_logs')
          .select('*, profiles(first_name, last_name)')
          .eq('work_order_id', wo.id)
          .order('created_at', { ascending: false })
          .limit(15);
        
        if (logs && logs.length > 0) {
          if (yPosition > 240) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Storico Modifiche:", 14, yPosition);
          yPosition += 5;
          
          const logData = logs.map((l: any) => {
            let details = l.action;
            if (l.details?.changes) {
              const changes = l.details.changes;
              if (changes.status) {
                details += `: ${changes.status.old} → ${changes.status.new}`;
              }
              if (changes.assigned_to) {
                details += `: riassegnato`;
              }
              if (changes.priority) {
                details += `: priorità ${changes.priority.old} → ${changes.priority.new}`;
              }
            }
            
            return [
              format(new Date(l.created_at), "dd/MM HH:mm", { locale: it }),
              l.profiles ? `${l.profiles.first_name} ${l.profiles.last_name}` : "Sistema",
              details
            ];
          });
          
          autoTable(doc, {
            head: [["Data", "Utente", "Modifica"]],
            body: logData,
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
        console.error('Error fetching logs:', error);
      }
      
      // Carica e mostra file allegati
      if (wo.attachments && wo.attachments.length > 0) {
        if (yPosition > 260) {
          doc.addPage();
          yPosition = 20;
        }
        
        doc.setFont("helvetica", "bold");
        doc.text("File Allegati:", 14, yPosition);
        yPosition += 5;
        doc.setFont("helvetica", "normal");
        
        wo.attachments.forEach((file: any) => {
          const fileName = file.name || file.file_path?.split('/').pop() || "File";
          doc.text(`• ${fileName}`, 14, yPosition);
          yPosition += 5;
        });
        yPosition += 3;
      }
      
      // Carica e mostra service work orders collegati
      try {
        const { data: serviceOrders } = await supabase
          .from('service_work_orders')
          .select('number, title, status')
          .eq('production_work_order_id', wo.id);
        
        if (serviceOrders && serviceOrders.length > 0) {
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
          }
          
          doc.setFont("helvetica", "bold");
          doc.text("Commesse di Lavoro Collegate:", 14, yPosition);
          yPosition += 5;
          doc.setFont("helvetica", "normal");
          
          serviceOrders.forEach((so: any) => {
            doc.text(`• ${so.number}: ${so.title} (${so.status})`, 14, yPosition);
            yPosition += 5;
          });
          yPosition += 3;
        }
      } catch (error) {
        console.error('Error fetching service orders:', error);
      }
      
      // Collegamenti
      const links: string[] = [];
      if (wo.sales_orders) {
        links.push(`Ordine Vendita: ${wo.sales_orders.number}`);
      }
      if (wo.leads) {
        links.push(`Lead: ${wo.leads.company_name}`);
      }
      if (wo.offers) {
        links.push(`Offerta: ${wo.offers.number}`);
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
    doc.save(`report-commesse-produzione-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
    
    toast({
      title: "Report scaricato",
      description: "Il report PDF è stato generato con successo",
    });
  };

  const normalizeStatus = (status: string): string => {
    // Non normalizziamo più - usiamo gli stati come sono nel DB
    return status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'da_fare': return 'bg-muted';
      case 'in_lavorazione': return 'bg-amber-500';
      case 'in_test': return 'bg-orange-500';
      case 'pronto': return 'bg-blue-500';
      case 'completato': return 'bg-success';
      case 'standby': return 'bg-purple-500';
      case 'bloccato': return 'bg-destructive';
      // Legacy support
      case 'to_do': return 'bg-muted';
      case 'test': return 'bg-orange-500';
      case 'pronti': return 'bg-blue-500';
      case 'spediti_consegnati': return 'bg-success';
      case 'completed':
      case 'closed': return 'bg-success';
      default: return 'bg-muted';
    }
  };

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const newStatus = destination.droppableId;
    const woId = draggableId;

    try {
      const { error } = await supabase
        .from("work_orders")
        .update({ status: newStatus })
        .eq("id", woId);

      if (error) throw error;

      toast({
        title: "Stato aggiornato",
        description: "Lo stato della commessa di produzione è stato aggiornato",
      });

      fetchWorkOrders();
    } catch (error: any) {
      toast({
        title: "Errore",
        description: "Impossibile aggiornare lo stato",
        variant: "destructive",
      });
    }
  };

  const filteredWorkOrders = workOrders.filter(wo => {
    const matchesSearch = 
      wo.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      wo.boms?.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === "all") {
      matchesStatus = !wo.archived; // Mostra tutti tranne gli archiviati
    } else if (statusFilter === "active") {
      // Mostra solo ordini attivi (non archiviati)
      matchesStatus = !wo.archived;
    } else if (statusFilter === "archive") {
      // Mostra solo ordini archiviati
      matchesStatus = wo.archived === true;
    } else {
      matchesStatus = wo.status === statusFilter && !wo.archived;
    }
    
    return matchesSearch && matchesStatus;
  });

  const statusCounts = {
    all: workOrders.filter(wo => !wo.archived).length,
    active: workOrders.filter(wo => !wo.archived).length,
    da_fare: workOrders.filter(wo => wo.status === 'da_fare' && !wo.archived).length,
    in_lavorazione: workOrders.filter(wo => wo.status === 'in_lavorazione' && !wo.archived).length,
    in_test: workOrders.filter(wo => wo.status === 'in_test' && !wo.archived).length,
    pronto: workOrders.filter(wo => wo.status === 'pronto' && !wo.archived).length,
    completato: workOrders.filter(wo => wo.status === 'completato' && !wo.archived).length,
    standby: workOrders.filter(wo => wo.status === 'standby' && !wo.archived).length,
    bloccato: workOrders.filter(wo => wo.status === 'bloccato' && !wo.archived).length,
    archive: workOrders.filter(wo => wo.archived === true).length,
  };

  const workOrderStatuses = ['da_fare', 'in_lavorazione', 'in_test', 'pronto', 'completato', 'standby', 'bloccato'];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/mfg">Produzione</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbPage>Commesse di Produzione</BreadcrumbPage>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className={isMobile ? "space-y-3" : "flex items-center justify-between"}>
        <div>
          <h1 className={isMobile ? "text-2xl font-bold tracking-tight" : "text-3xl font-bold tracking-tight"}>
            Commesse di Produzione (CdP)
          </h1>
          <p className={isMobile ? "text-sm text-muted-foreground" : "text-muted-foreground"}>
            Pianifica e monitora le commesse di produzione durante il loro ciclo di vita. Per creare una nuova commessa, utilizza la sezione Ordini.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className={isMobile ? "grid grid-cols-2 gap-2" : "grid grid-cols-1 md:grid-cols-10 gap-4"}>
        {Object.entries(statusCounts).map(([status, count]) => (
          <Card 
            key={status} 
            className={`cursor-pointer transition-colors ${statusFilter === status ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            <CardContent className={isMobile ? "p-2" : "p-4"}>
              <div className="text-center">
                <div className={isMobile ? "text-lg font-bold" : "text-2xl font-bold"}>{count}</div>
                <div className={isMobile ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground capitalize"}>
                  {status === 'all' ? 'Tutti' : 
                   status === 'active' ? 'Attivi' :
                   status === 'da_fare' ? 'Da Fare' :
                   status === 'in_lavorazione' ? 'In Lavorazione' :
                   status === 'in_test' ? 'In Test' :
                   status === 'pronto' ? 'Pronto' :
                   status === 'completato' ? 'Completato' :
                   status === 'standby' ? 'Standby' :
                   status === 'bloccato' ? 'Bloccato' :
                   status === 'archive' ? 'Archivio' : status.replace('_', ' ')}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className={isMobile ? "text-base" : ""}>Ricerca e Filtri</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={isMobile ? "space-y-3" : "flex items-center space-x-4"}>
            <div className="relative flex-1">
              <Search className={isMobile ? "absolute left-2 top-2 h-3 w-3 text-muted-foreground" : "absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"} />
              <Input
                placeholder={isMobile ? "Cerca..." : "Cerca commesse di produzione..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={isMobile ? "pl-7 h-8 text-sm" : "pl-8"}
              />
            </div>
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban" | "calendar")} className={isMobile ? "w-full" : ""}>
              <TabsList className={isMobile ? "w-full grid grid-cols-3" : ""}>
                <TabsTrigger value="table" className={isMobile ? "text-xs py-1" : ""}>
                  <List className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Tabella"}
                </TabsTrigger>
                <TabsTrigger value="kanban" className={isMobile ? "text-xs py-1" : ""}>
                  <LayoutGrid className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Kanban"}
                </TabsTrigger>
                <TabsTrigger value="calendar" className={isMobile ? "text-xs py-1" : ""}>
                  <CalendarIcon className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Calendario"}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className={isMobile ? "flex gap-2" : "flex gap-2"}>
              <Button 
                variant={showArchivedOrders ? "default" : "outline"} 
                size={isMobile ? "sm" : "sm"}
                className={isMobile ? "flex-1 text-xs h-8" : ""}
                onClick={() => setShowArchivedOrders(!showArchivedOrders)}
              >
                {isMobile ? (showArchivedOrders ? "Nascondi" : "Archiviati") : (showArchivedOrders ? "Nascondi Archiviati" : "Mostra Archiviati")}
              </Button>
              <Button variant="outline" size={isMobile ? "sm" : "sm"} className={isMobile ? "flex-1 text-xs h-8" : ""} onClick={() => setShowFiltersDialog(true)}>
                <Filter className={isMobile ? "h-3 w-3" : "mr-2 h-4 w-4"} />
                {!isMobile && "Filtri"}
              </Button>
              <Button variant="outline" size={isMobile ? "sm" : "sm"} className={isMobile ? "flex-1 text-xs h-8" : ""} onClick={handleExport}>
                <Download className={isMobile ? "h-3 w-3" : "mr-2 h-4 w-4"} />
                {!isMobile && "Esporta"}
              </Button>
              <Button variant="outline" size={isMobile ? "sm" : "sm"} className={isMobile ? "flex-1 text-xs h-8 gap-1" : "gap-2"} onClick={handleDownloadReport}>
                <FileDown className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                {!isMobile && "Report PDF"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Orders Table or Kanban */}
      <Card>
        <CardHeader>
          <CardTitle>Commesse di Produzione ({filteredWorkOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {viewMode === "table" ? (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Numero</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Assegnato a</TableHead>
                  <TableHead>Priorità</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Caricamento commesse di produzione...
                    </TableCell>
                  </TableRow>
                ) : filteredWorkOrders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Nessuna commessa di produzione trovata
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWorkOrders.map((wo: any) => (
                    <TableRow 
                      key={wo.id}
                      onClick={() => handleViewDetails(wo)}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {wo.number}
                          {wo.service_work_orders && wo.service_work_orders.length > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              <Wrench className="w-3 h-3 mr-1" />
                              Installazione
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {wo.customers ? (
                          <div>
                            <div className="font-medium">{wo.customers.name}</div>
                            <div className="text-sm text-muted-foreground">({wo.customers.code})</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wo.technician ? (
                          <div>
                            <div className="font-medium">
                              {wo.technician.first_name} {wo.technician.last_name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {wo.technician.employee_code}
                            </div>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTakeOwnership(wo.id);
                            }}
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            Prendi in carico
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          wo.priority === 'urgent' ? 'destructive' :
                          wo.priority === 'high' ? 'default' :
                          wo.priority === 'medium' ? 'secondary' : 'outline'
                        }>
                          {wo.priority === 'urgent' ? 'Urgente' :
                           wo.priority === 'high' ? 'Alta' :
                           wo.priority === 'medium' ? 'Media' : 'Bassa'}
                        </Badge>
                      </TableCell>
                        <TableCell>
                          <div onClick={(e) => e.stopPropagation()}>
                            <Select 
                              value={wo.status} 
                              onValueChange={(value: 'da_fare' | 'in_lavorazione' | 'in_test' | 'pronto' | 'completato' | 'standby' | 'bloccato') => 
                                handleStatusChange(wo.id, value)
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue>
                                  <StatusBadge status={wo.status} />
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="da_fare">
                                  <Badge className="bg-muted text-muted-foreground">Da Fare</Badge>
                                </SelectItem>
                                <SelectItem value="in_lavorazione">
                                  <Badge className="bg-amber-500 text-white">In Lavorazione</Badge>
                                </SelectItem>
                                <SelectItem value="in_test">
                                  <Badge className="bg-orange-500 text-white">In Test</Badge>
                                </SelectItem>
                                <SelectItem value="pronto">
                                  <Badge className="bg-blue-500 text-white">Pronto</Badge>
                                </SelectItem>
                                <SelectItem value="completato">
                                  <Badge className="bg-success text-success-foreground">Completato</Badge>
                                </SelectItem>
                                <SelectItem value="standby">
                                  <Badge className="bg-purple-500 text-white">Standby</Badge>
                                </SelectItem>
                                <SelectItem value="bloccato">
                                  <Badge className="bg-destructive text-destructive-foreground">Bloccato</Badge>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                       <TableCell className="text-right">
                         <div className="flex items-center justify-end space-x-2">
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleEdit(wo);
                             }}
                           >
                             <Edit className="h-4 w-4" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleArchive(wo.id, wo.archived || false);
                             }}
                             title={wo.archived ? "Ripristina" : "Archivia"}
                           >
                             <Archive className="h-4 w-4" />
                           </Button>
                           <Button 
                             variant="ghost" 
                             size="sm" 
                             onClick={(e) => {
                               e.stopPropagation();
                               handleDelete(wo.id);
                             }}
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </div>
                       </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          ) : viewMode === "kanban" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-7 gap-4">
                {workOrderStatuses.map((status) => (
                  <div key={status} className="space-y-3">
                    <div className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                      {status === "da_fare" && "Da Fare"}
                      {status === "in_lavorazione" && "In Lavorazione"}
                      {status === "in_test" && "In Test"}
                      {status === "pronto" && "Pronto"}
                      {status === "completato" && "Completato"}
                      {status === "standby" && "Standby"}
                      {status === "bloccato" && "Bloccato"}
                      <span className="ml-2 text-xs">
                        ({filteredWorkOrders.filter(wo => wo.status === status).length})
                      </span>
                    </div>
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`min-h-[500px] p-3 rounded-lg border-2 border-dashed ${
                            snapshot.isDraggingOver ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                          <div className="space-y-2">
                            {filteredWorkOrders
                              .filter(wo => wo.status === status)
                              .map((wo, index) => (
                                <Draggable key={wo.id} draggableId={wo.id} index={index}>
                                  {(provided, snapshot) => (
                                     <div
                                       ref={provided.innerRef}
                                       {...provided.draggableProps}
                                       {...provided.dragHandleProps}
                                       onClick={() => handleViewDetails(wo)}
                                       className={`p-3 bg-card border rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-all ${
                                         snapshot.isDragging ? 'shadow-lg opacity-90 ring-2 ring-primary' : ''
                                       }`}
                                     >
                                      <div className="space-y-2.5">
                                        {/* Header con numero e priorità */}
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-sm text-foreground">{wo.number}</div>
                                            <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                              {wo.title}
                                            </div>
                                          </div>
                                          {wo.priority && (
                                            <Badge 
                                              variant={
                                                wo.priority === 'urgent' ? 'destructive' :
                                                wo.priority === 'high' ? 'default' :
                                                wo.priority === 'medium' ? 'secondary' : 'outline'
                                              }
                                              className="text-xs shrink-0"
                                            >
                                              {wo.priority === 'urgent' ? 'Urgente' :
                                               wo.priority === 'high' ? 'Alta' :
                                               wo.priority === 'medium' ? 'Media' : 'Bassa'}
                                            </Badge>
                                          )}
                                        </div>
                                        
                                        {/* Cliente e BOM */}
                                        <div className="space-y-1.5">
                                          {wo.customers && (
                                            <div className="flex items-start gap-1.5 text-xs">
                                              <span className="text-muted-foreground shrink-0">Cliente:</span>
                                              <span className="font-medium text-foreground line-clamp-1">{wo.customers.name}</span>
                                            </div>
                                          )}
                                          
                                          {wo.boms && (
                                            <div className="flex items-center gap-1">
                                              <Badge variant="outline" className="text-xs">
                                                {wo.boms.name}
                                              </Badge>
                                            </div>
                                          )}
                                        </div>
                                        
                                        {/* Responsabile e info aggiuntive */}
                                        <div className="pt-2 border-t space-y-1.5">
                                          {wo.technician ? (
                                            <div className="flex items-center gap-1.5 text-xs bg-primary/5 rounded px-2 py-1.5">
                                              <UserPlus className="h-3.5 w-3.5 text-primary shrink-0" />
                                              <div className="flex-1 min-w-0">
                                                <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Responsabile</span>
                                                <div className="font-medium text-foreground truncate">
                                                  {wo.technician.first_name} {wo.technician.last_name}
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleTakeOwnership(wo.id);
                                              }}
                                              className="w-full text-xs h-8"
                                            >
                                              <UserPlus className="h-3 w-3 mr-1.5" />
                                              Prendi in carico
                                            </Button>
                                          )}
                                          
                                          {wo.planned_start_date && (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                              <CalendarIcon className="h-3 w-3 shrink-0" />
                                              <span>Inizio: {new Date(wo.planned_start_date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}</span>
                                            </div>
                                          )}
                                        </div>
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
                  </div>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-2 mb-4">
                {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                  <div key={day} className="text-center font-medium text-sm text-muted-foreground p-2">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => {
                  const date = new Date();
                  date.setDate(date.getDate() - date.getDay() + i);
                  const dateStr = date.toISOString().split('T')[0];
                  const dayOrders = filteredWorkOrders.filter(wo => 
                    wo.planned_start_date && wo.planned_start_date.split('T')[0] === dateStr
                  );
                  
                  return (
                    <div key={i} className={`min-h-[100px] p-2 border rounded-lg ${
                      date.getMonth() !== new Date().getMonth() ? 'bg-muted/20' : 'bg-card'
                    }`}>
                      <div className="text-sm font-medium mb-1">{date.getDate()}</div>
                      <div className="space-y-1">
                        {dayOrders.map(wo => (
                          <div
                            key={wo.id}
                            onClick={() => handleViewDetails(wo)}
                            className="text-xs p-1 bg-primary/10 rounded cursor-pointer hover:bg-primary/20 transition-colors"
                          >
                            <div className="font-medium truncate">{wo.number}</div>
                            <div className="text-muted-foreground truncate">{wo.customers?.name}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Dettagli Commessa di Produzione</DialogTitle>
            <DialogDescription>
              Modifica i dettagli della commessa di produzione {selectedWO?.number}
            </DialogDescription>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Numero</Label>
                  <p className="text-sm mt-1">{selectedWO.number}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Stato</Label>
                  <Select 
                    value={selectedWO.status} 
                    onValueChange={async (value) => {
                      await handleStatusChange(selectedWO.id, value as any);
                      setSelectedWO({ ...selectedWO, status: value });
                    }}
                  >
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue>
                        <StatusBadge status={selectedWO.status} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="da_fare">
                        <Badge className="bg-muted text-muted-foreground">Da Fare</Badge>
                      </SelectItem>
                      <SelectItem value="in_lavorazione">
                        <Badge className="bg-amber-500 text-white">In Lavorazione</Badge>
                      </SelectItem>
                      <SelectItem value="in_test">
                        <Badge className="bg-orange-500 text-white">In Test</Badge>
                      </SelectItem>
                      <SelectItem value="pronto">
                        <Badge className="bg-blue-500 text-white">Pronto</Badge>
                      </SelectItem>
                      <SelectItem value="completato">
                        <Badge className="bg-success text-success-foreground">Completato</Badge>
                      </SelectItem>
                      <SelectItem value="standby">
                        <Badge className="bg-purple-500 text-white">Standby</Badge>
                      </SelectItem>
                      <SelectItem value="bloccato">
                        <Badge className="bg-destructive text-destructive-foreground">Bloccato</Badge>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Titolo</Label>
                <Input
                  value={selectedWO.title}
                  onChange={(e) => setSelectedWO({ ...selectedWO, title: e.target.value })}
                  onBlur={async () => {
                    try {
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ title: selectedWO.title })
                        .eq('id', selectedWO.id);
                      if (error) throw error;
                      toast({ 
                        title: "Successo",
                        description: "Titolo aggiornato" 
                      });
                      fetchWorkOrders();
                    } catch (error: any) {
                      console.error('Error updating title:', error);
                      toast({ 
                        title: "Errore",
                        description: error.message,
                        variant: "destructive"
                      });
                    }
                  }}
                  className="mt-1"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <Select 
                    value={selectedWO.customer_id || "none"} 
                    onValueChange={async (value) => {
                      try {
                        const newCustomerId = value === "none" ? null : value;
                        const { error } = await supabase
                          .from('work_orders')
                          .update({ customer_id: newCustomerId })
                          .eq('id', selectedWO.id);
                        if (error) throw error;
                        toast({ 
                          title: "Successo",
                          description: "Cliente aggiornato" 
                        });
                        fetchWorkOrders();
                        const customer = customers.find(c => c.id === value);
                        setSelectedWO({ 
                          ...selectedWO, 
                          customer_id: newCustomerId,
                          customers: customer ? { name: customer.name, code: customer.code } : undefined
                        });
                      } catch (error: any) {
                        console.error('Error updating customer:', error);
                        toast({ 
                          title: "Errore",
                          description: error.message,
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun cliente</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Priorità</Label>
                  <Select 
                    value={selectedWO.priority || "medium"} 
                    onValueChange={async (value) => {
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ priority: value })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ title: "Priorità aggiornata" });
                        fetchWorkOrders();
                        setSelectedWO({ ...selectedWO, priority: value });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Bassa</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="urgent">Urgente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Lead</Label>
                  {selectedWO.leads ? (
                    <Link 
                      to={`/crm/opportunities?lead=${selectedWO.lead_id}`}
                      className="text-sm text-primary hover:underline flex items-center gap-1 mt-1"
                    >
                      {selectedWO.leads.company_name}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Non collegato</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Ordine di Vendita</Label>
                  <p className="text-sm mt-1">
                    {selectedWO.sales_orders ? selectedWO.sales_orders.number : 'Non collegato'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Offerta Collegata</Label>
                  {selectedWO.offer_id && selectedWO.offers ? (
                    <Button
                      variant="link"
                      className="h-auto p-0 text-sm mt-1 text-primary hover:underline flex items-center gap-1"
                      onClick={() => {
                        navigate(`/crm/offers?offer=${selectedWO.offer_id}`);
                      }}
                    >
                      {selectedWO.offers.number}
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  ) : (
                    <p className="text-sm text-muted-foreground mt-1">Nessuna offerta collegata</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm font-medium">Cliente</Label>
                  <p className="text-sm mt-1">
                    {selectedWO.customers ? `${selectedWO.customers.name} (${selectedWO.customers.code})` : 'Non collegato'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Tecnico Assegnato</Label>
                  <Select 
                    value={selectedWO.assigned_to || "none"} 
                    onValueChange={async (value) => {
                      const newAssignedTo = value === "none" ? null : value;
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ assigned_to: newAssignedTo })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ title: "Assegnazione aggiornata" });
                        fetchWorkOrders();
                        const user = users.find(u => u.id === value);
                        setSelectedWO({ 
                          ...selectedWO, 
                          assigned_to: newAssignedTo,
                          technician: user ? {
                            id: user.id,
                            first_name: user.first_name,
                            last_name: user.last_name,
                            employee_code: user.email?.split('@')[0] || ''
                          } : undefined
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nessun assegnato" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun assegnato</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Distinta Base</Label>
                  <Select 
                    value={selectedWO.bom_id || "none"} 
                    onValueChange={async (value) => {
                      const newBomId = value === "none" ? null : value;
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ bom_id: newBomId })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ 
                          title: "Successo",
                          description: "Distinta base aggiornata" 
                        });
                        fetchWorkOrders();
                        const bom = boms.find(b => b.id === value);
                        setSelectedWO({ 
                          ...selectedWO, 
                          bom_id: newBomId,
                          boms: bom ? { name: bom.name, version: bom.version } : undefined
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nessuna BOM" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessuna BOM</SelectItem>
                      {boms.map((bom) => (
                        <SelectItem key={bom.id} value={bom.id}>
                          {bom.name} (v{bom.version})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Back Office Manager</Label>
                  <Select 
                    value={selectedWO.back_office_manager || "none"} 
                    onValueChange={async (value) => {
                      try {
                        const newBackOfficeManager = value === "none" ? null : value;
                        const { error } = await supabase
                          .from('work_orders')
                          .update({ back_office_manager: newBackOfficeManager })
                          .eq('id', selectedWO.id);
                        if (error) throw error;
                        toast({ 
                          title: "Successo",
                          description: "Back Office Manager aggiornato" 
                        });
                        fetchWorkOrders();
                        const user = users.find(u => u.id === value);
                        setSelectedWO({ 
                          ...selectedWO, 
                          back_office_manager: newBackOfficeManager,
                          back_office: user ? {
                            id: user.id,
                            first_name: user.first_name,
                            last_name: user.last_name
                          } : undefined
                        });
                      } catch (error: any) {
                        console.error('Error updating back office manager:', error);
                        toast({ 
                          title: "Errore",
                          description: error.message,
                          variant: "destructive"
                        });
                      }
                    }}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nessun back office" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nessun back office</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.first_name} {user.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Accessori</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedWO.accessori_ids && selectedWO.accessori_ids.length > 0 
                      ? `${selectedWO.accessori_ids.length} accessori selezionati`
                      : 'Nessun accessorio'
                    }
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Data Inizio Pianificata</Label>
                  <Input
                    type="datetime-local"
                    value={selectedWO.planned_start_date || ""}
                    onChange={(e) => setSelectedWO({ ...selectedWO, planned_start_date: e.target.value })}
                    onBlur={async () => {
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ planned_start_date: selectedWO.planned_start_date || null })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ title: "Data inizio aggiornata" });
                        fetchWorkOrders();
                      }
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Data Fine Pianificata</Label>
                  <Input
                    type="datetime-local"
                    value={selectedWO.planned_end_date || ""}
                    onChange={(e) => setSelectedWO({ ...selectedWO, planned_end_date: e.target.value })}
                    onBlur={async () => {
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ planned_end_date: selectedWO.planned_end_date || null })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ title: "Data fine aggiornata" });
                        fetchWorkOrders();
                      }
                    }}
                    className="mt-1"
                  />
                </div>
              </div>


              {selectedWO.notes !== undefined && (
                <div>
                  <Label className="text-sm font-medium">Note</Label>
                  <Textarea
                    value={selectedWO.notes || ""}
                    onChange={(e) => setSelectedWO({ ...selectedWO, notes: e.target.value })}
                    onBlur={async () => {
                      const { error } = await supabase
                        .from('work_orders')
                        .update({ notes: selectedWO.notes })
                        .eq('id', selectedWO.id);
                      if (!error) {
                        toast({ title: "Note aggiornate" });
                        fetchWorkOrders();
                      }
                    }}
                    placeholder="Aggiungi note..."
                    rows={3}
                    className="mt-1"
                  />
                </div>
              )}

              {/* Articles */}
              {selectedWO.article && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Articoli</Label>
                  <WorkOrderArticles 
                    workOrderId={selectedWO.id} 
                    articleText={selectedWO.article} 
                  />
                </div>
              )}

              {/* Composizione BOM */}
              {selectedWO.bom_id && (
                <div className="border-t pt-4">
                  <BomComposition bomId={selectedWO.bom_id} />
                </div>
              )}
              
              {/* Work Order Files */}
              {parentOrderFiles.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3">File della Commessa</h4>
                  <OrderFileManager
                    orderId={selectedWO.id}
                    attachments={parentOrderFiles}
                    readOnly={true}
                    label="File e Foto"
                  />
                </div>
              )}

              {(selectedWO.planned_start_date || selectedWO.planned_end_date) && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground mb-2 block">Date Pianificate</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Inizio</Label>
                      <p className="text-sm">
                        {selectedWO.planned_start_date ? new Date(selectedWO.planned_start_date).toLocaleString('it-IT') : 'Non impostato'}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Fine</Label>
                      <p className="text-sm">
                        {selectedWO.planned_end_date ? new Date(selectedWO.planned_end_date).toLocaleString('it-IT') : 'Non impostato'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedWO.notes && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium text-muted-foreground">Note</Label>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{selectedWO.notes}</p>
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t pt-4">
                <WorkOrderComments workOrderId={selectedWO.id} />
              </div>

              {/* Activity Log */}
              <div className="border-t pt-4">
                <WorkOrderActivityLog workOrderId={selectedWO.id} />
              </div>

              {/* Actions */}
              <div className={isMobile ? "border-t pt-3 flex flex-col gap-2" : "border-t pt-4 flex gap-2"}>
                <Button
                  variant="destructive"
                  className={isMobile ? "w-full text-sm h-9" : "flex-1"}
                  size={isMobile ? "sm" : "default"}
                  onClick={() => {
                    setShowDetailsDialog(false);
                    handleDelete(selectedWO.id);
                  }}
                >
                  <Trash2 className={isMobile ? "h-3 w-3 mr-2" : "h-4 w-4 mr-2"} />
                  Elimina
                </Button>
                <Button
                  variant="outline"
                  className={isMobile ? "w-full text-sm h-9" : "flex-1"}
                  size={isMobile ? "sm" : "default"}
                  onClick={() => {
                    handleArchive(selectedWO.id, selectedWO.archived || false);
                    setShowDetailsDialog(false);
                  }}
                >
                  <Archive className={isMobile ? "h-3 w-3 mr-2" : "h-4 w-4 mr-2"} />
                  {selectedWO.archived ? 'Ripristina' : 'Archivia'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedWO ? 'Modifica Commessa di Produzione' : 'Nuova Commessa di Produzione'}</DialogTitle>
            <DialogDescription>
              {selectedWO ? 'Modifica i dettagli della commessa' : 'Crea una nuova commessa di produzione'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Titolo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Titolo della commessa"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bom_id">Distinta Base</Label>
                <Select value={formData.bom_id} onValueChange={(value) => setFormData({ ...formData, bom_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona BOM" />
                  </SelectTrigger>
                  <SelectContent>
                    {boms.map((bom) => (
                      <SelectItem key={bom.id} value={bom.id}>
                        {bom.name} (v{bom.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="customer_id">Cliente</Label>
                <div className="flex gap-2">
                  <Select value={formData.customer_id} onValueChange={(value) => setFormData({ ...formData, customer_id: value })}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Seleziona cliente" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name} ({customer.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="icon" onClick={() => setShowCreateCustomer(true)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="assigned_to">Assegna a</Label>
                <Select value={formData.assigned_to || "none"} onValueChange={(value) => setFormData({ ...formData, assigned_to: value === "none" ? "" : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Nessun assegnato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessun assegnato</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.first_name} {user.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priorità</Label>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Bassa</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="planned_start_date">Data Inizio Pianificata</Label>
                <Input
                  id="planned_start_date"
                  type="datetime-local"
                  value={formData.planned_start_date}
                  onChange={(e) => setFormData({ ...formData, planned_start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="planned_end_date">Data Fine Pianificata</Label>
                <Input
                  id="planned_end_date"
                  type="datetime-local"
                  value={formData.planned_end_date}
                  onChange={(e) => setFormData({ ...formData, planned_end_date: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPlannedDuration(24)}>
                +24h
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPlannedDuration(48)}>
                +48h
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setPlannedDuration(72)}>
                +72h
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Note</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Note aggiuntive"
                rows={3}
              />
            </div>

            {!selectedWO && (
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createServiceOrder"
                    checked={formData.createServiceOrder}
                    onCheckedChange={(checked) => setFormData({ ...formData, createServiceOrder: checked as boolean })}
                  />
                  <Label htmlFor="createServiceOrder" className="cursor-pointer">
                    Crea anche Commessa di Lavoro collegata
                  </Label>
                </div>

                {formData.createServiceOrder && (
                  <div className="space-y-3 pl-6 border-l-2">
                    <div className="space-y-2">
                      <Label htmlFor="serviceOrderTitle">Titolo CdL</Label>
                      <Input
                        id="serviceOrderTitle"
                        value={formData.serviceOrderTitle}
                        onChange={(e) => setFormData({ ...formData, serviceOrderTitle: e.target.value })}
                        placeholder="Titolo della commessa di lavoro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="serviceOrderNotes">Note CdL</Label>
                      <Textarea
                        id="serviceOrderNotes"
                        value={formData.serviceOrderNotes}
                        onChange={(e) => setFormData({ ...formData, serviceOrderNotes: e.target.value })}
                        placeholder="Note per la commessa di lavoro"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-2 border-t pt-4">
              <Button type="button" variant="outline" onClick={() => {
                setIsDialogOpen(false);
                setSelectedWO(null);
                setFormData({
                  title: "",
                  bom_id: "",
                  accessori_ids: [],
                  customer_id: "",
                  assigned_to: "",
                  back_office_manager: "",
                  priority: "medium",
                  planned_start_date: "",
                  planned_end_date: "",
                  notes: "",
                  createServiceOrder: false,
                  serviceOrderTitle: "",
                  serviceOrderNotes: ""
                });
              }}>
                Annulla
              </Button>
              <Button type="submit">
                {selectedWO ? 'Salva Modifiche' : 'Crea Commessa'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters Dialog */}
      <Dialog open={showFiltersDialog} onOpenChange={setShowFiltersDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtri Avanzati</DialogTitle>
            <DialogDescription>
              Applica filtri avanzati per raffinare la ricerca delle commesse di produzione
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Stato</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona stato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tutti gli stati</SelectItem>
                  <SelectItem value="da_fare">Da Fare</SelectItem>
                  <SelectItem value="in_lavorazione">In Lavorazione</SelectItem>
                  <SelectItem value="in_test">In Test</SelectItem>
                  <SelectItem value="pronto">Pronto</SelectItem>
                  <SelectItem value="completato">Completato</SelectItem>
                  <SelectItem value="standby">Standby</SelectItem>
                  <SelectItem value="bloccato">Bloccato</SelectItem>
                  <SelectItem value="archive">Archivio</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowFiltersDialog(false)}>
                Annulla
              </Button>
              <Button onClick={() => setShowFiltersDialog(false)}>
                Applica Filtri
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
    </div>
  );
}