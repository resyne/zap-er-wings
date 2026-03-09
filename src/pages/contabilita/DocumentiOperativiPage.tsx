import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ShoppingCart, Truck, Wrench, CheckSquare } from "lucide-react";

export default function DocumentiOperativiPage() {
  const [activeTab, setActiveTab] = useState("ddt");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documenti Operativi</h1>
          <p className="text-muted-foreground">
            DDT, ordini, offerte accettate e rapporti di intervento
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
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
      </Tabs>
    </div>
  );
}
