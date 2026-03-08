import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download, BarChart3 } from "lucide-react";
import { format, endOfMonth } from "date-fns";
import { it } from "date-fns/locale";

interface EmployeeSummary {
  id: string;
  name: string;
  totalWorkHours: number;
  overtimeHours: number;
  lateCount: number;
  absentDays: number;
  presentDays: number;
}

export default function AttendanceReportsPage() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [summaries, setSummaries] = useState<EmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchReport(); }, [selectedMonth]);

  const fetchReport = async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const start = format(new Date(year, month - 1, 1), "yyyy-MM-dd");
    const end = format(endOfMonth(new Date(year, month - 1, 1)), "yyyy-MM-dd");

    const [attRes, profRes] = await Promise.all([
      supabase.from("attendance_days").select("*").gte("date", start).lte("date", end),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);

    const attendance = (attRes.data || []) as any[];
    const profiles = (profRes.data || []) as any[];

    const byEmployee: Record<string, any[]> = {};
    attendance.forEach((a) => {
      if (!byEmployee[a.employee_id]) byEmployee[a.employee_id] = [];
      byEmployee[a.employee_id].push(a);
    });

    const result: EmployeeSummary[] = profiles.map((p) => {
      const days = byEmployee[p.id] || [];
      return {
        id: p.id,
        name: p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email,
        totalWorkHours: Math.round(days.reduce((s: number, d: any) => s + (d.total_work_minutes || 0), 0) / 60 * 10) / 10,
        overtimeHours: Math.round(days.reduce((s: number, d: any) => s + (d.overtime_minutes || 0), 0) / 60 * 10) / 10,
        lateCount: days.filter((d: any) => d.late_minutes > 0).length,
        absentDays: days.filter((d: any) => d.status === "absent").length,
        presentDays: days.filter((d: any) => d.status === "present").length,
      };
    });

    setSummaries(result);
    setLoading(false);
  };

  const exportCSV = () => {
    const header = "Dipendente,Giorni Presenti,Ore Lavorate,Ore Straordinario,Ritardi,Assenze\n";
    const rows = summaries.map((s) => `"${s.name}",${s.presentDays},${s.totalWorkHours},${s.overtimeHours},${s.lateCount},${s.absentDays}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-presenze-${selectedMonth}.csv`;
    a.click();
  };

  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1);
    return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy", { locale: it }) };
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" />Report Presenze</h1>
          <p className="text-muted-foreground">Riepilogo mensile e export payroll</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-right py-3 px-3 font-medium">Giorni Presenti</th>
                  <th className="text-right py-3 px-3 font-medium">Ore Lavorate</th>
                  <th className="text-right py-3 px-3 font-medium">Ore Straordinario</th>
                  <th className="text-right py-3 px-3 font-medium">Ritardi</th>
                  <th className="text-right py-3 px-3 font-medium">Assenze</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 px-3 font-medium">{s.name}</td>
                    <td className="py-3 px-3 text-right">{s.presentDays}</td>
                    <td className="py-3 px-3 text-right font-mono">{s.totalWorkHours}h</td>
                    <td className="py-3 px-3 text-right font-mono text-amber-600">{s.overtimeHours}h</td>
                    <td className="py-3 px-3 text-right text-red-600">{s.lateCount}</td>
                    <td className="py-3 px-3 text-right">{s.absentDays}</td>
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
