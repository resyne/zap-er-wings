import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth } from "date-fns";
import { it } from "date-fns/locale";

interface AttendanceDay {
  id: string;
  employee_id: string;
  date: string;
  first_clock_in: string | null;
  last_clock_out: string | null;
  total_work_minutes: number;
  break_minutes: number;
  overtime_minutes: number;
  late_minutes: number;
  early_exit_minutes: number;
  status: string;
}

export default function AttendancePresenzePage() {
  const [records, setRecords] = useState<AttendanceDay[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedEmployee]);

  const fetchData = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

    let query = supabase
      .from("attendance_days")
      .select("*")
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: true });

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const [recordsRes, profilesRes] = await Promise.all([
      query,
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);

    setRecords((recordsRes.data || []) as unknown as AttendanceDay[]);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const formatTime = (ts: string | null) => ts ? new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) : "-";
  const formatMinutes = (m: number) => m > 0 ? `${Math.floor(m / 60)}h ${(m % 60).toString().padStart(2, "0")}m` : "-";

  const statusColors: Record<string, string> = {
    present: "bg-emerald-500",
    absent: "bg-red-500",
    holiday: "bg-blue-500",
    leave: "bg-purple-500",
    remote: "bg-cyan-500",
    travel: "bg-orange-500",
  };

  const statusLabels: Record<string, string> = {
    present: "Presente",
    absent: "Assente",
    holiday: "Festivo",
    leave: "Permesso",
    remote: "Remoto",
    travel: "Trasferta",
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: it }) };
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Presenze & Timesheet</h1>
        <p className="text-muted-foreground">Storico presenze giornaliere</p>
      </div>

      <div className="flex gap-4 flex-wrap">
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Dipendente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {profiles.map((p: any) => (
              <SelectItem key={p.id} value={p.id}>
                {p.first_name ? `${p.first_name} ${p.last_name || ""}` : p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Data</th>
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  <th className="text-left py-3 px-3 font-medium">Entrata</th>
                  <th className="text-left py-3 px-3 font-medium">Uscita</th>
                  <th className="text-left py-3 px-3 font-medium">Ore lavorate</th>
                  <th className="text-left py-3 px-3 font-medium">Pausa</th>
                  <th className="text-left py-3 px-3 font-medium">Straordinario</th>
                  <th className="text-left py-3 px-3 font-medium">Ritardo</th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-8 text-muted-foreground">Nessun dato per il periodo selezionato</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 px-3 font-mono">{format(new Date(r.date), "dd/MM/yyyy")}</td>
                      <td className="py-3 px-3">{getName(r.employee_id)}</td>
                      <td className="py-3 px-3"><Badge className={statusColors[r.status] || ""}>{statusLabels[r.status] || r.status}</Badge></td>
                      <td className="py-3 px-3 font-mono">{formatTime(r.first_clock_in)}</td>
                      <td className="py-3 px-3 font-mono">{formatTime(r.last_clock_out)}</td>
                      <td className="py-3 px-3">{formatMinutes(r.total_work_minutes)}</td>
                      <td className="py-3 px-3">{formatMinutes(r.break_minutes)}</td>
                      <td className="py-3 px-3 text-amber-600 font-medium">{formatMinutes(r.overtime_minutes)}</td>
                      <td className="py-3 px-3 text-red-600">{r.late_minutes > 0 ? `${r.late_minutes} min` : "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
