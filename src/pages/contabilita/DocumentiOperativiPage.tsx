import { useState, Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Truck, Wrench, CheckSquare, Receipt, Loader2 } from "lucide-react";
import DdtSection from "@/components/documenti-operativi/DdtSection";
import OrdiniSection from "@/components/documenti-operativi/OrdiniSection";
import OfferteAccettateSection from "@/components/documenti-operativi/OfferteAccettateSection";
import RapportiSection from "@/components/documenti-operativi/RapportiSection";

const GiustificativiSection = lazy(() => import("../management-control-2/RegistroPage"));

const Fallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="text-center space-y-3">
      <div className="h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">Caricamento...</p>
    </div>
  </div>
);

const tabs = [
  { value: "ddt", label: "DDT", icon: Truck },
  { value: "ordini", label: "Ordini", icon: ShoppingCart },
  { value: "offerte", label: "Offerte Accettate", icon: CheckSquare },
  { value: "rapporti", label: "Rapporti", icon: Wrench },
  { value: "giustificativi", label: "Giustificativi", icon: Receipt },
] as const;

export default function DocumentiOperativiPage() {
  const [activeTab, setActiveTab] = useState("ddt");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
      <TabsList className="w-full flex h-auto p-1 bg-muted/50 rounded-xl gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.value;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all
                ${isActive 
                  ? "bg-background shadow-sm text-foreground" 
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{tab.label}</span>
              <span className="md:hidden text-xs">{tab.label.split(' ')[0]}</span>
            </TabsTrigger>
          );
        })}
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
  );
}
