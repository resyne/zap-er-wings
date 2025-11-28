import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isSameDay, differenceInDays, startOfDay, addDays } from "date-fns";
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
  created_at: string;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  customers?: {
    name: string;
    code: string;
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
  const [draggingWo, setDraggingWo] = useState<{ id: string; type: 'move' | 'resize-left' | 'resize-right' } | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [originalDates, setOriginalDates] = useState<{ start: Date; end: Date } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

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
      const wo = workOrders.find(w => w.id === workOrderId);
      if (!wo) return;
      
      setDraggedWorkOrderId(workOrderId);
      
      // Use created_at as start date
      const createdDate = new Date(wo.created_at);
      setTempStartDate(createdDate);
      
      // Default end date is same as start date (1 day duration)
      setTempEndDate(createdDate);
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

  // Calculate lanes for overlapping work orders
  const getWorkOrderLanes = () => {
    const lanes: WorkOrder[][] = [];
    
    // Sort by start date
    const sortedOrders = [...programmedOrders].sort((a, b) => {
      const dateA = new Date(a.planned_start_date!).getTime();
      const dateB = new Date(b.planned_start_date!).getTime();
      return dateA - dateB;
    });

    sortedOrders.forEach(wo => {
      const start = startOfDay(new Date(wo.planned_start_date!));
      const end = startOfDay(new Date(wo.planned_end_date!));
      
      // Find first available lane
      let laneIndex = 0;
      let placed = false;
      
      while (!placed) {
        if (!lanes[laneIndex]) {
          lanes[laneIndex] = [];
        }
        
        // Check if this work order overlaps with any in this lane
        const hasOverlap = lanes[laneIndex].some(existingWo => {
          const existingStart = startOfDay(new Date(existingWo.planned_start_date!));
          const existingEnd = startOfDay(new Date(existingWo.planned_end_date!));
          
          // Check for overlap: start is before existingEnd and end is after existingStart
          return start <= existingEnd && end >= existingStart;
        });
        
        if (!hasOverlap) {
          lanes[laneIndex].push(wo);
          placed = true;
        } else {
          laneIndex++;
        }
      }
    });
    
    return lanes;
  };

  const lanes = getWorkOrderLanes();
  const laneHeight = 70; // Height of each lane in pixels

  const getWorkOrderPosition = (wo: WorkOrder, laneIndex: number) => {
    if (!wo.planned_start_date || !wo.planned_end_date) return null;

    const start = startOfDay(new Date(wo.planned_start_date));
    const end = startOfDay(new Date(wo.planned_end_date));
    const firstDay = allWeeks[0].start;
    const lastDay = allWeeks[allWeeks.length - 1].end;

    // If the work order is completely outside the visible range, don't show it
    if (end < firstDay || start > lastDay) return null;

    // Clamp the start and end dates to the visible range
    const visibleStart = start < firstDay ? firstDay : start;
    const visibleEnd = end > lastDay ? lastDay : end;

    const startOffset = Math.max(0, differenceInDays(visibleStart, firstDay));
    const duration = differenceInDays(visibleEnd, visibleStart) + 1;
    const totalDays = weeksToShow * 7;

    return {
      left: `${(startOffset / totalDays) * 100}%`,
      width: `${Math.min((duration / totalDays) * 100, 100 - (startOffset / totalDays) * 100)}%`,
      top: `${laneIndex * laneHeight}px`,
      duration: differenceInDays(end, start) + 1, // Show actual total duration
    };
  };

  const handleMouseDown = (e: React.MouseEvent, wo: WorkOrder, type: 'move' | 'resize-left' | 'resize-right') => {
    e.stopPropagation();
    setDraggingWo({ id: wo.id, type });
    setDragStartX(e.clientX);
    setOriginalDates({
      start: new Date(wo.planned_start_date!),
      end: new Date(wo.planned_end_date!)
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!draggingWo || !originalDates || !timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX;
    const totalDays = weeksToShow * 7;
    const dayWidth = rect.width / totalDays;
    const daysDelta = Math.round(deltaX / dayWidth);

    const wo = workOrders.find(w => w.id === draggingWo.id);
    if (!wo) return;

    if (draggingWo.type === 'move') {
      const newStart = addDays(originalDates.start, daysDelta);
      const newEnd = addDays(originalDates.end, daysDelta);
      setTempStartDate(newStart);
      setTempEndDate(newEnd);
    } else if (draggingWo.type === 'resize-left') {
      const newStart = addDays(originalDates.start, daysDelta);
      if (newStart < originalDates.end) {
        setTempStartDate(newStart);
        setTempEndDate(originalDates.end);
      }
    } else if (draggingWo.type === 'resize-right') {
      const newEnd = addDays(originalDates.end, daysDelta);
      if (newEnd > originalDates.start) {
        setTempStartDate(originalDates.start);
        setTempEndDate(newEnd);
      }
    }
  };

  const handleMouseUp = async () => {
    if (draggingWo && tempStartDate && tempEndDate) {
      try {
        await onUpdateDates(draggingWo.id, tempStartDate.toISOString(), tempEndDate.toISOString());
      } catch (error) {
        console.error("Error updating dates:", error);
      }
    }
    setDraggingWo(null);
    setDragStartX(0);
    setOriginalDates(null);
    setTempStartDate(undefined);
    setTempEndDate(undefined);
  };

  useEffect(() => {
    if (draggingWo) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingWo, dragStartX, originalDates, tempStartDate, tempEndDate]);

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
                            {wo.title && (
                              <div className="text-xs font-medium text-foreground/80 truncate mt-0.5">
                                {wo.title}
                              </div>
                            )}
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
                <div className="relative" ref={timelineRef}>
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
                  <div 
                    className="py-4 relative" 
                    style={{ 
                      minHeight: `${Math.max(400, lanes.length * laneHeight + 40)}px` 
                    }}
                  >
                    {lanes.map((lane, laneIndex) => 
                      lane.map((wo) => {
                        const isDragging = draggingWo?.id === wo.id;
                        const displayStart = isDragging && tempStartDate ? tempStartDate : new Date(wo.planned_start_date!);
                        const displayEnd = isDragging && tempEndDate ? tempEndDate : new Date(wo.planned_end_date!);
                        
                        const tempWo = { ...wo, planned_start_date: displayStart.toISOString(), planned_end_date: displayEnd.toISOString() };
                        const position = getWorkOrderPosition(tempWo, laneIndex);
                        if (!position) return null;

                        return (
                          <div
                            key={wo.id}
                            className={`absolute h-16 rounded-lg border-2 hover:shadow-lg transition-shadow group ${
                              statusColors[wo.status] || "bg-gray-500/20 border-gray-500"
                            } ${isDragging ? 'opacity-70 shadow-xl z-50' : ''}`}
                            style={{
                              left: position.left,
                              width: position.width,
                              top: position.top,
                              minWidth: "100px",
                            }}
                          >
                            {/* Resize handle left */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              onMouseDown={(e) => handleMouseDown(e, wo, 'resize-left')}
                            />
                            
                            {/* Main content area - draggable */}
                            <div
                              className="absolute inset-0 p-2 cursor-move flex items-center"
                              onMouseDown={(e) => handleMouseDown(e, wo, 'move')}
                              onClick={(e) => {
                                if (!isDragging) {
                                  e.stopPropagation();
                                  onViewDetails(wo);
                                }
                              }}
                            >
                              <GripVertical className="w-3 h-3 mr-1 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{wo.number}</div>
                                {wo.title && (
                                  <div className="text-xs font-medium text-foreground/80 truncate">
                                    {wo.title}
                                  </div>
                                )}
                                <div className="text-xs text-muted-foreground truncate">
                                  {wo.customers?.name}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  {position.duration} {position.duration === 1 ? "giorno" : "giorni"}
                                </div>
                              </div>
                            </div>

                            {/* Resize handle right */}
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity"
                              onMouseDown={(e) => handleMouseDown(e, wo, 'resize-right')}
                            />
                          </div>
                        );
                      })
                    )}
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
