import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Receipt, CreditCard } from "lucide-react";

export default function DocumentiContabiliPage() {
  const [activeTab, setActiveTab] = useState("fatture-vendita");

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documenti Contabili</h1>
          <p className="text-muted-foreground">
            Fatture di vendita, fatture di acquisto e note di credito
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="fatture-vendita" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Fatture Vendita
          </TabsTrigger>
          <TabsTrigger value="fatture-acquisto" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Fatture Acquisto
          </TabsTrigger>
          <TabsTrigger value="note-credito" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Note di Credito
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fatture-vendita" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Fatture di Vendita</CardTitle>
              <CardDescription>Registro delle fatture emesse ai clienti</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione fatture di vendita — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fatture-acquisto" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Fatture di Acquisto</CardTitle>
              <CardDescription>Registro delle fatture ricevute dai fornitori</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione fatture di acquisto — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="note-credito" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle>Note di Credito</CardTitle>
              <CardDescription>Gestione delle note di credito emesse e ricevute</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-48 text-muted-foreground">
                <p>Sezione note di credito — in fase di sviluppo</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
