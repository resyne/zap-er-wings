import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, Coffee, MapPin, AlertTriangle, UserCheck, UserX } from "lucide-react";

interface EmployeeStatus {
  id: string;
  name: string;
  email: string;
  status: "working" | "on_break" | "absent" | "travel";
  clockIn: string | null;
  workMinutes: number;
  lastEvent: string | null;
}

export default function AttendanceDashboardPage() {
  const [employees, setEmployees] = useState<EmployeeStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];

      const [profilesRes, eventsRes] = await Promise.all([
        supabase.from("profiles").select("id, email, first_name, last_name"),
        supabase
          .from("clock_events")
          .select("*")
          .gte("timestamp", `${today}T00:00:00`)
          .lte("timestamp", `${today}T23:59:59`)
          .order("timestamp", { ascending: true }),
      ]);

      const profiles = profilesRes.data || [];
      const events = (eventsRes.data || []) as any[];

      const eventsByEmployee = events.reduce((acc: Record<string, any[]>, ev) => {
        if (!acc[ev.employee_id]) acc[ev.employee_id] = [];
        acc[ev.employee_id].push(ev);
        return acc;
      }, {});

      const statuses: EmployeeStatus[] = profiles.map((p: any) => {
        const empEvents = eventsByEmployee[p.id] || [];
        const lastEvent = empEvents.length > 0 ? empEvents[empEvents.length - 1] : null;

        let status: EmployeeStatus["status"] = "absent";
        if (lastEvent) {
          if (lastEvent.event_type === "clock_in" || lastEvent.event_type === "break_end") status = "working";
          else if (lastEvent.event_type === "break_start") status = "on_break";
          else if (lastEvent.event_type === "clock_out") status = "absent";
        }

        const clockIn = empEvents.find((e: any) => e.event_type === "clock_in");

        // Calculate work minutes
        let workMinutes = 0;
        let lastIn: Date | null = null;
        for (const ev of empEvents) {
          if (ev.event_type === "clock_in") lastIn = new Date(ev.timestamp);
          else if (ev.event_type === "clock_out" && lastIn) {
            workMinutes += (new Date(ev.timestamp).getTime() - lastIn.getTime()) / 60000;
            lastIn = null;
          }
        }
        if (lastIn) workMinutes += (Date.now() - lastIn.getTime()) / 60000;

        return {
          id: p.id,
          name: p.first_name && p.last_name ? `${p.first_name} ${p.last_name}` : p.email,
          email: p.email,
          status,
          clockIn: clockIn?.timestamp || null,
          workMinutes: Math.round(workMinutes),
          lastEvent: lastEvent?.event_type || null,
        };
      });

      setEmployees(statuses);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const present = employees.filter((e) => e.status === "working");
  const onBreak = employees.filter((e) => e.status === "on_break");
  const absent = employees.filter((e) => e.status === "absent");

  const formatMinutes = (m: number) => `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, "0")}m`;
  const formatTime = (ts: string | null) => (ts ? new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "-");

  const statusBadge = (s: EmployeeStatus["status"]) => {
    const map = {
      working: { label: "Presente", variant: "default" as const, className: "bg-emerald-500" },
      on_break: { label: "In pausa", variant: "secondary" as const, className: "bg-amber-500 text-white" },
      absent: { label: "Assente", variant: "outline" as const, className: "" },
      travel: { label: "Trasferta", variant: "secondary" as const, className: "bg-blue-500 text-white" },
    };
    const cfg = map[s];
    return <Badge className={cfg.className}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Presenze</h1>
        <p className="text-muted-foreground">Situazione in tempo reale del personale</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{present.length}</p>
              <p className="text-sm text-muted-foreground">Presenti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
              <Coffee className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{onBreak.length}</p>
              <p className="text-sm text-muted-foreground">In pausa</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-xl bg-gray-100 flex items-center justify-center">
              <UserX className="h-6 w-6 text-gray-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{absent.length}</p>
              <p className="text-sm text-muted-foreground">Assenti</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{employees.length}</p>
              <p className="text-sm text-muted-foreground">Totale</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employee Table */}
      <Card>
        <CardHeader>
          <CardTitle>Stato Dipendenti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Nome</th>
                  <th className="text-left py-3 px-2 font-medium">Stato</th>
                  <th className="text-left py-3 px-2 font-medium">Entrata</th>
                  <th className="text-left py-3 px-2 font-medium">Ore Lavorate</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="py-3 px-2 font-medium">{emp.name}</td>
                    <td className="py-3 px-2">{statusBadge(emp.status)}</td>
                    <td className="py-3 px-2 font-mono text-muted-foreground">{formatTime(emp.clockIn)}</td>
                    <td className="py-3 px-2 font-mono">{emp.workMinutes > 0 ? formatMinutes(emp.workMinutes) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
