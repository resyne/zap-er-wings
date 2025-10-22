import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, Wrench, Truck, CalendarDays, Users, Filter } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO, startOfMonth, endOfMonth, addMonths, subMonths, addDays, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { useCalendarData } from "@/components/direzione/calendario/useCalendarData";
import { ItemDetailsDialog } from "@/components/direzione/calendario/ItemDetailsDialog";
import { CalendarItem, statusColors, statusLabels, activityTypeLabels } from "@/components/direzione/calendario/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type ViewMode = 'day' | 'week' | 'month';
type ItemTypeFilter = 'task' | 'work_order' | 'service_order' | 'shipping_order' | 'event' | 'lead_activity';

export default function CalendarioAziendaleNew() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [activeFilters, setActiveFilters] = useState<ItemTypeFilter[]>([
    'task', 'work_order', 'service_order', 'shipping_order', 'event', 'lead_activity'
  ]);

  const getDateRange = () => {
    if (viewMode === 'day') {
      const dayStart = startOfDay(currentDate);
      const dayEnd = addDays(dayStart, 1);
      return { start: dayStart, end: dayEnd, days: [dayStart] };
    } else if (viewMode === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
      const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
      return { start: weekStart, end: weekEnd, days: weekDays };
    } else {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      const monthDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
      return { start: monthStart, end: monthEnd, days: monthDays };
    }
  };

  const { start, end, days } = getDateRange();
  const { items, loading } = useCalendarData(start, end);

  const getItemsForDay = (day: Date) => {
    return items.filter(item => {
      // Applica filtri di tipologia
      if (!activeFilters.includes(item.item_type)) {
        return false;
      }

      let itemDate: Date | null = null;
      
      switch (item.item_type) {
        case 'task':
          itemDate = item.due_date ? parseISO(item.due_date) : null;
          break;
        case 'work_order':
          itemDate = item.scheduled_date ? parseISO(item.scheduled_date) : null;
          break;
        case 'service_order':
          itemDate = item.scheduled_date ? parseISO(item.scheduled_date) : null;
          break;
        case 'shipping_order':
          itemDate = item.order_date ? parseISO(item.order_date) : null;
          break;
        case 'event':
          itemDate = parseISO(item.event_date);
          break;
        case 'lead_activity':
          itemDate = parseISO(item.activity_date);
          break;
      }
      
      return itemDate && isSameDay(itemDate, day);
    });
  };

  const goToPrevious = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, -1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subMonths(currentDate, 1));
  };

  const goToNext = () => {
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addMonths(currentDate, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const getHeaderText = () => {
    if (viewMode === 'day') {
      return format(currentDate, "EEEE d MMMM yyyy", { locale: it });
    } else if (viewMode === 'week') {
      return `${format(start, "d MMM", { locale: it })} - ${format(end, "d MMM yyyy", { locale: it })}`;
    } else {
      return format(currentDate, "MMMM yyyy", { locale: it });
    }
  };

  const handleItemClick = (item: CalendarItem) => {
    setSelectedItem(item);
    setShowDetailsDialog(true);
  };

  const toggleFilter = (filter: ItemTypeFilter) => {
    setActiveFilters(prev => 
      prev.includes(filter) 
        ? prev.filter(f => f !== filter)
        : [...prev, filter]
    );
  };

  const filterOptions: { value: ItemTypeFilter; label: string; icon: any }[] = [
    { value: 'task', label: 'Task', icon: CalendarIcon },
    { value: 'work_order', label: 'Commesse Produzione', icon: Package },
    { value: 'service_order', label: 'Commesse Assistenza', icon: Wrench },
    { value: 'shipping_order', label: 'Commesse Spedizione', icon: Truck },
    { value: 'event', label: 'Eventi', icon: CalendarDays },
    { value: 'lead_activity', label: 'Attività CRM', icon: Users },
  ];

  const getItemBadge = (item: CalendarItem) => {
    if (item.item_type === 'task') {
      return (
        <Badge variant="outline" className={`${statusColors[item.status as keyof typeof statusColors]} w-full justify-start text-left px-2 py-1`}>
          <CalendarIcon className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">{item.title}</span>
        </Badge>
      );
    } else if (item.item_type === 'lead_activity') {
      const actType = activityTypeLabels[item.activity_type] || item.activity_type;
      const companyName = item.leads?.company_name || 'Lead';
      return (
        <Badge variant="outline" className="bg-purple-100 dark:bg-purple-900 w-full justify-start text-left px-2 py-1">
          <Users className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">{actType}: {companyName}</span>
        </Badge>
      );
    } else if (item.item_type === 'work_order') {
      return (
        <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 w-full justify-start text-left px-2 py-1">
          <Package className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">OP: {item.number}</span>
        </Badge>
      );
    } else if (item.item_type === 'service_order') {
      return (
        <Badge variant="outline" className="bg-orange-100 dark:bg-orange-900 w-full justify-start text-left px-2 py-1">
          <Wrench className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">Assistenza: {item.number}</span>
        </Badge>
      );
    } else if (item.item_type === 'shipping_order') {
      return (
        <Badge variant="outline" className="bg-green-100 dark:bg-green-900 w-full justify-start text-left px-2 py-1">
          <Truck className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">Spedizione: {item.number}</span>
        </Badge>
      );
    } else if (item.item_type === 'event') {
      return (
        <Badge variant="outline" className="bg-indigo-100 dark:bg-indigo-900 w-full justify-start text-left px-2 py-1">
          <CalendarDays className="h-3 w-3 mr-1 flex-shrink-0" />
          <span className="truncate text-xs">{item.title}</span>
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Calendario Aziendale</h1>
        <p className="text-muted-foreground">
          Visualizza tutte le attività aziendali pianificate
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={goToPrevious}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold min-w-[300px] text-center">
            {getHeaderText()}
          </div>
          <Button variant="outline" onClick={goToNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={goToToday}>
            <CalendarIcon className="w-4 h-4 mr-2" />
            Oggi
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtri ({activeFilters.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Tipologie di attività</h4>
                {filterOptions.map(({ value, label, icon: Icon }) => (
                  <div key={value} className="flex items-center space-x-2">
                    <Checkbox
                      id={value}
                      checked={activeFilters.includes(value)}
                      onCheckedChange={() => toggleFilter(value)}
                    />
                    <Label
                      htmlFor={value}
                      className="flex items-center gap-2 text-sm font-normal cursor-pointer"
                    >
                      <Icon className="h-4 w-4" />
                      {label}
                    </Label>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('day')}
            >
              Giorno
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Settimana
            </Button>
            <Button
              variant={viewMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Mese
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Caricamento...</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-4">
          {days.map((day) => {
            const dayItems = getItemsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isCurrentMonth = viewMode !== 'month' || isSameDay(new Date(day.getFullYear(), day.getMonth()), new Date(currentDate.getFullYear(), currentDate.getMonth()));

            return (
              <Card 
                key={day.toISOString()} 
                className={`${!isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'border-primary border-2' : ''}`}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    {format(day, viewMode === 'month' ? 'd' : 'EEE d', { locale: it })}
                    {isToday && <span className="ml-2 text-primary">(Oggi)</span>}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-1">
                    {dayItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nessuna attività</p>
                    ) : (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="cursor-pointer hover:opacity-70 transition-opacity"
                          onClick={() => handleItemClick(item)}
                        >
                          {getItemBadge(item)}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ItemDetailsDialog
        item={selectedItem}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
      />
    </div>
  );
}
