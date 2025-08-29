import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, Calendar, Factory, Wrench, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isSameDay, parseISO } from "date-fns";
import { it } from "date-fns/locale";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  type: 'production' | 'service';
  scheduled_date?: string;
  location?: string;
  customer?: {
    name: string;
    code: string;
  };
  technician?: {
    first_name: string;
    last_name: string;
  };
}

const statusColors = {
  planned: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  testing: "bg-purple-100 text-purple-800 border-purple-200",
  closed: "bg-green-100 text-green-800 border-green-200",
  draft: "bg-gray-100 text-gray-800 border-gray-200"
};

const statusLabels = {
  planned: "Pianificato",
  in_progress: "In Corso",
  testing: "Test",
  closed: "Chiuso",
  draft: "Bozza"
};

export default function CalendarPage() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const { toast } = useToast();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 }); // Lunedì
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 }); // Domenica
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadWorkOrders();
  }, [currentWeek]);

  const loadWorkOrders = async () => {
    setLoading(true);
    try {
      // Carica ordini di produzione
      const { data: productionOrders, error: prodError } = await supabase
        .from('work_orders')
        .select(`
          id,
          number,
          title,
          status,
          scheduled_date,
          location,
          customers (
            name,
            code
          )
        `)
        .gte('scheduled_date', weekStart.toISOString())
        .lte('scheduled_date', weekEnd.toISOString())
        .not('scheduled_date', 'is', null);

      if (prodError) throw prodError;

      // Carica ordini di lavoro
      const { data: serviceOrders, error: serviceError } = await supabase
        .from('service_work_orders')
        .select(`
          id,
          number,
          title,
          status,
          scheduled_date,
          location,
          customers (
            name,
            code
          )
        `)
        .gte('scheduled_date', weekStart.toISOString())
        .lte('scheduled_date', weekEnd.toISOString())
        .not('scheduled_date', 'is', null);

      if (serviceError) throw serviceError;

      // Carica dati tecnici per ordini di servizio
      const serviceOrdersWithTechnicians = await Promise.all(
        (serviceOrders || []).map(async (order: any) => {
          if (order.assigned_to) {
            const { data: techData } = await supabase
              .from('technicians')
              .select('first_name, last_name')
              .eq('id', order.assigned_to)
              .maybeSingle();
            
            return { 
              ...order, 
              type: 'service' as const,
              technician: techData 
            };
          }
          return { ...order, type: 'service' as const };
        })
      );

      // Combina tutti gli ordini
      const allOrders: WorkOrder[] = [
        ...(productionOrders || []).map(order => ({ ...order, type: 'production' as const })),
        ...serviceOrdersWithTechnicians
      ];

      setWorkOrders(allOrders);
    } catch (error) {
      console.error('Error loading work orders:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento degli ordini",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOrdersForDay = (day: Date) => {
    return workOrders.filter(order => {
      if (!order.scheduled_date) return false;
      const orderDate = parseISO(order.scheduled_date);
      return isSameDay(orderDate, day);
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
        <h1 className="text-3xl font-bold text-foreground mb-2">Calendario Ordini</h1>
        <p className="text-muted-foreground">
          Visualizza gli ordini di produzione e di lavoro pianificati per settimana
        </p>
      </div>

      {/* Controlli navigazione */}
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

      {/* Grid calendario settimanale */}
      <div className="grid grid-cols-7 gap-4">
        {weekDays.map((day, index) => {
          const dayOrders = getOrdersForDay(day);
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
                {dayOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nessun ordine pianificato
                  </p>
                ) : (
                  dayOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => {
                        setSelectedOrder(order);
                        setShowDetailsDialog(true);
                      }}
                    >
                      <div className="space-y-2">
                        <div className="font-medium text-sm leading-tight">
                          {order.number}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {order.title}
                        </div>
                        {order.customer && (
                          <div className="text-xs text-muted-foreground">
                            {order.customer.name}
                          </div>
                        )}
                        {order.location && (
                          <div className="text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded">
                            📍 {order.location}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog dettagli ordine */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedOrder?.type === 'production' ? (
                <Factory className="w-5 h-5 text-blue-600" />
              ) : (
                <Wrench className="w-5 h-5 text-green-600" />
              )}
              {selectedOrder?.number}
            </DialogTitle>
            <DialogDescription>
              {selectedOrder?.type === 'production' ? 'Ordine di Produzione' : 'Ordine di Lavoro'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedOrder && (
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Titolo</h4>
                <p className="text-sm text-muted-foreground">{selectedOrder.title}</p>
              </div>
              
              {selectedOrder.customer && (
                <div>
                  <h4 className="font-medium mb-1">Cliente</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.customer.name} ({selectedOrder.customer.code})
                  </p>
                </div>
              )}
              
              {selectedOrder.technician && (
                <div>
                  <h4 className="font-medium mb-1">Tecnico Assegnato</h4>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrder.technician.first_name} {selectedOrder.technician.last_name}
                  </p>
                </div>
              )}
              
              <div>
                <h4 className="font-medium mb-1">Stato</h4>
                <Badge className={statusColors[selectedOrder.status as keyof typeof statusColors]}>
                  {statusLabels[selectedOrder.status as keyof typeof statusLabels]}
                </Badge>
              </div>
              
              {selectedOrder.scheduled_date && (
                <div>
                  <h4 className="font-medium mb-1">Data Pianificata</h4>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(selectedOrder.scheduled_date), "PPP 'alle' HH:mm", { locale: it })}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}