import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Clock } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  break_duration_minutes: number;
  tolerance_late_minutes: number;
  tolerance_early_minutes: number;
  is_night_shift: boolean;
  is_active: boolean;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [form, setForm] = useState({ name: "", start_time: "09:00", end_time: "18:00", break_duration_minutes: 60, tolerance_late_minutes: 10, tolerance_early_minutes: 10, is_night_shift: false });

  useEffect(() => { fetchShifts(); }, []);

  const fetchShifts = async () => {
    const { data } = await supabase.from("shifts").select("*").order("name");
    setShifts((data || []) as unknown as Shift[]);
    setLoading(false);
  };

  const handleSave = async () => {
    try {
      if (editing) {
        await supabase.from("shifts").update(form as any).eq("id", editing.id);
        toast.success("Turno aggiornato");
      } else {
        await supabase.from("shifts").insert(form as any);
        toast.success("Turno creato");
      }
      setDialogOpen(false);
      setEditing(null);
      fetchShifts();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openEdit = (s: Shift) => {
    setEditing(s);
    setForm({ name: s.name, start_time: s.start_time, end_time: s.end_time, break_duration_minutes: s.break_duration_minutes, tolerance_late_minutes: s.tolerance_late_minutes, tolerance_early_minutes: s.tolerance_early_minutes, is_night_shift: s.is_night_shift });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", start_time: "09:00", end_time: "18:00", break_duration_minutes: 60, tolerance_late_minutes: 10, tolerance_early_minutes: 10, is_night_shift: false });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Turni di Lavoro</h1>
          <p className="text-muted-foreground">Gestisci turni e pianificazione</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Nuovo Turno</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shifts.map((s) => (
          <Card key={s.id} className="cursor-pointer hover:shadow-md transition" onClick={() => openEdit(s)}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{s.name}</h3>
                <Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Attivo" : "Inattivo"}</Badge>
              </div>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" />{s.start_time} - {s.end_time}</div>
                <div>Pausa: {s.break_duration_minutes} min</div>
                <div>Tolleranza ritardo: {s.tolerance_late_minutes} min</div>
                {s.is_night_shift && <Badge variant="outline">Notturno</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Turno" : "Nuovo Turno"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Inizio</Label><Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><Label>Fine</Label><Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>
            </div>
            <div><Label>Pausa (minuti)</Label><Input type="number" value={form.break_duration_minutes} onChange={(e) => setForm({ ...form, break_duration_minutes: parseInt(e.target.value) || 0 })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tolleranza ritardo (min)</Label><Input type="number" value={form.tolerance_late_minutes} onChange={(e) => setForm({ ...form, tolerance_late_minutes: parseInt(e.target.value) || 0 })} /></div>
              <div><Label>Tolleranza anticipo (min)</Label><Input type="number" value={form.tolerance_early_minutes} onChange={(e) => setForm({ ...form, tolerance_early_minutes: parseInt(e.target.value) || 0 })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={form.is_night_shift} onCheckedChange={(v) => setForm({ ...form, is_night_shift: v })} /><Label>Turno notturno</Label></div>
            <Button onClick={handleSave} className="w-full">Salva</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
