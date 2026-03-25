import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InvoiceDocumentLink {
  id: string;
  invoice_id: string;
  document_id: string;
  document_type: string;
  linked_at: string;
  invoice_number?: string;
  invoice_date?: string;
  subject_name?: string;
  total_amount?: number;
}

/** Fetch all invoice links for a specific operational document */
export function useLinksForDocument(documentId: string, documentType: string, enabled = true) {
  return useQuery({
    queryKey: ["invoice-document-links", documentId, documentType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_document_links")
        .select("id, invoice_id, document_id, document_type, linked_at")
        .eq("document_id", documentId)
        .eq("document_type", documentType);
      if (error) throw error;

      if (!data || data.length === 0) return [];

      // Fetch invoice details
      const invoiceIds = data.map(l => l.invoice_id);
      const { data: invoices } = await supabase
        .from("invoice_registry")
        .select("id, invoice_number, invoice_date, subject_name, total_amount")
        .in("id", invoiceIds);

      const invMap = new Map((invoices || []).map(i => [i.id, i]));

      return data.map(link => ({
        ...link,
        invoice_number: invMap.get(link.invoice_id)?.invoice_number,
        invoice_date: invMap.get(link.invoice_id)?.invoice_date,
        subject_name: invMap.get(link.invoice_id)?.subject_name,
        total_amount: invMap.get(link.invoice_id)?.total_amount,
      })) as InvoiceDocumentLink[];
    },
    enabled: enabled && !!documentId,
  });
}

/** Fetch all invoice links for a specific invoice */
export function useLinksForInvoice(invoiceId: string, enabled = true) {
  return useQuery({
    queryKey: ["invoice-document-links-by-invoice", invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_document_links")
        .select("id, invoice_id, document_id, document_type, linked_at")
        .eq("invoice_id", invoiceId);
      if (error) throw error;
      return data || [];
    },
    enabled: enabled && !!invoiceId,
  });
}

/** Fetch all links (for checking linked status across documents) */
export function useAllInvoiceDocumentLinks(enabled = true) {
  return useQuery({
    queryKey: ["invoice-document-links-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_document_links")
        .select("id, invoice_id, document_id, document_type, linked_at");
      if (error) throw error;
      return data || [];
    },
    enabled,
  });
}

/** Helper: check if a document has any linked invoices */
export function hasLinkedInvoice(
  links: { document_id: string; document_type: string }[],
  documentId: string,
  documentType: string
): boolean {
  return links.some(l => l.document_id === documentId && l.document_type === documentType);
}
