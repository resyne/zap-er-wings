export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date?: string;
  status: string;
  priority: string;
  category: string;
  assigned_to?: string;
}

export interface WorkOrder {
  id: string;
  number: string;
  title?: string;
  status: string;
  type: string;
  scheduled_date?: string;
  actual_start_date?: string;
  actual_end_date?: string;
  customer_name?: string;
  commessa_id?: string;
}

export interface ServiceOrder {
  id: string;
  number: string;
  title?: string;
  status: string;
  scheduled_date?: string;
  completed_date?: string;
  customer_name?: string;
  commessa_id?: string;
}

export interface ShippingOrder {
  id: string;
  number: string;
  status: string;
  order_date?: string;
  preparation_date?: string;
  ready_date?: string;
  shipped_date?: string;
  customer_name?: string;
  commessa_id?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  event_date: string;
  end_date?: string;
  event_type: string;
  color: string;
  all_day: boolean;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  activity_date: string;
  status: string;
  notes?: string;
  assigned_to?: string;
  leads?: {
    company_name: string;
    contact_name?: string;
  };
  profiles?: {
    first_name: string;
    last_name: string;
  };
}

export type CalendarItem = 
  | (Task & { item_type: 'task' })
  | (WorkOrder & { item_type: 'work_order' })
  | (ServiceOrder & { item_type: 'service_order' })
  | (ShippingOrder & { item_type: 'shipping_order' })
  | (CalendarEvent & { item_type: 'event' })
  | (LeadActivity & { item_type: 'lead_activity' });

export const statusColors = {
  todo: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 border-yellow-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-gray-100 text-gray-800 border-gray-200"
};

export const statusLabels = {
  todo: "Da fare",
  in_progress: "In corso",
  completed: "Completato",
  cancelled: "Annullato"
};

export const priorityColors = {
  low: "bg-slate-100 text-slate-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800"
};

export const priorityLabels = {
  low: "Bassa",
  medium: "Media",
  high: "Alta"
};

export const activityTypeLabels: Record<string, string> = {
  call: "Chiamata",
  email: "Email",
  meeting: "Incontro",
  note: "Nota",
  task: "Task"
};
