import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OperationalDocument {
  id: string;
  type: "order" | "ddt" | "report";
  number: string;
  customer: string;
  customer_id: string | null;
  date: string;
  amount: number | null;
  invoiced: boolean;
  invoice_number?: string | null;
  invoice_date?: string | null;
}

interface FetchOptions {
  onlyPending?: boolean;
}

async function fetchOperationalDocs(options: FetchOptions = {}): Promise<OperationalDocument[]> {
  const { onlyPending = false } = options;
  const ordersData: any[] = [];
  const ddtsData: any[] = [];
  const reportsData: any[] = [];
  const customersMap = new Map<string, string>();

  // Fetch customers for name lookup
  const customersRes = await (supabase as any)
    .from("customers")
    .select(`id, name, company_name`);
  if (customersRes.data) {
    customersRes.data.forEach((c: any) => customersMap.set(c.id, c.company_name || c.name));
  }

  // Fetch orders
  let ordersQuery = (supabase as any)
    .from("sales_orders")
    .select(`id, number, customer_id, order_date, total_amount, invoiced, invoice_number, invoice_date`)
    .order("created_at", { ascending: false });
  
  if (onlyPending) {
    ordersQuery = ordersQuery.eq('invoiced', false);
  }
  
  const ordersRes = await ordersQuery;
  if (ordersRes.data) ordersData.push(...ordersRes.data);

  // Fetch DDTs
  let ddtsQuery = (supabase as any)
    .from("ddts")
    .select(`id, ddt_number, customer_id, created_at, ddt_data, invoiced, invoice_number, invoice_date`)
    .order("created_at", { ascending: false });
  
  if (onlyPending) {
    ddtsQuery = ddtsQuery.eq('invoiced', false);
  }
  
  const ddtsRes = await ddtsQuery;
  if (ddtsRes.data) ddtsData.push(...ddtsRes.data);

  // Fetch service reports
  let reportsQuery = (supabase as any)
    .from("service_reports")
    .select(`id, intervention_date, total_amount, invoiced, invoice_number, invoice_date`)
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  
  if (onlyPending) {
    reportsQuery = reportsQuery.eq('invoiced', false);
  }
  
  const reportsRes = await reportsQuery;
  if (reportsRes.data) reportsData.push(...reportsRes.data);

  const unifiedDocs: OperationalDocument[] = [];

  ordersData.forEach((order: any) => {
    unifiedDocs.push({
      id: order.id,
      type: "order",
      number: order.number || "-",
      customer: customersMap.get(order.customer_id) || "-",
      customer_id: order.customer_id,
      date: order.order_date,
      amount: order.total_amount,
      invoiced: order.invoiced || false,
      invoice_number: order.invoice_number,
      invoice_date: order.invoice_date
    });
  });

  ddtsData.forEach((ddt: any) => {
    const ddtInfo = ddt.ddt_data as { destinatario?: string; data?: string } | null;
    unifiedDocs.push({
      id: ddt.id,
      type: "ddt",
      number: ddt.ddt_number || "-",
      customer: customersMap.get(ddt.customer_id) || ddtInfo?.destinatario || "-",
      customer_id: ddt.customer_id,
      date: ddtInfo?.data || ddt.created_at,
      amount: null,
      invoiced: ddt.invoiced || false,
      invoice_number: ddt.invoice_number,
      invoice_date: ddt.invoice_date
    });
  });

  reportsData.forEach((report: any) => {
    unifiedDocs.push({
      id: report.id,
      type: "report",
      number: `Report-${report.id?.slice(0,6) || ''}`,
      customer: "-",
      customer_id: null,
      date: report.intervention_date,
      amount: report.total_amount,
      invoiced: report.invoiced || false,
      invoice_number: report.invoice_number,
      invoice_date: report.invoice_date
    });
  });

  // Sort by date descending
  unifiedDocs.sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  return unifiedDocs;
}

export function useOperationalDocuments(options: FetchOptions = { onlyPending: true }) {
  return useQuery({
    queryKey: ['operational-documents', options.onlyPending],
    queryFn: () => fetchOperationalDocs(options)
  });
}

export function useAllOperationalDocuments() {
  return useQuery({
    queryKey: ['operational-documents-all'],
    queryFn: () => fetchOperationalDocs({ onlyPending: false })
  });
}
