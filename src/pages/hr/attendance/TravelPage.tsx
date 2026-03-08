import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MapPin, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface TravelRecord {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string | null;
  start_location: string | null;
  destination: string | null;
  distance_km: number | null;
  purpose: string | null;
  client_name: string | null;
  status: string;
  notes: string | null;
}

export default function TravelPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [records, setRecords] = useState<TravelRecord[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ start_location: "", destination: "", purpose: "", client_name: "", distance_km: 0, notes: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [recRes, profRes] = await Promise.all([
      supabase.from("travel_records").select("*").order("start_time", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);
    setRecords((recRes.data || []) as unknown as TravelRecord[]);
    setProfiles(profRes.data || []);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const handleCreate = async () => {
    if (!user) return;
    try {
      await supabase.from("travel_records").insert({
        employee_id: user.id,
        start_time: new Date().toISOString(),
        ...form,
        distance_km: form.distance_km || null,
      } as any);
      toast.success("Trasferta registrata");
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from("travel_records").update({
      status: approved ? "approved" : "rejected",
      approved_by: user?.id,
    } as any).eq("id", id);
    toast.success(approved ? "Trasferta approvata" : "Trasferta rifiutata");
    fetchData();
  };

  const handleComplete = async (id: string) => {
    await supabase.from("travel_records").update({ status: "completed", end_time: new Date().toISOString() } as any).eq("id", id);
    toast.success("Trasferta completata");
    fetchData();
  };

  const statusColors: Record<string, string> = { in_progress: "bg-blue-500", completed: "bg-emerald-500", approved: "bg-green-600", rejected: "bg-red-500" };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trasferte / Missioni</h1>
          <p className="text-muted-foreground">Gestisci trasferte e viaggi di lavoro</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuova Trasferta</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-left py-3 px-3 font-medium">Partenza</th>
                  <th className="text-left py-3 px-3 font-medium">Destinazione</th>
                  <th className="text-left py-3 px-3 font-medium">Cliente</th>
                  <th className="text-left py-3 px-3 font-medium">Km</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  <th className="text-left py-3 px-3 font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-3 px-3">{getName(r.employee_id)}</td>
                    <td className="py-3 px-3">{r.start_location || "-"}</td>
                    <td className="py-3 px-3">{r.destination || "-"}</td>
                    <td className="py-3 px-3">{r.client_name || "-"}</td>
                    <td className="py-3 px-3 font-mono">{r.distance_km || "-"}</td>
                    <td className="py-3 px-3"><Badge className={statusColors[r.status]}>{r.status}</Badge></td>
                    <td className="py-3 px-3 flex gap-1">
                      {r.status === "in_progress" && r.employee_id === user?.id && (
                        <Button size="sm" variant="outline" onClick={() => handleComplete(r.id)}>Completa</Button>
                      )}
                      {isAdmin && r.status === "completed" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id, true)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleApprove(r.id, false)}><XCircle className="h-4 w-4 text-red-600" /></Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Trasferta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Luogo partenza</Label><Input value={form.start_location} onChange={(e) => setForm({ ...form, start_location: e.target.value })} /></div>
            <div><Label>Destinazione</Label><Input value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} /></div>
            <div><Label>Cliente</Label><Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} /></div>
            <div><Label>Km stimati</Label><Input type="number" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: parseFloat(e.target.value) || 0 })} /></div>
            <div><Label>Motivo</Label><Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></div>
            <Button onClick={handleCreate} className="w-full">Registra Trasferta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
