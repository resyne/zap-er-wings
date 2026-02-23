import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { ReportDetailsDialog } from "@/components/support/ReportDetailsDialog";
import {
  ArrowLeft,
  Plus,
  Search,
  FileText,
  Receipt,
  CircleDollarSign,
  Calendar,
  User,
  Wrench,
  Archive,
  Trash2,
} from "lucide-react";
import jsPDF from "jspdf";

interface ServiceReport {
  id: string;
  report_number?: string;
  intervention_date: string;
  intervention_type: string;
  work_performed: string;
  status: string;
  customer_id?: string;
  technician_id: string;
  created_at: string;
  description?: string;
  materials_used?: string;
  notes?: string;
  start_time?: string;
  end_time?: string;
  amount?: number;
  vat_rate?: number;
  total_amount?: number;
  customer_signature?: string;
  technician_signature?: string;
  invoiced?: boolean;
  invoice_number?: string;
  payment_status?: string;
  archived?: boolean;
  kilometers?: number;
  technicians_count?: number;
  head_technician_hours?: number;
  specialized_technician_hours?: number;
  customers?: {
    id: string;
    name: string;
    company_name?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  };
  technicians?: {
    id: string;
    first_name: string;
    last_name: string;
    employee_code: string;
  };
}

type FilterStatus = "all" | "active" | "archived";

const statusFilters = [
  { key: "all" as FilterStatus, label: "Tutti" },
  { key: "active" as FilterStatus, label: "Attivi" },
  { key: "archived" as FilterStatus, label: "Archiviati" },
];

export default function ZAppServiceReportsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("active");
  const [selectedReport, setSelectedReport] = useState<ServiceReport | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from("service_reports")
        .select(`
          id, report_number, intervention_date, intervention_type, work_performed,
          status, customer_id, technician_id, created_at, description,
          materials_used, notes, start_time, end_time, amount, vat_rate,
          total_amount, customer_signature, technician_signature, invoiced,
          invoice_number, payment_status, archived, kilometers,
          technicians_count, head_technician_hours, specialized_technician_hours,
          customers (id, name, company_name, email, phone, address, city),
          technicians (id, first_name, last_name, employee_code)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports((data as unknown as ServiceReport[]) || []);
    } catch (error) {
      console.error("Error loading reports:", error);
      toast({ title: "Errore", description: "Errore nel caricamento rapporti", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter((r) => {
    // Status filter
    if (statusFilter === "active" && r.archived) return false;
    if (statusFilter === "archived" && !r.archived) return false;

    // Search
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const name = (r.customers?.name || "").toLowerCase();
      const company = (r.customers?.company_name || "").toLowerCase();
      const type = (r.intervention_type || "").toLowerCase();
      const num = (r.report_number || "").toLowerCase();
      return name.includes(s) || company.includes(s) || type.includes(s) || num.includes(s);
    }
    return true;
  });

  const handleArchiveToggle = async (report: ServiceReport, e: React.MouseEvent) => {
    e.stopPropagation();
    const newArchived = !report.archived;
    await supabase.from("service_reports").update({ archived: newArchived }).eq("id", report.id);
    setReports((prev) => prev.map((r) => (r.id === report.id ? { ...r, archived: newArchived } : r)));
    toast({ title: newArchived ? "Rapporto archiviato" : "Rapporto ripristinato" });
  };

  const handleDelete = async (report: ServiceReport, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Sei sicuro di voler eliminare questo rapporto?")) return;
    await supabase.from("service_report_materials").delete().eq("report_id", report.id);
    await supabase.from("service_reports").delete().eq("id", report.id);
    setReports((prev) => prev.filter((r) => r.id !== report.id));
    toast({ title: "Rapporto eliminato" });
  };

  const handleDownloadPDF = () => {
    if (!selectedReport) return;
    // Navigate to the full page for PDF generation
    toast({ title: "PDF", description: "Usa la versione desktop per generare il PDF" });
  };

  const handleSendEmail = () => {
    if (!selectedReport) return;
    toast({ title: "Email", description: "Usa la versione desktop per inviare email" });
  };

  const handleEdit = () => {
    if (!selectedReport) return;
    navigate("/hr/z-app/rapporti/nuovo");
  };

  return (
    <div className="flex flex-col h-full min-h-screen bg-muted/30">
      {/* Mobile header */}
      <div className="sticky top-0 z-20 bg-blue-600 text-white safe-area-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 shrink-0 h-9 w-9"
            onClick={() => navigate("/hr/z-app")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold truncate">Rapporti Intervento</h1>
          </div>
          <Button
            size="sm"
            className="bg-white text-blue-600 hover:bg-blue-50 shrink-0 font-semibold"
            onClick={() => navigate("/hr/z-app/rapporti/nuovo")}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuovo
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-blue-300" />
            <Input
              placeholder="Cerca cliente, tipo, numero..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 bg-white/15 border-white/20 text-white placeholder:text-blue-200 focus:bg-white/25"
            />
          </div>
        </div>

        {/* Filter pills */}
        <div className="px-4 pb-3">
          <div className="flex gap-2">
            {statusFilters.map((f) => {
              const isActive = statusFilter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-white text-blue-600"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reports list */}
      <div className="flex-1 overflow-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">Nessun rapporto trovato</p>
          </div>
        ) : (
          <div className="space-y-3 pb-20">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  setSelectedReport(report);
                  setShowDetails(true);
                }}
                className="bg-white rounded-xl p-4 shadow-sm border border-border active:scale-[0.98] transition-transform cursor-pointer"
              >
                {/* Top row: customer + date */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground text-[15px] truncate">
                      {report.customers?.name || "Cliente N/A"}
                    </h3>
                    {report.customers?.company_name && (
                      <p className="text-xs text-muted-foreground truncate">{report.customers.company_name}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {new Date(report.intervention_date).toLocaleDateString("it-IT", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    {report.report_number && (
                      <p className="text-[10px] text-muted-foreground font-mono">{report.report_number}</p>
                    )}
                  </div>
                </div>

                {/* Info row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    <span className="capitalize">{report.intervention_type}</span>
                  </span>
                  {report.technicians && (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {report.technicians.first_name} {report.technicians.last_name}
                    </span>
                  )}
                  {report.start_time && report.end_time && (
                    <span>{report.start_time}-{report.end_time}</span>
                  )}
                </div>

                {/* Work description preview */}
                {report.work_performed && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {report.work_performed}
                  </p>
                )}

                {/* Bottom row: amount + badges */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {report.invoiced ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 flex items-center gap-0.5">
                        <Receipt className="h-2.5 w-2.5" />
                        Fatturato
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Non Fatt.</Badge>
                    )}
                    {report.payment_status === "pagato" ? (
                      <Badge className="text-[10px] px-1.5 py-0 h-5 bg-green-600 hover:bg-green-700 flex items-center gap-0.5">
                        <CircleDollarSign className="h-2.5 w-2.5" />
                        Pagato
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">Non Pagato</Badge>
                    )}
                  </div>

                  {report.total_amount ? (
                    <span className="text-sm font-bold text-foreground">
                      €{report.total_amount.toFixed(2)}
                    </span>
                  ) : null}
                </div>

                {/* Quick actions */}
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-muted-foreground"
                    onClick={(e) => handleArchiveToggle(report, e)}
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    {report.archived ? "Ripristina" : "Archivia"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] px-2 text-destructive"
                    onClick={(e) => handleDelete(report, e)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Elimina
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/hr/z-app/rapporti/nuovo")}
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full bg-blue-600 text-white shadow-lg flex items-center justify-center active:scale-90 transition-transform z-30"
      >
        <Plus className="h-7 w-7" />
      </button>

      {/* Report details dialog */}
      <ReportDetailsDialog
        open={showDetails}
        onOpenChange={setShowDetails}
        report={selectedReport}
        onDownloadPDF={handleDownloadPDF}
        onSendEmail={handleSendEmail}
        onEdit={handleEdit}
        onDelete={async () => {
          if (!selectedReport) return;
          if (!confirm("Sei sicuro di voler eliminare questo rapporto?")) return;
          await supabase.from("service_report_materials").delete().eq("report_id", selectedReport.id);
          await supabase.from("service_reports").delete().eq("id", selectedReport.id);
          setReports((prev) => prev.filter((r) => r.id !== selectedReport.id));
          setShowDetails(false);
          toast({ title: "Rapporto eliminato" });
        }}
      />
    </div>
  );
}
