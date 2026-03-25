import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import {
  Search, Loader2, Wrench, Truck, Settings, MapPin, Package, Clock,
  ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Building2,
  CreditCard, Calendar, FileText, User, Factory
} from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────
interface CommessaPhase {
  id: string;
  phase_type: string;
  phase_order: number;
  status: string;
  assigned_to?: string;
  scheduled_date?: string;
  started_date?: string;
  completed_date?: string;
  notes?: string;
}

interface Commessa {
  id: string;
  number: string;
  title: string;
  description?: string;
  type: string;
  delivery_mode?: string;
  intervention_type?: string;
  priority?: string;
  status: string;
  current_phase: number;
  article?: string;
  notes?: string;
  diameter?: string;
  smoke_inlet?: string;
  payment_on_delivery?: boolean;
  payment_amount?: number;
  is_warranty?: boolean;
  shipping_address?: string;
  shipping_city?: string;
  shipping_country?: string;
  shipping_province?: string;
  shipping_postal_code?: string;
  archived: boolean;
  deadline?: string;
  created_at: string;
  sales_order_id?: string;
  customer_name?: string;
  customer_code?: string;
  bom_name?: string;
  bom_version?: string;
  sales_order_number?: string;
  phases: CommessaPhase[];
}

interface CustomerGroup {
  key: string;
  customerName: string;
  customerCode?: string;
  commesse: Commessa[];
  orderNumbers: string[];
  earliestDate?: string;
  latestDate?: string;
  articlesSummary: string[];
}

// ─── Constants ───────────────────────────────────────────────
const statusLabels: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da fare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  da_preparare: { label: "Da preparare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  da_programmare: { label: "Da programmare", color: "bg-amber-100 text-amber-700 border-amber-200" },
  programmata: { label: "Programmata", color: "bg-blue-100 text-blue-700 border-blue-200" },
  da_completare: { label: "Da completare", color: "bg-orange-100 text-orange-700 border-orange-200" },
  planned: { label: "Pianificato", color: "bg-blue-100 text-blue-700 border-blue-200" },
  in_lavorazione: { label: "In lavorazione", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  in_test: { label: "In test", color: "bg-purple-100 text-purple-700 border-purple-200" },
  pronto: { label: "Pronto", color: "bg-cyan-100 text-cyan-700 border-cyan-200" },
  completato: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
  completata: { label: "Completata", color: "bg-green-100 text-green-700 border-green-200" },
  spedito: { label: "Spedito", color: "bg-green-100 text-green-700 border-green-200" },
  standby: { label: "Standby", color: "bg-gray-100 text-gray-600 border-gray-200" },
  bloccato: { label: "Bloccato", color: "bg-red-100 text-red-700 border-red-200" },
  in_progress: { label: "In corso", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  completed: { label: "Completato", color: "bg-green-100 text-green-700 border-green-200" },
};

const phaseConfig: Record<string, { label: string; icon: any; color: string; lightBg: string; text: string; border: string }> = {
  produzione: { label: "Produzione", icon: Factory, color: "bg-purple-500", lightBg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  spedizione: { label: "Spedizione", icon: Truck, color: "bg-amber-500", lightBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  installazione: { label: "Installazione", icon: MapPin, color: "bg-blue-500", lightBg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  manutenzione: { label: "Manutenzione", icon: Wrench, color: "bg-teal-500", lightBg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  riparazione: { label: "Riparazione", icon: Settings, color: "bg-red-500", lightBg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
  intervento: { label: "Intervento", icon: Wrench, color: "bg-teal-500", lightBg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
};

const statusFlowByPhaseType: Record<string, { value: string; label: string }[]> = {
  produzione: [
    { value: "da_fare", label: "Da fare" },
    { value: "in_lavorazione", label: "In lavorazione" },
    { value: "in_test", label: "In test" },
    { value: "standby", label: "Standby" },
    { value: "bloccato", label: "Bloccato" },
    { value: "pronto", label: "Pronto" },
  ],
  spedizione: [
    { value: "da_preparare", label: "Da preparare" },
    { value: "in_lavorazione", label: "In preparazione" },
    { value: "pronto", label: "Pronto" },
    { value: "spedito", label: "Spedito" },
  ],
  installazione: [
    { value: "da_programmare", label: "Da programmare" },
    { value: "programmata", label: "Programmata" },
    { value: "da_completare", label: "Da completare" },
    { value: "completata", label: "Completata" },
  ],
  manutenzione: [
    { value: "da_programmare", label: "Da programmare" },
    { value: "in_lavorazione", label: "In corso" },
    { value: "completata", label: "Completata" },
  ],
  riparazione: [
    { value: "da_programmare", label: "Da programmare" },
    { value: "in_lavorazione", label: "In corso" },
    { value: "completata", label: "Completata" },
  ],
  intervento: [
    { value: "da_fare", label: "Da fare" },
    { value: "in_lavorazione", label: "In corso" },
    { value: "standby", label: "Standby" },
    { value: "completata", label: "Completata" },
  ],
};

const completedStatuses = ["completato", "completata", "spedito", "completed", "closed"];

const priorityLabels: Record<string, { label: string; color: string; icon?: boolean }> = {
  low: { label: "Bassa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600 font-semibold", icon: true },
  urgent: { label: "Urgente", color: "text-red-600 font-bold", icon: true },
};

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  try { return format(new Date(d), "dd MMM yyyy", { locale: it }); } catch { return d; }
};

// ─── Phase Card ──────────────────────────────────────────────
function PhaseCard({ phase, commessa, onStatusChange, isPending }: {
  phase: CommessaPhase;
  commessa: Commessa;
  onStatusChange: (phaseId: string, newStatus: string, commessa: Commessa) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = phaseConfig[phase.phase_type] || phaseConfig.produzione;
  const Icon = config.icon;
  const statusInfo = statusLabels[phase.status] || { label: phase.status, color: "bg-muted text-muted-foreground" };
  const statusFlow = statusFlowByPhaseType[phase.phase_type] || statusFlowByPhaseType.produzione;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`rounded-lg border ${config.border} overflow-hidden bg-background`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${config.lightBg}`}>
                <Icon className={`h-4 w-4 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-primary">{commessa.number}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono uppercase">
                    {config.label}
                  </Badge>
                </div>
                <p className="text-sm font-medium truncate mt-0.5">{commessa.title}</p>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{fmtDate(commessa.created_at)}</span>
                  {phase.scheduled_date && <span>• Previsto: {fmtDate(phase.scheduled_date)}</span>}
                  {commessa.article && <span className="truncate max-w-[200px]">• {commessa.article.split('\n')[0]}</span>}
                  {commessa.priority && priorityLabels[commessa.priority] && (
                    <span className={priorityLabels[commessa.priority].color}>• {priorityLabels[commessa.priority].label}</span>
                  )}
                </div>
              </div>
              <Badge className={`${statusInfo.color} text-[10px] px-2 border flex-shrink-0`}>{statusInfo.label}</Badge>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-3 py-3 space-y-3">
            {/* Status change */}
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Cambia stato</p>
              <div className="flex flex-wrap gap-1.5">
                {statusFlow.map(s => {
                  const isActive = phase.status === s.value;
                  const si = statusLabels[s.value];
                  return (
                    <button
                      key={s.value}
                      disabled={isActive || isPending}
                      onClick={(e) => { e.stopPropagation(); onStatusChange(phase.id, s.value, commessa); }}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-all ${
                        isActive
                          ? `${si?.color || "bg-muted"} border-current ring-1 ring-offset-1 ring-current/20`
                          : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {isActive && <CheckCircle2 className="h-3 w-3 inline mr-1 -mt-0.5" />}
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Details */}
            {(commessa.diameter || commessa.smoke_inlet) && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {commessa.diameter && <p><span className="text-muted-foreground">Diametro:</span> {commessa.diameter}</p>}
                {commessa.smoke_inlet && <p><span className="text-muted-foreground">Fumi:</span> {commessa.smoke_inlet}</p>}
              </div>
            )}

            {phase.phase_type === "spedizione" && commessa.shipping_address && (
              <p className="flex items-start gap-1.5 text-xs">
                <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>{[commessa.shipping_address, commessa.shipping_city, commessa.shipping_province, commessa.shipping_postal_code, commessa.shipping_country].filter(Boolean).join(", ")}</span>
              </p>
            )}

            {commessa.payment_on_delivery && (
              <div className="flex items-center gap-1.5 text-xs text-amber-700 font-medium">
                <CreditCard className="h-3.5 w-3.5" />
                Pagamento alla consegna{commessa.payment_amount ? `: €${commessa.payment_amount.toLocaleString("it-IT")}` : ""}
              </div>
            )}

            {commessa.sales_order_number && (
              <p className="text-xs"><span className="text-muted-foreground">Ordine:</span> {commessa.sales_order_number}</p>
            )}

            {(commessa.notes || phase.notes) && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">Note</p>
                <p className="text-xs text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md">
                  {phase.notes || commessa.notes}
                </p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Phase Pipeline ──────────────────────────────────────────
function PhasePipeline({ commesse }: { commesse: Commessa[] }) {
  // Collect all phases from all commesse in this group
  const allPhases = commesse.flatMap(c => c.phases);
  const phaseTypes = [...new Set(allPhases.map(p => p.phase_type))];
  // Ensure consistent order
  const orderedTypes = ["produzione", "spedizione", "installazione", "manutenzione", "riparazione"].filter(t => phaseTypes.includes(t));

  return (
    <div className="flex items-center gap-1">
      {orderedTypes.map((pt, idx) => {
        const config = phaseConfig[pt] || phaseConfig.produzione;
        const Icon = config.icon;
        const phasesOfType = allPhases.filter(p => p.phase_type === pt);
        const allDone = phasesOfType.every(p => completedStatuses.includes(p.status));
        const someInProgress = phasesOfType.some(p => !completedStatuses.includes(p.status) && p.status !== "da_fare" && p.status !== "da_preparare" && p.status !== "da_programmare");

        return (
          <div key={pt} className="flex items-center">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              allDone ? "bg-green-100 text-green-700" :
              someInProgress ? `${config.lightBg} ${config.text}` :
              "bg-muted text-muted-foreground"
            }`}>
              {allDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
              <span>{config.label}</span>
              <span>({phasesOfType.length})</span>
            </div>
            {idx < orderedTypes.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 mx-1 flex-shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Customer Group Card ─────────────────────────────────────
function CustomerGroupCard({ group, onStatusChange, isPending }: {
  group: CustomerGroup;
  onStatusChange: (phaseId: string, newStatus: string, commessa: Commessa) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalPhases = group.commesse.reduce((sum, c) => sum + c.phases.length, 0);

  // Group phases by type across all commesse
  const phasesByType = useMemo(() => {
    const map: Record<string, { phase: CommessaPhase; commessa: Commessa }[]> = {};
    group.commesse.forEach(c => {
      c.phases.forEach(p => {
        if (!map[p.phase_type]) map[p.phase_type] = [];
        map[p.phase_type].push({ phase: p, commessa: c });
      });
    });
    return map;
  }, [group.commesse]);

  const orderedPhaseTypes = ["produzione", "spedizione", "installazione", "manutenzione", "riparazione"].filter(t => phasesByType[t]);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className="overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                <Building2 className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <p className="font-semibold text-base truncate">{group.customerName}</p>
                  <Badge variant="secondary" className="text-[10px]">{group.commesse.length} commesse · {totalPhases} fasi</Badge>
                  {group.orderNumbers.length > 0 && (
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {group.orderNumbers.join(" · ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5 flex-wrap">
                  {group.earliestDate && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {fmtDate(group.earliestDate)}
                      {group.latestDate && group.latestDate !== group.earliestDate && ` → ${fmtDate(group.latestDate)}`}
                    </span>
                  )}
                  {group.articlesSummary.length > 0 && (
                    <span className="flex items-center gap-1 truncate max-w-[400px]">
                      <Package className="h-3 w-3 flex-shrink-0" />
                      {group.articlesSummary.join(" | ")}
                    </span>
                  )}
                </div>
                <PhasePipeline commesse={group.commesse} />
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-4">
            <div className={`grid grid-cols-1 ${orderedPhaseTypes.length >= 3 ? 'lg:grid-cols-3' : orderedPhaseTypes.length === 2 ? 'lg:grid-cols-2' : ''} gap-4`}>
              {orderedPhaseTypes.map(pt => {
                const config = phaseConfig[pt] || phaseConfig.produzione;
                const items = phasesByType[pt];
                return (
                  <div key={pt} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${config.color}`} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {config.label} ({items.length})
                      </p>
                    </div>
                    {items.map(({ phase, commessa }) => (
                      <PhaseCard
                        key={phase.id}
                        phase={phase}
                        commessa={commessa}
                        onStatusChange={onStatusChange}
                        isPending={isPending}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Main Component ─────────────────────────────────────────
export default function CommesseUnificatePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [typeFilter, setTypeFilter] = useState("all");

  // ─── Data Fetching (unified commesse table) ────────────
  const { data: commesse = [], isLoading } = useQuery({
    queryKey: ["erp-commesse", statusFilter],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commesse")
        .select(`
          id, number, title, description, type, delivery_mode, intervention_type,
          priority, status, current_phase, article, notes, bom_id, lead_id,
          diameter, smoke_inlet, payment_on_delivery, payment_amount, is_warranty,
          shipping_address, shipping_city, shipping_country, shipping_province, shipping_postal_code,
          archived, deadline, created_at, sales_order_id,
          customers(name, code),
          boms(name, version),
          sales_orders(number),
          commessa_phases(id, phase_type, phase_order, status, assigned_to, scheduled_date, started_date, completed_date, notes)
        `)
        .eq("archived", statusFilter === "archived" ? true : false)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((c: any): Commessa => ({
        id: c.id,
        number: c.number,
        title: c.title,
        description: c.description,
        type: c.type,
        delivery_mode: c.delivery_mode,
        intervention_type: c.intervention_type,
        priority: c.priority,
        status: c.status,
        current_phase: c.current_phase ?? 0,
        article: c.article,
        notes: c.notes,
        diameter: c.diameter,
        smoke_inlet: c.smoke_inlet,
        payment_on_delivery: c.payment_on_delivery,
        payment_amount: c.payment_amount,
        is_warranty: c.is_warranty,
        shipping_address: c.shipping_address,
        shipping_city: c.shipping_city,
        shipping_country: c.shipping_country,
        shipping_province: c.shipping_province,
        shipping_postal_code: c.shipping_postal_code,
        archived: c.archived ?? false,
        deadline: c.deadline,
        created_at: c.created_at,
        sales_order_id: c.sales_order_id,
        customer_name: c.customers?.name,
        customer_code: c.customers?.code,
        bom_name: c.boms?.name,
        bom_version: c.boms?.version,
        sales_order_number: c.sales_orders?.number,
        phases: (c.commessa_phases || []).sort((a: any, b: any) => a.phase_order - b.phase_order),
      }));
    },
  });

  // ─── Status mutation (updates commessa_phases) ──────────
  const updateStatus = useMutation({
    mutationFn: async ({ phaseId, newStatus, commessa }: { phaseId: string; newStatus: string; commessa: Commessa }) => {
      const updates: any = { status: newStatus };
      if (newStatus === "in_lavorazione" || newStatus === "in_corso") {
        updates.started_date = new Date().toISOString();
      }
      if (completedStatuses.includes(newStatus)) {
        updates.completed_date = new Date().toISOString();
      }
      const { error } = await supabase.from("commessa_phases").update(updates).eq("id", phaseId);
      if (error) throw error;
      return { phaseId, newStatus, commessa };
    },
    onSuccess: async (_data) => {
      toast.success("Stato fase aggiornato");
      queryClient.invalidateQueries({ queryKey: ["erp-commesse"] });

      // Auto-archive if all phases completed
      if (_data.commessa && completedStatuses.includes(_data.newStatus)) {
        const updatedPhases = _data.commessa.phases.map(p =>
          p.id === _data.phaseId ? { ...p, status: _data.newStatus } : p
        );
        if (updatedPhases.every(p => completedStatuses.includes(p.status))) {
          await supabase.from("commesse").update({ archived: true, status: "completata" }).eq("id", _data.commessa.id);
          queryClient.invalidateQueries({ queryKey: ["erp-commesse"] });
          toast.success("Commessa completata e archiviata");
        }
      }
    },
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  const handleStatusChange = (phaseId: string, newStatus: string, commessa: Commessa) => {
    updateStatus.mutate({ phaseId, newStatus, commessa });
  };

  // ─── Filtering ─────────────────────────────────────────
  const filteredCommesse = useMemo(() => {
    return commesse.filter((c) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.number.toLowerCase().includes(q) ||
        (c.customer_name || "").toLowerCase().includes(q) || (c.article || "").toLowerCase().includes(q);
      if (statusFilter === "archived") return matchesSearch;
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && c.status !== "completata") ||
        (statusFilter === "completed" && c.status === "completata");
      const matchesType = typeFilter === "all" || c.phases.some(p => p.phase_type === typeFilter);
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [commesse, searchTerm, statusFilter, typeFilter]);

  // ─── Group by customer ─────────────────────────────────
  const customerGroups = useMemo((): CustomerGroup[] => {
    const groupMap = new Map<string, CustomerGroup>();
    filteredCommesse.forEach(c => {
      const key = c.customer_name || c.sales_order_id || c.id;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          key,
          customerName: c.customer_name || c.title,
          customerCode: c.customer_code,
          commesse: [],
          orderNumbers: [],
          articlesSummary: [],
        });
      }
      const group = groupMap.get(key)!;
      group.commesse.push(c);
      if (!group.customerCode && c.customer_code) group.customerCode = c.customer_code;
      const ref = c.sales_order_number || c.number;
      if (ref && !group.orderNumbers.includes(ref)) group.orderNumbers.push(ref);
      if (c.article) {
        const firstLine = c.article.split('\n')[0].trim();
        if (firstLine && !group.articlesSummary.includes(firstLine) && group.articlesSummary.length < 3) {
          group.articlesSummary.push(firstLine);
        }
      }
      const d = c.created_at;
      if (d && (!group.earliestDate || d < group.earliestDate)) group.earliestDate = d;
      if (d && (!group.latestDate || d > group.latestDate)) group.latestDate = d;
    });
    return Array.from(groupMap.values()).sort((a, b) => {
      const aActive = a.commesse.some(c => c.status !== "completata");
      const bActive = b.commesse.some(c => c.status !== "completata");
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      return a.customerName.localeCompare(b.customerName);
    });
  }, [filteredCommesse]);

  const totalCustomers = customerGroups.length;
  const totalCommesse = filteredCommesse.length;

  // Stats: count commesse that have at least one active phase of each type
  const stats = useMemo(() => {
    const activeCommesse = commesse.filter(c => c.status !== "completata");
    return {
      produzione: activeCommesse.filter(c => c.phases.some(p => p.phase_type === "produzione" && !completedStatuses.includes(p.status))).length,
      spedizione: activeCommesse.filter(c => c.phases.some(p => p.phase_type === "spedizione" && !completedStatuses.includes(p.status))).length,
      installazione: activeCommesse.filter(c => c.phases.some(p => (p.phase_type === "installazione" || p.phase_type === "manutenzione") && !completedStatuses.includes(p.status))).length,
    };
  }, [commesse]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Commesse</h1>
        <p className="text-muted-foreground">
          Pipeline unificata per cliente · {totalCustomers} clienti · {totalCommesse} commesse
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {([
          { key: "produzione", config: phaseConfig.produzione, count: stats.produzione },
          { key: "spedizione", config: phaseConfig.spedizione, count: stats.spedizione },
          { key: "installazione", config: phaseConfig.installazione, count: stats.installazione },
        ]).map(({ key, config, count }) => {
          const Icon = config.icon;
          return (
            <Card key={key} className="p-4">
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${config.lightBg}`}>
                  <Icon className={`h-5 w-5 ${config.text}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-xs text-muted-foreground">{config.label} attive</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca cliente, commessa, articolo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Attive</SelectItem>
            <SelectItem value="completed">Completate</SelectItem>
            <SelectItem value="archived">Archiviate</SelectItem>
            <SelectItem value="all">Tutte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="produzione">Produzione</SelectItem>
            <SelectItem value="spedizione">Spedizione</SelectItem>
            <SelectItem value="installazione">Installazione</SelectItem>
            <SelectItem value="manutenzione">Manutenzione</SelectItem>
          </SelectContent>
        </Select>

        {/* Phase legend */}
        <div className="flex items-center gap-4 ml-auto">
          {(["produzione", "spedizione", "installazione"] as const).map(phase => {
            const c = phaseConfig[phase];
            return (
              <div key={phase} className={`flex items-center gap-1.5 text-xs ${c.text} font-medium`}>
                <div className={`h-2.5 w-2.5 rounded-full ${c.color}`} />
                {c.label}
              </div>
            );
          })}
        </div>
      </div>

      {/* Customer groups */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : customerGroups.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">Nessuna commessa trovata</div>
        ) : (
          customerGroups.map(group => (
            <CustomerGroupCard
              key={group.key}
              group={group}
              onStatusChange={handleStatusChange}
              isPending={updateStatus.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}
