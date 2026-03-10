import { useState } from "react";
import { Suspense, lazy } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, ClipboardCheck, Receipt, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DocumentiContabiliPage = lazy(() => import("./DocumentiContabiliPage"));
const DocumentiOperativiPage = lazy(() => import("./DocumentiOperativiPage"));
const RegistroPage = lazy(() => import("../management-control-2/RegistroPage"));

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
  const [dismissing, setDismissing] = useState<string | null>(null);

  const dismissMutation = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase
        .from(table as any)
        .update({ non_contabilizzato: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents-count"] });
      toast.success("Documento segnato come non contabilizzato");
      setDismissing(null);
    },
    onError: () => {
      toast.error("Errore nell'aggiornamento");
      setDismissing(null);
    },
  });

  const dismissAll = useMutation({
    mutationFn: async () => {
      if (!data) return;
      const promises: Promise<any>[] = [];
      if (data.ddts.length > 0) {
        promises.push(
          supabase
            .from("ddts")
            .update({ non_contabilizzato: true })
            .is("accounting_document_id", null)
            .eq("non_contabilizzato", false)
        );
      }
      if (data.orders.length > 0) {
        promises.push(
          supabase
            .from("sales_orders")
            .update({ non_contabilizzato: true })
            .is("accounting_document_id", null)
            .eq("non_contabilizzato", false)
        );
      }
      if (data.reports.length > 0) {
        promises.push(
          supabase
            .from("service_reports")
            .update({ non_contabilizzato: true })
            .is("accounting_document_id", null)
            .eq("non_contabilizzato", false)
        );
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unlinked-documents-count"] });
      toast.success("Tutti i documenti segnati come non contabilizzati");
    },
  });

  if (isLoading || !data || data.totalUnlinked === 0) return null;

  return (
    <Alert variant="destructive" className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-300">
        {data.totalUnlinked} document{data.totalUnlinked > 1 ? "i" : "o"} non collegat{data.totalUnlinked > 1 ? "i" : "o"} a documenti contabili
      </AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-400">
        <div className="mt-2 space-y-1 text-sm">
          {data.ddts.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{data.ddts.length} DDT</Badge>
              {data.ddts.slice(0, 3).map((d: any) => (
                <span key={d.id} className="text-xs">{d.ddt_number || d.id.slice(0, 6)}</span>
              ))}
              {data.ddts.length > 3 && <span className="text-xs">+{data.ddts.length - 3} altri</span>}
            </div>
          )}
          {data.orders.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{data.orders.length} Ordini</Badge>
              {data.orders.slice(0, 3).map((o: any) => (
                <span key={o.id} className="text-xs">{o.number || o.id.slice(0, 6)}</span>
              ))}
              {data.orders.length > 3 && <span className="text-xs">+{data.orders.length - 3} altri</span>}
            </div>
          )}
          {data.reports.length > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{data.reports.length} Rapporti</Badge>
              {data.reports.slice(0, 3).map((r: any) => (
                <span key={r.id} className="text-xs">{r.report_number || r.id.slice(0, 6)}</span>
              ))}
              {data.reports.length > 3 && <span className="text-xs">+{data.reports.length - 3} altri</span>}
            </div>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissAll.mutate()}
            disabled={dismissAll.isPending}
            className="text-amber-700 border-amber-400 hover:bg-amber-100"
          >
            {dismissAll.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
              <XCircle className="h-3 w-3 mr-1" />
            )}
            Segna tutti come non contabilizzati
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}

export default function DocumentiPage() {
  const [activeTab, setActiveTab] = useState("contabili");
  const { data: unlinkedData } = useUnlinkedDocuments();
  const unlinkedCount = unlinkedData?.totalUnlinked || 0;

  return (
    <div className="container mx-auto py-6 space-y-6" style={{ maxWidth: "1600px" }}>
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documenti</h1>
          <p className="text-muted-foreground">
            Documenti contabili, operativi e giustificativi
          </p>
        </div>
      </div>

      <UnlinkedDocumentsAlert />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contabili" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documenti Contabili
          </TabsTrigger>
          <TabsTrigger value="operativi" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Documenti Operativi
            {unlinkedCount > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0">
                {unlinkedCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="giustificativi" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Giustificativi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contabili" className="mt-0">
          <Suspense fallback={<Card><CardContent className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>}>
            <DocumentiContabiliPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="operativi" className="mt-0">
          <Suspense fallback={<Card><CardContent className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>}>
            <DocumentiOperativiPage />
          </Suspense>
        </TabsContent>

        <TabsContent value="giustificativi" className="mt-0">
          <Suspense fallback={<Card><CardContent className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>}>
            <RegistroPage />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
