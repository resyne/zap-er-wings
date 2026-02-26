import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ACTIVITY_TYPES = [
  { value: "sopralluogo", label: "Sopralluogo", color: "#f59e0b" },
  { value: "installazione", label: "Installazione", color: "#3b82f6" },
  { value: "manutenzione", label: "Manutenzione", color: "#8b5cf6" },
  { value: "riunione", label: "Riunione", color: "#06b6d4" },
  { value: "formazione", label: "Formazione", color: "#10b981" },
  { value: "altro", label: "Altro", color: "#6b7280" },
];

interface AddCalendarActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onSuccess: () => void;
}

export const AddCalendarActivityDialog = ({ open, onOpenChange, defaultDate, onSuccess }: AddCalendarActivityDialogProps) => {
  const [activityType, setActivityType] = useState("sopralluogo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState<Date | undefined>(defaultDate || new Date());
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);

  useEffect(() => {
    if (open) {
      loadUsers();
      if (defaultDate) setActivityDate(defaultDate);
    }
  }, [open, defaultDate]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .order('first_name');
    if (data) {
      setUsers(data.map(u => ({
        id: u.id,
        label: u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : u.email || u.id
      })));
    }
  };

  const handleSubmit = async () => {
    if (!title || !activityDate) {
      toast.error("Inserisci almeno un titolo e una data");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Devi essere autenticato");
      return;
    }

    setLoading(true);
    try {
      const selectedType = ACTIVITY_TYPES.find(t => t.value === activityType);
      const { error } = await supabase.from('calendar_events').insert({
        title: `${selectedType?.label || activityType}: ${title}`,
        description,
        event_date: activityDate.toISOString(),
        event_type: activityType,
        color: selectedType?.color || "#6b7280",
        all_day: true,
        user_id: assignedTo || user.id,
      });

      if (error) throw error;

      toast.success("Attività aggiunta al calendario");
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (error: any) {
      console.error('Error adding activity:', error);
      toast.error("Errore durante l'aggiunta dell'attività");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setActivityType("sopralluogo");
    setTitle("");
    setDescription("");
    setAssignedTo("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Aggiungi Attività</DialogTitle>
          <DialogDescription>Pianifica un'attività nel calendario</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tipo Attività *</Label>
            <Select value={activityType} onValueChange={setActivityType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Dettagli Attività *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Es. Sopralluogo presso cliente XYZ"
            />
          </div>

          <div>
            <Label>Note (opzionale)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Dettagli aggiuntivi..."
              rows={3}
            />
          </div>

          <div>
            <Label>Data *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !activityDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {activityDate ? format(activityDate, "dd MMM yyyy", { locale: it }) : "Seleziona data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar mode="single" selected={activityDate} onSelect={setActivityDate} locale={it} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <Label>Assegna a</Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="Utente corrente" />
              </SelectTrigger>
              <SelectContent>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Annulla</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvataggio..." : "Aggiungi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
