import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Loader2, Wrench, Truck, Settings,
  Calendar, MapPin, User, Package, Clock, ChevronDown,
  FileText, AlertTriangle, CheckCircle2, Image, Boxes,
  CreditCard, ChevronRight, Building2, CalendarPlus, Factory
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  bom_id?: string;
  lead_id?: string;
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
  assigned_to_name?: string;
  bom_name?: string;
  bom_version?: string;
  sales_order_number?: string;
  phases: CommessaPhase[];
}

// ─── Constants ───────────────────────────────────────────────
const phaseConfig: Record<string, { label: string; icon: any; color: string; lightBg: string; text: string; border: string }> = {
  produzione: { label: "Produzione", icon: Factory, color: "bg-purple-500", lightBg: "bg-purple-50", text: "text-purple-700", border: "border-purple-200" },
  spedizione: { label: "Spedizione", icon: Truck, color: "bg-amber-500", lightBg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  installazione: { label: "Installazione", icon: MapPin, color: "bg-blue-500", lightBg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  manutenzione: { label: "Manutenzione", icon: Wrench, color: "bg-teal-500", lightBg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200" },
  riparazione: { label: "Riparazione", icon: Settings, color: "bg-red-500", lightBg: "bg-red-50", text: "text-red-700", border: "border-red-200" },
};

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
  bloccata: { label: "Bloccata", color: "bg-red-100 text-red-700 border-red-200" },
  in_corso: { label: "In corso", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
};

const commessaStatusLabels: Record<string, { label: string; color: string }> = {
  da_fare: { label: "Da fare", color: "bg-amber-100 text-amber-700" },
  in_corso: { label: "In corso", color: "bg-indigo-100 text-indigo-700" },
  completata: { label: "Completata", color: "bg-green-100 text-green-700" },
  bloccata: { label: "Bloccata", color: "bg-red-100 text-red-700" },
};

const priorityLabels: Record<string, { label: string; color: string; icon?: boolean }> = {
  low: { label: "Bassa", color: "text-muted-foreground" },
  medium: { label: "Media", color: "text-amber-600" },
  high: { label: "Alta", color: "text-orange-600 font-semibold", icon: true },
  urgent: { label: "Urgente", color: "text-red-600 font-bold", icon: true },
};

const statusFlowByPhase: Record<string, Array<{ value: string; label: string }>> = {
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
};

const completedStatuses = ["pronto", "completato", "completata", "spedito", "completed", "closed"];

// ─── Sub-component: Articles checklist ─────────────
const MobileArticlesChecklist = memo(function MobileArticlesChecklist({ commessaId, legacyWorkOrderId }: { commessaId: string; legacyWorkOrderId?: string }) {
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadArticles(); }, [commessaId]);

  const loadArticles = async () => {
    if (!legacyWorkOrderId) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from("work_order_article_items")
        .select("*")
        .eq("work_order_id", legacyWorkOrderId)
        .order("position", { ascending: true });
      if (error) throw error;
      setArticles(data || []);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const toggleComplete = async (article: any) => {
    const newCompleted = !article.is_completed;
    const { error } = await supabase
      .from("work_order_article_items")
      .update({ is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq("id", article.id);
    if (error) { toast.error("Errore"); return; }
    setArticles(prev => prev.map(a => a.id === article.id ? { ...a, is_completed: newCompleted } : a));
    toast.success(newCompleted ? "Completato ✓" : "Riaperto");
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (articles.length === 0) return null;

  const completed = articles.filter(a => a.is_completed).length;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Da assemblare</p>
        <Badge variant="outline" className="text-[10px]">{completed}/{articles.length}</Badge>
      </div>
      {articles.map(article => (
        <button
          key={article.id}
          onClick={() => toggleComplete(article)}
          className="flex items-start gap-2 w-full text-left p-1.5 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <Checkbox checked={article.is_completed} className="mt-0.5 pointer-events-none" />
          <span className={`text-[12px] flex-1 whitespace-pre-wrap ${article.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
            {article.description}
          </span>
        </button>
      ))}
    </div>
  );
});

// ─── Lead Photos ─────────────
const MobileLeadPhotos = memo(function MobileLeadPhotos({ leadId }: { leadId: string }) {
  const [photos, setPhotos] = useState<Array<{ url: string; name: string; type: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; name: string; isVideo: boolean } | null>(null);

  useEffect(() => { loadPhotos(); }, [leadId]);

  const loadPhotos = async () => {
    try {
      const { data: leadFiles } = await supabase.from("lead_files").select("*").eq("lead_id", leadId);
      if (leadFiles) {
        const mediaFiles = leadFiles.filter(file =>
          file.file_type?.startsWith("image/") || file.file_type?.startsWith("video/") ||
          /\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|mkv)$/i.test(file.file_name)
        );
        setPhotos(mediaFiles.map(file => ({
          url: supabase.storage.from("lead-files").getPublicUrl(file.file_path).data.publicUrl,
          name: file.file_name,
          type: file.file_type || "",
        })));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  };

  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (photos.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
        <Image className="h-3 w-3" /> Foto Cliente
      </p>
      <div className="grid grid-cols-4 gap-1.5">
        {photos.map((photo, index) => {
          const isVideo = /\.(mp4|mov|avi|webm|mkv|ogg)$/i.test(photo.name);
          return (
            <button
              key={index}
              onClick={() => setPreviewMedia({ url: photo.url, name: photo.name, isVideo })}
              className="relative rounded-lg overflow-hidden border border-border aspect-square"
            >
              {isVideo ? (
                <>
                  <video src={photo.url} className="w-full h-full object-cover" muted preload="metadata" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                </>
              ) : (
                <img src={photo.url} alt={photo.name} className="w-full h-full object-cover" />
              )}
            </button>
          );
        })}
      </div>
      <MediaPreviewModal
        open={!!previewMedia}
        onOpenChange={(open) => !open && setPreviewMedia(null)}
        url={previewMedia?.url || ""}
        name={previewMedia?.name || ""}
        isVideo={previewMedia?.isVideo || false}
      />
    </div>
  );
});

// ─── Phase Pipeline Indicator ─────────────
const PhasePipeline = memo(function PhasePipeline({ phases }: { phases: CommessaPhase[] }) {
  const sortedPhases = [...phases].sort((a, b) => a.phase_order - b.phase_order);

  return (
    <div className="flex items-center gap-0 px-1">
      {sortedPhases.map((phase, idx) => {
        const config = phaseConfig[phase.phase_type] || phaseConfig.produzione;
        const Icon = config.icon;
        const isDone = completedStatuses.includes(phase.status);
        const isActive = !isDone && phase.status !== "da_fare" && phase.status !== "da_preparare" && phase.status !== "da_programmare";

        return (
          <div key={phase.id} className="flex items-center">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${
              isDone ? "bg-green-100 text-green-700" :
              isActive ? `${config.lightBg} ${config.text}` :
              "bg-muted text-muted-foreground"
            }`}>
              {isDone ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
              <span className="hidden sm:inline">{config.label}</span>
              <span className="text-[9px] opacity-75">({(statusLabels[phase.status] || { label: phase.status }).label})</span>
            </div>
            {idx < sortedPhases.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground/40 mx-0.5 flex-shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
});

// ─── Phase Card (inside commessa) ─────────────
const PhaseCard = memo(function PhaseCard({ phase, commessa, onStatusChange, onSchedule, isPending, isLocked }: {
  phase: CommessaPhase;
  commessa: Commessa;
  onStatusChange: (phaseId: string, newStatus: string) => void;
  onSchedule: (phase: CommessaPhase, commessa: Commessa) => void;
  isPending: boolean;
  isLocked: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = phaseConfig[phase.phase_type] || phaseConfig.produzione;
  const Icon = config.icon;
  const statusInfo = statusLabels[phase.status] || { label: phase.status, color: "bg-muted text-muted-foreground" };
  const statusFlow = statusFlowByPhase[phase.phase_type] || statusFlowByPhase.produzione;

  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM", { locale: it }); } catch { return d; }
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className={`rounded-lg border ${config.border} overflow-hidden bg-background ${isLocked ? "opacity-50" : ""}`}>
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-2.5 active:bg-muted/30 transition-colors">
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0 ${config.lightBg}`}>
                <Icon className={`h-3.5 w-3.5 ${config.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-medium">{config.label}</span>
                  {isLocked && <span className="text-[10px] text-muted-foreground">(bloccata - completa la fase precedente)</span>}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {phase.scheduled_date && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" /> {fmtDate(phase.scheduled_date)}
                    </span>
                  )}
                </div>
              </div>
              <Badge className={`${statusInfo.color} text-[9px] px-1.5 border flex-shrink-0`}>{statusInfo.label}</Badge>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 px-2.5 py-2.5 space-y-2.5">
            {/* Schedule */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Calendario</p>
                {phase.scheduled_date ? (
                  <p className="text-[11px] text-foreground">{fmtDate(phase.scheduled_date)}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Non calendarizzato</p>
                )}
              </div>
              {!isLocked && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSchedule(phase, commessa); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 active:scale-95 transition-all"
                >
                  <CalendarPlus className="h-3.5 w-3.5" />
                  {phase.scheduled_date ? "Modifica" : "Calendarizza"}
                </button>
              )}
            </div>

            {/* Status change */}
            {!isLocked && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Cambia stato</p>
                <div className="flex flex-wrap gap-1">
                  {statusFlow.map(s => {
                    const isActive = phase.status === s.value;
                    const si = statusLabels[s.value];
                    return (
                      <button
                        key={s.value}
                        disabled={isActive || isPending}
                        onClick={(e) => { e.stopPropagation(); onStatusChange(phase.id, s.value); }}
                        className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
                          isActive
                            ? `${si?.color || "bg-muted"} border-current ring-1 ring-offset-1 ring-current/20`
                            : "bg-background border-border text-muted-foreground hover:bg-muted/50 active:scale-95"
                        }`}
                      >
                        {isActive && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Phase-specific details */}
            {phase.phase_type === "spedizione" && commessa.shipping_address && (
              <p className="text-[11px] flex items-start gap-1.5">
                <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span>{[commessa.shipping_address, commessa.shipping_city, commessa.shipping_province, commessa.shipping_postal_code, commessa.shipping_country].filter(Boolean).join(", ")}</span>
              </p>
            )}

            {phase.notes && (
              <p className="text-[11px] text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{phase.notes}</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

// ─── Commessa Card ─────────────
const CommessaCard = memo(function CommessaCard({ commessa, onPhaseStatusChange, onSchedulePhase, isPending }: {
  commessa: Commessa;
  onPhaseStatusChange: (phaseId: string, newStatus: string) => void;
  onSchedulePhase: (phase: CommessaPhase, commessa: Commessa) => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortedPhases = [...commessa.phases].sort((a, b) => a.phase_order - b.phase_order);
  const overallStatus = commessaStatusLabels[commessa.status] || commessaStatusLabels.da_fare;
  const priorityInfo = commessa.priority ? priorityLabels[commessa.priority] : null;

  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM yyyy", { locale: it }); } catch { return d; }
  };

  // Determine which phases are locked (sequential blocking)
  const isPhseLocked = (phase: CommessaPhase): boolean => {
    if (phase.phase_order === 1) return false;
    const prevPhase = sortedPhases.find(p => p.phase_order === phase.phase_order - 1);
    return prevPhase ? !completedStatuses.includes(prevPhase.status) : false;
  };

  const typeLabels: Record<string, string> = {
    fornitura: "Fornitura",
    intervento: "Intervento",
    ricambi: "Ricambi",
    produzione: "Fornitura",
  };

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <div className="bg-background rounded-xl shadow-sm border border-border overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full text-left p-3 active:bg-muted/30 transition-colors">
            <div className="flex items-start gap-2.5">
              <div className="h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted">
                <Building2 className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="font-semibold text-[14px] truncate flex-1">
                    {commessa.customer_name || commessa.title}
                  </p>
                  {priorityInfo?.icon && <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />}
                  <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`} />
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground">{commessa.number}</span>
                  <Badge variant="outline" className="text-[9px] px-1.5">{typeLabels[commessa.type] || commessa.type}</Badge>
                </div>
                {commessa.article && commessa.article !== commessa.title && (
                  <p className="text-[11px] text-muted-foreground truncate mb-1">{commessa.article}</p>
                )}
                <PhasePipeline phases={commessa.phases} />
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Inserita il {fmtDate(commessa.created_at)}
                  </p>
                  {commessa.deadline && (
                    <p className={`text-[10px] font-medium flex items-center gap-1 ${
                      new Date(commessa.deadline) < new Date() ? "text-red-600" :
                      new Date(commessa.deadline) <= new Date(Date.now() + 2 * 86400000) ? "text-amber-600" :
                      "text-muted-foreground"
                    }`}>
                      ⏰ Scadenza: {fmtDate(commessa.deadline)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border/50 p-3 space-y-2">
            {/* Commessa details */}
            {(commessa.diameter || commessa.smoke_inlet) && (
              <div className="space-y-0.5 text-[11px]">
                {commessa.diameter && <p><span className="text-muted-foreground">Diametro:</span> {commessa.diameter}</p>}
                {commessa.smoke_inlet && <p><span className="text-muted-foreground">Fumi:</span> {commessa.smoke_inlet}</p>}
              </div>
            )}
            {commessa.bom_name && (
              <p className="text-[11px]"><span className="text-muted-foreground">BOM:</span> {commessa.bom_name} (v{commessa.bom_version})</p>
            )}
            {commessa.payment_on_delivery && (
              <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                <CreditCard className="h-3 w-3" />
                Pagamento alla consegna{commessa.payment_amount ? `: €${commessa.payment_amount.toLocaleString("it-IT")}` : ""}
              </div>
            )}
            {commessa.notes && (
              <p className="text-[11px] text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded-md">{commessa.notes}</p>
            )}
            {commessa.lead_id && <MobileLeadPhotos leadId={commessa.lead_id} />}

            {/* Phases */}
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Fasi ({sortedPhases.length})</p>
              {sortedPhases.map(phase => (
                <PhaseCard
                  key={phase.id}
                  phase={phase}
                  commessa={commessa}
                  onStatusChange={onPhaseStatusChange}
                  onSchedule={onSchedulePhase}
                  isPending={isPending}
                  isLocked={isPhseLocked(phase)}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
});

// ─── Main Component ─────────────────────────────────────────
export default function ZAppCommesse() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [schedulePhase, setSchedulePhase] = useState<{ phase: CommessaPhase; commessa: Commessa } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(value), 250);
  }, []);

  // ─── Mutations ──────────────────────────────────────
  const updatePhaseStatus = useMutation({
    mutationFn: async ({ phaseId, newStatus, commessa }: { phaseId: string; newStatus: string; commessa?: Commessa }) => {
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
    onMutate: async ({ phaseId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ["zapp-commesse"] });
      const previousData = queryClient.getQueryData<Commessa[]>(["zapp-commesse"]);
      queryClient.setQueryData<Commessa[]>(["zapp-commesse"], (old) =>
        old?.map(c => ({
          ...c,
          phases: c.phases.map(p => p.id === phaseId ? { ...p, status: newStatus } : p),
        })) || []
      );
      return { previousData };
    },
    onSuccess: (_data) => {
      toast.success("Stato fase aggiornato");
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      // Send WhatsApp notification for status change (fire and forget)
      if (_data.commessa) {
        const c = _data.commessa;
        supabase.functions.invoke("notify-commessa-status-change", {
          body: {
            commessa_id: c.id,
            commessa_title: c.title,
            commessa_type: c.type,
            new_status: _data.newStatus,
            customer_name: c.customer_name,
            deadline: c.deadline,
          },
        }).then(({ error }) => {
          if (error) console.error("Notification error:", error);
        });
      }
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(["zapp-commesse"], context.previousData);
      }
      toast.error("Errore: " + err.message);
    },
  });

  const schedulePhseMutation = useMutation({
    mutationFn: async ({ phaseId, date, phaseType }: { phaseId: string; date: string; phaseType?: string }) => {
      const updateData: any = { scheduled_date: date };
      // Se è un'installazione con stato "da_programmare", passa automaticamente a "programmata"
      if (phaseType === "installazione") {
        updateData.status = "programmata";
      }
      const { error } = await supabase.from("commessa_phases").update(updateData).eq("id", phaseId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fase calendarizzata");
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      setSchedulePhase(null);
    },
    onError: (err: any) => toast.error("Errore: " + err.message),
  });

  const handlePhaseStatusChange = useCallback((phaseId: string, newStatus: string) => {
    // Find the commessa that owns this phase to pass context for notifications
    const allCommesse = queryClient.getQueryData<Commessa[]>(["zapp-commesse"]);
    const commessa = allCommesse?.find(c => c.phases.some(p => p.id === phaseId));
    updatePhaseStatus.mutate({ phaseId, newStatus, commessa });
  }, [updatePhaseStatus, queryClient]);

  const handleOpenSchedule = useCallback((phase: CommessaPhase, commessa: Commessa) => {
    setSchedulePhase({ phase, commessa });
    setScheduleDate(phase.scheduled_date ? new Date(phase.scheduled_date) : undefined);
  }, []);

  const handleConfirmSchedule = useCallback(() => {
    if (!schedulePhase || !scheduleDate) return;
    schedulePhseMutation.mutate({
      phaseId: schedulePhase.phase.id,
      date: format(scheduleDate, "yyyy-MM-dd"),
      phaseType: schedulePhase.phase.phase_type,
    });
  }, [schedulePhase, scheduleDate, schedulePhseMutation]);

  // ─── Data Fetching ──────────────────────────────────────
  const { data: commesse = [], isLoading } = useQuery({
    queryKey: ["zapp-commesse"],
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
        .eq("archived", false)
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
        current_phase: c.current_phase,
        article: c.article,
        notes: c.notes,
        bom_id: c.bom_id,
        lead_id: c.lead_id,
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
        archived: c.archived,
        deadline: c.deadline,
        created_at: c.created_at,
        sales_order_id: c.sales_order_id,
        customer_name: c.customers?.name,
        customer_code: c.customers?.code,
        bom_name: c.boms?.name,
        bom_version: c.boms?.version,
        sales_order_number: c.sales_orders?.number,
        phases: c.commessa_phases || [],
      }));
    },
    staleTime: 30_000,
  });

  // Filter
  const filteredCommesse = useMemo(() => {
    return commesse.filter((c) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch = !q || c.title.toLowerCase().includes(q) || c.number.toLowerCase().includes(q) ||
        (c.customer_name || "").toLowerCase().includes(q) || (c.article || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" ||
        (statusFilter === "active" && c.status !== "completata") ||
        (statusFilter === "completed" && c.status === "completata");
      return matchesSearch && matchesStatus;
    });
  }, [commesse, debouncedSearch, statusFilter]);

  // Sort: priority desc, then active first, then by name
  const sortedCommesse = useMemo(() => {
    const priorityWeight = (p?: string) => p === 'urgent' ? 4 : p === 'high' ? 3 : p === 'medium' ? 2 : p === 'low' ? 1 : 0;
    return [...filteredCommesse].sort((a, b) => {
      const pa = priorityWeight(a.priority);
      const pb = priorityWeight(b.priority);
      if (pa !== pb) return pb - pa;
      if (a.status !== "completata" && b.status === "completata") return -1;
      if (a.status === "completata" && b.status !== "completata") return 1;
      return (a.customer_name || a.title).localeCompare(b.customer_name || b.title);
    });
  }, [filteredCommesse]);

  // ─── Page Layout ────────────────────────────────────────
  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <div className="bg-purple-600 text-white px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Commesse</h1>
            <p className="text-purple-100 text-xs">{sortedCommesse.length} commesse</p>
          </div>
        </div>
      </div>

      {/* Search + filters */}
      <div className="px-4 py-3 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca cliente, commessa..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} className="pl-9 rounded-xl bg-background" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[110px] rounded-xl bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Attive</SelectItem>
              <SelectItem value="completed">Completate</SelectItem>
              <SelectItem value="all">Tutte</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Commesse list */}
      <div className="px-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : sortedCommesse.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nessuna commessa trovata</div>
        ) : (
          sortedCommesse.map(commessa => (
            <CommessaCard
              key={commessa.id}
              commessa={commessa}
              onPhaseStatusChange={handlePhaseStatusChange}
              onSchedulePhase={handleOpenSchedule}
              isPending={updatePhaseStatus.isPending}
            />
          ))
        )}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={!!schedulePhase} onOpenChange={(o) => !o && setSchedulePhase(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Calendarizza Fase</DialogTitle>
          </DialogHeader>
          {schedulePhase && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {schedulePhase.commessa.title} — {phaseConfig[schedulePhase.phase.phase_type]?.label || schedulePhase.phase.phase_type}
              </p>
              <div>
                <Label className="text-xs">Seleziona data</Label>
                <CalendarPicker
                  mode="single"
                  selected={scheduleDate}
                  onSelect={setScheduleDate}
                  locale={it}
                  className="rounded-md border mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedulePhase(null)}>Annulla</Button>
            <Button onClick={handleConfirmSchedule} disabled={!scheduleDate || schedulePhseMutation.isPending}>
              {schedulePhseMutation.isPending ? "Salvataggio..." : "Conferma"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
