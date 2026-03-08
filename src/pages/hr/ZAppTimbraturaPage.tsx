import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogIn, LogOut, Coffee, Play, MapPin, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAttendance } from "@/hooks/useAttendance";
import { toast } from "sonner";

export default function ZAppTimbraturaPage() {
  const navigate = useNavigate();
  const { currentStatus, todayEvents, todayWorkMinutes, loading, clockEvent } = useAttendance();
  const [processing, setProcessing] = useState(false);

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m.toString().padStart(2, "0")}m`;
  };

  const formatTime = (ts: string) => {
    return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  };

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
        toast.warning(`${labels[eventType]} - Fuori zona autorizzata (${result.distanceFromWorkplace}m)`, { duration: 5000 });
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-800">
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">Timbratura</h1>
            <p className="text-indigo-200 text-xs">Clock In / Out GPS</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {/* Status Card */}
        <div className="bg-white rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${config.dot} animate-pulse`} />
              <span className={`text-sm font-medium px-3 py-1 rounded-full ${config.color}`}>{config.label}</span>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-xs">GPS attivo</span>
            </div>
          </div>

          {/* Work time display */}
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-foreground tracking-tight">
              {formatMinutes(todayWorkMinutes)}
            </div>
            <p className="text-sm text-muted-foreground mt-1">Ore lavorate oggi</p>
          </div>

          {/* Clock time */}
          <div className="text-center">
            <div className="text-lg font-mono text-muted-foreground">
              {new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          {currentStatus === "out" && (
            <Button
              onClick={() => handleClock("clock_in")}
              disabled={processing}
              className="col-span-2 h-20 text-lg font-bold bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
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
                className="h-20 text-base font-bold bg-amber-500 hover:bg-amber-600 rounded-2xl shadow-lg active:scale-95 transition-transform"
              >
                <Coffee className="h-5 w-5 mr-2" />
                PAUSA
              </Button>
              <Button
                onClick={() => handleClock("clock_out")}
                disabled={processing}
                className="h-20 text-base font-bold bg-red-600 hover:bg-red-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
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
              className="col-span-2 h-20 text-lg font-bold bg-blue-600 hover:bg-blue-700 rounded-2xl shadow-lg active:scale-95 transition-transform"
            >
              <Play className="h-6 w-6 mr-3" />
              {processing ? "Registrando..." : "FINE PAUSA"}
            </Button>
          )}
        </div>

        {/* Today's Events */}
        {todayEvents.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timbrature di oggi
            </h3>
            <div className="space-y-2">
              {todayEvents.map((ev) => {
                const labels: Record<string, { label: string; icon: any; color: string }> = {
                  clock_in: { label: "Entrata", icon: LogIn, color: "text-emerald-600" },
                  clock_out: { label: "Uscita", icon: LogOut, color: "text-red-600" },
                  break_start: { label: "Inizio Pausa", icon: Coffee, color: "text-amber-600" },
                  break_end: { label: "Fine Pausa", icon: Play, color: "text-blue-600" },
                };
                const cfg = labels[ev.event_type] || { label: ev.event_type, icon: Clock, color: "text-gray-600" };
                const Icon = cfg.icon;

                return (
                  <div key={ev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <span className="text-sm font-medium">{cfg.label}</span>
                      {ev.status === "anomaly" && (
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground font-mono">{formatTime(ev.timestamp)}</span>
                      {ev.status === "valid" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
