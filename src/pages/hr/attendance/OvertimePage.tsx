import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/useUserRole";

interface OvertimeRecord {
  id: string;
  employee_id: string;
  date: string;
  minutes: number;
  overtime_type: string;
  status: string;
  notes: string | null;
}

export default function OvertimePage() {
  const [records, setRecords] = useState<OvertimeRecord[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const { isAdmin } = useUserRole();
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [recRes, profRes] = await Promise.all([
      supabase.from("overtime_records").select("*").order("date", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);
    setRecords((recRes.data || []) as unknown as OvertimeRecord[]);
    setProfiles(profRes.data || []);
    setLoading(false);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from("overtime_records").update({ status: approved ? "approved" : "rejected" } as any).eq("id", id);
    toast.success(approved ? "Straordinario approvato" : "Straordinario rifiutato");
    fetchData();
  };

  const typeLabels: Record<string, string> = { weekday: "Feriale", weekend: "Weekend", holiday: "Festivo", night: "Notturno" };
  const statusColors: Record<string, string> = { pending: "bg-amber-500", approved: "bg-emerald-500", rejected: "bg-red-500" };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Straordinari</h1>
        <p className="text-muted-foreground">Gestione e approvazione ore straordinarie</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-left py-3 px-3 font-medium">Data</th>
                  <th className="text-left py-3 px-3 font-medium">Ore</th>
                  <th className="text-left py-3 px-3 font-medium">Tipo</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  {isAdmin && <th className="text-left py-3 px-3 font-medium">Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Nessun record di straordinario</td></tr>
                ) : (
                  records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-3 px-3">{getName(r.employee_id)}</td>
                      <td className="py-3 px-3 font-mono">{new Date(r.date).toLocaleDateString("it-IT")}</td>
                      <td className="py-3 px-3 font-mono font-medium">{Math.floor(r.minutes / 60)}h {r.minutes % 60}m</td>
                      <td className="py-3 px-3"><Badge variant="outline">{typeLabels[r.overtime_type] || r.overtime_type}</Badge></td>
                      <td className="py-3 px-3"><Badge className={statusColors[r.status]}>{r.status}</Badge></td>
                      {isAdmin && r.status === "pending" && (
                        <td className="py-3 px-3 flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id, true)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id, false)}><XCircle className="h-4 w-4 text-red-600" /></Button>
                        </td>
                      )}
                      {isAdmin && r.status !== "pending" && <td className="py-3 px-3" />}
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
