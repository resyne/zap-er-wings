import { Suspense, lazy, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ClipboardCheck, AlertTriangle, XCircle, Loader2, Upload, Sparkles, CheckCircle2, AlertCircle, FileText, Truck, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import { findSimilarSubjects } from "@/lib/fuzzyMatch";
import { cn } from "@/lib/utils";

const DocumentiOperativiPage = lazy(() => import("./DocumentiOperativiPage"));

function useUnlinkedDocuments() {
  return useQuery({
    queryKey: ["unlinked-documents-count"],
    queryFn: async () => {
      const [ddtsRes, ordersRes, reportsRes] = await Promise.all([
        supabase
          .from("ddts")
          .select("id, ddt_number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false),
        supabase
          .from("sales_orders")
          .select("id, number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false),
        supabase
          .from("service_reports")
          .select("id, report_number, created_at", { count: "exact" })
          .is("accounting_document_id", null)
          .eq("non_contabilizzato", false)
          .eq("status", "completed"),
      ]);

      const ddts = ddtsRes.data || [];
      const orders = ordersRes.data || [];
      const reports = reportsRes.data || [];

      return {
        ddts,
        orders,
        reports,
        totalUnlinked: ddts.length + orders.length + reports.length,
      };
    },
  });
}

function UnlinkedDocumentsAlert() {
  const { data, isLoading } = useUnlinkedDocuments();
  const queryClient = useQueryClient();

  const dismissAll = useMutation({
    mutationFn: async () => {
      if (!data) return;
      
      if (data.ddts.length > 0) {
        const ddtIds = data.ddts.map((d: any) => d.id);
        for (const id of ddtIds) {
          await supabase.from("ddts").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
      if (data.orders.length > 0) {
        const orderIds = data.orders.map((o: any) => o.id);
        for (const id of orderIds) {
          await supabase.from("sales_orders").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
      if (data.reports.length > 0) {
        const reportIds = data.reports.map((r: any) => r.id);
        for (const id of reportIds) {
          await supabase.from("service_reports").update({ non_contabilizzato: true }).eq("id", id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents-count"] });
      toast.success("Tutti i documenti segnati come non contabilizzati");
    },
  });

  if (isLoading || !data || data.totalUnlinked === 0) return null;

  return (
    <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        {data.totalUnlinked} document{data.totalUnlinked > 1 ? "i" : "o"} non collegat{data.totalUnlinked > 1 ? "i" : "o"} a registrazioni contabili
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400">
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {data.ddts.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.ddts.length} DDT</Badge>
          )}
          {data.orders.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.orders.length} Ordini</Badge>
          )}
          {data.reports.length > 0 && (
            <Badge variant="outline" className="text-xs border-amber-400/50">{data.reports.length} Rapporti</Badge>
          )}
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissAll.mutate()}
            disabled={dismissAll.isPending}
            className="text-amber-700 border-amber-400 hover:bg-amber-100 dark:hover:bg-amber-950/40"
          >
            {dismissAll.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
            ) : (
              <XCircle className="h-3 w-3 mr-1.5" />
            )}
            Segna tutti come non contabilizzati
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default function DocumentiPage() {
  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documenti Operativi</h1>
          <p className="text-sm text-muted-foreground">
            DDT, Ordini, Offerte Accettate, Rapporti di Intervento e Giustificativi
          </p>
        </div>
      </div>

      <UnlinkedDocumentsAlert />

      <Suspense fallback={
        <div className="flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Caricamento...</p>
          </div>
        </div>
      }>
        <DocumentiOperativiPage />
      </Suspense>
    </div>
  );
}
