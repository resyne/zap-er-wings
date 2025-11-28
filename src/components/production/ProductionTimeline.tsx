import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, differenceInDays, startOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  customers?: {
    name: string;
  } | null;
  status: string;
  priority?: string | null;
}

interface ProductionTimelineProps {
  workOrders: WorkOrder[];
  onUpdateDates: (workOrderId: string, startDate: string, endDate: string) => Promise<void>;
  onViewDetails: (workOrder: WorkOrder) => void;
}

export function ProductionTimeline({ workOrders, onUpdateDates, onViewDetails }: ProductionTimelineProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { locale: it }));
  const [showDateDialog, setShowDateDialog] = useState(false);
  const [draggedWorkOrderId, setDraggedWorkOrderId] = useState<string | null>(null);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>();
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>();

  const weekEnd = endOfWeek(currentWeekStart, { locale: it });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });

  // Get weeks to display (current + 3 more weeks)
  const weeksToShow = 4;
  const allWeeks = Array.from({ length: weeksToShow }, (_, i) => {
    const weekStart = addWeeks(currentWeekStart, i);
    return {
      start: startOfWeek(weekStart, { locale: it }),
      end: endOfWeek(weekStart, { locale: it }),
    };
  });

  const programmedOrders = workOrders.filter(
    (wo) => wo.planned_start_date && wo.planned_end_date
  );
  const unprogrammedOrders = workOrders.filter(
    (wo) => !wo.planned_start_date || !wo.planned_end_date
  );

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const workOrderId = result.draggableId;
    const destinationDate = result.destination.droppableId;

    if (destinationDate.startsWith("day-")) {
      const dateStr = destinationDate.replace("day-", "");
      setDraggedWorkOrderId(workOrderId);
      setTempStartDate(new Date(dateStr));
      setTempEndDate(new Date(dateStr));
      setShowDateDialog(true);
    }
  };

  const handleConfirmDates = async () => {
    if (!draggedWorkOrderId || !tempStartDate || !tempEndDate) return;

    try {
      await onUpdateDates(
        draggedWorkOrderId,
        tempStartDate.toISOString(),
        tempEndDate.toISOString()
      );
      setShowDateDialog(false);
      setDraggedWorkOrderId(null);
      setTempStartDate(undefined);
      setTempEndDate(undefined);
    } catch (error) {
      console.error("Error updating dates:", error);
    }
  };

  const getWorkOrderPosition = (wo: WorkOrder) => {
    if (!wo.planned_start_date || !wo.planned_end_date) return null;

    const start = startOfDay(new Date(wo.planned_start_date));
    const end = startOfDay(new Date(wo.planned_end_date));
    const firstDay = allWeeks[0].start;
    const lastDay = allWeeks[allWeeks.length - 1].end;

    if (end < firstDay || start > lastDay) return null;

    const startOffset = Math.max(0, differenceInDays(start, firstDay));
    const duration = differenceInDays(end, start) + 1;
    const totalDays = weeksToShow * 7;

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${(duration / totalDays) * 100}%`,
      duration,
    };
  };

  const statusColors: Record<string, string> = {
    planned: "bg-blue-500/20 border-blue-500",
    in_lavorazione: "bg-yellow-500/20 border-yellow-500",
    completato: "bg-green-500/20 border-green-500",
    in_attesa: "bg-gray-500/20 border-gray-500",
    standby: "bg-purple-500/20 border-purple-500",
    bloccato: "bg-red-500/20 border-red-500",
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Unprogrammed Orders Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Non Programmate</CardTitle>
              <Badge variant="secondary">{unprogrammedOrders.length} commesse</Badge>
            </CardHeader>
            <CardContent>
              <Droppable droppableId="unprogrammed">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="space-y-2 min-h-[200px]"
                  >
                    {unprogrammedOrders.map((wo, index) => (
                      <Draggable key={wo.id} draggableId={wo.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(wo);
                            }}
                            className={`p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent transition-colors ${
                              snapshot.isDragging ? "opacity-50 shadow-lg" : ""
                            }`}
                          >
                            <div className="text-sm font-medium truncate">{wo.number}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              {wo.customers?.name}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </CardContent>
          </Card>
        </div>

        {/* Timeline View */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Timeline Produzione</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, weeksToShow))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { locale: it }))}
                  >
                    Oggi
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, weeksToShow))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Timeline Header - Weeks */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {allWeeks.map((week, index) => (
                    <div key={index} className="text-center border-b pb-2">
                      <div className="text-sm font-medium">
                        {format(week.start, "dd MMM", { locale: it })} -{" "}
                        {format(week.end, "dd MMM", { locale: it })}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Timeline Grid - Days */}
                <div className="relative">
                  {/* Day columns (for drop zones) */}
                  <div className="grid grid-cols-[repeat(28,1fr)] gap-px absolute inset-0 pointer-events-none">
                    {Array.from({ length: weeksToShow * 7 }).map((_, dayIndex) => {
                      const currentDay = addWeeks(currentWeekStart, Math.floor(dayIndex / 7));
                      const dayInWeek = dayIndex % 7;
                      const actualDate = eachDayOfInterval({
                        start: startOfWeek(currentDay, { locale: it }),
                        end: endOfWeek(currentDay, { locale: it }),
                      })[dayInWeek];

                      return (
                        <Droppable key={dayIndex} droppableId={`day-${actualDate.toISOString()}`}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`h-full border-r border-border pointer-events-auto ${
                                snapshot.isDraggingOver ? "bg-accent" : ""
                              } ${isSameDay(actualDate, new Date()) ? "bg-primary/5" : ""}`}
                            >
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      );
                    })}
                  </div>

                  {/* Work Orders */}
                  <div className="space-y-2 py-4 relative min-h-[400px]">
                    {programmedOrders.map((wo) => {
                      const position = getWorkOrderPosition(wo);
                      if (!position) return null;

                      return (
                        <div
                          key={wo.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewDetails(wo);
                          }}
                          className={`absolute h-16 rounded-lg border-2 p-2 cursor-pointer hover:shadow-lg transition-all ${
                            statusColors[wo.status] || "bg-gray-500/20 border-gray-500"
                          }`}
                          style={{
                            left: position.left,
                            width: position.width,
                            minWidth: "100px",
                          }}
                        >
                          <div className="text-xs font-medium truncate">{wo.number}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {wo.customers?.name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {position.duration} {position.duration === 1 ? "giorno" : "giorni"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-500/20 border-2 border-blue-500" />
                    <span className="text-xs">Pianificato</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-500/20 border-2 border-yellow-500" />
                    <span className="text-xs">In Lavorazione</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-500/20 border-2 border-green-500" />
                    <span className="text-xs">Completato</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-purple-500/20 border-2 border-purple-500" />
                    <span className="text-xs">Standby</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-500/20 border-2 border-red-500" />
                    <span className="text-xs">Bloccato</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Date Selection Dialog */}
      <Dialog open={showDateDialog} onOpenChange={setShowDateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seleziona Date di Lavorazione</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data Inizio</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !tempStartDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempStartDate ? format(tempStartDate, "PPP", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempStartDate}
                    onSelect={setTempStartDate}
                    locale={it}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data Fine</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !tempEndDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {tempEndDate ? format(tempEndDate, "PPP", { locale: it }) : "Seleziona data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={tempEndDate}
                    onSelect={setTempEndDate}
                    locale={it}
                    disabled={(date) => tempStartDate ? date < tempStartDate : false}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDateDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleConfirmDates} disabled={!tempStartDate || !tempEndDate}>
              Conferma
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DragDropContext>
  );
}
