import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, DollarSign, Package2, Wrench, CalendarDays, MessageCircle,
  Smartphone, ShoppingCart, Settings, MessageSquare, Clock, LogIn, LogOut,
  Coffee, Play, MapPin, AlertTriangle, CheckCircle2, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePageVisibility } from "@/hooks/usePageVisibility";
import { useAttendance } from "@/hooks/useAttendance";
import { toast } from "sonner";

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
