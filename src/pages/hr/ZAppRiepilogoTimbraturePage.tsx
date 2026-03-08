import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, MapPin, ChevronLeft, ChevronRight, LogIn, LogOut, Coffee, Play, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isToday, isSameDay } from "date-fns";
import { it } from "date-fns/locale";

interface ClockEvent {
  id: string;
  event_type: string;
  timestamp: string;
  gps_lat: number | null;
  gps_long: number | null;
  status: string;
  distance_from_workplace: number | null;
}

interface DaySummary {
  date: Date;
  events: ClockEvent[];
  workMinutes: number;
  breakMinutes: number;
  firstIn: string | null;
  lastOut: string | null;
  hasAnomaly: boolean;
}

export default function ZAppRiepilogoTimbraturePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<ClockEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchEvents = async () => {
      setLoading(true);
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");

      const { data } = await supabase
        .from("clock_events")
        .select("id, event_type, timestamp, gps_lat, gps_long, status, distance_from_workplace")
        .eq("employee_id", user.id)
        .gte("timestamp", `${start}T00:00:00`)
        .lte("timestamp", `${end}T23:59:59`)
        .order("timestamp", { ascending: true });

      setEvents((data || []) as ClockEvent[]);
      setLoading(false);
    };
    fetchEvents();
  }, [user, currentMonth]);

  const daySummaries = useMemo(() => {
    const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
    return days.map((date): DaySummary => {
      const dayEvents = events.filter((e) => isSameDay(new Date(e.timestamp), date));

      let workMinutes = 0;
      let breakMinutes = 0;
      let lastIn: Date | null = null;
      let breakStart: Date | null = null;
      let firstIn: string | null = null;
      let lastOut: string | null = null;

      for (const ev of dayEvents) {
        const t = new Date(ev.timestamp);
        if (ev.event_type === "clock_in") {
          lastIn = t;
          if (!firstIn) firstIn = ev.timestamp;
        } else if (ev.event_type === "clock_out" && lastIn) {
          workMinutes += (t.getTime() - lastIn.getTime()) / 60000;
          lastIn = null;
          lastOut = ev.timestamp;
        } else if (ev.event_type === "break_start") {
          breakStart = t;
        } else if (ev.event_type === "break_end" && breakStart) {
          breakMinutes += (t.getTime() - breakStart.getTime()) / 60000;
          breakStart = null;
        }
      }

      return {
        date,
        events: dayEvents,
        workMinutes: Math.max(0, Math.round(workMinutes - breakMinutes)),
        breakMinutes: Math.round(breakMinutes),
        firstIn,
        lastOut,
        hasAnomaly: dayEvents.some((e) => e.status === "anomaly"),
      };
    });
  }, [events, currentMonth]);

  const monthTotalMinutes = daySummaries.reduce((acc, d) => acc + d.workMinutes, 0);
  const workedDays = daySummaries.filter((d) => d.events.length > 0).length;

  const fmtMin = (m: number) => `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, "0")}m`;
  const fmtTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "-";

  const selectedDaySummary = selectedDay ? daySummaries.find((d) => isSameDay(d.date, selectedDay)) : null;

  const eventLabels: Record<string, { label: string; icon: any; color: string }> = {
    clock_in: { label: "Entrata", icon: LogIn, color: "text-emerald-600" },
    clock_out: { label: "Uscita", icon: LogOut, color: "text-red-600" },
    break_start: { label: "Inizio Pausa", icon: Coffee, color: "text-amber-600" },
    break_end: { label: "Fine Pausa", icon: Play, color: "text-blue-600" },
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-800">
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold text-white">Riepilogo Timbrature</h1>
            <p className="text-indigo-200 text-xs">Storico presenze e ore lavorate</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-4">
        {/* Month Selector */}
        <div className="bg-white rounded-2xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-bold capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: it })}
            </h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {/* Monthly Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-indigo-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-indigo-700">{fmtMin(monthTotalMinutes)}</p>
              <p className="text-[10px] text-indigo-500 font-medium uppercase">Ore Totali</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-emerald-700">{workedDays}</p>
              <p className="text-[10px] text-emerald-500 font-medium uppercase">Giorni Lavorati</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">
                {workedDays > 0 ? fmtMin(Math.round(monthTotalMinutes / workedDays)) : "-"}
              </p>
              <p className="text-[10px] text-amber-500 font-medium uppercase">Media/Giorno</p>
            </div>
          </div>

          {/* Day list */}
          <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : (
              daySummaries
                .filter((d) => d.events.length > 0)
                .reverse()
                .map((day) => (
                  <button
                    key={day.date.toISOString()}
                    onClick={() => setSelectedDay(selectedDay && isSameDay(selectedDay, day.date) ? null : day.date)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-colors ${
                      selectedDay && isSameDay(selectedDay, day.date)
                        ? "bg-indigo-50 border border-indigo-200"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                        isToday(day.date) ? "bg-indigo-600 text-white" : "bg-muted text-foreground"
                      }`}>
                        {format(day.date, "d")}
                      </div>
                      <div>
                        <p className="text-sm font-medium capitalize">
                          {format(day.date, "EEEE", { locale: it })}
                          {isToday(day.date) && <span className="ml-1 text-xs text-indigo-600">(oggi)</span>}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {fmtTime(day.firstIn)} → {fmtTime(day.lastOut)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {day.hasAnomaly && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                      <span className="text-sm font-bold text-foreground">{fmtMin(day.workMinutes)}</span>
                    </div>
                  </button>
                ))
            )}
            {!loading && daySummaries.every((d) => d.events.length === 0) && (
              <p className="text-center text-muted-foreground py-8 text-sm">Nessuna timbratura questo mese</p>
            )}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDaySummary && selectedDaySummary.events.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-lg">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {format(selectedDaySummary.date, "EEEE d MMMM", { locale: it })}
            </h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold">{fmtMin(selectedDaySummary.workMinutes)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Lavoro netto</p>
              </div>
              <div className="bg-muted rounded-lg p-2.5 text-center">
                <p className="text-lg font-bold">{fmtMin(selectedDaySummary.breakMinutes)}</p>
                <p className="text-[10px] text-muted-foreground uppercase">Pausa</p>
              </div>
            </div>

            <div className="space-y-2">
              {selectedDaySummary.events.map((ev) => {
                const cfg = eventLabels[ev.event_type] || { label: ev.event_type, icon: Clock, color: "text-gray-600" };
                const Icon = cfg.icon;
                return (
                  <div key={ev.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                      <div>
                        <span className="text-sm font-medium">{cfg.label}</span>
                        {ev.gps_lat && ev.gps_long && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-2.5 w-2.5" />
                            {ev.gps_lat.toFixed(4)}, {ev.gps_long.toFixed(4)}
                            {ev.distance_from_workplace != null && (
                              <span className="ml-1">({ev.distance_from_workplace}m)</span>
                            )}
                          </p>
                        )}
                      </div>
                      {ev.status === "anomaly" && <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-muted-foreground font-mono">{fmtTime(ev.timestamp)}</span>
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
