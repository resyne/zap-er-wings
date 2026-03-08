import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Geofence {
  id: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  location_type: string;
  is_active: boolean;
}

export default function GeofencesPage() {
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", latitude: 0, longitude: 0, radius_meters: 100, location_type: "office" });

  useEffect(() => { fetchGeofences(); }, []);

  const fetchGeofences = async () => {
    const { data } = await supabase.from("geofences").select("*").order("name");
    setGeofences((data || []) as unknown as Geofence[]);
  };

  const handleSave = async () => {
    try {
      await supabase.from("geofences").insert(form as any);
      toast.success("Zona creata");
      setDialogOpen(false);
      fetchGeofences();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from("geofences").delete().eq("id", id);
    toast.success("Zona eliminata");
    fetchGeofences();
  };

  const typeLabels: Record<string, string> = { office: "Ufficio", site: "Cantiere", client: "Cliente" };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MapPin className="h-6 w-6" />Geofences</h1>
          <p className="text-muted-foreground">Zone autorizzate per la timbratura GPS</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nuova Zona</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {geofences.map((g) => (
          <Card key={g.id}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold">{g.name}</h3>
                <Badge variant={g.is_active ? "default" : "secondary"}>{g.is_active ? "Attiva" : "Inattiva"}</Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground">
                <div>Tipo: {typeLabels[g.location_type] || g.location_type}</div>
                <div>Raggio: {g.radius_meters}m</div>
                <div className="font-mono text-xs">Lat: {g.latitude.toFixed(6)}, Lng: {g.longitude.toFixed(6)}</div>
                {g.description && <div>{g.description}</div>}
              </div>
              <Button variant="ghost" size="sm" className="mt-3 text-red-600" onClick={() => handleDelete(g.id)}><Trash2 className="h-4 w-4 mr-1" />Elimina</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nuova Zona Geofence</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Descrizione</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Latitudine</Label><Input type="number" step="0.000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })} /></div>
              <div><Label>Longitudine</Label><Input type="number" step="0.000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })} /></div>
            </div>
            <div><Label>Raggio (metri)</Label><Input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: parseInt(e.target.value) || 100 })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.location_type} onValueChange={(v) => setForm({ ...form, location_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="office">Ufficio</SelectItem>
                  <SelectItem value="site">Cantiere</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="w-full">Crea Zona</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
