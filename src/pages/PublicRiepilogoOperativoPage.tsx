import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  sales_order_id?: string;
  articles?: string;
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

const PublicRiepilogoOperativoPage = () => {
  const [productionOrders, setProductionOrders] = useState<WorkOrder[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
          production_work_order_id, sales_order_id,
          leads(company_name, contact_name)
        `)
        .eq('archived', false)
        .gte('scheduled_date', startDate.toISOString())
        .lte('scheduled_date', endDate.toISOString())
        .order('scheduled_date', { ascending: true });

      if (serviceError) throw serviceError;

      // Load articles for service orders that have sales_order_id (without prices)
      const serviceOrdersWithArticles = await Promise.all(
        (serviceData || []).map(async (so: any) => {
          let articles = '';
          if (so.sales_order_id) {
            const { data: items } = await supabase
              .from('sales_order_items')
              .select('product_name, quantity')
              .eq('sales_order_id', so.sales_order_id);
            
            if (items && items.length > 0) {
              articles = items.map(i => `${i.quantity}x ${i.product_name}`).join(', ');
            }
          }
          return {
            ...so,
            customer_name: so.leads?.company_name || so.leads?.contact_name || so.title,
            articles
          };
        })
      );
      
      setServiceOrders(serviceOrdersWithArticles);

    } catch (error) {
      console.error('Error loading data:', error);
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
      <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
        <Skeleton className="h-8 md:h-10 w-48 md:w-64" />
        <div className="space-y-4 md:space-y-0 md:grid md:grid-cols-2 md:gap-6">
          <Skeleton className="h-[400px] md:h-[600px]" />
          <Skeleton className="h-[400px] md:h-[600px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Riepilogo Operativo</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Visione integrata commesse
        </p>
      </div>

      <div className="space-y-4 xl:space-y-0 xl:grid xl:grid-cols-2 xl:gap-6">
        {/* Service Orders Calendar */}
        <Card className="h-fit">
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Wrench className="h-4 w-4 md:h-5 md:w-5" />
              Commesse di Lavoro
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {/* Calendar navigation */}
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="font-medium text-sm md:text-base capitalize">
                {format(currentMonth, 'MMM yyyy', { locale: it })}
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 md:h-9 md:w-auto md:px-3"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Calendar grid */}
            <div className="border rounded-lg overflow-hidden">
              {/* Week days header */}
              <div className="grid grid-cols-7 bg-muted">
                {weekDays.map((day, i) => (
                  <div key={day} className="p-1 md:p-2 text-center text-[10px] md:text-xs font-medium text-muted-foreground border-b">
                    <span className="hidden md:inline">{day}</span>
                    <span className="md:hidden">{day.charAt(0)}</span>
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
                      className={`min-h-[50px] md:min-h-[80px] p-0.5 md:p-1 border-b border-r ${
                        !isCurrentMonth ? 'bg-muted/50' : 'bg-background'
                      } ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <div className={`text-[10px] md:text-xs mb-0.5 md:mb-1 ${
                        isToday ? 'font-bold text-blue-600' : 
                        !isCurrentMonth ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayServiceOrders.slice(0, 2).map(so => {
                          // Get color from linked production order
                          const linkedColor = so.production_work_order_id 
                            ? productionColorMap[so.production_work_order_id]
                            : 'bg-gray-400';
                          
                          return (
                            <div
                              key={so.id}
                              className={`${linkedColor} text-white text-[7px] md:text-[9px] px-0.5 md:px-1 py-0.5 rounded`}
                              title={`${so.number} - ${so.customer_name || so.title}`}
                            >
                              <div className="truncate">
                                <span className="hidden md:inline">{so.number}</span>
                                <span className="md:hidden">{so.number.split('-').pop()}</span>
                              </div>
                              {so.customer_name && (
                                <div className="truncate text-white/80 text-[6px] md:text-[8px]">
                                  {so.customer_name}
                                </div>
                              )}
                              {so.articles && (
                                <div className="truncate text-white/90 text-[5px] md:text-[7px] font-medium">
                                  {so.articles}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {dayServiceOrders.length > 2 && (
                          <div className="text-[7px] md:text-[9px] text-muted-foreground text-center">
                            +{dayServiceOrders.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend - collapsible on mobile */}
            <details className="mt-3 md:mt-4">
              <summary className="text-xs font-medium cursor-pointer p-2 md:p-3 bg-muted/50 rounded-lg">
                Legenda colori ({productionOrders.length})
              </summary>
              <div className="p-2 md:p-3 bg-muted/50 rounded-b-lg border-t">
                <div className="flex flex-wrap gap-1.5 md:gap-2">
                  {productionOrders.slice(0, 6).map(wo => (
                    <div key={wo.id} className="flex items-center gap-1">
                      <div className={`w-2.5 h-2.5 md:w-3 md:h-3 rounded ${productionColorMap[wo.id]}`} />
                      <span className="text-[9px] md:text-[10px] text-muted-foreground">{wo.number}</span>
                    </div>
                  ))}
                  {productionOrders.length > 6 && (
                    <span className="text-[9px] md:text-[10px] text-muted-foreground">
                      +{productionOrders.length - 6} altri
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-1 md:ml-2 border-l pl-1 md:pl-2">
                    <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-gray-400" />
                    <span className="text-[9px] md:text-[10px] text-muted-foreground">Non collegato</span>
                  </div>
                </div>
              </div>
            </details>
          </CardContent>
        </Card>

        {/* Production Orders Kanban */}
        <Card className="h-fit">
          <CardHeader className="pb-2 md:pb-3 px-3 md:px-6">
            <CardTitle className="flex items-center gap-2 text-base md:text-lg">
              <Factory className="h-4 w-4 md:h-5 md:w-5" />
              Commesse di Produzione
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 md:px-6">
            {/* Horizontal scroll on mobile */}
            <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
              <div className="flex md:grid md:grid-cols-4 gap-2 md:gap-3 min-w-max md:min-w-0">
                {Object.entries(statusConfig).map(([status, config]) => (
                  <div 
                    key={status} 
                    className={`${config.bgColor} ${config.borderColor} border rounded-lg p-2 md:p-3 w-[160px] md:w-auto flex-shrink-0 md:flex-shrink`}
                  >
                    <h3 className="font-medium text-xs md:text-sm mb-2 text-foreground">{config.title}</h3>
                    <ScrollArea className="h-[250px] md:h-[350px]">
                      <div className="space-y-2 pr-2">
                        {getOrdersByStatus(status).map(wo => {
                          const colorClass = productionColorMap[wo.id];
                          return (
                            <div
                              key={wo.id}
                              className="bg-background rounded-md p-2 shadow-sm border relative"
                            >
                              {/* Color indicator */}
                              <div className={`absolute left-0 top-0 bottom-0 w-1 ${colorClass} rounded-l-md`} />
                              <div className="pl-2">
                                <div className="flex items-center justify-between mb-1 gap-1">
                                  <span className="font-medium text-[10px] md:text-xs">{wo.number}</span>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-[8px] md:text-[10px] px-1 py-0 ${
                                      wo.priority === 'high' ? 'border-red-500 text-red-600' :
                                      wo.priority === 'medium' ? 'border-yellow-500 text-yellow-600' :
                                      'border-gray-400 text-gray-500'
                                    }`}
                                  >
                                    {wo.priority === 'high' ? 'Alta' : wo.priority === 'medium' ? 'Media' : 'Bassa'}
                                  </Badge>
                                </div>
                                {wo.customer_name && (
                                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">
                                    {wo.customer_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {getOrdersByStatus(status).length === 0 && (
                          <div className="text-[10px] md:text-xs text-muted-foreground text-center py-4">
                            Nessuna commessa
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicRiepilogoOperativoPage;
