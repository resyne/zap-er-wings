import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Link2, Search, ChevronRight, X, Check, User, StickyNote, ClipboardList } from "lucide-react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CreateOrderDialog } from "@/components/dashboard/CreateOrderDialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ACTIVITY_TYPES = [
  { value: "installazione", label: "Installazione", icon: "🔧", color: "#3b82f6" },
  { value: "intervento", label: "Intervento", icon: "🛠️", color: "#8b5cf6" },
  { value: "produzione", label: "Produzione", icon: "⚙️", color: "#f59e0b" },
  { value: "sopralluogo", label: "Sopralluogo", icon: "🔍", color: "#10b981" },
  { value: "riunione", label: "Riunione", icon: "👥", color: "#06b6d4" },
  { value: "altro", label: "Altro", icon: "📌", color: "#6b7280" },
];

const TYPES_WITH_COMMESSA = ["installazione", "intervento", "produzione"];

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
  const [activityType, setActivityType] = useState("installazione");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState<Date | undefined>(defaultDate || new Date());
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ id: string; label: string }>>([]);

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
    if (needsCommessa && open) loadCommesse();
    if (!needsCommessa) {
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
    setActivityType("installazione");
    setTitle("");
    setDescription("");
    setAssignedTo("");
    setSelectedCommessa("");
    setCommessaSearch("");
  };

  const handleOrderCreated = () => {
    setShowCreateOrder(false);
    loadCommesse();
    toast.success("Ordine creato! Ora puoi collegarlo all'attività.");
  };

  const selectedTypeObj = ACTIVITY_TYPES.find(t => t.value === activityType);
  const selectedCommessaObj = selectedCommessa ? commesse.find(c => c.id === selectedCommessa) : null;

  return (
    <>
      <Sheet open={open && !showCreateOrder} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] rounded-t-2xl overflow-y-auto p-0">
          {/* Header indigo */}
          <div className="bg-indigo-600 text-white px-5 py-4 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-white text-lg font-bold">Nuova Attività</SheetTitle>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 -mr-2" onClick={() => onOpenChange(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="text-indigo-200 text-xs mt-0.5">
              {activityDate ? format(activityDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona una data"}
            </p>
          </div>

          <div className="px-5 py-4 space-y-5">
            {/* Activity type chips */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
                Tipo attività
              </label>
              <div className="grid grid-cols-3 gap-2">
                {ACTIVITY_TYPES.map(t => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setActivityType(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 transition-all text-center active:scale-95",
                      activityType === t.value
                        ? "border-indigo-500 bg-indigo-50 shadow-sm"
                        : "border-border bg-background hover:border-muted-foreground/30"
                    )}
                  >
                    <span className="text-xl">{t.icon}</span>
                    <span className={cn(
                      "text-xs font-medium",
                      activityType === t.value ? "text-indigo-700" : "text-muted-foreground"
                    )}>
                      {t.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Commessa section */}
            {needsCommessa && (
              <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-indigo-600" />
                  <label className="text-sm font-semibold text-indigo-900">Commessa di riferimento</label>
                </div>

                {/* Selected commessa preview */}
                {selectedCommessaObj && (
                  <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-indigo-200">
                    <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{selectedCommessaObj.number}</p>
                      <p className="text-xs text-muted-foreground truncate">{selectedCommessaObj.title}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedCommessa("")} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {!selectedCommessaObj && (
                  <>
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca per numero, titolo o cliente..."
                        value={commessaSearch}
                        onChange={(e) => setCommessaSearch(e.target.value)}
                        className="pl-9 h-10 rounded-lg text-sm bg-white"
                      />
                    </div>

                    {/* Commessa list */}
                    <div className="max-h-44 overflow-y-auto space-y-1.5 -mx-1 px-1">
                      {filteredCommesse.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Nessuna commessa trovata</p>
                      ) : (
                        filteredCommesse.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => setSelectedCommessa(c.id)}
                            className="w-full text-left px-3 py-2.5 rounded-lg bg-white border border-border hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors active:scale-[0.98] flex items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground">{c.number}</p>
                              <p className="text-xs text-muted-foreground truncate">
                                {c.title}{c.customer_name ? ` · ${c.customer_name}` : ''}
                              </p>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))
                      )}
                    </div>

                    {/* New order button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700"
                      onClick={() => setShowCreateOrder(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Crea nuovo ordine
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Dettagli attività *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Es. Sopralluogo presso cliente XYZ"
                className="h-11 rounded-xl text-sm"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5" />
                Note
              </label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Dettagli aggiuntivi..."
                rows={2}
                className="rounded-xl text-sm resize-none"
              />
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Data *
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 rounded-xl",
                      !activityDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
                    {activityDate ? format(activityDate, "EEEE d MMMM yyyy", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={activityDate} onSelect={setActivityDate} locale={it} initialFocus />
                </PopoverContent>
              </Popover>
            </div>

            {/* Assign */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                Assegna a
              </label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-11 rounded-xl">
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

          {/* Sticky footer */}
          <div className="sticky bottom-0 bg-background border-t border-border px-5 py-4 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 h-12 rounded-xl text-sm font-medium"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Annulla
            </Button>
            <Button
              className="flex-1 h-12 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-700"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Salvataggio..." : "Aggiungi attività"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CreateOrderDialog
        open={showCreateOrder}
        onOpenChange={(o) => {
          setShowCreateOrder(o);
        }}
        onSuccess={handleOrderCreated}
      />
    </>
  );
};
