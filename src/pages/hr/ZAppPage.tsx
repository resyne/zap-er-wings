import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useDropzone } from "react-dropzone";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  FileText, DollarSign, Package2, Wrench, CalendarDays, MessageCircle,
  Smartphone, ShoppingCart, Settings, MessageSquare, Clock, LogIn, LogOut,
  Coffee, Play, MapPin, AlertTriangle, CheckCircle2, History,
  Banknote, ArrowDownLeft, ArrowUpRight, Camera, Loader2, CheckCircle, X,
  ImageIcon, Send
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useAttendance } from "@/hooks/useAttendance";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sections = [
  {
    title: "Riepilogo Timbrature",
    description: "Storico presenze e ore lavorate",
    icon: History,
    color: "bg-indigo-500",
    url: "/hr/z-app/riepilogo-timbrature",
  },
  {
    title: "Rapporto Intervento",
    description: "Compila e consulta i rapporti di intervento",
    icon: FileText,
    color: "bg-blue-500",
    url: "/hr/z-app/rapporti",
  },
  {
    title: "Registro Incasso/Spese",
    description: "Registra incassi e spese operative",
    icon: DollarSign,
    color: "bg-green-500",
    url: "/hr/z-app/registro",
  },
  {
    title: "Magazzino",
    description: "Gestisci scorte, movimenti e materiali",
    icon: Package2,
    color: "bg-amber-500",
    url: "/hr/z-app/magazzino",
  },
  {
    title: "Commesse",
    description: "Lavoro, produzione e spedizione",
    icon: Wrench,
    color: "bg-purple-500",
    url: "/hr/z-app/commesse",
  },
  {
    title: "Calendario Lavori",
    description: "Lavori programmati e calendario",
    icon: CalendarDays,
    color: "bg-indigo-500",
    url: "/hr/z-app/calendario",
  },
  {
    title: "Comunicazioni",
    description: "Messaggi e comunicazioni interne",
    icon: MessageCircle,
    color: "bg-rose-500",
    url: "/hr/z-app/comunicazioni",
  },
  {
    title: "Ordini",
    description: "Consulta e gestisci gli ordini",
    icon: ShoppingCart,
    color: "bg-teal-500",
    url: "/hr/z-app/ordini",
  },
  {
    title: "WhatsApp",
    description: "Chat e messaggi WhatsApp",
    icon: MessageSquare,
    color: "bg-green-500",
    url: "/hr/z-app/whatsapp",
  },
  {
    title: "Ordini Fornitori",
    description: "Ordini di acquisto ai fornitori",
    icon: Package2,
    color: "bg-orange-500",
    url: "/hr/z-app/ordini-fornitori",
  },
  {
    title: "Impostazioni",
    description: "Configura notifiche e preferenze",
    icon: Settings,
    color: "bg-gray-500",
    url: "/hr/z-app/impostazioni",
  },
];

export default function ZAppPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isPageVisible, loading } = usePageVisibility(user?.id);
  const { currentStatus, todayEvents, todayWorkMinutes, clockEvent } = useAttendance();
  const [processing, setProcessing] = useState(false);
  const [now, setNow] = useState(new Date());
  const queryClient = useQueryClient();

  // Inline movement form state
  const [movOpen, setMovOpen] = useState(false);
  const [movType, setMovType] = useState<"uscita" | "entrata">("uscita");
  const [movImporto, setMovImporto] = useState("");
  const [movDesc, setMovDesc] = useState("");
  const [movFile, setMovFile] = useState<{ name: string; url: string } | null>(null);
  const [movUploading, setMovUploading] = useState(false);
  const [movSuccess, setMovSuccess] = useState(false);
  const [movPayment, setMovPayment] = useState("contanti");

  const paymentMethods = [
    { value: "carta_aziendale", label: "Carta Aziendale" },
    { value: "anticipo_dipendente", label: "Anticipo Dipendente" },
    { value: "contanti", label: "Contanti" },
    { value: "carta_q8", label: "Carta Q8" },
    { value: "american_express", label: "Carta Amex" },
    { value: "banca_intesa", label: "Banca Intesa" },
  ];

  const movMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const today = new Date().toISOString().split("T")[0];
      const amount = parseFloat(movImporto);

      // Generate progressive code: SGN-YYYYMMDD-01
      const dateFormatted = today.replace(/-/g, '');
      const prefix = `SGN-${dateFormatted}`;
      const { count } = await supabase
        .from('accounting_entries')
        .select('*', { count: 'exact', head: true })
        .like('account_code', `${prefix}-%`);
      const code = `${prefix}-${String((count || 0) + 1).padStart(2, '0')}`;

      const { error: e1 } = await supabase.from("movimenti_finanziari").insert({
        data_movimento: today,
        direzione: movType,
        importo: amount,
        metodo_pagamento: movPayment as any,
        descrizione: movDesc || null,
        allegato_url: movFile?.url || null,
        allegato_nome: movFile?.name || null,
        stato: "segnalazione",
        stato_rimborso: movPayment === "anticipo_dipendente" ? "da_rimborsare" : null,
        created_by: userData.user?.id,
      } as any);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("accounting_entries").insert({
        direction: movType,
        document_type: "scontrino",
        amount,
        document_date: today,
        attachment_url: movFile?.url || "",
        note: movDesc || null,
        status: "segnalazione",
        event_type: "movimento_finanziario",
        payment_method: movPayment,
        account_code: code,
        user_id: userData.user?.id,
      });
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prima-nota-movements"] });
      queryClient.invalidateQueries({ queryKey: ["movimenti-finanziari"] });
      setMovSuccess(true);
      setTimeout(() => {
        setMovOpen(false);
        setMovSuccess(false);
        setMovImporto("");
        setMovDesc("");
        setMovFile(null);
      }, 2000);
    },
    onError: () => toast.error("Errore nella registrazione"),
  });

  const handleMovFileUpload = async (file: File) => {
    setMovUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `uploads/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("accounting-attachments").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("accounting-attachments").getPublicUrl(path);
      setMovFile({ name: file.name, url: data.publicUrl });
      toast.success("Foto caricata");
    } catch {
      toast.error("Errore upload");
    } finally {
      setMovUploading(false);
    }
  };

  const onMovDrop = useCallback((files: File[]) => {
    if (files[0]) handleMovFileUpload(files[0]);
  }, []);

  const { getRootProps: getMovDropProps, getInputProps: getMovInputProps } = useDropzone({
    onDrop: onMovDrop,
    accept: { "image/*": [], "application/pdf": [] },
    maxFiles: 1,
    noClick: false,
    noKeyboard: true,
  });

  const openMovForm = (type: "uscita" | "entrata") => {
    setMovType(type);
    setMovImporto("");
    setMovDesc("");
    setMovFile(null);
    setMovSuccess(false);
    setMovOpen(true);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const visibleSections = sections.filter(s => {
    if (s.url === "/hr/z-app/impostazioni") return isAdmin;
    return isPageVisible(s.url);
  });

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });

  const handleClock = async (eventType: string) => {
    setProcessing(true);
    try {
      const result = await clockEvent(eventType);
      const labels: Record<string, string> = {
        clock_in: "Entrata registrata",
        clock_out: "Uscita registrata",
        break_start: "Pausa iniziata",
        break_end: "Pausa terminata",
      };
      if (result.status === "anomaly") {
        toast.warning(`${labels[eventType]} - Fuori zona (${result.distanceFromWorkplace}m)`, { duration: 5000 });
      } else {
        toast.success(labels[eventType]);
      }
    } catch (e: any) {
      toast.error(e.message || "Errore durante la timbratura");
    } finally {
      setProcessing(false);
    }
  };

  const statusConfig = {
    out: { label: "Non in servizio", color: "bg-gray-100 text-gray-700", dot: "bg-gray-400" },
    working: { label: "In servizio", color: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
    on_break: { label: "In pausa", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  };
  const config = statusConfig[currentStatus as keyof typeof statusConfig] || statusConfig.out;

  const eventLabels: Record<string, { label: string; icon: any; color: string }> = {
    clock_in: { label: "Entrata", icon: LogIn, color: "text-emerald-600" },
    clock_out: { label: "Uscita", icon: LogOut, color: "text-red-600" },
    break_start: { label: "Inizio Pausa", icon: Coffee, color: "text-amber-600" },
    break_end: { label: "Fine Pausa", icon: Play, color: "text-blue-600" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-800">
      {/* Header */}
      <div className="px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-white/20 flex items-center justify-center">
              <Smartphone className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Z-APP</h1>
              <p className="text-indigo-200 text-xs">App per personale operativo</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-mono text-white font-bold">
              {now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="text-indigo-200 text-xs">
              {now.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
        </div>
      </div>

      {/* Timbratura Card - Main Feature */}
      <div className="px-4 sm:px-6 pb-4">
        <div className="bg-white rounded-2xl p-5 shadow-xl">
          {/* Status + Hours */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${config.dot} animate-pulse`} />
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.color}`}>{config.label}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-xs">GPS</span>
            </div>
          </div>

          {/* Work time */}
          <div className="text-center py-2 mb-4">
            <div className="text-4xl font-bold text-foreground tracking-tight">
              {formatMinutes(todayWorkMinutes)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Ore lavorate oggi</p>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3">
            {currentStatus === "out" && (
              <Button
                onClick={() => handleClock("clock_in")}
                disabled={processing}
                className="col-span-2 h-16 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
              >
                <LogIn className="h-6 w-6 mr-3" />
                {processing ? "Registrando..." : "ENTRATA"}
              </Button>
            )}

            {currentStatus === "working" && (
              <>
                <Button
                  onClick={() => handleClock("break_start")}
                  disabled={processing}
                  className="h-16 text-base font-bold bg-amber-500 hover:bg-amber-600 rounded-2xl shadow-lg active:scale-95 transition-transform"
                >
                  <Coffee className="h-5 w-5 mr-2" />
                  PAUSA
                </Button>
                <Button
                  onClick={() => handleClock("clock_out")}
                  disabled={processing}
                  className="h-16 text-base font-bold bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
                >
                  <LogOut className="h-5 w-5 mr-2" />
                  USCITA
                </Button>
              </>
            )}

            {currentStatus === "on_break" && (
              <Button
                onClick={() => handleClock("break_end")}
                disabled={processing}
                className="col-span-2 h-16 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
              >
                <Play className="h-6 w-6 mr-3" />
                {processing ? "Registrando..." : "FINE PAUSA"}
              </Button>
            )}
          </div>

          {/* Today's events mini-log */}
          {todayEvents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Oggi</span>
                <button
                  onClick={() => navigate("/hr/z-app/riepilogo-timbrature")}
                  className="text-xs text-primary font-medium hover:underline"
                >
                  Vedi tutto →
                </button>
              </div>
              <div className="space-y-1.5">
                {todayEvents.slice(-4).map((ev) => {
                  const cfg = eventLabels[ev.event_type] || { label: ev.event_type, icon: Clock, color: "text-gray-600" };
                  const Icon = cfg.icon;
                  return (
                    <div key={ev.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                        <span className="text-xs font-medium">{cfg.label}</span>
                        {ev.status === "anomaly" && <AlertTriangle className="h-3 w-3 text-orange-500" />}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground font-mono">{formatTime(ev.timestamp)}</span>
                        {ev.status === "valid" && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Registration — Registra movimento INLINE */}
      <div className="px-4 sm:px-6 pb-3">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 p-4 pb-3">
            <Banknote className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-sm text-foreground">Registra movimento</h3>
          </div>
          <div className="grid grid-cols-2 gap-2.5 px-4 pb-4">
            <button
              onClick={() => openMovForm("uscita")}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 p-3 active:scale-95 transition-transform"
            >
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <ArrowDownLeft className="h-5 w-5 text-red-600" />
              </div>
              <span className="font-semibold text-xs text-red-700">Spesa</span>
            </button>
            <button
              onClick={() => openMovForm("entrata")}
              className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 active:scale-95 transition-transform"
            >
              <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="font-semibold text-xs text-emerald-700">Incasso</span>
            </button>
          </div>
        </div>
      </div>

      {/* Movement Dialog */}
      <Dialog open={movOpen} onOpenChange={(open) => { if (!open) { setMovOpen(false); setMovSuccess(false); } }}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden gap-0">
          <DialogTitle className="sr-only">{movType === "uscita" ? "Registra Spesa" : "Registra Incasso"}</DialogTitle>
          {movSuccess ? (
            <div className="flex flex-col items-center gap-3 py-10 px-6">
              <CheckCircle className={cn("h-14 w-14", movType === "uscita" ? "text-red-500" : "text-emerald-500")} />
              <p className="font-bold text-lg">{movType === "uscita" ? "Spesa registrata!" : "Incasso registrato!"}</p>
              <p className="text-sm text-muted-foreground">Sarà classificato dall'amministrazione</p>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              {/* Type toggle */}
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  onClick={() => setMovType("uscita")}
                  className={cn("flex-1 py-2.5 text-sm font-bold transition-colors",
                    movType === "uscita" ? "bg-red-600 text-white" : "bg-muted/30 text-muted-foreground"
                  )}
                >↓ Spesa</button>
                <button
                  onClick={() => setMovType("entrata")}
                  className={cn("flex-1 py-2.5 text-sm font-bold transition-colors",
                    movType === "entrata" ? "bg-emerald-600 text-white" : "bg-muted/30 text-muted-foreground"
                  )}
                >↑ Incasso</button>
              </div>

              {/* Amount */}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-muted-foreground/40">€</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={movImporto}
                  onChange={(e) => setMovImporto(e.target.value)}
                  placeholder="0,00"
                  className="pl-10 h-16 text-3xl font-bold tabular-nums text-center border-2"
                  autoFocus
                />
              </div>

              {/* Description */}
              <Textarea
                value={movDesc}
                onChange={(e) => setMovDesc(e.target.value)}
                placeholder="Descrizione (opzionale)"
                rows={2}
                className="resize-none text-sm"
              />

              {/* Photo */}
              {movFile ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border">
                  <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-xs truncate flex-1">{movFile.name}</span>
                  <button onClick={() => setMovFile(null)} className="p-0.5"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <div className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed cursor-pointer active:bg-muted/30 transition-colors">
                      {movUploading ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Camera className="h-4 w-4 text-muted-foreground" />}
                      <span className="text-xs font-medium text-muted-foreground">{movUploading ? "..." : "📸 Foto"}</span>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMovFileUpload(f); }} />
                  </label>
                  <div {...getMovDropProps()}
                    className="flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed cursor-pointer active:bg-muted/30 transition-colors">
                    <input {...getMovInputProps()} />
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Galleria</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <Button variant="ghost" className="flex-1" onClick={() => setMovOpen(false)}>
                  Annulla
                </Button>
                <Button
                  className={cn("flex-1 gap-2 text-white",
                    movType === "uscita" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                  )}
                  disabled={!movImporto || parseFloat(movImporto) <= 0 || movMutation.isPending}
                  onClick={() => movMutation.mutate()}
                >
                  {movMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Invia
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Other modules grid */}
      <div className="px-4 sm:px-6 pb-8">
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {visibleSections.map((section) => (
            <button
              key={section.title}
              onClick={() => navigate(section.url)}
              className="flex flex-col items-center gap-2 p-3 sm:p-4 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/20 active:scale-95 transition-all duration-200 text-center"
            >
              <div className={`h-11 w-11 rounded-xl ${section.color} flex items-center justify-center shadow-sm`}>
                <section.icon className="h-5 w-5 text-white" />
              </div>
              <p className="font-medium text-white text-[11px] leading-tight">{section.title}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
