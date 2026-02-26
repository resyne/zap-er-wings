import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Link2 } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateOrderDialog } from "@/components/dashboard/CreateOrderDialog";

const ACTIVITY_TYPES = [
  { value: "sopralluogo", label: "Sopralluogo", color: "#f59e0b" },
  { value: "installazione", label: "Installazione", color: "#3b82f6" },
  { value: "manutenzione", label: "Manutenzione", color: "#8b5cf6" },
  { value: "riunione", label: "Riunione", color: "#06b6d4" },
  { value: "formazione", label: "Formazione", color: "#10b981" },
  { value: "altro", label: "Altro", color: "#6b7280" },
];

const TYPES_WITH_COMMESSA = ["installazione", "manutenzione"];

interface AddCalendarActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultDate?: Date;
  onSuccess: () => void;
}

interface CommessaOption {
  id: string;
  number: string;
  title: string;
  type: string;
  status: string;
  customer_name?: string;
}

export const AddCalendarActivityDialog = ({ open, onOpenChange, defaultDate, onSuccess }: AddCalendarActivityDialogProps) => {
  const [activityType, setActivityType] = useState("sopralluogo");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState<Date | undefined>(defaultDate || new Date());
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);

  // Commessa linking
  const [commessaMode, setCommessaMode] = useState<"none" | "existing" | "new">("none");
  const [commesse, setCommesse] = useState<CommessaOption[]>([]);
  const [selectedCommessa, setSelectedCommessa] = useState("");
  const [commessaSearch, setCommessaSearch] = useState("");
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  const needsCommessa = TYPES_WITH_COMMESSA.includes(activityType);

  useEffect(() => {
    if (open) {
      loadUsers();
      if (defaultDate) setActivityDate(defaultDate);
    }
  }, [open, defaultDate]);

  useEffect(() => {
    if (needsCommessa && open) {
      loadCommesse();
    }
    if (!needsCommessa) {
      setCommessaMode("none");
      setSelectedCommessa("");
    }
  }, [activityType, open]);

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

  const loadCommesse = async () => {
    const { data } = await supabase
      .from('commesse')
      .select('id, number, title, type, status, customer_id, customers(name)')
      .not('status', 'eq', 'completata')
      .not('archived', 'eq', true)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) {
      setCommesse(data.map((c: any) => ({
        id: c.id,
        number: c.number,
        title: c.title,
        type: c.type,
        status: c.status,
        customer_name: c.customers?.name
      })));
    }
  };

  const filteredCommesse = commessaSearch
    ? commesse.filter(c =>
        c.number.toLowerCase().includes(commessaSearch.toLowerCase()) ||
        c.title.toLowerCase().includes(commessaSearch.toLowerCase()) ||
        (c.customer_name || '').toLowerCase().includes(commessaSearch.toLowerCase())
      )
    : commesse;

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
      const commessaRef = selectedCommessa
        ? commesse.find(c => c.id === selectedCommessa)
        : null;

      const eventTitle = commessaRef
        ? `${selectedType?.label || activityType}: ${title} [${commessaRef.number}]`
        : `${selectedType?.label || activityType}: ${title}`;

      const eventDescription = commessaRef
        ? `${description ? description + '\n\n' : ''}Commessa: ${commessaRef.number} - ${commessaRef.title}${commessaRef.customer_name ? ` (${commessaRef.customer_name})` : ''}`
        : description;

      const { error } = await supabase.from('calendar_events').insert({
        title: eventTitle,
        description: eventDescription,
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
    setCommessaMode("none");
    setSelectedCommessa("");
    setCommessaSearch("");
  };

  const handleOrderCreated = () => {
    setShowCreateOrder(false);
    loadCommesse();
    toast.success("Ordine creato! Ora puoi collegarlo all'attività.");
    setCommessaMode("existing");
  };

  return (
    <>
      <Dialog open={open && !showCreateOrder} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

            {/* Commessa section - only for installazione/manutenzione */}
            {needsCommessa && (
              <div className="space-y-3 p-3 rounded-lg border border-border bg-muted/30">
                <Label className="text-sm font-medium">Commessa di riferimento</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={commessaMode === "existing" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => setCommessaMode("existing")}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Collega esistente
                  </Button>
                  <Button
                    type="button"
                    variant={commessaMode === "new" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 gap-1"
                    onClick={() => {
                      setCommessaMode("new");
                      setShowCreateOrder(true);
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nuovo ordine
                  </Button>
                </div>

                {commessaMode === "existing" && (
                  <div className="space-y-2">
                    <Input
                      placeholder="Cerca commessa per numero, titolo o cliente..."
                      value={commessaSearch}
                      onChange={(e) => setCommessaSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredCommesse.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">Nessuna commessa trovata</p>
                      ) : (
                        filteredCommesse.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCommessa(c.id)}
                            className={cn(
                              "w-full text-left px-2 py-1.5 rounded text-sm transition-colors",
                              selectedCommessa === c.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted"
                            )}
                          >
                            <div className="font-medium text-xs">{c.number}</div>
                            <div className="text-[11px] opacity-80 truncate">
                              {c.title}{c.customer_name ? ` · ${c.customer_name}` : ''}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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

      {/* Full Create Order Dialog */}
      <CreateOrderDialog
        open={showCreateOrder}
        onOpenChange={(o) => {
          setShowCreateOrder(o);
          if (!o) setCommessaMode("existing");
        }}
        onSuccess={handleOrderCreated}
      />
    </>
  );
};
