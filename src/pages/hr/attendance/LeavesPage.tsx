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

interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: string;
  notes: string | null;
}

export default function LeavesPage() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ leave_type: "ferie", start_date: "", end_date: "", reason: "", notes: "" });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const [lRes, pRes] = await Promise.all([
      supabase.from("leave_requests").select("*").order("start_date", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, email, first_name, last_name"),
    ]);
    setLeaves((lRes.data || []) as unknown as LeaveRequest[]);
    setProfiles(pRes.data || []);
  };

  const getName = (id: string) => {
    const p = profiles.find((p: any) => p.id === id);
    return p ? (p.first_name ? `${p.first_name} ${p.last_name || ""}`.trim() : p.email) : id;
  };

  const handleCreate = async () => {
    if (!user) return;
    try {
      await supabase.from("leave_requests").insert({ employee_id: user.id, ...form } as any);
      toast.success("Richiesta inviata");
      setDialogOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApprove = async (id: string, approved: boolean) => {
    await supabase.from("leave_requests").update({ status: approved ? "approved" : "rejected", approved_by: user?.id } as any).eq("id", id);
    toast.success(approved ? "Richiesta approvata" : "Richiesta rifiutata");
    fetchData();
  };

  const typeLabels: Record<string, string> = { ferie: "Ferie", malattia: "Malattia", permesso: "Permesso", rol: "ROL", trasferta: "Trasferta", smart_working: "Smart Working" };
  const statusColors: Record<string, string> = { pending: "bg-amber-500", approved: "bg-emerald-500", rejected: "bg-red-500" };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Assenze / Permessi</h1>
          <p className="text-muted-foreground">Richieste ferie, permessi e assenze</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuova Richiesta</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left py-3 px-3 font-medium">Dipendente</th>
                  <th className="text-left py-3 px-3 font-medium">Tipo</th>
                  <th className="text-left py-3 px-3 font-medium">Dal</th>
                  <th className="text-left py-3 px-3 font-medium">Al</th>
                  <th className="text-left py-3 px-3 font-medium">Motivo</th>
                  <th className="text-left py-3 px-3 font-medium">Stato</th>
                  {isAdmin && <th className="text-left py-3 px-3 font-medium">Azioni</th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-b last:border-0">
                    <td className="py-3 px-3">{getName(l.employee_id)}</td>
                    <td className="py-3 px-3"><Badge variant="outline">{typeLabels[l.leave_type] || l.leave_type}</Badge></td>
                    <td className="py-3 px-3 font-mono">{new Date(l.start_date).toLocaleDateString("it-IT")}</td>
                    <td className="py-3 px-3 font-mono">{new Date(l.end_date).toLocaleDateString("it-IT")}</td>
                    <td className="py-3 px-3 text-muted-foreground">{l.reason || "-"}</td>
                    <td className="py-3 px-3"><Badge className={statusColors[l.status]}>{l.status}</Badge></td>
                    {isAdmin && l.status === "pending" && (
                      <td className="py-3 px-3 flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(l.id, true)}><CheckCircle2 className="h-4 w-4 text-emerald-600" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleApprove(l.id, false)}><XCircle className="h-4 w-4 text-red-600" /></Button>
                      </td>
                    )}
                    {isAdmin && l.status !== "pending" && <td className="py-3 px-3" />}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Richiesta</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm({ ...form, leave_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Dal</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div><Label>Al</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div><Label>Motivo</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
            <Button onClick={handleCreate} className="w-full">Invia Richiesta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
