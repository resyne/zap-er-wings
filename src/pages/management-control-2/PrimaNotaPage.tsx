import { useState, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  ArrowUp, ArrowDown, FileText, CheckCircle,
  ChevronDown, Receipt, Sparkles,
  ClipboardList, Wallet, Info, ArrowLeftRight
} from "lucide-react";
import { MovimentiFinanziariContent } from "./MovimentiFinanziariPage";
import { BozzaValidaDialog } from "@/components/prima-nota/BozzaValidaDialog";
import { PreMovementSection } from "@/components/prima-nota/PreMovementSection";
import { LibroGiornaleTab } from "@/components/prima-nota/LibroGiornaleTab";

const RegistroContabileContent = lazy(() => import("./RegistroContabilePage"));

export default function PrimaNotaPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("registro-contabile");
  const [selectedBozza, setSelectedBozza] = useState<any>(null);
  const [bozzaDialogOpen, setBozzaDialogOpen] = useState(false);

  // Fetch bozze
  const { data: bozze = [] } = useQuery({
    queryKey: ["bozze-prima-nota"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_entries")
        .select(`*, chart_account:chart_of_accounts(code, name), cost_center:cost_centers(code, name), profit_center:profit_centers(code, name)`)
        .in("status", ["da_classificare", "in_classificazione", "sospeso", "pronto_prima_nota"])
        .is("pre_movement_status", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: pendingDocuments = [] } = useQuery({
    queryKey: ["pending-accounting-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounting_documents")
        .select("*, customers(name, company_name)")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const totalPending = bozze.length + pendingDocuments.length;

  return (
    <div className="mx-auto px-4 md:px-6 max-w-[1600px] space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prima Nota</h1>
          <p className="text-sm text-muted-foreground">Registro contabile, scritture e movimenti finanziari</p>
        </div>
      </div>

      {/* Guida collassabile */}
      <GuideSection />

      {/* Bozze da validare */}
      {totalPending > 0 && (
        <BozzeSection
          bozze={bozze}
          pendingDocuments={pendingDocuments}
          onSelectBozza={(b) => { setSelectedBozza(b); setBozzaDialogOpen(true); }}
        />
      )}

      {/* Pre-movimenti */}
      <PreMovementSection />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="h-11 p-1 bg-muted/60 backdrop-blur-sm w-full md:w-auto grid grid-cols-3 md:inline-flex">
          <TabsTrigger value="registro-contabile" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Registro Contabile</span>
            <span className="sm:hidden">Registro</span>
          </TabsTrigger>
          <TabsTrigger value="movements" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Libro Giornale</span>
            <span className="sm:hidden">Giornale</span>
          </TabsTrigger>
          <TabsTrigger value="movimenti-finanziari" className="gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm">
            <Wallet className="h-4 w-4" />
            Movimenti
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro-contabile" className="mt-0">
          <Suspense fallback={
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-3">
                <div className="h-8 w-8 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Caricamento...</p>
              </div>
            </div>
          }>
            <RegistroContabileContent />
          </Suspense>
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          <LibroGiornaleTab />
        </TabsContent>

        <TabsContent value="movimenti-finanziari" className="mt-0">
          <MovimentiFinanziariContent />
        </TabsContent>
      </Tabs>

      <BozzaValidaDialog open={bozzaDialogOpen} onOpenChange={setBozzaDialogOpen} entry={selectedBozza} />
    </div>
  );
}

// =====================================================
// GUIDE SECTION
// =====================================================

function GuideSection() {
  return (
    <Collapsible>
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Come utilizzare la Prima Nota</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
                Dettagli
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Tutti i movimenti che riguardano denaro o strumenti equivalenti — per ricostruire il flusso di cassa, allineare cassa e banca, generare il cash flow.
          </CardDescription>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-2">
            <div className="grid gap-4 md:grid-cols-3">
              <GuideCard icon={<ArrowUp className="h-4 w-4 text-emerald-600" />} title="Entrate" color="bg-emerald-100 dark:bg-emerald-900/30" dotColor="bg-emerald-500"
                items={["Incasso fattura cliente", "Vendita in contanti", "Bonifico ricevuto", "Incasso POS"]} />
              <GuideCard icon={<ArrowDown className="h-4 w-4 text-red-600" />} title="Uscite" color="bg-red-100 dark:bg-red-900/30" dotColor="bg-red-500"
                items={["Pagamento fornitore", "Spese bancarie", "Pagamento stipendi", "Pagamento F24", "Acquisto pagato subito"]} />
              <GuideCard icon={<ArrowLeftRight className="h-4 w-4 text-blue-600" />} title="Movimenti interni" color="bg-blue-100 dark:bg-blue-900/30" dotColor="bg-blue-500"
                items={["Giroconto banca → cassa", "Prelievo contanti", "Versamento contanti"]} />
            </div>
            <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
              <p className="text-sm text-muted-foreground">
                👉 Questi movimenti servono per: <strong>ricostruire il flusso di cassa</strong>, <strong>allineare cassa e banca</strong> e <strong>generare il cash flow</strong>.
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function GuideCard({ icon, title, color, dotColor, items }: { icon: React.ReactNode; title: string; color: string; dotColor: string; items: string[] }) {
  return (
    <div className="rounded-lg border bg-background p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className={`h-8 w-8 rounded-full ${color} flex items-center justify-center`}>{icon}</div>
        <h4 className="font-semibold text-sm">{title}</h4>
      </div>
      <ul className="text-sm text-muted-foreground space-y-1 pl-2">
        {items.map(item => (
          <li key={item} className="flex items-center gap-2"><span className={`h-1 w-1 rounded-full ${dotColor}`} />{item}</li>
        ))}
      </ul>
    </div>
  );
}

// =====================================================
// BOZZE SECTION
// =====================================================

function BozzeSection({ bozze, pendingDocuments, onSelectBozza }: {
  bozze: any[]; pendingDocuments: any[]; onSelectBozza: (b: any) => void;
}) {
  const queryClient = useQueryClient();
  const total = bozze.length + pendingDocuments.length;

  return (
    <Card className="border-amber-300/50 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-700/30">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ClipboardList className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base">Bozze da validare</CardTitle>
              <CardDescription className="text-xs">
                {total} moviment{total === 1 ? 'o' : 'i'} in attesa di validazione e contabilizzazione
              </CardDescription>
            </div>
          </div>
          <Badge variant="destructive" className="px-2 py-1 text-sm">{total}</Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-2 space-y-2">
        {/* AI Documents */}
        {pendingDocuments.map((doc: any) => {
          const isVendita = doc.document_type === "fattura_vendita";
          const customerName = doc.customers?.company_name || doc.customers?.name || doc.counterpart_name;
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
              onClick={async () => {
                try {
                  const direction = isVendita ? "entrata" : "uscita";
                  const { data: newEntry, error: entryError } = await supabase
                    .from("accounting_entries")
                    .insert({
                      direction,
                      document_type: doc.document_type === "nota_credito" ? "nota_credito" : "fattura",
                      amount: doc.total_amount || 0,
                      document_date: doc.invoice_date || new Date().toISOString().split("T")[0],
                      attachment_url: doc.file_url,
                      status: "da_classificare",
                      iva_aliquota: doc.vat_rate,
                      imponibile: doc.net_amount,
                      iva_amount: doc.vat_amount,
                      totale: doc.total_amount,
                      iva_mode: "DOMESTICA_IMPONIBILE",
                      note: `${isVendita ? "Fattura vendita" : "Fattura acquisto"} n.${doc.invoice_number || "?"} - ${customerName || ""}`,
                    })
                    .select().single();
                  if (entryError) throw entryError;
                  await supabase.from("accounting_documents").update({ status: "classified", accounting_entry_id: newEntry.id }).eq("id", doc.id);
                  queryClient.invalidateQueries({ queryKey: ["pending-accounting-documents"] });
                  queryClient.invalidateQueries({ queryKey: ["bozze-prima-nota"] });
                  onSelectBozza(newEntry);
                } catch (err: any) {
                  toast.error("Errore: " + (err.message || "Errore sconosciuto"));
                }
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-full ${isVendita ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
                  {isVendita ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">€ {(doc.total_amount || 0).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                    <Badge variant="outline" className="text-xs gap-1"><Sparkles className="h-3 w-3" />AI</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {doc.invoice_number && `N. ${doc.invoice_number} · `}
                    {doc.invoice_date && format(new Date(doc.invoice_date), "dd MMM yyyy", { locale: it })}
                    {customerName && ` · ${customerName}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">Crea Bozza →</Badge>
            </div>
          );
        })}

        {/* Bozze */}
        {bozze.map((bozza: any) => (
          <div
            key={bozza.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-colors cursor-pointer"
            onClick={() => onSelectBozza(bozza)}
          >
            <div className="flex items-center gap-3">
              <div className={`p-1.5 rounded-full ${bozza.direction === "entrata" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-red-100 text-red-600 dark:bg-red-900/30"}`}>
                {bozza.direction === "entrata" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">€ {(bozza.totale || bozza.amount).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</span>
                  <Badge variant="outline" className="text-xs capitalize">{(bozza.document_type || "").replace(/_/g, " ")}</Badge>
                  <Badge variant={bozza.status === "pronto_prima_nota" ? "default" : "secondary"} className="text-xs">
                    {bozza.status === "da_classificare" ? "Da validare" :
                      bozza.status === "in_classificazione" ? "In lavorazione" :
                        bozza.status === "pronto_prima_nota" ? "Pronto" :
                          bozza.status.replace(/_/g, " ")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(bozza.document_date), "dd MMM yyyy", { locale: it })}
                  {bozza.note && ` · ${bozza.note}`}
                </p>
              </div>
            </div>
            <Button variant="default" size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); onSelectBozza(bozza); }}>
              <CheckCircle className="h-3 w-3" />
              Valida
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
