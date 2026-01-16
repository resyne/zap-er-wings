import { supabase } from "@/integrations/supabase/client";

interface WorkOrderStatus {
  status: string;
}

/**
 * Calcola lo stato dell'ordine in base allo stato delle commesse collegate
 * 
 * Logica:
 * - Se non ci sono commesse: mantieni stato esistente
 * - Se TUTTE le commesse sono completate: "completato"
 * - Se ALMENO UNA commessa è in lavorazione: "in_lavorazione"
 * - Altrimenti: "commissionato"
 */
export function calculateOrderStatusFromWorkOrders(
  workOrders: WorkOrderStatus[],
  serviceWorkOrders: WorkOrderStatus[],
  shippingOrders: WorkOrderStatus[]
): string {
  const allStatuses: string[] = [
    ...workOrders.map(wo => wo.status),
    ...serviceWorkOrders.map(swo => swo.status),
    ...shippingOrders.map(so => so.status)
  ];

  // Se non ci sono commesse, mantieni lo stato di default
  if (allStatuses.length === 0) {
    return 'commissionato';
  }

  // Stati che indicano "completato"
  const completedStatuses = ['completed', 'completata', 'spedito'];
  
  // Stati che indicano "in lavorazione"
  const inProgressStatuses = ['in_progress', 'in_preparazione', 'pronto', 'stand_by'];
  
  // Controlla se TUTTE le commesse sono completate
  const allCompleted = allStatuses.every(status => 
    completedStatuses.includes(status)
  );
  
  if (allCompleted) {
    return 'completato';
  }

  // Controlla se almeno una commessa è in lavorazione
  const anyInProgress = allStatuses.some(status => 
    inProgressStatuses.includes(status) || completedStatuses.includes(status)
  );

  // Se almeno una è in corso o completata (e non tutte completate), è in lavorazione
  if (anyInProgress) {
    return 'in_lavorazione';
  }

  // Altrimenti è ancora commissionato (tutte da_fare/da_preparare/planned)
  return 'commissionato';
}

/**
 * Aggiorna lo stato dell'ordine in base allo stato delle commesse collegate
 */
export async function syncOrderStatusWithWorkOrders(orderId: string): Promise<{ success: boolean; newStatus?: string; error?: string }> {
  try {
    // Carica tutte le commesse collegate all'ordine
    const [woRes, swoRes, soRes] = await Promise.all([
      supabase.from('work_orders').select('status').eq('sales_order_id', orderId),
      supabase.from('service_work_orders').select('status').eq('sales_order_id', orderId),
      supabase.from('shipping_orders').select('status').eq('sales_order_id', orderId)
    ]);

    if (woRes.error) throw woRes.error;
    if (swoRes.error) throw swoRes.error;
    if (soRes.error) throw soRes.error;

    const workOrders = woRes.data || [];
    const serviceWorkOrders = swoRes.data || [];
    const shippingOrders = soRes.data || [];

    // Se non ci sono commesse, non aggiornare lo stato
    if (workOrders.length === 0 && serviceWorkOrders.length === 0 && shippingOrders.length === 0) {
      return { success: true, newStatus: undefined };
    }

    // Calcola il nuovo stato
    const newStatus = calculateOrderStatusFromWorkOrders(
      workOrders,
      serviceWorkOrders,
      shippingOrders
    );

    // Aggiorna lo stato dell'ordine
    const { error: updateError } = await supabase
      .from('sales_orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateError) throw updateError;

    return { success: true, newStatus };
  } catch (error: any) {
    console.error('Error syncing order status:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Hook per usare la sincronizzazione dello stato ordine nei componenti
 */
export function useOrderStatusSync() {
  const syncStatus = async (orderId: string) => {
    return syncOrderStatusWithWorkOrders(orderId);
  };

  return { syncStatus };
}
