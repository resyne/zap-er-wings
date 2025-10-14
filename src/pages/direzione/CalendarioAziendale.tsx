import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, CheckSquare, Wrench, Truck, Package, FileEdit } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  priority: string;
  category: string;
  assigned_to?: string;
  assignee?: {
    first_name: string;
    last_name: string;
  };
}

interface WorkOrder {
  id: string;
  number: string;
  title?: string;
  status: string;
  type: string;
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
}

interface ShippingOrder {
  id: string;
  order_number: string;
  customer_name?: string;
  status: string;
  scheduled_date?: string;
  delivery_date?: string;
}

interface ContentTask {
  id: string;
  title: string;
  description?: string;
  status: string;
  scheduled_date?: string;
  content_type?: string;
}

type CalendarItem = 
  | (Task & { item_type: 'task' })
  | (WorkOrder & { item_type: 'work_order' })
  | (ShippingOrder & { item_type: 'shipping_order' })
  | (ContentTask & { item_type: 'content_task' });

const statusColors = {
  todo: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

const statusLabels = {
  todo: "Da fare",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato"
};

const priorityColors = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800"
};

const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta"
};

export default function CalendarioAziendale() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadAllItems();
  }, [currentWeek]);

  const loadAllItems = async () => {
    setLoading(true);
    try {
      const allItems: CalendarItem[] = [];

      // Load tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select(`
          id,
          title,
          description,
          due_date,
          status,
          priority,
          category,
          assigned_to,
          profiles!tasks_assigned_to_fkey (
            first_name,
            last_name
          )
        `)
        .gte('due_date', weekStart.toISOString())
        .lte('due_date', weekEnd.toISOString())
        .not('due_date', 'is', null)
        .eq('is_template', false);

      if (tasksError) throw tasksError;

      if (tasksData) {
        const formattedTasks = tasksData.map((task: any) => ({
          ...task,
          assignee: task.profiles,
          item_type: 'task' as const
        }));
        allItems.push(...formattedTasks);
      }

      // Load production work orders
      const { data: productionWO, error: productionWOError } = await supabase
        .from('work_orders')
        .select('id, number, title, status, type, scheduled_start, scheduled_end, actual_start, actual_end')
        .gte('scheduled_start', weekStart.toISOString())
        .lte('scheduled_start', weekEnd.toISOString())
        .not('scheduled_start', 'is', null);

      if (!productionWOError && productionWO) {
        const formattedProductionWO = productionWO.map((wo: any) => ({
          ...wo,
          item_type: 'work_order' as const
        }));
        allItems.push(...formattedProductionWO);
      }

      // Load service work orders
      const { data: serviceWO, error: serviceWOError } = await supabase
        .from('service_work_orders')
        .select('id, number, title, status, type, scheduled_start, scheduled_end, actual_start, actual_end')
        .gte('scheduled_start', weekStart.toISOString())
        .lte('scheduled_start', weekEnd.toISOString())
        .not('scheduled_start', 'is', null);

      if (!serviceWOError && serviceWO) {
        const formattedServiceWO = serviceWO.map((wo: any) => ({
          ...wo,
          item_type: 'work_order' as const
        }));
        allItems.push(...formattedServiceWO);
      }

      // Load shipping orders
      const { data: shippingOrders, error: shippingError } = await supabase
        .from('shipping_orders')
        .select('id, order_number, customer_name, status, scheduled_date, delivery_date')
        .gte('scheduled_date', weekStart.toISOString())
        .lte('scheduled_date', weekEnd.toISOString())
        .not('scheduled_date', 'is', null);

      if (!shippingError && shippingOrders) {
        const formattedShipping = shippingOrders.map((order: any) => ({
          ...order,
          item_type: 'shipping_order' as const
        }));
        allItems.push(...formattedShipping);
      }

      setItems(allItems);
    } catch (error) {
      console.error('Error loading calendar items:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento delle attività",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getItemsForDay = (day: Date) => {
    return items.filter(item => {
      let itemDate: Date | null = null;
      
      if (item.item_type === 'task' && item.due_date) {
        itemDate = parseISO(item.due_date);
      } else if (item.item_type === 'work_order' && item.scheduled_start) {
        itemDate = parseISO(item.scheduled_start);
      } else if (item.item_type === 'shipping_order' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      } else if (item.item_type === 'content_task' && item.scheduled_date) {
        itemDate = parseISO(item.scheduled_date);
      }
      
      return itemDate && isSameDay(itemDate, day);
    });
  };

  const goToPreviousWeek = () => {
    setCurrentWeek(subWeeks(currentWeek, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(addWeeks(currentWeek, 1));
  };

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">Calendario Aziendale</h1>
        <p className="text-muted-foreground">
          Visualizza tutte le attività aziendali pianificate: task, ordini di lavoro, spedizioni e contenuti
        </p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={goToPreviousWeek}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-lg font-semibold">
            {format(weekStart, "d MMM", { locale: it })} - {format(weekEnd, "d MMM yyyy", { locale: it })}
          </div>
          <Button variant="outline" onClick={goToNextWeek}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button onClick={goToToday}>
          <Calendar className="w-4 h-4 mr-2" />
          Oggi
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayItems = getItemsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card key={index} className={`min-h-[300px] ${isToday ? 'ring-2 ring-primary' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className={`text-sm ${isToday ? 'text-primary' : ''}`}>
                  {format(day, "EEEE", { locale: it })}
                </CardTitle>
                <CardDescription className={`text-lg font-semibold ${isToday ? 'text-primary' : ''}`}>
                  {format(day, "d MMM", { locale: it })}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {dayItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nessuna attività pianificata
                  </p>
                ) : (
                  dayItems.map((item) => {
                    let icon = <CheckSquare className="w-3 h-3" />;
                    let borderColor = 'border-l-blue-400';
                    let title = '';
                    
                    if (item.item_type === 'task') {
                      icon = <CheckSquare className="w-3 h-3" />;
                      borderColor = 'border-l-blue-400';
                      title = item.title;
                    } else if (item.item_type === 'work_order') {
                      icon = <Wrench className="w-3 h-3" />;
                      borderColor = 'border-l-orange-400';
                      title = `${item.number}${item.title ? ` - ${item.title}` : ''}`;
                    } else if (item.item_type === 'shipping_order') {
                      icon = <Truck className="w-3 h-3" />;
                      borderColor = 'border-l-green-400';
                      title = `${item.order_number}${item.customer_name ? ` - ${item.customer_name}` : ''}`;
                    } else if (item.item_type === 'content_task') {
                      icon = <FileEdit className="w-3 h-3" />;
                      borderColor = 'border-l-purple-400';
                      title = item.title;
                    }
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors border-l-4 ${borderColor}`}
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDetailsDialog(true);
                        }}
                      >
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5">{icon}</div>
                            <div className="font-medium text-sm leading-tight flex-1">
                              {title}
                            </div>
                          </div>
                          {item.item_type === 'task' && item.assignee && (
                            <div className="text-xs text-muted-foreground ml-5">
                              👤 {item.assignee.first_name} {item.assignee.last_name}
                            </div>
                          )}
                          <div className="flex gap-1 ml-5">
                            <Badge variant="outline" className="text-xs">
                              {item.item_type === 'task' ? 'Task' : 
                               item.item_type === 'work_order' ? 'Ordine Lavoro' :
                               item.item_type === 'shipping_order' ? 'Spedizione' : 'Contenuto'}
                            </Badge>
                            {item.item_type === 'task' && (
                              <Badge className={priorityColors[item.priority as keyof typeof priorityColors] + " text-xs"}>
                                {priorityLabels[item.priority as keyof typeof priorityLabels]}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedItem?.item_type === 'task' && <CheckSquare className="w-5 h-5 text-blue-600" />}
              {selectedItem?.item_type === 'work_order' && <Wrench className="w-5 h-5 text-orange-600" />}
              {selectedItem?.item_type === 'shipping_order' && <Truck className="w-5 h-5 text-green-600" />}
              {selectedItem?.item_type === 'content_task' && <FileEdit className="w-5 h-5 text-purple-600" />}
              {selectedItem?.item_type === 'task' && selectedItem.title}
              {selectedItem?.item_type === 'work_order' && `${selectedItem.number}${selectedItem.title ? ` - ${selectedItem.title}` : ''}`}
              {selectedItem?.item_type === 'shipping_order' && `${selectedItem.order_number}${selectedItem.customer_name ? ` - ${selectedItem.customer_name}` : ''}`}
              {selectedItem?.item_type === 'content_task' && selectedItem.title}
            </DialogTitle>
            <DialogDescription>
              {selectedItem?.item_type === 'task' ? 'Task Aziendale' : 
               selectedItem?.item_type === 'work_order' ? 'Ordine di Lavoro' :
               selectedItem?.item_type === 'shipping_order' ? 'Ordine di Spedizione' : 'Attività Contenuto'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              {selectedItem.item_type === 'task' && (
                <>
                  {selectedItem.description && (
                    <div>
                      <h4 className="font-medium mb-1">Descrizione</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  {selectedItem.assignee && (
                    <div>
                      <h4 className="font-medium mb-1">Assegnato a</h4>
                      <p className="text-sm text-muted-foreground">
                        {selectedItem.assignee.first_name} {selectedItem.assignee.last_name}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-1">Categoria</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.category}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1">Priorità</h4>
                    <Badge className={priorityColors[selectedItem.priority as keyof typeof priorityColors]}>
                      {priorityLabels[selectedItem.priority as keyof typeof priorityLabels]}
                    </Badge>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge className={statusColors[selectedItem.status as keyof typeof statusColors]}>
                      {statusLabels[selectedItem.status as keyof typeof statusLabels]}
                    </Badge>
                  </div>
                  
                  {selectedItem.due_date && (
                    <div>
                      <h4 className="font-medium mb-1">Scadenza</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.due_date), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'work_order' && (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Tipo</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.type}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.scheduled_start && (
                    <div>
                      <h4 className="font-medium mb-1">Inizio Pianificato</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_start), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                  
                  {selectedItem.scheduled_end && (
                    <div>
                      <h4 className="font-medium mb-1">Fine Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_end), "PPP 'alle' HH:mm", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'shipping_order' && (
                <>
                  <div>
                    <h4 className="font-medium mb-1">Cliente</h4>
                    <p className="text-sm text-muted-foreground">{selectedItem.customer_name || 'N/A'}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.scheduled_date && (
                    <div>
                      <h4 className="font-medium mb-1">Data Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_date), "PPP", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}

              {selectedItem.item_type === 'content_task' && (
                <>
                  {selectedItem.description && (
                    <div>
                      <h4 className="font-medium mb-1">Descrizione</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.description}</p>
                    </div>
                  )}
                  
                  <div>
                    <h4 className="font-medium mb-1">Stato</h4>
                    <Badge variant="outline">{selectedItem.status}</Badge>
                  </div>
                  
                  {selectedItem.content_type && (
                    <div>
                      <h4 className="font-medium mb-1">Tipo Contenuto</h4>
                      <p className="text-sm text-muted-foreground">{selectedItem.content_type}</p>
                    </div>
                  )}
                  
                  {selectedItem.scheduled_date && (
                    <div>
                      <h4 className="font-medium mb-1">Data Pianificata</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(parseISO(selectedItem.scheduled_date), "PPP", { locale: it })}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
