import { useState, useMemo, useEffect, useCallback, memo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Search, Loader2, Wrench, Truck, Settings,
  Calendar, MapPin, User, Package, Clock, ChevronDown,
  FileText, AlertTriangle, CheckCircle2, Image, Boxes,
  CreditCard, ChevronRight, Building2, CalendarPlus, Factory,
  Megaphone, Send, MessageSquare, History, Trash2, Pencil, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MediaPreviewModal } from "@/components/ui/media-preview-modal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

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
  legacy_work_order_id?: string;
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

// ─── Sub-component: Products to produce/prepare checklist ─────────────
const MobileProductsChecklist = memo(function MobileProductsChecklist({ salesOrderId }: { salesOrderId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bomData, setBomData] = useState<Record<string, { level1: any[]; level2: any[] }>>({});

  useEffect(() => { loadItems(); }, [salesOrderId]);

  const loadItems = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_order_items")
        .select("id, product_name, description, quantity, is_completed, completed_at, product_id")
        .eq("sales_order_id", salesOrderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setItems(data || []);
      // Load BOM data for items with product_id
      if (data) await loadBomData(data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const loadBomData = async (itemsList: any[]) => {
    const map: Record<string, { level1: any[]; level2: any[] }> = {};
    for (const item of itemsList) {
      if (!item.product_id) continue;
      try {
        // Find BOM Level 1 linked to this product
        const { data: bomProducts } = await supabase
          .from("bom_products")
          .select("bom_id, boms!inner(id, name, version, level)")
          .eq("product_id", item.product_id);

        const level1: any[] = [];
        const level2: any[] = [];

        if (bomProducts) {
          for (const bp of bomProducts) {
            const bom = bp.boms as any;
            if (bom?.level === 1) {
              level1.push({ id: bom.id, name: bom.name, version: bom.version });
              // Find Level 2 inclusions
              const { data: inclusions } = await supabase
                .from("bom_inclusions")
                .select("quantity, boms!bom_inclusions_included_bom_id_fkey(id, name, version, level, material_id)")
                .eq("parent_bom_id", bom.id);

              if (inclusions) {
                for (const inc of inclusions) {
                  const incBom = inc.boms as any;
                  if (incBom?.level === 2) {
                    let stock: number | undefined;
                    if (incBom.material_id) {
                      const { data: mat } = await supabase
                        .from("materials")
                        .select("current_stock")
                        .eq("id", incBom.material_id)
                        .single();
                      if (mat) stock = mat.current_stock;
                    }
                    level2.push({
                      id: incBom.id, name: incBom.name, version: incBom.version,
                      quantity: inc.quantity, current_stock: stock
                    });
                  }
                }
              }
            }
          }
        }
        if (level1.length > 0 || level2.length > 0) {
          map[item.id] = { level1, level2 };
        }
      } catch { /* silent */ }
    }
    setBomData(map);
  };

  const toggleComplete = async (item: any) => {
    const newCompleted = !item.is_completed;
    const { error } = await supabase
      .from("sales_order_items")
      .update({ is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) { toast.error("Errore aggiornamento"); return; }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null } : i));
    toast.success(newCompleted ? "Completato ✓" : "Riaperto");
  };


  if (loading) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />;
  if (items.length === 0) return null;

  const completed = items.filter(i => i.is_completed).length;
  const progressPercent = Math.round((completed / items.length) * 100);

  return (
    <div className="space-y-2 border border-indigo-200 rounded-lg p-3 bg-indigo-50/30">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
          <Boxes className="h-3.5 w-3.5" />
          Da Produrre / Preparare
        </p>
        <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] font-bold">
          {completed}/{items.length}
        </Badge>
      </div>
      
      {/* Progress bar */}
      <div className="w-full h-2 bg-indigo-100 rounded-full overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{ 
            width: `${progressPercent}%`,
            background: progressPercent === 100 
              ? 'linear-gradient(90deg, #10b981, #059669)' 
              : 'linear-gradient(90deg, #6366f1, #818cf8)'
          }}
        />
      </div>

      <div className="space-y-1">
        {items.map(item => {
          const hasBom = !!bomData[item.id];
          const itemBoms = bomData[item.id];

          return (
            <div key={item.id} className="space-y-0">
              <button
                onClick={() => toggleComplete(item)}
                className={`flex items-start gap-2.5 w-full text-left p-2 rounded-lg border transition-all active:scale-[0.98] ${
                  item.is_completed 
                    ? "bg-green-50 border-green-200" 
                    : "bg-background border-border hover:border-indigo-300 hover:bg-indigo-50/50"
                }`}
              >
                <Checkbox checked={item.is_completed} className="mt-0.5 pointer-events-none" />
                <div className="flex-1 min-w-0">
                  <span className={`text-[12px] font-medium block ${item.is_completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {item.quantity > 1 ? `${item.quantity}x ` : ""}{item.product_name || "Articolo"}
                  </span>
                  {item.description && (
                    <span className={`text-[10px] block mt-0.5 ${item.is_completed ? "line-through text-muted-foreground/60" : "text-muted-foreground"}`}>
                      {item.description.length > 120 ? item.description.substring(0, 120) + "..." : item.description}
                    </span>
                  )}
                </div>
                {item.is_completed && (
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                )}
              </button>

              {/* BOM details - always visible */}
              {hasBom && itemBoms && (
                <div className="ml-7 mt-1 mb-1 p-2 rounded-md bg-amber-50/60 border border-amber-200/60 space-y-1.5">
                  {itemBoms.level1.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-amber-800 uppercase">BOM Livello 1</p>
                      {itemBoms.level1.map((b: any) => (
                        <div key={b.id} className="text-[11px] pl-2 border-l-2 border-amber-400/50 text-foreground">
                          {b.name} <span className="text-muted-foreground">(v{b.version})</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {itemBoms.level2.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-semibold text-amber-800 uppercase">Componenti (Livello 2)</p>
                      {itemBoms.level2.map((b: any) => (
                        <div key={b.id} className="text-[11px] pl-2 border-l-2 border-orange-400/50 flex items-center justify-between">
                          <span>{b.quantity}x {b.name} <span className="text-muted-foreground">(v{b.version})</span></span>
                          {b.current_stock !== undefined && (
                            <span className={`text-[10px] font-bold ${b.current_stock >= b.quantity ? "text-green-600" : "text-red-600"}`}>
                              Stock: {b.current_stock}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
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
const CommessaCard = memo(function CommessaCard({ commessa, onPhaseStatusChange, onSchedulePhase, onPriorityChange, onSendUrgent, onDelete, onEditNotes, isPending, isAdmin }: {
  commessa: Commessa;
  onPhaseStatusChange: (phaseId: string, newStatus: string) => void;
  onSchedulePhase: (phase: CommessaPhase, commessa: Commessa) => void;
  onPriorityChange: (commessa: Commessa, newPriority: string) => void;
  onSendUrgent: (commessa: Commessa) => void;
  onDelete: (commessa: Commessa) => void;
  onEditNotes: (commessa: Commessa) => void;
  isPending: boolean;
  isAdmin: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const sortedPhases = [...commessa.phases].sort((a, b) => a.phase_order - b.phase_order);
  const overallStatus = commessaStatusLabels[commessa.status] || commessaStatusLabels.da_fare;
  const priorityInfo = commessa.priority ? priorityLabels[commessa.priority] : null;

  const fmtDate = (d?: string | null) => {
    if (!d) return null;
    try { return format(new Date(d), "dd MMM yyyy", { locale: it }); } catch { return d; }
  };

  const isPhseLocked = (phase: CommessaPhase): boolean => {
    if (phase.phase_order === 1) return false;
    const prevPhase = sortedPhases.find(p => p.phase_order === phase.phase_order - 1);
    return prevPhase ? !completedStatuses.includes(prevPhase.status) : false;
  };

  const typeLabels: Record<string, string> = {
    fornitura: "Fornitura", intervento: "Intervento", ricambi: "Ricambi", produzione: "Fornitura",
  };

  const priorities = ["low", "medium", "high", "urgent"] as const;

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
            {/* Priority Change */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Priorità</p>
              <div className="flex flex-wrap gap-1.5">
                {priorities.map(p => {
                  const info = priorityLabels[p];
                  const isActive = commessa.priority === p;
                  const colorMap: Record<string, string> = {
                    low: "bg-gray-100 text-gray-600 border-gray-200",
                    medium: "bg-amber-100 text-amber-700 border-amber-200",
                    high: "bg-orange-100 text-orange-700 border-orange-200",
                    urgent: "bg-red-100 text-red-700 border-red-200",
                  };
                  return (
                    <button
                      key={p}
                      disabled={isActive || isPending}
                      onClick={(e) => { e.stopPropagation(); onPriorityChange(commessa, p); }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all active:scale-95 ${
                        isActive
                          ? `${colorMap[p]} ring-1 ring-offset-1 ring-current/20`
                          : "bg-background border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {isActive && <CheckCircle2 className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />}
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Urgent Communication Button */}
            <button
              onClick={(e) => { e.stopPropagation(); onSendUrgent(commessa); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-[12px] font-semibold bg-red-50 text-red-700 border border-red-200 active:scale-[0.98] transition-all"
            >
              <Megaphone className="h-4 w-4" />
              Invia Comunicazione Urgente
            </button>

            {/* Admin Actions */}
            {isAdmin && (
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditNotes(commessa); }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-blue-50 text-blue-700 border border-blue-200 active:scale-[0.98] transition-all"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifica
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(commessa); }}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-medium bg-red-50 text-red-700 border border-red-200 active:scale-[0.98] transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Elimina
                </button>
              </div>
            )}

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

            {/* Products checklist */}
            {commessa.sales_order_id && <MobileProductsChecklist salesOrderId={commessa.sales_order_id} />}

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
  const { isAdmin } = useUserRole();
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [schedulePhase, setSchedulePhase] = useState<{ phase: CommessaPhase; commessa: Commessa } | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [urgentDialog, setUrgentDialog] = useState<Commessa | null>(null);
  const [urgentMessage, setUrgentMessage] = useState("");
  const [sendingUrgent, setSendingUrgent] = useState(false);
  const [deleteCommessa, setDeleteCommessa] = useState<Commessa | null>(null);
  const [deletingCommessa, setDeletingCommessa] = useState(false);
  const [editCommessa, setEditCommessa] = useState<Commessa | null>(null);
  const [editCommessaData, setEditCommessaData] = useState<{
    title: string; article: string; notes: string; description: string;
    priority: string; type: string; delivery_mode: string; intervention_type: string;
    diameter: string; smoke_inlet: string; deadline: string;
    payment_on_delivery: boolean; payment_amount: string; is_warranty: boolean;
    shipping_address: string; shipping_city: string; shipping_province: string;
    shipping_postal_code: string; shipping_country: string;
  }>({
    title: "", article: "", notes: "", description: "",
    priority: "medium", type: "fornitura", delivery_mode: "", intervention_type: "",
    diameter: "", smoke_inlet: "", deadline: "",
    payment_on_delivery: false, payment_amount: "", is_warranty: false,
    shipping_address: "", shipping_city: "", shipping_province: "",
    shipping_postal_code: "", shipping_country: "",
  });
  const [savingCommessa, setSavingCommessa] = useState(false);
  const [editSection, setEditSection] = useState<string>("general");
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
    mutationFn: async ({ phaseId, date, phaseType, commessa, isReschedule }: { phaseId: string; date: string; phaseType?: string; commessa?: any; isReschedule?: boolean }) => {
      const updateData: any = { scheduled_date: date };
      // Se è un'installazione con stato "da_programmare", passa automaticamente a "programmata"
      if (phaseType === "installazione") {
        updateData.status = "programmata";
      }
      const { error } = await supabase.from("commessa_phases").update(updateData).eq("id", phaseId);
      if (error) throw error;
      return { commessa, phaseType, date, isReschedule };
    },
    onSuccess: (data) => {
      toast.success("Fase calendarizzata");
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      setSchedulePhase(null);

      // Send scheduling notification (fire and forget)
      if (data?.commessa) {
        supabase.functions.invoke("notify-commessa-scheduled", {
          body: {
            commessa_title: data.commessa.title,
            commessa_number: data.commessa.number,
            phase_type: data.phaseType,
            scheduled_date: data.date,
            customer_name: data.commessa.customer_name,
            is_reschedule: data.isReschedule || false,
          },
        }).catch(err => console.error("Error sending schedule notification:", err));
      }
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
    const isReschedule = !!schedulePhase.phase.scheduled_date;
    schedulePhseMutation.mutate({
      phaseId: schedulePhase.phase.id,
      date: format(scheduleDate, "yyyy-MM-dd"),
      phaseType: schedulePhase.phase.phase_type,
      commessa: schedulePhase.commessa,
      isReschedule,
    });
  }, [schedulePhase, scheduleDate, schedulePhseMutation]);

  // ─── Priority Change ──────────────────────────────────────
  const handlePriorityChange = useCallback(async (commessa: Commessa, newPriority: string) => {
    const oldPriority = commessa.priority || "medium";
    if (oldPriority === newPriority) return;

    // Optimistic update
    queryClient.setQueryData<Commessa[]>(["zapp-commesse"], (old) =>
      old?.map(c => c.id === commessa.id ? { ...c, priority: newPriority } : c) || []
    );

    const { error } = await supabase.from("commesse").update({ priority: newPriority }).eq("id", commessa.id);
    if (error) {
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      toast.error("Errore aggiornamento priorità");
      return;
    }

    toast.success(`Priorità aggiornata: ${priorityLabels[newPriority]?.label || newPriority}`);
    queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });

    // Send notification (fire and forget)
    supabase.functions.invoke("notify-commessa-urgent", {
      body: {
        type: "priority_change",
        commessa_id: commessa.id,
        commessa_number: commessa.number,
        commessa_title: commessa.title,
        commessa_type: commessa.type,
        customer_name: commessa.customer_name,
        deadline: commessa.deadline,
        old_priority: oldPriority,
        new_priority: newPriority,
      },
    }).then(({ error: e }) => { if (e) console.error("Priority notification error:", e); });
  }, [queryClient]);

  // ─── Urgent Message ──────────────────────────────────────
  const handleSendUrgent = useCallback(async () => {
    if (!urgentDialog || !urgentMessage.trim()) return;
    setSendingUrgent(true);
    try {
      const { error } = await supabase.functions.invoke("notify-commessa-urgent", {
        body: {
          type: "urgent_message",
          commessa_id: urgentDialog.id,
          commessa_number: urgentDialog.number,
          commessa_title: urgentDialog.title,
          commessa_type: urgentDialog.type,
          customer_name: urgentDialog.customer_name,
          deadline: urgentDialog.deadline,
          message: urgentMessage.trim(),
        },
      });
      if (error) throw error;
      toast.success("Comunicazione urgente inviata!");
      setUrgentDialog(null);
      setUrgentMessage("");
    } catch (err: any) {
      toast.error("Errore invio: " + err.message);
    }
    setSendingUrgent(false);
  }, [urgentDialog, urgentMessage]);

  // ─── Admin: Delete Commessa ──────────────────────────────
  const handleDeleteCommessa = useCallback(async () => {
    if (!deleteCommessa) return;
    setDeletingCommessa(true);
    try {
      await supabase.from("commessa_phases").delete().eq("commessa_id", deleteCommessa.id);
      await supabase.from("commessa_communications").delete().eq("commessa_id", deleteCommessa.id);
      const { error } = await supabase.from("commesse").delete().eq("id", deleteCommessa.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      setDeleteCommessa(null);
      toast.success("Commessa eliminata");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setDeletingCommessa(false);
    }
  }, [deleteCommessa, queryClient]);

  const handleOpenEditCommessa = useCallback((commessa: Commessa) => {
    setEditCommessaData({
      notes: commessa.notes || "",
      title: commessa.title || "",
      article: commessa.article || "",
      description: commessa.description || "",
      priority: commessa.priority || "medium",
      type: commessa.type || "fornitura",
      delivery_mode: commessa.delivery_mode || "",
      intervention_type: commessa.intervention_type || "",
      diameter: commessa.diameter || "",
      smoke_inlet: commessa.smoke_inlet || "",
      deadline: commessa.deadline || "",
      payment_on_delivery: commessa.payment_on_delivery || false,
      payment_amount: commessa.payment_amount?.toString() || "",
      is_warranty: commessa.is_warranty || false,
      shipping_address: commessa.shipping_address || "",
      shipping_city: commessa.shipping_city || "",
      shipping_province: commessa.shipping_province || "",
      shipping_postal_code: commessa.shipping_postal_code || "",
      shipping_country: commessa.shipping_country || "",
    });
    setEditSection("general");
    setEditCommessa(commessa);
  }, []);

  const handleSaveCommessa = useCallback(async () => {
    if (!editCommessa) return;
    setSavingCommessa(true);
    try {
      const { error } = await supabase.from("commesse").update({
        title: editCommessaData.title,
        article: editCommessaData.article || null,
        notes: editCommessaData.notes || null,
        description: editCommessaData.description || null,
        priority: editCommessaData.priority || null,
        type: editCommessaData.type,
        delivery_mode: editCommessaData.delivery_mode || null,
        intervention_type: editCommessaData.intervention_type || null,
        diameter: editCommessaData.diameter || null,
        smoke_inlet: editCommessaData.smoke_inlet || null,
        deadline: editCommessaData.deadline || null,
        payment_on_delivery: editCommessaData.payment_on_delivery,
        payment_amount: editCommessaData.payment_amount ? parseFloat(editCommessaData.payment_amount) : null,
        is_warranty: editCommessaData.is_warranty,
        shipping_address: editCommessaData.shipping_address || null,
        shipping_city: editCommessaData.shipping_city || null,
        shipping_province: editCommessaData.shipping_province || null,
        shipping_postal_code: editCommessaData.shipping_postal_code || null,
        shipping_country: editCommessaData.shipping_country || null,
      }).eq("id", editCommessa.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["zapp-commesse"] });
      setEditCommessa(null);
      toast.success("Commessa aggiornata");
    } catch (err: any) {
      toast.error("Errore: " + err.message);
    } finally {
      setSavingCommessa(false);
    }
  }, [editCommessa, editCommessaData, queryClient]);

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
              onPriorityChange={handlePriorityChange}
              onSendUrgent={(c) => { setUrgentDialog(c); setUrgentMessage(""); }}
              onDelete={(c) => setDeleteCommessa(c)}
              onEditNotes={handleOpenEditCommessa}
              isPending={updatePhaseStatus.isPending}
              isAdmin={isAdmin}
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

      {/* Urgent Communication Dialog */}
      <Dialog open={!!urgentDialog} onOpenChange={(o) => { if (!o) { setUrgentDialog(null); setUrgentMessage(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-red-600" />
              Comunicazione Urgente
            </DialogTitle>
            <DialogDescription>
              {urgentDialog && `${urgentDialog.number} — ${urgentDialog.customer_name || urgentDialog.title}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Scrivi il messaggio urgente..."
              value={urgentMessage}
              onChange={(e) => setUrgentMessage(e.target.value)}
              rows={4}
              className="resize-none"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{urgentMessage.length}/500</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrgentDialog(null)}>Annulla</Button>
            <Button
              onClick={handleSendUrgent}
              disabled={!urgentMessage.trim() || sendingUrgent}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {sendingUrgent ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Commessa Confirmation */}
      <AlertDialog open={!!deleteCommessa} onOpenChange={(o) => !o && setDeleteCommessa(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Commessa</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la commessa {deleteCommessa?.number}? Verranno eliminate anche tutte le fasi e comunicazioni collegate. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCommessa} disabled={deletingCommessa} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingCommessa ? "Eliminazione..." : "Elimina"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Commessa Dialog */}
      <Dialog open={!!editCommessa} onOpenChange={(o) => !o && setEditCommessa(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 pt-4 pb-2 border-b shrink-0">
            <DialogTitle className="text-base">Modifica Commessa</DialogTitle>
            <DialogDescription className="text-xs">{editCommessa?.number} • {editCommessa?.customer_name}</DialogDescription>
          </DialogHeader>

          {/* Section tabs - scrollable horizontally */}
          <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b shrink-0 bg-muted/30">
            {[
              { key: "general", icon: <FileText className="h-3.5 w-3.5" />, label: "Generale" },
              { key: "product", icon: <Package className="h-3.5 w-3.5" />, label: "Prodotto" },
              { key: "shipping", icon: <Truck className="h-3.5 w-3.5" />, label: "Spedizione" },
              { key: "payment", icon: <CreditCard className="h-3.5 w-3.5" />, label: "Pagamento" },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setEditSection(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium whitespace-nowrap transition-all ${
                  editSection === tab.key
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-background text-muted-foreground border border-border hover:bg-accent"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Scrollable content area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {/* GENERAL section */}
            {editSection === "general" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Titolo *</Label>
                  <Input value={editCommessaData.title} onChange={e => setEditCommessaData(p => ({ ...p, title: e.target.value }))} className="mt-1 h-9" placeholder="Titolo commessa" />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Descrizione</Label>
                  <Textarea value={editCommessaData.description} onChange={e => setEditCommessaData(p => ({ ...p, description: e.target.value }))} rows={2} className="mt-1" placeholder="Descrizione..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Tipologia</Label>
                    <Select value={editCommessaData.type} onValueChange={v => setEditCommessaData(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fornitura">🔧 Fornitura</SelectItem>
                        <SelectItem value="intervento">🛠️ Intervento</SelectItem>
                        <SelectItem value="ricambi">📦 Ricambi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Priorità</Label>
                    <Select value={editCommessaData.priority} onValueChange={v => setEditCommessaData(p => ({ ...p, priority: v }))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">🟢 Bassa</SelectItem>
                        <SelectItem value="medium">🟡 Media</SelectItem>
                        <SelectItem value="high">🟠 Alta</SelectItem>
                        <SelectItem value="urgent">🔴 Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {editCommessaData.type === "intervento" && (
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Tipo Intervento</Label>
                    <Select value={editCommessaData.intervention_type || ""} onValueChange={v => setEditCommessaData(p => ({ ...p, intervention_type: v }))}>
                      <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="installazione">Installazione</SelectItem>
                        <SelectItem value="manutenzione">Manutenzione</SelectItem>
                        <SelectItem value="riparazione">Riparazione</SelectItem>
                        <SelectItem value="collaudo">Collaudo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Scadenza</Label>
                  <Input 
                    type="date" 
                    value={editCommessaData.deadline ? editCommessaData.deadline.substring(0, 10) : ""} 
                    onChange={e => setEditCommessaData(p => ({ ...p, deadline: e.target.value || "" }))} 
                    className="mt-1 h-9" 
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Note</Label>
                  <Textarea value={editCommessaData.notes} onChange={e => setEditCommessaData(p => ({ ...p, notes: e.target.value }))} rows={3} className="mt-1" placeholder="Note interne..." />
                </div>
              </>
            )}

            {/* PRODUCT section */}
            {editSection === "product" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Articolo</Label>
                  <Input value={editCommessaData.article} onChange={e => setEditCommessaData(p => ({ ...p, article: e.target.value }))} className="mt-1 h-9" placeholder="es. ZPZ - 250mm" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Diametro</Label>
                    <Input value={editCommessaData.diameter} onChange={e => setEditCommessaData(p => ({ ...p, diameter: e.target.value }))} className="mt-1 h-9" placeholder="es. 250mm" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Innesto Fumi</Label>
                    <Input value={editCommessaData.smoke_inlet} onChange={e => setEditCommessaData(p => ({ ...p, smoke_inlet: e.target.value }))} className="mt-1 h-9" placeholder="es. Laterale" />
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900">
                  <Checkbox 
                    checked={editCommessaData.is_warranty} 
                    onCheckedChange={c => setEditCommessaData(p => ({ ...p, is_warranty: !!c }))} 
                    id="edit-warranty"
                  />
                  <label htmlFor="edit-warranty" className="text-sm font-medium cursor-pointer">
                    🛡️ In Garanzia
                  </label>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Modalità Consegna</Label>
                  <Select value={editCommessaData.delivery_mode || ""} onValueChange={v => setEditCommessaData(p => ({ ...p, delivery_mode: v }))}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Seleziona..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corriere">📦 Corriere</SelectItem>
                      <SelectItem value="ritiro">🏭 Ritiro in sede</SelectItem>
                      <SelectItem value="installazione">🔧 Consegna + Installazione</SelectItem>
                      <SelectItem value="container">🚢 Container</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* SHIPPING section */}
            {editSection === "shipping" && (
              <>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Indirizzo</Label>
                  <Input value={editCommessaData.shipping_address} onChange={e => setEditCommessaData(p => ({ ...p, shipping_address: e.target.value }))} className="mt-1 h-9" placeholder="Via/Piazza..." />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Città</Label>
                    <Input value={editCommessaData.shipping_city} onChange={e => setEditCommessaData(p => ({ ...p, shipping_city: e.target.value }))} className="mt-1 h-9" placeholder="Città" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Provincia</Label>
                    <Input value={editCommessaData.shipping_province} onChange={e => setEditCommessaData(p => ({ ...p, shipping_province: e.target.value }))} className="mt-1 h-9" placeholder="NA" maxLength={2} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">CAP</Label>
                    <Input value={editCommessaData.shipping_postal_code} onChange={e => setEditCommessaData(p => ({ ...p, shipping_postal_code: e.target.value }))} className="mt-1 h-9" placeholder="80100" maxLength={5} />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Paese</Label>
                    <Input value={editCommessaData.shipping_country} onChange={e => setEditCommessaData(p => ({ ...p, shipping_country: e.target.value }))} className="mt-1 h-9" placeholder="Italia" />
                  </div>
                </div>
              </>
            )}

            {/* PAYMENT section */}
            {editSection === "payment" && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                  <Checkbox 
                    checked={editCommessaData.payment_on_delivery} 
                    onCheckedChange={c => setEditCommessaData(p => ({ ...p, payment_on_delivery: !!c }))} 
                    id="edit-payment-delivery"
                  />
                  <label htmlFor="edit-payment-delivery" className="text-sm font-medium cursor-pointer">
                    💰 Pagamento alla Consegna
                  </label>
                </div>
                {editCommessaData.payment_on_delivery && (
                  <div>
                    <Label className="text-xs font-semibold text-muted-foreground">Importo (€)</Label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={editCommessaData.payment_amount} 
                      onChange={e => setEditCommessaData(p => ({ ...p, payment_amount: e.target.value }))} 
                      className="mt-1 h-9" 
                      placeholder="0.00" 
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Fixed footer */}
          <div className="flex gap-2 px-4 py-3 border-t bg-background shrink-0">
            <Button variant="outline" className="flex-1 h-10" onClick={() => setEditCommessa(null)}>
              Annulla
            </Button>
            <Button className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-700" onClick={handleSaveCommessa} disabled={savingCommessa || !editCommessaData.title.trim()}>
              {savingCommessa ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Salva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
