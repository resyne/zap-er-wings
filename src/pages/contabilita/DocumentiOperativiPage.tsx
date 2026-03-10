import { useState } from "react";
import { Suspense, lazy } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Truck, Wrench, CheckSquare, Receipt, Loader2 } from "lucide-react";

const GiustificativiSection = lazy(() => import("../management-control-2/RegistroPage"));

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
          <Card>
            <CardHeader>
              <CardTitle>DDT</CardTitle>
              <CardDescription>Documenti di trasporto emessi e ricevuti</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione DDT — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ordini" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Ordini</CardTitle>
              <CardDescription>Ordini di vendita confermati</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione ordini — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offerte" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Offerte Accettate</CardTitle>
              <CardDescription>Offerte commerciali accettate dal cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione offerte accettate — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rapporti" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Rapporti di Intervento</CardTitle>
              <CardDescription>Rapporti delle attività di assistenza tecnica</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione rapporti di intervento — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="giustificativi" className="mt-0">
          <Suspense fallback={<Card><CardContent className="flex items-center justify-center h-48"><Loader2 className="h-6 w-6 animate-spin" /></CardContent></Card>}>
            <GiustificativiSection />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
