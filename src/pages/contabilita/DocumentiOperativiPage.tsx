import { useState, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Truck, Wrench, CheckSquare, Receipt, Loader2 } from "lucide-react";
import DdtSection from "@/components/documenti-operativi/DdtSection";
import OrdiniSection from "@/components/documenti-operativi/OrdiniSection";
import OfferteAccettateSection from "@/components/documenti-operativi/OfferteAccettateSection";
import RapportiSection from "@/components/documenti-operativi/RapportiSection";

const GiustificativiSection = lazy(() => import("../management-control-2/RegistroPage"));

const Fallback = () => (
  <Card><CardContent className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>
);

export default function DocumentiOperativiPage() {
  const [activeTab, setActiveTab] = useState("ddt");

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="ddt" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            DDT
          </TabsTrigger>
          <TabsTrigger value="ordini" className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Ordini
          </TabsTrigger>
          <TabsTrigger value="offerte" className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Offerte Accettate
          </TabsTrigger>
          <TabsTrigger value="rapporti" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Rapporti
          </TabsTrigger>
          <TabsTrigger value="giustificativi" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Giustificativi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ddt" className="mt-0">
          <DdtSection />
        </TabsContent>

        <TabsContent value="ordini" className="mt-0">
          <OrdiniSection />
        </TabsContent>

        <TabsContent value="offerte" className="mt-0">
          <OfferteAccettateSection />
        </TabsContent>

        <TabsContent value="rapporti" className="mt-0">
          <RapportiSection />
        </TabsContent>

        <TabsContent value="giustificativi" className="mt-0">
          <Suspense fallback={<Fallback />}>
            <GiustificativiSection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
