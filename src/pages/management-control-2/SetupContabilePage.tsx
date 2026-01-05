import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, BookOpen, Building2, Cog } from "lucide-react";
import ChartOfAccountsPage from "./ChartOfAccountsPage";
import CostCentersPage from "./CostCentersPage";
import AccountingEnginePage from "./AccountingEnginePage";

export default function SetupContabilePage() {
  const [activeTab, setActiveTab] = useState("chart-of-accounts");

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Setup Contabile</h1>
          <p className="text-muted-foreground">
            Configurazione del piano dei conti, centri di costo/ricavo e motore contabile
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="chart-of-accounts" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Piano dei Conti
          </TabsTrigger>
          <TabsTrigger value="cost-centers" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Centri Costo/Ricavo
          </TabsTrigger>
          <TabsTrigger value="accounting-engine" className="flex items-center gap-2">
            <Cog className="h-4 w-4" />
            Motore Contabile
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chart-of-accounts" className="mt-0">
          <ChartOfAccountsPage embedded />
        </TabsContent>

        <TabsContent value="cost-centers" className="mt-0">
          <CostCentersPage embedded />
        </TabsContent>

        <TabsContent value="accounting-engine" className="mt-0">
          <AccountingEnginePage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
