import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Package,
  Wrench,
  Truck,
  CalendarDays,
  CheckSquare,
  Clock,
  FileText,
  Plus,
  MapPin,
} from "lucide-react";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  parseISO,
  addWeeks,
  subWeeks,
  isToday,
} from "date-fns";
import { it } from "date-fns/locale";
import { useCalendarData } from "@/components/direzione/calendario/useCalendarData";
import {
  CalendarItem,
  statusLabels,
} from "@/components/direzione/calendario/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { AddCalendarActivityDialog } from "@/components/hr/zapp/AddCalendarActivityDialog";

const WORK_ORDER_TYPES = ["work_order", "service_order", "shipping_order"];

const typeConfig: Record<string, { label: string; icon: any; bg: string; border: string; text: string }> = {
  work_order: { label: "Produzione", icon: Package, bg: "bg-purple-50", border: "border-l-purple-500", text: "text-purple-700" },
  service_order: { label: "Assistenza", icon: Wrench, bg: "bg-orange-50", border: "border-l-orange-500", text: "text-orange-700" },
  shipping_order: { label: "Spedizione", icon: Truck, bg: "bg-green-50", border: "border-l-green-500", text: "text-green-700" },
  event: { label: "Attività", icon: MapPin, bg: "bg-amber-50", border: "border-l-amber-500", text: "text-amber-700" },
};

function getItemDate(item: CalendarItem): Date | null {
  switch (item.item_type) {
    case "work_order":
    case "service_order": return item.scheduled_date ? parseISO(item.scheduled_date) : null;
    case "shipping_order": return item.order_date ? parseISO(item.order_date) : null;
    case "event": return item.event_date ? parseISO(item.event_date) : null;
    default: return null;
  }
}

function getItemTitle(item: CalendarItem): string {
  switch (item.item_type) {
    case "work_order": return item.title || `OP ${item.number}`;
    case "service_order": return item.title || `Assistenza ${item.number}`;
    case "shipping_order": return `Spedizione ${item.number}`;
    case "event": return item.title;
    default: return "Commessa";
  }
}

export default function ZAppCalendarioPage() {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showAddActivity, setShowAddActivity] = useState(false);

  const weekStart = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate.toISOString()]);
  const weekEnd = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }), [currentDate.toISOString()]);
  const weekDays = useMemo(() => eachDayOfInterval({ start: weekStart, end: weekEnd }), [weekStart, weekEnd]);

  const { items, loading, refetch } = useCalendarData(weekStart, weekEnd, { excludeLeadActivities: true });

  // Show work orders + calendar events
  const VISIBLE_TYPES = [...WORK_ORDER_TYPES, "event"];
  const visibleItems = useMemo(() => 
    items.filter((item) => VISIBLE_TYPES.includes(item.item_type) && item.item_type !== 'lead_activity' && item.item_type !== 'task'), 
    [items]
  );

  const getItemsForDay = (day: Date) =>
    visibleItems.filter((item) => {
      const d = getItemDate(item);
      return d && isSameDay(d, day);
    });

  const selectedDayItems = useMemo(() => getItemsForDay(selectedDay), [selectedDay, items]);

  const dayHasItems = (day: Date) => getItemsForDay(day).length > 0;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-4">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/hr/z-app")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-lg font-bold">Calendario Lavori</h1>
            <p className="text-indigo-200 text-xs">Settimana: {format(weekStart, "d MMM", { locale: it })} – {format(weekEnd, "d MMM yyyy", { locale: it })}</p>
          </div>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <div className="flex gap-1 flex-1 justify-center">
            {weekDays.map((day) => {
              const isSel = isSameDay(day, selectedDay);
              const isTod = isToday(day);
              const hasItems = dayHasItems(day);
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(day)}
                  className={`flex flex-col items-center px-2 py-1.5 rounded-xl transition-all min-w-[40px] ${
                    isSel ? "bg-white text-indigo-700 font-bold shadow" : "text-white/80 hover:bg-white/10"
                  }`}
                >
                  <span className="text-[10px] uppercase">{format(day, "EEE", { locale: it }).slice(0, 3)}</span>
                  <span className={`text-sm ${isTod && !isSel ? "underline underline-offset-2" : ""}`}>{format(day, "d")}</span>
                  {hasItems && <span className={`w-1.5 h-1.5 rounded-full mt-0.5 ${isSel ? "bg-indigo-500" : "bg-white/70"}`} />}
                </button>
              );
            })}
          </div>

          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Today button + Add */}
      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <h2 className="font-semibold text-foreground">
          {format(selectedDay, "EEEE d MMMM", { locale: it })}
        </h2>
        <div className="flex items-center gap-2">
          {!isToday(selectedDay) && (
            <Button variant="outline" size="sm" onClick={() => { setCurrentDate(new Date()); setSelectedDay(new Date()); }}>
              Oggi
            </Button>
          )}
          <Button size="sm" onClick={() => setShowAddActivity(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Attività
          </Button>
        </div>
      </div>

      {/* Items list */}
      <div className="px-4 pb-6 space-y-2">
        {loading ? (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : selectedDayItems.length === 0 ? (
          <div className="text-center py-12">
            <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Nessuna attività per questo giorno</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddActivity(true)}>
              <Plus className="h-4 w-4 mr-1" /> Aggiungi attività
            </Button>
          </div>
        ) : (
          selectedDayItems.map((item) => {
            const cfg = typeConfig[item.item_type] || typeConfig.work_order;
            const Icon = cfg.icon;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full text-left rounded-xl border-l-4 ${cfg.border} ${cfg.bg} p-3 shadow-sm active:scale-[0.98] transition-transform`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg bg-white/80 ${cfg.text}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">{getItemTitle(item)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {cfg.label}
                      </Badge>
                      {"status" in item && item.status && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {statusLabels[item.status as keyof typeof statusLabels] || item.status}
                        </Badge>
                      )}
                      {"number" in item && (
                        <span className="text-[10px] text-muted-foreground">#{(item as any).number}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl overflow-y-auto">
          {selectedItem && <ItemDetailSheet item={selectedItem} />}
        </SheetContent>
      </Sheet>

      {/* Add Activity Dialog */}
      <AddCalendarActivityDialog
        open={showAddActivity}
        onOpenChange={setShowAddActivity}
        defaultDate={selectedDay}
        onSuccess={refetch}
      />
    </div>
  );
}

function ItemDetailSheet({ item }: { item: CalendarItem }) {
  const cfg = typeConfig[item.item_type] || typeConfig.work_order;
  const Icon = cfg.icon;

  const formatDate = (d?: string | null) => {
    if (!d) return "–";
    try { return format(parseISO(d), "d MMM yyyy HH:mm", { locale: it }); } catch { return d; }
  };

  const Row = ({ icon: RowIcon, label, value }: { icon: any; label: string; value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0">
        <RowIcon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground">{value}</p>
        </div>
      </div>
    );
  };

  return (
    <>
      <SheetHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${cfg.bg} ${cfg.text}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <SheetTitle className="text-left">{getItemTitle(item)}</SheetTitle>
            <Badge variant="outline" className="mt-1 text-xs">{cfg.label}</Badge>
          </div>
        </div>
      </SheetHeader>

      <div className="divide-y-0">
        {"status" in item && item.status && (
          <Row icon={CheckSquare} label="Stato" value={statusLabels[item.status as keyof typeof statusLabels] || item.status} />
        )}

        {item.item_type === "work_order" && (
          <>
            <Row icon={FileText} label="Titolo" value={item.title} />
            <Row icon={Clock} label="Data pianificata" value={formatDate(item.scheduled_date)} />
            <Row icon={Clock} label="Inizio effettivo" value={formatDate(item.actual_start_date)} />
            <Row icon={Clock} label="Fine effettiva" value={formatDate(item.actual_end_date)} />
          </>
        )}

        {item.item_type === "service_order" && (
          <>
            <Row icon={FileText} label="Titolo" value={item.title} />
            <Row icon={Clock} label="Data pianificata" value={formatDate(item.scheduled_date)} />
            <Row icon={Clock} label="Completato" value={formatDate(item.completed_date)} />
          </>
        )}

        {item.item_type === "shipping_order" && (
          <>
            <Row icon={Clock} label="Data ordine" value={formatDate(item.order_date)} />
            <Row icon={Clock} label="Preparazione" value={formatDate(item.preparation_date)} />
            <Row icon={Clock} label="Pronto" value={formatDate(item.ready_date)} />
            <Row icon={Truck} label="Spedito" value={formatDate(item.shipped_date)} />
          </>
        )}

        {item.item_type === "event" && (
          <>
            <Row icon={Clock} label="Data" value={formatDate(item.event_date)} />
            <Row icon={FileText} label="Descrizione" value={item.description} />
          </>
        )}
      </div>
    </>
  );
}
