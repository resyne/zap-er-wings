import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, BookOpen } from "lucide-react";
import RegistroPage from "./RegistroPage";
import PrimaNotaMovimentiPage from "./PrimaNotaMovimentiPage";

export default function PrimaNotaPage() {
  const [activeTab, setActiveTab] = useState("registro");

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prima Nota</h1>
        <p className="text-muted-foreground">
          Registra spese e incassi, classifica e consulta i movimenti contabili
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="registro" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            Inbox Registrazioni
          </TabsTrigger>
          <TabsTrigger value="movimenti" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Movimenti Contabili
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registro" className="mt-0">
          <RegistroPage embedded />
        </TabsContent>

        <TabsContent value="movimenti" className="mt-0">
          <PrimaNotaMovimentiPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}
