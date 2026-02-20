import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DesignRequestsSection } from "@/components/supplier-portal/DesignRequestsSection";
import { Pencil, FolderKanban } from "lucide-react";

const COEM_SUPPLIER_ID = "f68ad624-666e-466b-8910-7b1b53e8d7f0";

const ProductionProjectsPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Progetti di Produzione</h1>
        <p className="text-muted-foreground">
          Gestione progetti e progettazioni commissionate
        </p>
      </div>

      <Tabs defaultValue="design" className="w-full">
        <TabsList>
          <TabsTrigger value="design" className="gap-2">
            <Pencil className="h-4 w-4" />
            Progettazioni COEM
          </TabsTrigger>
        </TabsList>

        <TabsContent value="design" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5 text-primary" />
                Progettazioni commissionate a Francesco D'Auria (COEM SRL)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DesignRequestsSection supplierId={COEM_SUPPLIER_ID} isSupplierView={false} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProductionProjectsPage;
