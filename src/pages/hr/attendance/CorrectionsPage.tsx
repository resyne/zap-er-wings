import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface Correction {
  id: string;
  employee_id: string;
  date: string;
  event_type: string;
  requested_value: string;
  old_value: string | null;
  reason: string;
  status: string;
}

export default function CorrectionsPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ date: "", event_type: "clock_in", requested_value: "", reason: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [cRes, pRes] = await Promise.all([
      supabase.from("attendance_corrections").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);
    setCorrections((cRes.data || []) as unknown as Correction[]);
    setProfiles(pRes.data || []);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const handleCreate = async () => {
    if (!user) return;
    try {
      await supabase.from("attendance_corrections").insert({
        employee_id: user.id,
        date: form.date,
        event_type: form.event_type,
        requested_value: new Date(`${form.date}T${form.requested_value}`).toISOString(),
        reason: form.reason,
      } as any);
      toast.success("Richiesta correzione inviata");
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from("attendance_corrections").update({ status: approved ? "approved" : "rejected", approved_by: user?.id } as any).eq("id", id);
    toast.success(approved ? "Correzione approvata" : "Correzione rifiutata");
    fetchData();
  };

  const eventLabels: Record<string, string> = { clock_in: "Entrata", clock_out: "Uscita", break_start: "Inizio Pausa", break_end: "Fine Pausa" };
  const statusColors: Record<string, string> = { pending: "bg-amber-500", approved: "bg-emerald-500", rejected: "bg-red-500" };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Correzioni Timbrature</h1>
          <p className="text-muted-foreground">Richieste di correzione timbrature</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Richiedi Correzione</Button>
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
                  <th className="text-left py-3 px-3 font-medium">Orario richiesto</th>
                  <th className="text-left py-3 px-3 font-medium">Motivo</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  {isAdmin && <th className="text-left py-3 px-3 font-medium">Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {corrections.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 px-3">{getName(c.employee_id)}</td>
                    <td className="py-3 px-3 font-mono">{new Date(c.date).toLocaleDateString("it-IT")}</td>
                    <td className="py-3 px-3">{eventLabels[c.event_type] || c.event_type}</td>
                    <td className="py-3 px-3 font-mono">{new Date(c.requested_value).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="py-3 px-3 text-muted-foreground">{c.reason}</td>
                    <td className="py-3 px-3"><Badge className={statusColors[c.status]}>{c.status}</Badge></td>
                    {isAdmin && c.status === "pending" && (
                      <td className="py-3 px-3 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(c.id, true)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(c.id, false)}><XCircle className="h-4 w-4 text-red-600" /></Button>
                      </td>
                    )}
                    {isAdmin && c.status !== "pending" && <td className="py-3 px-3" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Richiedi Correzione</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div>
              <Label>Tipo evento</Label>
              <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(eventLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Orario corretto</Label><Input type="time" value={form.requested_value} onChange={(e) => setForm({ ...form, requested_value: e.target.value })} /></div>
            <div><Label>Motivo</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Es: Ho dimenticato di timbrare l'entrata" /></div>
            <Button onClick={handleCreate} className="w-full">Invia Richiesta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
