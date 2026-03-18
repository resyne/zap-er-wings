import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CheckCircle, Clock, FileText, Wrench,
  Package, Truck, User, Calendar, Receipt, ClipboardList
} from "lucide-react";

interface OrderDetailSectionsProps {
  orderId: string;
  customerId?: string;
}

interface CommessaDetail {
  id: string;
  number: string;
  title: string;
  status: string;
  type: string;
  assigned_to: string | null;
  updated_at: string;
  commessa_phases: Array<{
    id: string;
    phase_type: string;
    status: string;
    phase_order: number;
    completed_date: string | null;
    assigned_to: string | null;
  }>;
}

interface OrderLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_id: string;
}

interface ServiceReport {
  id: string;
  report_number: string;
  intervention_date: string;
  intervention_type: string;
  technician_name: string;
  status: string;
  total_amount: number | null;
  is_warranty: boolean;
}

interface JournalEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  description: string;
  amount: number;
  document_type: string;
  document_number: string;
  status: string;
}

const commessaStatusConfig: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da Fare", color: "bg-gray-100 text-gray-700" },
  in_lavorazione: { label: "In Lavorazione", color: "bg-amber-100 text-amber-700" },
  in_progress: { label: "In Lavorazione", color: "bg-amber-100 text-amber-700" },
  pronto: { label: "Pronto", color: "bg-blue-100 text-blue-700" },
  completata: { label: "Completata", color: "bg-green-100 text-green-700" },
  archiviata: { label: "Archiviata", color: "bg-green-50 text-green-600" },
  annullata: { label: "Annullata", color: "bg-red-100 text-red-700" },
};

const phaseStatusConfig: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da Fare", color: "bg-gray-100 text-gray-600" },
  da_preparare: { label: "Da Preparare", color: "bg-gray-100 text-gray-600" },
  da_programmare: { label: "Da Programmare", color: "bg-gray-100 text-gray-600" },
  in_corso: { label: "In Corso", color: "bg-amber-100 text-amber-700" },
  completata: { label: "Completata", color: "bg-green-100 text-green-700" },
};

const phaseIcons: Record<string, any> = {
  produzione: Package,
  spedizione: Truck,
  installazione: Wrench,
  manutenzione: Wrench,
  riparazione: Wrench,
};

export function OrderDetailSections({ orderId, customerId }: OrderDetailSectionsProps) {
  const [commesse, setCommesse] = useState<CommessaDetail[]>([]);
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [serviceReports, setServiceReports] = useState<ServiceReport[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [orderId]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [commesseRes, logsRes, journalRes] = await Promise.all([
        supabase
          .from("commesse")
          .select(`
            id, number, title, status, type, assigned_to, updated_at,
            commessa_phases(id, phase_type, status, phase_order, completed_date, assigned_to)
          `)
          .eq("sales_order_id", orderId)
          .order("created_at", { ascending: true }),
        supabase
          .from("sales_order_logs")
          .select("id, action, details, created_at, user_id")
          .eq("sales_order_id", orderId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("journal_entries")
          .select("id, entry_date, entry_type, description, amount, document_type, document_number, status")
          .eq("sales_order_id", orderId),
      ]);

      const commesseData = (commesseRes.data || []) as unknown as CommessaDetail[];
      setCommesse(commesseData);
      setLogs((logsRes.data || []) as unknown as OrderLog[]);
      setJournalEntries((journalRes.data || []) as unknown as JournalEntry[]);

      // Load service reports linked to commesse (via customer_id for now)
      if (customerId) {
        // Get commesse IDs to find related service reports
        const commessaIds = commesseData.map(c => c.id);
        
        // Try to find service reports by customer_id that overlap with order dates
        const { data: reports } = await supabase
          .from("service_reports")
          .select("id, report_number, intervention_date, intervention_type, technician_name, status, total_amount, is_warranty")
          .eq("customer_id", customerId)
          .eq("status", "completed")
          .order("intervention_date", { ascending: false })
          .limit(10);
        
        setServiceReports((reports || []) as unknown as ServiceReport[]);
      }

      // Load profile names for user_ids in logs
      const userIds = new Set<string>();
      (logsRes.data || []).forEach((log: any) => {
        if (log.user_id && log.user_id !== "00000000-0000-0000-0000-000000000000") userIds.add(log.user_id);
      });
      commesseData.forEach(c => {
        if (c.assigned_to) userIds.add(c.assigned_to);
        c.commessa_phases?.forEach(p => { if (p.assigned_to) userIds.add(p.assigned_to); });
      });

      if (userIds.size > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("id", Array.from(userIds));
        
        const map: Record<string, string> = {};
        (profilesData || []).forEach((p: any) => {
          map[p.id] = p.first_name && p.last_name
            ? `${p.first_name} ${p.last_name}`
            : p.email || "Utente";
        });
        setProfiles(map);
      }
    } catch (err) {
      console.error("Error loading order details:", err);
    } finally {
      setLoading(false);
    }
  };

  const getProfileName = (userId: string | null) => {
    if (!userId || userId === "00000000-0000-0000-0000-000000000000") return "Sistema";
    return profiles[userId] || "Utente";
  };

  const getLogDescription = (log: OrderLog) => {
    const details = log.details;
    if (log.action === "created") return "Ordine creato";
    if (log.action === "updated" && details?.changes) {
      const changes = details.changes;
      const parts: string[] = [];
      if (changes.status) parts.push(`Stato: ${changes.status.old || "—"} → ${changes.status.new || "—"}`);
      if (changes.total_amount) parts.push(`Importo aggiornato`);
      if (changes.invoiced) parts.push(changes.invoiced.new ? "Fatturato" : "Fatturazione rimossa");
      if (changes.invoice_number) parts.push(`Fattura: ${changes.invoice_number.new}`);
      return parts.length > 0 ? parts.join(" · ") : "Ordine aggiornato";
    }
    return details?.message || "Aggiornamento";
  };

  const hasAccountingDocs = journalEntries.length > 0;

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Accounting Alert */}
      {!hasAccountingDocs && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-amber-800">Nessun documento contabile collegato</p>
            <p className="text-xs text-amber-700 mt-1">
              Questo ordine non ha ancora fatture, registrazioni contabili o documenti fiscali associati. 
              Verificare e collegare i documenti pertinenti.
            </p>
          </div>
        </div>
      )}

      {/* Accounting Documents */}
      {hasAccountingDocs && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-green-600" />
            <h3 className="font-semibold text-sm">Documenti Contabili ({journalEntries.length})</h3>
          </div>
          <div className="space-y-2">
            {journalEntries.map(je => (
              <div key={je.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{je.description || je.document_type}</p>
                  <p className="text-xs text-muted-foreground">
                    {je.document_number && `${je.document_number} · `}
                    {new Date(je.entry_date).toLocaleDateString("it-IT")}
                  </p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  <p className="text-sm font-semibold">€{(je.amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  <Badge variant="outline" className="text-[10px]">{je.entry_type}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commesse Detail */}
      {commesse.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Commesse ({commesse.length})</h3>
          </div>
          <div className="space-y-3">
            {commesse.map(c => {
              const sc = commessaStatusConfig[c.status] || commessaStatusConfig.da_fare;
              const isComplete = c.status === "completata" || c.status === "archiviata";
              const phases = (c.commessa_phases || []).sort((a, b) => a.phase_order - b.phase_order);

              return (
                <div key={c.id} className={`border rounded-lg overflow-hidden ${isComplete ? "border-green-200 bg-green-50/30" : "border-border"}`}>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{c.number}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{c.title}</p>
                      </div>
                      <Badge className={`${sc.color} text-[10px] shrink-0`}>{sc.label}</Badge>
                    </div>

                    {c.assigned_to && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>{getProfileName(c.assigned_to)}</span>
                      </div>
                    )}

                    {isComplete && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        <span>Completata il {new Date(c.updated_at).toLocaleDateString("it-IT")}</span>
                      </div>
                    )}
                  </div>

                  {/* Phases */}
                  {phases.length > 0 && (
                    <div className="border-t border-border/50 px-3 py-2 bg-muted/20 space-y-1.5">
                      {phases.map(phase => {
                        const ps = phaseStatusConfig[phase.status] || phaseStatusConfig.da_fare;
                        const PhaseIcon = phaseIcons[phase.phase_type] || Package;
                        const phaseComplete = phase.status === "completata";
                        
                        return (
                          <div key={phase.id} className="flex items-center gap-2 text-xs">
                            <PhaseIcon className={`h-3.5 w-3.5 ${phaseComplete ? "text-green-600" : "text-muted-foreground"}`} />
                            <span className="capitalize flex-1">{phase.phase_type}</span>
                            {phase.assigned_to && (
                              <span className="text-muted-foreground">{getProfileName(phase.assigned_to)}</span>
                            )}
                            <Badge variant="outline" className={`${ps.color} text-[10px] px-1.5 py-0 border-0`}>
                              {ps.label}
                            </Badge>
                            {phase.completed_date && (
                              <span className="text-muted-foreground text-[10px]">
                                {new Date(phase.completed_date).toLocaleDateString("it-IT")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Service Reports */}
      {serviceReports.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm">Rapporti di Intervento ({serviceReports.length})</h3>
          </div>
          <div className="space-y-2">
            {serviceReports.map(sr => (
              <div key={sr.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{sr.report_number}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <Calendar className="h-3 w-3" />
                    {new Date(sr.intervention_date).toLocaleDateString("it-IT")}
                    {sr.technician_name && <span>· {sr.technician_name}</span>}
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{sr.intervention_type?.replace(/_/g, " ")}</p>
                </div>
                <div className="text-right shrink-0 ml-2">
                  {sr.is_warranty ? (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">Garanzia</Badge>
                  ) : sr.total_amount ? (
                    <p className="text-sm font-semibold">€{sr.total_amount.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Log */}
      {logs.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Cronologia ({logs.length})</h3>
          </div>
          <div className="space-y-2">
            {logs.map(log => (
              <div key={log.id} className="flex gap-3 text-sm py-2 border-b border-border/50 last:border-0">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${
                  log.action === "created" ? "bg-green-100" : "bg-muted"
                }`}>
                  {log.action === "created" ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm">{getLogDescription(log)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {getProfileName(log.user_id)} · {new Date(log.created_at).toLocaleDateString("it-IT")} {new Date(log.created_at).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
