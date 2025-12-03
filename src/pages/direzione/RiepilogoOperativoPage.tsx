import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Factory, Wrench } from "lucide-react";
import { format, startOfMonth, endOfMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, addDays } from "date-fns";
import { it } from "date-fns/locale";

interface WorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  customer_name?: string;
  lead_id?: string;
  sales_order_id?: string;
}

interface ServiceWorkOrder {
  id: string;
  number: string;
  title: string;
  status: string;
  scheduled_date?: string;
  customer_name?: string;
  production_work_order_id?: string;
}

// Generate consistent colors for work orders based on ID
const generateColor = (id: string): string => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500',
    'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-amber-500',
    'bg-cyan-500', 'bg-rose-500', 'bg-emerald-500', 'bg-violet-500'
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const statusConfig: Record<string, { title: string; bgColor: string; borderColor: string }> = {
  'da_fare': { title: 'Da Fare', bgColor: 'bg-gray-50 dark:bg-gray-900/50', borderColor: 'border-gray-200 dark:border-gray-700' },
  'in_corso': { title: 'In Corso', bgColor: 'bg-blue-50 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-700' },
  'in_attesa': { title: 'In Attesa', bgColor: 'bg-yellow-50 dark:bg-yellow-900/30', borderColor: 'border-yellow-200 dark:border-yellow-700' },
  'completato': { title: 'Completato', bgColor: 'bg-green-50 dark:bg-green-900/30', borderColor: 'border-green-200 dark:border-green-700' },
};

const RiepilogoOperativoPage = () => {
  const navigate = useNavigate();
  const [productionOrders, setProductionOrders] = useState<WorkOrder[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();

  const handleProductionOrderClick = (orderId: string) => {
    navigate(`/mfg/work-orders?orderId=${orderId}`);
  };

  const handleServiceOrderClick = (orderId: string) => {
    navigate(`/support/service-orders?orderId=${orderId}`);
  };

  // Create a color map for production orders
  const productionColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    productionOrders.forEach(wo => {
      map[wo.id] = generateColor(wo.id);
    });
    return map;
  }, [productionOrders]);

  useEffect(() => {
    loadData();
  }, [currentMonth]);

  const loadData = async () => {
    setLoading(true);
    try {
      const startDate = startOfMonth(currentMonth);
      const endDate = endOfMonth(currentMonth);

      // Load production work orders
      const { data: prodData, error: prodError } = await supabase
        .from('work_orders')
        .select(`
          id, number, title, status, priority, 
          planned_start_date, planned_end_date,
          lead_id, sales_order_id,
          leads(company_name, contact_name)
        `)
        .eq('archived', false)
        .order('created_at', { ascending: false });

      if (prodError) throw prodError;
      setProductionOrders((prodData || []).map((wo: any) => ({
        ...wo,
        customer_name: wo.leads?.company_name || wo.leads?.contact_name || wo.title
      })));

      // Load service work orders with production_work_order_id
      const { data: serviceData, error: serviceError } = await supabase
        .from('service_work_orders')
        .select(`
          id, number, title, status, scheduled_date,
          production_work_order_id,
          leads(company_name, contact_name)
        `)
        .eq('archived', false)
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString())
        .order('scheduled_date', { ascending: true });

      if (serviceError) throw serviceError;
      setServiceOrders((serviceData || []).map((so: any) => ({
        ...so,
        customer_name: so.leads?.company_name || so.leads?.contact_name || so.title
      })));

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Errore",
        description: "Errore nel caricamento dei dati",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getOrdersByStatus = (status: string) => {
    return productionOrders.filter(wo => wo.status === status);
  };

  const getServiceOrdersForDay = (day: Date) => {
    return serviceOrders.filter(so => 
      so.scheduled_date && isSameDay(new Date(so.scheduled_date), day)
    );
  };

  // Generate calendar days for the current month view
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    const days: Date[] = [];
    let current = start;
    while (current <= end) {
      days.push(current);
      current = addDays(current, 1);
    }
    return days;
  }, [currentMonth]);

  const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-[600px]" />
          <Skeleton className="h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Riepilogo Operativo</h1>
          <p className="text-muted-foreground">
            Visione integrata commesse di produzione e commesse di lavoro
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Production Orders Kanban */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Factory className="h-5 w-5" />
              Commesse di Produzione
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(statusConfig).map(([status, config]) => (
                <div key={status} className={`${config.bgColor} ${config.borderColor} border rounded-lg p-3`}>
                  <h3 className="font-medium text-sm mb-2 text-foreground">{config.title}</h3>
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2 pr-2">
                      {getOrdersByStatus(status).map(wo => {
                        const colorClass = productionColorMap[wo.id];
                        return (
                          <div
                            key={wo.id}
                            className="bg-background rounded-md p-2 shadow-sm border relative cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleProductionOrderClick(wo.id)}
                          >
                            {/* Color indicator */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass} rounded-l-md`} />
                            <div className="pl-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-xs">{wo.number}</span>
                                <Badge 
                                  variant="outline" 
                                  className={`text-[10px] px-1 py-0 ${
                                    wo.priority === 'high' ? 'border-red-500 text-red-600' :
                                    wo.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                                    'border-gray-400 text-gray-500'
                                  }`}
                                >
                                  {wo.priority === 'high' ? 'Alta' : wo.priority === 'medium' ? 'Media' : 'Bassa'}
                                </Badge>
                              </div>
                              {wo.customer_name && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {wo.customer_name}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {getOrdersByStatus(status).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nessuna commessa
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Service Orders Calendar */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Wrench className="h-5 w-5" />
              Commesse di Lavoro
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Calendar navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-medium">
                {format(currentMonth, 'MMMM yyyy', { locale: it })}
              </h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar grid */}
            <div className="border rounded-lg overflow-hidden">
              {/* Week days header */}
              <div className="grid grid-cols-7 bg-muted">
                {weekDays.map(day => (
                  <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground border-b">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar days */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                  const isToday = isSameDay(day, new Date());
                  const dayServiceOrders = getServiceOrdersForDay(day);

                  return (
                    <div
                      key={index}
                      className={`min-h-[80px] p-1 border-b border-r ${
                        !isCurrentMonth ? 'bg-muted/50' : 'bg-background'
                      } ${isToday ? 'bg-blue-50' : ''}`}
                    >
                      <div className={`text-xs mb-1 ${
                        isToday ? 'font-bold text-blue-600' : 
                        !isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayServiceOrders.slice(0, 3).map(so => {
                          // Get color from linked production order
                          const linkedColor = so.production_work_order_id 
                            ? productionColorMap[so.production_work_order_id]
                            : 'bg-gray-400';
                          
                          return (
                            <div
                              key={so.id}
                              className={`${linkedColor} text-white text-[9px] px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 hover:scale-105 transition-transform`}
                              title={`${so.number} - ${so.customer_name || so.title}`}
                              onClick={() => handleServiceOrderClick(so.id)}
                            >
                              {so.number}
                            </div>
                          );
                        })}
                        {dayServiceOrders.length > 3 && (
                          <div className="text-[9px] text-muted-foreground text-center">
                            +{dayServiceOrders.length - 3} altri
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <h4 className="text-xs font-medium mb-2">Legenda colori</h4>
              <div className="flex flex-wrap gap-2">
                {productionOrders.slice(0, 8).map(wo => (
                  <div key={wo.id} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded ${productionColorMap[wo.id]}`} />
                    <span className="text-[10px] text-muted-foreground">{wo.number}</span>
                  </div>
                ))}
                {productionOrders.length > 8 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{productionOrders.length - 8} altri
                  </span>
                )}
                <div className="flex items-center gap-1 ml-2 border-l pl-2">
                  <div className="w-3 h-3 rounded bg-gray-400" />
                  <span className="text-[10px] text-muted-foreground">Non collegato</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RiepilogoOperativoPage;
