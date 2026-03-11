import { useState, lazy, Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ArrowUp, ArrowDown, FileText,
  ChevronDown, Receipt,
  Wallet, Info, ArrowLeftRight
} from "lucide-react";
import { MovimentiFinanziariContent } from "./MovimentiFinanziariPage";
import { PreMovementSection } from "@/components/prima-nota/PreMovementSection";
import { LibroGiornaleTab } from "@/components/prima-nota/LibroGiornaleTab";

const RegistroContabileContent = lazy(() => import("./RegistroContabilePage"));

export default function PrimaNotaPage() {
  const [activeTab, setActiveTab] = useState("registro-contabile");

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
