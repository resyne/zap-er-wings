import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Search, Filter, Download, Eye, Edit, Wrench, Trash2, LayoutGrid, List, ExternalLink, Calendar as CalendarIcon, Archive, UserPlus, FileDown, ChevronDown, History } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { format, parseISO, differenceInDays } from "date-fns";
import { it } from "date-fns/locale";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
import { ProductionTimeline } from "@/components/production/ProductionTimeline";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  created_at: string;
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
    company_name?: string;
    address?: string;
    city?: string;
    phone?: string;
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
    order_date?: string;
  };
  leads?: {
    id: string;
    company_name: string;
  };
  offers?: {
    number: string;
  };
  work_order_article_items?: Array<{
    id: string;
    description: string;
    is_completed: boolean;
    position: number;
  }>;
}

export default function WorkOrdersPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [boms, setBoms] = useState<any[]>([]);
  const [accessori, setAccessori] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]); // Per back office manager
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "timeline">("table");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showFiltersDialog, setShowFiltersDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [parentOrderFiles, setParentOrderFiles] = useState<any[]>([]);
  const [showArchivedOrders, setShowArchivedOrders] = useState(false);
  const [leadPhotos, setLeadPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);
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

  // Handle URL param to auto-open order details
  useEffect(() => {
    const orderId = searchParams.get('orderId');
    if (orderId && workOrders.length > 0) {
      const order = workOrders.find(wo => wo.id === orderId);
      if (order) {
        setSelectedWO(order);
        setShowDetailsDialog(true);
        // Clear the URL param after opening
        setSearchParams({});
      }
    }
  }, [searchParams, workOrders]);

  useEffect(() => {
    fetchWorkOrders();
    fetchBoms();
    fetchCustomers();
    fetchUsers();
    fetchTechnicians();
  }, [showArchivedOrders]);

  // Load lead photos when selectedWO changes
  useEffect(() => {
    const loadLeadPhotos = async () => {
      if (!selectedWO?.lead_id) {
        setLeadPhotos([]);
        return;
      }
      
      setLoadingPhotos(true);
      try {
        const { data: leadFiles, error } = await supabase
          .from('lead_files')
          .select('*')
          .eq('lead_id', selectedWO.lead_id);

        if (error) throw error;

        const mediaFiles = (leadFiles || []).filter(file => 
          file.file_type?.startsWith('image/') || 
          file.file_type?.startsWith('video/') ||
          /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
        );

        const photos = mediaFiles.map(file => ({
          url: supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl,
          name: file.file_name,
          type: file.file_type || ''
        }));

        setLeadPhotos(photos);
      } catch (error) {
        console.error('Error loading lead photos:', error);
        setLeadPhotos([]);
      } finally {
        setLoadingPhotos(false);
      }
    };

    if (showDetailsDialog && selectedWO) {
      loadLeadPhotos();
    }
  }, [selectedWO, showDetailsDialog]);

  const fetchWorkOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          boms(name, version),
          customers(name, code, company_name, address, city, phone),
          sales_orders(number, order_date),
          leads(id, company_name),
          offers(number),
          service_work_orders!production_work_order_id(id, number, title),
          work_order_article_items(id, description, is_completed, position)
        `)
        .order('updated_at', { ascending: false })
        .order('position', { referencedTable: 'work_order_article_items', ascending: true });

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
            // planned_start_date is auto-set by trigger to created_at
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
    
    // Format dates for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatDateForInput = (date: string | undefined) => {
      if (!date) return "";
      try {
        return new Date(date).toISOString().slice(0, 16);
      } catch {
        return "";
      }
    };
    
    setFormData({
      title: wo.title,
      bom_id: bomMatch?.id || "",
      accessori_ids: wo.accessori_ids || [],
      customer_id: wo.customer_id || "",
      assigned_to: wo.assigned_to || "",
      back_office_manager: wo.back_office_manager || "",
      priority: wo.priority || "medium",
      planned_start_date: formatDateForInput(wo.planned_start_date),
      planned_end_date: formatDateForInput(wo.planned_end_date),
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

  const generateWorkOrderHTML = (wo: WorkOrder) => {
    const statusLabels: Record<string, string> = {
      'da_fare': 'DA FARE',
      'in_lavorazione': 'IN LAVORAZIONE',
      'in_test': 'IN TEST',
      'pronto': 'PRONTO',
      'completato': 'COMPLETATO',
      'standby': 'STANDBY',
      'bloccato': 'BLOCCATO'
    };

    const priorityLabels: Record<string, string> = {
      'low': 'Bassa',
      'medium': 'Media',
      'high': 'Alta'
    };

    const priorityClasses: Record<string, string> = {
      'low': 'bassa',
      'medium': 'media',
      'high': 'alta'
    };

    const formatDate = (date: string | undefined) => {
      if (!date) return 'Non pianificata';
      try {
        return format(parseISO(date), 'dd/MM/yyyy, HH:mm:ss', { locale: it });
      } catch {
        return 'Data non valida';
      }
    };

    const articlesRows = wo.work_order_article_items
      ?.sort((a, b) => a.position - b.position)
      .map(item => `
        <tr>
          <td>1x</td>
          <td>${item.description}</td>
        </tr>
      `).join('') || '<tr><td colspan="2">Nessun articolo</td></tr>';

    // Replace placeholders in template
    return `    <div class="container">
        <!-- Header -->
        <div class="header">
            <h1>Commessa di Produzione</h1>
            <div class="subtitle">${wo.number}</div>
            <span class="status-badge">${statusLabels[wo.status] || wo.status}</span>
        </div>
        
        <!-- Content -->
        <div class="content">
            <!-- Informazioni Generali -->
            <div class="section">
                <h2 class="section-title">Informazioni Generali</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Numero Ordine</div>
                        <div class="info-value">${wo.number}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Titolo</div>
                        <div class="info-value">${wo.title}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Priorità</div>
                        <div class="info-value">
                            <span class="priority-badge priority-${priorityClasses[wo.priority || 'medium']}">${priorityLabels[wo.priority || 'medium']}</span>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Cliente</div>
                        <div class="info-value ${!wo.customers?.name ? 'empty' : ''}">${wo.customers?.name || 'Nessun cliente'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Lead</div>
                        <div class="info-value ${!wo.leads?.company_name ? 'empty' : ''}">${wo.leads?.company_name || 'Nessun lead'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Ordine di Vendita</div>
                        <div class="info-value ${!wo.sales_orders?.number ? 'empty' : ''}">${wo.sales_orders?.number || 'Nessun ordine di vendita'}</div>
                    </div>
                </div>
            </div>
            
            <!-- Risorse e Assegnazioni -->
            <div class="section">
                <h2 class="section-title">Risorse e Assegnazioni</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Tecnico Assegnato</div>
                        <div class="info-value ${!wo.technician ? 'empty' : ''}">${wo.technician ? `${wo.technician.first_name} ${wo.technician.last_name}` : 'Nessun assegnato'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Back Office Manager</div>
                        <div class="info-value ${!wo.back_office ? 'empty' : ''}">${wo.back_office ? `${wo.back_office.first_name} ${wo.back_office.last_name}` : 'Nessun back office'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Distinta Base</div>
                        <div class="info-value ${!wo.boms ? 'empty' : ''}">${wo.boms ? `${wo.boms.name} (${wo.boms.version})` : 'Nessuna BOM'}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Offerta Collegata</div>
                        <div class="info-value ${!wo.offers?.number ? 'empty' : ''}">${wo.offers?.number || 'Nessuna offerta collegata'}</div>
                    </div>
                </div>
            </div>
            
            <!-- Date Pianificate -->
            <div class="section">
                <h2 class="section-title">Pianificazione</h2>
                <div class="info-grid">
                    <div class="info-item">
                        <div class="info-label">Data Inizio Pianificata</div>
                        <div class="info-value">${formatDate(wo.planned_start_date)}</div>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Data Fine Pianificata</div>
                        <div class="info-value">${formatDate(wo.planned_end_date)}</div>
                    </div>
                </div>
            </div>
            
            <!-- Articoli -->
            <div class="section">
                <h2 class="section-title">Articoli</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Quantità</th>
                            <th>Descrizione</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${articlesRows}
                    </tbody>
                </table>
            </div>
            
            ${wo.notes ? `
            <!-- Note -->
            <div class="section">
                <h2 class="section-title">Note</h2>
                <div class="notes-box">
                    <strong>⚠️ Attenzione</strong>
                    ${wo.notes}
                </div>
            </div>
            ` : ''}
        </div>
        
        <!-- Footer -->
        <div class="footer">
            Report generato il ${format(new Date(), 'dd/MM/yyyy', { locale: it })} | Sistema di Gestione Commesse
        </div>
    </div>`;
  };

  const handleDownloadDetailedReport = async (wo: WorkOrder) => {
    try {
      toast({
        title: "Generazione report...",
        description: "Attendere prego"
      });

      const htmlContent = generateWorkOrderHTML(wo);
      
      // Create a temporary container for the HTML
      const container = document.createElement('div');
      container.innerHTML = htmlContent;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '700px';
      document.body.appendChild(container);

      // Wait for fonts and styles to load
      await new Promise(resolve => setTimeout(resolve, 100));

      // Use html2canvas to capture the HTML as an image
      const canvas = await html2canvas(container.querySelector('.container') as HTMLElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Remove the temporary container
      document.body.removeChild(container);

      // Create PDF from canvas
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 0;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`Report-${wo.number}.pdf`);

      toast({
        title: "Successo",
        description: "Report scaricato con successo"
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare il report",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (woId: string, newStatus: 'da_fare' | 'in_lavorazione' | 'in_test' | 'pronto' | 'completato' | 'standby' | 'bloccato') => {
    // Trova l'ordine corrente per salvare lo stato precedente
    const currentWO = workOrders.find(wo => wo.id === woId);
    if (!currentWO) return;
    
    const previousStatus = currentWO.status as string;
    
    const getStatusLabel = (status: string) => {
      switch(status) {
        case 'da_fare': return 'Da Fare';
        case 'in_lavorazione': return 'In Lavorazione';
        case 'in_test': return 'In Test';
        case 'pronto': return 'Pronto';
        case 'completato': return 'Completato';
        case 'standby': return 'Standby';
        case 'bloccato': return 'Bloccato';
        default: return status;
      }
    };
    
    // Funzione per cambiare lo stato
    const changeStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus })
        .eq('id', woId);

      if (error) throw error;
      
      // Log activity in work_order_logs table
      if (user) {
        await supabase
          .from('work_order_logs')
          .insert({
            work_order_id: woId,
            user_id: user.id,
            action: 'status_changed',
            details: {
              message: `Stato modificato da "${getStatusLabel(previousStatus)}" a "${getStatusLabel(newStatus)}"`,
              changes: {
                status: { old: previousStatus, new: newStatus }
              }
            }
          });
      }
      
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
          successMessage: `Stato aggiornato a: ${getStatusLabel(newStatus)}`,
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
    try {
      const ordersToExport = filteredWorkOrders; // Export ALL orders
      
      if (ordersToExport.length === 0) {
        toast({
          title: "Nessun ordine",
          description: "Non ci sono ordini da esportare",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Generazione report...",
        description: `Generazione report con ${ordersToExport.length} commesse...`
      });

      // Generate combined HTML for all work orders
      const allOrdersHTML = ordersToExport.map(wo => generateWorkOrderHTML(wo)).join('<div style="page-break-after: always;"></div>');
      
      const fullHTML = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Report Commesse di Produzione</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: Arial, sans-serif;
            line-height: 1.3;
            color: #333;
            background: #f5f5f5;
            padding: 5px;
            font-size: 11px;
        }
        
        .container {
            max-width: 700px;
            margin: 0 auto 20px;
            background: white;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 8px 12px;
            border-bottom: 2px solid #5568d3;
        }
        
        .header h1 {
            font-size: 16px;
            margin-bottom: 3px;
        }
        
        .header .subtitle {
            font-size: 10px;
            opacity: 0.9;
        }
        
        .status-badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: bold;
            margin-top: 3px;
            color: white;
        }
        
        .content {
            padding: 10px 12px;
        }
        
        .section {
            margin-bottom: 10px;
        }
        
        .section-title {
            font-size: 12px;
            font-weight: 600;
            color: #667eea;
            border-bottom: 1px solid #e0e0e0;
            padding-bottom: 3px;
            margin-bottom: 6px;
        }
        
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 6px;
            margin-bottom: 6px;
        }
        
        .info-item {
            background: #f8f9fa;
            padding: 5px 7px;
            border-radius: 3px;
            border-left: 2px solid #667eea;
        }
        
        .info-label {
            font-size: 9px;
            color: #666;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            margin-bottom: 2px;
            font-weight: 600;
        }
        
        .info-value {
            font-size: 11px;
            color: #333;
            font-weight: 500;
        }
        
        .info-value.empty {
            color: #999;
            font-style: italic;
            font-size: 10px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 5px;
            background: white;
            font-size: 10px;
        }
        
        table thead {
            background: #667eea;
            color: white;
        }
        
        table th {
            padding: 5px 6px;
            text-align: left;
            font-weight: 600;
            font-size: 10px;
        }
        
        table td {
            padding: 4px 6px;
            border-bottom: 1px solid #e0e0e0;
        }
        
        table tbody tr:hover {
            background: #f8f9fa;
        }
        
        .notes-box {
            background: #fff8e1;
            border-left: 2px solid #ffc107;
            padding: 6px 8px;
            border-radius: 2px;
            margin-top: 5px;
            font-size: 10px;
        }
        
        .notes-box strong {
            color: #f57c00;
            display: block;
            margin-bottom: 3px;
            font-size: 10px;
        }
        
        .footer {
            background: #f8f9fa;
            padding: 6px 12px;
            border-top: 1px solid #e0e0e0;
            text-align: center;
            color: #666;
            font-size: 9px;
        }
        
        .priority-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .priority-alta { background: #ffebee; color: #c62828; }
        .priority-media { background: #fff3e0; color: #ef6c00; }
        .priority-bassa { background: #e8f5e9; color: #2e7d32; }
        
        @media print {
            body {
                background: white;
                padding: 0;
            }
            .container {
                box-shadow: none;
                page-break-after: always;
            }
        }
    </style>
</head>
<body>
${allOrdersHTML}
</body>
</html>`;
      
      // Create a temporary container for the HTML
      const container = document.createElement('div');
      container.innerHTML = fullHTML;
      container.style.position = 'absolute';
      container.style.left = '-9999px';
      container.style.width = '700px';
      document.body.appendChild(container);

      // Wait for fonts and styles to load
      await new Promise(resolve => setTimeout(resolve, 200));

      // Create PDF with all pages
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const containers = container.querySelectorAll('.container');
      
      for (let i = 0; i < containers.length; i++) {
        if (i > 0) {
          pdf.addPage();
        }

        const canvas = await html2canvas(containers[i] as HTMLElement, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 0;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      }

      // Remove the temporary container
      document.body.removeChild(container);

      pdf.save(`Report-Commesse-Produzione-${format(new Date(), 'yyyy-MM-dd', { locale: it })}.pdf`);

      toast({
        title: "Successo",
        description: `Report con ${ordersToExport.length} commesse scaricato con successo`
      });
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast({
        title: "Errore",
        description: error.message || "Impossibile generare il report",
        variant: "destructive"
      });
    }
  };

  const handleDownloadOldReport = async () => {
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
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }
      
      doc.setFont("helvetica", "bold");
      doc.text("Articoli:", 14, yPosition);
      yPosition += 5;
      
      try {
        const { data: articles, error: articlesError } = await (supabase as any)
          .from('work_order_articles')
          .select('*, materials(name, code)')
          .eq('work_order_id', wo.id)
          .order('created_at');
        
        if (articlesError) {
          console.error('Error fetching articles:', articlesError);
          doc.setFont("helvetica", "italic");
          doc.text("Errore nel caricamento degli articoli", 14, yPosition);
          yPosition += 5;
        } else if (!articles || articles.length === 0) {
          doc.setFont("helvetica", "italic");
          doc.text("Nessun articolo presente", 14, yPosition);
          yPosition += 8;
        } else {
          const articleData = articles.map((a: any) => [
            a.materials?.code || a.article_code || "-",
            a.materials?.name || a.article_name || "-",
            a.quantity?.toString() || "0",
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
        doc.setFont("helvetica", "italic");
        doc.text("Errore nel caricamento degli articoli", 14, yPosition);
        yPosition += 5;
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

  const calculateAgingDays = (dateString?: string) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getAgingColor = (days: number) => {
    if (days <= 7) return 'text-green-600 dark:text-green-400';
    if (days <= 14) return 'text-yellow-600 dark:text-yellow-400';
    if (days <= 30) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
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

  const handleUpdateDates = async (workOrderId: string, startDate: string, endDate: string) => {
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({
          planned_start_date: startDate,
          planned_end_date: endDate,
          status: 'da_fare',
        })
        .eq('id', workOrderId);

      if (error) throw error;

      toast({
        title: "Successo",
        description: "Date aggiornate con successo",
      });

      fetchWorkOrders();
    } catch (error) {
      console.error('Error updating dates:', error);
      toast({
        title: "Errore",
        description: "Impossibile aggiornare le date",
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
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "kanban" | "timeline")} className={isMobile ? "w-full" : ""}>
              <TabsList className={isMobile ? "w-full grid grid-cols-3" : ""}>
                <TabsTrigger value="table" className={isMobile ? "text-xs py-1" : ""}>
                  <List className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Tabella"}
                </TabsTrigger>
                <TabsTrigger value="kanban" className={isMobile ? "text-xs py-1" : ""}>
                  <LayoutGrid className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Kanban"}
                </TabsTrigger>
                <TabsTrigger value="timeline" className={isMobile ? "text-xs py-1" : ""}>
                  <CalendarIcon className={isMobile ? "h-3 w-3" : "h-4 w-4 mr-2"} />
                  {!isMobile && "Timeline"}
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
          <div className="rounded-md border overflow-x-auto">
            <div className="min-w-[700px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Ordine</TableHead>
                    <TableHead className="min-w-[150px]">Cliente</TableHead>
                    <TableHead className="min-w-[110px]">Data Inserimento</TableHead>
                    <TableHead className="min-w-[250px]">Articoli</TableHead>
                    <TableHead className="min-w-[100px]">Priorità</TableHead>
                    <TableHead className="min-w-[120px]">Stato</TableHead>
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
                        <span className="font-semibold">
                          {wo.sales_orders?.number || wo.number}
                        </span>
                      </TableCell>
                      <TableCell>
                        {wo.customers ? (
                          <div className="space-y-0.5">
                            <span className="font-medium">{wo.customers.name}</span>
                            {wo.customers.code && (
                              <div className="text-xs text-muted-foreground">{wo.customers.code}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wo.sales_orders?.order_date ? (
                          <span className="text-sm">
                            {new Date(wo.sales_orders.order_date).toLocaleDateString('it-IT')}
                          </span>
                        ) : wo.created_at ? (
                          <span className="text-sm">
                            {new Date(wo.created_at).toLocaleDateString('it-IT')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {wo.work_order_article_items && wo.work_order_article_items.length > 0 ? (
                          <div className="space-y-1">
                            {wo.work_order_article_items.slice(0, 3).map((item: any) => (
                              <div key={item.id} className="text-xs">
                                <span>{item.description.split('\n')[0]}</span>
                              </div>
                            ))}
                            {wo.work_order_article_items.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{wo.work_order_article_items.length - 3} altri
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nessun articolo</span>
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
                        <StatusBadge status={wo.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          ) : viewMode === "kanban" ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-3 md:gap-4">
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
                                       <div className="space-y-2">
                                         {/* Header con numero ordine e priorità */}
                                         <div className="flex items-start justify-between gap-2">
                                           <div className="font-semibold text-sm md:text-base text-foreground">
                                             {wo.sales_orders?.number || wo.number}
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
                                         
                                         {/* Cliente e Data */}
                                         <div className="space-y-1">
                                           {wo.customers && (
                                             <div className="text-xs font-medium text-foreground">
                                               <div className="line-clamp-1">{wo.customers.name}</div>
                                               {wo.customers.code && (
                                                 <div className="text-[10px] text-muted-foreground">{wo.customers.code}</div>
                                               )}
                                             </div>
                                           )}
                                           
                                           <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-muted-foreground">
                                             <CalendarIcon className="h-3 w-3 shrink-0" />
                                             <span>
                                               {wo.sales_orders?.order_date 
                                                 ? new Date(wo.sales_orders.order_date).toLocaleDateString('it-IT')
                                                 : wo.created_at 
                                                   ? new Date(wo.created_at).toLocaleDateString('it-IT')
                                                   : '—'}
                                             </span>
                                           </div>
                                         </div>
                                            
                                         {/* Articoli */}
                                         {wo.work_order_article_items && wo.work_order_article_items.length > 0 && (
                                           <div className="space-y-1 pt-1 border-t">
                                             {wo.work_order_article_items.slice(0, 2).map((item: any) => (
                                               <div key={item.id} className="text-[10px] md:text-xs">
                                                 <span className="text-foreground">
                                                   {item.description.split('\n')[0]}
                                                 </span>
                                               </div>
                                             ))}
                                             {wo.work_order_article_items.length > 2 && (
                                               <div className="text-[10px] text-muted-foreground">
                                                 +{wo.work_order_article_items.length - 2} altri
                                               </div>
                                             )}
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
                  </div>
                ))}
              </div>
            </DragDropContext>
          ) : (
            <ProductionTimeline
              workOrders={filteredWorkOrders}
              onUpdateDates={handleUpdateDates}
              onViewDetails={handleViewDetails}
            />
          )}
        </CardContent>
      </Card>


      {/* Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Dettagli Commessa di Produzione</DialogTitle>
                <DialogDescription>
                  Modifica i dettagli della commessa di produzione {selectedWO?.number}
                </DialogDescription>
              </div>
              {selectedWO && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadDetailedReport(selectedWO)}
                  className="ml-4"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Scarica Report
                </Button>
              )}
            </div>
          </DialogHeader>
          {selectedWO && (
            <div className="space-y-6">
              {/* Activity Log - Collapsible at top */}
              <Collapsible>
                <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <History className="w-4 h-4" />
                    <span className="font-medium text-sm">Storico Attività</span>
                  </div>
                  <ChevronDown className="w-4 h-4 transition-transform duration-200 [&[data-state=open]>svg]:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <WorkOrderActivityLog workOrderId={selectedWO.id} />
                </CollapsibleContent>
              </Collapsible>
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
              
              {/* Priority and BOM Selection */}
              <div className="grid grid-cols-2 gap-4">
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

              {/* Planned Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Data Inizio Pianificata</Label>
                  <Input
                    type="datetime-local"
                    value={selectedWO.planned_start_date ? selectedWO.planned_start_date.slice(0, 16) : ""}
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
                    value={selectedWO.planned_end_date ? selectedWO.planned_end_date.slice(0, 16) : ""}
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

              {/* Customer Info - Display Only */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <Label className="text-sm font-medium">Dati Cliente</Label>
                {selectedWO.customers ? (
                  <div className="space-y-1 text-sm">
                    {selectedWO.customers.company_name && (
                      <p className="font-medium">{selectedWO.customers.company_name}</p>
                    )}
                    <p>{selectedWO.customers.name} ({selectedWO.customers.code})</p>
                    {selectedWO.customers.phone && (
                      <p className="text-muted-foreground">{selectedWO.customers.phone}</p>
                    )}
                    {(selectedWO.customers.address || selectedWO.customers.city) && (
                      <p className="text-muted-foreground">
                        {[selectedWO.customers.address, selectedWO.customers.city].filter(Boolean).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nessun cliente associato</p>
                )}
              </div>

              {selectedWO.offer_id && selectedWO.offers && (
                <div>
                  <Label className="text-sm font-medium">Offerta Collegata</Label>
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
              
              {/* Lead Photos Section */}
              {leadPhotos.length > 0 && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 block">Foto/Video Cliente</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {leadPhotos.map((photo, index) => (
                      <div 
                        key={index} 
                        className="relative group cursor-pointer"
                        onClick={() => setSelectedMedia({
                          url: photo.url,
                          name: photo.name,
                          isVideo: photo.type.startsWith('video/')
                        })}
                      >
                        {photo.type.startsWith('video/') ? (
                          <div className="relative w-full h-20">
                            <video 
                              src={photo.url}
                              className="w-full h-20 object-cover rounded-md border"
                              muted
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-md">
                              <div className="w-8 h-8 rounded-full bg-white/90 flex items-center justify-center">
                                <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-black border-b-[6px] border-b-transparent ml-1" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <img 
                            src={photo.url} 
                            alt={photo.name}
                            className="w-full h-20 object-cover rounded-md border hover:opacity-80 transition-opacity"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {loadingPhotos && (
                <div className="text-sm text-muted-foreground">Caricamento foto...</div>
              )}


              {/* Comments Section */}
              <div className="border-t pt-4">
                <WorkOrderComments workOrderId={selectedWO.id} />
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

      {/* Media Preview Modal */}
      <MediaPreviewModal
        open={!!selectedMedia}
        onOpenChange={(open) => !open && setSelectedMedia(null)}
        url={selectedMedia?.url || ''}
        name={selectedMedia?.name || ''}
        isVideo={selectedMedia?.isVideo || false}
      />

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