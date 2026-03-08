import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface Anomaly {
  id: string;
  employee_id: string;
  date: string;
  anomaly_type: string;
  description: string | null;
  severity: string;
  resolved: boolean;
}

export default function AnomaliesPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [aRes, pRes] = await Promise.all([
      supabase.from("attendance_anomalies").select("*").order("date", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);
    setAnomalies((aRes.data || []) as unknown as Anomaly[]);
    setProfiles(pRes.data || []);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const handleResolve = async (id: string) => {
    await supabase.from("attendance_anomalies").update({ resolved: true, resolved_by: user?.id, resolved_at: new Date().toISOString() } as any).eq("id", id);
    toast.success("Anomalia risolta");
    fetchData();
  };

  const typeLabels: Record<string, string> = {
    late: "Ritardo", early_exit: "Uscita anticipata", missing_clock: "Timbratura mancante",
    long_break: "Pausa lunga", gps_out_of_area: "Fuori zona GPS",
  };
  const severityColors: Record<string, string> = { info: "bg-blue-500", warning: "bg-amber-500", critical: "bg-red-500" };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><AlertTriangle className="h-6 w-6 text-amber-500" />Anomalie</h1>
        <p className="text-muted-foreground">Anomalie rilevate automaticamente dal sistema</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-left py-3 px-3 font-medium">Data</th>
                  <th className="text-left py-3 px-3 font-medium">Tipo</th>
                  <th className="text-left py-3 px-3 font-medium">Severità</th>
                  <th className="text-left py-3 px-3 font-medium">Descrizione</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  {isAdmin && <th className="text-left py-3 px-3 font-medium">Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {anomalies.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Nessuna anomalia rilevata 🎉</td></tr>
                ) : (
                  anomalies.map((a) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-3 px-3">{getName(a.employee_id)}</td>
                      <td className="py-3 px-3 font-mono">{new Date(a.date).toLocaleDateString("it-IT")}</td>
                      <td className="py-3 px-3">{typeLabels[a.anomaly_type] || a.anomaly_type}</td>
                      <td className="py-3 px-3"><Badge className={severityColors[a.severity]}>{a.severity}</Badge></td>
                      <td className="py-3 px-3 text-muted-foreground">{a.description || "-"}</td>
                      <td className="py-3 px-3">{a.resolved ? <Badge className="bg-emerald-500">Risolta</Badge> : <Badge variant="outline">Aperta</Badge>}</td>
                      {isAdmin && !a.resolved && (
                        <td className="py-3 px-3">
                          <Button size="sm" variant="ghost" onClick={() => handleResolve(a.id)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                        </td>
                      )}
                      {isAdmin && a.resolved && <td className="py-3 px-3" />}
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
